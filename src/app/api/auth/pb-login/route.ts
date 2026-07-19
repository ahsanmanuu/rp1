import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
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
      // PB auth failed — query the real PostgreSQL database to check credentials
      const { prisma: pgDb } = await import("@/lib/db");
      const dbUser = await pgDb.user.findUnique({
        where: { email },
      });

      if (dbUser && dbUser.password) {
        const isDbValid = await bcrypt.compare(password, dbUser.password);
        if (isDbValid) {
          console.log(`[AUTH pb-login] PostgreSQL password valid for ${email}. Syncing to PocketBase...`);
          try {
            const { pbAdmin } = await import("@/lib/pb");
            const admPb = await pbAdmin();
            
            let pbUserRecord;
            try {
              pbUserRecord = await admPb.collection("users").getFirstListItem(`email = "${email}"`);
            } catch {
              // User doesn't exist in PB (deleted or wiped) — re-create them in PB
              const freePlan = await pgDb.aiCapPlan.findFirst({ where: { name: 'free' } }).catch(() => null);
              pbUserRecord = await admPb.collection("users").create({
                id: dbUser.id,
                email: dbUser.email,
                password: password,
                passwordConfirm: password,
                name: dbUser.name || email.split("@")[0],
                points: dbUser.points,
                theme: dbUser.theme,
                membership: dbUser.membership,
                role: dbUser.role,
                status: dbUser.status,
                aiCapPlanId: dbUser.aiCapPlanId || freePlan?.id || null,
              });
            }

            await admPb.collection("users").update(pbUserRecord.id, {
              password: password,
              passwordConfirm: password,
              name: dbUser.name || email.split("@")[0],
              points: dbUser.points,
              theme: dbUser.theme,
              membership: dbUser.membership,
              role: dbUser.role,
              status: dbUser.status,
            });

            console.log(`[AUTH pb-login] Credentials successfully synced/re-created in PocketBase for ${email}. Retrying login...`);
            authData = await pb.collection("users").authWithPassword(email, password);
          } catch (syncErr: any) {
            console.error(`[AUTH pb-login] Failed to sync credentials to PocketBase:`, syncErr.message);
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

    // No duplicate: create a new session record
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    try {
      const { ensurePbSessionCollectionFields } = await import("@/lib/pb-sync");
      await ensurePbSessionCollectionFields();
    } catch (e: any) {
      console.warn("[AUTH pb-login] Schema sync failed (non-fatal):", e.message);
    }

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
    const msg = err?.message || String(err);
    const isConnError = msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('unreachable');
    if (isConnError) {
      return NextResponse.json({ error: 'Authentication service is temporarily unavailable. Please try again later.' }, { status: 503 });
    }
    const message = err?.status === 400 ? "Invalid credentials" : msg || "Login failed";
    return NextResponse.json({ error: message }, { status: err?.status || 500 });
  }
}
