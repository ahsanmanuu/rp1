import { NextRequest, NextResponse } from "next/server";
import { createPb } from "@/lib/pb";
import { setAuthCookie } from "@/lib/auth-pb";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

    const pb = createPb();
    let authData;
    try {
      authData = await pb.collection("users").authWithPassword(email, password);
    } catch (pbAuthErr: any) {
      // PB auth failed — try the PB adapter (which also queries PocketBase)
      // in case the password hash in PB needs to be refreshed
      const dbUser = await prisma.user.findUnique({
        where: { email },
      });
      if (dbUser && dbUser.password) {
        const isDbValid = await bcrypt.compare(password, dbUser.password);
        if (isDbValid) {
          console.log(`[AUTH pb-login] PB adapter password valid for ${email}. Syncing to PocketBase...`);
          try {
            const { pbAdmin } = await import("@/lib/pb");
            const admPb = await pbAdmin();
            const pbUserRecord = await admPb.collection("users").getFirstListItem(`email = "${email}"`);
            await admPb.collection("users").update(pbUserRecord.id, {
              password: password,
              passwordConfirm: password
            });
            console.log(`[AUTH pb-login] Password synced to PocketBase for ${email}. Retrying login...`);
            authData = await pb.collection("users").authWithPassword(email, password);
          } catch (syncErr: any) {
            console.error(`[AUTH pb-login] Failed to sync password to PocketBase:`, syncErr.message);
            throw pbAuthErr;
          }
        } else {
          throw pbAuthErr;
        }
      } else {
        throw pbAuthErr;
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
    const clientMachineId = machineId || "unknown";

    // Check for any existing active sessions for this user
    const existingSessions = await prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: { gte: new Date() },
      },
    });

    if (existingSessions.length > 0) {
      // Return 409 to trigger the duplicate login modal on the client
      return NextResponse.json(
        {
          error: "ALREADY_LOGGED_IN",
          message: "Active session detected on another device.",
          existingSessionCount: existingSessions.length,
          sessionDetails: existingSessions.map((s: any) => ({
            ipAddress: s.ipAddress || "Unknown IP",
            location: s.location || "Unknown Location",
            machineId: s.machineId || "Unknown Machine",
            createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
          }))
        },
        { status: 409 }
      );
    }

    // No duplicate: create a new session record
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

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

    try {
      const { pbAdmin } = await import("@/lib/pb");
      const admPb = await pbAdmin();
      await admPb.collection("user_sessions").create({
        userId,
        sessionToken,
        machineId: clientMachineId,
        ipAddress,
        location,
        userAgent,
        lastActiveAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
    } catch (pbErr: any) {
      console.error("[AUTH] PocketBase user_sessions sync failed:", pbErr.message);
    }

    const user = {
      id: record.id,
      email: record.email,
      name: record.name || record.email?.split("@")[0] || "",
      theme: record.theme || "dark",
      points: record.points ?? 50,
      membership: record.membership || "free",
      role: record.role || "user",
    };

    const response = NextResponse.json({ success: true, user });
    response.headers.append("Set-Cookie", setAuthCookie(authData.token));
    return response;
  } catch (err: any) {
    const msg = err?.message || String(err);
    const isConnError = msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('unreachable');
    if (isConnError) {
      return NextResponse.json({ error: 'Authentication service is temporarily unavailable. Please try again later.' }, { status: 503 });
    }
    const message = err?.status === 400 ? "Invalid credentials" : msg || "Login failed";
    return NextResponse.json({ error: message }, { status: err?.status || 500 });
  }
}
