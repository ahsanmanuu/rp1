import { NextResponse } from "next/server";
import crypto from "crypto";
import { pbAdmin } from "@/lib/pb";

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

    // Check if user exists in PocketBase — use pbAdmin() because the users
    // collection listRule is "id = @request.auth.id" (unauthenticated lookups 403).
    const adminPb = await pbAdmin();
    let user: any = null;
    try {
      user = await adminPb.collection("users").getFirstListItem(`email = "${cleanEmail}"`, { requestKey: `recovery_check_${cleanEmail}` });
    } catch {}

    if (!user) {
      return NextResponse.json({ message: "Recovery link sent if account exists" });
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000);

    // Store in verification_tokens collection via adapter (identifier must match
    // the lowercased email used at lookup time in PUT)
    const { prisma } = await import("@/lib/prisma");
    await prisma.verificationToken.create({
      data: { identifier: cleanEmail, token, expires },
    });

    const origin = getOrigin(req);
    const recoveryLink = `${origin}/recovery/reset?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

    // Send email
    try {
      const { sendRecoveryEmail } = await import("@/lib/mailer");
      await sendRecoveryEmail(cleanEmail, recoveryLink, user?.name, user?.id);
    } catch (emailErr: any) {
      console.error("Recovery email send failed:", emailErr?.message || emailErr);
    }

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
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }
    const cleanEmail = String(email).trim().toLowerCase();

    const { prisma } = await import("@/lib/prisma");
    const verificationToken = await prisma.verificationToken.findFirst({
      where: { identifier: cleanEmail, token },
    });

    if (!verificationToken) {
      return NextResponse.json({ error: "Invalid or expired recovery token" }, { status: 400 });
    }

    if (new Date(verificationToken.expires) < new Date()) {
      await prisma.verificationToken.delete({ where: { id: verificationToken.id } }).catch(() => {});
      return NextResponse.json({ error: "Recovery token has expired" }, { status: 400 });
    }

    // Update user password via PocketBase admin (auth collections require admin
    // rights to change passwords without the old password)
    const adminPb = await pbAdmin();
    let user: any = null;
    try {
      user = await adminPb.collection("users").getFirstListItem(`email = "${cleanEmail}"`, { requestKey: `recovery_update_${cleanEmail}` });
    } catch {}

    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    await adminPb.collection("users").update(user.id, {
      password,
      passwordConfirm: password,
    });

    // Delete verification token (adapter delete requires where.id)
    await prisma.verificationToken.delete({ where: { id: verificationToken.id } });

    // Create security notification
    try {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "security",
          title: "Password Recovered",
          body: "Your password was successfully recovered using a reset link.",
        },
      });
    } catch {}

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
