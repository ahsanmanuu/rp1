import { NextResponse } from "next/server";
import crypto from "crypto";
import { pbAdmin } from "@/lib/pb";
import { sendRecoveryEmail } from "@/lib/mailer";

function getOrigin(req: Request): string {
  const host = req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const proto = forwardedProto ? forwardedProto.split(",")[0].trim() : "http";
  let origin = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  if (!origin || !origin.startsWith("http")) {
    origin = host ? `${proto}://${host}` : "http://localhost:3000";
  }
  if (origin.endsWith("/")) origin = origin.slice(0, -1);
  return origin;
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const cleanEmail = String(email).trim().toLowerCase();

    // Check if admin exists in _superusers — must use pbAdmin() because
    // _superusers listRule is null (superuser-only access).
    const adminPb = await pbAdmin();
    let adminRecord: any = null;
    try {
      const records = await adminPb.collection("_superusers").getFullList({
        filter: `email = "${cleanEmail}"`,
      });
      adminRecord = records[0] || null;
    } catch (lookupErr: any) {
      console.warn("[Admin Recovery] Superuser lookup failed:", lookupErr?.message || lookupErr);
    }

    if (!adminRecord) {
      // Return success even if admin not found (prevent enumeration)
      return NextResponse.json({ message: "Recovery link sent if account exists" });
    }

    // App-managed token flow (never use PB's built-in requestPasswordReset:
    // its emails link to settings meta.appURL, which is localhost in production).
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hour

    const { prisma } = await import("@/lib/prisma");
    await prisma.verificationToken.create({
      data: { identifier: cleanEmail, token, expires },
    });

    const origin = getOrigin(req);
    const resetLink = `${origin}/admin/recovery/reset?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    await sendRecoveryEmail(cleanEmail, resetLink, "Admin", adminRecord.id);

    return NextResponse.json({ message: "Recovery link sent if account exists" });
  } catch (error: any) {
    console.error("[Admin Recovery] Error:", error);
    // Always return success to prevent email enumeration
    return NextResponse.json({ message: "Recovery link sent if account exists" });
  }
}
