import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth-pb';
import { calculateDocumentStats } from '@/lib/stats';
import fs from 'fs';
import path from 'path';
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    if (!id) return NextResponse.json({ error: 'Missing ID param' }, { status: 400 });

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Fetch files and collaborators separately — PB expand doesn't work
    // for reverse relations (projects has no `files` or `collaborators` field).
    const [files, collaborators] = await Promise.all([
      prisma.projectFile.findMany({ where: { projectId: id } }),
      prisma.projectCollaborator.findMany({ where: { projectId: id } }),
    ]);

    (project as any).files = files;
    (project as any).collaborators = collaborators;

    const isOwner = project.userId === session.user.id;
    const isCollab = collaborators.some((c: any) => c.userEmail === session.user.email);
    
    if (!isOwner && !isCollab) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Dynamic Self-Healing Sieve: if main.tex in ProjectFile is empty but Project.latexContent is valid, heal it on demand
    const mainFile = project.files.find((f: any) => f.filename === 'main.tex');
    if (mainFile && (!mainFile.content || mainFile.content.trim().length < 50) && project.latexContent && project.latexContent.trim().length >= 50) {
      console.log(`[API_PROJECT_HEAL] main.tex in ProjectFile was empty/corrupt for project ${id}. Healing with project.latexContent!`);
      mainFile.content = project.latexContent;
      prisma.projectFile.update({
        where: { id: mainFile.id },
        data: { content: project.latexContent }
      }).catch((err: any) => console.error('[API_PROJECT_HEAL] Failed to update healed main.tex in DB:', err));
    }

    // Universal Metadata Healing for Visual Assets
    // Ensures that no matter which workflow created the file, images are always properly typed and addressable
    if (project.files) {
      project.files = project.files.map((f: any) => {
        const isImageExt = /\.(png|jpe?g|gif|svg|webp|eps|tiff?|bmp|heic|heif)$/i.test(f.filename);
        if (isImageExt) {
          f.fileType = 'image';
          if (!f.filePath) {
            f.filePath = `/uploads/projects/${project.id}/${f.filename}`;
          }
        }
        return f;
      });
    }

    return NextResponse.json({
      project: {
        ...project,
        templateId: project.templateName || 'blank'
      }
    });

  } catch (error: any) {
    console.error('Fetch Project Error:', error);
    return NextResponse.json({ error: error.message || 'Error fetching project' }, { status: 500 });
  }
}

function resolveLatexInputs(mainTex: string, files: { filename: string, content: string | null }[]): string {
  let resolved = mainTex;
  // Match \input{...}, \include{...}, \import{...}, \subfile{...}, \subimport{...} with optional spaces and arguments
  const inputRegex = /\\(?:input|include|import|subfile|subimport)(?:\*|\[.*?\])?\s*\{([^}]+)\}/g;
  for (let depth = 0; depth < 5; depth++) {
    let hasReplacements = false;
    resolved = resolved.replace(inputRegex, (match, filepath) => {
      let cleanPath = filepath.trim().replace(/\.tex$/, '');
      // Normalize target path (strip leading './', backslashes, etc.)
      cleanPath = cleanPath.replace(/^\.\//, '').replace(/\\/g, '/');
      const possibleNames = [
        cleanPath,
        `${cleanPath}.tex`,
        cleanPath.split('/').pop() || '',
        (cleanPath.split('/').pop() || '') + '.tex'
      ];
      
      const file = files.find(f => {
        const fNorm = f.filename.trim().replace(/^\.\//, '').replace(/\\/g, '/');
        const fNormNoExt = fNorm.replace(/\.tex$/, '');
        return possibleNames.includes(fNorm) || possibleNames.includes(fNormNoExt);
      });

      if (file && file.content) {
        hasReplacements = true;
        return file.content;
      }
      return match;
    });
    if (!hasReplacements) break;
  }
  return resolved;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const latexContent = body.latexContent;
    const newTitle = body.title || body.name; // Robust mapping
    // Diagram-specific fields
    const diagramContent = body.content;       // Mermaid code string
    const diagramStructured = body.structuredContent; // JSON string of nodes/connections

    const [project, projectFiles, projectCollabs] = await Promise.all([
      prisma.project.findUnique({ where: { id } }),
      prisma.projectFile.findMany({ where: { projectId: id } }),
      prisma.projectCollaborator.findMany({ where: { projectId: id } }),
    ]);

    (project as any).files = projectFiles;
    (project as any).collaborators = projectCollabs;

    const isOwner = project?.userId === session.user.id;
    const isEditor = projectCollabs.some((c: any) => c.userEmail === session.user.email && c.role === 'editor');

    if (!project || (!isOwner && !isEditor)) {
      return NextResponse.json({ error: 'Forbidden (Editor access required)' }, { status: 403 });
    }

    const files = [...(projectFiles || [])];
    if (body.files && Array.isArray(body.files)) {
      for (const newFile of body.files) {
        if (!newFile.filename) continue;
        const existing = files.find(f => f.filename === newFile.filename);
        if (existing) {
          existing.content = newFile.content;
        } else {
          files.push({
            filename: newFile.filename,
            content: newFile.content || ""
          } as any);
        }
      }
    }
    const resolvedLatex = resolveLatexInputs(latexContent || project.latexContent || "", files);
    const stats = calculateDocumentStats(resolvedLatex);

    // If using BibTeX (.bib) file and stats.referenceCount is 0, count bib entries
    if (stats.referenceCount === 0) {
      const bibFile = files.find(f => f.filename.endsWith('.bib'));
      if (bibFile && bibFile.content) {
        const bibEntriesCount = (bibFile.content.match(/^\s*@[a-zA-Z]+/gm) || []).length;
        if (bibEntriesCount > 0) {
          stats.referenceCount = bibEntriesCount;
        }
      }
    }

    try {
      // For diagram projects, bypass LaTeX stats and save canvas data instead
      const isDiagram = project.projectType === 'DIAGRAM';
      const updateData: Record<string, unknown> = {
        title: newTitle || project.title,
      };
      if (isDiagram) {
        if (diagramContent !== undefined) updateData.content = diagramContent;
        if (diagramStructured !== undefined) updateData.structuredContent = diagramStructured;
      } else {
        updateData.latexContent = latexContent || project.latexContent;
        Object.assign(updateData, stats);
      }
      await prisma.project.update({
        where: { id },
        data: updateData as any,
      });

      // Synchronize to the physical disk so the compiler always has the latest edits
      const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', id);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      if (latexContent) {
        try {
          fs.writeFileSync(path.join(projectDir, 'main.tex'), latexContent, 'utf-8');
        } catch (diskErr) {
          console.error('[DISK_SYNC_ERROR] Could not write main.tex to disk:', diskErr);
        }
      }

      // Synchronize additional project files into SQLite persistent store
      if (body.files && Array.isArray(body.files)) {
        for (const file of body.files) {
          if (!file.filename) continue;
          
          try {
            const destPath = path.join(projectDir, file.filename);
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
              fs.mkdirSync(destDir, { recursive: true });
            }
            let contentToWrite: Buffer | string = file.content || "";
            if (typeof contentToWrite === 'string' && contentToWrite.startsWith('data:')) {
              const base64Data = contentToWrite.split(',')[1] || '';
              contentToWrite = Buffer.from(base64Data, 'base64');
            }
            fs.writeFileSync(destPath, contentToWrite);
          } catch (diskErr) {
            console.error(`[DISK_SYNC_ERROR] Could not write ${file.filename} to disk:`, diskErr);
          }

          const ext = file.filename.split('.').pop()?.toLowerCase();
          const fileType = file.fileType || ext || 'tex';
          const filePath = file.filePath || `/uploads/projects/${id}/${file.filename}`;
          
          await prisma.projectFile.upsert({
            where: {
              projectId_filename: {
                projectId: id,
                filename: file.filename
              }
            },
            update: {
              content: file.content || "",
              fileType,
              filePath
            },
            create: {
              projectId: id,
              filename: file.filename,
              content: file.content || "",
              fileType,
              filePath
            }
          });
        }
      }
    } catch (prismaErr: any) {
       console.error("[PRISMA_UPDATE_ERROR]", prismaErr);
       // Check for common schema errors and provide a descriptive exception
       if (prismaErr.code === 'P2002') {
           return NextResponse.json({ error: 'Constraint violation during update' }, { status: 400 });
       }
       throw prismaErr; // Bubble up for general 500
    }


    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

