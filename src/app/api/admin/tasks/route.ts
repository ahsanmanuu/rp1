import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// GET all persisted admin tasks
export async function GET() {
  try {
    const tasks = await prisma.adminTask.findMany({
      orderBy: { createdAt: "asc" }
    });
    return NextResponse.json({ success: true, tasks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Add a new admin task
export async function POST(req: NextRequest) {
  try {
    const { label } = await req.json();
    if (!label || !label.trim()) {
      return NextResponse.json({ success: false, error: "Task label is required" }, { status: 400 });
    }

    const task = await prisma.adminTask.create({
      data: {
        label: label.trim(),
        completed: false
      }
    });

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: Toggle completion state of a task
export async function PUT(req: NextRequest) {
  try {
    const { id, completed } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "Task ID is required" }, { status: 400 });
    }

    const task = await prisma.adminTask.update({
      where: { id },
      data: { completed: !!completed }
    });

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a task
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Task ID is required" }, { status: 400 });
    }

    await prisma.adminTask.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: "Task deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
