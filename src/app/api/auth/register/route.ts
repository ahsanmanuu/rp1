import { NextResponse } from "next/server";
import { createPb } from "@/lib/pb";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    const { isDisposableEmail } = await import("@/lib/security");
    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: "Registration with temporary or disposable email addresses is not permitted." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name ? name.trim() : null;

    // 1. Strict Duplicate Checks in PostgreSQL
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });
    if (existingUserByEmail) {
      return NextResponse.json(
        { error: "A user with this email address is already registered." },
        { status: 400 }
      );
    }

    if (cleanName) {
      const existingUserByName = await prisma.user.findFirst({
        where: { name: { equals: cleanName, mode: 'insensitive' } }
      });
      if (existingUserByName) {
        return NextResponse.json(
          { error: "A user with this scholar name is already registered." },
          { status: 400 }
        );
      }
    }

    const pb = createPb();

    // 2. Strict Duplicate Checks in PocketBase
    try {
      const existingPbUser = await pb.collection("users").getFirstListItem(`email = "${cleanEmail}"`);
      if (existingPbUser) {
        return NextResponse.json(
          { error: "A user with this email address is already registered." },
          { status: 400 }
        );
      }
    } catch {
      // Not found is expected behavior
    }

    if (cleanName) {
      try {
        const existingPbUserByName = await pb.collection("users").getFirstListItem(`name = "${cleanName}"`);
        if (existingPbUserByName) {
          return NextResponse.json(
            { error: "A user with this scholar name is already registered." },
            { status: 400 }
          );
        }
      } catch {
        // Not found is expected behavior
      }
    }

    // 3. Create User in PocketBase
    let record;
    try {
      record = await pb.collection("users").create({
        email: cleanEmail,
        password,
        passwordConfirm: password,
        name: cleanName || cleanEmail.split("@")[0],
        points: 50,
        theme: "dark",
        membership: "free",
        role: "user",
        status: "active",
      });
    } catch (pbErr: any) {
      const details = pbErr?.data?.data || {};
      const firstError = Object.values(details)[0] as any;
      const message = firstError?.message || pbErr?.message || "Registration failed in authentication database.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // 4. Create User in PostgreSQL (with Rollback on failure)
    try {
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(password, 10);
      const freePlan = await prisma.aiCapPlan.findFirst({ where: { name: 'free' } });

      await prisma.user.create({
        data: {
          id: record.id, // Keep IDs identical
          email: cleanEmail,
          name: cleanName || cleanEmail.split("@")[0],
          password: passwordHash,
          points: 50,
          theme: "dark",
          membership: "free",
          role: "user",
          status: "active",
          aiCapPlanId: freePlan?.id || null,
        }
      });
    } catch (dbErr: any) {
      console.error("[REGISTER] Failed to create user in PostgreSQL. Rolling back PocketBase user...", dbErr);
      
      // Rollback: Delete the PocketBase user record
      try {
        const { pbAdmin } = await import("@/lib/pb");
        const admPb = await pbAdmin();
        await admPb.collection("users").delete(record.id);
      } catch (rollbackErr: any) {
        console.error("[REGISTER] Rollback of PocketBase user failed:", rollbackErr.message);
      }

      return NextResponse.json(
        { error: "Registration failed due to a database synchronization error. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        message: "User registered successfully", 
        userId: record.id,
        user: {
          id: record.id,
          email: record.email,
          name: record.name,
        }
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred during registration." },
      { status: 500 }
    );
  }
}

