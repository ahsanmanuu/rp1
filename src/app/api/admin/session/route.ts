import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminSessionFromCookies } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminSessionFromCookies();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value || null;
  return NextResponse.json({ success: true, admin, token });
}
