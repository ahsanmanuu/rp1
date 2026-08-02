import { routeToAgent } from './agent-gateway';
import { countCitationsFromHtml } from './citationCounting';
import { validateAiLatexFragments } from './latex-fragment-validator';
import type { AiLatexFragments } from './latex-fragment-validator';
import type { StructuredDocument, AuthorInfo } from './deep-parser';

/**
 * AI-assisted structural verification for converted manuscripts.
 *
 * The heuristic parser (DeepDocumentParser) extracts manuscript components with
 * regex/DOM scoring. This module runs a second, AI-driven pass that VERIFIES
 * and CORRECTS that extraction (title, authors, affiliations, abstract,
 * keywords, section hierarchy, component counts, references) using the agent
 * gateway backend. Heuristic output is always preserved as the fallback: if
 * the AI pass is unavailable, slow, or invalid, nothing is modified.
 */

export interface AiStructureComponents {
  figures?: number | null;
  charts?: number | null;
  tables?: number | null;
  equations?: number | null;
  pseudocode?: number | null;
  citations?: number | null;
  references?: number | null;
}

export interface AiStructureVerdict {
  title?: { text?: string; confidence?: number } | null;
  authors?: Array<{ name?: string; affiliations?: string[] }> | null;
  affiliations?: string[] | null;
  abstract?: { text?: string; confidence?: number } | null;
  keywords?: string[] | null;
  sections?: Array<{ title?: string; level?: number }> | null;
  figures?: Array<{ caption?: string }> | null;
  tables?: Array<{ caption?: string }> | null;
  algorithms?: Array<{ title?: string }> | null;
  components?: AiStructureComponents | null;
  references?: string[] | null;
}

// Per-pass windows: each pass gets its own shorter race so a slow structure
// pass never blocks the (fast, small) front-matter pass results. The
// front-matter pass (small input) is fast; the structure pass (full text)
// gets more time. Heuristics are the fallback when a pass misses its window.
// Windows are kept well under the platform request cap (Render starter ~300s)
// so the upload request always completes: worst case = max(passA, passB).
const FRONTMATTER_PASS_TIMEOUT_MS = 90000;
const STRUCTURE_PASS_TIMEOUT_MS = 120000;

// Extra budget for the scoped count re-verification pass (only fires when the
// AI's count disagrees with the deterministic count by more than 1).
const RECOUNT_PASS_TIMEOUT_MS = 40000;

// Races an AI pass against a deadline. When the deadline wins, the underlying
// request is ABORTED (via AbortSignal) instead of being left to run as a
// zombie — the orchestrator forwards the signal to the provider call, freeing
// the worker/queue slot and cutting wall-clock time on slow passes.
function withAbortableTimeout<T>(
  promise: Promise<T>,
  ms: number,
  controller: AbortController
): Promise<T | null> {
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

// Max characters of manuscript text sent to the AI (front + tail preserved).
// Must be large enough to cover all figures, tables, equations, and sections
// in the middle of the document — the primary cause of inconsistent counts
// was mid-document elision. With a strong provider (OpenRouter/Gemini key
// configured) most of the document up to 160K chars is sent, eliminating
// mid-document elision for typical manuscripts while keeping the prompt
// within the pass budget; otherwise fall back to a compact 24K window that
// fits free-tier model contexts.
const HAS_STRONG_PROVIDER = !!(process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY);
const FULL_TEXT_LIMIT = HAS_STRONG_PROVIDER ? 160000 : 24000;
const FULL_TEXT_TAIL = HAS_STRONG_PROVIDER ? 10000 : 6000;

// Strongest configured provider for structure passes (fallback via provider
// chain in callLLM). null → registry default model.
const AI_MODEL_OVERRIDE = process.env.OPENROUTER_API_KEY
  ? 'google/gemini-2.5-flash-001'
  : process.env.GEMINI_API_KEY
    ? 'gemini-2.5-flash'
    : null;

// Cost-sensitive passes (component-latex generation, count re-verification):
// when no paid override is configured, route them to the cheapest available
// model (free providers first) instead of the registry default — the output
// of these passes is strictly validated upstream, so cheap is safe here.
const AI_CHEAP_FALLBACK_MODEL = (() => {
  try {
    const { getCheapestModel } = require('./agent-gateway/model-costs');
    const { GATEWAY_CONFIG } = require('./agent-gateway/config');
    return getCheapestModel(GATEWAY_CONFIG.providers, { minTier: 1 });
  } catch {
    return null;
  }
})();
if (AI_CHEAP_FALLBACK_MODEL) {
  console.log(`[AI-Structure] Cheapest-model fallback for cost-sensitive passes: ${AI_CHEAP_FALLBACK_MODEL}`);
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAuthorName(name: string): string {
  return name
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[*†‡§¶]+$/g, '')
    .replace(/[\d]+$/g, '')
    .trim();
}

function cleanAffiliation(aff: string): string {
  const clean = aff
    .replace(/^[\d*†‡§]+[.\s]*/g, '')
    .replace(/[;,]?\s*(?:e-?mail[^;,.|]*|email[^;,.|]*)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean || clean.length < 4) return '';
  if (/@/.test(clean) && clean.length < 12) return '';
  return clean;
}

function normalizeTitleKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/^[\s\d.\-–—:()\[\]]+/, '')
    .replace(/^(?:[ivxlcdm]+\.?)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeStringArray(value: unknown, maxItems: number, minLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const clean = item.replace(/\s+/g, ' ').trim();
    if (clean.length < minLen) continue;
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}

function sanitizeCaptionArray(
  value: unknown,
  maxItems: number,
  key: 'caption' | 'title'
): Array<{ caption?: string } | { title?: string }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: Array<{ caption?: string } | { title?: string }> = [];
  for (const item of value) {
    let text = '';
    if (typeof item === 'string') text = item;
    else if (item && typeof item === 'object') text = String((item as any)[key] || '');
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length < 3) continue;
    out.push(key === 'title' ? { title: text } : { caption: text });
    if (out.length >= maxItems) break;
  }
  return out.length > 0 ? out : undefined;
}

function normalizeVerdict(raw: any): AiStructureVerdict | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const verdict: AiStructureVerdict = {};

  if (raw.title && typeof raw.title === 'object') {
    verdict.title = {
      text: typeof raw.title.text === 'string' ? raw.title.text.trim() : '',
      confidence: typeof raw.title.confidence === 'number' ? raw.title.confidence : 100,
    };
  }

  if (Array.isArray(raw.authors)) {
    const authors: Array<{ name?: string; affiliations?: string[] }> = [];
    for (const a of raw.authors.slice(0, 30)) {
      if (!a || typeof a !== 'object') continue;
      const name = cleanAuthorName(String(a.name || '').trim());
      if (!name || name.length < 3) continue;
      if (/^(author|anonymous|unknown|n\/?a|et\.?\s?al\.?)$/i.test(name)) continue;
      if (/@/.test(name)) continue;
      const affs = sanitizeStringArray(a.affiliations, 6, 4).map(cleanAffiliation).filter(Boolean);
      authors.push({ name, affiliations: affs.length > 0 ? affs : undefined });
    }
    if (authors.length > 0) verdict.authors = authors;
  }

  const affiliations = sanitizeStringArray(raw.affiliations, 20, 4).map(cleanAffiliation).filter(Boolean);
  if (affiliations.length > 0) verdict.affiliations = affiliations;

  if (raw.abstract && typeof raw.abstract === 'object') {
    verdict.abstract = {
      text: typeof raw.abstract.text === 'string' ? raw.abstract.text.trim() : '',
      confidence: typeof raw.abstract.confidence === 'number' ? raw.abstract.confidence : 100,
    };
  }

  const keywords = sanitizeStringArray(raw.keywords, 12, 2);
  if (keywords.length > 0) verdict.keywords = keywords;

  if (Array.isArray(raw.sections)) {
    const sections: Array<{ title?: string; level?: number }> = [];
    for (const s of raw.sections.slice(0, 60)) {
      if (!s || typeof s !== 'object') continue;
      const title = String(s.title || '').replace(/\s+/g, ' ').trim();
      if (!title || title.length < 2) continue;
      sections.push({ title, level: s.level === 2 ? 2 : 1 });
    }
    if (sections.length > 0) verdict.sections = sections;
  }

  const figures = sanitizeCaptionArray(raw.figures, 80, 'caption');
  if (figures) verdict.figures = figures as Array<{ caption?: string }>;

  const tables = sanitizeCaptionArray(raw.tables, 80, 'caption');
  if (tables) verdict.tables = tables as Array<{ caption?: string }>;

  const algorithms = sanitizeCaptionArray(raw.algorithms, 30, 'title');
  if (algorithms) verdict.algorithms = algorithms as Array<{ title?: string }>;

  if (raw.components && typeof raw.components === 'object') {
    const c = raw.components;
    const components: AiStructureComponents = {};
    for (const key of ['figures', 'charts', 'tables', 'equations', 'pseudocode', 'citations', 'references'] as const) {
      if (typeof c[key] === 'number' && Number.isFinite(c[key]) && c[key] >= 0) {
        components[key] = Math.round(c[key]);
      }
    }
    if (Object.keys(components).length > 0) verdict.components = components;
  }

  const references = sanitizeStringArray(raw.references, 250, 10);
  if (references.length > 0) verdict.references = references;

  const hasAny =
    (verdict.title?.text && verdict.title.text.length > 0) ||
    !!verdict.authors ||
    !!verdict.affiliations ||
    (verdict.abstract?.text && verdict.abstract.text.length > 0) ||
    !!verdict.keywords ||
    !!verdict.sections ||
    !!verdict.components ||
    !!verdict.references;

  return hasAny ? verdict : null;
}

/**
 * Deterministic in-text citation counter (PDF/plain-text path; the HTML path
 * reuses the exact shared countCitationsFromHtml so client and server always
 * agree). Reference-list region is excluded like the HTML counter does.
 */
function countCitationsFromPlainText(text: string): number {
  const cut = (text || '').replace(
    /\n\s*(?:\d+[.)]\s*)?(?:references|bibliography|literature\s+cited)\s*[:.\-]?[^\n]*$/i,
    ''
  );
  const matches = cut.match(/\[\s*\d{1,3}(?:\s*[,;\u2013\-]\s*\d{1,3})*\s*\]/g) || [];
  const seen = new Set<number>();
  for (const m of matches) {
    const parts = m.replace(/[\[\]\s]/g, '').split(/[,;\u2013\-]/).filter(Boolean);
    for (const part of parts) {
      const n = parseInt(part, 10);
      if (!isNaN(n) && n > 0) seen.add(n);
    }
  }
  return seen.size;
}

/** Normalized text used for containment verification against the document. */
function normText(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministic reconciliation of the AI verdict against the ACTUAL document
 * text. This is what keeps results identical for the same document (no drift
 * per upload) and prevents AI hallucinations from ever reaching the report or
 * the flushed LaTeX:
 *  - sections / captions / references must exist in the text (containment);
 *  - citations use the shared deterministic counter;
 *  - reference count anchors on the heuristically-extracted entries;
 *  - equations/pseudocode anchor on actual parsed math/algorithm blocks.
 */
function reconcileVerdict(
  verdict: AiStructureVerdict,
  deepData: StructuredDocument,
  plainText: string,
  rawHtml?: string
): AiStructureVerdict {
  const haystack = normText(plainText);
  const inText = (s: string): boolean => {
    if (!s || s.length < 4) return false;
    return haystack.includes(normText(s));
  };

  // ── Sections: keep only AI sections whose title actually appears in text ──
  if (verdict.sections && verdict.sections.length > 0) {
    const verified = verdict.sections.filter(s => {
      const t = String(s?.title || '').replace(/\s+/g, ' ').trim();
      if (!t) return false;
      if (inText(t)) return true;
      // Allow numbering-stripped match (e.g. "1. Introduction" -> "introduction")
      return inText(t.replace(/^[\d\s.\-–—:()[\]ivxlcdm]+/i, ''));
    });
    verdict.sections = verified.length > 0 ? verified : verdict.sections;
  }

  // ── Figure / table / algorithm lists: drop captions not in the text ──
  const verifyCaptions = (list: Array<{ caption?: string }> | null | undefined): Array<{ caption?: string }> | undefined => {
    if (!list || list.length === 0) return undefined;
    const verified = list.filter(c => {
      const cap = String(c?.caption || '').replace(/\s+/g, ' ').trim();
      if (!cap) return false;
      if (inText(cap)) return true;
      // Match the caption body without its "Figure N"/"TABLE N" prefix
      return inText(cap.replace(/^(?:fig(?:ure)?|tab(?:le)?|alg(?:orithm)?|chart|img(?:age)?)[.\s]*[\dIVXLC]*-?[.\s:-]*/i, ''));
    });
    return verified.length > 0 ? verified : list;
  };
  verdict.figures = verifyCaptions(verdict.figures) ?? verdict.figures;
  verdict.tables = verifyCaptions(verdict.tables) ?? verdict.tables;
  if (verdict.algorithms && verdict.algorithms.length > 0) {
    const verified = verdict.algorithms.filter(a => {
      const t = String(a?.title || '').replace(/\s+/g, ' ').trim();
      if (!t) return false;
      return inText(t) || inText(t.replace(/^algorithm[\s\d:.-]*/i, ''));
    });
    verdict.algorithms = verified.length > 0 ? verified : verdict.algorithms;
  }

  // ── References: keep only entries that exist verbatim in the text ──
  if (verdict.references && verdict.references.length > 0) {
    const verified = verdict.references.filter(r => {
      const clean = String(r || '').replace(/\s+/g, ' ').trim();
      if (!clean) return false;
      // Compare the first ~100 chars (authors + year) against the document
      return inText(clean.substring(0, 100));
    });
    if (verified.length > 0) verdict.references = verified;
  }

  // ── Components: deterministic anchors + AI full-text analysis ──────────
  // Strategy: citations use the deterministic shared counter (ground truth).
  // For all other components we keep the maximum of (deterministic count, AI
  // count) so NEITHER side can accidentally DROP a legitimately detected
  // component, but every AI count is BOUNDED above by a multiple of the
  // parser's evidence — a count with no corresponding body node is a
  // hallucination, and hallucinations must never inflate the stats.
  const comps: AiStructureComponents = { ...(verdict.components || {}) };
  const body = deepData.body || [];
  const countByType = (types: string[]): number => body.filter(n => types.includes(n.type)).length;
  const mathBlocks = (deepData.mathBlocks || []) as Array<{ latex?: string }>;
  // AI may report at most 2x the parser's evidence (+5 slack for genuinely
  // missed nodes) — beyond that the number is treated as unreliable.
  const bound = (det: number, ai: number): number =>
    Math.min(Math.max(det, ai), det * 2 + 5);

  // Citations: deterministic shared counter is GROUND TRUTH (identical to
  // the client display). Always overrides the AI count.
  const detCitations = rawHtml
    ? countCitationsFromHtml(rawHtml)
    : countCitationsFromPlainText(plainText);
  if (detCitations > 0) comps.citations = detCitations;

  // References: heuristic-extracted entries are ground truth for the count.
  const detRefs = (deepData.references || []).length;
  if (detRefs > 0) comps.references = detRefs;

  // Equations: ground against detected display math blocks & body equation nodes.
  const detDisplayMath = (mathBlocks || []).filter((m: any) => m && (typeof m === 'object' ? m.isDisplay : false)).length;
  const detBodyEq = countByType(['equation']);
  const detEquations = Math.max(detDisplayMath, detBodyEq);
  if (detEquations > 0) {
    comps.equations = bound(detEquations, typeof comps.equations === 'number' ? comps.equations : 0);
  } else {
    // Parser found no equation evidence; the AI's count is unverifiable.
    comps.equations = 0;
  }

  // Pseudocode: bounded max of (body algorithm nodes, AI count).
  const detPseudo = countByType(['algorithm']);
  comps.pseudocode = bound(detPseudo, typeof comps.pseudocode === 'number' ? comps.pseudocode : 0);

  // Tables: ground against verified table list and detected table body nodes.
  const detTables = countByType(['table']);
  const verifiedTableCount = verdict.tables ? verdict.tables.length : 0;
  if (detTables > 0) {
    comps.tables = bound(detTables, verifiedTableCount > 0 ? verifiedTableCount : (typeof comps.tables === 'number' ? comps.tables : 0));
  } else {
    comps.tables = detTables;
  }

  // Figures: bounded max of (body figure/image nodes, AI count). Charts are a
  // separate component (counted by their own body nodes) so figures and charts
  // can never double-count.
  const detFigures = countByType(['figure', 'figure-group', 'image']);
  const detCharts = countByType(['chart']);
  comps.figures = bound(detFigures, typeof comps.figures === 'number' ? comps.figures : 0);
  comps.charts = bound(detCharts, typeof comps.charts === 'number' ? comps.charts : 0);

  if (Object.keys(comps).length > 0) verdict.components = comps;
  return verdict;
}

/**
 * Runs the AI structural analysis for a parsed manuscript.
 * Two specialized passes run in PARALLEL (metadata on the small front matter,
 * structure on the full text) so the wall-clock time is bounded by the slower
 * pass instead of one oversized call — faster AND more accurate. Every AI
 * claim is then reconciled against the actual document text.
 * Returns null when both passes are unavailable/timed out — callers MUST fall
 * back to the heuristic parse untouched.
 */
export async function analyzeManuscriptStructure(
  deepData: StructuredDocument,
  opts: { html?: string; pdfText?: string; filename: string; userId?: string | null; imageFiles?: string[] }
): Promise<{ verdict: AiStructureVerdict; model: string; aiLatex: AiLatexFragments | null } | null> {
  try {
    const sectionTitles: string[] = [];
    const figureCaptions: string[] = [];
    const tableCaptions: string[] = [];
    const algorithmTitles: string[] = [];
    for (const n of deepData.body || []) {
      if (n.type === 'heading' && n.text) sectionTitles.push(n.text);
      else if ((n.type === 'figure' || n.type === 'image' || n.type === 'chart') && n.caption) figureCaptions.push(n.caption);
      else if (n.type === 'table' && n.caption) tableCaptions.push(n.caption);
      else if (n.type === 'algorithm' && n.title) algorithmTitles.push(n.title);
    }

    const plainText = opts.html ? stripTags(opts.html) : opts.pdfText || '';
    const frontMatter = plainText.substring(0, 12000);
    // Full-document evidence: front + tail always preserved (tail holds the
    // reference list). Bounded size keeps the pass fast and accurate.
    let fullText = plainText;
    if (fullText.length > FULL_TEXT_LIMIT) {
      const keepFront = FULL_TEXT_LIMIT - FULL_TEXT_TAIL;
      fullText =
        `${plainText.substring(0, keepFront)}\n...[middle of document elided for length]...\n` +
        plainText.substring(plainText.length - FULL_TEXT_TAIL);
    }
    const equationSnippets = ((deepData.mathBlocks || []) as Array<{ latex?: string }>)
      .filter(m => m.latex)
      .map(m => String(m.latex).substring(0, 200))
      .slice(0, 30);

    const documentTitle = opts.filename.replace(/\.[^/.]+$/, '');
    const baseContext = {
      userId: opts.userId ?? null,
      documentTitle,
    };

    // Pass A — front matter (title/authors/affiliations/abstract/keywords)
    const passAController = new AbortController();
    const passA = withAbortableTimeout(
      routeToAgent({
        agent: 'structure-frontmatter',
        messages: [{ role: 'user', content: 'Analyze this manuscript front matter and return the structured JSON verdict.' }],
        context: {
          ...baseContext,
          modelOverride: AI_MODEL_OVERRIDE,
          frontMatter,
          heuristic: {
            title: deepData.title,
            authors: (deepData.authors || []).map(a => a.name),
            abstractLength: (deepData.abstract || '').length,
            keywords: deepData.keywords,
          },
        },
        signal: passAController.signal,
      }),
      FRONTMATTER_PASS_TIMEOUT_MS,
      passAController
    );

    const passBController = new AbortController();
    const passB = withAbortableTimeout(
      routeToAgent({
        agent: 'structure-analyze',
        messages: [{ role: 'user', content: 'Analyze this manuscript and return the structured JSON verdict.' }],
        context: {
          ...baseContext,
          modelOverride: AI_MODEL_OVERRIDE,
          fullText,
          frontMatter,
          documentTail: plainText.length > 12000
            ? plainText.substring(Math.max(12000, plainText.length - 8000))
            : '',
          sectionTitles: sectionTitles.slice(0, 150),
          figureCaptions: figureCaptions.slice(0, 80),
          tableCaptions: tableCaptions.slice(0, 80),
          algorithmTitles: algorithmTitles.slice(0, 40),
          equationSnippets,
          referenceEntries: (deepData.references || []).slice(0, 150),
          heuristic: {
            title: deepData.title,
            authors: (deepData.authors || []).map(a => a.name),
            abstractLength: (deepData.abstract || '').length,
            keywords: deepData.keywords,
            stats: deepData.stats,
          },
        },
        signal: passBController.signal,
      }),
      STRUCTURE_PASS_TIMEOUT_MS,
      passBController
    );

    const passCController = new AbortController();
    const passC = withAbortableTimeout(
      routeToAgent({
        agent: 'structure-latex',
        messages: [{ role: 'user', content: 'Identify the manuscript components and create modular LaTeX code for each figure, chart, table and algorithm.' }],
        context: {
          ...baseContext,
          modelOverride: AI_MODEL_OVERRIDE || AI_CHEAP_FALLBACK_MODEL,
          fullText: plainText.substring(0, 24000),
          imageMap: (opts.imageFiles || []).map((f, i) => ({ index: i + 1, filename: f })),
          figureCaptions: figureCaptions.slice(0, 80),
          tableCaptions: tableCaptions.slice(0, 80),
          algorithmTitles: algorithmTitles.slice(0, 40),
          counts: {
            figures: deepData.stats?.imageCount || 0,
            charts: deepData.stats?.chartCount || 0,
            tables: (deepData.body || []).filter(n => n.type === 'table').length,
            pseudocode: (deepData.body || []).filter(n => n.type === 'algorithm').length,
          },
        },
        signal: passCController.signal,
      }),
      STRUCTURE_PASS_TIMEOUT_MS,
      passCController
    );

    const [resA, resB, resC] = await Promise.all([passA, passB, passC]);

    const rawA = resA && resA.success && resA.data && !(resA.data as any)._failSafe && !(resA.data as any)._partial
      ? (resA.data as any)
      : null;
    const rawB = resB && resB.success && resB.data && !(resB.data as any)._failSafe && !(resB.data as any)._partial
      ? (resB.data as any)
      : null;

    const verdictA = rawA ? normalizeVerdict(rawA) : null;
    const verdictB = rawB ? normalizeVerdict(rawB) : null;
    if (!verdictA && !verdictB) {
      console.warn('[AI-Structure] Both AI passes unavailable, keeping heuristic parse.');
      return null;
    }

    // Merge: front-matter pass wins for metadata, structure pass wins for the
    // rest. Either pass succeeding alone still yields a usable verdict.
    const verdict: AiStructureVerdict = {
      ...(verdictB || {}),
      ...(verdictA || {}),
      sections: verdictB?.sections ?? verdictA?.sections,
      figures: verdictB?.figures ?? verdictA?.figures,
      tables: verdictB?.tables ?? verdictA?.tables,
      algorithms: verdictB?.algorithms ?? verdictA?.algorithms,
      components: {
        ...(verdictA?.components || {}),
        ...(verdictB?.components || {}),
      },
      references: verdictB?.references ?? verdictA?.references,
    };

    // Deterministic verification against the actual document text.
    reconcileVerdict(verdict, deepData, plainText, opts.html);

    // ── Scoped count re-verification (equations/pseudocode only) ──────────
    // Figures/charts are clamped to real assets downstream; tables/references
    // are containment-verified in reconcileVerdict. Equations and pseudocode
    // counts flow straight from max(det, AI) — when the AI claims noticeably
    // MORE than the parser found, ask it once to recount from the text. The
    // refined answer replaces the AI count when it returns a number.
    const detEquations = Math.max(
      (deepData.mathBlocks || []).filter((m: any) => m && (typeof m === 'object' ? m.isDisplay : false)).length,
      (deepData.body || []).filter(n => n.type === 'equation').length
    );
    const detPseudo = (deepData.body || []).filter(n => n.type === 'algorithm').length;
    const compsNow = verdict.components || {};
    const recountTargets: string[] = [];
    if (typeof compsNow.equations === 'number' && detEquations > 0 && compsNow.equations > detEquations + 1) {
      recountTargets.push(`equations: parser found ${detEquations}, you reported ${compsNow.equations}`);
    }
    if (typeof compsNow.pseudocode === 'number' && detPseudo > 0 && compsNow.pseudocode > detPseudo + 1) {
      recountTargets.push(`pseudocode/algorithms: parser found ${detPseudo}, you reported ${compsNow.pseudocode}`);
    }
    let finalVerdict = verdict;
    if (recountTargets.length > 0) {
      try {
        const recountController = new AbortController();
        const recount = await withAbortableTimeout(
          routeToAgent({
            agent: 'structure-analyze',
            messages: [{ role: 'user', content: 'Recount the specified components and return the full structured JSON verdict.' }],
            context: {
              ...baseContext,
              modelOverride: AI_MODEL_OVERRIDE || AI_CHEAP_FALLBACK_MODEL,
              fullText: plainText.substring(0, 24000),
              frontMatter,
              sectionTitles: sectionTitles.slice(0, 60),
              figureCaptions: figureCaptions.slice(0, 40),
              tableCaptions: tableCaptions.slice(0, 40),
              algorithmTitles: algorithmTitles.slice(0, 25),
              equationSnippets,
              referenceEntries: (deepData.references || []).slice(0, 80),
              heuristic: {
                title: deepData.title,
                authors: (deepData.authors || []).map(a => a.name),
                stats: deepData.stats,
              },
              recountInstruction:
                'VERIFICATION MODE: your previous counts were WRONG. Recount precisely and return the complete JSON with ONLY the corrected counts. Mismatches: ' +
                recountTargets.join('; '),
            },
            signal: recountController.signal,
          }),
          RECOUNT_PASS_TIMEOUT_MS,
          recountController
        );
        const rawRecount =
          recount && recount.success && recount.data && !(recount.data as any)._failSafe && !(recount.data as any)._partial
            ? (recount.data as any)
            : null;
        if (rawRecount?.components && typeof rawRecount.components === 'object') {
          const rc = rawRecount.components;
          const merged = { ...verdict.components };
          for (const key of ['equations', 'pseudocode'] as const) {
            if (typeof rc[key] === 'number' && Number.isFinite(rc[key]) && rc[key] >= 0) {
              // Clamp the AI's recount to a sane bound above the deterministic
              // count — a "verified" count that triples the parser's evidence
              // is a hallucination, not a correction.
              const detBound = key === 'equations' ? Math.max(detEquations * 2, detEquations + 5) : Math.max(detPseudo * 2, detPseudo + 5);
              merged[key] = Math.min(Math.round(rc[key]), detBound);
            }
          }
          finalVerdict = { ...verdict, components: merged };
          console.warn(`[AI-Structure] Count re-verification applied (${recountTargets.length} mismatch(es)):`, merged);
        }
      } catch (recountErr: any) {
        console.warn('[AI-Structure] Count re-verification failed (non-critical):', recountErr?.message || recountErr);
      }
    }

    // ── Pass C: validate the AI-generated component LaTeX fragments ────────
    let aiLatex: AiLatexFragments | null = null;
    if (resC && resC.success && resC.data && !(resC.data as any)._failSafe && !(resC.data as any)._partial) {
      try {
        aiLatex = validateAiLatexFragments(resC.data, opts.imageFiles || []);
        if (aiLatex) {
          const total = (aiLatex.figures?.length || 0) + (aiLatex.charts?.length || 0) + (aiLatex.tables?.length || 0) + (aiLatex.algorithms?.length || 0);
          console.log(`[AI-Structure] Validated ${total} AI component LaTeX fragment(s).`);
        }
      } catch (fragErr: any) {
        console.warn('[AI-Structure] Fragment validation failed (non-critical):', fragErr?.message || fragErr);
      }
    }

    const model = [resA?.model, resB?.model, resC?.model].filter(Boolean)[0] || 'unknown';
    return { verdict: finalVerdict, model, aiLatex };
  } catch (err: any) {
    console.warn('[AI-Structure] Analysis failed (non-critical):', err?.message || err);
    return null;
  }
}

/**
 * Applies confident AI corrections onto the parsed document IN PLACE.
 * The document is consumed by the ModularLatexAssembler afterwards, so
 * corrections flow directly into the mapped/flushed LaTeX files
 * (metadata/title.tex, metadata/authors.tex, metadata/abstract.tex,
 * metadata/keywords.tex, metadata/organizations.json, sections/*).
 */
export function applyStructureCorrections(
  deepData: StructuredDocument,
  verdict: AiStructureVerdict,
  model: string
): { applied: string[] } {
  const applied: string[] = [];

  // ── Title ────────────────────────────────────────────────────────────────
  if (verdict.title?.text && (verdict.title.confidence ?? 100) >= 55) {
    const t = verdict.title.text.replace(/\s+/g, ' ').trim();
    if (t.length >= 4 && t.length <= 300) {
      const prev = deepData.title || '';
      deepData.title = t;
      if (prev !== t) applied.push('title');
    }
  }

  // ── Authors (with affiliations) ──────────────────────────────────────────
  if (verdict.authors && verdict.authors.length > 0) {
    const authors: AuthorInfo[] = [];
    for (const a of verdict.authors) {
      const name = cleanAuthorName(String(a?.name || '').trim());
      if (!name || name.length < 3) continue;
      if (/^(author|anonymous|unknown|n\/?a|et\.?\s?al\.?)$/i.test(name)) continue;
      if (/@/.test(name)) continue;
      const affs = (a?.affiliations || []).map(cleanAffiliation).filter(Boolean).slice(0, 3);
      authors.push({
        name,
        affiliation: affs.length > 0 ? affs.join('; ') : undefined,
        affiliationIds: [],
      });
    }
    if (authors.length > 0) {
      deepData.authors = authors;
      applied.push('authors');
    }
  }

  // ── Affiliations / organizations ─────────────────────────────────────────
  if (verdict.affiliations && verdict.affiliations.length > 0) {
    deepData.organizations = verdict.affiliations.slice(0, 20);
    applied.push('affiliations');
  }

  // ── Abstract ─────────────────────────────────────────────────────────────
  if (verdict.abstract?.text && (verdict.abstract.confidence ?? 100) >= 55) {
    const abs = verdict.abstract.text.replace(/\s+/g, ' ').trim();
    if (abs.length >= 20) {
      const prev = deepData.abstract || '';
      deepData.abstract = abs;
      if (prev !== abs) applied.push('abstract');
    }
  }

  // ── Keywords ─────────────────────────────────────────────────────────────
  if (verdict.keywords && verdict.keywords.length > 0) {
    deepData.keywords = verdict.keywords.slice(0, 12);
    applied.push('keywords');
  }

  // ── References ───────────────────────────────────────────────────────────
  if (verdict.references && verdict.references.length > 0) {
    deepData.references = verdict.references.slice(0, 250);
    applied.push('references');
  }

  // ── Section hierarchy rebuild (fix matched headings, drop parser-artifact
  //    headings, INSERT AI-detected sections the parser missed, fix levels) ──
  if (verdict.sections && verdict.sections.length > 0) {
    const body = deepData.body || [];
    const aiSections: Array<{ title: string; level: number }> = [];
    const seenAiNorms = new Set<string>();
    for (const s of verdict.sections) {
      const t = String(s?.title || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length < 2) continue;
      const norm = normalizeTitleKey(t);
      if (seenAiNorms.has(norm)) continue; // dedupe duplicated AI headings
      seenAiNorms.add(norm);
      const lv = s?.level;
      aiSections.push({ title: t, level: lv === 2 || lv === 3 ? lv : 1 });
    }

    if (aiSections.length > 0) {
      const stripArtifacts = (t: string): string =>
        t
          .replace(/<[^>]*>/g, '')
          .replace(/[\d.]+\s*point\s*,?\s*[A-Za-z]*/gi, '')
          .replace(/[:\u2013\u2014]\s*$/, '')
          .replace(/\s+/g, ' ')
          .trim();

      const aiByNorm = new Map<string, number>();
      aiSections.forEach((s, i) => {
        const norm = normalizeTitleKey(s.title);
        if (!aiByNorm.has(norm)) aiByNorm.set(norm, i);
      });

      // Match body headings to AI sections (exact norm OR artifact-stripped norm).
      const aiMatchedToBody = new Map<number, number>();
      const bodyUsed = new Set<number>();
      body.forEach((n, i) => {
        if (n.type !== 'heading' || !n.text) return;
        const norm = normalizeTitleKey(n.text);
        const strippedNorm = normalizeTitleKey(stripArtifacts(n.text));
        const aiIdx = aiByNorm.get(norm) ?? (strippedNorm !== norm ? aiByNorm.get(strippedNorm) : undefined);
        if (aiIdx !== undefined) {
          aiMatchedToBody.set(aiIdx, i);
          bodyUsed.add(i);
        }
      });

      // Fix text/level on matched headings.
      let corrected = 0;
      for (const [aiIdx, bodyIdx] of aiMatchedToBody) {
        const s = aiSections[aiIdx];
        const n = body[bodyIdx];
        if (!n || !s) continue;
        if (n.text !== s.title) {
          n.text = s.title;
          corrected++;
        }
        // Apply the AI's depth (1 = section, 2 = subsection, 3 = subsubsection)
        // to matched headings; the AI sees numbering evidence the heuristic
        // parser may flatten. EXCEPT: never let the AI DOWNGRADE a heading
        // that structurally contains sub-headings (a numbered "3.2" prefix, or
        // level-2+ headings following it before the next level-1). Flattening
        // such a heading un-splits the document: the assembler splits files on
        // level-1 headings, so its children get orphaned/absorbed and content
        // disappears from the parent section.
        if (n.level !== s.level) {
          const curLevel = n.level || 1;
          if (s.level < curLevel && curLevel > 1) {
            const prefixLevel = (() => {
              const m = n.text.match(/^\s*(?:\[|\()?(\d+(?:\.\d+)*)(?:\]|\))?[.:\s)]/);
              return m ? Math.min(3, m[1].split('.').length) : null;
            })();
            const startLevel = curLevel;
            let hasChildren = false;
            for (let j = bodyIdx + 1; j < body.length; j++) {
              const c = body[j];
              if (c.type !== 'heading' || !c.level) continue;
              if (c.level <= startLevel) break;
              if (c.level > startLevel) { hasChildren = true; break; }
            }
            if ((prefixLevel !== null && prefixLevel > 1) || hasChildren) {
              // Keep the parser's deeper level — downgrading would un-split.
              continue;
            }
          }
          n.level = s.level;
          corrected++;
        }
      }

      // Determine insertion anchors: each unmatched AI section is placed
      // immediately AFTER the body position of the previous matched section
      // (preserving document order); ones before any match go to the top.
      const inserts = new Map<number, any[]>();
      let prevBodyIdx = -1;
      let prevLevel = 1;
      aiSections.forEach((s, aiIdx) => {
        const m = aiMatchedToBody.get(aiIdx);
        if (m !== undefined) {
          const bn = body[m];
          if (bn && bn.level) prevLevel = bn.level;
          prevBodyIdx = m;
          return;
        }
        const anchor = prevBodyIdx;
        // Clamp inserted depth: a heading can never be deeper than one level
        // below its predecessor (no orphan subsubsections at the document top).
        const clampedLevel = anchor === -1 ? 1 : Math.min(s.level, prevLevel + 1);
        prevLevel = clampedLevel;
        if (!inserts.has(anchor)) inserts.set(anchor, []);
        inserts.get(anchor)!.push({
          type: 'heading',
          level: clampedLevel,
          text: s.title,
          id: `h_ai_${aiIdx}`,
        });
      });

      // Rebuild the body: drop parser-artifact headings (style tags, template
      // instruction text) that no AI section confirms, apply insertions.
      const isGarbageHeading = (n: any): boolean => {
        if (n.type !== 'heading' || !n.text) return false;
        return (
          /<[^>]*>/.test(n.text) ||
          /[\d.]+\s*point\s*,?\s*bold/i.test(n.text) ||
          /within the text/i.test(n.text)
        );
      };
      let inserted = 0;
      let removed = 0;
      const rebuilt: any[] = [];
      for (let i = 0; i < body.length; i++) {
        const n = body[i];
        if (isGarbageHeading(n) && !bodyUsed.has(i)) {
          removed++;
          continue;
        }
        if (i === 0 && inserts.has(-1)) {
          rebuilt.push(...inserts.get(-1)!);
          inserted += inserts.get(-1)!.length;
        }
        rebuilt.push(n);
        const ins = inserts.get(i);
        if (ins) {
          rebuilt.push(...ins);
          inserted += ins.length;
        }
      }
      if (inserts.has(-1) && rebuilt.length === 0) {
        rebuilt.push(...inserts.get(-1)!);
        inserted += inserts.get(-1)!.length;
      }
      if (inserted > 0 || removed > 0 || corrected > 0) {
        if (inserted > 0 || removed > 0) deepData.body = rebuilt;
        applied.push('sections');
      }
    }
  }

  // ── Figure / table / algorithm caption fixes (verbatim from AI, matched by
  //    normalized similarity; sequential assignment only when counts align) ──
  const fixCaptions = (
    aiList: Array<{ caption?: string }> | Array<{ title?: string }> | null | undefined,
    nodeTypes: string[],
    textKey: 'caption' | 'title',
    label: string
  ): void => {
    if (!aiList || aiList.length === 0) return;
    const nodes = (deepData.body || []).filter(n => nodeTypes.includes(n.type));
    if (nodes.length === 0) return;
    const texts = aiList
      .map(a => String((a as any)[textKey] || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (texts.length === 0) return;

    const normCap = (c: string): string =>
      c
        .replace(/^(?:fig(?:ure)?|tab(?:le)?|alg(?:orithm)?|chart|img(?:age)?)[.\s]*\d*[.\s:-]*/i, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    const similarity = (a: string, b: string): number => {
      if (!a || !b) return 0;
      if (a === b) return 1;
      const grams = (s: string): Set<string> => {
        const set = new Set<string>();
        for (let i = 0; i + 2 < s.length; i++) set.add(s.slice(i, i + 3));
        return set;
      };
      const A = grams(a);
      const B = grams(b);
      if (A.size === 0 && B.size === 0) return a === b ? 1 : 0;
      let inter = 0;
      for (const t of A) if (B.has(t)) inter++;
      return inter / (A.size + B.size - inter);
    };

    let fixed = 0;
    const unused = new Set(texts.map((_, i) => i));
    for (const n of nodes) {
      const current = String((n as any)[textKey] || '').replace(/\s+/g, ' ').trim();
      if (!current) continue;
      const curNorm = normCap(current);
      let bestIdx = -1;
      let bestScore = 0;
      for (const i of unused) {
        const score = similarity(curNorm, normCap(texts[i]));
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      if (bestIdx !== -1 && bestScore >= 0.45 && texts[bestIdx] !== current) {
        (n as any)[textKey] = texts[bestIdx];
        unused.delete(bestIdx);
        fixed++;
      }
    }
    // Sequential fallback ONLY when counts align exactly (1 caption per node).
    if (texts.length === nodes.length) {
      for (const n of nodes) {
        if (fixed >= nodes.length) break;
        const current = String((n as any)[textKey] || '').replace(/\s+/g, ' ').trim();
        if (current) continue;
        const next = [...unused].sort((a, b) => a - b)[0];
        if (next === undefined) break;
        (n as any)[textKey] = texts[next];
        unused.delete(next);
        fixed++;
      }
    }
    if (fixed > 0) applied.push(label);
  };

  fixCaptions(verdict.figures, ['figure', 'chart', 'image', 'figure-group'], 'caption', 'figureCaptions');
  fixCaptions(verdict.tables, ['table'], 'caption', 'tableCaptions');
  fixCaptions(verdict.algorithms, ['algorithm'], 'title', 'algorithmTitles');

  // ── Component counts ─────────────────────────────────────────────────────
  // The report display layers (upload page, ProjectStats) prefer the AI
  // verdict's exact counts when present (stored in aiStructure.components)
  // and fall back to the heuristic body walk / stored stats otherwise.
  // Here we also raise the stats snapshot so the later LaTeX-based stats
  // sync (Math.max semantics) never drops a corrected count.
  if (verdict.components) {
    const c = verdict.components;
    const stats = deepData.stats;
    const applyCount = (key: keyof AiStructureComponents, target: 'imageCount' | 'chartCount' | 'tableCount' | 'equationCount' | 'pseudocodeCount' | 'citationCount' | 'referenceCount', label: string) => {
      const v = c[key];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        stats[target] = v;
        applied.push(label);
      }
    };
    applyCount('figures', 'imageCount', 'figures');
    applyCount('charts', 'chartCount', 'charts');
    applyCount('tables', 'tableCount', 'tables');
    applyCount('equations', 'equationCount', 'equations');
    applyCount('pseudocode', 'pseudocodeCount', 'pseudocode');
    applyCount('citations', 'citationCount', 'citations');
    applyCount('references', 'referenceCount', 'references');
  }

  (deepData as any).aiStructure = {
    model,
    appliedAt: new Date().toISOString(),
    applied,
    // Exact AI-verified counts (null-safe): authoritative for the report when
    // the AI pass provided a number; `undefined` keys fall back downstream.
    components: verdict.components ? { ...verdict.components } : undefined,
  };

  return { applied };
}
