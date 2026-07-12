import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import AdmZip from 'adm-zip';

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session) {
      return NextResponse.json({ templates: [] });
    }

    const templates = await prisma.template.findMany({
      where: {
        isBuiltin: false,
        userId: session.user.id,
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error("GET /api/templates error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;

    if (!file || !name) {
      return NextResponse.json({ error: 'Missing file or name' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let templateContent = "";
    let clsContent = "";
    let bstContent = "";
    const assetsMap: Record<string, string> = {};
    
    if (file.name.toLowerCase().endsWith('.zip')) {
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      
      let mainTexEntry = null;
      
      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;
        const filename = entry.entryName;
        const lowerName = filename.toLowerCase();
        
        // Skip hidden files and macOS junk
        if (lowerName.includes('__macosx') || lowerName.includes('.ds_store')) continue;

        const data = entry.getData();
        const isBinary = /\.(png|jpg|jpeg|gif|pdf|eps|otf|ttf|woff|woff2)$/i.test(filename);
        const content = isBinary ? `data:application/octet-stream;base64,${data.toString('base64')}` : data.toString('utf8');
        
        assetsMap[filename] = content;

        if (lowerName.endsWith('.tex')) {
          if (!mainTexEntry || lowerName.includes('main') || lowerName.includes('template')) {
             mainTexEntry = entry;
          }
        } else if (lowerName.endsWith('.cls') && !clsContent) {
          clsContent = content;
        } else if (lowerName.endsWith('.bst') && !bstContent) {
          bstContent = content;
        }
      }
      
      if (mainTexEntry) templateContent = mainTexEntry.getData().toString('utf8');
      
    } else {
      const text = buffer.toString('utf8');
      if (file.name.toLowerCase().endsWith('.cls')) {
        clsContent = text;
        const extractedName = file.name.replace(/\.cls$/i, '');
        templateContent = `\\documentclass{${extractedName}}\n\\begin{document}\n\n\\section{Introduction}\nStart writing here...\n\n\\end{document}`;
        assetsMap[file.name] = text;
      } else {
        templateContent = text;
        assetsMap[file.name] = text;
      }
    }

    if (!templateContent) {
      return NextResponse.json({ error: 'Could not find a valid .tex file or .cls in the upload.' }, { status: 400 });
    }

    const category = formData.get('category') as string || 'Basic';
    const subCategory = formData.get('subCategory') as string || 'General';

    const template = await prisma.template.create({
      data: {
        name,
        category,
        description: subCategory, // Storing subcategory in description
        userId: session.user.id,
        isBuiltin: false,
        templateContent,
        clsContent,
        bstContent,
        assetsJson: JSON.stringify(assetsMap),
      }
    });

    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    console.error("POST /api/templates error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing template ID' }, { status: 400 });

    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    if (template.userId !== session.user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    await prisma.template.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/templates error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
