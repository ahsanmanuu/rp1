/**
 * Phase 2 — AI MODULAR LATEX MAPPING for client-extracted DOC2LATEX projects.
 *
 * After template selection, this module asks the doc2latex-modular agent to
 * WRITE the entire modular LaTeX document for a manuscript:
 *
 *   - 'floats'   pass  → one validated float file per verified figure/chart/
 *                        table/algorithm (captions verbatim, images mapped by
 *                        the figure manifest names)
 *   - 'sections' pass  → sections/NN_slug.tex, headings verbatim, \cite keys
 *                        mapped to the bibliography, floats wired in via
 *                        \input{floats/...}
 *   - 'metadata' pass  → metadata title/authors/abstract/keywords + the
 *                        references/bibliography.tex (thebibliography)
 *
 * For large documents (>150K chars), the sections scope splits into chunked
 * sub-passes so the AI can generate complete section files without hitting
 * output token limits.
 *
 * Every emitted file is machine-verified and main.tex is composed
 * DETERMINISTICALLY from the template preamble.
 */

import { routeToAgent } from './agent-gateway';
import { normalizeModularFiles, type AiModularFile } from './latex-fragment-validator';

export interface ModularMappingInput {
  structured: Record<string, any>;
  templateId: string;
  templateMainTex?: string;
  userId?: string | null;
  userEmail?: string | null;
  projectId?: string;
}

export interface ModularMappingResult {
  mainTex: string;
  files: AiModularFile[];
  model: string;
  rejected: number;
}

const HAS_STRONG_PROVIDER = !!(process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY);
// Generous windows — a 20MB doc has ~3.3M chars; we keep as much as the AI
// model can reasonably process (Gemini 2.5 Flash supports 1M+ context).
const WINDOW_HEAD = HAS_STRONG_PROVIDER ? 500000 : 120000;
const WINDOW_TAIL = HAS_STRONG_PROVIDER ? 150000 : 30000;
const PASS_TIMEOUT_MS = 420_000;
const RETRY_TIMEOUT_MS = 180_000;

const AI_MODEL_OVERRIDE = process.env.OPENROUTER_API_KEY
  ? 'google/gemini-2.5-flash-001'
  : process.env.GEMINI_API_KEY
    ? 'gemini-2.5-flash'
    : null;

type Scope = 'floats' | 'sections' | 'metadata';

function raceWithTimeout<T>(promise: Promise<T>, ms: number, controller: AbortController): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => {
        controller.abort();
        resolve(null);
      }, ms);
    }),
  ]);
}

function balancedWindow(text: string): string {
  if (text.length <= WINDOW_HEAD + WINDOW_TAIL) return text;
  return `${text.substring(0, WINDOW_HEAD)}\n\n[... middle of the document elided for context budget ...]\n\n${text.substring(text.length - WINDOW_TAIL)}`;
}

/** Build a compact verdict from the structured body — works with or without aiVerdict. */
function buildVerdictCompact(doc: Record<string, any>): Record<string, any> {
  const ai = doc.aiVerdict || {};
  const body = Array.isArray(doc.body) ? doc.body : [];

  // Extract sections from body nodes when aiVerdict.sections is missing
  const sections: Array<{ title: string; level: number }> = Array.isArray(ai.sections) && ai.sections.length > 0
    ? ai.sections
      .filter((s: any) => s && typeof s.title === 'string' && !/^(?:references?|bibliography|works cited|literature cited)\b/i.test(s.title.trim()))
      .map((s: any) => ({ title: s.title, level: Number(s.level) || 1 }))
    : body
      .filter((n: any) => n.type === 'heading' && n.text && !/^(?:references?|bibliography|works cited|literature cited)\b/i.test(String(n.text).trim()))
      .map((n: any) => ({ title: n.text, level: Number(n.level) || 1 }));

  // Extract figures/tables/algorithms from body when aiVerdict arrays are missing
  const figures = Array.isArray(ai.figures) && ai.figures.length > 0
    ? ai.figures.map((f: any) => String(f?.caption || ''))
    : body.filter((n: any) => (n.type === 'figure' || n.type === 'image' || n.type === 'chart') && n.caption)
        .map((n: any) => String(n.caption));

  const tables = Array.isArray(ai.tables) && ai.tables.length > 0
    ? ai.tables.map((t: any) => String(t?.caption || ''))
    : body.filter((n: any) => n.type === 'table' && n.caption)
        .map((n: any) => String(n.caption));

  const algorithms = Array.isArray(ai.algorithms) && ai.algorithms.length > 0
    ? ai.algorithms.map((a: any) => String(a?.title || ''))
    : body.filter((n: any) => n.type === 'algorithm' && (n.title || n.caption))
        .map((n: any) => String(n.title || n.caption));

  // Extract references from aiVerdict, top-level doc.references array, or body fallback
  const docRefs = Array.isArray(doc.references) ? doc.references : [];
  const references = Array.isArray(ai.references) && ai.references.length > 0
    ? ai.references.map((r: any) => String(r || ''))
    : docRefs.length > 0
      ? docRefs.map((r: any) => String(typeof r === 'string' ? r : r?.text || '')).filter(Boolean)
      : body.filter((n: any) => n.type === 'reference' && n.text)
          .map((n: any) => String(n.text));

  // Count components
  const componentCounts = {
    figures: figures.length,
    tables: tables.length,
    algorithms: algorithms.length,
    sections: sections.length,
    references: references.length,
  };

  return {
    title: ai.title?.text || doc.title || null,
    authors: Array.isArray(ai.authors) && ai.authors.length > 0
      ? ai.authors
      : Array.isArray(doc.authors)
        ? doc.authors.map((a: any) => ({ name: typeof a === 'string' ? a : a?.name, affiliations: [] }))
        : [],
    affiliations: ai.affiliations || doc.organizations || [],
    abstract: ai.abstract?.text || doc.abstract || null,
    keywords: ai.keywords || doc.keywords || [],
    sections,
    figures,
    tables,
    algorithms,
    components: ai.components || componentCounts,
    references,
  };
}

/** Split body nodes into section groups, preserving document order. */
function groupBodyBySections(body: any[]): Array<{ heading: any; nodes: any[] }> {
  const groups: Array<{ heading: any; nodes: any[] }> = [];
  let current: { heading: any; nodes: any[] } | null = null;

  for (const node of body) {
    if (node.type === 'heading' && node.text) {
      if (current) groups.push(current);
      current = { heading: node, nodes: [] };
    } else if (current) {
      current.nodes.push(node);
    } else {
      // Content before first heading — create implicit intro group
      current = { heading: { type: 'heading', text: 'Introduction', level: 1 }, nodes: [node] };
    }
  }
  if (current) groups.push(current);
  return groups;
}

/**
 * Build a text window for a specific chunk of sections.
 *
 * CRITICAL FIX: For large documents, the old implementation applied
 * balancedWindow() which elides the MIDDLE of the chunk — losing all
 * section content between head and tail. This caused middle sections
 * to have empty/incomplete LaTeX output (blank PDF).
 *
 * New strategy: always include the FULL chunk text. If the chunk exceeds
 * the budget, include full head sections + full tail sections and elide
 * only the middle sections (preserving complete section content for the
 * sections we DO include).
 */
function chunkTextWindow(
  body: any[],
  startIdx: number,
  endIdx: number,
  fullText: string,
): string {
  const chunkNodes = body.slice(startIdx, endIdx);
  const chunkText = chunkNodes
    .map((n: any) => {
      if (n.type === 'heading') return `\n${'#'.repeat(Number(n.level) || 1)} ${n.text}\n`;
      if (n.text) return n.text;
      if (n.caption) return `[Caption: ${n.caption}]`;
      if (n.type === 'figure' || n.type === 'image' || n.type === 'chart') return `[Figure: ${n.caption || n.name || 'unnamed'}]`;
      if (n.type === 'table') return `[Table: ${n.caption || 'untitled'}]`;
      if (n.type === 'algorithm') return `[Algorithm: ${n.title || n.caption || 'untitled'}]`;
      if (n.type === 'reference') return `[Ref: ${n.text || ''}]`;
      return '';
    })
    .join('\n');

  const budget = WINDOW_HEAD + WINDOW_TAIL;
  if (chunkText.length <= budget) return chunkText;

  // Split by section headings and preserve complete sections from head/tail
  const sections = splitIntoSections(chunkNodes);
  if (sections.length <= 2) {
    // Few sections — just truncate at boundary
    return balancedWindow(chunkText);
  }

  // Include complete sections from head and tail, elide middle
  const headSections: string[] = [];
  const tailSections: string[] = [];
  let headLen = 0;
  let tailLen = 0;
  const halfBudget = Math.floor(budget * 0.55); // 55% head, 45% tail

  for (const sec of sections) {
    if (headLen < halfBudget) {
      headSections.push(sec);
      headLen += sec.length;
    }
  }
  for (let i = sections.length - 1; i >= 0; i--) {
    if (headSections.includes(sections[i])) break;
    if (tailLen + sections[i].length > budget - headLen) break;
    tailSections.unshift(sections[i]);
    tailLen += sections[i].length;
  }

  const elidedCount = sections.length - headSections.length - tailSections.length;
  const result = headSections.join('\n') +
    (elidedCount > 0 ? `\n\n[... ${elidedCount} sections in the middle omitted for context budget ...]\n\n` : '') +
    tailSections.join('\n');
  return result;
}

/** Split body nodes into section-grouped text blocks (each starting with a heading). */
function splitIntoSections(nodes: any[]): string[] {
  const sections: string[] = [];
  let current: string[] = [];

  for (const node of nodes) {
    if (node.type === 'heading' && node.text) {
      if (current.length > 0) sections.push(current.join('\n'));
      current = [];
    }
    let text = '';
    if (node.type === 'heading') text = `\n${'#'.repeat(Number(node.level) || 1)} ${node.text}\n`;
    else if (node.text) text = node.text;
    else if (node.caption) text = `[Caption: ${node.caption}]`;
    else if (node.type === 'figure' || node.type === 'image' || node.type === 'chart') text = `[Figure: ${node.caption || node.name || 'unnamed'}]`;
    else if (node.type === 'table') text = `[Table: ${node.caption || 'untitled'}]`;
    else if (node.type === 'algorithm') text = `[Algorithm: ${node.title || node.caption || 'untitled'}]`;
    else if (node.type === 'reference') text = `[Ref: ${node.text || ''}]`;
    if (text) current.push(text);
  }
  if (current.length > 0) sections.push(current.join('\n'));
  return sections;
}

async function runScope(
  scope: Scope,
  ctx: {
    templateId: string;
    documentTitle: string;
    textWindow: string;
    verdict: Record<string, any>;
    figureFiles: string[];
    sectionStartIdx?: number;
    sectionEndIdx?: number;
    isChunk?: boolean;
    chunkIndex?: number;
    totalChunks?: number;
  },
  auth: { userId?: string | null; userEmail?: string | null; projectId?: string },
): Promise<{ files: AiModularFile[]; model: string; rejected: number }> {
  const controller = new AbortController();
  const chunkHint = ctx.isChunk
    ? ` (chunk ${(ctx.chunkIndex || 0) + 1}/${ctx.totalChunks || 1}, sections ${ctx.sectionStartIdx || 0}-${ctx.sectionEndIdx || 0})`
    : '';
  const res = await raceWithTimeout(
    routeToAgent({
      agent: 'doc2latex-modular',
      messages: [{ role: 'user', content: `Generate the modular LaTeX files for scope "${scope}"${chunkHint}.` }],
      context: {
        ...ctx,
        scope,
        modelOverride: AI_MODEL_OVERRIDE ?? undefined,
        userId: auth.userId ?? undefined,
        userEmail: auth.userEmail ?? undefined,
        projectId: auth.projectId,
      },
      signal: controller.signal,
    }),
    PASS_TIMEOUT_MS,
    controller,
  );

  if (!res?.success || !res.data || (res.data as any)._failSafe) {
    console.warn(`[AI-MODULAR] scope "${scope}"${chunkHint} unavailable`, res && !res.success ? `(${res.error})` : '');
    return { files: [], model: '', rejected: 0 };
  }
  // Accept partial results — even partial files are better than none.
  // The validator will reject any invalid files; valid ones are kept.
  if ((res.data as any)._partial) {
    console.log(`[AI-MODULAR] scope "${scope}"${chunkHint} returned partial results — keeping valid files`);
  }
  const normalized = normalizeModularFiles(res.data, ctx.figureFiles);
  console.log(`[AI-MODULAR] scope "${scope}"${chunkHint} → ${normalized.files.length} files kept, ${normalized.rejected} rejected (${res.model})`);
  return { files: normalized.files, model: res.model, rejected: normalized.rejected };
}

/** Retry a failed scope once with a shorter timeout. */
async function runScopeWithRetry(
  scope: Scope,
  ctx: Parameters<typeof runScope>[1],
  auth: Parameters<typeof runScope>[2],
): Promise<{ files: AiModularFile[]; model: string; rejected: number }> {
  const result = await runScope(scope, ctx, auth);
  if (result.files.length === 0 && !ctx.isChunk) {
    console.log(`[AI-MODULAR] Retrying scope "${scope}" with shorter timeout...`);
    const retryController = new AbortController();
    const retryRes = await raceWithTimeout(
      routeToAgent({
        agent: 'doc2latex-modular',
        messages: [{ role: 'user', content: `Generate the modular LaTeX files for scope "${scope}" (retry — emit ALL body text, do not truncate sections).` }],
        context: {
          ...ctx,
          scope,
          modelOverride: AI_MODEL_OVERRIDE ?? undefined,
          userId: auth.userId ?? undefined,
          userEmail: auth.userEmail ?? undefined,
          projectId: auth.projectId,
        },
        signal: retryController.signal,
      }),
      RETRY_TIMEOUT_MS,
      retryController,
    );
    if (retryRes?.success && retryRes.data && !(retryRes.data as any)._failSafe) {
      // Accept partial results from retry too — valid files are kept
      const normalized = normalizeModularFiles(retryRes.data, ctx.figureFiles);
      if (normalized.files.length > 0) {
        console.log(`[AI-MODULAR] Retry scope "${scope}" produced ${normalized.files.length} files (${normalized.rejected} rejected)`);
        return { files: normalized.files, model: retryRes.model, rejected: normalized.rejected };
      }
    }
  }
  return result;
}

// ── Deterministic main.tex composer ────────────────────────────────────────

const GRAPHICS_PATH_LINES = [
  "\\graphicspath{{./}{./figures/}{./assets/}{./images/}{../}{../figures/}{../assets/}{../images/}}",
  "\\DeclareGraphicsExtensions{.pdf,.eps,.png,.PNG,.jpg,.JPG,.jpeg,.JPEG,.tif,.tiff,.bmp,.gif,.webp,.avif,.svg,.ico,.heic,.HEIC,.heif,.HEIF}",
];

function defaultPreamble(templateId: string): string[] {
  let docClass = '\\documentclass{article}';
  if (templateId.includes('ieee')) docClass = '\\documentclass[journal]{IEEEtran}';
  else if (templateId.includes('acm')) docClass = '\\documentclass[nonacm,sigconf]{acmart}';
  else if (templateId.includes('elsevier')) docClass = '\\documentclass[preprint,12pt]{elsarticle}';
  else if (templateId.includes('lncs') || templateId.includes('springer')) docClass = '\\documentclass{llncs}';
  else if (templateId.includes('scirep')) docClass = '\\documentclass[10pt]{wlscirep}';

  return [
    '\\nonstopmode',
    docClass,
    '\\usepackage{iftex}',
    '\\ifxetex',
    '  \\usepackage{fontspec}',
    '\\else',
    '  \\usepackage[T1]{fontenc}',
    '  \\usepackage[utf8]{inputenc}',
    '\\fi',
    '\\usepackage{amsmath}',
    '\\usepackage{amsfonts}',
    '\\usepackage{amssymb}',
    '\\usepackage{mathrsfs}',
    '\\allowdisplaybreaks',
    '\\emergencystretch 3em',
    '\\usepackage{graphicx}',
    '\\usepackage{xcolor}',
    '\\usepackage{textcomp}',
    '\\usepackage{booktabs}',
    '\\usepackage{multirow}',
    '\\usepackage{array}',
    '\\usepackage{tabularx}',
    '\\usepackage{adjustbox}',
    '\\usepackage{float}',
    '\\usepackage{algorithm}',
    '\\usepackage{algpseudocode}',
    '\\usepackage{caption}',
    '\\usepackage{enumitem}',
    '\\usepackage{parskip}',
    '\\usepackage{placeins}',
    '\\usepackage{microtype}',
    '\\usepackage[colorlinks=true,allcolors=blue]{hyperref}',
    '\\DeclareUnicodeCharacter{200B}{}',
    '\\DeclareUnicodeCharacter{202F}{ }',
    '\\DeclareUnicodeCharacter{00A0}{ }',
    '\\DeclareUnicodeCharacter{2019}{\\textquotesingle}',
    '\\DeclareUnicodeCharacter{201C}{``}',
    '\\DeclareUnicodeCharacter{201D}{\'\'}',
    '\\DeclareUnicodeCharacter{207B}{\\ensuremath{^{-}}}',
    '\\DeclareUnicodeCharacter{025B}{\\ensuremath{\\epsilon}}',
    '\\DeclareUnicodeCharacter{2126}{\\ensuremath{\\Omega}}',
    '\\DeclareUnicodeCharacter{2013}{--}',
    '\\DeclareUnicodeCharacter{2014}{---}',
    '\\DeclareUnicodeCharacter{2212}{-}',
    ...GRAPHICS_PATH_LINES,
  ];
}

function stripFloatInputsToExisting(content: string, existingFloats: Set<string>): string {
  return content.replace(/\\input\s*\{floats\/(?:figures|tables|algorithms)\/\d+\.tex\}/g, (m) => {
    const pathMatch = m.match(/\\input\s*\{([^}]+)\}/);
    return pathMatch && existingFloats.has(pathMatch[1]) ? m : '';
  });
}

function composeMainTex(
  templateId: string,
  templateMainTex: string | undefined,
  files: AiModularFile[],
): string {
  const metadatas = files.filter((f) => f.path.startsWith('metadata/'));
  const isReferencesSection = (f: AiModularFile) => {
    const slugMatch = /sections\/\d+_(?:references|bibliography|works_cited|references_cited)\.tex$/i.test(f.path);
    if (slugMatch) return true;
    const trimmed = (f.content || '').trim();
    return /^\\(?:section|chapter|subsection)\*?\s*\{\s*(?:References|Bibliography|REFERENCES|BIBLIOGRAPHY|Reference|Works\s+Cited)\s*\}(?:\s*\\label\{[^}]*\})?\s*$/i.test(trimmed);
  };
  const sections = files
    .filter((f) => f.path.startsWith('sections/') && !isReferencesSection(f))
    .sort((a, b) => a.path.localeCompare(b.path));
  const floats = files.filter((f) => f.path.startsWith('floats/'));
  const bib = files.find((f) => f.path === 'references/bibliography.tex');
  const existingFloats = new Set(floats.map((f) => f.path));

  for (const f of sections) {
    f.content = stripFloatInputsToExisting(f.content, existingFloats);
  }

  let preamble: string[] = [];
  if (templateMainTex) {
    const beginIdx = templateMainTex.indexOf('\\begin{document}');
    if (beginIdx !== -1) {
      preamble = templateMainTex
        .substring(0, beginIdx)
        .split('\n')
        .filter((line) => {
          const l = line.trim();
          return (
            !l.startsWith('\\title') && !l.startsWith('\\author') && !l.startsWith('\\date') &&
            !l.startsWith('\\maketitle') && !l.startsWith('\\affil')
          );
        });
    }
  }
  if (preamble.length === 0) preamble = defaultPreamble(templateId);
  const preText = preamble.join('\n');
  if (!preText.includes('\\graphicspath')) preamble.push(...GRAPHICS_PATH_LINES);

  const body: string[] = ['\\begin{document}'];
  for (const f of metadatas) body.push(`\\input{${f.path}}`);
  body.push('\\maketitle');
  for (const f of sections) body.push(`\\input{${f.path}}`);
  const bodyJoined = body.join('\n');
  for (const f of floats) {
    if (!bodyJoined.includes(`\\input{${f.path}}`)) body.push(`\\input{${f.path}}`);
  }
  if (bib) body.push(`\\input{references/bibliography.tex}`);
  body.push('\\end{document}');

  return `${preamble.join('\n')}\n\n${body.join('\n')}\n`;
}

// ── Public entry ───────────────────────────────────────────────────────────

export async function runModularAiMapping(input: ModularMappingInput): Promise<ModularMappingResult | null> {
  const { structured, templateId, templateMainTex, userId, userEmail, projectId } = input;
  const figureManifest = Array.isArray(structured.figureManifest) ? structured.figureManifest : [];
  const figureFiles = figureManifest.map((f: any) => String(f?.name ?? f)).filter(Boolean);

  // Build text from body nodes or fullText
  const body = Array.isArray(structured.body) ? structured.body : [];
  const bodyText = body.map((n: any) => n.text || n.caption || '').join('\n');
  const docText = [structured.fullText, bodyText].filter(Boolean).join('\n').trim();
  const textWindow = balancedWindow(docText.length > 0 ? docText : structured.abstract || '');

  const verdict = buildVerdictCompact(structured);
  const common = {
    templateId,
    documentTitle: String(structured.title || 'Untitled Document'),
    textWindow,
    verdict,
    figureFiles,
  };

  console.log(`[AI-MODULAR] Starting 3-scope AI mapping: ${verdict.sections.length} sections, ${verdict.figures.length} figures, ${verdict.tables.length} tables, ${verdict.algorithms.length} algorithms`);

  // ── FULL-LENGTH TEXT for floats/metadata passes ──────────────────────
  // The balanced window truncates the middle of large documents. Floats and
  // metadata passes need visibility into ALL captions, equations and
  // references — build a separate full-length window that includes all body
  // node content (capped at a safe model context limit).
  const fullTextForPasses = (() => {
    const bodyTextFull = body.map((n: any) => {
      if (n.type === 'heading') return `\n${'#'.repeat(Number(n.level) || 1)} ${n.text}\n`;
      if (n.text) return n.text;
      if (n.caption) return `[Caption: ${n.caption}]`;
      if (n.type === 'figure' || n.type === 'image' || n.type === 'chart') return `[Figure: ${n.caption || n.name || ''}]`;
      if (n.type === 'table') return `[Table: ${n.caption || ''}]`;
      if (n.type === 'algorithm') return `[Algorithm: ${n.title || n.caption || ''}]`;
      if (n.type === 'reference') return `[Ref: ${n.text || ''}]`;
      return '';
    }).join('\n');
    const combined = [structured.fullText, bodyTextFull].filter(Boolean).join('\n').trim();
    // Cap at generous limit — Gemini 2.5 Flash handles 1M+ tokens
    const MAX_CHARS = HAS_STRONG_PROVIDER ? 700000 : 200000;
    if (combined.length <= MAX_CHARS) return combined;
    // For very large docs: head 70% + tail 30% (preserves references at end)
    const headLen = Math.floor(MAX_CHARS * 0.7);
    return combined.substring(0, headLen) +
      '\n\n[... middle of document elided ...]\n\n' +
      combined.substring(combined.length - (MAX_CHARS - headLen));
  })();

  // ── CHUNKED SECTIONS for large documents ─────────────────────────────
  // If there are many sections, split into chunks so the AI can generate
  // complete section files without hitting output token limits.
  // Smaller chunks (8 sections) ensure the AI can generate complete LaTeX
  // for every section without truncation — critical for large 20MB docs.
  const CHUNK_SIZE = 8; // sections per chunk
  const sectionGroups = groupBodyBySections(body);
  let sectionFiles: AiModularFile[] = [];
  let sectionModel = '';
  let sectionRejected = 0;

  if (sectionGroups.length > CHUNK_SIZE) {
    const totalChunks = Math.ceil(sectionGroups.length / CHUNK_SIZE);
    console.log(`[AI-MODULAR] Large document: splitting ${sectionGroups.length} sections into ${totalChunks} chunks`);

    const failedChunks: number[] = [];
    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const start = chunkIdx * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, sectionGroups.length);
      const chunkBody = sectionGroups.slice(start, end).flatMap(g => [g.heading, ...g.nodes]);
      const chunkText = chunkTextWindow(chunkBody, 0, chunkBody.length, docText);

      const chunkCtx = {
        ...common,
        textWindow: chunkText.length > 0 ? chunkText : fullTextForPasses,
        sectionStartIdx: start,
        sectionEndIdx: end,
        isChunk: true,
        chunkIndex: chunkIdx,
        totalChunks,
        verdict: {
          ...verdict,
          sections: verdict.sections.slice(start, end),
        },
      };

      const chunkResult = await runScopeWithRetry('sections', chunkCtx, { userId, userEmail, projectId });
      sectionFiles.push(...chunkResult.files);
      if (chunkResult.model) sectionModel = chunkResult.model;
      sectionRejected += chunkResult.rejected;

      if (chunkResult.files.length === 0) {
        failedChunks.push(chunkIdx);
        console.warn(`[AI-MODULAR] Chunk ${chunkIdx + 1}/${totalChunks} FAILED — sections ${start}-${end} will be empty`);
      } else {
        console.log(`[AI-MODULAR] Chunk ${chunkIdx + 1}/${totalChunks}: ${chunkResult.files.length} section files`);
      }
    }

    if (failedChunks.length > 0) {
      console.warn(`[AI-MODULAR] ${failedChunks.length}/${totalChunks} chunks failed. Missing sections: ${failedChunks.map(c => `${c * CHUNK_SIZE + 1}-${Math.min((c + 1) * CHUNK_SIZE, sectionGroups.length)}`).join(', ')}`);
    }
  } else {
    // Small document — single pass
    const sectionsRes = await runScopeWithRetry('sections', common, { userId, userEmail, projectId });
    sectionFiles = sectionsRes.files;
    sectionModel = sectionsRes.model;
    sectionRejected = sectionsRes.rejected;
  }

  // ── FLOATS and METADATA passes (parallel) ────────────────────────────
  // Use fullTextForPasses so floats/metadata can see ALL captions, equations
  // and references — not just the truncated balanced window.
  const fullCtx = { ...common, textWindow: fullTextForPasses };
  const [floatsRes, metadataRes] = await Promise.all([
    runScopeWithRetry('floats', fullCtx, { userId, userEmail, projectId }),
    runScopeWithRetry('metadata', fullCtx, { userId, userEmail, projectId }),
  ]);

  const files = [...floatsRes.files, ...sectionFiles, ...metadataRes.files];
  const models = [floatsRes.model, sectionModel, metadataRes.model].filter(Boolean);

  console.log(`[AI-MODULAR] Total: ${files.length} validated files (${floatsRes.files.length} floats, ${sectionFiles.length} sections, ${metadataRes.files.length} metadata), ${floatsRes.rejected + sectionRejected + metadataRes.rejected} rejected`);

  // ── SECTION COVERAGE CHECK ──────────────────────────────────────────
  // Verify every section from the verdict has a corresponding file. Missing
  // sections cause blank PDF because main.tex \input references nonexistent
  // files. If coverage is below 50%, the AI mapping is unreliable — fall
  // back to deterministic assembly.
  const sectionFileCount = sectionFiles.filter(f => f.path.startsWith('sections/')).length;
  const expectedSectionCount = verdict.sections.length;
  if (expectedSectionCount > 0 && sectionFileCount === 0 && files.length > 0) {
    console.warn(`[AI-MODULAR] WARNING: ${expectedSectionCount} sections expected but 0 section files generated. AI mapping is unreliable — falling back.`);
    return null;
  }
  if (expectedSectionCount > 0 && sectionFileCount < expectedSectionCount * 0.5) {
    console.warn(`[AI-MODULAR] WARNING: Only ${sectionFileCount}/${expectedSectionCount} section files generated (< 50% coverage). AI mapping is unreliable — falling back to deterministic assembler.`);
    return null;
  }

  if (files.length === 0) {
    console.warn('[AI-MODULAR] No validated AI files — falling back to deterministic assembly.');
    return null;
  }

  const mainTex = composeMainTex(templateId, templateMainTex, files);
  return {
    mainTex,
    files,
    model: models[0] || 'unknown',
    rejected: floatsRes.rejected + sectionRejected + metadataRes.rejected,
  };
}
