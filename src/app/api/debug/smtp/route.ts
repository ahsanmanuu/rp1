import { NextRequest, NextResponse } from "next/server";
import { sendRecoveryEmail } from "@/lib/emailService";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.SMTP_PORT || "587";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS ? "****" + process.env.SMTP_PASS.slice(-4) : "NOT SET";
  const admin = process.env.ADMIN_EMAIL || "";

  return NextResponse.json({
    smtp: { host, port, user, pass, admin },
    envSource: {
      SMTP_HOST: process.env.SMTP_HOST ? "env" : "hardcoded fallback",
      SMTP_USER: process.env.SMTP_USER ? "env" : "hardcoded fallback",
      SMTP_PASS: process.env.SMTP_PASS ? "env" : "hardcoded fallback",
      ADMIN_EMAIL: process.env.ADMIN_EMAIL ? "env" : "hardcoded fallback",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { to } = await req.json();
    const recipient = to || process.env.ADMIN_EMAIL || "";

    await sendRecoveryEmail(recipient, "https://latexify.io/auth/recovery?token=test", "Test User");

    const lastLog = await prisma.emailLog.findFirst({
      where: { to: recipient },
      orderBy: { sentAt: "desc" },
      select: { status: true, errorMsg: true, sentAt: true, id: true },
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${recipient}`,
      logEntry: lastLog,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
