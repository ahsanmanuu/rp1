import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-pb";
import { prisma } from "@/lib/prisma";
import { pbAdmin } from "@/lib/pb";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession();

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, theme, password } = await req.json();

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (theme !== undefined) updateData.theme = theme;

    if (password !== undefined) {
      const pwdStr = String(password).trim();
      if (!pwdStr) {
        return NextResponse.json({ error: "Password cannot be empty" }, { status: 400 });
      }
      if (pwdStr.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
      }
    }

    // Update profile fields (name/theme) via Prisma → PB adapter
    let updatedUser: any = null;
    if (Object.keys(updateData).length > 0) {
      try {
        updatedUser = await prisma.user.update({
          where: { id: session.user.id },
          data: updateData,
        });
      } catch (profileErr) {
        console.error("Failed to update profile fields:", profileErr);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
      }
    }

    // Update password directly in PocketBase (requires password + passwordConfirm)
    if (password !== undefined) {
      try {
        const adminPb = await pbAdmin();
        const pbUser = await adminPb.collection("users").getFirstListItem(`email = "${session.user.email}"`);
        await adminPb.collection("users").update(pbUser.id, {
          password: password,
          passwordConfirm: password,
        });
      } catch (pbErr) {
        console.error("Failed to update password in PocketBase:", pbErr);
        return NextResponse.json({ error: "Failed to update password in auth system" }, { status: 500 });
      }
    }

    if (password !== undefined) {
      try {
        await prisma.notification.create({
          data: {
            userId: session.user.id,
            type: "security",
            title: "Password Updated",
            body: "Your profile password has been changed successfully.",
          }
        });
      } catch {}
    }

    return NextResponse.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
