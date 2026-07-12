const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db');

function calculateDocumentStats(latex) {
  if (!latex) {
    return {
      wordCount: 0, charCount: 0, imageCount: 0, tableCount: 0,
      equationCount: 0, citationCount: 0, referenceCount: 0, pseudocodeCount: 0
    };
  }

  const noComments = latex.replace(/(?<!\\)%.*/g, '');
  const bodyMatch = noComments.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  const content = bodyMatch ? bodyMatch[1] : noComments;

  let cleanText = content;
  cleanText = cleanText
    .replace(/\\begin\{(?:equation|align|gather|displaymath|math)\*?\}[\s\S]*?\\end\{(?:equation|align|gather|displaymath|math)\*?\}/g, ' ')
    .replace(/\\begin\{(?:figure|algorithm|lstlisting|tikzpicture)\*?\}[\s\S]*?\\end\{(?:figure|algorithm|lstlisting|tikzpicture)\*?\}/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ');

  cleanText = cleanText.replace(/\\begin\{(?:table|tabular|tabularx|longtable)\*?\}([\s\S]*?)\\end\{(?:table|tabular|tabularx|longtable)\*?\}/g, (_, inner) => {
    const capMatch = inner.match(/\\caption\*?\{([^}]+)\}/);
    return capMatch ? ` ${capMatch[1]} ` : ' ';
  });

  let prev = '';
  while (prev !== cleanText) {
    prev = cleanText;
    cleanText = cleanText.replace(/\\(?:section|subsection|subsubsection|paragraph|subparagraph|caption|textbf|textit|emph|underline|textrm|textsf|texttt|title|author|abstract|keywords|item)\*?(?:\[[^\]]*\])?\{([^{}]+)\}/g, ' $1 ');
  }

  cleanText = cleanText.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, ' ');
  cleanText = cleanText.replace(/[{}$\\]/g, ' ').replace(/\s+/g, ' ').trim();

  let citationCount = 0;
  const citeMatches = noComments.matchAll(/\\cite(?:[a-zA-Z]*)(?:\[[^\]]*\])?\{([^}]+)\}/g);
  for (const m of citeMatches) {
    citationCount += m[1].split(',').map(k => k.trim()).filter(Boolean).length;
  }

  return {
    wordCount: cleanText.split(/\s+/).filter(w => w.length > 1).length,
    charCount: cleanText.length,
    imageCount: (() => {
      const figureEnvCount = (noComments.match(/\\begin\{(?:figure|figure\*|wrapfigure)\}/g) || []).length;
      if (figureEnvCount > 0) return figureEnvCount;
      const zimgCount = (noComments.match(/\\zimg\s*\{/g) || []).length;
      const igCount = (noComments.match(/\\includegraphics\s*(?:\[[^\]]*\])?\s*\{/g) || []).length;
      return zimgCount > 0 ? zimgCount : igCount;
    })(),
    tableCount: (() => {
      let temp = noComments;
      const outerEnvs = (temp.match(/\\begin\{(?:table|table\*|longtable)\}/g) || []).length;
      temp = temp.replace(/\\begin\{(?:table|table\*|longtable)\}[\s\S]*?\\end\{(?:table|table\*|longtable)\}/g, '');
      const innerEnvs = (temp.match(/\\begin\{(?:tabular|tabularx)\}/g) || []).length;
      return outerEnvs + innerEnvs;
    })(),
    equationCount: (() => {
      const envs = (noComments.match(/\\begin\{(?:equation|align|gather|displaymath|multline|eqnarray)\*?\}/g) || []).length;
      if (envs > 0) return envs;
      const display = (noComments.match(/\$\$[\s\S]*?\$\$/g) || []).length;
      const bracket = (noComments.match(/\\\[[\s\S]*?\\\]/g) || []).length;
      return display + bracket;
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
    })()
  };
}

const pid = 'cmpjh74qt00u5d4g4utpllrbm';
console.log('Project:', pid);

const project = db.prepare("SELECT * FROM Project WHERE id=?").get(pid);
const files = db.prepare("SELECT * FROM ProjectFile WHERE projectId=?").all(pid);

function resolveLatexInputs(mainTex, files) {
  let resolved = mainTex;
  const inputRegex = /\\(?:input|include)\s*\{([^}]+)\}/g;
  for (let depth = 0; depth < 5; depth++) {
    let hasReplacements = false;
    resolved = resolved.replace(inputRegex, (match, filepath) => {
      let cleanPath = filepath.trim().replace(/\.tex$/, '');
      cleanPath = cleanPath.replace(/^\.\//, '').replace(/\\/g, '/');
      const possibleNames = [
        cleanPath,
        `${cleanPath}.tex`,
        cleanPath.split('/').pop() || '',
        (cleanPath.split('/').pop() || '') + '.tex'
      ];
      
      const file = files.find(f => {
        const fNorm = f.filename.trim().replace(/^\.\//, '').replace(/\\/g, '/');
        const fNormNoExt = fNorm.replace(/\.tex$/, '');
        return possibleNames.includes(fNorm) || possibleNames.includes(fNormNoExt);
      });

      if (file && file.content) {
        hasReplacements = true;
        return file.content;
      }
      return match;
    });
    if (!hasReplacements) break;
  }
  return resolved;
}

const resolvedLatex = resolveLatexInputs(project.latexContent, files);
const stats = calculateDocumentStats(resolvedLatex);
console.log('\nRecalculated stats:', stats);

// Let's count equation environments manually
const eqCount = (resolvedLatex.match(/\\begin\{equation\}/g) || []).length;
const alignCount = (resolvedLatex.match(/\\begin\{align/g) || []).length;
const bracketCount = (resolvedLatex.match(/\\\[/g) || []).length;
console.log('\nManual checks in resolvedLatex:');
console.log('  \\begin{equation}:', eqCount);
console.log('  \\begin{align}:', alignCount);
console.log('  \\\[:', bracketCount);

db.close();
