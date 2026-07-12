import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

async function ensureDocsSeeded() {
  const count = await prisma.adminDocumentation.count();
  if (count === 0) {
    const seeds = [
      { title: "API Integration Guide", category: "Integration", content: `### API Integration & Authentication Guide

Latexify API provides programmatic access to compile LaTeX documents, convert Docx files to clean LaTeX source, and call the AI Peer Reviewer.

#### 1. Obtaining API Tokens
Each user can create an API Token from their Settings dashboard. Admins can view/rotate user keys in the User Detail panel.

#### 2. Endpoint Authorization
All requests must pass the API key in the authorization header:
\`\`\`bash
Authorization: Bearer <your_api_key>
\`\`\`

#### 3. Common Endpoints
* **POST /api/latex/compile**: Compile raw LaTeX into a PDF bundle.
* **POST /api/latex/convert**: Convert file uploads (.docx) to LaTeX code.
* **POST /api/latex/review**: Submit a PDF paper to the AI Peer Reviewer for scoring.

For full API schema definitions and rate limits, view the swagger page or query the system ops team.` },
      { title: "Server Cluster Config", category: "Operations", content: `### Server Cluster Configurations

The Latexify LaTeX compilation cluster runs TeX Live 2024 nodes across two major regions (US-East and AP-Southeast) for redundancy and global performance.

#### 1. Worker Configuration
* **Total Nodes**: 20 virtual nodes (18 active / 2 idle standby).
* **Compiler**: Tectonic engine and pdflatex binaries configured.
* **Auto-Scale**: Auto-scaling spawns new nodes when average CPU load exceeds 85% for 3 consecutive minutes.

#### 2. Health Monitoring
Ops health parameters are polled every 10 seconds. In case a worker loses response capability, it is automatically terminated and replaced by a fresh container instance.` },
      { title: "Security Compliance Docs", category: "Compliance", content: `### Security & Regulatory Compliance policy

Latexify maintains rigorous data safety policies to guarantee manuscript integrity and client confidentiality.

#### 1. Data Encryption
* All connection points use SSL/TLS encryption.
* Stored document source and compiled PDFs are encrypted at rest using AES-256 standard keys.

#### 2. User Isolation & Access Control
Workspace projects are sandboxed in unique directory contexts. No user can view, fetch, or inspect directory segments belonging to other accounts.

#### 3. Data Retention
LaTeX document source is kept as long as the user retains the project. Temporary compile builds and log buffers are purged automatically after 48 hours of inactivity.` },
      { title: "Cashfree Integration & Billing Details", category: "Billing", content: `### Cashfree Payment Gateway Integration

Latexify uses Cashfree for processing all subscription and one-time payments.

#### 1. Supported Payment Methods
* UPI (Google Pay, PhonePe, Paytm)
* Net Banking (all major Indian banks)
* Credit/Debit Cards (Visa, Mastercard, RuPay)
* Wallets (Paytm, Amazon Pay)

#### 2. Refund Policy
Refunds are processed within 5-7 business days to the original payment method. Contact support with your transaction ID to initiate a refund.` },
      { title: "Managing Collaborators", category: "User Guide", content: `### Adding & Managing Collaborators

Collaborators can be added to any project with view or edit permissions.

#### 1. Inviting Collaborators
Open your project → Share → Enter email address → Select permission level → Send invite.

#### 2. Permission Levels
* **Viewer**: Can see the document but not make changes.
* **Editor** (default): Can make changes to the document.
* **Admin**: Can manage collaborators and project settings.` },
      { title: "Getting Started with Latexify", category: "User Guide", content: `### Welcome to Latexify!

Latexify is a collaborative LaTeX editor designed for researchers, students, and professionals.

#### 1. Creating Your First Project
Click "New Project" from the dashboard → Choose a template or start blank → Start writing LaTeX.

#### 2. Key Features
* Real-time collaboration with co-authors
* AI-powered peer review
* Doc2LaTeX conversion from Word documents
* Diagram generation from natural language prompts
* Citation management and bibliography tools` },
    ];
    for (const s of seeds) {
      try { await prisma.adminDocumentation.create({ data: s }); } catch {}
    }
  }
}

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    try { await ensureDocsSeeded(); } catch { /* seed non-fatal */ }
    const docs = await prisma.adminDocumentation.findMany({
      orderBy: [
        { category: "asc" },
        { title: "asc" }
      ]
    });
    return NextResponse.json({ success: true, docs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, content, category } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "Missing required fields: title, content" }, { status: 400 });
    }

    const newDoc = await prisma.adminDocumentation.create({
      data: {
        title,
        content,
        category: category || "General"
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "CREATE_DOCUMENTATION",
        targetTable: "admin_documentations",
        targetId: newDoc.id,
        newValue: JSON.stringify(newDoc),
      }
    });

    return NextResponse.json({ success: true, doc: newDoc }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, title, content, category } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing document id" }, { status: 400 });
    }

    const updatedDoc = await prisma.adminDocumentation.update({
      where: { id },
      data: {
        title,
        content,
        category
      }
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "UPDATE_DOCUMENTATION",
        targetTable: "admin_documentations",
        targetId: updatedDoc.id,
        newValue: JSON.stringify(updatedDoc),
      }
    });

    return NextResponse.json({ success: true, doc: updatedDoc });
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
      return NextResponse.json({ error: "Missing document id query parameter" }, { status: 400 });
    }

    const existing = await prisma.adminDocumentation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Documentation not found" }, { status: 404 });
    }

    await prisma.adminDocumentation.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "DELETE_DOCUMENTATION",
        targetTable: "admin_documentations",
        targetId: id,
        previousValue: JSON.stringify(existing),
      }
    });

    return NextResponse.json({ success: true, message: "Documentation deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
