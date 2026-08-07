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

    // 1. Strict Duplicate Checks in PocketBase
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
        where: { name: cleanName }
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

    // 3. Find the free AI Cap plan
    const freePlan = await prisma.aiCapPlan.findFirst({ where: { name: 'free' } }).catch(() => null);

    // 4. Create User in PocketBase (using pbAdmin for guaranteed creation)
    const { pbAdmin } = await import("@/lib/pb");
    const { ensurePbUserCollectionFields } = await import("@/lib/pb-sync");
    await ensurePbUserCollectionFields().catch(() => {});

    const admPb = await pbAdmin().catch(() => pb);
    let record: any = null;
    try {
      const userPayload: Record<string, any> = {
        email: cleanEmail,
        password,
        passwordConfirm: password,
        verified: true,
        emailVisibility: true,
        name: cleanName || cleanEmail.split("@")[0],
        points: 50,
        theme: "dark",
        membership: "free",
        role: "user",
        status: "active",
      };
      if (freePlan?.id) {
        userPayload.aiCapPlanId = freePlan.id;
      }

      record = await admPb.collection("users").create(userPayload).catch(async () => {
        // Fallback: create with core auth fields if custom schema fields are missing or restricted
        return await admPb.collection("users").create({
          email: cleanEmail,
          password,
          passwordConfirm: password,
          verified: true,
          emailVisibility: true,
          name: cleanName || cleanEmail.split("@")[0],
        });
      });

      try {
        await admPb.collection("users").update(record.id, { verified: true });
      } catch {}
    } catch (pbErr: any) {
      console.warn("[Register API] PocketBase user creation failed, falling back to Prisma DB:", pbErr?.message || pbErr);
      try {
        const generateId = () => Array.from({ length: 15 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
        const fallbackUserId = generateId();
        const prismaUser = await prisma.user.upsert({
          where: { email: cleanEmail },
          update: {
            name: cleanName || cleanEmail.split("@")[0],
          },
          create: {
            id: fallbackUserId,
            email: cleanEmail,
            name: cleanName || cleanEmail.split("@")[0],
            membership: "free",
            role: "user",
            points: 50,
          }
        });
        record = {
          id: prismaUser.id,
          email: prismaUser.email,
          name: prismaUser.name,
        };
      } catch (prismaFallbackErr: any) {
        const details = pbErr?.data?.data || pbErr?.response?.data || {};
        const firstError = Object.values(details)[0] as any;
        const raw = firstError?.message || pbErr?.message || prismaFallbackErr?.message || "Registration failed in authentication database.";
        const message = typeof raw === 'string' ? raw : JSON.stringify(raw);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    // 4b. Sync user record into Prisma DB so sessions and relational queries resolve
    try {
      await prisma.user.upsert({
        where: { id: record.id },
        update: {
          email: cleanEmail,
          name: cleanName || cleanEmail.split("@")[0],
        },
        create: {
          id: record.id,
          email: cleanEmail,
          name: cleanName || cleanEmail.split("@")[0],
          membership: "free",
          role: "user",
          points: 50,
        }
      });
    } catch (prismaErr: any) {
      console.warn("[Register API] Failed to upsert user in Prisma (non-fatal):", prismaErr?.message);
    }

    // 5. Log Initial Session Activity with Geo Location
    try {
      const { getClientGeoInfo } = await import("@/lib/clientGeo");
      const geo = await getClientGeoInfo(req as any);
      let ipAddress = geo.ipAddress;
      if (!ipAddress || ipAddress === "127.0.0.1" || ipAddress === "::1" || ipAddress === "localhost") {
        const forwarded = req.headers.get("x-forwarded-for");
        ipAddress = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
      }
      let location = geo.location;
      if (!location || location === "Unknown Location") {
        location = "Localhost";
      }
      const userAgent = req.headers.get("user-agent") || "Unknown";

      const { logUserActivity } = await import("@/lib/security");
      await logUserActivity(record.id, ipAddress, location, userAgent);
      console.log(`[Register API] Logged initial session activity: IP=${ipAddress}, Location=${location}`);
    } catch (actErr: any) {
      console.warn("[Register API] Failed to log initial session activity:", actErr.message);
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

