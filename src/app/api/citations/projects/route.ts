import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { getServerSession } from "@/lib/auth-pb";
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const projects = await prisma.citationProject.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { citations: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to fetch citation projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const { name, style } = await req.json();

    const project = await prisma.citationProject.create({
      data: {
        userId: user.id,
        name: name || "My Bibliography",
        style: style || "apa-7"
      }
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Failed to create citation project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
