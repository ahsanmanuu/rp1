import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    const data = await req.json();
    const { 
      sourceType, 
      rawData, 
      cslJson, 
      title, 
      authors, 
      year, 
      doi, 
      isbn, 
      url 
    } = data;

    const citation = await prisma.citation.create({
      data: {
        projectId,
        sourceType,
        rawData: JSON.stringify(rawData),
        cslJson: JSON.stringify(cslJson),
        title,
        authors: typeof authors === 'string' ? authors : JSON.stringify(authors),
        year: year?.toString(),
        doi,
        isbn,
        url
      }
    });

    // Update project updatedAt timestamp
    await prisma.citationProject.update({
      where: { id: projectId },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json({ citation });
  } catch (error) {
    console.error("Failed to add citation:", error);
    return NextResponse.json({ error: "Failed to add citation" }, { status: 500 });
  }
}


