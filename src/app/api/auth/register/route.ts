import { NextResponse } from "next/server";
import { createPb } from "@/lib/pb";

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

    const pb = createPb();
    const record = await pb.collection("users").create({
      email,
      password,
      passwordConfirm: password,
      name: name || email.split("@")[0],
      points: 50,
      theme: "dark",
      membership: "free",
      role: "user",
      status: "active",
    });

    return NextResponse.json(
      { message: "User registered successfully", userId: record.id },
      { status: 201 }
    );
  } catch (error: any) {
    const details = error?.data?.data || {};
    const firstError = Object.values(details)[0] as any;
    const message = firstError?.message || error?.message || "Registration failed";

    if (message.includes("duplicate") || message.includes("already exists")) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
