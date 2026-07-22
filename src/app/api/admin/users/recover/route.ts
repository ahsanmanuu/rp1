import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";
import { pbAdmin } from "@/lib/pb";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { email, password, name, force } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    const cleanEmail = String(email).trim().toLowerCase();

    const admPb = await pbAdmin();
    // Ensure PB users collection has all required fields before creating
    try {
      const { ensurePbUserCollectionFields } = await import('@/lib/pb-sync');
      await ensurePbUserCollectionFields();
    } catch {}
    const existing = await admPb.collection("users").getFullList({
      filter: `email = "${cleanEmail}"`,
      requestKey: `recover_check_${cleanEmail}`,
    });

    if (existing.length > 0) {
      if (!force) {
        return NextResponse.json({
          success: true,
          message: "User already exists in PocketBase",
          userId: existing[0].id,
        });
      }
      await admPb.collection("users").update(existing[0].id, {
        password,
        passwordConfirm: password,
        name: name || existing[0].name,
      });
      return NextResponse.json({
        success: true,
        message: "User password reset in PocketBase",
        userId: existing[0].id,
        action: "updated",
      });
    }

    const created = await admPb.collection("users").create({
      email: cleanEmail,
      password,
      passwordConfirm: password,
      name: name || cleanEmail.split("@")[0],
      emailVisibility: true,
      verified: true,
      points: 50,
      theme: "dark",
      role: "user",
      membership: "free",
      status: "active",
    });

    return NextResponse.json({
      success: true,
      message: "User created in PocketBase",
      userId: created.id,
      action: "created",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
