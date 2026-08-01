import { routeToAgent } from './agent-gateway';
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
  components?: AiStructureComponents | null;
  references?: string[] | null;
}

// Analysis window: long enough for a full manuscript analysis on slower
// providers, short enough that uploads never hang. Heuristics are used when
// the AI verdict misses this window.
const ANALYSIS_TIMEOUT_MS = 90000;

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
 * Runs the AI structural analysis for a parsed manuscript.
 * Returns null when the AI pass is unavailable, timed out, or returned
 * unusable output — callers MUST fall back to the heuristic parse untouched.
 */
export async function analyzeManuscriptStructure(
  deepData: StructuredDocument,
  opts: { html?: string; pdfText?: string; filename: string; userId?: string | null }
): Promise<{ verdict: AiStructureVerdict; model: string } | null> {
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
    const frontMatter = plainText.substring(0, 6500);
    const documentTail = plainText.length > 6500
      ? plainText.substring(Math.max(6500, plainText.length - 4500))
      : '';
    const equationSnippets = ((deepData.mathBlocks || []) as Array<{ latex?: string }>)
      .filter(m => m.latex)
      .map(m => String(m.latex).substring(0, 200))
      .slice(0, 15);

    const response = await Promise.race([
      routeToAgent({
        agent: 'structure-analyze',
        messages: [{ role: 'user', content: 'Analyze this manuscript and return the structured JSON verdict.' }],
        context: {
          userId: opts.userId ?? null,
          documentTitle: opts.filename.replace(/\.[^/.]+$/, ''),
          frontMatter,
          documentTail,
          sectionTitles: sectionTitles.slice(0, 60),
          figureCaptions: figureCaptions.slice(0, 40),
          tableCaptions: tableCaptions.slice(0, 40),
          algorithmTitles: algorithmTitles.slice(0, 25),
          equationSnippets,
          referenceEntries: (deepData.references || []).slice(0, 60),
          heuristic: {
            title: deepData.title,
            authors: (deepData.authors || []).map(a => a.name),
            abstractLength: (deepData.abstract || '').length,
            keywords: deepData.keywords,
            stats: deepData.stats,
          },
        },
      }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), ANALYSIS_TIMEOUT_MS)),
    ]);

    if (!response || !response.success || !response.data) return null;
    const raw = response.data as any;
    if (raw && (raw._failSafe || raw._partial)) return null;

    const verdict = normalizeVerdict(raw);
    if (!verdict) {
      console.warn('[AI-Structure] AI verdict failed validation, keeping heuristic parse.');
      return null;
    }
    return { verdict, model: response.model };
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

  // ── Section hierarchy corrections (exact normalized-title match only) ────
  if (verdict.sections && verdict.sections.length > 0) {
    const byNorm = new Map<string, { title: string; level: number }>();
    for (const s of verdict.sections) {
      const t = String(s?.title || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length < 2) continue;
      byNorm.set(normalizeTitleKey(t), { title: t, level: s?.level === 2 ? 2 : 1 });
    }
    let corrected = 0;
    for (const n of deepData.body || []) {
      if (n.type !== 'heading' || !n.text) continue;
      const match = byNorm.get(normalizeTitleKey(n.text));
      if (!match) continue;
      if (n.text !== match.title) {
        n.text = match.title;
        corrected++;
      }
      if (match.level === 2 && (n.level === undefined || n.level === 1)) {
        n.level = 2;
        corrected++;
      } else if (match.level === 1 && n.level === 2) {
        n.level = 1;
        corrected++;
      }
    }
    if (corrected > 0) applied.push('sections');
  }

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
