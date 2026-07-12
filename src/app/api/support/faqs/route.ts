import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const count = await prisma.userFAQ.count();
    if (count === 0) {
      await prisma.userFAQ.createMany({
        data: [
          {
            question: "How do I upgrade to Premium?",
            answer: "You can upgrade to Premium by clicking the 'Upgrade' button in the dashboard sidebar, selecting your desired billing frequency (Monthly, 3-Month, 6-Month, or 12-Month), and completing the payment via Cashfree.",
            views: 45
          },
          {
            question: "What is the daily AI token limit?",
            answer: "Free tier users have a daily limit of 10,000 tokens. Premium users on the Pro Plan have 50,000 tokens/day, and Enterprise users have 200,000 tokens/day. You can monitor your remaining tokens in real-time under the AI Usage tab.",
            views: 32
          },
          {
            question: "Can I import documents from Overleaf?",
            answer: "Yes, you can import and sync your Overleaf projects directly into Latexify. Under the projects list, choose 'Import from Overleaf', authenticate your account, and select the project you wish to sync.",
            views: 18
          },
          {
            question: "How does the offline mode work?",
            answer: "Latexify supports full offline document editing! Any changes you make while offline are stored securely in your browser's local storage (StudioFS) and will automatically sync with the server once your connection is restored.",
            views: 12
          }
        ]
      });
    }

    const faqs = await prisma.userFAQ.findMany({
      orderBy: { views: "desc" }
    });

    return NextResponse.json({ success: true, faqs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
