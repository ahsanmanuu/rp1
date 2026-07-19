import { NextResponse } from "next/server";
import crypto from "crypto";
import { createPb, pbAdmin } from "@/lib/pb";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user exists in PocketBase
    const pb = createPb();
    let user: any = null;
    try {
      user = await pb.collection("users").getFirstListItem(`email = "${email}"`, { requestKey: "recovery_check" });
    } catch {}

    if (!user) {
      return NextResponse.json({ message: "Recovery link sent if account exists" });
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000);

    // Store in verification_tokens collection via adapter
    const { prisma } = await import("@/lib/prisma");
    await prisma.verificationToken.upsert({
      where: { identifier_token: { identifier: email, token } },
      update: { token, expires },
      create: { identifier: email, token, expires },
    });

    // Construct recovery link
    const host = req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const proto = forwardedProto ? forwardedProto.split(",")[0].trim() : "http";
    let origin = process.env.NEXTAUTH_URL || process.env.APP_URL || "";
    if (!origin || !origin.startsWith("http")) {
      origin = host ? `${proto}://${host}` : "http://localhost:3000";
    }
    if (origin.endsWith("/")) origin = origin.slice(0, -1);
    const recoveryLink = `${origin}/recovery/reset?token=${token}&email=${encodeURIComponent(email)}`;

    // Send email
    try {
      const { sendRecoveryEmail } = await import("@/lib/mailer");
      sendRecoveryEmail(email, recoveryLink, user?.name, user?.id).catch(() => {});
    } catch {}

    return NextResponse.json({ message: "Recovery link sent" });
  } catch (error: any) {
    console.error("Recovery error:", error);
    return NextResponse.json({ error: "Failed to process recovery" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { email, token, password } = await req.json();
    if (!email || !token || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { prisma } = await import("@/lib/prisma");
    const verificationToken = await prisma.verificationToken.findFirst({
      where: { identifier: email, token },
    });

    if (!verificationToken) {
      return NextResponse.json({ error: "Invalid or expired recovery token" }, { status: 400 });
    }

    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.json({ error: "Recovery token has expired" }, { status: 400 });
    }

    // Update user password via PocketBase
    const pb = createPb();
    let user: any = null;
    try {
      user = await pb.collection("users").getFirstListItem(`email = "${email}"`, { requestKey: "recovery_update" });
    } catch {}

    if (user) {
      // PocketBase auth collections require oldPassword for password update
      // Instead, use the PB admin to update the password
      const adminPb = await pbAdmin();
      await adminPb.collection("users").update(user.id, {
        password,
        passwordConfirm: password,
      });
    }

    // Delete verification token
    await prisma.verificationToken.delete({ where: { token } });

    // Create security notification
    if (user) {
      try {
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: "security",
            title: "Password Recovered",
            body: "Your password was successfully recovered using a reset link.",
          }
        });
      } catch {}
    }

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
