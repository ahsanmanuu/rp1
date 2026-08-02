// Golden regression suite runner (Phase 8): executes every deterministic
// regression script and reports a summary. Scripts that need network/API
// keys (test-ai-structure.cjs) are intentionally excluded.
//
// Run: node scratch/golden-all.cjs
const { execFileSync } = require('child_process');
const path = require('path');

const SUITES = [
  { name: 'citations',         file: 'test-citations.cjs' },
  { name: 'bibtex-parity',     file: 'verify-bibtex.cjs' },
  { name: 'report-no-latex',   file: 'test-report-no-latex.cjs' },
  { name: 'golden-doc',        file: 'golden-doc.cjs' },
];

let failed = 0;
for (const suite of SUITES) {
  const script = path.join(__dirname, suite.file);
  process.stdout.write(`[golden] ${suite.name} ... `);
  try {
    execFileSync(process.execPath, [script], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    console.log('PASS');
  } catch (err) {
    failed++;
    console.log('FAIL');
    const out = String(err.stdout || '') + String(err.stderr || '');
    const tail = out.split(/\r?\n/).filter(Boolean).slice(-12).join('\n  ');
    console.log(`  --- ${suite.name} output tail ---\n  ${tail}`);
  }
}

console.log(`\nGOLDEN SUITE: ${SUITES.length - failed}/${SUITES.length} passed`);
process.exit(failed === 0 ? 0 : 1);
