import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const count = await prisma.adminDocumentation.count();
    if (count === 0) {
      await prisma.adminDocumentation.createMany({
        data: [
          {
            title: "Getting Started with Latexify",
            content: "Welcome to Latexify! To begin editing documents, navigate to the Dashboard and click 'New Project'. You can select from various predefined academic, resume, or report templates. All edits are saved automatically in real-time, and you can compile to PDF at any time by pressing 'Ctrl + Enter' or clicking the 'Compile' button in the toolbar.",
            category: "General"
          },
          {
            title: "Real-time AI Peer Review Guide",
            content: "Our AI Peer Reviewer checks your LaTeX papers for flow, tone, reference consistency, and grammar correctness. Open your project, click the 'AI Review' icon on the right sidebar, and choose to analyze either the whole document or the active section. The suggestions will be displayed inline with detailed explanations.",
            category: "AI Tools"
          },
          {
            title: "Managing Collaborators",
            content: "Collaborate with your co-authors in real-time by clicking the 'Share' icon in the upper right corner of the document editor. Enter the email address of your collaborator and choose their role ('viewer' or 'editor'). They will receive an email invitation and see the project appear on their dashboard.",
            category: "Collaboration"
          },
          {
            title: "Cashfree Integration & Billing Details",
            content: "Latexify supports Indian Rupee (INR) transactions via Cashfree. You can purchase points or upgrade your subscription. Once payment is authorized, your premium membership status and token allotments are instantly activated in real-time. If you experience billing discrepancies, open a support ticket under priority P1/Urgent.",
            category: "Billing"
          }
        ]
      });
    }

    const docs = await prisma.adminDocumentation.findMany({
      orderBy: [{ category: "asc" }, { title: "asc" }]
    });

    return NextResponse.json({ success: true, docs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
