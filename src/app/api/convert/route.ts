import { NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { transformHtmlToLatex } from '@/lib/converter';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const templateId = formData.get('templateId') as string;
    const projectId = formData.get('projectId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const assets: { filename: string, buffer: Buffer }[] = [];
    let imageCounter = 0;

    // Mammoth Conversion with Image Handler
    const mammothResult = await mammoth.convertToHtml({ arrayBuffer }, {
      convertImage: mammoth.images.imgElement((image) => {
        imageCounter++;
        return image.read().then(async (imageBuffer) => {
          const extension = image.contentType.split('/')[1] || 'png';
          const filename = `rf_fig_${imageCounter}.${extension}`;
          assets.push({ filename, buffer: Buffer.from(imageBuffer) });
          return { src: filename };
        });
      })
    });

    const html = mammothResult.value;
    const warnings = mammothResult.messages;

    // Save Assets to Disk & DB if projectId provided
    if (projectId && assets.length > 0) {
      const fs = await import('fs');
      const path = await import('path');
      const { prisma } = await import('@/lib/prisma');
      
      const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
      if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

      for (const asset of assets) {
        const filePath = path.join(projectDir, asset.filename);
        fs.writeFileSync(filePath, asset.buffer);
        
        const assetFilePath = `/uploads/projects/${projectId}/${asset.filename}`;
        
        // Register in DB so compiler finds it
        await prisma.projectFile.upsert({
          where: { projectId_filename: { projectId, filename: asset.filename } },
          update: { 
            filePath: assetFilePath,
            fileType: 'image',
            size: asset.buffer.length,
            updatedAt: new Date() 
          },
          create: { 
            projectId, 
            filename: asset.filename, 
            filePath: assetFilePath,
            fileType: 'image',
            size: asset.buffer.length 
          }
        });
      }
    }

    // Transform HTML to LaTeX (Multi-File Output)
    const { latex, files: componentFiles, stats } = transformHtmlToLatex(html, templateId) as any;

    // Save All Component Files to Disk & DB
    if (projectId) {
      const fs = await import('fs');
      const path = await import('path');
      const { prisma } = await import('@/lib/prisma');
      const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);

      // 1. Save main.tex
      const mainPath = path.join(projectDir, 'main.tex');
      fs.writeFileSync(mainPath, latex);
      await prisma.projectFile.upsert({
        where: { projectId_filename: { projectId, filename: 'main.tex' } },
        update: { 
          content: latex, 
          fileType: 'tex',
          filePath: `/uploads/projects/${projectId}/main.tex`,
          updatedAt: new Date() 
        },
        create: { 
          projectId, 
          filename: 'main.tex', 
          content: latex, 
          fileType: 'tex',
          filePath: `/uploads/projects/${projectId}/main.tex`
        }
      });

      // 2. Save all other components
      for (const [filename, content] of Object.entries(componentFiles || {})) {
        const filePath = path.join(projectDir, filename as string);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(filePath, content as string);
        
        const normalizedFilename = (filename as string).replace(/\\/g, '/');
        const ext = normalizedFilename.split('.').pop() || 'tex';
        const projectFilePath = `/uploads/projects/${projectId}/${normalizedFilename}`;

        await prisma.projectFile.upsert({
          where: { projectId_filename: { projectId, filename: normalizedFilename } },
          update: { 
            content: content as string, 
            fileType: ext,
            filePath: projectFilePath,
            updatedAt: new Date() 
          },
          create: { 
            projectId, 
            filename: normalizedFilename, 
            content: content as string, 
            fileType: ext,
            filePath: projectFilePath
          }
        });
      }

      // Update project main file and stats
      await prisma.project.update({
        where: { id: projectId },
        data: {
          latexContent: latex,
          wordCount: stats.words,
          charCount: stats.chars,
          imageCount: stats.images,
          tableCount: stats.tables,
          equationCount: stats.equations,
          citationCount: stats.citations,
          referenceCount: stats.references || 0,
          pseudocodeCount: stats.pseudocode || 0
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      latexCode: latex, 
      files: componentFiles,
      stats, 
      warnings 
    });
  } catch (err: any) {
    console.error('Conversion Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
