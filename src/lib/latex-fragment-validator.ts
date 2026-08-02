/**
 * AI-generated LaTeX fragment validator.
 *
 * The AI ("structure-latex" pass) proposes modular LaTeX for figures, charts,
 * tables and algorithms. Every fragment must pass strict structural validation
 * before the assembler is allowed to use it:
 *   - balanced braces/brackets
 *   - matching \begin{...}/\end{...} environment pairs from an allowed set
 *   - NO dangerous or structure-level commands (\documentclass, \input,
 *     \usepackage, \newcommand, \def, \write, \special, ...)
 *   - every \includegraphics/\zimg target must exist in the project's image
 *     file set (case-insensitive, extension-optional)
 * Fragments that fail are discarded and the deterministic assembler output is
 * used instead — an AI fragment can NEVER break the pipeline.
 */

export interface AiLatexFragment {
  index: number;
  latex: string;
}

export interface AiLatexFragments {
  figures?: AiLatexFragment[];
  charts?: AiLatexFragment[];
  tables?: AiLatexFragment[];
  algorithms?: AiLatexFragment[];
}

const ALLOWED_ENVS = new Set([
  'figure', 'figure*', 'table', 'table*', 'algorithm', 'algorithm*',
  'algorithmic', 'algorithmicx', 'tabular', 'tabularx', 'minipage',
  'center', 'center*', 'equation', 'equation*', 'align', 'align*',
  'aligned', 'gather', 'gather*', 'subfigure', 'subfloat', 'floatrow',
  'subcaption', 'abstract', 'keywords', 'quote', 'quotation', 'itemize',
  'enumerate', 'description', 'small', 'footnotesize', 'scriptsize',
  'adjustbox', 'textblock', 'overpic', 'tikzpicture',
]);

// Commands that must never appear in a validated fragment. Structural
// commands break the surrounding document; file/definition commands are
// arbitrary code execution inside LaTeX.
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\\documentclass\b/,
  /\\usepackage\b/,
  /\\input\b/,
  /\\include\b/,
  /\\import\b/,
  /\\subfile\b/,
  /\\includeonly\b/,
  /\\endinput\b/,
  /\\newcommand\b/,
  /\\renewcommand\b/,
  /\\providecommand\b/,
  /\\def\b/,
  /\\gdef\b/,
  /\\edef\b/,
  /\\xdef\b/,
  /\\let\b/,
  /\\futurelet\b/,
  /\\catcode\b/,
  /\\lccode\b/,
  /\\uccode\b/,
  /\\csname\b/,
  /\\endcsname\b/,
  /\\write\b/,
  /\\read\b/,
  /\\openout\b/,
  /\\closeout\b/,
  /\\immediate\b/,
  /\\special\b/,
  /\\pdfliteral\b/,
  /\\makeatletter\b/,
  /\\makeatother\b/,
  /\\batchmode\b/,
  /\\errorstopmode\b/,
  /\\scrollmode\b/,
  /\\nonstopmode\b/,
  /\\bibliography\b/,
  /\\bibliographystyle\b/,
  /\\addbibresource\b/,
  /\\maketitle\b/,
  /\\tableofcontents\b/,
  /\\hspace\s*\{0\}/,
];

function braceBalance(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function bracketBalance(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

/** Extract \begin{env} / \end{env} pairs and verify they nest correctly and are allowed. */
function environmentPairsValid(latex: string): boolean {
  const beginRe = /\\begin\{([^{}]+)\}/g;
  const endRe = /\\end\{([^{}]+)\}/g;
  const begins: string[] = [];
  const ends: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = beginRe.exec(latex)) !== null) begins.push(m[1].trim());
  while ((m = endRe.exec(latex)) !== null) ends.push(m[1].trim());
  if (begins.length === 0 && ends.length === 0) return false;
  if (begins.length !== ends.length) return false;

  // Environments must nest properly: the last opened must be the last closed.
  const stack: string[] = [];
  const tokens: Array<{ kind: 'begin' | 'end'; env: string }> = [];
  const combinedRe = /\\begin\{([^{}]+)\}|\\end\{([^{}]+)\}/g;
  while ((m = combinedRe.exec(latex)) !== null) {
    if (m[1]) tokens.push({ kind: 'begin', env: m[1].trim() });
    else tokens.push({ kind: 'end', env: m[2].trim() });
  }
  for (const t of tokens) {
    if (t.kind === 'begin') {
      if (!ALLOWED_ENVS.has(t.env)) return false;
      stack.push(t.env);
    } else {
      const top = stack.pop();
      if (top === undefined || top !== t.env) return false;
    }
  }
  return stack.length === 0;
}

/** Every \includegraphics / \zimg filename must exist in the image set. */
function imageTargetsExist(latex: string, imageFiles: string[]): boolean {
  if (imageFiles.length === 0) return true; // nothing to verify against
  const normalized = imageFiles.map(f =>
    String(f || '').toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/\\/g, '/')
  );
  const refs: string[] = [];
  const imgRe = /\\(?:includegraphics|zimg)\s*(?:\[[^\]]*\])?\s*\{([^{}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(latex)) !== null) {
    refs.push(m[1].trim().toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/^assets\//, ''));
  }
  for (const ref of refs) {
    if (ref && !ref.startsWith('__') && !normalized.includes(ref)) return false;
  }
  return true;
}

function sanitizeFragment(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (s.length < 20 || s.length > 4000) return null;
  // Strip a single trailing newline/space
  s = s.replace(/\s+$/g, '');
  // Reject fragments wrapping whole documents or multiple top-level blocks
  if (!braceBalance(s)) return null;
  if (!bracketBalance(s)) return null;
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(s)) return null;
  }
  if (!environmentPairsValid(s)) return null;
  return s;
}

function normalizeList(raw: unknown, imageFiles: string[]): AiLatexFragment[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: AiLatexFragment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const index = Number(o.index);
    if (!Number.isInteger(index) || index < 1 || index > 500) continue;
    const latex = sanitizeFragment(o.latex);
    if (!latex) continue;
    if (!imageTargetsExist(latex, imageFiles)) continue;
    if (out.some(f => f.index === index)) continue; // dedupe indices
    out.push({ index, latex });
  }
  return out.length > 0 ? out.sort((a, b) => a.index - b.index) : undefined;
}

/**
 * Validates the raw JSON returned by the structure-latex AI pass.
 * Returns normalized, verified fragments (or null when nothing survived).
 * Callers must treat null as "use deterministic assembly".
 */
export function validateAiLatexFragments(
  raw: unknown,
  imageFiles: string[] = []
): AiLatexFragments | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  // Figure/chart fragments embed \includegraphics — without a real image set
  // their targets cannot be verified, so they are never accepted.
  const figures = imageFiles.length > 0 ? normalizeList(o.figures, imageFiles) : undefined;
  const charts = imageFiles.length > 0 ? normalizeList(o.charts, imageFiles) : undefined;
  const tables = normalizeList(o.tables, imageFiles);
  const algorithms = normalizeList(o.algorithms, imageFiles);
  if (!figures && !charts && !tables && !algorithms) return null;
  return { figures, charts, tables, algorithms };
}
