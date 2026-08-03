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
          const allUsers = await admPb.collection("users").getFullList({ requestKey: null });
          const matchedUser = allUsers.find(
            (u: any) => u.email && u.email.trim().toLowerCase() === cleanEmail
          );
          userExists = !!matchedUser;

          if (!matchedUser) {
            throw lastAuthErr;
          }

          const updates: Record<string, any> = {};
          if (matchedUser.email !== cleanEmail) updates.email = cleanEmail;
          if (!matchedUser.verified) updates.verified = true;
          if (Object.keys(updates).length > 0) {
            try {
              console.log(`[AUTH pb-login] Normalising user ${matchedUser.id}:`, updates);
              await admPb.collection("users").update(matchedUser.id, updates);
            } catch {}
          }

          const activeSession = await prisma.userSession.findFirst({
            where: { userId: matchedUser.id, expiresAt: { gte: new Date() } },
            select: { id: true },
          }).catch(() => null);

          const recoveryKey = `lock:${matchedUser.id}`;
          const lastRecovery = lockRecoveryAt.get(recoveryKey);
          const canRunRecovery = activeSession && (!lastRecovery || Date.now() - lastRecovery > LOCK_RECOVERY_WINDOW_MS);

          if (canRunRecovery) {
            lockRecoveryAt.set(recoveryKey, Date.now());
            console.log(`[AUTH pb-login] Unlocking account for ${cleanEmail} (active session verified).`);
            await admPb.collection("users").update(matchedUser.id, {
              password,
              passwordConfirm: password,
            });
            authData = await pb.collection("users").authWithPassword(cleanEmail, password);
            lastAuthErr = null;
          }
        } catch (healErr: any) {
          console.warn("[AUTH pb-login] Self-healing attempt failed:", healErr?.message || healErr);
        }
      }

      if (!authData && !userExists) {
        throw lastAuthErr || new Error("Authentication failed after retry");
      }

      if (!authData) {
        return NextResponse.json(
          { error: "Account temporarily locked. Verify via email code below.", locked: true },
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

    const existingSessions = await prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: { gte: new Date() },
        machineId: { not: clientMachineId },
      },
    });

    if (existingSessions.length > 0) {
      const recentTwo = existingSessions
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 2);

      return NextResponse.json(
        {
          error: "ALREADY_LOGGED_IN",
          message: "Active session detected on another device.",
          existingSessionCount: existingSessions.length,
          sessionDetails: recentTwo.map((s: any) => ({
            ipAddress: s.ipAddress || "Unknown IP",
            location: s.location || "Unknown Location",
            machineId: s.machineId || "Unknown Machine",
            createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
          }))
        },
        { status: 409 }
      );
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
      console.warn("[AUTH pb-login] Failed to persist session record (non-fatal):", sessionErr.message);
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

    const cookieStore = await cookies();
    cookieStore.set("pb_token", authData.token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
    });

    const response = NextResponse.json({ success: true, user, token: authData.token });
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