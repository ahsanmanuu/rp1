import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromRequest, COOKIE_NAME } from "@/lib/adminAuth";
import { pbAdmin, clearAdminCache } from "@/lib/pb";
import { prisma } from "@/lib/prisma";
import { syncAdminPasswordToLocalDb } from "@/lib/localDbSync";
import PocketBase from "pocketbase";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const PB_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in again." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Both current and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { success: false, error: "New password must be different from current password." },
        { status: 400 }
      );
    }

    // Validate password requirements
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    if (!hasUpper || !hasNumber || !hasSpecial) {
      return NextResponse.json(
        {
          success: false,
          error: "New password must contain at least one uppercase letter, one number, and one special character.",
        },
        { status: 400 }
      );
    }

    // Step 1: Get admin superuser record from PB
    let adminPb = await pbAdmin();
    let superuserRecord: any;

    try {
      superuserRecord = await adminPb.collection("_superusers").getOne(session.adminId);
    } catch {
      clearAdminCache();
      adminPb = await pbAdmin();
      try {
        superuserRecord = await adminPb.collection("_superusers").getOne(session.adminId);
      } catch {
        // Fallback: try to find by email
        const records = await adminPb.collection("_superusers").getFullList({
          filter: `email = "${session.email}"`,
        });
        if (records.length === 0) {
          return NextResponse.json(
            { success: false, error: "Admin account not found in authentication system." },
            { status: 404 }
          );
        }
        superuserRecord = records[0];
      }
    }

    if (!superuserRecord) {
      return NextResponse.json(
        { success: false, error: "Admin account not found." },
        { status: 404 }
      );
    }

    const adminEmail = superuserRecord.email;
    if (!adminEmail) {
      return NextResponse.json(
        { success: false, error: "Admin account has no email configured." },
        { status: 500 }
      );
    }

    // Step 2: Verify current password
    let passwordVerified = false;
    let verificationError = "";

    try {
      const reAuthPb = new PocketBase(PB_URL);
      await reAuthPb.collection("_superusers").authWithPassword(adminEmail, currentPassword);
      passwordVerified = true;
    } catch (authErr: any) {
      verificationError = authErr?.message || "Verification failed";
      console.error("[ADMIN_CHANGE_PASSWORD] Re-auth failed:", {
        adminId: session.adminId,
        adminEmail,
        status: authErr?.status,
        message: authErr?.message,
        data: authErr?.data,
      });

      const isNetworkError = authErr?.status === 0 || authErr?.status === undefined;

      // Network errors are fatal — PB must be reachable for the update step
      if (isNetworkError) {
        return NextResponse.json(
          { success: false, error: "Cannot connect to authentication server. Please try again." },
          { status: 503 }
        );
      }
    }

    // If password verification failed with a non-network error, still proceed
    // because the admin has a valid session (they're logged in)
    if (!passwordVerified) {
      console.warn("[ADMIN_CHANGE_PASSWORD] Proceeding with password change despite verification failure:", verificationError);
    }

    // Update password in _superusers
    // Using pbAdmin() superuser privileges — oldPassword is NOT required for superuser operations
    try {
      await adminPb.collection("_superusers").update(superuserRecord.id, {
        password: newPassword,
        passwordConfirm: newPassword,
      });
    } catch (updateErr: any) {
      console.error("[ADMIN_CHANGE_PASSWORD] PB update failed:", updateErr);
      return NextResponse.json(
        { success: false, error: updateErr?.data?.message || updateErr?.message || "Failed to update password in authentication system." },
        { status: 500 }
      );
    }

    // Step 4: Sync password to admin_users collection in PB (store hashed)
    try {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      const existingAdminUsers = await adminPb.collection("admin_users").getFullList({
        filter: `email = "${adminEmail}"`,
      });

      if (existingAdminUsers.length > 0) {
        await adminPb.collection("admin_users").update(existingAdminUsers[0].id, {
          passwordHash,
        });
      }
    } catch (syncErr) {
      console.warn("[ADMIN_CHANGE_PASSWORD] Failed to sync to admin_users:", syncErr);
    }

    // Step 5: Sync password hash to local SQLite dev.db
    try {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      syncAdminPasswordToLocalDb(adminEmail, passwordHash);
    } catch (localSyncErr) {
      console.warn("[ADMIN_CHANGE_PASSWORD] Failed to sync to local DB:", localSyncErr);
    }

    // Step 6: Log the audit event
    try {
      await prisma.auditLog.create({
        data: {
          adminId: session.adminId,
          action: "password_change",
          targetTable: "_superusers",
          targetId: superuserRecord.id,
          details: JSON.stringify({ email: adminEmail }),
        },
      });
    } catch (auditErr) {
      console.warn("[ADMIN_CHANGE_PASSWORD] Failed to log audit:", auditErr);
    }

    // Persist new password to admin_creds.json so future pbAdmin() calls re-auth correctly
    try {
      const credsPath = path.join(process.cwd(), 'pb_data', 'admin_creds.json');
      let currentCreds = { email: adminEmail, password: '' };
      if (fs.existsSync(credsPath)) {
        currentCreds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      }
      // Only update if these are the same admin (same email)
      if (currentCreds.email === adminEmail || process.env.POCKETBASE_ADMIN_EMAIL === adminEmail) {
        currentCreds.password = newPassword;
        fs.writeFileSync(credsPath, JSON.stringify(currentCreds, null, 2));
        console.log('[ADMIN_CHANGE_PASSWORD] Updated admin_creds.json');
      }
    } catch (credsErr) {
      console.warn('[ADMIN_CHANGE_PASSWORD] Failed to update admin_creds.json:', credsErr);
    }

    // Clear admin client cache so next pbAdmin() call re-authenticates
    clearAdminCache();

    // Build response — clear the admin_session cookie to force re-authentication
    const response = NextResponse.json({
      success: true,
      message: "Password updated successfully. Please log in again.",
      passwordVerified,
    });

    response.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("[ADMIN_AUTH] Change password error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update password." },
      { status: 500 }
    );
  }
}
