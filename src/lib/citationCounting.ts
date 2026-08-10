/**
 * Citation & reference counting — shared, dependency-free, client-safe.
 *
 * Used by both the server parser (DeepDocumentParser) and the client studio
 * (upload page) so that in-text citation counts are always computed from the
 * stored raw HTML with identical logic, instead of trusting stale snapshots.
 *
 * Rules (universal, no document bias):
 *  - Reference-list entries ("[1]. Author, Title, ...") are NOT citations —
 *    they are stripped before bracket counting.
 *  - Instructional/descriptive bracket usage ("like [1]", "e.g. [2]",
 *    "between [1] and [3]", "pixels [1-2]") is NOT a citation.
 *  - Everything else in [N], [N,M] or [N-M] form counts once per unique number.
 */

const REF_ENTRY_LINE_RE = /^\[\s*\d{1,3}\s*\]\s*[.\-–—\t\s]/;
const REF_ENTRY_ONLY_RE = /^\[\s*\d{1,3}\s*\]\s*$/;

/** Remove reference-list entries from HTML text used for in-text citation counting. */
export function stripReferenceEntriesFromHtml(html: string): string {
  return html
    .split(/<\/(?:p|li|div|tr|h[1-6]|blockquote)\s*>/gi)
    .map(chunk => {
      const textOnly = chunk.replace(/<[^>]*>/g, '').replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;/gi, ' ').trim();
      if (REF_ENTRY_ONLY_RE.test(textOnly) || REF_ENTRY_LINE_RE.test(textOnly)) {
        // Chunk is entirely a reference entry — drop it. But a chunk may contain
        // several entries on separate lines ("[1]. A\n[2]. B"): strip entry lines only.
        const lines = chunk.split('\n').map(line => {
          const lt = line.replace(/<[^>]*>/g, '').replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;/gi, ' ').trim();
          if (REF_ENTRY_ONLY_RE.test(lt) || REF_ENTRY_LINE_RE.test(lt)) return '';
          return line;
        });
        const rejoined = lines.join('\n').trim();
        return rejoined.length > 0 ? rejoined : '';
      }
      // Chunk is a normal paragraph — also drop any embedded entry lines
      // (mammoth can merge entries into one paragraph with newlines).
      return chunk
        .split('\n')
        .map(line => {
          const lt = line.replace(/<[^>]*>/g, '').replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;/gi, ' ').trim();
          if (REF_ENTRY_ONLY_RE.test(lt) || REF_ENTRY_LINE_RE.test(lt)) return '';
          return line;
        })
        .join('\n');
    })
    .join('</p>');
}

/** Merge "[A]-[B]" ranges and consecutive "[A], [B]" into a single bracket list. */
export function mergeCitations(text: string): string {
  let prevText = '';
  let currentText = text;

  while (currentText !== prevText) {
    prevText = currentText;

    // 1. Merge range brackets: [A]-[B] or [A]–[B] -> [A, A+1, ..., B]
    currentText = currentText.replace(/\[\s*(\d{1,3})\s*\]\s*[-–—\u2013\u2014]\s*\[\s*(\d{1,3})\s*\]/gi, (match, sStr, eStr) => {
      const start = parseInt(sStr, 10), end = parseInt(eStr, 10);
      if (!isNaN(start) && !isNaN(end) && start < end && end - start < 30) {
        return '[' + Array.from({ length: end - start + 1 }, (_, i) => start + i).join(',') + ']';
      }
      return match;
    });

    // 2. Merge consecutive brackets: [A], [B] or [A] [B] -> [A, B]
    currentText = currentText.replace(/\[\s*(\d{1,3}(?:\s*[,;–\-\u2013\u2014]\s*\d{1,3})*)\s*\]\s*[,;\s]*\s*\[\s*(\d{1,3}(?:\s*[,;–\-\u2013\u2014]\s*\d{1,3})*)\s*\]/gi, (match, inner1, inner2) => {
      if (inner1.split(/[,;–\-\u2013\u2014]/).some((part: string) => part.trim() === '0') ||
          inner2.split(/[,;–\-\u2013\u2014]/).some((part: string) => part.trim() === '0')) {
        return match;
      }
      return '[' + inner1 + ',' + inner2 + ']';
    });
  }
  return currentText;
}

/**
 * Count unique in-text citation numbers from raw document HTML.
 * Reference-list entries are excluded; instructional bracket usage is excluded.
 * False positive exclusions: "[1.0]", "[Table 1]", "[Fig. 1]", "[n]",
 * mathematical ranges like "[0, 1]".
 */
export function countCitationsFromHtml(rawHtml: string): number {
  const mergedHtml = mergeCitations(stripReferenceEntriesFromHtml(rawHtml || ''));
  // Exclude brackets that are clearly NOT citations:
  // - [N.N] (decimal numbers like [1.0], [2.5])
  // - [Table N], [Fig. N], [Figure N], [Alg. N] (component references)
  // - [n], [x], [i], [k] (single lowercase variable names)
  // - [0, 1], [0.0, 1.0] (mathematical ranges)
  // Then match standard citation patterns [N], [N,M], [N-M]
  const cleanedHtml = mergedHtml
    .replace(/\[\s*\d+\.\d+\s*\]/gi, '')          // [1.0], [2.5]
    .replace(/\[(?:table|fig(?:ure)?|alg(?:orithm)?|eq(?:uation)?)\.?\s*\d+\]/gi, '') // [Table 1], [Fig. 1]
    .replace(/\[\s*[a-z]\s*\]/gi, '')              // [n], [x], [i]
    .replace(/\[\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*\]/gi, ''); // [0, 1]
  const rawBracketMatches = cleanedHtml.match(/(?<![a-zA-Z0-9\]\)]\s*(?:interval|range|scale|domain|coordinates|matrix|vector|box|bounds|values|pixel|pixels|from|to|between|like|such\s+as|e\.g\.?|eg\.?|bracket|for\s+example|example)\s*(?:\[\s*\d{1,3}\s*\]\s*[,;\s]*)*)\[\s*\d{1,3}(?:\s*[,;\u2013\-]\s*\d{1,3})*\s*\]/gi) || [];
  const seen = new Set<number>();
  for (const m of rawBracketMatches) {
    const inner = m.replace(/[\[\]\s]/g, '');
    const parts = inner.split(/[,;–\-\u2013\u2014]/).map(p => p.trim()).filter(Boolean);
    const hasZero = parts.some(p => p === '0');
    let offset = 0;
    if (hasZero && parts.every(p => /^\d+$/.test(p))) {
      offset = 1;
    }
    if (offset > 0 && parts.some(p => /^\d+\s*[-–]\s*\d+$/.test(p))) {
      const rangeParts = parts.filter(p => /^\d+\s*[-–]\s*\d+$/.test(p));
      for (const rp of rangeParts) {
        const [lo, hi] = rp.split(/[-–]/).map(n => parseInt(n.trim(), 10) + offset);
        for (let n = lo; n <= hi; n++) seen.add(n);
      }
    } else {
      for (const part of parts) {
        const rangeMatch = part.match(/^(\d+)[\u2013\-](\d+)$/);
        if (rangeMatch) {
          const lo = parseInt(rangeMatch[1], 10), hi = parseInt(rangeMatch[2], 10);
          for (let n = lo; n <= hi; n++) seen.add(n);
        } else if (/^\d+$/.test(part.trim())) {
          seen.add(parseInt(part.trim(), 10) + offset);
        }
      }
    }
  }
  return seen.size;
}
