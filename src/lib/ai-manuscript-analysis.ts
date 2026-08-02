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
  figures?: Array<{ caption?: string }> | null;
  tables?: Array<{ caption?: string }> | null;
  algorithms?: Array<{ title?: string }> | null;
  components?: AiStructureComponents | null;
  references?: string[] | null;
}

// Analysis window: long enough for a full-document analysis on slower
// providers, short enough that uploads never hang (client XHR allows 5 min).
// Heuristics are used when the AI verdict misses this window.
const ANALYSIS_TIMEOUT_MS = 180000;

// Max characters of manuscript text sent to the AI (front + tail preserved).
const FULL_TEXT_LIMIT = 26000;
const FULL_TEXT_TAIL = 6000;

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
    // Full-document evidence: the AI must see the ENTIRE manuscript (body,
    // captions, equations, references), not just the front matter, so its
    // detection is independent of the heuristic parser. Front + tail of the
    // text are always preserved (tail holds the reference list).
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
      .slice(0, 15);

    const response = await Promise.race([
      routeToAgent({
        agent: 'structure-analyze',
        messages: [{ role: 'user', content: 'Analyze this manuscript and return the structured JSON verdict.' }],
        context: {
          userId: opts.userId ?? null,
          documentTitle: opts.filename.replace(/\.[^/.]+$/, ''),
          fullText,
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

  // ── Section hierarchy rebuild (fix matched headings, drop parser-artifact
  //    headings, INSERT AI-detected sections the parser missed, fix levels) ──
  if (verdict.sections && verdict.sections.length > 0) {
    const body = deepData.body || [];
    const aiSections: Array<{ title: string; level: number }> = [];
    for (const s of verdict.sections) {
      const t = String(s?.title || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length < 2) continue;
      aiSections.push({ title: t, level: s?.level === 2 ? 2 : 1 });
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
        if (s.level === 2 && (n.level === undefined || n.level === 1)) {
          n.level = 2;
          corrected++;
        } else if (s.level === 1 && n.level === 2) {
          n.level = 1;
          corrected++;
        }
      }

      // Determine insertion anchors: each unmatched AI section is placed
      // immediately AFTER the body position of the previous matched section
      // (preserving document order); ones before any match go to the top.
      const inserts = new Map<number, any[]>();
      let prevBodyIdx = -1;
      aiSections.forEach((s, aiIdx) => {
        const m = aiMatchedToBody.get(aiIdx);
        if (m !== undefined) {
          prevBodyIdx = m;
          return;
        }
        const anchor = prevBodyIdx;
        if (!inserts.has(anchor)) inserts.set(anchor, []);
        inserts.get(anchor)!.push({
          type: 'heading',
          level: s.level,
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
