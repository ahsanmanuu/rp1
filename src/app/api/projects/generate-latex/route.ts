import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { autoHealLatex } from '@/lib/latex';
import { ModularLatexAssembler } from '@/lib/assembler';
import { runModularAiMapping } from '@/lib/ai-modular-mapping';
import { getTemplateById, mapLegacyTemplateId } from '@/lib/templates/registry';
import { getServerSession } from "@/lib/auth-pb";
import { calculateDocumentStats } from '@/lib/stats';

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
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Accept both multipart (client-carried figures) and legacy JSON bodies.
    // Figures arrive ONLY for client-extracted DOC2LATEX projects; the Phase-1
    // figure manifest (stored in structured.json) names exactly which files may
    // be persisted — anything else is rejected.
    let projectId = '';
    let templateId = '';
    let figureFiles: { name: string; data: Buffer; contentType: string }[] = [];
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

    // --- PERSIST CLIENT-CARRIED FIGURES (multipart) ---
    // For client-extracted DOC2LATEX projects the figure bytes never touched
    // the server at upload time — they are attached here. Only names declared
    // in the Phase-1 figureManifest are accepted; they land in the project
    // ROOT (the assembler/mapping conventions reference ./rf_fig_N.ext), assets/, and figures/.
    if (figureFiles.length > 0) {
      let savedFigures = 0;
      if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
      const assetsSubDir = path.join(projectDir, 'assets');
      const figuresSubDir = path.join(projectDir, 'figures');
      if (!fs.existsSync(assetsSubDir)) fs.mkdirSync(assetsSubDir, { recursive: true });
      if (!fs.existsSync(figuresSubDir)) fs.mkdirSync(figuresSubDir, { recursive: true });

      for (const fig of figureFiles) {
        const safeName = String(fig.name).replace(/[^a-zA-Z0-9._-]/g, '_');
        const ext = path.extname(safeName).toLowerCase();
        const isImage = /\.(png|jpg|jpeg|gif|webp|pdf|svg|eps|tiff?|bmp|heic|heif|avif)$/i.test(ext);
        if (!isImage) continue;

        try {
          fs.writeFileSync(path.join(projectDir, safeName), fig.data);
          fs.writeFileSync(path.join(assetsSubDir, safeName), fig.data);
          fs.writeFileSync(path.join(figuresSubDir, safeName), fig.data);
          savedFigures++;
          const mime = ext === '.jpg' ? 'image/jpeg' : `image/${ext.replace(/^\./, '')}`;
          const b64 = `data:${mime};base64,${fig.data.toString('base64')}`;

          await safeFileUpsert({
            projectId,
            filename: safeName,
            content: b64,
            fileType: 'image',
            filePath: `/uploads/projects/${projectId}/${safeName}`
          });
          await safeFileUpsert({
            projectId,
            filename: `assets/${safeName}`,
            content: b64,
            fileType: 'image',
            filePath: `/uploads/projects/${projectId}/assets/${safeName}`
          });
          await safeFileUpsert({
            projectId,
            filename: `figures/${safeName}`,
            content: b64,
            fileType: 'image',
            filePath: `/uploads/projects/${projectId}/figures/${safeName}`
          });
        } catch (figErr: any) {
          console.warn('[GENERATE-LATEX] Failed to persist figure', safeName, figErr?.message || figErr);
        }
      }
      console.log(`[GENERATE-LATEX] Persisted ${savedFigures} figure(s) to project root, assets, figures, and DB`);
    }

    // --- ASSEMBLE MODULAR LATEX ---
    let modelToUse: any = (structured.body && structured.body.length > 0) ? structured : null;
    let fullLatex = "";
    let extractedComponents: Record<string, string> = {};
    let usedOriginalTemplate = false;

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
        let figAutoSeq = (modelToUse.stats?.imageCount || 0) + 1;
        for (const fig of figureFiles) {
          const safeName = String(fig.name).replace(/[^a-zA-Z0-9._-]/g, '_');
          if (!existingFigIds.has(safeName.toLowerCase()) && !existingFigIds.has(String(fig.name).toLowerCase())) {
            const isChart = /rf_chart_|chart_pending_/i.test(safeName);
            modelToUse.body.push({
              type: isChart ? 'chart' : 'figure',
              id: safeName,
              caption: isChart ? `Chart ${figAutoSeq++}` : `Figure ${figAutoSeq++}`
            });
            existingFigIds.add(safeName.toLowerCase());
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

      let aiModularSuccess = false;
      try {
        console.log(`[GENERATE-LATEX] Attempting Phase 2 AI Modular Mapping for template: ${templateId}...`);
        const aiResult = await runModularAiMapping({
          structured: modelToUse,
          templateId,
          templateMainTex,
          userId: session.user.id,
          userEmail: session.user.email,
          projectId
        });
        if (aiResult && aiResult.files && aiResult.files.length > 0) {
          fullLatex = aiResult.mainTex;
          extractedComponents = {};
          for (const f of aiResult.files) {
            extractedComponents[f.path] = f.content;
          }
          aiModularSuccess = true;
          console.log(`[GENERATE-LATEX] AI Modular Mapping succeeded with ${aiResult.files.length} files (${aiResult.model})`);
        }
      } catch (aiErr: any) {
        console.warn(`[GENERATE-LATEX] AI Modular Mapping failed, falling back:`, aiErr?.message || aiErr);
      }

      if (!aiModularSuccess) {
        console.log(`[GENERATE-LATEX] Assembling via deterministic ModularLatexAssembler...`);
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

    // --- REMAP FIGURE REFERENCES TO ACTUAL BINARY FILENAMES ---
    // DeepDocumentParser stamps figure ids as `pdf_fig_<lineNumber>.png` and charts as
    // `chart_pending_<N>.png`, while the real binaries uploaded from the client
    // are named `rf_fig_<seq>.png` / `rf_chart_<seq>.png`.
    // Remap each reference (in document/float order) to the matching binary.
    if (extractedComponents && Object.keys(extractedComponents).length > 0) {
      const numIn = (s: string) => parseInt((s.match(/(\d+)/) || ['', '0'])[1]) || 0;
      const binaryNamesSet = new Set<string>();
      for (const f of figureFiles) binaryNamesSet.add(f.name);
      if (fs.existsSync(projectDir)) {
        try {
          const rootFiles = fs.readdirSync(projectDir);
          for (const f of rootFiles) {
            if (/\.(png|jpe?g|webp|gif|pdf|eps|svg|tiff?|bmp)$/i.test(f)) binaryNamesSet.add(f);
          }
          const assetsDir = path.join(projectDir, 'assets');
          if (fs.existsSync(assetsDir)) {
            for (const f of fs.readdirSync(assetsDir)) {
              if (/\.(png|jpe?g|webp|gif|pdf|eps|svg|tiff?|bmp)$/i.test(f)) binaryNamesSet.add(f);
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
          if (base) binaryNamesSet.add(base);
        }
      } catch {}

      const binaryNames = Array.from(binaryNamesSet);
      const figBins = binaryNames.filter(n => /^rf_fig_\d+\./i.test(n)).sort((a, b) => numIn(a) - numIn(b));
      const chartBins = binaryNames.filter(n => /^(rf_chart_|chart_pending_)/i.test(n)).sort((a, b) => numIn(a) - numIn(b));
      if (figBins.length === 0 && binaryNames.length > 0) {
        figBins.push(...binaryNames.filter(n => /\.(png|jpe?g|webp|gif|svg|eps)$/i.test(n)));
      }

      if (figBins.length > 0 || chartBins.length > 0) {
        let fi = 0, ci = 0;
        const incRe = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
        const isChartRef = (r: string) => /chart_pending|rf_chart/i.test(r) || /chart/i.test(r);
        const floatKeys = Object.keys(extractedComponents)
          .filter(k => /^(figures\/figure_\d+\.tex|figures\/figure_group_\d+\.tex)$/i.test(k))
          .sort((a, b) => numIn(a) - numIn(b));
        const apply = (content: string) => content.replace(incRe, (m, ref) => {
          const r = String(ref).trim();
          if (/^rf_/i.test(r) && (figBins.includes(r) || chartBins.includes(r))) return m; // already correct
          const isChart = isChartRef(r);
          const pool = (isChart && chartBins.length > 0) ? chartBins : figBins;
          const idx = isChart && chartBins.length > 0 ? ci : fi;
          const target = pool[idx % pool.length];
          if (!target) return m;
          if (isChart && chartBins.length > 0) ci++; else fi++;
          return m.replace(ref, target);
        });
        for (const k of floatKeys) extractedComponents[k] = apply(extractedComponents[k]);
        for (const k of Object.keys(extractedComponents)) {
          if (floatKeys.includes(k)) continue;
          if (!/\.tex$/i.test(k)) continue;
          extractedComponents[k] = apply(extractedComponents[k]);
        }
        console.log(`[GENERATE-LATEX] Remapped figure references: ${fi} figure(s), ${ci} chart(s) -> binaries (figBins=${figBins.length}, chartBins=${chartBins.length}).`);
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
      // For figures and assets folders, only delete old .tex files, never delete image files!
      for (const imgFolder of ['figures', 'assets']) {
        const folderPath = path.join(projectDir, imgFolder);
        if (fs.existsSync(folderPath)) {
          try {
            const files = fs.readdirSync(folderPath);
            for (const f of files) {
              if (f.endsWith('.tex') || f.endsWith('.aux') || f.endsWith('.log')) {
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

      for (const [filename, content] of Object.entries(extractedComponents)) {
        await safeFileUpsert({
          projectId,
          filename,
          content: typeof content === 'string' ? content : "",
          fileType: filename.split('.').pop() || 'tex',
          filePath: `/uploads/projects/${projectId}/${filename.replace(/\\/g, '/')}`
        });
      }
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
  }
}
