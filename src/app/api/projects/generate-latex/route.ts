import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { autoHealLatex } from '@/lib/latex';
import { ModularLatexAssembler } from '@/lib/assembler';
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
      for (const [key, value] of formData.entries()) {
        if (key === 'figures' && value instanceof File) {
          figureFiles.push({
            name: value.name,
            data: Buffer.from(await value.arrayBuffer()),
            contentType: value.type || 'application/octet-stream',
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

    // --- PERSIST CLIENT-CARRIED FIGURES (multipart) ---
    // For client-extracted DOC2LATEX projects the figure bytes never touched
    // the server at upload time — they are attached here. Only names declared
    // in the Phase-1 figureManifest are accepted; they land in the project
    // ROOT (the assembler/mapping conventions reference ./rf_fig_N.ext).
    if (figureFiles.length > 0) {
      const manifestNames = new Set(
        (Array.isArray(structured.figureManifest) ? structured.figureManifest : [])
          .map((f: any) => f && f.name ? String(f.name) : '')
          .filter(Boolean)
      );
      let savedFigures = 0;
      let rejectedFigures = 0;
      if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
      for (const fig of figureFiles) {
        const safeName = String(fig.name).replace(/[^a-zA-Z0-9._-]/g, '_');
        if (manifestNames.size > 0 && !manifestNames.has(fig.name) && !manifestNames.has(safeName)) {
          rejectedFigures++;
          console.warn(`[GENERATE-LATEX] Rejected off-manifest figure: ${fig.name}`);
          continue;
        }
        try {
          fs.writeFileSync(path.join(projectDir, safeName), fig.data);
          savedFigures++;
        } catch (figErr: any) {
          console.warn('[GENERATE-LATEX] Failed to persist figure', safeName, figErr?.message || figErr);
        }
      }
      console.log(`[GENERATE-LATEX] Persisted ${savedFigures} figure(s) to project root (${rejectedFigures} rejected off-manifest)`);
    }

    // --- ASSEMBLE MODULAR LATEX ---
    let modelToUse: any = (structured.body && structured.body.length > 0) ? structured : null;
    let fullLatex = "";
    let extractedComponents: Record<string, string> = {};
    let usedOriginalTemplate = false;

    if (modelToUse) {
      // ── AI MODULAR MAPPING (doc2latex-modular agent) ──────────────────
      // Client-extracted DOC2LATEX projects get three scoped AI passes
      // (floats/sections/metadata) producing modular .tex files + a
      // deterministically composed main.tex. No aiVerdict required — the
      // AI mapping builds its own verdict from the structured body.
      // Any failure falls through to the deterministic assembler.
      let usedAiModular = false;
      const projectType = String(structured.projectType || (project as any).projectType || '');
      const isDoc2Latex = projectType === 'DOC2LATEX' ||
        (Array.isArray(modelToUse.body) && modelToUse.body.length > 0 &&
         (modelToUse.body.some((n: any) => n.type === 'heading' || n.type === 'figure' || n.type === 'table' || n.type === 'algorithm')));
      if (isDoc2Latex) {
        try {
          const { runModularAiMapping } = await import('@/lib/ai-modular-mapping');
          const mapped = await runModularAiMapping({
            structured: modelToUse,
            templateId: mapLegacyTemplateId(templateId),
            templateMainTex,
            userId: session.user.id,
            userEmail: session.user.email || undefined,
            projectId,
          });
          if (mapped) {
            fullLatex = mapped.mainTex;
            extractedComponents = Object.fromEntries(mapped.files.map((f) => [f.path, f.content]));
            usedAiModular = true;
            console.log(`[GENERATE-LATEX] AI modular mapping produced ${mapped.files.length} file(s) (model ${mapped.model}, ${mapped.rejected} rejected)`);
          } else {
            console.warn('[GENERATE-LATEX] AI modular mapping returned no viable files — using deterministic assembler.');
          }
        } catch (modularErr: any) {
          console.warn('[GENERATE-LATEX] AI modular mapping failed, falling back to assembler:', modularErr?.message || modularErr);
        }
      }

      if (!usedAiModular) {
        console.log(`[GENERATE-LATEX] Assembling from Structured Model...`);

      // Refresh stats from live body before assembling
      if (modelToUse.body && Array.isArray(modelToUse.body)) {
        if (!modelToUse.stats) modelToUse.stats = {} as any;
        modelToUse.stats.pseudocodeCount = modelToUse.body.filter((n: any) => n.type === 'algorithm').length;
        modelToUse.stats.tableCount = modelToUse.body.filter((n: any) => n.type === 'table').length;
        modelToUse.stats.imageCount = modelToUse.body.filter((n: any) => n.type === 'figure' || n.type === 'image' || n.type === 'figure-group').length || modelToUse.stats.imageCount;
      }

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

    // Clean stale folders
    if (fs.existsSync(projectDir)) {
      const foldersToClear = ['sections', 'metadata', 'floats', 'references', 'figures', 'tables', 'algorithms', 'equations', 'assets'];
      for (const folder of foldersToClear) {
        const folderPath = path.join(projectDir, folder);
        if (fs.existsSync(folderPath)) {
          try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch {}
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
    // Safe upsert helper
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
      const foldersToClear = ['sections', 'metadata', 'floats', 'references', 'figures', 'tables', 'algorithms', 'equations', 'assets'];
      await safeDeleteMany({
        projectId,
        OR: foldersToClear.map(folder => ({ filename: { startsWith: `${folder}/` } }))
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
