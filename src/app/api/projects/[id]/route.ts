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

    let isOwner = project.userId === session.user.id;
    if (!isOwner && session.user.email) {
      const ownerUser = await prisma.user.findUnique({
        where: { id: project.userId },
        select: { email: true }
      }).catch(() => null);
      if (ownerUser && ownerUser.email?.toLowerCase() === session.user.email?.toLowerCase()) {
        isOwner = true;
      }
    }
    const isCollab = collaborators.some((c: any) => c.userEmail?.toLowerCase() === session.user.email?.toLowerCase());
    const isAdmin = (session.user as any).role === 'admin';
    
    if (!isOwner && !isCollab && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Dynamic Self-Healing Sieve: if main.tex in ProjectFile is empty but Project.latexContent is valid, heal it on demand
    let mainFile = project.files.find((f: any) => f.filename === 'main.tex');
    if (mainFile && (!mainFile.content || mainFile.content.trim().length < 50) && project.latexContent && project.latexContent.trim().length >= 50) {
      console.log(`[API_PROJECT_HEAL] main.tex in ProjectFile was empty/corrupt for project ${id}. Healing with project.latexContent!`);
      mainFile.content = project.latexContent;
      prisma.projectFile.update({
        where: { id: mainFile.id },
        data: { content: project.latexContent }
      }).catch((err: any) => console.error('[API_PROJECT_HEAL] Failed to update healed main.tex in DB:', err));
    }

    // Dynamic Self-Healing Sieve: Clean up hyphenated input/include paths caused by previous breakLongWords bug
    if (mainFile && mainFile.content && (mainFile.content.includes('\\input{') || mainFile.content.includes('\\include{') || mainFile.content.includes('\\import{') || mainFile.content.includes('\\subfile{') || mainFile.content.includes('\\subimport{'))) {
      const healInputPaths = (text: string) => {
        return text.replace(/\\(input|include|import|subfile|subimport)(?:\*|\[.*?\])?\s*\{([^}]+)\}/gi, (match, cmd, filepath) => {
          if (filepath.includes('\\-')) {
            return `\\${cmd}{${filepath.replace(/\\-/g, '')}}`;
          }
          return match;
        });
      };
      
      const healedContent = healInputPaths(mainFile.content);
      if (healedContent !== mainFile.content) {
        console.log(`[API_PROJECT_HEAL] main.tex in project ${id} contained hyphenated input paths. Healing on-the-fly!`);
        mainFile.content = healedContent;
        project.latexContent = healedContent;
        
        prisma.projectFile.update({
          where: { id: mainFile.id },
          data: { content: healedContent }
        }).catch((err: any) => console.error('[API_PROJECT_HEAL] Failed to update healed main.tex file:', err));
        
        prisma.project.update({
          where: { id },
          data: { latexContent: healedContent }
        }).catch((err: any) => console.error('[API_PROJECT_HEAL] Failed to update healed project latexContent:', err));
      }
    }

    // Local-first self-heal (Phase 2): if the AI snapshot (aiLatex/verdict)
    // is missing from structuredContent — PB record caps trimmed it or the
    // record was recreated — restore it from the ai-verdict.json file the
    // upload route persists to server disk.
    if (project.structuredContent) {
      try {
        const sc = JSON.parse(project.structuredContent);
        const lacksAiLatex = sc && typeof sc === 'object' && !(sc as any).aiLatex;
        if (lacksAiLatex) {
          const { readAiVerdictSnapshot } = await import('@/lib/local-project-fs');
          const snapshot = readAiVerdictSnapshot(id);
          if (snapshot && (snapshot.aiLatex || snapshot.aiVerdict)) {
            if (snapshot.aiLatex) (sc as any).aiLatex = snapshot.aiLatex;
            if (snapshot.aiVerdict) (sc as any).aiVerdict = snapshot.aiVerdict;
            if (snapshot.aiModel) (sc as any).aiModel = snapshot.aiModel;
            project.structuredContent = JSON.stringify(sc);
            console.log(`[API_PROJECT_HEAL] Restored AI snapshot (ai-verdict.json) for project ${id}.`);
            prisma.project.update({
              where: { id },
              data: { structuredContent: project.structuredContent }
            }).catch((err: any) => console.error('[API_PROJECT_HEAL] Failed to persist restored structuredContent:', err));
          }
        }
      } catch (healErr: any) {
        console.warn('[API_PROJECT_HEAL] AI snapshot self-heal failed (non-critical):', healErr?.message || healErr);
      }
    }

    // Local-first self-heal: main.tex missing from both DB and ProjectFile but
    // present on server disk (upload harvest) — restore it so the editor and
    // compilers can still open the project after DB content loss.
    if ((!project.latexContent || project.latexContent.trim().length < 50) && (!mainFile || !mainFile.content || mainFile.content.trim().length < 50)) {
      try {
        const { readLocalProjectFile } = await import('@/lib/local-project-fs');
        const diskMain = readLocalProjectFile(id, 'main.tex');
        if (diskMain) {
          const diskContent = diskMain.toString('utf-8');
          if (diskContent.trim().length >= 50) {
            project.latexContent = diskContent;
            console.log(`[API_PROJECT_HEAL] main.tex restored from server disk for project ${id}.`);
            prisma.project.update({
              where: { id },
              data: { latexContent: diskContent }
            }).catch((err: any) => console.error('[API_PROJECT_HEAL] Failed to persist restored latexContent:', err));
          }
        }
      } catch (diskErr: any) {
        console.warn('[API_PROJECT_HEAL] Disk main.tex self-heal failed (non-critical):', diskErr?.message || diskErr);
      }
    }

    // ── COMPLETE DISK FILE DISCOVERY & SYNC ─────────────────────────────────
    // Scans public/uploads/projects/{id} recursively for all sections, metadata,
    // references, floats, and image assets. Ensures they are returned to the IDE
    // and synced to DB so the user can see, edit, and debug all files.
    const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', id);
    const existingFileNames = new Set(project.files.map((f: any) => f.filename.replace(/\\/g, '/')));

    if (fs.existsSync(projectDir)) {
      const walkSync = (dir: string, base: string = ''): string[] => {
        let results: string[] = [];
        try {
          const list = fs.readdirSync(dir);
          for (const file of list) {
            const fullP = path.join(dir, file);
            const relP = base ? `${base}/${file}` : file;
            const stat = fs.statSync(fullP);
            if (stat.isDirectory()) {
              results = results.concat(walkSync(fullP, relP));
            } else {
              results.push(relP);
            }
          }
        } catch {}
        return results;
      };

      const diskFiles = walkSync(projectDir);
      const IGNORE_EXTS = new Set(['.json', '.trc', '.log', '.aux', '.out', '.toc', '.fls', '.fdb_latexmk', '.synctex.gz']);

      for (const relPath of diskFiles) {
        const normRel = relPath.replace(/\\/g, '/');
        if (normRel === 'source_document.json' || normRel === 'ai-verdict.json') continue;
        const ext = path.extname(normRel).toLowerCase();
        if (IGNORE_EXTS.has(ext)) continue;
        if (ext === '.pdf' && normRel !== 'main.pdf') continue; // keep non-build PDFs if any

        const isImageExt = /\.(png|jpe?g|gif|svg|webp|eps|tiff?|bmp|heic|heif|avif)$/i.test(normRel);
        const isTextExt = /\.(tex|bib|cls|sty|bst|cfg|clo|def|ldf|txt|tikz|lua)$/i.test(normRel);

        if (!isImageExt && !isTextExt) continue;

        if (!existingFileNames.has(normRel)) {
          existingFileNames.add(normRel);
          let fileContent = '';
          const fullPath = path.join(projectDir, relPath);

          if (isTextExt) {
            try {
              fileContent = fs.readFileSync(fullPath, 'utf-8');
            } catch {}
          }

          const newFileObj = {
            id: `disk_${id}_${normRel.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            projectId: id,
            filename: normRel,
            filePath: `/uploads/projects/${id}/${normRel}`,
            fileType: isImageExt ? 'image' : (ext.slice(1) || 'tex'),
            content: fileContent,
          };

          project.files.push(newFileObj);

          // Asynchronously upsert to DB so future lookups are fast
          prisma.projectFile.create({
            data: {
              projectId: id,
              filename: normRel,
              filePath: `/uploads/projects/${id}/${normRel}`,
              fileType: isImageExt ? 'image' : (ext.slice(1) || 'tex'),
              content: fileContent,
            }
          }).catch(() => {});
        }
      }
    }

    // ── ON-DEMAND MODULAR COMPONENT SYNTHESIS ────────────────────────────────
    // If main.tex references \input{metadata/...} or \input{sections/...} but those
    // files are missing from project.files, synthesize them from structuredContent/source_document.json.
    const activeMainTex = project.latexContent || (project.files.find((f: any) => f.filename === 'main.tex')?.content) || '';
    const inputMatches = activeMainTex.match(/\\(?:input|include|import|subfile|subimport)(?:\*|\[.*?\])?\s*\{([^}]+)\}/gi) || [];

    const missingInputs: string[] = [];
    for (const match of inputMatches) {
      const m = match.match(/\\(?:input|include|import|subfile|subimport)(?:\*|\[.*?\])?\s*\{([^}]+)\}/);
      if (!m) continue;
      let target = m[1].trim().replace(/^\.\//, '').replace(/\\/g, '/');
      if (!target.endsWith('.tex') && !target.endsWith('.bib') && !target.endsWith('.cls') && !target.endsWith('.sty')) {
        target += '.tex';
      }
      if (!existingFileNames.has(target)) {
        missingInputs.push(target);
      }
    }

    if (missingInputs.length > 0) {
      try {
        // Read structured model from disk or DB
        const sourceDocPath = path.join(projectDir, 'source_document.json');
        let structuredModel: any = null;
        if (fs.existsSync(sourceDocPath)) {
          try {
            structuredModel = JSON.parse(fs.readFileSync(sourceDocPath, 'utf-8'));
          } catch {}
        }
        if (!structuredModel && project.structuredContent) {
          try {
            structuredModel = typeof project.structuredContent === 'string'
              ? JSON.parse(project.structuredContent)
              : project.structuredContent;
          } catch {}
        }

        if (structuredModel && structuredModel.body && Array.isArray(structuredModel.body) && structuredModel.body.length > 0) {
          const { ModularLatexAssembler } = await import('@/lib/assembler');
          const { mapLegacyTemplateId } = await import('@/lib/templates/registry');
          const tplId = mapLegacyTemplateId(project.templateName || 'generic_academic');
          const assembled = ModularLatexAssembler.assemble(structuredModel, tplId);

          if (assembled && assembled.files) {
            for (const [fName, fContent] of Object.entries(assembled.files)) {
              const normName = fName.replace(/\\/g, '/');
              if (!existingFileNames.has(normName)) {
                existingFileNames.add(normName);
                const fullP = path.join(projectDir, normName);
                try {
                  fs.mkdirSync(path.dirname(fullP), { recursive: true });
                  fs.writeFileSync(fullP, String(fContent), 'utf-8');
                } catch {}

                const assembledFileObj = {
                  id: `syn_${id}_${normName.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
                  projectId: id,
                  filename: normName,
                  filePath: `/uploads/projects/${id}/${normName}`,
                  fileType: normName.split('.').pop() || 'tex',
                  content: String(fContent),
                };

                project.files.push(assembledFileObj);

                prisma.projectFile.create({
                  data: {
                    projectId: id,
                    filename: normName,
                    filePath: `/uploads/projects/${id}/${normName}`,
                    fileType: normName.split('.').pop() || 'tex',
                    content: String(fContent),
                  }
                }).catch(() => {});
              }
            }
          }
        }
      } catch (synthErr) {
        console.warn('[API_PROJECT_HEAL] Modular synthesis self-heal failed (non-critical):', synthErr);
      }
    }

    // Universal Metadata Healing for Visual Assets
    // Ensures that no matter which workflow created the file, images are always properly typed and addressable
    if (project.files) {
      project.files = project.files.map((f: any) => {
        const isImageExt = /\.(png|jpe?g|gif|svg|webp|eps|tiff?|bmp|heic|heif|avif)$/i.test(f.filename);
        if (isImageExt) {
          f.fileType = 'image';
          if (!f.filePath) {
            f.filePath = `/uploads/projects/${project.id}/${f.filename.replace(/\\/g, '/')}`;
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

    // DELETE PROPAGATION: the editor tells the server which files were deleted
    // from the local IndexedDB VFS. Without this, stale ProjectFile rows and
    // disk copies are resurrected by hardenedDiscovery on the next compile —
    // deleted .tex files keep compiling into the PDF forever.
    const deleteFiles: string[] = Array.isArray(body.deleteFiles) ? body.deleteFiles.map((p: unknown) => String(p)) : [];
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

      // Apply requested deletions to BOTH the SQLite store and the disk copy,
      // so no stale file can be resurrected by hardenedDiscovery at compile.
      if (deleteFiles.length > 0) {
        await prisma.projectFile.deleteMany({
          where: { projectId: id, filename: { in: deleteFiles } }
        });
        const projectDirForDelete = path.join(process.cwd(), 'public', 'uploads', 'projects', id);
        const rootPrefix = projectDirForDelete.toLowerCase().replace(/[\\/]$/, '');
        for (const delPath of deleteFiles) {
          if (!delPath || delPath.includes('..')) continue;
          const destPath = path.join(projectDirForDelete, delPath.replace(/^[/\\]+/, ''));
          if (destPath.toLowerCase().startsWith(rootPrefix + path.sep.toLowerCase()) || destPath.toLowerCase() === rootPrefix) {
            try { fs.rmSync(destPath, { force: true }); } catch (delErr) {
              console.error(`[DISK_SYNC_ERROR] Could not delete ${delPath}:`, delErr);
            }
          }
        }
        console.log(`[PROJECT] Deleted ${deleteFiles.length} file(s) from project ${id}: ${deleteFiles.join(', ')}`);
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

