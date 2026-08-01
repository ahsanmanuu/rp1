const fs = require('fs');
const path = require('path');

// Load .env.local into process.env BEFORE requiring gateway modules (config.ts
// reads API keys at import time).
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

const { DeepDocumentParser } = require('./compiled/deep-parser.cjs');
const {
  analyzeManuscriptStructure,
  applyStructureCorrections,
} = require('./compiled-ai/lib/ai-manuscript-analysis.js');
const { ModularLatexAssembler } = require('./compiled-ai/lib/assembler.js');

async function main() {
  const rawHtml = fs.readFileSync('C:/Users/MANUU/AppData/Local/Temp/opencode/rawHtml.html', 'utf8');
  const before = DeepDocumentParser.parse(rawHtml, [], 'Manuscript-Template.docx');

  console.log('=== HEURISTIC PARSE (before AI) ===');
  console.log('title:', JSON.stringify(before.title));
  console.log('authors:', JSON.stringify(before.authors.map(a => a.name)));
  console.log('organizations:', JSON.stringify(before.organizations));
  console.log('keywords:', JSON.stringify(before.keywords));
  console.log('abstract (len):', (before.abstract || '').length);
  console.log('stats:', JSON.stringify(before.stats));

  const t0 = Date.now();
  const aiRes = await analyzeManuscriptStructure(before, {
    html: rawHtml,
    filename: 'Manuscript-Template.docx',
    userId: null,
  });
  const elapsed = Date.now() - t0;

  console.log('\n=== AI ANALYSIS ===');
  if (!aiRes) {
    console.log('AI unavailable — heuristics preserved. FAIL');
    process.exit(1);
  }
  console.log('model:', aiRes.model, '| time:', elapsed + 'ms');
  console.log('verdict:', JSON.stringify(aiRes.verdict, null, 1));

  const { applied } = applyStructureCorrections(before, aiRes.verdict, aiRes.model);
  console.log('\n=== CORRECTIONS APPLIED ===', applied.join(', ') || 'none');

  console.log('\n=== CORRECTED DOC ===');
  console.log('title:', JSON.stringify(before.title));
  console.log('authors:', JSON.stringify(before.authors.map(a => a.name + (a.affiliation ? ' <' + a.affiliation + '>' : ''))));
  console.log('organizations:', JSON.stringify(before.organizations));
  console.log('keywords:', JSON.stringify(before.keywords));
  console.log('abstract (len):', (before.abstract || '').length);
  console.log('references:', before.references.length);
  console.log('stats:', JSON.stringify(before.stats));

  console.log('\n=== MODULAR FLUSH (excerpts) ===');
  const modular = ModularLatexAssembler.assemble(before, 'article_lncs', { hasBibFile: false });
  const files = modular.files || {};
  for (const f of [
    'metadata/title.tex',
    'metadata/authors.tex',
    'metadata/abstract.tex',
    'metadata/keywords.tex',
    'metadata/organizations.json',
  ]) {
    const c = files[f];
    if (c === undefined) {
      console.log(`MISSING FILE: ${f}`);
      continue;
    }
    console.log(`--- ${f} ---`);
    console.log(String(c).slice(0, 400));
  }

  const issues = [];
  const verdict = aiRes.verdict;
  if (!verdict.title?.text || verdict.title.text.length < 5) issues.push('AI title missing/too short');
  if (before.title === 'Manuscript-Template.docx') issues.push('title not corrected from filename fallback');
  if (!before.authors.length) issues.push('authors empty after correction');
  if (!before.abstract || before.abstract.length < 30) issues.push('abstract missing after correction');
  if (!before.keywords.length) issues.push('keywords empty after correction');
  if (applied.length === 0) issues.push('no corrections applied');
  if (typeof verdict.components?.references === 'number' && verdict.components.references > 0 && before.references.length === 0) {
    issues.push('AI detected references but reference list is empty');
  }

  console.log('\n=== RESULT ===');
  if (issues.length) {
    console.log('ISSUES:');
    issues.forEach(i => console.log(' - ' + i));
    process.exit(1);
  }
  console.log('ALL AI-STRUCTURE CHECKS PASS');
  process.exit(0);
}

main().catch(err => {
  console.error('TEST CRASH:', err);
  process.exit(1);
});
