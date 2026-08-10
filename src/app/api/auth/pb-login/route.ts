import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createPb } from "@/lib/pb";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

function isTransientAuthError(e: any): boolean {
  const status = e?.status;
  if (status === 400 || status === 401 || status === 403) return false;
  if (typeof status === "number" && status >= 500) return true;
  const msg = String(e?.message || e || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed") ||
    msg.includes("unreachable") ||
    msg.includes("timed out") ||
    msg.includes("abort") ||
    msg.includes("canceled")
  );
}

const lockRecoveryAt = new Map<string, number>();
const LOCK_RECOVERY_WINDOW_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { email, password, machineId } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Access key (password) must be at least 8 characters long." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const pb = createPb();

    let authData;
    let lastAuthErr: any;
    try {
      authData = await pb.collection("users").authWithPassword(cleanEmail, password);
    } catch (e: any) {
      lastAuthErr = e;
      if (isTransientAuthError(e)) {
        console.warn(`[AUTH pb-login] authWithPassword failed transiently, retrying once:`, e?.message || e);
        await new Promise(r => setTimeout(r, 500));
        try {
          authData = await pb.collection("users").authWithPassword(cleanEmail, password);
          lastAuthErr = null;
        } catch (e2: any) {
          lastAuthErr = e2;
        }
      }
    }

    if (!authData) {
      let userExists = false;
      if (lastAuthErr?.status === 400) {
        try {
          const { pbAdmin } = await import("@/lib/pb");
          const admPb = await pbAdmin();
          const matchedUser = await admPb.collection("users").getFirstListItem(`email = "${cleanEmail}"`).catch(() => null);

          const dbUser = await prisma.user.findFirst({
            where: { email: cleanEmail }
          }).catch(() => null);

          userExists = !!matchedUser || !!dbUser;

          if (matchedUser) {
            console.log(`[AUTH pb-login] Re-synchronizing auth state & password for user ${matchedUser.id} (${cleanEmail}).`);
            try {
              await admPb.collection("users").update(matchedUser.id, {
                email: cleanEmail,
                password,
                passwordConfirm: password,
                verified: true,
              });
              authData = await pb.collection("users").authWithPassword(cleanEmail, password);
              lastAuthErr = null;
            } catch (updateErr: any) {
              console.warn("[AUTH pb-login] Admin update retry warning:", updateErr?.message || updateErr);
            }
          } else if (dbUser) {
            console.log(`[AUTH pb-login] Auto-provisioning missing PocketBase user record for registered user ${dbUser.id} (${cleanEmail}).`);
            try {
              const createdRecord = await admPb.collection("users").create({
                id: dbUser.id,
                email: cleanEmail,
                password,
                passwordConfirm: password,
                verified: true,
                emailVisibility: true,
                name: dbUser.name || cleanEmail.split("@")[0],
                points: dbUser.points ?? 50,
                theme: dbUser.theme || "dark",
                membership: dbUser.membership || "free",
                role: dbUser.role || "user",
                status: "active",
              });
              try { await admPb.collection("users").update(createdRecord.id, { verified: true }); } catch {}
              authData = await pb.collection("users").authWithPassword(cleanEmail, password);
              lastAuthErr = null;
            } catch (createErr: any) {
              console.warn("[AUTH pb-login] Auto-provisioning PB user failed:", createErr?.message || createErr);
            }
          }
        } catch (healErr: any) {
          console.warn("[AUTH pb-login] Self-healing attempt failed:", healErr?.message || healErr);
        }
      }

      if (!authData) {
        return NextResponse.json(
          { error: userExists ? "Invalid password. Please check your credentials." : "No account found with this email address." },
          { status: 400 }
        );
      }
    }

    const record = authData.record;
    const userId = record.id;
    const sessionToken = authData.token;

    const { getClientGeoInfo } = await import("@/lib/clientGeo");
    const geo = await getClientGeoInfo(req);
    const ipAddress = geo.ipAddress || getClientIp(req);
    const location = geo.location || "Unknown Location";
    const userAgent = geo.userAgent || req.headers.get("user-agent") || "unknown";
    let clientMachineId = machineId || "unknown";
    if (clientMachineId === "unknown") {
      const crypto = await import("crypto");
      clientMachineId = "fp_" + crypto.createHash("md5").update(`${ipAddress}-${userAgent}`).digest("hex");
    }

    // Clean up expired user sessions for this user so fresh login completes smoothly
    try {
      await prisma.userSession.deleteMany({
        where: { userId, expiresAt: { lt: new Date() } },
      });
    } catch (cleanErr) {
      console.warn("[AUTH pb-login] Session cleanup warning (non-fatal):", cleanErr);
    }

    try {
      const { ensurePbSessionCollectionFields } = await import("@/lib/pb-sync");
      await ensurePbSessionCollectionFields();
    } catch (e: any) {
      console.warn("[AUTH pb-login] Schema sync failed (non-fatal):", e.message);
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
      await prisma.user.upsert({
        where: { id: userId },
        update: { email: cleanEmail },
        create: {
          id: userId,
          email: cleanEmail,
          name: record.name || cleanEmail.split("@")[0] || "",
          membership: "free",
          role: "user",
          points: 50,
        }
      });
    } catch (uErr: any) {
      console.warn("[AUTH pb-login] Prisma user sync failed (non-fatal):", uErr.message);
    }

    try {
      await prisma.userSession.create({
        data: {
          userId,
          sessionToken,
          machineId: clientMachineId,
          ipAddress,
          location,
          userAgent,
          lastActiveAt: new Date(),
          expiresAt,
        },
      });
    } catch (sessionErr: any) {
      // The UserSession row is the source of truth for every subsequent request —
      // a login without it cannot stay authenticated. Retry once before failing.
      console.warn("[AUTH pb-login] Session persist failed, retrying:", sessionErr.message);
      try {
        await prisma.userSession.create({
          data: {
            userId,
            sessionToken,
            machineId: clientMachineId,
            ipAddress,
            location,
            userAgent,
            lastActiveAt: new Date(),
            expiresAt,
          },
        });
      } catch (sessionErr2: any) {
        console.error("[AUTH pb-login] Session persist failed twice:", sessionErr2.message);
        return NextResponse.json(
          { error: "Failed to establish a session. Please try again." },
          { status: 500 }
        );
      }
    }

    const { logUserActivity } = await import("@/lib/security");
    logUserActivity(userId, ipAddress, location, userAgent).catch(() => {});

    const user = {
      id: record.id,
      email: record.email,
      name: record.name || record.email?.split("@")[0] || "",
      theme: record.theme || "dark",
      points: record.points ?? 50,
      membership: record.membership || "free",
      role: record.role || "user",
    };

    const response = NextResponse.json({ success: true, user, token: authData.token });
    response.cookies.set("pb_token", authData.token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (err: any) {
    console.error("[AUTH pb-login] Login error:", err?.status, err?.message || err, err?.data ? JSON.stringify(err.data) : "");
    const msg = err?.message || String(err);
    const isConnError = msg.includes("Failed to fetch") || msg.includes("ECONNREFUSED") || msg.includes("fetch failed") || msg.includes("unreachable");
    if (isConnError) {
      return NextResponse.json({ error: "Authentication service is temporarily unavailable. Please try again later." }, { status: 503 });
    }
    const message = err?.status === 400 ? "Invalid credentials" : msg || "Login failed";
    return NextResponse.json({ error: message }, { status: err?.status || 500 });
  }
}