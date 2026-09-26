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
import { LatexAssembler, ModularLatexAssembler, slugifySectionTitle } from './assembler';

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
const MAX_CONCURRENT_AI_CALLS = 2;
const CHUNK_SIZE = 5; // 5 sections per chunk ensures zero truncation

const AI_MODEL_OVERRIDE = process.env.OPENROUTER_API_KEY
  ? 'google/gemini-2.0-flash-001'
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

const CANONICAL_L1_REGEX = /^(?:(?:\d+|[ivxlcdm]+)[\.:]?\s+)?(?:introduction|literature\s+review|literature\s+survey|review\s+of\s+literature|survey\s+of\s+literature|related\s+work|related\s+works|background|methodology|methods|materials\s+and\s+methods|experiments?|results|discussion|results\s+and\s+discussion|conclusion|conclusions|acknowledgements?)\b/i;

function isTopLevelSectionHeading(node: any, hasAnyL1: boolean): boolean {
  if (node.type !== 'heading' || !node.text) return false;
  const text = String(node.text).trim();
  if (/^(?:references?|bibliography|works cited|literature cited)\b/i.test(text)) return false;

  if (node.componentRole === 'frontmatter' || node.componentRole === 'author' || node.componentRole === 'affiliation' || node.componentRole === 'organization') {
    return false;
  }

  // 1. Numeric prefix check (e.g. "1.", "2. ", "1.1", "2.3.1")
  const numMatch = text.match(/^(?:section\s+)?(\d+(?:\.\d+)*)/i);
  if (numMatch) {
    const parts = numMatch[1].split('.').filter(Boolean);
    if (parts.length > 1) return false; // Explicit subsection e.g. 1.1, 2.3.1 - NEVER top level!
    if (parts.length === 1) return true;
  }

  // 2. Explicit node.level > 1 is a subsection
  const level = Number(node.level);
  if (level === 2 || level === 3) return false;

  // 3. Roman numerals e.g. "I. Introduction", "II. Literature Review"
  if (/^[IVXLCDM]+\.?\s+/i.test(text)) return true;

  // 4. Canonical top-level names (always level 1)
  if (CANONICAL_L1_REGEX.test(text)) return true;

  if (level === 1) return true;

  // If document has explicit L1 headings, any other level > 1 is a subsection!
  if (hasAnyL1 && level > 1) return false;

  // Fallback for flat headings
  return !hasAnyL1;
}

/** Split body nodes into top-level section groups, keeping child subsections inside. */
function groupBodyBySections(body: any[]): Array<{ heading: any; nodes: any[] }> {
  const groups: Array<{ heading: any; nodes: any[] }> = [];
  let current: { heading: any; nodes: any[] } | null = null;

  const hasAnyL1 = body.some((n: any) => n.type === 'heading' && (
    Number(n.level) === 1 ||
    CANONICAL_L1_REGEX.test(String(n.text || '').trim()) ||
    /^(?:section\s+)?\d+\.?\s+[a-z]/i.test(String(n.text || '').trim())
  ));

  for (const node of body) {
    // Skip frontmatter nodes from section grouping
    if (node.componentRole === 'frontmatter' || node.componentRole === 'author' || node.componentRole === 'affiliation' || node.componentRole === 'organization') {
      continue;
    }
    if (node.type === 'paragraph') {
      const pText = (node.text || '').trim();
      if ((/^(?:dr\.|prof\.|professor|deputy librarian|assistant professor|associate professor|mr\.|ms\.|mrs\.|md)\b/i.test(pText) && pText.length < 100 && pText.split(/\s+/).length < 15) ||
          (/\b(?:mdpi|springer|elsevier|ieee|acm|wiley)\b/i.test(pText) && pText.length < 60)) {
        continue;
      }
    }
    if (node.type === 'heading' && node.text) {
      if (isTopLevelSectionHeading(node, hasAnyL1)) {
        if (current) groups.push(current);
        current = { heading: node, nodes: [] };
      } else {
        // Child subsection (level 2, 3, etc.) stays inside the parent top-level section!
        if (current) {
          current.nodes.push(node);
        } else {
          current = { heading: { type: 'heading', text: 'Introduction', level: 1 }, nodes: [node] };
        }
      }
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

/** Build a compact verdict from the structured body — works with or without aiVerdict. */
function buildVerdictCompact(doc: Record<string, any>): Record<string, any> {
  const ai = doc.aiVerdict || {};
  const body = Array.isArray(doc.body) ? doc.body : [];

  // Derive sections directly from sectionGroups to guarantee strict 1:1 chunk alignment
  const sectionGroups = groupBodyBySections(body);
  const sections = sectionGroups.length > 0
    ? sectionGroups.map(g => ({
        title: String(g.heading.text || 'Untitled Section'),
        level: Number(g.heading.level) || 1,
        subsections: g.nodes
          .filter((n: any) => n.type === 'heading' && n.text)
          .map((n: any) => ({
            title: String(n.text),
            level: Number(n.level) || 2,
          }))
      }))
    : (Array.isArray(ai.sections) && ai.sections.length > 0
        ? ai.sections
            .filter((s: any) => s && typeof s.title === 'string' && !/^(?:references?|bibliography|works cited|literature cited)\b/i.test(s.title.trim()))
            .map((s: any) => ({ title: s.title, level: Number(s.level) || 1, subsections: [] }))
        : body
            .filter((n: any) => n.type === 'heading' && n.text && !/^(?:references?|bibliography|works cited|literature cited)\b/i.test(String(n.text).trim()))
            .map((n: any) => ({ title: n.text, level: Number(n.level) || 1, subsections: [] })));

  // Full list of all sections, subsections, and subsubsections across the document
  const allSections: Array<{ title: string; level: number }> = (Array.isArray(ai.sections) && ai.sections.length > 0)
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

  const authors = Array.isArray(ai.authors) && ai.authors.length > 0
    ? ai.authors
    : Array.isArray(doc.authors)
      ? doc.authors.map((a: any) => ({
          name: typeof a === 'string' ? a : a?.name,
          affiliations: Array.isArray(a?.affiliations) && a.affiliations.length > 0
            ? a.affiliations
            : (a?.affiliation ? [a.affiliation] : [])
        }))
      : [];
  const affiliations = ai.affiliations || doc.organizations || [];
  const authorNames = authors.map((a: any) => typeof a === 'string' ? a : a?.name).filter(Boolean);
  const frontmatterExclusions = [
    ...authorNames,
    ...(Array.isArray(affiliations) ? affiliations : []),
    'MDPI', 'Springer', 'Elsevier', 'IEEE', 'ACM', 'Wiley',
    'Deputy Librarian', 'Assistant Professor', 'Associate Professor', 'Professor'
  ];

  return {
    title: ai.title?.text || doc.title || null,
    authors,
    affiliations,
    frontmatterExclusions,
    abstract: ai.abstract?.text || doc.abstract || null,
    keywords: ai.keywords || doc.keywords || [],
    sections,
    allSections,
    figures,
    tables,
    algorithms,
    components: ai.components || componentCounts,
    references,
  };
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
      if (n.type === 'equation') return `\n[Equation: ${n.latex || n.text || ''}]\n`;
      if (n.text) return n.text;
      if (n.caption) return `[Caption: ${n.caption}]`;
      if (n.type === 'figure' || n.type === 'image' || n.type === 'chart') {
        const cap = n.caption || '';
        const fname = n.name || n.id || '';
        return `\n[Figure: ${fname}${cap ? ` | Caption: ${cap}` : ''}]\n`;
      }
      if (n.type === 'table') {
        const cap = n.caption || 'untitled';
        const content = n.html || (Array.isArray(n.rows) ? n.rows.map((r: any) => Array.isArray(r) ? r.join(' | ') : String(r)).join('\n') : n.text || '');
        return `\n[Table: ${cap}]\n${content}\n`;
      }
      if (n.type === 'algorithm') {
        const title = n.title || n.caption || 'untitled';
        const steps = Array.isArray(n.items) ? n.items.join('\n') : (n.text || '');
        return `\n[Algorithm: ${title}]\n${steps}\n`;
      }
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

/** Split body nodes into section-grouped text blocks (each starting with a top-level heading). */
function splitIntoSections(nodes: any[]): string[] {
  const sections: string[] = [];
  let current: string[] = [];
  const hasAnyL1 = nodes.some((n: any) => n.type === 'heading' && (
    Number(n.level) === 1 ||
    CANONICAL_L1_REGEX.test(String(n.text || '').trim()) ||
    /^(?:section\s+)?\d+\.?\s+[a-z]/i.test(String(n.text || '').trim())
  ));

  for (const node of nodes) {
    if (node.type === 'heading' && node.text && isTopLevelSectionHeading(node, hasAnyL1)) {
      if (current.length > 0) sections.push(current.join('\n'));
      current = [];
    }
    let text = '';
    if (node.type === 'heading') text = `\n${'#'.repeat(Number(node.level) || 1)} ${node.text}\n`;
    else if (node.type === 'equation') text = `\n[Equation: ${node.latex || node.text || ''}]\n`;
    else if (node.text) text = node.text;
    else if (node.caption) text = `[Caption: ${node.caption}]`;
    else if (node.type === 'figure' || node.type === 'image' || node.type === 'chart') {
      const cap = node.caption || '';
      const fname = node.name || node.id || '';
      text = `\n[Figure: ${fname}${cap ? ` | Caption: ${cap}` : ''}]\n`;
    }
    else if (node.type === 'table') {
      const cap = node.caption || 'untitled';
      const content = node.html || (Array.isArray(node.rows) ? node.rows.map((r: any) => Array.isArray(r) ? r.join(' | ') : String(r)).join('\n') : node.text || '');
      text = `\n[Table: ${cap}]\n${content}\n`;
    }
    else if (node.type === 'algorithm') {
      const title = node.title || node.caption || 'untitled';
      const steps = Array.isArray(node.items) ? node.items.join('\n') : (node.text || '');
      text = `\n[Algorithm: ${title}]\n${steps}\n`;
    }
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
  const isStandardArticle = !templateId.includes('ieee') && !templateId.includes('acm') && !templateId.includes('elsevier') && !templateId.includes('lncs') && !templateId.includes('springer') && !templateId.includes('scirep');
  if (templateId.includes('ieee')) docClass = '\\documentclass[journal]{IEEEtran}';
  else if (templateId.includes('acm')) docClass = '\\documentclass[nonacm,sigconf]{acmart}';
  else if (templateId.includes('elsevier')) docClass = '\\documentclass[preprint,12pt]{elsarticle}';
  else if (templateId.includes('lncs') || templateId.includes('springer')) docClass = '\\documentclass{llncs}';
  else if (templateId.includes('scirep')) docClass = '\\documentclass[10pt]{wlscirep}';

  const pkgs = [
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
  ];
  if (isStandardArticle) {
    pkgs.push('\\usepackage{authblk}');
  }
  pkgs.push(
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
    ...GRAPHICS_PATH_LINES
  );
  return pkgs;
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
  verdict?: Record<string, any>,
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

  const authorNames = ((verdict?.authors || []) as any[])
    .map((a: any) => typeof a === 'string' ? a : a?.name)
    .filter(Boolean)
    .map((name: string) => name.toLowerCase().replace(/^(?:dr|prof|professor|mr|ms|mrs|md)\.?\s*/i, '').trim());
  const affiliations = ((verdict?.affiliations || []) as any[])
    .map((aff: any) => String(aff || '').toLowerCase().trim())
    .filter(Boolean);

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const f = sections[sIdx];
    f.content = stripFloatInputsToExisting(f.content, existingFloats);
    // Boundary-safe frontmatter filter: removes leaked metadata lines from section files
    f.content = f.content
      .split('\n')
      .filter((line) => {
        const l = line.trim();
        if (!l) return true;
        if (/^(?:mdpi|springer|elsevier|ieee|acm|wiley)\.?$/i.test(l)) return false;
        if (/^(?:\\noindent\s*)?(?:deputy librarian|assistant professor|associate professor|visiting professor|lecturer|dean|principal)\b/i.test(l) && l.length < 150 && !l.endsWith('.')) return false;
        if (/^(?:\\noindent\s*)?(?:dr\.|prof\.|professor|mr\.|ms\.|mrs\.|md)\s+[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){1,4}\.?$/i.test(l) && l.length < 80 && !l.endsWith('.')) return false;
        if (/^(?:\\noindent\s*)?(?:email|e-mail|orcid|corresponding author)\b/i.test(l) && l.length < 120) return false;

        // Strip standalone author and affiliation lines that do not end with a sentence period
        const cleanLine = l.replace(/^\\noindent\s*/, '').replace(/[.,;:]*$/, '').toLowerCase().trim();
        if (cleanLine.length > 3 && cleanLine.length < 150 && !l.endsWith('.')) {
          if (authorNames.some((a: string) => a.length > 3 && (cleanLine === a || cleanLine.includes(a)))) return false;
          if (affiliations.some((aff: string) => aff.length > 5 && (cleanLine === aff || aff.includes(cleanLine) || cleanLine.includes(aff)))) return false;
          if (/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(cleanLine)) return false;
        }
        return true;
      })
      .join('\n');
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
  if (!preText.includes('placeins')) preamble.push('\\usepackage{placeins}');
  if (!preText.includes('adjustbox')) preamble.push('\\usepackage{adjustbox}');
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

  // Non-Elsevier templates declare title & author in preamble BEFORE \begin{document}
  if (!isElsevier) {
    if (titleFile) preamble.push(`\\input{${titleFile.path}}`);
    if (authorsFile) preamble.push(`\\input{${authorsFile.path}}`);
    if (!preText.includes('\\date')) preamble.push('\\date{}');
  }

  const isTwoColumn = isIeee || isAcm || /\btwocolumn\b/i.test(preText) || /\bsigconf\b/i.test(preText) || /\bIEEEtran\b/.test(preText);
  const body: string[] = ['\\begin{document}'];
  if (isTwoColumn) body.push('\\sloppy');

  if (isElsevier) {
    body.push('\\begin{frontmatter}');
    if (titleFile) body.push(`\\input{${titleFile.path}}`);
    if (authorsFile) body.push(`\\input{${authorsFile.path}}`);
    if (abstractFile) body.push(`\\input{${abstractFile.path}}`);
    if (keywordsFile) body.push(`\\input{${keywordsFile.path}}`);
    for (const f of otherMetas) body.push(`\\input{${f.path}}`);
    body.push('\\end{frontmatter}');
  } else if (isAcm) {
    // In ACM (acmart), abstract and metadata precede \maketitle
    if (abstractFile) body.push(`\\input{${abstractFile.path}}`);
    if (keywordsFile) body.push(`\\input{${keywordsFile.path}}`);
    for (const f of otherMetas) body.push(`\\input{${f.path}}`);
    body.push('\\maketitle');
  } else if (isIeee) {
    // In IEEE (IEEEtran), two-column abstract & index terms must be declared in \IEEEtitleabstractindextext BEFORE \maketitle
    if (abstractFile || keywordsFile) {
      body.push('\\IEEEtitleabstractindextext{%');
      if (abstractFile) body.push(`  \\input{${abstractFile.path}}`);
      if (keywordsFile) body.push(`  \\input{${keywordsFile.path}}`);
      body.push('}');
    }
    body.push('\\maketitle');
    if (abstractFile || keywordsFile) {
      body.push('\\IEEEdisplaynontitleabstractindextext');
    }
    for (const f of otherMetas) body.push(`\\input{${f.path}}`);
  } else {
    // Standard article & LNCS
    body.push('\\maketitle');
    if (abstractFile) body.push(`\\input{${abstractFile.path}}`);
    if (keywordsFile) body.push(`\\input{${keywordsFile.path}}`);
    for (const f of otherMetas) body.push(`\\input{${f.path}}`);
  }

  // Sections in sorted numerical order (01_slug.tex, 02_slug.tex, ...)
  // Add \FloatBarrier between sections to flush pending floats and prevent drifting across sections
  for (let i = 0; i < sections.length; i++) {
    body.push(`\\input{${sections[i].path}}`);
    if (i < sections.length - 1) {
      body.push('\\FloatBarrier');
    }
  }

  // Build set of all float paths already referenced inside any section file content or body
  const referencedFloatPaths = new Set<string>();
  for (const f of sections) {
    const content = f.content || '';
    const inputRe = /\\input\s*\{\s*([^}]+)\s*\}/g;
    let m: RegExpExecArray | null;
    while ((m = inputRe.exec(content)) !== null) {
      referencedFloatPaths.add(m[1].trim());
    }
  }
  for (const line of body) {
    const m = line.match(/\\input\s*\{\s*([^}]+)\s*\}/);
    if (m) referencedFloatPaths.add(m[1].trim());
  }

  // Check if float figures are already rendered directly inside any section file (e.g. \includegraphics)
  for (const f of floats) {
    if (f.path.startsWith('floats/figures/')) {
      const imgMatch = f.content?.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
      if (imgMatch) {
        const imgName = imgMatch[1].replace(/^.*[\/\\]/, '').toLowerCase().trim();
        const alreadyInSections = sections.some(sec => {
          const secContent = (sec.content || '').toLowerCase();
          return secContent.includes(imgName);
        });
        if (alreadyInSections) {
          referencedFloatPaths.add(f.path);
        }
      }
    }
  }

  // Any floats not inlined inside sections are included safely before references
  for (const f of floats) {
    if (!referencedFloatPaths.has(f.path)) {
      body.push(`\\input{${f.path}}`);
    }
  }

  // Bibliography (Universal: handles thebibliography input, BibTeX files, and verdict reference lists)
  const hasDocumentRefs = !!(verdict?.references && Array.isArray(verdict.references) && verdict.references.length > 0);
  if (bib) {
    body.push(`\\input{references/bibliography.tex}`);
  } else if (bibFile) {
    const bstMatch = templateMainTex?.match(/\\bibliographystyle\{([^}]+)\}/);
    const bstStyle = bstMatch ? bstMatch[1] : (isIeee ? 'IEEEtran' : isAcm ? 'ACM-Reference-Format' : 'plain');
    body.push(`\\bibliographystyle{${bstStyle}}`);
    body.push(`\\bibliography{references/references}`);
  } else if (hasDocumentRefs) {
    body.push(`\\input{references/bibliography.tex}`);
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
      if (n.type === 'equation') return `\n[Equation: ${n.latex || n.text || ''}]\n`;
      if (n.text) return n.text;
      if (n.caption) return `[Caption: ${n.caption}]`;
      if (n.type === 'figure' || n.type === 'image' || n.type === 'chart') {
        const cap = n.caption || '';
        const fname = n.name || n.id || '';
        return `\n[Figure: ${fname}${cap ? ` | Caption: ${cap}` : ''}]\n`;
      }
      if (n.type === 'table') {
        const cap = n.caption || '';
        const content = n.html || (Array.isArray(n.rows) ? n.rows.map((r: any) => Array.isArray(r) ? r.join(' | ') : String(r)).join('\n') : n.text || '');
        return `\n[Table: ${cap}]\n${content}\n`;
      }
      if (n.type === 'algorithm') {
        const title = n.title || n.caption || '';
        const steps = Array.isArray(n.items) ? n.items.join('\n') : (n.text || '');
        return `\n[Algorithm: ${title}]\n${steps}\n`;
      }
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
      run: () => {
        // Generous frontmatter window + references tail so authors, affiliations, abstract, keywords, and bibliography are NEVER truncated
        const headPart = (fullTextForPasses || '').substring(0, 45000);
        const tailPart = (fullTextForPasses || '').length > 45000
          ? (fullTextForPasses || '').substring(Math.max(45000, (fullTextForPasses || '').length - 35000))
          : '';
        const metaWindow = tailPart ? `${headPart}\n\n[... middle of document elided ...]\n\n${tailPart}` : headPart;
        return runScopeWithRetry('metadata', { ...fullCtx, textWindow: metaWindow }, { userId, userEmail, projectId });
      },
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

  // ── Deterministic Content Backfill: Guarantee 100% section coverage & content fidelity ──
  const mathBlocks = structured.mathBlocks || [];

  // Map body nodes to existing float files to avoid duplicate inline float environments
  // Initialized once globally across the full body so float numbering is consistent
  const nodeToFloatPath = new Map<any, string>();
  let figCnt = 0, tabCnt = 0, algoCnt = 0;
  const seenFigureKeys = new Set<string>();
  const seenTableKeys = new Set<string>();
  for (const n of body) {
    if (n.type === 'figure' || n.type === 'image' || n.type === 'chart' || n.type === 'figure-group') {
      const figId = String(n.id || '').replace(/^.*[\/\\]/, '').toLowerCase().trim();
      const figCap = String(n.caption || '').toLowerCase().trim();
      const figKey = figId ? `${n.type}:${figId}` : (figCap ? `${n.type}:${figCap}` : '');
      if (figKey && seenFigureKeys.has(figKey)) {
        continue;
      }
      if (figKey) seenFigureKeys.add(figKey);
      figCnt++;
      const p = `floats/figures/${figCnt}.tex`;
      if (floatsRes.files.some(f => f.path === p)) {
        nodeToFloatPath.set(n, p);
      } else {
        const assembledNode = n.type === 'figure-group'
          ? LatexAssembler.assembleFigureGroup(n, mathBlocks)
          : LatexAssembler.assembleNode(n, mathBlocks);
        floatsRes.files.push({ path: p, content: assembledNode });
        nodeToFloatPath.set(n, p);
        console.log(`[AI-MODULAR] Backfilled missing figure float: ${p}`);
      }
    } else if (n.type === 'table') {
      const tableText = (n.text || n.html || '').replace(/\s+/g, ' ').trim();
      const tableCap = (n.caption || '').trim().toLowerCase();
      const tableKey = tableText.length > 20 ? tableText.substring(0, 300) : (tableCap ? `caption:${tableCap}` : '');
      if (tableKey && seenTableKeys.has(tableKey)) {
        continue;
      }
      if (tableKey) seenTableKeys.add(tableKey);
      tabCnt++;
      const p = `floats/tables/${tabCnt}.tex`;
      if (floatsRes.files.some(f => f.path === p)) {
        nodeToFloatPath.set(n, p);
      } else {
        const assembledNode = LatexAssembler.assembleTable(n, mathBlocks);
        floatsRes.files.push({ path: p, content: assembledNode });
        nodeToFloatPath.set(n, p);
        console.log(`[AI-MODULAR] Backfilled missing table float: ${p}`);
      }
    } else if (n.type === 'algorithm') {
      algoCnt++;
      const p = `floats/algorithms/${algoCnt}.tex`;
      if (floatsRes.files.some(f => f.path === p)) {
        nodeToFloatPath.set(n, p);
      } else {
        const assembledNode = LatexAssembler.assembleAlgorithm(n, mathBlocks);
        floatsRes.files.push({ path: p, content: assembledNode });
        nodeToFloatPath.set(n, p);
        console.log(`[AI-MODULAR] Backfilled missing algorithm float: ${p}`);
      }
    }
  }

  const assembleBackfilledNode = (n: any): string => {
    const floatPath = nodeToFloatPath.get(n);
    if (floatPath) {
      return `\\input{${floatPath}}`;
    }
    return LatexAssembler.assembleNode(n, mathBlocks);
  };

  for (let idx = 0; idx < sectionGroups.length; idx++) {
    const g = sectionGroups[idx];
    const secNum = idx + 1;
    const rawTitle = String(g.heading?.text || 'section');
    const safeTitle = slugifySectionTitle(rawTitle, 40);
    const expectedPrefix = `sections/${secNum.toString().padStart(2, '0')}_`;

    // Look for an existing file from AI for this section
    const matchedFile = sectionFiles.find(f =>
      f.path.startsWith(expectedPrefix) ||
      (f.path.startsWith('sections/') && f.path.includes(safeTitle))
    );

    const sourceGroupProse = g.nodes.map((n: any) => n.text || '').join('\n').trim();

    if (matchedFile) {
      // Check if AI returned a stub / truncated content while source had substantial prose
      const emittedContent = (matchedFile.content || '').trim();
      if (sourceGroupProse.length > 200 && (emittedContent.length < 150 || emittedContent.length < sourceGroupProse.length * 0.5)) {
        console.warn(`[AI-MODULAR] Section "${rawTitle}" emitted only ${emittedContent.length} chars vs ${sourceGroupProse.length} source prose chars. Deterministically backfilling.`);
        const backfilledNodes = [g.heading, ...g.nodes];
        matchedFile.content = backfilledNodes.map(assembleBackfilledNode).join('\n\n');
      } else {
        // Ensure any floats that belong to this section are inlined if AI omitted them!
        const sectionFloatNodes = g.nodes.filter((n: any) =>
          n.type === 'figure' || n.type === 'image' || n.type === 'chart' || n.type === 'table' || n.type === 'algorithm'
        );
        for (const fn of sectionFloatNodes) {
          const floatPath = nodeToFloatPath.get(fn);
          if (!floatPath) continue;
          const floatBase = floatPath.replace(/\.tex$/, '');
          const hasRef = matchedFile.content.includes(floatPath) ||
                         matchedFile.content.includes(floatBase) ||
                         (fn.id && matchedFile.content.includes(String(fn.id)));
          if (!hasRef) {
            const fnIdx = g.nodes.indexOf(fn);
            let prevNodeText = '';
            for (let pi = fnIdx - 1; pi >= 0; pi--) {
              if (g.nodes[pi]?.text && g.nodes[pi].text.trim().length > 20) {
                prevNodeText = g.nodes[pi].text.trim().slice(0, 40);
                break;
              }
            }
            let placed = false;
            if (prevNodeText) {
              const pIdx = matchedFile.content.indexOf(prevNodeText);
              if (pIdx !== -1) {
                const nextNewline = matchedFile.content.indexOf('\n\n', pIdx);
                const insPoint = nextNewline !== -1 ? nextNewline + 2 : matchedFile.content.length;
                matchedFile.content = matchedFile.content.slice(0, insPoint) + `\n\\input{${floatPath}}\n\n` + matchedFile.content.slice(insPoint);
                placed = true;
              }
            }
            if (!placed) {
              matchedFile.content = `${matchedFile.content.trim()}\n\n\\input{${floatPath}}\n`;
            }
          }
        }
      }
    } else {
      // AI completely skipped this section file! Deterministically generate it!
      const targetPath = `sections/${secNum.toString().padStart(2, '0')}_${safeTitle}.tex`;
      console.warn(`[AI-MODULAR] AI omitted section "${rawTitle}". Deterministically creating ${targetPath}.`);
      const backfilledNodes = [g.heading, ...g.nodes];
      const backfilledContent = backfilledNodes.map(assembleBackfilledNode).join('\n\n');
      sectionFiles.push({
        path: targetPath,
        content: backfilledContent,
      });
    }
  }

  // Universal in-text citation linking on all AI-generated section files
  const docRefs = Array.isArray(structured?.references) && structured.references.length > 0
    ? structured.references
    : (Array.isArray(verdict?.references) ? verdict.references : []);
  if (docRefs.length > 0) {
    const rawRefs = docRefs.map((r: any) => typeof r === 'string' ? r : r?.text || '').filter(Boolean);
    for (const sf of sectionFiles) {
      sf.content = LatexAssembler.linkCitationsInLatex(sf.content, rawRefs);
    }
  }

  // Re-sort section files in numerical order
  sectionFiles.sort((a, b) => a.path.localeCompare(b.path));

  const files = [...floatsRes.files, ...sectionFiles, ...metadataRes.files];
  const totalRejected = floatsRes.rejected + metadataRes.rejected + sectionRejected;

  // ── Universal Fail-Safe Metadata & Bibliography Backfill ──
  const hasTitle = files.some(f => f.path === 'metadata/title.tex');
  const hasAuthors = files.some(f => f.path === 'metadata/authors.tex');
  const hasBib = files.some(f => f.path === 'references/bibliography.tex');
  const hasBibFile = files.some(f => f.path === 'references/references.bib' || f.path === 'references.bib');
  const docHasReferences = docRefs.length > 0;

  if (!hasTitle || !hasAuthors || (docHasReferences && (!hasBib || !hasBibFile))) {
    console.warn(`[AI-MODULAR] Backfilling missing frontmatter or bibliography files deterministically.`);
    const det = ModularLatexAssembler.assemble(structured as any, templateId, templateMainTex);
    if (!hasTitle && det.files['metadata/title.tex']) {
      files.push({ path: 'metadata/title.tex', content: det.files['metadata/title.tex'] });
    }
    if (!hasAuthors && det.files['metadata/authors.tex']) {
      files.push({ path: 'metadata/authors.tex', content: det.files['metadata/authors.tex'] });
    }
    if (!files.some(f => f.path === 'metadata/abstract.tex') && det.files['metadata/abstract.tex']) {
      files.push({ path: 'metadata/abstract.tex', content: det.files['metadata/abstract.tex'] });
    }
    if (!files.some(f => f.path === 'metadata/keywords.tex') && det.files['metadata/keywords.tex']) {
      files.push({ path: 'metadata/keywords.tex', content: det.files['metadata/keywords.tex'] });
    }
    if (docHasReferences && !hasBib && det.files['references/bibliography.tex']) {
      files.push({ path: 'references/bibliography.tex', content: det.files['references/bibliography.tex'] });
      console.log('[AI-MODULAR] Backfilled references/bibliography.tex from deterministic assembler.');
    }
    if (docHasReferences && !hasBibFile && det.files['references/references.bib']) {
      files.push({ path: 'references/references.bib', content: det.files['references/references.bib'] });
      files.push({ path: 'references.bib', content: det.files['references/references.bib'] });
      console.log('[AI-MODULAR] Backfilled references/references.bib from deterministic assembler.');
    }
  }

  // Ensure affiliations and co-authors were not skipped by AI in metadata/authors.tex
  const authorsFile = files.find(f => f.path === 'metadata/authors.tex');
  if (authorsFile) {
    const det = ModularLatexAssembler.assemble(structured as any, templateId, templateMainTex);
    const detAuthors = det.files['metadata/authors.tex'] || '';
    const detHasAffil = /\\(?:affil|institute|IEEEauthorblockA|affiliation)\b/.test(detAuthors);
    const aiHasAffil = /\\(?:affil|institute|IEEEauthorblockA|affiliation)\b/.test(authorsFile.content || '');
    const missingCoAuthor = (structured.authors || []).slice(1).some((a: any) => {
      const aName = String(a.name || '').trim().toLowerCase();
      return aName.length > 3 && !(authorsFile.content || '').toLowerCase().includes(aName);
    });

    if (detAuthors && ((detHasAffil && !aiHasAffil) || missingCoAuthor)) {
      console.warn(`[AI-MODULAR] AI metadata/authors.tex omitted affiliations or co-authors. Restoring from deterministic assembler.`);
      authorsFile.content = detAuthors;
    }
  }

  console.log(`[AI-MODULAR] Parallel mapping complete: ${files.length} validated files (${floatsRes.files.length} floats, ${sectionFiles.length} sections, ${files.filter(f => f.path.startsWith('metadata/')).length} metadata), ${totalRejected} rejected`);

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

  const mainTex = composeMainTex(templateId, templateMainTex, files, verdict);
  return {
    mainTex,
    files,
    model: models.filter(Boolean)[0] || 'unknown',
    rejected: totalRejected,
  };
}
