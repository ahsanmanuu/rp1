import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createPb } from "@/lib/pb";
import { prisma } from "@/lib/prisma";
import { getClientGeoInfo } from "@/lib/clientGeo";

const PB_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";

export async function POST(req: NextRequest) {
  try {
    const { email, otpId, otp, machineId } = await req.json();
    if (!email || !otpId || !otp) {
      return NextResponse.json({ error: "Email, OTP id and code are required" }, { status: 400 });
    }
    const cleanEmail = email.trim().toLowerCase();

    const pb = createPb();
    const authData = await pb.collection("users").authWithOTP(otpId, otp);

    if (!authData) {
      return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 401 });
    }

    const record = authData.record;
    const userId = record.id;
    const sessionToken = authData.token;

    const geo = await getClientGeoInfo(req);
    const ipAddress = geo.ipAddress || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const location = geo.location || "Unknown Location";
    const userAgent = geo.userAgent || req.headers.get("user-agent") || "unknown";
    const clientMachineId = machineId || "fp_" + crypto.createHash("md5").update(`${ipAddress}-${userAgent}`).digest("hex");

    const existingSessions = await prisma.userSession.findMany({
      where: {
        userId,
        expiresAt: { gte: new Date() },
        machineId: { not: clientMachineId },
      },
    });

    if (existingSessions.length > 0) {
      return NextResponse.json({
        error: "ALREADY_LOGGED_IN",
        message: "Active session detected on another device.",
        existingSessionCount: existingSessions.length,
      }, { status: 409 });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.user.upsert({
      where: { id: userId },
      update: { email: cleanEmail },
      create: { id: userId, email: cleanEmail, name: record.name || cleanEmail.split("@")[0] || "" },
    });

    await prisma.userSession.create({
      data: { userId, sessionToken, machineId: clientMachineId, ipAddress, location, userAgent, lastActiveAt: new Date(), expiresAt },
    });

    const { logUserActivity } = await import("@/lib/security");
    logUserActivity(userId, ipAddress, location, userAgent).catch(() => {});

    const cookies = await (await import("next/headers")).cookies();
    cookies.set("pb_token", authData.token, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 });

    const user = { id: record.id, email: record.email, name: record.name || record.email?.split("@")[0] || "", theme: record.theme || "dark", points: record.points ?? 50, membership: record.membership || "free", role: record.role || "user" };
    return NextResponse.json({ success: true, user, token: authData.token });
  } catch (e: any) {
    console.error("[OTP-LOGIN] Error:", e?.message || e);
    if (e?.status === 401) return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 401 });
    if (String(e?.message || "").includes("Failed to fetch") || String(e?.message || "").includes("ECONNREFUSED")) {
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}