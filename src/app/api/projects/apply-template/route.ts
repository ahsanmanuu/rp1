import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { autoHealLatex } from '@/lib/latex';
import { DeepDocumentParser } from '@/lib/deep-parser';
import { ModularLatexAssembler } from '@/lib/assembler';
import { getTemplateById, mapLegacyTemplateId } from '@/lib/templates/registry';

import { getServerSession } from "@/lib/auth-pb";
interface StructuredContent {
  title?: string;
  authors?: any[];
  affiliations?: string[];
  abstract?: string;
  keywords?: string[];
}



function escapeForTemplate(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/\\/g, '\\textbackslash ')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\^/g, '\\textasciicircum ')
    .replace(/~/g, '\\textasciitilde ');
}

function formatAuthorsForTemplate(templateId: string, authors: any[]): string {
  if (!authors || authors.length === 0) return "";
  
  const id = mapLegacyTemplateId(templateId);
  const names = authors.map(a => {
    if (typeof a === 'string') return a;
    return a.name || a.text || "Author";
  });
  
  switch (id) {
    case 'article_ieee':
      return `\\author{${names.join(', ')}}`;
    case 'article_acm':
      return names.map(n => `\\author{${n}}`).join('\n');
    case 'article_elsevier':
      return names.map(n => `\\author{${n}}`).join('\n');
    case 'article_lncs':
      return `\\author{${names.join(' \\and ')}}`;
    case 'article_scirep':
      return names.map(n => `\\author{${n}}`).join('\n'); // wlscirep uses authblk style formatting in assembler
    default:
      return `\\author{${names.join(', ')}}`;
  }
}

// --- LEGACY TEMPLATE WRAPPERS DEPRECATED IN FAVOR OF UNIVERSAL ASSEMBLER ---

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { projectId, templateId } = await req.json();

    if (!projectId || !templateId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const template = getTemplateById(mapLegacyTemplateId(templateId));

    // --- EXTRACT METADATA FROM STRUCTURED CONTENT (Source of Truth) ---
    let meta: StructuredContent = {};
    try {
      const parsed = JSON.parse((project as any).structuredContent || '{}');
      meta = {
        title: escapeForTemplate(String(parsed.title || project.title || "")),
        authors: Array.isArray(parsed.authors) ? parsed.authors : [],
        affiliations: Array.isArray(parsed.affiliations) ? parsed.affiliations : [],
        abstract: escapeForTemplate(String(parsed.abstract || "")),
        keywords: Array.isArray(parsed.keywords) ? (parsed.keywords as string[]).map(k => escapeForTemplate(k)) : [],
      };
    } catch {
      console.warn('Failed to parse structuredContent, using defaults');
    }

    // --- RECOVERY ENGINE: Resolve the 'Source of Truth' ---
    let structured: any = {};
    try {
      structured = JSON.parse((project as any).structuredContent || '{}');
    } catch {
      console.warn('Failed to parse structuredContent');
    }

    const rawHtml = structured.rawHtml || project.content || "";
    const rawXml = structured.rawXml || "";

    // --- UNIVERSAL MAPPING LOGIC (Tier 1: Model-First Preservation) ---
    console.time(`[LATEX_SYNC] ${projectId}`);
    let fullLatex = "";
    let extractedComponents: Record<string, string> = {};
    
    // The "Structured Content" in DB is our "Local Memory" / Source of Truth.
    // We assemble from this MODEL to ensure no components are lost due to re-parsing noise.
    let modelToUse: any = (structured.body && structured.body.length > 0) ? structured : null;

    let templateMainTex: string | undefined = undefined;
    if (template && template.assetFolder) {
        const mainPath = path.join(process.cwd(), 'src', 'assets', 'templates', template.assetFolder, 'main.tex');
        if (fs.existsSync(mainPath)) {
            templateMainTex = fs.readFileSync(mainPath, 'utf-8');
        }
    }

    if (modelToUse) {
        console.log(`[LATEX_SYNC] Assembling from Structured Model (Local Memory Preservation)...`);
        
        // Sync metadata from request or DB before assembly
        modelToUse.title = meta.title || modelToUse.title;
        modelToUse.abstract = meta.abstract || modelToUse.abstract;
        if (meta.keywords && meta.keywords.length > 0) modelToUse.keywords = meta.keywords;
        if (meta.authors && meta.authors.length > 0) modelToUse.authors = meta.authors;

        // OPTION B: AUTO RE-PARSE — Detect stale algorithm nodes (section headings misclassified as algorithms)
        const SECTION_NAMES_SET = new Set([
          'introduction','methodology','methods','results','discussion','conclusion','conclusions',
          'abstract','background','related work','experiments','experimental setup','references',
          'acknowledgements','acknowledgments','literature review','future work','appendix',
          // Universal literature survey variants (without bias to any specific document)
          'literature survey','literature review/survey','survey','literature review and survey',
          'related works','existing literature','literature','overview',
        ]);
        const staleAlgoNodes = (modelToUse.body || []).filter((n: any) => {
          if (n.type !== 'algorithm') return false;
          const steps = n.items || n.steps || [];
          if (steps.length > 0) return false;
          const title = (n.title || n.text || '').toLowerCase().replace(/^\d+[\s.]+/, '').trim();
          return SECTION_NAMES_SET.has(title);
        });

        if (staleAlgoNodes.length > 0 && rawHtml) {
          console.log(`[LATEX_SYNC] Stale algorithm nodes detected (${staleAlgoNodes.length}). Triggering auto re-parse with updated parser...`);
          const groundTruth = { imageCount: (modelToUse.stats?.imageCount) || 0 };
          const freshModel = DeepDocumentParser.parse(rawHtml, structured.mathBlocks || [], project.title, groundTruth, rawXml);
          // Preserve any user-edited metadata from the stale model
          freshModel.title = modelToUse.title || freshModel.title;
          if (modelToUse.authors?.length > 0) freshModel.authors = modelToUse.authors;
          if (modelToUse.abstract) freshModel.abstract = modelToUse.abstract;
          if (modelToUse.keywords?.length > 0) freshModel.keywords = modelToUse.keywords;
          modelToUse = freshModel;
          structured = freshModel;
          console.log(`[LATEX_SYNC] Re-parse complete. Algorithm nodes after fix: ${(freshModel.body || []).filter((n: any) => n.type === 'algorithm').length}`);
        }

        // Refresh stats from live body before assembling (prevents stale pseudocodeCount)
        if (modelToUse.body && Array.isArray(modelToUse.body)) {
          if (!modelToUse.stats) modelToUse.stats = {} as any;
          modelToUse.stats.pseudocodeCount = modelToUse.body.filter((n: any) => n.type === 'algorithm').length;
          modelToUse.stats.tableCount = modelToUse.body.filter((n: any) => n.type === 'table').length;
          modelToUse.stats.imageCount = modelToUse.body.filter((n: any) => n.type === 'figure' || n.type === 'image' || n.type === 'figure-group').length || modelToUse.stats.imageCount;
        }

        const assembled = ModularLatexAssembler.assemble(modelToUse, mapLegacyTemplateId(templateId), templateMainTex);
        fullLatex = assembled.mainTex;
        extractedComponents = assembled.files;
    } else if (rawHtml) {
        console.log(`[LATEX_SYNC] Initial Extraction required (First-pass)...`);
        const parsedModel = DeepDocumentParser.parse(rawHtml, structured.mathBlocks || [], project.title, {}, rawXml);
        const assembled = ModularLatexAssembler.assemble(parsedModel, mapLegacyTemplateId(templateId), templateMainTex);
        fullLatex = assembled.mainTex;
        extractedComponents = assembled.files;
        structured = parsedModel;
    } else {
        console.log(`[LATEX_SYNC] No content found. Using template main.tex directly without further synthesis/processing...`);
        fullLatex = templateMainTex || "";
        extractedComponents = {};
        structured = {};
    }
    
    // Safety check: if main.tex is still empty but we have a main.tex in assets, use it
    if (!fullLatex && template && template.assetFolder) {
        const mainPath = path.join(process.cwd(), 'src', 'assets', 'templates', template.assetFolder, 'main.tex');
        if (fs.existsSync(mainPath)) {
            console.log(`[LATEX_SYNC] Main file still empty. Falling back to template main.tex...`);
            fullLatex = fs.readFileSync(mainPath, 'utf-8');
        }
    }

    console.timeEnd(`[LATEX_SYNC] ${projectId}`);

    // Clean up stale physical files/folders from process disk before injecting new template assets
    const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
    if (fs.existsSync(projectDir)) {
      console.log(`[LATEX_SYNC] Clearing stale physical files for project ${projectId} to prevent template collisions...`);
      const foldersToClear = ['sections', 'metadata', 'floats', 'references', 'figures', 'tables', 'algorithms', 'equations', 'assets'];
      for (const folder of foldersToClear) {
        const folderPath = path.join(projectDir, folder);
        if (fs.existsSync(folderPath)) {
          fs.rmSync(folderPath, { recursive: true, force: true });
        }
      }
      
      const filesOnDisk = fs.readdirSync(projectDir);
      const STRUCTURAL_EXTS = new Set(['.cls', '.sty', '.bst', '.tex', '.bib', '.ldf', '.cfg', '.clo']);
      for (const fileOnDisk of filesOnDisk) {
        const ext = '.' + (fileOnDisk.split('.').pop() || '');
        if (STRUCTURAL_EXTS.has(ext.toLowerCase())) {
          try {
            fs.unlinkSync(path.join(projectDir, fileOnDisk));
          } catch {
            console.warn(`[LATEX_SYNC] Could not delete disk file: ${fileOnDisk}`);
          }
        }
      }
    }

    // --- ASSET INJECTION (Template Specific Auxiliary Files) ---
    // --- ASSET INJECTION (Automated Asset Provisioning) ---

    
    if (template && template.assetFolder) {
        // ... Existing logic for builtin templates ...
        const assetsPath = path.join(process.cwd(), 'src', 'assets', 'templates', template.assetFolder);
        
        if (fs.existsSync(assetsPath)) {
            if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
            const LATEX_EXTS = new Set(['.tex', '.bib', '.bst', '.cls', '.sty', '.ldf', '.cfg', '.clo']);
            const filesToInject = fs.readdirSync(assetsPath);
            for (const fileName of filesToInject) {
                // Skip main.tex — written below with assembled content
                if (fileName === 'main.tex') continue;
                const ext = '.' + (fileName.split('.').pop() || '');
                // Skip non-LaTeX files (images, PDFs, etc.)
                if (!LATEX_EXTS.has(ext.toLowerCase())) continue;
                const srcPath = path.join(assetsPath, fileName);
                const destPath = path.join(projectDir, fileName);
                if (fs.statSync(srcPath).isFile()) {
                    fs.copyFileSync(srcPath, destPath);
                    const content = fs.readFileSync(srcPath, 'utf-8');
                    const existingAux = await prisma.projectFile.findFirst({ where: { projectId, filename: fileName }});
                    if (existingAux) {
                        await prisma.projectFile.update({ where: { id: existingAux.id }, data: { content, filePath: `/uploads/projects/${projectId}/${fileName}` }});
                    } else {
                        await prisma.projectFile.create({ data: { projectId, filename: fileName, content, fileType: fileName.split('.').pop() || 'tex', filePath: `/uploads/projects/${projectId}/${fileName}` }});
                    }
                }
            }
        }
    } else {
        // --- CHECK IF IT'S A CUSTOM TEMPLATE FROM DATABASE ---
        const customTemplate = await prisma.template.findUnique({
            where: { id: templateId }
        });

        if (customTemplate && customTemplate.assetsJson) {
            console.log(`[LATEX_SYNC] Injecting custom assets for template: ${customTemplate.name}`);
            const assetsMap = JSON.parse(customTemplate.assetsJson as string);
            if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

            for (const [fileName, content] of Object.entries(assetsMap)) {
                // 1. Write to Physical Disk
                const destPath = path.join(projectDir, fileName);
                const isBase64 = String(content).startsWith('data:');
                
                if (isBase64) {
                    const base64Data = String(content).split(',')[1];
                    fs.writeFileSync(destPath, Buffer.from(base64Data, 'base64'));
                } else {
                    fs.writeFileSync(destPath, String(content), 'utf-8');
                }

                // 2. Sync to Database
                const existingAux = await prisma.projectFile.findFirst({
                    where: { projectId, filename: fileName }
                });

                if (existingAux) {
                    await prisma.projectFile.update({
                        where: { id: existingAux.id },
                        data: { content: isBase64 ? '' : String(content), filePath: `/uploads/projects/${projectId}/${fileName}` }
                    });
                } else {
                    await prisma.projectFile.create({
                        data: {
                            projectId,
                            filename: fileName,
                            content: isBase64 ? '' : String(content),
                            fileType: fileName.split('.').pop() || 'tex',
                            filePath: `/uploads/projects/${projectId}/${fileName}`
                        }
                    });
                }
            }
        }
    }

    const finalLatex = fullLatex || "";
    const healedLatex = finalLatex ? autoHealLatex(finalLatex) : "";

    // Update project with the template and refreshed statistics
    // PB JSON fields expect raw objects, not strings. status must be a valid PB select value.
    try {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          latexContent: healedLatex,
          status: 'completed',
          templateName: templateId,
          structuredContent: structured
        }
      });
    } catch (updateErr: any) {
      console.warn('[TEMPLATE] Primary update failed, trying fallback without templateName:', updateErr.message);
      try {
        await prisma.project.update({
          where: { id: projectId },
          data: {
            latexContent: healedLatex,
            status: 'completed',
            structuredContent: structured
          }
        });
      } catch (fallbackErr: any) {
        console.warn('[TEMPLATE] Fallback update also failed, continuing with disk write only:', fallbackErr.message);
      }
    }

    // CRITICAL: Write main.tex to disk for physical compilers
    if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
    const mainTexPath = path.join(projectDir, 'main.tex');
    fs.writeFileSync(mainTexPath, healedLatex, 'utf-8');

    // CRITICAL: Sync main.tex to ProjectFile table so IDEs can sync
    const existingFile = await prisma.projectFile.findFirst({
      where: { 
        projectId, 
        filename: 'main.tex' 
      }
    });

    if (existingFile) {
      await prisma.projectFile.update({
        where: { id: existingFile.id },
        data: {
          content: healedLatex,
          fileType: 'tex',
          filePath: `/uploads/projects/${projectId}/main.tex`
        }
      });
    } else {
      await prisma.projectFile.create({
        data: {
          projectId,
          filename: 'main.tex',
          content: healedLatex,
          fileType: 'tex',
          filePath: `/uploads/projects/${projectId}/main.tex`
        }
      });
    }
    
    // --- PERSIST MODULAR COMPONENTS ---
    if (extractedComponents && Object.keys(extractedComponents).length > 0) {
        console.log(`[LATEX_SYNC] Persisting ${Object.keys(extractedComponents).length} modular components for project ${projectId}`);
        
        const componentEntries = Object.entries(extractedComponents);
        
        // 1. Physical Write (Disk)
        await Promise.all(componentEntries.map(async ([filename, content]) => {
            const fullPath = path.join(projectDir, filename);
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            return fs.promises.writeFile(fullPath, content);
        }));

        // 2. Database Sync (IDB/StudioFS)
        // To avoid duplicates or stale files, we first delete existing components that are being overwritten
        // or we can just upsert. But since we might have renamed sections, it's better to clear old ones
        // that are in the same folders we are now populating.
        const foldersToClear = ['sections', 'metadata', 'floats', 'references', 'figures', 'tables', 'algorithms', 'equations', 'assets'];
        await prisma.projectFile.deleteMany({
            where: {
                projectId,
                OR: foldersToClear.map(folder => ({ filename: { startsWith: `${folder}/` } }))
            }
        });

        // 3. Upsert individually
        const componentData = componentEntries.map(([filename, content]) => ({
            projectId,
            filename,
            filePath: `/uploads/projects/${projectId}/${filename.replace(/\\/g, '/')}`,
            fileType: filename.split('.').pop() || 'tex',
            content: typeof content === 'string' ? content : ""
        }));

        for (const comp of componentData) {
            const existing = await prisma.projectFile.findFirst({
                where: { projectId: comp.projectId, filename: comp.filename }
            });
            if (existing) {
                await prisma.projectFile.update({
                    where: { id: existing.id },
                    data: comp
                });
            } else {
                await prisma.projectFile.create({
                    data: comp
                });
            }
        }
    }
    
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('--- CRITICAL TEMPLATE ERROR ---');
    console.error('Message:', error.message);
    console.error('Stack Trace:', error.stack);
    console.error('-----------------------------');
    return NextResponse.json({ error: error.message || 'Error applying template', stack: error.stack }, { status: 500 });
  }
}
