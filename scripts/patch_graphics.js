const fs = require('fs');
let src = fs.readFileSync('src/lib/assembler.ts', 'utf8');
const idx = src.indexOf('DeclareGraphicsExtensions');
if (idx === -1) { console.log('Not found'); process.exit(1); }
// Show context
console.log('Current context:', JSON.stringify(src.substring(idx - 10, idx + 80)));
// Count backslashes before DeclareGraphicsExtensions
let bsCount = 0;
let pos = idx - 1;
while (pos >= 0 && src[pos] === '\\') { bsCount++; pos--; }
console.log('Backslashes before command:', bsCount);
// We want exactly 2 backslashes in the source (which renders as \DeclareGraphicsExtensions in the string)
// Currently there are 4 (\\\\), we need 2 (\\)
if (bsCount === 4) {
  const lineStart = src.lastIndexOf('\n', idx) + 1;
  const lineEnd = src.indexOf('\n', idx);
  const line = src.substring(lineStart, lineEnd);
  const fixedLine = line.replace('\\\\\\\\DeclareGraphicsExtensions', '\\\\DeclareGraphicsExtensions');
  src = src.substring(0, lineStart) + fixedLine + src.substring(lineEnd);
  fs.writeFileSync('src/lib/assembler.ts', src, 'utf8');
  console.log('Fixed: now 2 backslashes');
} else {
  console.log('Already correct:', bsCount, 'backslashes');
}
