const fs = require('fs');
const h = fs.readFileSync('scratch/raw.html', 'utf-8');

// For each marker 0-34, analyze if it's standalone in its paragraph
for (let i = 0; i <= 34; i++) {
  const marker = 'MATHBLOCKX' + i + 'XMARKER';
  const idx = h.indexOf(marker);
  if (idx === -1) { console.log('MX' + i + ': NOT FOUND'); continue; }

  // Get surrounding context
  const before = h.slice(Math.max(0, idx - 300), idx);
  const after = h.slice(idx, idx + 300);

  // Find nearest opening block tag
  const tagMatch = before.match(/<(p|li|td|th|h[1-6])(\s[^>]*)?>\s*$/s);
  const tagName = tagMatch ? tagMatch[1] : 'unknown';

  // Get content between open tag and close tag
  const closeTag = '</' + tagName + '>';
  const closeIdx = after.indexOf(closeTag);
  const inner = after.slice(0, closeIdx === -1 ? 250 : closeIdx);

  // Strip the marker itself and any HTML tags/whitespace to see what else is there
  const stripped = inner
    .replace(marker, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<em>\s*<\/em>/gi, '')
    .replace(/<strong>\s*<\/strong>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const isStandalone = stripped.length < 5;
  const mark = isStandalone ? '[STANDALONE]' : '[  inline  ]';
  console.log('MX' + String(i).padStart(2,'0') + ' <' + tagName + '> ' + mark + ' remaining=' + JSON.stringify(stripped.slice(0, 100)));
}
