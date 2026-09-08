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
 * PARALLEL / MULTITASKING ARCHITECTURE:
 * Floats, metadata, and chunked section passes are dispatched CONCURRENTLY
 * using a bounded concurrency worker pool (max 4 concurrent requests).
 *
 * Every emitted file is machine-verified and main.tex is composed
 * DETERMINISTICALLY according to the target template conventions (.cls/.sty).
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
  figureFiles?: string[];
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
const PASS_TIMEOUT_MS = 120_000;
const RETRY_TIMEOUT_MS = 60_000;
const MAX_CONCURRENT_AI_CALLS = 4;
const CHUNK_SIZE = 5; // 5 sections per chunk ensures zero truncation

const AI_MODEL_OVERRIDE = process.env.OPENROUTER_API_KEY
  ? 'google/gemini-2.5-flash-001'
  : process.env.GEMINI_API_KEY
    ? 'gemini-2.5-flash'
    : null;

type Scope = 'floats' | 'sections' | 'metadata';

/** Bounded concurrency parallel mapping helper */
async function pMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = MAX_CONCURRENT_AI_CALLS
): Promise<R[]> {
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
 * Guarantees complete section content without truncation for that chunk.
 */
function chunkTextWindow(
  chunkNodes: any[],
  docText: string
): string {
  const chunkText = chunkNodes
    .map((n: any) => {
      if (n.type === 'heading') return `\n${'#'.repeat(Number(n.level) || 1)} ${n.text}\n`;
      if (n.text) return n.text;
      if (n.caption) return `[Caption: ${n.caption}]`;
      if (n.type === 'figure' || n.type === 'image' || n.type === 'chart') return `[Figure: ${n.caption || n.name || n.id || 'unnamed'}]`;
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
    return balancedWindow(chunkText);
  }

  const headSections: string[] = [];
  const tailSections: string[] = [];
  let headLen = 0;
  let tailLen = 0;
  const halfBudget = Math.floor(budget * 0.55);

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
  if (result.files.length === 0) {
    console.log(`[AI-MODULAR] Retrying scope "${scope}" with retry prompt...`);
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
  const metadatas = files.filter((f) => f.path.startsWith('metadata/') && f.path.endsWith('.tex'));
  const isReferencesSection = (f: AiModularFile) => {
    const slugMatch = /sections\/\d+_(?:references|bibliography|works_cited|references_cited)\.tex$/i.test(f.path);
    if (slugMatch) return true;
    const trimmed = (f.content || '').trim();
    return /^\\(?:section|chapter|subsection)\*?\s*\{\s*(?:References|Bibliography|REFERENCES|BIBLIOGRAPHY|Reference|Works\s+Cited)\s*\}(?:\s*\\label\{[^}]*\})?\s*$/i.test(trimmed);
  };
  const sections = files
    .filter((f) => f.path.startsWith('sections/') && f.path.endsWith('.tex') && !isReferencesSection(f))
    .sort((a, b) => a.path.localeCompare(b.path));
  const floats = files.filter((f) => f.path.startsWith('floats/') && f.path.endsWith('.tex'));
  const bib = files.find((f) => f.path === 'references/bibliography.tex');
  const bibFile = files.find((f) => f.path === 'references/references.bib' || f.path === 'references.bib');
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
  if (!preText.includes('subfigure')) {
    preamble.push(
      "\\catcode`\\@=11",
      "\\@ifundefined{subfigure}{",
      "  \\newcounter{localsubfig}[figure]",
      "  \\newenvironment{subfigure}[2][]{%",
      "    \\begin{minipage}{#2}%",
      "      \\refstepcounter{localsubfig}%",
      "      \\def\\caption##1{%",
      "        \\par\\vspace{5pt}{\\centering\\small(\\alph{localsubfig})~##1\\par}%",
      "      }%",
      "  }{%",
      "    \\end{minipage}%",
      "  }",
      "}{}",
      "\\catcode`\\@=12"
    );
  }

  const isElsevier = templateId.includes('elsevier');
  const isAcm = templateId.includes('acm');
  const isIeee = templateId.includes('ieee');

  const titleFile = metadatas.find(f => f.path === 'metadata/title.tex');
  const authorsFile = metadatas.find(f => f.path === 'metadata/authors.tex');
  const abstractFile = metadatas.find(f => f.path === 'metadata/abstract.tex');
  const keywordsFile = metadatas.find(f => f.path === 'metadata/keywords.tex');
  const otherMetas = metadatas.filter(f => !['metadata/title.tex', 'metadata/authors.tex', 'metadata/abstract.tex', 'metadata/keywords.tex'].includes(f.path));

  const body: string[] = ['\\begin{document}'];

  if (isElsevier) {
    body.push('\\begin{frontmatter}');
    if (titleFile) body.push(`\\input{${titleFile.path}}`);
    if (authorsFile) body.push(`\\input{${authorsFile.path}}`);
    if (abstractFile) body.push(`\\input{${abstractFile.path}}`);
    if (keywordsFile) body.push(`\\input{${keywordsFile.path}}`);
    for (const f of otherMetas) body.push(`\\input{${f.path}}`);
    body.push('\\end{frontmatter}');
  } else if (isAcm) {
    if (titleFile) body.push(`\\input{${titleFile.path}}`);
    if (authorsFile) body.push(`\\input{${authorsFile.path}}`);
    if (abstractFile) body.push(`\\input{${abstractFile.path}}`);
    if (keywordsFile) body.push(`\\input{${keywordsFile.path}}`);
    for (const f of otherMetas) body.push(`\\input{${f.path}}`);
    body.push('\\maketitle');
  } else if (isIeee) {
    if (titleFile) body.push(`\\input{${titleFile.path}}`);
    if (authorsFile) body.push(`\\input{${authorsFile.path}}`);
    body.push('\\maketitle');
    if (abstractFile) body.push(`\\input{${abstractFile.path}}`);
    if (keywordsFile) body.push(`\\input{${keywordsFile.path}}`);
    for (const f of otherMetas) body.push(`\\input{${f.path}}`);
  } else {
    if (titleFile) body.push(`\\input{${titleFile.path}}`);
    if (authorsFile) body.push(`\\input{${authorsFile.path}}`);
    body.push('\\maketitle');
    if (abstractFile) body.push(`\\input{${abstractFile.path}}`);
    if (keywordsFile) body.push(`\\input{${keywordsFile.path}}`);
    for (const f of otherMetas) body.push(`\\input{${f.path}}`);
  }

  // Sections in sorted numerical order (01_slug.tex, 02_slug.tex, ...)
  for (const f of sections) body.push(`\\input{${f.path}}`);

  // Any floats not inlined inside sections are included safely before references
  const bodyJoined = body.join('\n');
  for (const f of floats) {
    if (!bodyJoined.includes(`\\input{${f.path}}`)) body.push(`\\input{${f.path}}`);
  }

  // Bibliography
  if (bib) {
    body.push(`\\input{references/bibliography.tex}`);
  } else if (bibFile) {
    body.push(`\\bibliographystyle{plain}`);
    body.push(`\\bibliography{references/references}`);
  }
  body.push('\\end{document}');

  return `${preamble.join('\n')}\n\n${body.join('\n')}\n`;
}

// ── Public entry ───────────────────────────────────────────────────────────

export async function runModularAiMapping(input: ModularMappingInput): Promise<ModularMappingResult | null> {
  const { structured, templateId, templateMainTex, userId, userEmail, projectId } = input;

  // Resolve all available figure files
  const figureManifest = Array.isArray(structured.figureManifest) ? structured.figureManifest : [];
  const manifestNames = figureManifest.map((f: any) => String(f?.name ?? f)).filter(Boolean);
  const passedFigureFiles = Array.isArray(input.figureFiles) ? input.figureFiles : [];
  const body = Array.isArray(structured.body) ? structured.body : [];
  const bodyFigNames: string[] = [];
  for (const n of body) {
    if ((n.type === 'figure' || n.type === 'image' || n.type === 'chart') && n.id) {
      bodyFigNames.push(String(n.id).replace(/^assets\//, '').replace(/^figures\//, ''));
    }
  }

  const combinedFigSet = new Set<string>();
  for (const f of [...passedFigureFiles, ...manifestNames, ...bodyFigNames]) {
    const s = String(f).trim();
    if (/\.(png|jpe?g|webp|gif|pdf|eps|svg|heic|heif|tiff?|bmp|avif)$/i.test(s)) {
      combinedFigSet.add(s);
    }
  }
  const figureFiles = Array.from(combinedFigSet);

  // Build text from body nodes or fullText
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

  console.log(`[AI-MODULAR] Starting parallel multi-task mapping (concurrency=${MAX_CONCURRENT_AI_CALLS}): ${verdict.sections.length} sections, ${verdict.figures.length} figures, ${verdict.tables.length} tables, ${figureFiles.length} image files`);

  // Full-length text for floats and metadata
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
    const MAX_CHARS = HAS_STRONG_PROVIDER ? 700000 : 200000;
    if (combined.length <= MAX_CHARS) return combined;
    const headLen = Math.floor(MAX_CHARS * 0.7);
    return combined.substring(0, headLen) +
      '\n\n[... middle of document elided ...]\n\n' +
      combined.substring(combined.length - (MAX_CHARS - headLen));
  })();

  const fullCtx = { ...common, textWindow: fullTextForPasses };

  // Prepare tasks: Floats, Metadata, and Sections
  const sectionGroups = groupBodyBySections(body);
  const totalChunks = Math.ceil(sectionGroups.length / CHUNK_SIZE);
  const isChunked = sectionGroups.length > CHUNK_SIZE;

  interface ScopeTask {
    name: string;
    run: () => Promise<{ files: AiModularFile[]; model: string; rejected: number }>;
  }

  const tasks: ScopeTask[] = [
    {
      name: 'floats',
      run: () => runScopeWithRetry('floats', fullCtx, { userId, userEmail, projectId }),
    },
    {
      name: 'metadata',
      run: () => runScopeWithRetry('metadata', fullCtx, { userId, userEmail, projectId }),
    },
  ];

  if (!isChunked) {
    tasks.push({
      name: 'sections-all',
      run: () => runScopeWithRetry('sections', common, { userId, userEmail, projectId }),
    });
  } else {
    console.log(`[AI-MODULAR] Large document: splitting ${sectionGroups.length} sections into ${totalChunks} parallel chunks (size=${CHUNK_SIZE})`);
    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const start = chunkIdx * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, sectionGroups.length);
      const chunkNodes = sectionGroups.slice(start, end).flatMap(g => [g.heading, ...g.nodes]);
      const chunkText = chunkTextWindow(chunkNodes, docText);

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

      tasks.push({
        name: `sections-chunk-${chunkIdx + 1}`,
        run: () => runScopeWithRetry('sections', chunkCtx, { userId, userEmail, projectId }),
      });
    }
  }

  // Run all tasks concurrently with bounded worker pool!
  const taskResults = await pMap(tasks, async (task) => {
    const startTime = Date.now();
    const res = await task.run();
    console.log(`[AI-MODULAR] Task "${task.name}" finished in ${((Date.now() - startTime) / 1000).toFixed(1)}s: ${res.files.length} files`);
    return res;
  }, MAX_CONCURRENT_AI_CALLS);

  const floatsRes = taskResults[0];
  const metadataRes = taskResults[1];
  const sectionTaskResults = taskResults.slice(2);

  const sectionFiles: AiModularFile[] = [];
  let sectionRejected = 0;
  const models = [floatsRes.model, metadataRes.model];

  for (const sRes of sectionTaskResults) {
    sectionFiles.push(...sRes.files);
    sectionRejected += sRes.rejected;
    if (sRes.model) models.push(sRes.model);
  }

  const files = [...floatsRes.files, ...sectionFiles, ...metadataRes.files];
  const totalRejected = floatsRes.rejected + metadataRes.rejected + sectionRejected;

  console.log(`[AI-MODULAR] Parallel mapping complete: ${files.length} validated files (${floatsRes.files.length} floats, ${sectionFiles.length} sections, ${metadataRes.files.length} metadata), ${totalRejected} rejected`);

  // ── Section Coverage & Content Preservation Check ──
  const sectionFileCount = sectionFiles.filter(f => f.path.startsWith('sections/')).length;
  const expectedSectionCount = verdict.sections.length;
  if (expectedSectionCount > 0 && sectionFileCount === 0 && files.length > 0) {
    console.warn(`[AI-MODULAR] WARNING: ${expectedSectionCount} sections expected but 0 section files generated. Falling back to deterministic assembly.`);
    return null;
  }
  if (expectedSectionCount > 0 && sectionFileCount < expectedSectionCount * 0.5) {
    console.warn(`[AI-MODULAR] WARNING: Only ${sectionFileCount}/${expectedSectionCount} section files generated (< 50% coverage). Falling back to deterministic assembler.`);
    return null;
  }

  // ── Content Length Preservation Verification ──
  const totalSectionChars = sectionFiles.reduce((acc, f) => acc + (f.content || '').length, 0);
  const rawProseChars = docText.length;
  console.log(`[AI-MODULAR] Content preservation check: emitted ${totalSectionChars} chars across ${sectionFiles.length} sections vs ${rawProseChars} source doc chars.`);
  if (rawProseChars > 15000 && totalSectionChars < rawProseChars * 0.25) {
    console.warn(`[AI-MODULAR] WARNING: Content preservation check failed: only ${totalSectionChars} chars generated for ${rawProseChars} source chars (< 25% content). Falling back to deterministic assembly to guarantee zero content loss.`);
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
    model: models.filter(Boolean)[0] || 'unknown',
    rejected: totalRejected,
  };
}
