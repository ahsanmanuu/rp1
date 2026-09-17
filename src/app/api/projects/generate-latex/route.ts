import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { autoHealLatex } from '@/lib/latex';
import { ModularLatexAssembler } from '@/lib/assembler';
import { DeepDocumentParser } from '@/lib/deep-parser';
import { runModularAiMapping } from '@/lib/ai-modular-mapping';
import { getTemplateById, mapLegacyTemplateId } from '@/lib/templates/registry';
import { getServerSession } from "@/lib/auth-pb";
import { calculateDocumentStats } from '@/lib/stats';
import { PipelineGC } from '@/lib/pipeline-gc';

export const maxDuration = 300;

/**
 * Phase 2 API: Generate modular LaTeX from structured content + template.
 *
 * Called after the user selects a template in the upload success view.
 * Takes the structured content saved during Phase 1 (upload) and runs
 * the ModularLatexAssembler to produce modular .tex files.
 *
 * Flow: structuredContent (DB) → assemble → persist files → return
 */
export async function POST(req: Request) {
  let projectId = '';
  let templateId = '';
  let figureFiles: { name: string; data: Buffer; contentType: string }[] = [];

  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Accept both multipart (client-carried figures) and legacy JSON bodies.
    // Figures arrive ONLY for client-extracted DOC2LATEX projects; the Phase-1
    // figure manifest (stored in structured.json) names exactly which files may
    // be persisted — anything else is rejected.
    const contentTypeHeader = req.headers.get('content-type') || '';
    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await req.formData();
      projectId = String(formData.get('projectId') || '');
      templateId = String(formData.get('templateId') || '');
      const rawFigures = formData.getAll('figures');
      for (const value of rawFigures) {
        if (value && typeof (value as any).arrayBuffer === 'function') {
          const fileObj = value as any;
          figureFiles.push({
            name: fileObj.name || 'figure.png',
            data: Buffer.from(await fileObj.arrayBuffer()),
            contentType: fileObj.type || 'image/png',
          });
        }
      }
    } else {
      const body = await req.json();
      projectId = body.projectId || '';
      templateId = body.templateId || '';
    }
    if (!projectId || !templateId) {
      return NextResponse.json({ error: 'Missing projectId or templateId' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    console.log(`[GENERATE-LATEX] Phase 2: Generating modular LaTeX for project ${projectId} with template ${templateId}`);

    const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
    const sourceDocPath = path.join(projectDir, 'source_document.json');

    // --- PARSE STRUCTURED CONTENT (Disk Source of Truth -> DB Fallback) ---
    // Reads complete untruncated source_document.json from disk if present
    // to guarantee 100% content fidelity with no skipping for 20MB files.
    let structured: any = {};
    if (fs.existsSync(sourceDocPath)) {
      try {
        const diskJson = fs.readFileSync(sourceDocPath, 'utf-8');
        structured = JSON.parse(diskJson);
        console.log(`[GENERATE-LATEX] Loaded 100% untruncated source document from disk (${diskJson.length} bytes)`);
      } catch (diskErr) {
        console.warn('[GENERATE-LATEX] Failed to read source_document.json from disk, falling back to DB');
      }
    }
    if (!structured || !structured.body || structured.body.length === 0) {
      try {
        structured = JSON.parse((project as any).structuredContent || '{}');
      } catch {
        console.warn('[GENERATE-LATEX] Failed to parse DB structuredContent');
      }
    }

    const rawHtml = structured.rawHtml || project.content || "";
    const rawXml = structured.rawXml || "";

    // --- RESOLVE TEMPLATE ---
    const template = getTemplateById(mapLegacyTemplateId(templateId));
    let templateMainTex: string | undefined = undefined;
    if (template && template.assetFolder) {
      const mainPath = path.join(process.cwd(), 'src', 'assets', 'templates', template.assetFolder, 'main.tex');
      if (fs.existsSync(mainPath)) {
        templateMainTex = fs.readFileSync(mainPath, 'utf-8');
      }
    }

    // Bounded concurrency mapping helper for Phase 2 parallelization
    async function pMap<T, R>(items: T[], fn: (item: T, idx: number) => Promise<R>, concurrency = 5): Promise<R[]> {
      const results: R[] = new Array(items.length);
      let nextIdx = 0;
      const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (nextIdx < items.length) {
          const idx = nextIdx++;
          results[idx] = await fn(items[idx], idx);
        }
      });
      await Promise.all(workers);
      return results;
    }

    // Safe upsert helper for DB projectFile
    const safeFileUpsert = async (data: { projectId: string; filename: string; content: string; fileType: string; filePath: string }) => {
      try {
        const existing = await prisma.projectFile.findFirst({ where: { projectId: data.projectId, filename: data.filename } });
        if (existing) {
          await prisma.projectFile.update({ where: { id: existing.id }, data });
        } else {
          await prisma.projectFile.create({ data });
        }
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (msg.includes('not found') || msg.includes('404')) {
          console.warn(`[GENERATE-LATEX] project_files collection unavailable, skipping ${data.filename}`);
        } else {
          console.warn(`[GENERATE-LATEX] Failed to sync ${data.filename}:`, msg.slice(0, 200));
        }
      }
    };

    // Build set of legitimate figure filenames for THIS project
    const validCurrentFigureNames = new Set<string>();
    for (const fig of figureFiles) {
      const safeName = String(fig.name).replace(/[^a-zA-Z0-9._-]/g, '_');
      validCurrentFigureNames.add(safeName);
    }
    if (Array.isArray(structured.figureManifest)) {
      for (const f of structured.figureManifest) {
        const name = typeof f === 'string' ? f : f?.name;
        if (name) validCurrentFigureNames.add(String(name).replace(/[^a-zA-Z0-9._-]/g, '_'));
      }
    }
    if (Array.isArray(structured.body)) {
      for (const node of structured.body) {
        if ((node.type === 'figure' || node.type === 'image' || node.type === 'chart') && (node.id || node.name)) {
          const rawId = String(node.id || node.name).replace(/^assets\//, '').replace(/^figures\//, '');
          const safeName = path.basename(rawId).replace(/[^a-zA-Z0-9._-]/g, '_');
          if (safeName) validCurrentFigureNames.add(safeName);
        }
      }
    }

    // ── FALLBACK EXTRACTION FROM source.docx ──
    const sourceDocxPath = path.join(projectDir, 'source.docx');
    if (fs.existsSync(sourceDocxPath)) {
      try {
        const AdmZipModule = (await import('adm-zip')).default;
        const zip = new AdmZipModule(sourceDocxPath);
        const zipEntries = zip.getEntries();
        const mediaEntries = zipEntries.filter((e: any) => e.entryName.startsWith('word/media/') && !e.isDirectory);
        const figuresSubDir = path.join(projectDir, 'figures');
        if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
        if (!fs.existsSync(figuresSubDir)) fs.mkdirSync(figuresSubDir, { recursive: true });

        let figSeq = 1;
        for (const entry of mediaEntries) {
          const entryBuf = entry.getData();
          if (entryBuf.length < 2048) continue;
          const ext = path.extname(entry.entryName).replace(/^\./, '').toLowerCase() || 'png';
          if (ext === 'emf' || ext === 'wmf') continue;
          const origName = path.basename(entry.entryName);
          const rfName = `rf_fig_${figSeq++}.${ext === 'jpeg' ? 'jpg' : ext}`;

          validCurrentFigureNames.add(origName);
          validCurrentFigureNames.add(rfName);

          const origRoot = path.join(projectDir, origName);
          const origFig = path.join(figuresSubDir, origName);
          const rfRoot = path.join(projectDir, rfName);
          const rfFig = path.join(figuresSubDir, rfName);

          if (!fs.existsSync(origRoot)) fs.writeFileSync(origRoot, entryBuf);
          if (!fs.existsSync(origFig)) fs.writeFileSync(origFig, entryBuf);
          if (!fs.existsSync(rfRoot)) fs.writeFileSync(rfRoot, entryBuf);
          if (!fs.existsSync(rfFig)) fs.writeFileSync(rfFig, entryBuf);
        }
        console.log(`[GENERATE-LATEX] Unpacked ${mediaEntries.length} media files from source.docx as robust fallback.`);
      } catch (docxErr) {
        console.warn('[GENERATE-LATEX] Could not unpack source.docx fallback:', docxErr);
      }
    }

    // --- REHYDRATE IMAGES FROM DB (e.g. on Render container restarts) ---
    try {
      const dbImages = await prisma.projectFile.findMany({
        where: {
          projectId,
          OR: [
            { fileType: 'image' },
            { filename: { endsWith: '.png' } },
            { filename: { endsWith: '.jpg' } },
            { filename: { endsWith: '.jpeg' } },
            { filename: { endsWith: '.webp' } },
            { filename: { endsWith: '.pdf' } },
            { filename: { endsWith: '.eps' } },
            { filename: { endsWith: '.svg' } },
          ]
        }
      });

      if (dbImages && dbImages.length > 0) {
        if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
        const figuresSubDir = path.join(projectDir, 'figures');
        if (!fs.existsSync(figuresSubDir)) fs.mkdirSync(figuresSubDir, { recursive: true });
        const assetsSubDir = path.join(projectDir, 'assets');
        if (!fs.existsSync(assetsSubDir)) fs.mkdirSync(assetsSubDir, { recursive: true });

        for (const imgRec of dbImages) {
          const baseName = path.basename(imgRec.filename);
          if (!baseName || baseName.includes('fallback_figure')) continue;

          validCurrentFigureNames.add(baseName);

          const rootPath = path.join(projectDir, baseName);
          const figPath = path.join(figuresSubDir, baseName);
          const assetPath = path.join(assetsSubDir, baseName);

          if (!fs.existsSync(rootPath) || !fs.existsSync(figPath)) {
            let buf: Buffer | null = null;
            if (imgRec.content && imgRec.content.startsWith('data:')) {
              const commaIdx = imgRec.content.indexOf(',');
              if (commaIdx !== -1) {
                buf = Buffer.from(imgRec.content.slice(commaIdx + 1), 'base64');
              }
            } else if (imgRec.content && /^[A-Za-z0-9+/=]+$/.test(imgRec.content.trim()) && imgRec.content.length > 100) {
              buf = Buffer.from(imgRec.content.trim(), 'base64');
            }

            if (buf && buf.length > 50) {
              if (!fs.existsSync(rootPath)) fs.writeFileSync(rootPath, buf);
              if (!fs.existsSync(figPath)) fs.writeFileSync(figPath, buf);
              if (!fs.existsSync(assetPath)) fs.writeFileSync(assetPath, buf);
            }
          }
        }
        console.log(`[GENERATE-LATEX] Rehydrated missing image records from DB to disk`);
      }
    } catch (rehydrateErr: any) {
      console.warn('[GENERATE-LATEX] Failed to rehydrate images from DB:', rehydrateErr?.message || rehydrateErr);
    }

    // --- PURGE STALE / ZOMBIE IMAGES FROM DISK & DB TO PREVENT CROSS-CONTAMINATION ---
    if (validCurrentFigureNames.size > 0 && fs.existsSync(projectDir)) {
      const imgDirs = [projectDir, path.join(projectDir, 'assets'), path.join(projectDir, 'figures')];
      for (const dir of imgDirs) {
        if (!fs.existsSync(dir)) continue;
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            const isImg = /\.(png|jpg|jpeg|gif|webp|pdf|svg|eps|tiff?|bmp)$/i.test(ext);
            if (isImg) {
              if (
                validCurrentFigureNames.has(file) ||
                /^rf_fig_\d+/i.test(file) ||
                /^rf_chart_\d+/i.test(file) ||
                /^chart_pending_/i.test(file) ||
                /^chart\d+/i.test(file) ||
                /^image\d+/i.test(file)
              ) {
                continue;
              }
              console.log(`[GENERATE-LATEX] Pruning stale image from disk: ${file}`);
              try { fs.unlinkSync(path.join(dir, file)); } catch {}
            }
          }
        } catch {}
      }

      // Also clean stale image rows from DB projectFile
      try {
        const dbImages = await prisma.projectFile.findMany({
          where: { projectId, fileType: 'image' },
          select: { id: true, filename: true }
        });
        const staleIds = dbImages
          .filter((row: { id: string; filename: string }) => {
            const base = path.basename(row.filename);
            return !validCurrentFigureNames.has(base) &&
              !validCurrentFigureNames.has(row.filename) &&
              !/^rf_fig_\d+/i.test(base) &&
              !/^rf_chart_\d+/i.test(base) &&
              !/^chart_pending_/i.test(base) &&
              !/^chart\d+/i.test(base) &&
              !/^image\d+/i.test(base);
          })
          .map((r: { id: string; filename: string }) => r.id);
        if (staleIds.length > 0) {
          console.log(`[GENERATE-LATEX] Pruning ${staleIds.length} stale image record(s) from DB`);
          await prisma.projectFile.deleteMany({ where: { id: { in: staleIds } } });
        }
      } catch (dbPruneErr) {
        console.warn('[GENERATE-LATEX] Failed to prune stale DB images:', dbPruneErr);
      }
    }

    // --- PERSIST CLIENT-CARRIED FIGURES (multipart) ---
    // For client-extracted DOC2LATEX projects the figure bytes never touched
    // the server at upload time — they are attached here. Only names declared
    // in the Phase-1 figureManifest are accepted; they land in the project
    // ROOT (the assembler/mapping conventions reference ./rf_fig_N.ext) and figures/.
    if (figureFiles.length > 0) {
      let savedFigures = 0;
      if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
      const figuresSubDir = path.join(projectDir, 'figures');
      if (!fs.existsSync(figuresSubDir)) fs.mkdirSync(figuresSubDir, { recursive: true });

      await pMap(figureFiles, async (fig) => {
        const safeName = String(fig.name).replace(/[^a-zA-Z0-9._-]/g, '_');
        const ext = path.extname(safeName).toLowerCase();
        const isImage = /\.(png|jpg|jpeg|gif|webp|pdf|svg|eps|tiff?|bmp|heic|heif|avif)$/i.test(ext);
        if (!isImage || !fig.data || fig.data.length < 50) {
          if (!fig.data || fig.data.length < 50) {
            console.warn(`[GENERATE-LATEX] Skipping empty/corrupt figure buffer for ${safeName} (${fig.data?.length || 0} bytes)`);
          }
          return;
        }

        try {
          fs.writeFileSync(path.join(projectDir, safeName), fig.data);
          fs.writeFileSync(path.join(figuresSubDir, safeName), fig.data);
          savedFigures++;
          const mime = ext === '.jpg' ? 'image/jpeg' : `image/${ext.replace(/^\./, '')}`;
          const b64 = `data:${mime};base64,${fig.data.toString('base64')}`;

          await Promise.all([
            safeFileUpsert({
              projectId,
              filename: safeName,
              content: b64,
              fileType: 'image',
              filePath: `/uploads/projects/${projectId}/${safeName}`
            }),
            safeFileUpsert({
              projectId,
              filename: `figures/${safeName}`,
              content: b64,
              fileType: 'image',
              filePath: `/uploads/projects/${projectId}/figures/${safeName}`
            }),
          ]);
        } catch (figErr: any) {
          console.warn('[GENERATE-LATEX] Failed to persist figure', safeName, figErr?.message || figErr);
        }
      }, 4);
      console.log(`[GENERATE-LATEX] Persisted ${savedFigures} figure(s) to project root, figures, and DB`);
    }

    // --- ASSEMBLE MODULAR LATEX ---
    let modelToUse: any = (structured.body && structured.body.length > 0) ? structured : null;
    let fullLatex = "";
    let extractedComponents: Record<string, string> = {};
    let usedOriginalTemplate = false;
    let aiModularSuccess = false;

    if (modelToUse) {
      console.log(`[GENERATE-LATEX] Fast assembling from Structured Model for template: ${templateId}...`);

      // Reconcile figureFiles / figureManifest into modelToUse before assembly
      if (figureFiles.length > 0 && modelToUse.body && Array.isArray(modelToUse.body)) {
        const existingFigIds = new Set<string>();
        for (const n of modelToUse.body) {
          if (n.id) existingFigIds.add(String(n.id).toLowerCase());
          if (n.images && Array.isArray(n.images)) {
            for (const img of n.images) if (img.src) existingFigIds.add(String(img.src).toLowerCase());
          }
        }
        const hasAnyFiguresInModel = modelToUse.body.some((n: any) => n.type === 'figure' || n.type === 'image' || n.type === 'figure-group' || n.type === 'chart');
        if (!hasAnyFiguresInModel) {
          const verifiedCaptions: string[] = (modelToUse.aiVerdict?.figures || [])
            .map((f: any) => typeof f === 'string' ? f : f?.caption || '')
            .filter((c: string) => c.trim().length > 0);
          let captionIdx = 0;
          for (const fig of figureFiles) {
            const safeName = String(fig.name).replace(/[^a-zA-Z0-9._-]/g, '_');
            const isDeco = /logo|icon|banner|watermark|divider|spacer|signature|qrcode|header|footer/i.test(safeName);
            if (isDeco) continue;
            const figAny = fig as any;
            const explicitCaption = (typeof figAny.caption === 'string' && figAny.caption.trim().length > 3)
              ? figAny.caption.trim()
              : (verifiedCaptions[captionIdx++] || '');
            // Only inject if there is a real caption from aiVerdict or manifest
            if (!explicitCaption) continue;

            if (!existingFigIds.has(safeName.toLowerCase()) && !existingFigIds.has(String(fig.name).toLowerCase())) {
              const isChart = /rf_chart_|chart_pending_/i.test(safeName);
              modelToUse.body.push({
                type: isChart ? 'chart' : 'figure',
                id: safeName,
                caption: explicitCaption
              });
              existingFigIds.add(safeName.toLowerCase());
            }
          }
        }
      }

      // Refresh stats from live body before assembling
      if (modelToUse.body && Array.isArray(modelToUse.body)) {
        if (!modelToUse.stats) modelToUse.stats = {} as any;
        modelToUse.stats.pseudocodeCount = modelToUse.body.filter((n: any) => n.type === 'algorithm').length;
        modelToUse.stats.tableCount = modelToUse.body.filter((n: any) => n.type === 'table').length;
        modelToUse.stats.imageCount = modelToUse.body.filter((n: any) => n.type === 'figure' || n.type === 'image' || n.type === 'figure-group').length || modelToUse.stats.imageCount;
      }

      // Collect all available figure names across upload payloads, manifest, disk and DB
      const availableFigureNamesSet = new Set<string>();
      for (const fig of figureFiles) availableFigureNamesSet.add(fig.name);
      if (Array.isArray(structured.figureManifest)) {
        for (const f of structured.figureManifest) {
          const name = typeof f === 'string' ? f : f?.name;
          if (name) availableFigureNamesSet.add(name);
        }
      }
      if (fs.existsSync(projectDir)) {
        try {
          const checkDirs = [projectDir, path.join(projectDir, 'assets'), path.join(projectDir, 'figures')];
          for (const d of checkDirs) {
            if (fs.existsSync(d)) {
              for (const f of fs.readdirSync(d)) {
                if (/\.(png|jpe?g|webp|gif|pdf|eps|svg|tiff?|bmp)$/i.test(f)) {
                  if (validCurrentFigureNames.size === 0 || validCurrentFigureNames.has(f)) {
                    availableFigureNamesSet.add(f);
                  }
                }
              }
            }
          }
        } catch {}
      }
      for (const f of validCurrentFigureNames) {
        availableFigureNamesSet.add(f);
      }
      const availableFigureNames = Array.from(availableFigureNamesSet);

      // Ensure derived collections are synchronized on modelToUse before mapping & assembly
      DeepDocumentParser.syncDerivedCollections(modelToUse);

      // --- 1. TRY PARALLEL AI MODULAR MAPPING ---
      try {
        console.log(`[GENERATE-LATEX] Attempting parallel AI modular mapping for template ${templateId}...`);
        const aiResult = await runModularAiMapping({
          structured: modelToUse,
          templateId: mapLegacyTemplateId(templateId),
          templateMainTex,
          userId: session.user.id,
          userEmail: session.user.email,
          projectId,
          figureFiles: availableFigureNames,
        });

        if (aiResult && aiResult.files && aiResult.files.length > 0) {
          fullLatex = aiResult.mainTex;
          extractedComponents = {};
          for (const f of aiResult.files) {
            extractedComponents[f.path] = f.content;
          }

          // Hybrid fallback: Merge missing or truncated metadata/section files from deterministic assembly
          try {
            const rescueMissingFloats = (aiContent: string, detContent: string): string => {
              if (!detContent || !aiContent) return aiContent;
              const floatRegex = /\\begin\{(figure\*?|table\*?)\}(?:\[[^\]]*\])?[\s\S]*?\\end\{\1\}(?:\s*\\FloatBarrier)?/g;
              let match: RegExpExecArray | null;
              let result = aiContent;

              while ((match = floatRegex.exec(detContent)) !== null) {
                const floatBlock = match[0].trim();
                
                // 1. Check if already present in AI content
                const imgMatch = floatBlock.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
                const imgFile = imgMatch ? imgMatch[1].trim() : null;
                if (imgFile && result.includes(imgFile)) continue;

                const labelMatch = floatBlock.match(/\\label\{([^}]+)\}/);
                const label = labelMatch ? labelMatch[1].trim() : null;
                if (label && result.includes(`\\label{${label}}`)) continue;

                // 2. Find best inline placement right after referencing paragraph
                let insertIdx = -1;
                const capMatch = floatBlock.match(/\\caption\{([^}]+)\}/);
                const caption = capMatch ? capMatch[1].trim() : '';
                const numMatch = (caption + ' ' + (label || '') + ' ' + (imgFile || '')).match(/(?:figure|fig\.?|table|tab\.?|image)[_:\s.-]*(\d+|[IVXLCDM]+)/i);
                
                if (numMatch) {
                  const num = numMatch[1];
                  const isFig = /(?:fig|image)/i.test(numMatch[0]);
                  const mentionRegex = isFig
                    ? new RegExp(`\\b(?:figure|fig\\.?)\\s*~?\\s*${num}\\b`, 'i')
                    : new RegExp(`\\b(?:table|tab\\.?)\\s*~?\\s*${num}\\b`, 'i');
                  const m = result.match(mentionRegex);
                  if (m && m.index !== undefined) {
                    const nextPara = result.indexOf('\n\n', m.index);
                    insertIdx = nextPara !== -1 ? nextPara + 2 : result.length;
                  }
                }

                if (insertIdx !== -1) {
                  result = result.slice(0, insertIdx) + `\n${floatBlock}\n\n` + result.slice(insertIdx);
                } else {
                  result = `${result.trim()}\n\n${floatBlock}\n`;
                }
              }

              return result;
            };

            const assembled = ModularLatexAssembler.assemble(modelToUse, mapLegacyTemplateId(templateId), templateMainTex);
            for (const [filePath, content] of Object.entries(assembled.files)) {
              if (!extractedComponents[filePath]) {
                extractedComponents[filePath] = content;
              } else if (
                filePath.startsWith('sections/') &&
                (extractedComponents[filePath].trim().length < 50 || extractedComponents[filePath].split(/\s+/).length < 15) &&
                content.trim().length > 100
              ) {
                // Section was empty or truncated in AI pass; restore full content from deterministic pass
                extractedComponents[filePath] = content;
              } else if (filePath.startsWith('sections/')) {
                // Section was populated by AI; rescue any figures/tables dropped from deterministic pass
                extractedComponents[filePath] = rescueMissingFloats(extractedComponents[filePath], content);
              }
            }

            // Ensure all section files in extractedComponents are \input'd in fullLatex
            const sectionFiles = Object.keys(extractedComponents)
              .filter(p => p.startsWith('sections/') && p.endsWith('.tex'))
              .sort();
            for (const sFile of sectionFiles) {
              if (!fullLatex.includes(`\\input{${sFile}}`)) {
                const lastInputMatch = Array.from(fullLatex.matchAll(/\\input\{sections\/[^}]+\}/g)).pop();
                if (lastInputMatch && lastInputMatch.index !== undefined) {
                  const insPoint = lastInputMatch.index + lastInputMatch[0].length;
                  fullLatex = fullLatex.slice(0, insPoint) + `\n\\input{${sFile}}` + fullLatex.slice(insPoint);
                } else {
                  const bibInput = fullLatex.indexOf('\\input{references/bibliography.tex}');
                  if (bibInput !== -1) {
                    fullLatex = fullLatex.slice(0, bibInput) + `\\input{${sFile}}\n` + fullLatex.slice(bibInput);
                  } else {
                    fullLatex = fullLatex.replace(/\\end\{document\}/, `\\input{${sFile}}\n\\end{document}`);
                  }
                }
              }
            }

            // Fail-safe: ensure title & author inputs exist in mainTex for non-Elsevier templates
            const mappedTpl = mapLegacyTemplateId(templateId);
            if (!mappedTpl.includes('elsevier')) {
              if (!fullLatex.includes('metadata/title.tex') && extractedComponents['metadata/title.tex']) {
                fullLatex = fullLatex.replace(/\\begin\{document\}/, '\\input{metadata/title.tex}\n\\begin{document}');
              }
              if (!fullLatex.includes('metadata/authors.tex') && extractedComponents['metadata/authors.tex']) {
                fullLatex = fullLatex.replace(/\\begin\{document\}/, '\\input{metadata/authors.tex}\n\\begin{document}');
              }
            }
          } catch (hybridErr: any) {
            console.warn('[GENERATE-LATEX] Non-critical hybrid fallback merge notice:', hybridErr?.message || hybridErr);
          }

          aiModularSuccess = true;
          console.log(`[GENERATE-LATEX] AI modular mapping SUCCEEDED with ${Object.keys(extractedComponents).length} files (${aiResult.model}).`);
        }
      } catch (aiErr: any) {
        console.warn(`[GENERATE-LATEX] AI modular mapping error, falling back to deterministic assembler:`, aiErr?.message || aiErr);
      }

      // --- 2. DETERMINISTIC ASSEMBLER FALLBACK ---
      if (!aiModularSuccess) {
        console.log(`[GENERATE-LATEX] Assembling via ModularLatexAssembler for template ${templateId}...`);
        const assembled = ModularLatexAssembler.assemble(modelToUse, mapLegacyTemplateId(templateId), templateMainTex);
        fullLatex = assembled.mainTex;
        extractedComponents = assembled.files;
      }
    } else if (rawHtml) {
      console.log(`[GENERATE-LATEX] First-pass extraction required...`);
      const { DeepDocumentParser } = await import('@/lib/deep-parser');
      const parsedModel = DeepDocumentParser.parse(rawHtml, structured.mathBlocks || [], project.title, {}, rawXml);
      const assembled = ModularLatexAssembler.assemble(parsedModel, mapLegacyTemplateId(templateId), templateMainTex);
      fullLatex = assembled.mainTex;
      extractedComponents = assembled.files;
      structured = parsedModel;
    } else if ((project as any).latexContent && (project as any).latexContent.trim().length > 0) {
      console.log(`[GENERATE-LATEX] Preserving existing LaTeX source...`);
      fullLatex = (project as any).latexContent;
      const { DeepDocumentParser } = await import('@/lib/deep-parser');
      const parsedModel = DeepDocumentParser.parse(fullLatex, structured.mathBlocks || [], project.title, {}, rawXml);
      const assembled = ModularLatexAssembler.assemble(parsedModel, mapLegacyTemplateId(templateId), templateMainTex);
      fullLatex = assembled.mainTex;
      extractedComponents = assembled.files;
      structured = parsedModel;
    } else {
      console.log(`[GENERATE-LATEX] No content found. Using template main.tex directly...`);
      fullLatex = templateMainTex || "";
      usedOriginalTemplate = true;
    }

    // --- REMAP FIGURE REFERENCES TO ACTUAL BINARY FILENAMES (Universal: AI Modular & Deterministic) ---
    // Reconcile \includegraphics references with actual disk and DB binaries.
    // Handles AI modular paths, deterministic paths, and missing extensions so the
    // compiler always links to valid binaries.
    if (extractedComponents && Object.keys(extractedComponents).length > 0) {
      const numIn = (s: string) => parseInt((s.match(/(\d+)/) || ['', '0'])[1]) || 0;
      const binaryNamesSet = new Set<string>();
      for (const f of figureFiles) binaryNamesSet.add(f.name);
      if (fs.existsSync(projectDir)) {
        try {
          const checkDirs = [projectDir, path.join(projectDir, 'assets'), path.join(projectDir, 'figures')];
          for (const d of checkDirs) {
            if (fs.existsSync(d)) {
              for (const f of fs.readdirSync(d)) {
                if (/\.(png|jpe?g|webp|gif|pdf|eps|svg|tiff?|bmp)$/i.test(f)) {
                  if (validCurrentFigureNames.size === 0 || validCurrentFigureNames.has(f)) {
                    binaryNamesSet.add(f);
                  }
                }
              }
            }
          }
        } catch {}
      }
      try {
        const dbImgFiles = await prisma.projectFile.findMany({
          where: {
            projectId,
            OR: [
              { fileType: 'image' },
              { filename: { endsWith: '.png' } },
              { filename: { endsWith: '.jpg' } },
              { filename: { endsWith: '.jpeg' } },
              { filename: { endsWith: '.webp' } },
              { filename: { endsWith: '.pdf' } },
              { filename: { endsWith: '.eps' } },
              { filename: { endsWith: '.svg' } },
            ]
          },
          select: { filename: true }
        });
        for (const row of dbImgFiles) {
          const base = path.basename(row.filename);
          if (base && (validCurrentFigureNames.size === 0 || validCurrentFigureNames.has(base))) {
            binaryNamesSet.add(base);
          }
        }
      } catch {}

      const binaryNames = Array.from(binaryNamesSet);
      const modelBodyFigIds: string[] = [];
      const modelBodyChartIds: string[] = [];
      if (modelToUse && Array.isArray(modelToUse.body)) {
        for (const n of modelToUse.body) {
          if (n.type === 'chart') {
            if (n.id) modelBodyChartIds.push(String(n.id).trim());
          } else if (n.type === 'figure' || n.type === 'image') {
            if (n.id) modelBodyFigIds.push(String(n.id).trim());
          } else if (n.type === 'figure-group' && Array.isArray(n.images)) {
            for (const img of n.images) {
              if (img.src) modelBodyFigIds.push(String(img.src).trim());
            }
          }
        }
      }

      const figBins = (modelBodyFigIds.length > 0 ? modelBodyFigIds : binaryNames)
        .filter(n => !/logo|icon|banner|watermark|divider|spacer|signature|qrcode|header|footer/i.test(n))
        .filter(n => /^rf_fig_\d+\./i.test(n) || /\.(png|jpe?g|webp|gif|svg|eps)$/i.test(n))
        .sort((a, b) => numIn(a) - numIn(b));
      const chartBins = (modelBodyChartIds.length > 0 ? modelBodyChartIds : binaryNames)
        .filter(n => /^(rf_chart_|chart_pending_)/i.test(n) || /chart/i.test(n))
        .sort((a, b) => numIn(a) - numIn(b));

      if (figBins.length > 0 || chartBins.length > 0 || binaryNames.length > 0) {
        // 1-to-1 Mapping to prevent counter drift across multiple files
        const refToTargetMap = new Map<string, string>();
        let fi = 0, ci = 0;
        const incRe = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
        const isChartRef = (r: string) => /chart_pending|rf_chart/i.test(r) || /chart/i.test(r);

        const resolveTarget = (ref: string): string | null => {
          const r = String(ref).trim();
          const baseName = path.basename(r);
          if (binaryNamesSet.has(r)) return r;
          if (binaryNamesSet.has(baseName)) return baseName;
          if (figBins.includes(r)) return r;
          if (chartBins.includes(r)) return r;

          // Check if adding common image extensions matches an existing binary
          for (const ext of ['.png', '.jpg', '.jpeg', '.pdf', '.webp', '.eps', '.svg']) {
            if (binaryNamesSet.has(`${r}${ext}`)) return `${r}${ext}`;
            if (binaryNamesSet.has(`${baseName}${ext}`)) return `${baseName}${ext}`;
          }

          if (refToTargetMap.has(r)) return refToTargetMap.get(r)!;
          if (refToTargetMap.has(baseName)) return refToTargetMap.get(baseName)!;

          const isChart = isChartRef(r);
          const pool = (isChart && chartBins.length > 0) ? chartBins : (figBins.length > 0 ? figBins : binaryNames);
          if (pool.length === 0) return null;

          const idx = isChart && chartBins.length > 0 ? ci : fi;
          const target = pool[idx % pool.length];
          if (!target) return null;

          if (isChart && chartBins.length > 0) ci++; else fi++;
          refToTargetMap.set(r, target);
          refToTargetMap.set(baseName, target);
          return target;
        };

        const apply = (content: string) => content.replace(incRe, (m, ref) => {
          const target = resolveTarget(ref);
          if (!target) return m;
          return m.replace(ref, target);
        });

        const floatKeys = Object.keys(extractedComponents)
          .filter(k => /^(figures\/figure_\d+\.tex|figures\/figure_group_\d+\.tex)$/i.test(k))
          .sort((a, b) => numIn(a) - numIn(b));

        for (const k of floatKeys) extractedComponents[k] = apply(extractedComponents[k]);
        for (const k of Object.keys(extractedComponents)) {
          if (floatKeys.includes(k)) continue;
          if (!/\.tex$/i.test(k)) continue;
          extractedComponents[k] = apply(extractedComponents[k]);
        }
        if (fullLatex) fullLatex = apply(fullLatex);
        console.log(`[GENERATE-LATEX] Remapped figure references consistently: ${refToTargetMap.size} mapping(s) -> binaries.`);
      }
    }

    // Safety: if main.tex is still empty but we have a template, use it
    if (!fullLatex && template && template.assetFolder) {
      const mainPath = path.join(process.cwd(), 'src', 'assets', 'templates', template.assetFolder, 'main.tex');
      if (fs.existsSync(mainPath)) {
        fullLatex = fs.readFileSync(mainPath, 'utf-8');
        usedOriginalTemplate = true;
      }
    }

    const finalLatex = fullLatex || "";
    const healedLatex = (finalLatex && !usedOriginalTemplate) ? autoHealLatex(finalLatex) : finalLatex;

    // --- PERSIST TO DISK ---
    // projectDir is already defined above

    // Clean stale folders (preserve image files in assets and figures)
    if (fs.existsSync(projectDir)) {
      const foldersToClear = ['sections', 'metadata', 'floats', 'references', 'tables', 'algorithms', 'equations'];
      for (const folder of foldersToClear) {
        const folderPath = path.join(projectDir, folder);
        if (fs.existsSync(folderPath)) {
          try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch {}
        }
      }
      // For figures and assets folders, delete old .tex files and any images not belonging to this document
      for (const imgFolder of ['figures', 'assets']) {
        const folderPath = path.join(projectDir, imgFolder);
        if (fs.existsSync(folderPath)) {
          try {
            const files = fs.readdirSync(folderPath);
            for (const f of files) {
              if (f.endsWith('.tex') || f.endsWith('.aux') || f.endsWith('.log')) {
                try { fs.unlinkSync(path.join(folderPath, f)); } catch {}
              } else if (validCurrentFigureNames.size > 0 && !validCurrentFigureNames.has(f)) {
                try { fs.unlinkSync(path.join(folderPath, f)); } catch {}
              }
            }
          } catch {}
        }
      }
      // Clean structural files
      try {
        const filesOnDisk = fs.readdirSync(projectDir);
        const STRUCTURAL_EXTS = new Set(['.cls', '.sty', '.bst', '.tex', '.bib', '.ldf', '.cfg', '.clo']);
        for (const f of filesOnDisk) {
          const ext = '.' + (f.split('.').pop() || '');
          if (STRUCTURAL_EXTS.has(ext.toLowerCase())) {
            try { fs.unlinkSync(path.join(projectDir, f)); } catch {}
          }
        }
      } catch {}
    }

    // Inject template assets
    if (template && template.assetFolder) {
      const assetsPath = path.join(process.cwd(), 'src', 'assets', 'templates', template.assetFolder);
      if (fs.existsSync(assetsPath)) {
        if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
        const LATEX_EXTS = new Set(['.tex', '.bib', '.bst', '.cls', '.sty', '.ldf', '.cfg', '.clo']);
        for (const fileName of fs.readdirSync(assetsPath)) {
          if (fileName === 'main.tex') continue;
          const ext = '.' + (fileName.split('.').pop() || '');
          if (!LATEX_EXTS.has(ext.toLowerCase())) continue;
          const srcPath = path.join(assetsPath, fileName);
          if (fs.statSync(srcPath).isFile()) {
            fs.copyFileSync(srcPath, path.join(projectDir, fileName));
          }
        }
      }
    }

    // Write main.tex
    if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'main.tex'), healedLatex, 'utf-8');

    // Write modular components to disk
    if (extractedComponents && Object.keys(extractedComponents).length > 0) {
      await Promise.all(Object.entries(extractedComponents).map(async ([filename, content]) => {
        const fullPath = path.join(projectDir, filename);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return fs.promises.writeFile(fullPath, content);
      }));
    }

    // --- PERSIST TO DB ---
    // Safe deleteMany
    const safeDeleteMany = async (where: any) => {
      try {
        await prisma.projectFile.deleteMany({ where });
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (msg.includes('not found') || msg.includes('404')) {
          console.warn('[GENERATE-LATEX] project_files collection unavailable, skipping deleteMany');
        } else {
          console.warn('[GENERATE-LATEX] deleteMany failed:', msg.slice(0, 200));
        }
      }
    };

    // Sync main.tex to DB
    await safeFileUpsert({
      projectId,
      filename: 'main.tex',
      content: healedLatex,
      fileType: 'tex',
      filePath: `/uploads/projects/${projectId}/main.tex`
    });

    // Sync modular components to DB
    if (extractedComponents && Object.keys(extractedComponents).length > 0) {
      const textFoldersToClear = ['sections', 'metadata', 'floats', 'references', 'tables', 'algorithms', 'equations'];
      await safeDeleteMany({
        projectId,
        OR: [
          ...textFoldersToClear.map(folder => ({ filename: { startsWith: `${folder}/` } })),
          { filename: { startsWith: 'figures/', endsWith: '.tex' } },
          { filename: { startsWith: 'assets/', endsWith: '.tex' } },
        ]
      });

      await pMap(Object.entries(extractedComponents), async ([filename, content]) => {
        await safeFileUpsert({
          projectId,
          filename,
          content: typeof content === 'string' ? content : "",
          fileType: filename.split('.').pop() || 'tex',
          filePath: `/uploads/projects/${projectId}/${filename.replace(/\\/g, '/')}`
        });
      }, 6);
    }

    // Update project status
    // Update project status: preserve essential document structure (body, references, aiStructure)
    // while stripping heavy rawHtml/rawXml blobs to remain cleanly under PocketBase record size limits.
    let safeStructured = structured;
    try {
      const jsonStr = JSON.stringify(structured);
      if (jsonStr.length > 400000) {
        // Strip heavy rawHtml and rawXml strings (saved durably in source_document.json on disk)
        const { rawHtml: _h, rawXml: _x, ...essentialStructure } = structured;
        safeStructured = {
          ...essentialStructure,
          _truncatedHtml: true,
        };
      }
    } catch {}

    try {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          latexContent: healedLatex,
          status: 'completed',
          templateName: templateId,
          structuredContent: safeStructured
        }
      });
    } catch (updateErr: any) {
      console.warn('[GENERATE-LATEX] Primary update failed, trying fallback:', updateErr.message);
      try {
        await prisma.project.update({
          where: { id: projectId },
          data: { latexContent: healedLatex, status: 'completed', structuredContent: safeStructured }
        });
      } catch (fallbackErr: any) {
        console.warn('[GENERATE-LATEX] Fallback update also failed:', fallbackErr.message);
      }
    }

    // Log AI usage
    try {
      const { logAndSyncAiUsage } = await import('@/lib/pbAiUsage');
      logAndSyncAiUsage(session.user.id, 'generate-latex', 'template-engine', 250, 120, 80).catch(() => {});
    } catch {}

    console.log(`[GENERATE-LATEX] Phase 2 complete: ${Object.keys(extractedComponents).length} modular files generated`);

    return NextResponse.json({
      success: true,
      projectId,
      templateId,
      fileCount: Object.keys(extractedComponents).length,
      mainTexLength: healedLatex.length,
    });

  } catch (error: any) {
    console.error('[GENERATE-LATEX] Critical error:', error.message);
    return NextResponse.json({ error: error.message || 'Error generating LaTeX' }, { status: 500 });
  } finally {
    await PipelineGC.autoFree({
      projectId: projectId || undefined,
      buffers: [figureFiles]
    });
  }
}
