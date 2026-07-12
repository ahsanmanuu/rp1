export interface DocumentStats {
  wordCount: number;
  charCount: number;
  imageCount: number;
  tableCount: number;
  equationCount: number;
  citationCount: number;
  referenceCount: number;
  pseudocodeCount: number;
  chartCount: number;
}

export function calculateDocumentStats(latex: string): DocumentStats {
  if (!latex) {
    return {
      wordCount: 0, charCount: 0, imageCount: 0, tableCount: 0,
      equationCount: 0, citationCount: 0, referenceCount: 0, pseudocodeCount: 0, chartCount: 0
    };
  }

  // 1. NLP Preamble and Comment Purger
  // Safely remove comments (ignoring escaped \%)
  const noComments = latex.replace(/(?<!\\)%.*/g, '');
  
  // Extract document body if it exists
  const bodyMatch = noComments.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  const content = bodyMatch ? bodyMatch[1] : noComments;

  // 2. NLP Text Normalizer - extract prose then strip structure
  let cleanText = content;

  // Step A: Remove display math environments entirely (not prose)
  cleanText = cleanText
    .replace(/\\begin\{(?:equation|align|gather|displaymath|math)\*?\}[\s\S]*?\\end\{(?:equation|align|gather|displaymath|math)\*?\}/g, ' ')
    .replace(/\\begin\{(?:figure|algorithm|lstlisting|tikzpicture)\*?\}[\s\S]*?\\end\{(?:figure|algorithm|lstlisting|tikzpicture)\*?\}/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ');

  // Step B: Remove tabular environments but extract captions
  cleanText = cleanText.replace(/\\begin\{(?:table|tabular|tabularx|longtable)\*?\}([\s\S]*?)\\end\{(?:table|tabular|tabularx|longtable)\*?\}/g, (_, inner) => {
    const capMatch = inner.match(/\\caption\*?\{([^}]+)\}/);
    return capMatch ? ` ${capMatch[1]} ` : ' ';
  });

  // Step C: Extract inner text from all semantic content-bearing commands BEFORE stripping
  // This preserves the actual manuscript prose that lives inside \section{}, \textbf{}, etc.
  // Iteratively unwrap nested braces for content commands
  let prev = '';
  while (prev !== cleanText) {
    prev = cleanText;
    cleanText = cleanText.replace(/\\(?:section|subsection|subsubsection|paragraph|subparagraph|caption|textbf|textit|emph|underline|textrm|textsf|texttt|title|author|abstract|keywords|item)\*?(?:\[[^\]]*\])?\{([^{}]+)\}/g, ' $1 ');
  }

  // Step D: Remove all remaining LaTeX commands (those without extractable content)
  cleanText = cleanText.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, ' ');

  // Step E: Strip leftover braces, inline math markers, and normalize whitespace
  cleanText = cleanText.replace(/[{}$\\]/g, ' ').replace(/\s+/g, ' ').trim();

  // 3. Advanced Citation Extractor
  const uniqueCites = new Set<string>();
  const citeMatches = noComments.matchAll(/\\cite(?:[a-zA-Z]*)(?:\[[^\]]*\])?\{([^}]+)\}/g);
  for (const m of citeMatches) {
    m[1].split(',').map(k => k.trim()).filter(Boolean).forEach(k => uniqueCites.add(k));
  }
  const citationCount = uniqueCites.size;

  const zimgCount = (noComments.match(/\\zimg\s*\{/g) || []).length;
  const igCount = (noComments.match(/\\includegraphics\s*(?:\[[^\]]*\])?\s*\{/g) || []).length;
  const chartCount = (noComments.match(/(?:\\includegraphics\s*(?:\[[^\]]*\])?\s*\{rf_chart|\\zimg\s*\{rf_chart)/g) || []).length;
  const totalGraphics = Math.max(0, (zimgCount + igCount) - chartCount);

  return {
    wordCount: cleanText.split(/\s+/).filter(w => w.length > 1).length,
    charCount: cleanText.length,
    imageCount: totalGraphics > 0 ? totalGraphics : (noComments.match(/\\begin\{(?:figure|figure\*|wrapfigure)\}/g) || []).length,
    tableCount: (() => {
      // Count outer \begin{table} / \begin{table*} / \begin{longtable} environments.
      // These are the LaTeX semantic unit for a table.
      // NOTE: \begin{tabular} always appears *inside* a \begin{table} so we must NOT
      // add them to the outer count — that would double every table.
      // Only fall back to counting standalone tabular/tabularx if no outer table env found.
      const outerEnvs = (noComments.match(/\\begin\{(?:table|table\*|longtable)\}/g) || []).length;
      if (outerEnvs > 0) return outerEnvs;
      // Fallback: document uses tabular without table wrapper (uncommon but valid)
      return (noComments.match(/\\begin\{(?:tabular|tabularx)\}/g) || []).length;
    })(),
    equationCount: (() => {
      let count = 0;
      
      // 1. Standalone equation environments (equation, equation*) - count as 1 each
      const eqEnvs = noComments.match(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g) || [];
      count += eqEnvs.length;
      
      // 2. Multiline math environments (align, gather, multline, eqnarray, flalign, alignat) - count by split lines (\\)
      const multiEnvs = noComments.match(/\\begin\{(?:align|gather|multline|eqnarray|flalign|alignat)\*?\}([\s\S]*?)\\end\{(?:align|gather|multline|eqnarray|flalign|alignat)\*?\}/g) || [];
      for (const env of multiEnvs) {
        const inner = env.replace(/\\begin\{[^}]+\}/, '').replace(/\\end\{[^}]+\}/, '').trim();
        if (inner) {
          const lines = inner.split(/\\\\/).map(l => l.trim()).filter(Boolean);
          count += Math.max(1, lines.length);
        }
      }
      
      // 3. Display math with $$ ... $$
      const display = noComments.match(/\$\$[\s\S]*?\$\$/g) || [];
      count += display.length;
      
      // 4. Display math with \[ ... \]
      const bracket = noComments.match(/\\\[[\s\S]*?\\\]/g) || [];
      count += bracket.length;
      
      return count;
    })(),
    citationCount,
    referenceCount: (noComments.match(/\\bibitem\s*(?:\[[^\]]*\])?\s*\{/g) || []).length ||
                    (noComments.match(/\\addbibresource|\\bibliography(?!\{[^}]*bib[^}]*style)/g) || []).length,
    pseudocodeCount: (() => {
      let temp = noComments;
      const outerCount = (temp.match(/\\begin\{(?:algorithm|lstlisting|procedure|listing|program)\*?\}/g) || []).length;
      temp = temp.replace(/\\begin\{(?:algorithm|lstlisting|procedure|listing|program)\*?\}[\s\S]*?\\end\{(?:algorithm|lstlisting|procedure|listing|program)\*?\}/g, '');
      const innerCount = (temp.match(/\\begin\{algorithmic\*?\}/g) || []).length;
      return outerCount + innerCount;
    })(),
    chartCount,
  };
}
