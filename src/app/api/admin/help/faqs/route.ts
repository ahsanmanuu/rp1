import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

async function ensureFaqsSeeded() {
  const count = await prisma.userFAQ.count();
  if (count === 0) {
    const seeds = [
      { question: "How to migrate Overleaf projects to Latexify?", answer: "You can download your Overleaf project as a ZIP archive, then navigate to Latexify upload studio and upload the ZIP. All file hierarchies, graphics, and CLS styles are parsed and translated automatically.", views: 842 },
      { question: "What compilation engines are supported?", answer: "We support pdfLaTeX, XeLaTeX, LuaLaTeX, and BibTeX. You can select your preferred engine in the editor settings panel.", views: 521 },
      { question: "Is there a limit on Word-to-LaTeX document conversion size?", answer: "Free tier accounts support up to 5MB files. Premium accounts can convert documents up to 50MB in size with full table and math formatting preserve.", views: 312 },
      { question: "How do I reset my API key?", answer: "Navigate to Profile Settings → API Tokens and click Regenerate. Your old key will be invalidated immediately.", views: 245 },
      { question: "Can I collaborate with co-authors in real-time?", answer: "Yes! Latexify supports real-time collaborative editing. Share your project link with co-authors; they can edit simultaneously with changes syncing instantly.", views: 198 },
    ];
    for (const s of seeds) {
      try { await prisma.userFAQ.create({ data: s }); } catch {}
    }
  }
}

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    try { await ensureFaqsSeeded(); } catch { /* seed non-fatal */ }
    const faqs = await prisma.userFAQ.findMany({
      orderBy: { views: "desc" }
    });
    return NextResponse.json({ success: true, faqs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { question, answer, views } = body;

    if (!question || !answer) {
      return NextResponse.json({ error: "Missing required fields: question, answer" }, { status: 400 });
    }

    const newFaq = await prisma.userFAQ.create({
      data: {
        question,
        answer,
        views: views !== undefined ? parseInt(views, 10) : 0
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "CREATE_FAQ",
        targetTable: "user_faqs",
        targetId: newFaq.id,
        newValue: JSON.stringify(newFaq),
      }
    });

    return NextResponse.json({ success: true, faq: newFaq }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, question, answer, views } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing FAQ id" }, { status: 400 });
    }

    const updatedFaq = await prisma.userFAQ.update({
      where: { id },
      data: {
        question,
        answer,
        views: views !== undefined ? parseInt(views, 10) : undefined
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "UPDATE_FAQ",
        targetTable: "user_faqs",
        targetId: updatedFaq.id,
        newValue: JSON.stringify(updatedFaq),
      }
    });

    return NextResponse.json({ success: true, faq: updatedFaq });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing FAQ id query parameter" }, { status: 400 });
    }

    const existing = await prisma.userFAQ.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    await prisma.userFAQ.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "DELETE_FAQ",
        targetTable: "user_faqs",
        targetId: id,
        previousValue: JSON.stringify(existing),
      }
    });

    return NextResponse.json({ success: true, message: "FAQ deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
