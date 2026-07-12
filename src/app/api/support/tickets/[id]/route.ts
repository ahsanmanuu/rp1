import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-pb";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, customerId: session.user.id, archivedAt: null },
      include: {
        messages: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ticket });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

