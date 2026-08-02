// Phase 3 regression: report surfaces must render statistics and plain-text
// pseudocode ONLY — never raw LaTeX source. This is a static-source tripwire:
// it fails loudly if a report surface starts interpolating latexContent or
// renders via dangerouslySetInnerHTML.
//
// Run: node scratch/test-report-no-latex.cjs
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

const failures = [];
const ok = (name) => console.log(`  PASS  ${name}`);
const fail = (name, why) => { failures.push(name); console.log(`  FAIL  ${name}: ${why}`); };

// 1. Report surfaces must not render via dangerouslySetInnerHTML.
const surfaces = [
  'src/components/ProjectStats.tsx',
  'src/app/upload/page.tsx',
  'src/app/history/page.tsx',
  'src/app/dashboard/page.tsx',
];
for (const f of surfaces) {
  const src = read(f);
  if (/dangerouslySetInnerHTML/.test(src)) fail(f, 'dangerouslySetInnerHTML found');
  else ok(`${f}: no dangerouslySetInnerHTML`);
}

// 2. Report surfaces must never interpolate latexContent into JSX:
//    {latexContent} or {anything.latexContent}. Object-literal writes
//    (latexContent: ...) are allowed — they are not rendering.
for (const f of surfaces) {
  const src = read(f);
  const interp = src.match(/\{[\w.$]*\.?latexContent\}/);
  if (interp) fail(f, `latexContent interpolated in JSX: ${interp[0].slice(0, 80)}`);
  else ok(`${f}: no latexContent JSX interpolation`);
}

// 3. ProjectStats must carry the tex-content sanitizer guard.
const ps = read('src/components/ProjectStats.tsx');
if (/sanitizeAlgoContent/.test(ps) && /TEX_BLOCK_RE/.test(ps)) ok('ProjectStats: tex-content sanitizer guard present');
else fail('ProjectStats', 'sanitizeAlgoContent / TEX_BLOCK_RE guard missing');

// 4. Report-history route must not return latex body fields.
const rr = read('src/app/api/reports/route.ts');
if (/latexContent|structuredContent/.test(rr)) fail('api/reports/route.ts', 'latex body field referenced in reports route');
else ok('api/reports/route.ts: no latex body fields');

// 5. ProjectStats must not emit the AI fragment payload (aiLatex) to the DOM.
const psHasAiLatex = /aiLatex/.test(ps);
if (psHasAiLatex) fail('ProjectStats', 'aiLatex referenced in report component');
else ok('ProjectStats: no aiLatex reference');

console.log(
  failures.length === 0
    ? '\nALL REPORT NO-LATEX CHECKS PASSED'
    : `\n${failures.length} CHECK(S) FAILED`
);
process.exit(failures.length === 0 ? 0 : 1);
