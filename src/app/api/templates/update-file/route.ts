import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { TEMPLATE_REGISTRY } from '@/lib/templates/registry';

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const templateId = formData.get('templateId') as string;
    const fileType = formData.get('fileType') as string; // .tex, .bib, etc.
    const file = formData.get('file') as File;

    if (!templateId || !fileType || !file) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const content = buffer.toString('utf8');

    // 1. Check if it's a built-in template
    const builtinTemplate = TEMPLATE_REGISTRY.find(t => t.id === templateId);

    if (builtinTemplate && builtinTemplate.assetFolder) {
      const assetDir = path.join(process.cwd(), 'src', 'assets', 'templates', builtinTemplate.assetFolder);
      
      if (!fs.existsSync(assetDir)) {
        return NextResponse.json({ error: 'Template folder not found' }, { status: 404 });
      }

      const files = fs.readdirSync(assetDir);
      let targetFile = '';

      // Find the existing file of that type
      // Priority: 1. Same extension, 2. Matches common names (main.tex, sample.bib)
      const sameExtFiles = files.filter(f => f.toLowerCase().endsWith(fileType.toLowerCase()));
      
      if (sameExtFiles.length > 0) {
        if (fileType.toLowerCase() === '.tex') {
          targetFile = sameExtFiles.find(f => f.toLowerCase().includes('main')) || sameExtFiles[0];
        } else if (fileType.toLowerCase() === '.bib') {
          targetFile = sameExtFiles.find(f => f.toLowerCase().includes('sample') || f.toLowerCase().includes('refs')) || sameExtFiles[0];
        } else {
          targetFile = sameExtFiles[0];
        }
      } else {
        // If no file of that type exists, we'll create a new one with a default name
        const defaultNames: Record<string, string> = {
          '.tex': 'main.tex',
          '.bib': 'sample.bib',
          '.cls': `${builtinTemplate.id}.cls`,
          '.sty': `${builtinTemplate.id}.sty`,
          '.bst': `${builtinTemplate.id}.bst`
        };
        targetFile = defaultNames[fileType.toLowerCase()] || `file${fileType}`;
      }

      const targetPath = path.join(assetDir, targetFile);
      fs.writeFileSync(targetPath, content, 'utf8');

      return NextResponse.json({ 
        success: true, 
        message: `Updated built-in file: ${targetFile}`,
        path: targetPath
      });
    }

    // 2. Check if it's a custom template in the DB
    const customTemplate = await prisma.template.findUnique({
      where: { id: templateId }
    });

    if (customTemplate) {
      if (customTemplate.userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      let assetsMap: Record<string, string> = {};
      try {
        assetsMap = JSON.parse(customTemplate.assetsJson as string || '{}');
      } catch (e) {
        assetsMap = {};
      }

      // Find existing key with same extension
      const existingKey = Object.keys(assetsMap).find(k => k.toLowerCase().endsWith(fileType.toLowerCase()));
      
      if (existingKey) {
        assetsMap[existingKey] = content;
      } else {
        // Add new
        const newKey = `template${fileType}`;
        assetsMap[newKey] = content;
      }

      // Update specific fields if needed
      const updateData: any = {
        assetsJson: JSON.stringify(assetsMap)
      };

      if (fileType.toLowerCase() === '.tex') updateData.templateContent = content;
      if (fileType.toLowerCase() === '.cls') updateData.clsContent = content;
      if (fileType.toLowerCase() === '.bst') updateData.bstContent = content;

      await prisma.template.update({
        where: { id: templateId },
        data: updateData
      });

      return NextResponse.json({ success: true, message: 'Updated custom template in database' });
    }

    return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  } catch (error: any) {
    console.error("POST /api/templates/update-file error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
