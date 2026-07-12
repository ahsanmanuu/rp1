import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, loginAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const result = await loginAdmin(email, password);

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials. Access denied." },
        { status: 401 }
      );
    }

    const { token, admin } = result;

    const response = NextResponse.json({ success: true, admin });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("[ADMIN_AUTH] Login error:", err.message);
    return NextResponse.json(
      { success: false, error: process.env.NODE_ENV === "development" ? err.message : "Internal server error." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
