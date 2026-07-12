import { NextResponse } from "next/server";
import { createPb } from "@/lib/pb";
import { sendRecoveryEmail } from "@/lib/mailer";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const pb = createPb();

    // Check if admin exists in _superusers collection
    let adminExists = false;
    try {
      const records = await pb.collection("_superusers").getFullList({
        filter: `email = "${email}"`,
      });
      adminExists = records.length > 0;
    } catch {
      // If we can't check, still return success to prevent enumeration
    }

    if (!adminExists) {
      // Return success even if admin not found (prevent enumeration)
      return NextResponse.json({ message: "Recovery link sent if account exists" });
    }

    // Use PB's built-in admin password reset
    try {
      await pb.collection("_superusers").requestPasswordReset(email);
    } catch (pbErr: any) {
      console.warn("[Admin Recovery] PB requestPasswordReset failed, using custom flow:", pbErr?.message);

      // Fallback: generate custom token and send via our email service
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 3600000); // 1 hour

      const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL || "https://latexify.io";
      const resetLink = `${origin}/admin/recovery/reset?token=${token}&email=${encodeURIComponent(email)}`;

      await sendRecoveryEmail(email, resetLink, "Admin", undefined);
    }

    return NextResponse.json({ message: "Recovery link sent if account exists" });
  } catch (error: any) {
    console.error("[Admin Recovery] Error:", error);
    // Always return success to prevent email enumeration
    return NextResponse.json({ message: "Recovery link sent if account exists" });
  }
}
