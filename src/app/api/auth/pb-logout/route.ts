import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth-pb";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.headers.append("Set-Cookie", clearAuthCookie());
  return response;
}
