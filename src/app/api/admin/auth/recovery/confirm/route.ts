import { NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  try {
    const { email, token, password } = await req.json();

    if (!email || !token || !password) {
      return NextResponse.json({ error: "Email, token, and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    // Look up the verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier: email, token } },
    });

    if (!verificationToken) {
      return NextResponse.json({ error: "Invalid recovery token" }, { status: 400 });
    }

    // Check expiry
    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: email, token } },
      });
      return NextResponse.json({ error: "Recovery token has expired" }, { status: 400 });
    }

    // Find admin in PocketBase _superusers
    const adminPb = await pbAdmin();
    const records = await adminPb.collection("_superusers").getFullList({
      filter: `email = "${email}"`,
    });

    if (records.length === 0) {
      return NextResponse.json({ error: "Admin account not found" }, { status: 404 });
    }

    // Update password in PocketBase _superusers
    await adminPb.collection("_superusers").update(records[0].id, {
      password: password,
      passwordConfirm: password,
    });

    // Delete the verification token
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    });

    // Log the event
    try {
      await prisma.auditLog.create({
        data: {
          adminId: records[0].id,
          action: "password_reset",
          targetTable: "_superusers",
          targetId: records[0].id,
        },
      });
    } catch {}

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error: any) {
    console.error("[Admin Recovery Confirm] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
