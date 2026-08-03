import { NextRequest, NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb";

const PB_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";

let otpEnabledCache = false;
let otpCacheLastCheck = 0;
const OTP_CACHE_TTL = 5 * 60 * 1000;

async function ensureOtpEnabled(): Promise<void> {
  const now = Date.now();
  if (otpEnabledCache && now - otpCacheLastCheck < OTP_CACHE_TTL) return;
  const admPb = await pbAdmin();
  const col = await admPb.collections.getOne("users");
  if (col.type === "auth" && !(col.otp?.enabled || false)) {
    await admPb.collections.update("users", {
      otp: {
        enabled: true,
        duration: col.otp?.duration ?? 180,
        length: col.otp?.length ?? 8,
        emailTemplate: col.otp?.emailTemplate,
      },
    });
    console.log("[OTP] Enabled OTP on users collection.");
  }
  otpEnabledCache = true;
  otpCacheLastCheck = now;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const cleanEmail = email.trim().toLowerCase();

    await ensureOtpEnabled();

    const res = await fetch(`${PB_URL}/api/collections/users/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.message || "Failed to send OTP" }, { status: 400 });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ success: true, otpId: data.otpId, message: "Verification code sent to your email." });
  } catch (e: any) {
    console.error("[OTP-REQUEST] Error:", e?.message || e);
    return NextResponse.json({ error: "Unable to send verification code" }, { status: 500 });
  }
}