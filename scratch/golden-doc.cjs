// Golden-document regression (Phase 8): replay the deterministic pipeline
// (parser -> assembler -> image audit) over the committed fixture and assert
// the invariants that must never regress:
//   - parse integrity (sections/body/references)
//   - stats sanity (non-negative integers)
//   - assembler emits a complete document (documentclass + begin/end document)
//   - no broken input/include paths (hyphenated \input from breakLongWords bug)
//   - every image reference is well-formed (rf_fig_N / rf_chart_N)
//
// Run: node scratch/golden-doc.cjs
const fs = require('fs');
const path = require('path');

const FIXTURE = path.join(__dirname, 'fixtures', 'rawHtml.html');

const { DeepDocumentParser } = require('./compiled-ai/lib/deep-parser.js');
const { ModularLatexAssembler } = require('./compiled-ai/lib/assembler.js');
const { auditLatexImageReferences } = require('./compiled-ai/lib/latex-image-audit.js');

if (!fs.existsSync(FIXTURE)) {
  console.error(`Missing golden fixture: ${FIXTURE}`);
  process.exit(1);
}

const rawHtml = fs.readFileSync(FIXTURE, 'utf-8');
const parsed = DeepDocumentParser.parse(rawHtml, [], 'Golden-Manuscript.docx');
const issues = [];

// 1. Parse integrity
if (!Array.isArray(parsed.body) || parsed.body.length === 0) issues.push('body empty');
const sectionCount = parsed.body.filter((n) => n.type === 'section' || n.type === 'heading').length;
if (sectionCount < 3) issues.push(`section count too low: ${sectionCount}`);
if (parsed.title && parsed.title.length > 0) console.log(`  golden title: ${parsed.title.slice(0, 80)}`);

// 2. Stats sanity
const stats = parsed.stats || {};
for (const key of ['wordCount', 'imageCount', 'tableCount', 'equationCount', 'citationCount', 'referenceCount', 'pseudocodeCount', 'chartCount']) {
  const v = stats[key];
  if (!Number.isInteger(v) || v < 0) issues.push(`stats.${key} not a non-negative integer: ${JSON.stringify(v)}`);
}
if (stats.wordCount < 50) issues.push(`wordCount implausibly low: ${stats.wordCount}`);

// 3. Assembler emits a complete document
const assembled = ModularLatexAssembler.assemble(parsed, 'article_lncs', { hasBibFile: false });
const mainTex = assembled.mainTex || '';
if (!mainTex.includes('\\documentclass')) issues.push('mainTex missing \\documentclass');
if (!mainTex.includes('\\begin{document}')) issues.push('mainTex missing \\begin{document}');
if (!mainTex.includes('\\end{document}')) issues.push('mainTex missing \\end{document}');

// 4. No broken input/include paths (hyphenation bug regression)
const inputPaths = [...mainTex.matchAll(/\\(?:input|include|import|subfile|subimport)\s*\{([^}]+)\}/gi)].map((m) => m[1]);
const brokenInputs = inputPaths.filter((p) => p.includes('\\-'));
if (brokenInputs.length > 0) issues.push(`broken hyphenated input paths: ${brokenInputs.join(', ')}`);

// 5. Image reference well-formedness
const refs = auditLatexImageReferences(mainTex, []);
const malformed = refs.resolved.filter((r) => !/^rf_(fig|chart)_\d+(\.\w+)?$/i.test(r));
if (malformed.length > 0) issues.push(`malformed image refs: ${malformed.join(', ')}`);

// 6. Modular components present
const fileCount = Object.keys(assembled.files || {}).length;
if (fileCount === 0) issues.push('assembler produced no modular files');

console.log(`  body=${parsed.body.length} sections=${sectionCount} refs=${parsed.references.length} modularFiles=${fileCount} imageRefs=${refs.total}`);
console.log(`  mainTex=${mainTex.length} bytes`);

console.log('\n=== RESULT ===');
if (issues.length) {
  issues.forEach((i) => console.log(' - ' + i));
  process.exit(1);
}
console.log('ALL GOLDEN-DOC CHECKS PASS');
process.exit(0);
