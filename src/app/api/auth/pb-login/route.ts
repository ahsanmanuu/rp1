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

export async function POST(req: NextRequest) {
  try {
    const { email, password, machineId } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    // Normalise email to lower case, matching the register route.
    const cleanEmail = email.trim().toLowerCase();

    const pb = createPb();

    // Retry authWithPassword once for transient PocketBase hiccups (WAL lock,
    // cold-start latency, etc.) before surfacing the error to the client.
    let authData;
    let lastAuthErr: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        authData = await pb.collection("users").authWithPassword(cleanEmail, password);
        lastAuthErr = null;
        break;
      } catch (e: any) {
        lastAuthErr = e;
        if (attempt === 0) {
          console.warn(`[AUTH pb-login] authWithPassword attempt ${attempt + 1} failed:`, e?.message || e);
          // Wait 500 ms before retrying (PocketBase may be checkpointing WAL).
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    if (!authData) {
      // Self-healing attempt: If initial auth failed with 400,
      // check if PocketBase has a user account with an un-normalized email (e.g. mixed case or trailing spaces)
      if (lastAuthErr?.status === 400) {
        try {
          const { pbAdmin } = await import("@/lib/pb");
          const admPb = await pbAdmin();
          const allUsers = await admPb.collection("users").getFullList({ requestKey: null });
          const matchedUser = allUsers.find(
            (u: any) => u.email && u.email.trim().toLowerCase() === cleanEmail
          );
          if (matchedUser && matchedUser.email !== cleanEmail) {
            console.log(`[AUTH pb-login] Self-healing user ${matchedUser.id}: normalizing email from "${matchedUser.email}" to "${cleanEmail}"`);
            await admPb.collection("users").update(matchedUser.id, { email: cleanEmail });
            // Retry authWithPassword with newly normalized email
            authData = await pb.collection("users").authWithPassword(cleanEmail, password);
            lastAuthErr = null;
          }
        } catch (healErr: any) {
          console.warn("[AUTH pb-login] Email self-healing attempt failed:", healErr.message);
        }
      }
    }

    if (!authData) {
      throw lastAuthErr || new Error("Authentication failed after retry");
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

    // Check for existing active sessions from OTHER machines
    const existingSessions = await prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: { gte: new Date() },
        machineId: { not: clientMachineId },
      },
    });

    if (existingSessions.length > 0) {
      // Return 2 most recent other sessions
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

    // No duplicate: create a new session record (best-effort — login still
    // succeeds if the adapter has a transient issue; the next session check
    // heals or recreates the record).
    try {
      const { ensurePbSessionCollectionFields } = await import("@/lib/pb-sync");
      await ensurePbSessionCollectionFields();
    } catch (e: any) {
      console.warn("[AUTH pb-login] Schema sync failed (non-fatal):", e.message);
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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
    const isConnError = msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('unreachable');
    if (isConnError) {
      return NextResponse.json({ error: 'Authentication service is temporarily unavailable. Please try again later.' }, { status: 503 });
    }
    // PocketBase's authWithPassword returns a 400 ClientResponseError for
    // "record not found" or "password doesn't match".  Our own 400s (missing
    // email/password) are thrown before authWithPassword is called.
    const message = err?.status === 400 ? "Invalid credentials" : msg || "Login failed";
    return NextResponse.json({ error: message }, { status: err?.status || 500 });
  }
}
