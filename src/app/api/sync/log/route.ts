import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { getServerSession } from "@/lib/auth-pb";
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, status, details } = body;

    if (!action || !status) {
      return NextResponse.json({ error: "Missing required fields: action, status" }, { status: 400 });
    }

    // Find the user by email from session
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create a new SyncLog entry
    const log = await prisma.syncLog.create({
      data: {
        userId: user.id,
        action,
        status,
        details,
      },
    });

    return NextResponse.json({ success: true, log });
  } catch (error: any) {
    console.error("[SyncLog API] Error creating sync log:", error);
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
