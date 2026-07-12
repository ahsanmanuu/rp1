import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getTemplateById } from '@/lib/templates/registry';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = getTemplateById(id);

    // If it's a built-in template with an asset folder
    if (template && template.assetFolder) {
      const assetsDir = path.join(process.cwd(), 'src', 'assets', 'templates', template.assetFolder);
      if (!fs.existsSync(assetsDir)) {
        return NextResponse.json({ error: 'Asset directory does not exist' }, { status: 404 });
      }

      const files = fs.readdirSync(assetsDir);
      const bundle: Record<string, string> = {};

      // Only serve LaTeX-relevant files — images and other assets are excluded
      const LATEX_EXTS = new Set(['.tex', '.bib', '.bst', '.cls', '.sty', '.ldf', '.cfg', '.clo']);

      for (const fileName of files) {
        const filePath = path.join(assetsDir, fileName);
        const stat = fs.statSync(filePath);
        
        if (stat.isFile()) {
          const ext = path.extname(fileName).toLowerCase();
          // Skip non-LaTeX files (images, PDFs, etc.)
          if (!LATEX_EXTS.has(ext)) continue;
          bundle[fileName] = fs.readFileSync(filePath, 'utf-8');
        }
      }
      return NextResponse.json({ id, bundle });
    }

    // Try finding in Database
    const { prisma } = await import('@/lib/prisma');
    const dbTemplate = await prisma.template.findUnique({ where: { id } });
    
    if (dbTemplate) {
      const bundle: Record<string, string> = {};
      
      bundle['main.tex'] = dbTemplate.templateContent;
      
      if (dbTemplate.clsContent) {
        // We try to guess the cls filename, or default to myclass.cls
        // Usually it's derived from documentclass but let's name it custom.cls
        // Wait, for custom cls we need to know the name to be useful. 
        // If they uploaded a single .cls, we made the skeleton \documentclass{filename}
        // Let's scan templateContent for \documentclass{...}
        const match = dbTemplate.templateContent.match(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/);
        const clsName = match ? `${match[1]}.cls` : 'custom.cls';
        bundle[clsName] = dbTemplate.clsContent;
      }
      if (dbTemplate.bstContent) {
        bundle['custom.bst'] = dbTemplate.bstContent;
      }
      
      return NextResponse.json({ id, bundle });
    }

    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  } catch (error: any) {
    console.error('[TEMPLATE_BUNDLE_API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
