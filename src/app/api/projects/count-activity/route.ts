import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-pb";
import { countProjectActivity } from "@/lib/projectLimits";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/count-activity
 * Triggered when a user remains > 1 second on any tool,
 * or performs build, compile, draw, search citation.
 * Counts the project towards user limits and silently updates the counter.
 * Critical: Deleted projects are NEVER counted.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { projectId, tool = "general", action = "dwell_1s" } = body;

    const result = await countProjectActivity({
      userId: session.user.id,
      projectId: projectId || null,
      tool,
      action,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[COUNT_ACTIVITY_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to record activity" }, { status: 500 });
  }
}
