/**
 * Phase 2 — AI MODULAR LATEX MAPPING for client-extracted DOC2LATEX projects.
 *
 * After template selection, this module asks the doc2latex-modular agent to
 * WRITE the entire modular LaTeX document for a manuscript that only ever
 * reached the server as a TEXT ENVELOPE (no binaries):
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
 * Every emitted file is machine-verified (normalizeModularFiles — floats via
 * strict fragment validation, sections/metadata via the structural guards) and
 * main.tex is composed DETERMINISTICALLY from the template preamble. AI output
 * can never break the pipeline: invalid files are dropped, and if nothing
 * survives, `runModularAiMapping` returns null so the caller falls back to the
 * deterministic ModularLatexAssembler.
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
const WINDOW_HEAD = HAS_STRONG_PROVIDER ? 45000 : 24000;
const WINDOW_TAIL = HAS_STRONG_PROVIDER ? 15000 : 6000;
const PASS_TIMEOUT_MS = 120_000;

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

/** Compact, agent-facing snapshot of the verified AI structure. */
function buildVerdictCompact(doc: Record<string, any>): Record<string, any> {
  const ai = doc.aiVerdict || {};
  const body = Array.isArray(doc.body) ? doc.body : [];
  const sections: Array<{ title: string; level: number }> = Array.isArray(ai.sections)
    ? ai.sections
      .filter((s: any) => s && typeof s.title === 'string' && !/^(?:references?|bibliography|works cited|literature cited)\b/i.test(s.title.trim()))
      .map((s: any) => ({ title: s.title, level: Number(s.level) || 1 }))
    : body
      .filter((n: any) => n.type === 'heading' && n.text)
      .map((n: any) => ({ title: n.text, level: Number(n.level) || 1 }));

  return {
    title: ai.title?.text || doc.title || null,
    authors: Array.isArray(ai.authors)
      ? ai.authors
      : Array.isArray(doc.authors)
        ? doc.authors.map((a: any) => ({ name: typeof a === 'string' ? a : a?.name, affiliations: [] }))
        : [],
    affiliations: ai.affiliations || doc.organizations || [],
    abstract: ai.abstract?.text || doc.abstract || null,
    keywords: ai.keywords || doc.keywords || [],
    sections,
    figures: Array.isArray(ai.figures) ? ai.figures.map((f: any) => String(f?.caption || '')) : [],
    tables: Array.isArray(ai.tables) ? ai.tables.map((t: any) => String(t?.caption || '')) : [],
    algorithms: Array.isArray(ai.algorithms) ? ai.algorithms.map((a: any) => String(a?.title || '')) : [],
    components: ai.components || null,
    references: Array.isArray(ai.references) ? ai.references.map((r: any) => String(r || '')) : [],
  };
}

async function runScope(
  scope: Scope,
  ctx: {
    templateId: string;
    documentTitle: string;
    textWindow: string;
    verdict: Record<string, any>;
    figureFiles: string[];
  },
  auth: { userId?: string | null; userEmail?: string | null; projectId?: string },
): Promise<{ files: AiModularFile[]; model: string; rejected: number }> {
  const controller = new AbortController();
  const res = await raceWithTimeout(
    routeToAgent({
      agent: 'doc2latex-modular',
      messages: [{ role: 'user', content: `Generate the modular LaTeX files for scope "${scope}".` }],
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

  if (!res?.success || !res.data || (res.data as any)._failSafe || (res.data as any)._partial) {
    console.warn(`[AI-MODULAR] scope "${scope}" unavailable`, res && !res.success ? `(${res.error})` : '');
    return { files: [], model: '', rejected: 0 };
  }
  const normalized = normalizeModularFiles(res.data, ctx.figureFiles);
  console.log(`[AI-MODULAR] scope "${scope}" → ${normalized.files.length} files kept, ${normalized.rejected} rejected (${res.model})`);
  return { files: normalized.files, model: res.model, rejected: normalized.rejected };
}

// ── Deterministic main.tex composer ────────────────────────────────────────

const GRAPHICS_PATH_LINES = [
  "\\graphicspath{{./}{./assets/}{./images/}{./figures/}{../}{../assets/}{../images/}{./figures/}}",
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
    '\\usepackage[colorlinks=true,allcolors=blue]{hyperref}',
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
  const sections = files
    .filter((f) => f.path.startsWith('sections/'))
    .sort((a, b) => a.path.localeCompare(b.path));
  const floats = files.filter((f) => f.path.startsWith('floats/'));
  const bib = files.find((f) => f.path === 'references/bibliography.tex');
  const existingFloats = new Set(floats.map((f) => f.path));

  // Sections may reference floats that never survived validation — drop those
  // \input lines so a missing file can never break the compile.
  for (const f of sections) {
    f.content = stripFloatInputsToExisting(f.content, existingFloats);
  }

  // Preamble: native template preamble (sliced at \begin{document}, metadata
  // lines filtered — mirroring ModularLatexAssembler) or a standard fallback.
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
  // Floats the sections did not wire in are appended at the end so nothing
  // verified is silently dropped from the document.
  const bodyJoined = body.join('\n');
  for (const f of floats) {
    if (!bodyJoined.includes(`\\input{${f.path}}`)) body.push(`\\input{${f.path}}`);
  }
  if (bib) body.push(`\\input{references/bibliography.tex}`);
  body.push('\\end{document}');

  return `${preamble.join('\n')}\n\n${body.join('\n')}\n`;
}

// ── Public entry ───────────────────────────────────────────────────────────

/**
 * Runs the modular AI mapping for a client-extracted DOC2LATEX project.
 * Returns null when no AI-produced file survived validation (+ no usable
 * fallback) — callers must then use the deterministic assembler.
 */
export async function runModularAiMapping(input: ModularMappingInput): Promise<ModularMappingResult | null> {
  const { structured, templateId, templateMainTex, userId, userEmail, projectId } = input;
  const figureManifest = Array.isArray(structured.figureManifest) ? structured.figureManifest : [];
  const figureFiles = figureManifest.map((f: any) => String(f?.name ?? f)).filter(Boolean);

  const bodyText = Array.isArray(structured.body)
    ? (structured.body as any[]).map((n: any) => n.text || n.caption || '').join('\n')
    : structured.fullText || '';
  const docText = [structured.fullText, bodyText, structured.rawHtml ? '' : ''].filter(Boolean).join('\n').trim();
  const textWindow = balancedWindow(docText.length > 0 ? docText : structured.abstract || '');

  const verdict = buildVerdictCompact(structured);
  const common = {
    templateId,
    documentTitle: String(structured.title || 'Untitled Document'),
    textWindow,
    verdict,
    figureFiles,
  };

  const [floatsRes, sectionsRes, metadataRes] = await Promise.all([
    runScope('floats', common, { userId, userEmail, projectId }),
    runScope('sections', common, { userId, userEmail, projectId }),
    runScope('metadata', common, { userId, userEmail, projectId }),
  ]);

  const files = [...floatsRes.files, ...sectionsRes.files, ...metadataRes.files];
  const models = [floatsRes.model, sectionsRes.model, metadataRes.model].filter(Boolean);
  if (files.length === 0) {
    console.warn('[AI-MODULAR] No validated AI files — falling back to deterministic assembly.');
    return null;
  }

  const mainTex = composeMainTex(templateId, templateMainTex, files);
  return {
    mainTex,
    files,
    model: models[0] || 'unknown',
    rejected: floatsRes.rejected + sectionsRes.rejected + metadataRes.rejected,
  };
}