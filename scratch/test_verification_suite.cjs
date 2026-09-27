// Doc2latex rendering verification suite (Phase 8 gate).
// Every assertion below exercises the REAL compiled sources under
// scratch/compiled-ai — no logic is re-implemented here.
//
// Coverage:
//   1. robustPreambleInjector  — no phantom `.5=0.8` text, guards land in the
//      preamble, guards are idempotent, no empty-arg \twocolumn[..] injection.
//   2. autoHealLatex           — algorithmic/algpseudocode never co-loaded,
//      algorithmic never wrapped in adjustbox.
//   3. LatexAssembler.escape   — unbalanced `$` is never "fixed" by appending
//      an opener that swallows the rest of the paragraph.
//   4. ModularLatexAssembler   — no empty \caption{}, no duplicate
//      \includegraphics, no author-name headings, no heading level jumps.
//
// Run: node scratch/test_verification_suite.cjs
require('./_require-hook.cjs');

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { robustPreambleInjector } = require('./compiled-ai/lib/studio-core/compiler-utils.js');
const { autoHealLatex } = require('./compiled-ai/lib/latex.js');
const { LatexAssembler, ModularLatexAssembler } = require('./compiled-ai/lib/assembler.js');
const { DeepDocumentParser } = require('./compiled-ai/lib/deep-parser.js');

let n = 0;
const ok = (msg) => { n++; console.log(`  [${n}] PASS ${msg}`); };

// Resolve \input/\include chains so assertions run against the document that is
// actually typeset, not against exported-but-unreferenced component files.
function effectiveTex(mainTex, files, depth = 0) {
  if (depth > 6) return String(mainTex || '');
  return String(mainTex || '').replace(/\\(?:input|include)\s*\{([^}]+)\}/g, (m, p) => {
    const key = /\.tex$/i.test(p) ? p : `${p}.tex`;
    const v = files && files[key];
    return typeof v === 'string' ? effectiveTex(v, files, depth + 1) : m;
  });
}

// ── 1. robustPreambleInjector ────────────────────────────────────────────────
{
  const src = [
    '\\documentclass[preprint]{elsarticle}',
    '\\usepackage{graphicx}',
    '\\begin{document}',
    '\\maketitle',
    'Body text.',
    '\\end{document}',
  ].join('\n');

  const out = robustPreambleInjector(src);

  assert.ok(
    !/\\floatpagefraction\s*=\s*0\./.test(out),
    'phantom text: \\floatpagefraction=0.8 assignment must not be emitted'
  );
  assert.ok(
    !/\\textfraction\s*=\s*0\./.test(out),
    'phantom text: \\textfraction=0.1 assignment must not be emitted'
  );
  assert.ok(
    !/\\bottomfraction\s*=\s*0\./.test(out),
    'phantom text: \\bottomfraction=0.8 assignment must not be emitted'
  );
  assert.ok(!/\.5=0\.8/.test(out) && !/\.2=0\.1/.test(out) && !/\.3=0\.8/.test(out),
    'phantom text: rendered literals .5=0.8 / .2=0.1 / .3=0.8 must not appear');
  ok('no macro-as-assignment float fraction lines (phantom page-1 text)');

  assert.ok(!/\\twocolumn\s*\[/.test(out), 'empty-arg \\twocolumn[..] must not be injected');
  ok('no \\twocolumn[..] body injection (blank first page)');

  const marker = 'StudioOverflowGuards';
  const count = (out.match(new RegExp(marker, 'g')) || []).length;
  assert.strictEqual(count, 1, `expected exactly 1 ${marker}, found ${count}`);
  ok('overflow guards emitted exactly once');

  // Guards must be applied immediately after \begin{document} and BEFORE any
  // content (\maketitle) — hyperref/url/listings are already loaded there, so
  // the \hypersetup/\urlstyle guards still resolve, while nothing is typeset yet.
  const mIdx = out.indexOf(marker);
  const bIdx = out.indexOf('\\begin{document}');
  const mkIdx = out.indexOf('\\maketitle');
  assert.ok(mIdx !== -1 && bIdx !== -1 && mIdx > bIdx,
    'overflow guards must be injected after \\begin{document}');
  assert.ok(mkIdx === -1 || mIdx < mkIdx,
    'overflow guards must be injected before any typeset content');
  ok('overflow guards applied before any content');

  // A3: autoHealLatex and robustPreambleInjector must not stack two guard blocks.
  const doubleGuard = autoHealLatex(src);
  const combined = robustPreambleInjector(doubleGuard);
  const comboCount = (combined.match(new RegExp(marker, 'g')) || []).length;
  assert.strictEqual(comboCount, 1,
    `autoHealLatex + robustPreambleInjector stacked ${comboCount} guard blocks`);
  ok('autoHealLatex + robustPreambleInjector emit exactly one guard block');

  // Idempotence: a second pass must not duplicate anything.
  const twice = robustPreambleInjector(out);
  const count2 = (twice.match(new RegExp(marker, 'g')) || []).length;
  assert.strictEqual(count2, 1, `idempotence broken: ${count2} markers after 2nd pass`);
  assert.ok(!/\\twocolumn\s*\[/.test(twice), 'idempotence broken: \\twocolumn reintroduced');
  ok('robustPreambleInjector is idempotent');
}

// ── 2. autoHealLatex algorithm packages ─────────────────────────────────────
{
  // Fragment rebuild path (no \begin{document}) → latex.ts package map.
  const frag = [
    '\\documentclass{article}',
    '\\begin{algorithmic}[1]',
    '\\Require $x$',
    '\\State compute',
    '\\Ensure $y$',
    '\\end{algorithmic}',
  ].join('\n');
  const healedFrag = autoHealLatex(frag);
  assert.ok(/algpseudocode/.test(healedFrag), 'algpseudocode must be loaded for algorithmic blocks');
  assert.ok(!/\\usepackage\{algorithmic\}/.test(healedFrag),
    'conflicting \\usepackage{algorithmic} must not be co-loaded with algpseudocode');
  ok('algorithmic + algpseudocode never co-loaded');

  // Document path: algorithmic must not be boxed by adjustbox.
  const doc = [
    '\\documentclass{article}',
    '\\usepackage{algorithm,algpseudocode}',
    '\\begin{document}',
    '\\begin{algorithm}[H]',
    '\\begin{algorithmic}[1]',
    '\\State compute the thing',
    '\\end{algorithmic}',
    '\\end{algorithm}',
    '\\end{document}',
  ].join('\n');
  const healedDoc = autoHealLatex(doc);
  assert.ok(
    !/\\begin\{adjustbox\}\{[^}]*\}\s*\\begin\{algorithmic\}/.test(healedDoc),
    'algorithmic environment must not be wrapped in adjustbox (list env in a box)'
  );
  ok('algorithmic is not wrapped in adjustbox');

  // Package-guard hole: a template that already loads `algorithm` also loaded the
  // legacy `algorithmic` package (stripped by the healer) — algpseudocode must
  // still be guaranteed, otherwise \begin{algorithmic} is undefined.
  const preloaded = [
    '\\documentclass{article}',
    '\\usepackage{algorithm}',
    '\\usepackage{algorithmic}',
    '\\begin{document}',
    '\\begin{algorithmic}[1]',
    '\\State compute the thing',
    '\\end{algorithmic}',
    '\\end{document}',
  ].join('\n');
  const healedPre = autoHealLatex(preloaded);
  assert.ok(/algpseudocode/.test(healedPre),
    'algpseudocode must be added when only `algorithm` is preloaded');
  assert.ok(!/\\usepackage\{algorithmic\}/.test(healedPre),
    'legacy \\usepackage{algorithmic} must be stripped (conflicts with algpseudocode)');
  ok('algpseudocode guaranteed even when algorithm is preloaded');
}

// ── 3. LatexAssembler.escape dollar balance ─────────────────────────────────
{
  const countD = (s) => (s.match(/(?<!\\)\$/g) || []).length;

  // Single unpaired `$` (lost closing delimiter) inside a long paragraph.
  const odd = 'We minimize $L over the training set for many epochs and report the final number on the held-out test split where it plateaued';
  const escOdd = LatexAssembler.escape(odd, []);
  assert.strictEqual(countD(escOdd) % 2, 0, `escape() left ${countD(escOdd)} unescaped $ delimiters`);
  assert.ok(countD(escOdd) <= countD(odd),
    'escape() must DROP the unpaired $ — appending one puts the paragraph tail into math mode');
  assert.ok(!/\$\s*$/.test(escOdd), 'escape() must not leave a trailing $ behind');
  ok('unpaired $ is removed, never balanced by appending');

  // Math-block unrolling can produce an ODD number of delimiters. The old fix
  // appended a `$`, which pushes the tail of the paragraph into math mode.
  const oddMath = LatexAssembler.escape('Value: MATHBLOCKX0XMARKER trailing text', [{ latex: 'a$b' }]);
  const rawOdd = countD(oddMath);
  assert.strictEqual(rawOdd % 2, 0, `escape() left ${rawOdd} unescaped $ delimiters`);
  assert.ok(rawOdd <= 3, `escape() must drop the unpaired $, not append one (got ${rawOdd})`);
  assert.ok(!/\$\s*$/.test(oddMath), 'escape() must not leave a trailing $ behind');
  ok('unpaired $ from math unroll is removed, never appended');

  // Escaped dollars (\$) must not be counted at all.
  const escaped = 'Only \\$5 remains after the discount';
  assert.strictEqual(countD(LatexAssembler.escape(escaped, [])) % 2, 0);
  ok('escaped \\$ delimiters are ignored by the balance check');
}

// ── 4. Assembler output invariants (golden fixture) ────────────────────────
{
  const FIXTURE = path.join(__dirname, 'fixtures', 'rawHtml.html');
  if (!fs.existsSync(FIXTURE)) {
    console.log(`  [SKIP] golden fixture missing: ${FIXTURE}`);
  } else {
    const rawHtml = fs.readFileSync(FIXTURE, 'utf-8');
    const parsed = DeepDocumentParser.parse(rawHtml, [], 'Golden-Manuscript.docx');
    const built = ModularLatexAssembler.assemble(parsed, 'article_lncs', { hasBibFile: false });

    const all = effectiveTex(built.mainTex, built.files);

    assert.ok(!/\\caption\{\s*\}/.test(all), 'empty \\caption{} must never be emitted');
    ok('no empty \\caption{}');

    assert.ok(!/\\caption\{Figure\s*\d*\}/.test(all), 'placeholder \\caption{Figure N} must not be emitted');
    ok('no bare \\caption{Figure N} placeholders');

    assert.ok(!/\\caption\{\s*\(\d+\s*rows?\s*[x\u00d7]\s*\d+\s*cols?\s*\)\s*\}/.test(all),
      'synthetic (N rows x M cols) caption must not be emitted');
    ok('no synthetic row/column table captions');

    assert.ok(!/\\(?:section|subsection)\s*\{\s*(?:Dr|Prof|Professor|Mr|Ms|Mrs)\b/i.test(all),
      'author/designation lines must not become headings');
    ok('no author/designation headings');

    // Duplicate image references (same basename) across main + sections.
    const imgs = [...all.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)]
      .map((m) => m[1].replace(/^.*[\\\/]/, '').replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase());
    const seen = new Set();
    const dupes = new Set();
    for (const i of imgs) { if (seen.has(i)) dupes.add(i); seen.add(i); }
    assert.strictEqual(dupes.size, 0, `duplicate image references: ${[...dupes].join(', ')}`);
    ok(`no duplicate \\includegraphics (${imgs.length} refs)`);

    // Heading level sanity in the emitted document.
    const levels = [...all.matchAll(/\\(section|subsection|subsubsection)\s*\{/g)]
      .map((m) => (m[1] === 'section' ? 1 : m[1] === 'subsection' ? 2 : 3));
    for (let i = 1; i < levels.length; i++) {
      assert.ok(levels[i] <= levels[i - 1] + 1,
        `heading level jump: ${levels[i - 1]} -> ${levels[i]}`);
    }
    ok(`heading levels never jump (${levels.length} headings)`);
  }
}

// ── 5. autoHealLatex must never leak shield placeholders (fragment path) ────
{
  const frag = [
    '\\documentclass{article}',
    '\\begin{document}',
    'Intro text with $x + y$ inline.',
    '\\begin{equation}E = mc^2\\end{equation}',
    '\\begin{table}\\begin{tabular}{cc}a&b\\\\c&d\\end{tabular}\\end{table}',
    '\\begin{algorithmic}[1]',
    '\\Require the data',
    '\\State compute the result',
    '\\end{algorithmic}',
    '\\end{document}',
  ].join('\n');

  // Document-form input.
  const healedDoc = autoHealLatex(frag);
  for (const tok of ['__MATH_SHIELD', '__MATH_BLOCK', '__ESCAPED_CHAR', '__FRONTMATTER_BLOCK']) {
    assert.ok(!healedDoc.includes(tok), `document path leaked ${tok} placeholder`);
  }
  assert.ok(healedDoc.includes('E = mc^2'), 'equation block destroyed by autoHealLatex');
  assert.ok(healedDoc.includes('\\begin{algorithmic}'), 'algorithmic block destroyed by autoHealLatex');
  assert.ok(healedDoc.includes('\\begin{tabular}'), 'table block destroyed by autoHealLatex');
  ok('document path restores every shielded block');

  // Fragment-form input (no \begin{document}) — this branch used to drop them all.
  const fragOnly = [
    '\\documentclass{article}',
    '\\begin{equation}E = mc^2\\end{equation}',
    '\\begin{algorithmic}[1]',
    '\\State compute the result',
    '\\end{algorithmic}',
  ].join('\n');
  const healedFrag = autoHealLatex(fragOnly);
  for (const tok of ['__MATH_SHIELD', '__MATH_BLOCK', '__ESCAPED_CHAR', '__FRONTMATTER_BLOCK']) {
    assert.ok(!healedFrag.includes(tok), `fragment path leaked ${tok} placeholder`);
  }
  assert.ok(healedFrag.includes('E = mc^2'), 'fragment path destroyed the equation');
  assert.ok(healedFrag.includes('\\begin{algorithmic}'), 'fragment path destroyed the algorithm');
  ok('fragment path restores every shielded block');
}

// ── 6. Assembler invariants on a synthetic document ────────────────────────
{
  const anonFigure = (extra) => Object.assign({ type: 'figure', id: '', caption: '', text: 'x' }, extra || {});
  const doc = {
    title: 'Synthetic',
    mathBlocks: [],
    references: [],
    body: [
      { type: 'heading', level: 1, text: 'Introduction' },
      { type: 'paragraph', text: 'Body paragraph one.' },
      { type: 'figure', id: 'rf_fig_1.png', caption: '' },
      { type: 'figure', id: 'rf_fig_1.png', caption: '' },
      anonFigure({ id: 'anon_a' }),
      anonFigure({ id: 'anon_a' }),
      { type: 'equation', latex: 'E=mc^2' },
      { type: 'heading', level: 2, text: 'Dataset Preparation' },
      { type: 'paragraph', text: 'Body paragraph two.' },
    ],
  };

  const built = ModularLatexAssembler.assemble(doc, 'article_lncs', { hasBibFile: false });
  const all = effectiveTex(built.mainTex, built.files);

  assert.ok(!/\\caption\{\s*\}/.test(all), 'synthetic doc emitted an empty \\caption{}');
  ok('no empty \\caption{} in synthetic doc');

  const figCount = (all.match(/rf_fig_1/g) || []).length;
  assert.strictEqual(figCount, 1, `rf_fig_1 referenced ${figCount}x (expected 1)`);
  ok('identical figures are deduplicated');

  const anonCount = (all.match(/anon_a/g) || []).length;
  assert.strictEqual(anonCount, 1, `anon_a referenced ${anonCount}x (expected 1)`);
  ok('id-only figures are deduplicated');

  assert.ok(/E\s*=\s*mc\^2/.test(all), 'equation node not emitted');
  ok('equation node is emitted');

  assert.ok(/\\section\{Introduction\}/.test(all), 'Introduction must be a \\section');
  assert.ok(/\\subsection\{Dataset Preparation\}/.test(all), 'Dataset Preparation must be a \\subsection');
  ok('heading levels map to the correct LaTeX command');
}

// ── 7. deep-parser heading detection ────────────────────────────────────────
{
  const html = [
    '<html><body>',
    '<h1>Introduction</h1>',
    '<p>10 participants were enrolled in this study to evaluate the proposed approach thoroughly.</p>',
    '<h2>3. Materials and Methods</h2>',
    '<p>Some ordinary paragraph content that follows the heading.</p>',
    '</body></html>',
  ].join('\n');
  const parsed = DeepDocumentParser.parse(html, [], 'Heading-Test.docx');
  const headings = (parsed.body || []).filter((n) => n.type === 'heading').map((h) => String(h.text || ''));

  assert.ok(!headings.some((h) => /^participants\s+were\s+enrolled/i.test(h)),
    'a numbered sentence became a heading');
  ok('numbered sentences are not promoted to headings');

  assert.ok(headings.some((h) => /materials\s+and\s+methods/i.test(h)),
    'a real numbered section heading was rejected');
  ok('real numbered section headings are still detected');
}

// ── 8. deep-parser table captions ───────────────────────────────────────────
{
  const tableHtml = [
    '<html><body>',
    '<table><tr><th>Metric</th><th>Value</th></tr>',
    '<tr><td>Accuracy</td><td>0.91</td></tr>',
    '<tr><td>Recall</td><td>0.88</td></tr></table>',
    '</body></html>',
  ].join('\n');
  const tp = DeepDocumentParser.parse(tableHtml, [], 'Table-Test.docx');
  const caps = (tp.body || []).map((n) => String(n.caption || ''));
  assert.ok(!caps.some((c) => /rows?\s*[x\u00d7]\s*\d+\s*cols?/i.test(c)),
    'synthetic "Table (N rows x M cols)" caption was generated');
  ok('uncaptioned tables get no synthetic caption');
}

console.log(`\nVERIFICATION SUITE: ${n} checks passed`);
