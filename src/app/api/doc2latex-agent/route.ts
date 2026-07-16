import { NextRequest, NextResponse } from "next/server";
import { routeToAgent } from "@/lib/agent-gateway";
import { getServerSession } from "@/lib/auth-pb";
import { getClientGeoInfo } from "@/lib/clientGeo";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      projectId,
      documentTitle,
      templateId,
      documentText,
      latexDraft,
      sectionTitles,
      mathSnippets,
      figureCount,
      tableCount,
      equationCount,
      wordCount,
    } = body;

    if (!projectId || !documentText) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, documentText" },
        { status: 400 }
      );
    }

    const geo = await getClientGeoInfo(req);

    console.log(`[doc2latex-agent] Starting AI enhancement for project ${projectId} by user ${session.user.id}`);

    const result = await routeToAgent({
      agent: "doc2latex",
      messages: [
        {
          role: "user",
          content: "Analyze this DOCX-to-LaTeX conversion and return enhancement suggestions as JSON.",
        },
      ],
      context: {
        userId:        session.user.id,
        userEmail:     session.user.email || undefined,
        ipAddress:     geo.ipAddress      || undefined,
        location:      geo.location       || undefined,
        country:       geo.country        || undefined,
        projectId,
        documentTitle: documentTitle || "Untitled Document",
        templateId:    templateId    || "article_lncs",
        documentText:  documentText  || "",
        latexDraft:    latexDraft    || "",
        sectionTitles: sectionTitles || [],
        mathSnippets:  mathSnippets  || [],
        figureCount:   figureCount   || 0,
        tableCount:    tableCount    || 0,
        equationCount: equationCount || 0,
        wordCount:     wordCount     || 0,
      },
    });

    if (!result.success) {
      console.warn(`[doc2latex-agent] Gateway failed for project ${projectId}:`, result.error);
      if (result.error?.startsWith('AI_CAP_REACHED:') || result.error?.startsWith('AI_CAP_RULE_BLOCKED:')) {
        return NextResponse.json({ error: result.error }, { status: 429 });
      }
      return NextResponse.json(result, { status: 502 });
    }

    console.log(`[doc2latex-agent] AI enhancement complete for project ${projectId}. Model: ${result.model}. Time: ${result.timing.total}ms`);

    return NextResponse.json({
      success: true,
      projectId,
      data: result.data,
      model: result.model,
      timing: result.timing,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[doc2latex-agent] Error:`, msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    success: true,
    agent: "doc2latex",
    name: "Doc2LaTeX AI Converter Agent",
    description: "Enhances DOCX-to-LaTeX conversions with AI structural analysis and suggestions",
    status: "available",
  });
}
