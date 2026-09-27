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
    const { email, password, machineId, force } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Access key (password) must be at least 8 characters long." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Ensure PocketBase is running and responsive before attempting login
    const { ensureAndStartPocketBase, isPocketBaseHealthy } = await import("@/lib/pb-starter");
    if (!(await isPocketBaseHealthy())) {
      console.log("[AUTH pb-login] PocketBase is offline, auto-starting process before login attempt...");
      await ensureAndStartPocketBase();
    }

    const pb = createPb();

    let authData;
    let lastAuthErr: any;
    try {
      authData = await pb.collection("users").authWithPassword(cleanEmail, password);
    } catch (e: any) {
      lastAuthErr = e;
      if (isTransientAuthError(e)) {
        console.warn(`[AUTH pb-login] authWithPassword failed transiently, ensuring PB alive and retrying once:`, e?.message || e);
        await ensureAndStartPocketBase();
        await new Promise(r => setTimeout(r, 600));
        try {
          authData = await pb.collection("users").authWithPassword(cleanEmail, password);
          lastAuthErr = null;
        } catch (e2: any) {
          lastAuthErr = e2;
        }
      }
    }

    if (!authData) {
      const { pbAdmin } = await import("@/lib/pb");
      let admPb: any = null;
      try {
        admPb = await pbAdmin();
      } catch (admErr: any) {
        console.warn("[AUTH pb-login] pbAdmin connection attempt failed:", admErr?.message || admErr);
      }

      let matchedUser: any = null;
      if (admPb) {
        // Try exact email match
        try {
          matchedUser = await admPb.collection("users").getFirstListItem(`email = "${cleanEmail}"`);
        } catch {}

        // If not found, try case-insensitive ~ match (e.g. if registered with capital letters)
        if (!matchedUser) {
          try {
            matchedUser = await admPb.collection("users").getFirstListItem(`email ~ "${cleanEmail}"`);
          } catch {}
        }

        // If user was found with different casing in PocketBase, try authenticating with the exact stored email:
        if (matchedUser && matchedUser.email && matchedUser.email !== cleanEmail) {
          try {
            authData = await pb.collection("users").authWithPassword(matchedUser.email, password);
            lastAuthErr = null;
            // Normalize email in PocketBase to lowercased cleanEmail for future logins
            await admPb.collection("users").update(matchedUser.id, { email: cleanEmail }).catch(() => {});
          } catch (casingAuthErr: any) {
            lastAuthErr = casingAuthErr;
          }
        }
      }

      // If still not authenticated, check local SQLite dev.db (which holds bcrypt password hashes)
      if (!authData) {
        try {
          const { verifyUserInLocalDb } = await import("@/lib/localDbSync");
          const isDevDbValid = await verifyUserInLocalDb(cleanEmail, password);
          if (isDevDbValid && admPb) {
            console.log(`[AUTH pb-login] User ${cleanEmail} verified via local SQLite dev.db. Syncing to PocketBase...`);
            if (matchedUser) {
              await admPb.collection("users").update(matchedUser.id, {
                password,
                passwordConfirm: password,
                verified: true,
              });
            } else {
              matchedUser = await admPb.collection("users").create({
                email: cleanEmail,
                password,
                passwordConfirm: password,
                verified: true,
                emailVisibility: true,
                name: cleanEmail.split("@")[0],
                points: 50,
                theme: "dark",
                membership: "free",
                role: "user",
                status: "active",
              });
            }
            authData = await pb.collection("users").authWithPassword(cleanEmail, password);
            lastAuthErr = null;
          }
        } catch (devDbErr: any) {
          console.warn("[AUTH pb-login] dev.db verification warning:", devDbErr?.message || devDbErr);
        }
      }

      // If STILL not authenticated, determine if user exists anywhere:
      if (!authData) {
        let userExists = !!matchedUser;

        if (!userExists && admPb) {
          try {
            const list = await admPb.collection("users").getList(1, 1, {
              filter: `email = "${cleanEmail}" || email ~ "${cleanEmail}"`,
            });
            if (list.items.length > 0) userExists = true;
          } catch {}
        }

        if (!userExists) {
          try {
            const { userExistsInLocalDb } = await import("@/lib/localDbSync");
            if (userExistsInLocalDb(cleanEmail)) {
              userExists = true;
            }
          } catch {}
        }

        // Check if PocketBase was completely offline
        const pbHealthyNow = await isPocketBaseHealthy();
        if (!pbHealthyNow) {
          return NextResponse.json(
            { error: "Authentication service is temporarily unavailable. Please try again later." },
            { status: 503 }
          );
        }

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
    let clientMachineId = machineId || "";
    if (!clientMachineId || clientMachineId === "unknown") {
      const crypto = await import("crypto");
      clientMachineId = "fp_" + crypto.createHash("md5").update(`${ipAddress}-${userAgent}`).digest("hex");
    }

    // ── Check for active sessions on other devices ──────────────────────────
    let activeSessions: any[] = [];
    try {
      activeSessions = await prisma.userSession.findMany({
        where: { userId },
      });
    } catch (fetchErr) {
      console.warn("[AUTH pb-login] Prisma findMany sessions failed, trying direct PB:", fetchErr);
    }

    if (!activeSessions || activeSessions.length === 0) {
      try {
        const { pbAdmin } = await import("@/lib/pb");
        const admPb = await pbAdmin();
        const list = await admPb.collection("user_sessions").getFullList({
          filter: `userId = "${userId}"`,
          requestKey: null,
          $autoCancel: false,
        });
        activeSessions = list as any[];
      } catch {}
    }

    const nowMs = Date.now();
    const validSessions = (activeSessions || []).filter((s: any) => {
      if (!s) return false;
      if (s.expiresAt) {
        const exp = new Date(s.expiresAt).getTime();
        if (exp <= nowMs) return false;
      }
      return true;
    });

    const conflictingSessions = validSessions.filter(
      (s: any) => s.machineId && s.machineId !== clientMachineId
    );

    if (conflictingSessions.length > 0 && !force) {
      const sessionDetails = conflictingSessions.map((s: any) => ({
        ipAddress: s.ipAddress || "Unknown IP",
        location: s.location || "Unknown Location",
        machineId: s.machineId || "Unknown Device",
        createdAt: s.createdAt || s.created || s.lastActiveAt || new Date().toISOString(),
      }));

      console.warn(`[AUTH pb-login] Duplicate session blocked for user ${cleanEmail} on machine ${clientMachineId}. Conflicting devices:`, sessionDetails);

      return NextResponse.json(
        {
          error: "ALREADY_LOGGED_IN",
          sessionDetails,
        },
        { status: 409 }
      );
    }

    // ── Session cleanup ─────────────────────────────────────────────────────
    try {
      if (force) {
        // Clear all previous sessions for this user across devices
        await prisma.userSession.deleteMany({
          where: { userId },
        });
        const { pbAdmin, invalidateRecordCache } = await import("@/lib/pb");
        const admPb = await pbAdmin();
        const list = await admPb.collection("user_sessions").getFullList({
          filter: `userId = "${userId}"`,
          requestKey: null,
          $autoCancel: false,
        });
        const ids = list.map((s: any) => s.id);
        if (ids.length > 0) {
          await Promise.all(ids.map((id: string) => admPb.collection("user_sessions").delete(id)));
        }
        invalidateRecordCache();
      } else {
        // Clear old sessions on this same machine or expired sessions
        await prisma.userSession.deleteMany({
          where: {
            userId,
            OR: [
              { machineId: clientMachineId },
              { expiresAt: { lt: new Date() } },
            ],
          },
        });
      }
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
        const { refreshAdminAuth } = await import("@/lib/pb");
        const freshAdm = await refreshAdminAuth();
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
          _pb: freshAdm,
        });
      } catch (sessionErr2: any) {
        // Ultimate fallback: write directly to PocketBase user_sessions collection
        try {
          const directClient = (pb && pb.authStore.isValid) ? pb : await (await import("@/lib/pb")).pbAdmin();
          await directClient.collection("user_sessions").create({
            userId,
            sessionToken,
            machineId: clientMachineId,
            ipAddress,
            location,
            userAgent,
            lastActiveAt: new Date().toISOString().replace('T', ' '),
            expiresAt: expiresAt.toISOString().replace('T', ' '),
          }, { requestKey: null });
          console.log("[AUTH pb-login] Session persisted via direct PocketBase client fallback.");
        } catch (sessionErr3: any) {
          console.error("[AUTH pb-login] Session persist failed after all fallbacks:", sessionErr3.message);
          return NextResponse.json(
            { error: "Failed to establish a session. Please try again." },
            { status: 500 }
          );
        }
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