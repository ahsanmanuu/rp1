import { FilePayload } from './compiler-utils';

function normalizePath(p: string): string {
  return (p || '').replace(/^\.\//, '').replace(/\\/g, '/').toLowerCase();
}

function findInFiles(files: FilePayload[], filename: string): boolean {
  const norm = normalizePath(filename);
  return files.some(f => normalizePath(f.path) === norm);
}

function findInContent(content: string, pattern: RegExp): boolean {
  return pattern.test(content);
}

const AMSMATH_LIKE = /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\b(amsmath|amssymb|amsfonts|mathtools)\b[^}]*\}/i;
const GRAPHICX_LIKE = /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bgraphicx\b[^}]*\}/i;
const HYPERREF_LIKE = /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bhyperref\b[^}]*\}/i;
const CLEVEREF_LIKE = /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bcleveref\b[^}]*\}/i;
const ADJUSTBOX_LIKE = /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\badjustbox\b[^}]*\}/i;
const ALLOWDISPLAYBREAKS = /\\allowdisplaybreaks\s*/;
const GRAPHICSPATH = /\\graphicspath\s*\{([^{}]*|\{[^{}]*\})*\}/;
const DECLARE_GRAPHICS_EXT = /\\DeclareGraphicsExtensions\s*\{([^{}]*|\{[^{}]*\})*\}/;
const INCLUDE_MAX_KEYS = /\\includegraphics\s*(?:\[[^\]]*\b(max\s*(?:width|height))\b[^\]]*\])?\s*\{/i;
const PACKAGES_REF = /\\(usepackage|RequirePackage|input)\s*(?:\[[^\]]*\])?\s*\{packages\}\s*/gi;

export interface PreprocessorResult {
  content: string;
  fixes: string[];
}

function moveAfter(main: string, cmdPattern: RegExp, afterPattern: RegExp, cmdName: string): PreprocessorResult {
  const fixes: string[] = [];
  let content = main;

  const cmdRegex = new RegExp(cmdPattern.source, 'g' + (cmdPattern.flags.includes('i') ? 'i' : ''));

  const afterMatch = content.match(afterPattern);
  if (!afterMatch || afterMatch.index === undefined) return { content, fixes };

  const insertPoint = afterMatch.index + afterMatch[0].length;

  let match;
  const found: { full: string; index: number }[] = [];
  cmdRegex.lastIndex = 0;
  while ((match = cmdRegex.exec(content)) !== null) {
    found.push({ full: match[0], index: match.index });
  }

  if (found.length === 0) return { content, fixes };

  // Collect all commands that are BEFORE the insert point
  const toMove = found.filter(c => c.index < insertPoint);
  if (toMove.length === 0) return { content, fixes };

  // Remove them in reverse order (to preserve indices)
  for (let i = toMove.length - 1; i >= 0; i--) {
    const cmd = toMove[i];
    content = content.substring(0, cmd.index) + content.substring(cmd.index + cmd.full.length);
  }

  // Insert after the afterPattern — the insert point shifted by total removed length
  const totalRemoved = toMove.reduce((sum, c) => sum + c.full.length, 0);
  const adjustedInsertPoint = insertPoint - totalRemoved;

  const beforeInsert = content.substring(0, adjustedInsertPoint);
  const afterInsert = content.substring(adjustedInsertPoint);
  const movedCmds = toMove.map(c => c.full).join('\n');
  content = beforeInsert + '\n' + movedCmds + afterInsert;

  fixes.push(`Moved ${toMove.length} ${cmdName} after its required package`);
  return { content, fixes };
}

export function preprocessLatex(
  texContent: string,
  allFiles: FilePayload[]
): PreprocessorResult {
  let content = texContent;
  const allFixes: string[] = [];

  // 0. Upgrade legacy graphics package to graphicx to prevent option clashes and enable keyval support
  const graphicsPkgRegex = /\\(usepackage|RequirePackage)\s*(\[[^\]]*\])?\s*\{([^}]*)\bgraphics\b([^}]*)\}/g;
  if (graphicsPkgRegex.test(content)) {
    content = content.replace(graphicsPkgRegex, (match, cmd, opts, before, after) => {
      allFixes.push('Upgraded legacy graphics package to graphicx');
      return `\\${cmd}${opts || ''}{${before}graphicx${after}}`;
    });
  }

  // 0c. Fix illegal [export] option on graphicx (which belongs to adjustbox)
  if (content.includes('usepackage[export]{graphicx}') || content.includes('RequirePackage[export]{graphicx}')) {
    content = content.replace(/\\(usepackage|RequirePackage)\s*\[export\]\s*\{graphicx\}/g, (match, cmd) => {
      allFixes.push('Moved [export] option from graphicx to adjustbox');
      return `\\${cmd}{graphicx}\n\\PassOptionsToPackage{export}{adjustbox}\n\\${cmd}{adjustbox}`;
    });
  }

  // 0b. Clean up hyphenated input/include/import paths caused by previous breakLongWords bug
  content = content.replace(/\\(input|include|import|subfile|subimport)(?:\*|\[.*?\])?\s*\{([^}]+)\}/gi, (match, cmd, filepath) => {
    if (filepath.includes('\\-')) {
      allFixes.push(`Healed hyphenated path in \\${cmd}{${filepath}}`);
      return `\\${cmd}{${filepath.replace(/\\-/g, '')}}`;
    }
    return match;
  });

  const hasPackagesSty = findInFiles(allFiles, 'packages.sty');
  const hasPackagesTex = findInFiles(allFiles, 'packages.tex');

  // 1. Comment out \usepackage{packages}, \RequirePackage{packages}, \input{packages}
  //    if no packages.sty or packages.tex exists in the project
  if (!hasPackagesSty && !hasPackagesTex) {
    content = content.replace(PACKAGES_REF, (match) => {
      allFixes.push('Commented out missing packages.sty reference');
      return `% ${match.trim()} -- REMOVED (not found in project)`;
    });
  }

  // 2. Move \allowdisplaybreaks after amsmath
  if (ALLOWDISPLAYBREAKS.test(content) && !AMSMATH_LIKE.test(content)) {
    // No amsmath found but allowdisplaybreaks exists — inject amsmath before the first one
    const firstBreak = content.match(ALLOWDISPLAYBREAKS);
    if (firstBreak) {
      const idx = firstBreak.index!;
      const before = content.substring(0, idx);
      const after = content.substring(idx);
      content = before + '\\usepackage{amsmath}\n' + after;
      allFixes.push('Injected amsmath before \\allowdisplaybreaks');
    }
  } else if (AMSMATH_LIKE.test(content) && ALLOWDISPLAYBREAKS.test(content)) {
    // Both exist — ensure allowdisplaybreaks comes after amsmath
    const result = moveAfter(content, /\\allowdisplaybreaks\s*/g, AMSMATH_LIKE, '\\allowdisplaybreaks');
    content = result.content;
    allFixes.push(...result.fixes);
  }

  // 3. Move \graphicspath and \DeclareGraphicsExtensions after graphicx
  if (GRAPHICSPATH.test(content) && !GRAPHICX_LIKE.test(content)) {
    const first = content.match(GRAPHICSPATH);
    if (first) {
      const idx = first.index!;
      const before = content.substring(0, idx);
      const after = content.substring(idx);
      content = before + '\\usepackage{graphicx}\n' + after;
      allFixes.push('Injected graphicx before \\graphicspath');
    }
  } else if (GRAPHICX_LIKE.test(content) && GRAPHICSPATH.test(content)) {
    const result = moveAfter(content, GRAPHICSPATH, GRAPHICX_LIKE, '\\graphicspath');
    content = result.content;
    allFixes.push(...result.fixes);
  }

  if (DECLARE_GRAPHICS_EXT.test(content) && !GRAPHICX_LIKE.test(content)) {
    const first = content.match(DECLARE_GRAPHICS_EXT);
    if (first) {
      const idx = first.index!;
      const before = content.substring(0, idx);
      const after = content.substring(idx);
      content = before + '\\usepackage{graphicx}\n' + after;
      allFixes.push('Injected graphicx before \\DeclareGraphicsExtensions');
    }
  } else if (GRAPHICX_LIKE.test(content) && DECLARE_GRAPHICS_EXT.test(content)) {
    const result = moveAfter(content, DECLARE_GRAPHICS_EXT, GRAPHICX_LIKE, '\\DeclareGraphicsExtensions');
    content = result.content;
    allFixes.push(...result.fixes);
  }

  // 4. Ensure cleveref comes after hyperref and amsmath
  if (CLEVEREF_LIKE.test(content) && HYPERREF_LIKE.test(content)) {
    const result = moveAfter(content, CLEVEREF_LIKE, HYPERREF_LIKE, 'cleveref');
    content = result.content;
    allFixes.push(...result.fixes);
  }
  if (CLEVEREF_LIKE.test(content) && AMSMATH_LIKE.test(content)) {
    const result = moveAfter(content, CLEVEREF_LIKE, AMSMATH_LIKE, 'cleveref');
    content = result.content;
    allFixes.push(...result.fixes);
  }

  // 4b. Make amsmath/amsfonts/amssymb loading idempotent. A bare
  //     \usepackage{amsmath} in an inlined body/section file would re-load the
  //     package and redefine equation* -> "Command \equation* already defined".
  content = content.replace(
    /\\(usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{[^}]*\bams(math|fonts|symb)\b[^}]*\}/gi,
    (m: string) => {
      const pkgMatch = m.match(/ams(math|fonts|symb)/i);
      const pkg = pkgMatch ? pkgMatch[0].toLowerCase() : 'amsmath';
      return `\\makeatletter\\@ifpackageloaded{${pkg}}{}{${m}}\\makeatother`;
    }
  );

  // 5. Ensure adjustbox[export] is loaded if \includegraphics uses max width/max height keys
  if (INCLUDE_MAX_KEYS.test(content) && !ADJUSTBOX_LIKE.test(content)) {
    content = content.replace(
      /(\\documentclass\s*(?:\[[^\]]*\])?\s*\{[^}]*\})/,
      '$1\n\\PassOptionsToPackage{export}{adjustbox}\n\\usepackage{adjustbox}'
    );
    allFixes.push('Injected adjustbox[export] for \\includegraphics max width/height support');
  }

  // 5b. TWO-COLUMN TABLE BLEED & OVERFLOW FIX: Wrap oversized tabular environments in adjustbox max width
  content = content.replace(
    /\\begin\s*\{\s*tabular\s*\}(\[.*?\])?\s*\{([^}]*)\}([\s\S]*?)\\end\s*\{\s*tabular\s*\}/gi,
    (match, opt, spec, body) => {
      // If already wrapped in adjustbox, resizebox, or table environment with width constraint, leave it
      if (match.includes('adjustbox') || match.includes('resizebox') || match.includes('tabularx')) {
        return match;
      }
      // Check if table contains multiple columns or likely wide content
      if (spec.length > 5 || spec.split(/[|crlp{}]/).filter(Boolean).length >= 3) {
        allFixes.push('Auto-wrapped multi-column table in adjustbox maxwidth=\\linewidth');
        return `\\begin{adjustbox}{max width=\\linewidth}\n\\begin{tabular}${opt || ''}{${spec}}${body}\\end{tabular}\n\\end{adjustbox}`;
      }
      return match;
    }
  );

  // 5c. IEEE ABSTRACT FIX: Ensure \IEEEtitleabstractindextext is present and abstract is not swallowed
  if (/class\s*\{[^}]*ieee/i.test(content) || /documentclass\s*(?:\[[^\]]*\])?\s*\{IEEEtran\}/i.test(content)) {
    if (!content.includes('\\IEEEtitleabstractindextext') && /\\begin\s*\{\s*abstract\s*\}/i.test(content)) {
      content = content.replace(
        /\\begin\s*\{\s*abstract\s*\}([\s\S]*?)\\end\s*\{\s*abstract\s*\}/i,
        '\\IEEEtitleabstractindextext{\\begin{abstract}$1\\end{abstract}}'
      );
      allFixes.push('Wrapped IEEE abstract inside \\IEEEtitleabstractindextext for proper two-column rendering');
    }
  }

  // 5d. MDPI AUTHOR & AFFILIATION ORDERING FIX: Ensure title comes before authors and affiliations
  if (/class\s*\{[^}]*mdpi/i.test(content) || /documentclass\s*(?:\[[^\]]*\])?\s*\{mdpi\}/i.test(content)) {
    const titleMatch = content.match(/\\title\s*\{[^}]+\}/);
    const authorMatch = content.match(/\\author\s*\{[^}]+\}/);
    const affilMatch = content.match(/\\address\s*\{[^}]+\}|\/affil\s*\{[^}]+\}/);
    if (titleMatch && authorMatch && content.indexOf(titleMatch[0]) > content.indexOf(authorMatch[0])) {
      // Move title before author/affil
      content = content.replace(authorMatch[0], '%%_AUTHOR_PLACEHOLDER_%%');
      if (affilMatch) content = content.replace(affilMatch[0], '%%_AFFIL_PLACEHOLDER_%%');
      content = content.replace('%%_AUTHOR_PLACEHOLDER_%%', authorMatch[0]);
      if (affilMatch) content = content.replace('%%_AFFIL_PLACEHOLDER_%%', affilMatch[0]);
      allFixes.push('Enforced title-first ordering for MDPI template');
    }
  }

  // 5e. MATH EQUATIONS & MATHML FALLBACK: Ensure equation environments have proper delimiters
  content = content.replace(/\\begin\s*\{\s*equation\s*\}([\s\S]*?)\\end\s*\{\s*equation\s*\}/gi, (m, inner) => {
    if (!inner.trim().startsWith('\\')) {
      return `\\begin{equation}${inner}\\end{equation}`;
    }
    return m;
  });

  // 6. Strip empty \DeclareGraphicsExtensions that reference nothing
  content = content.replace(/\\DeclareGraphicsExtensions\s*\{\s*\}/g, '% Removed empty \\DeclareGraphicsExtensions');

  // 7. Universal Deduplication of References / Bibliography Headings
  // Standard LaTeX \begin{thebibliography} and \bibliography automatically render the
  // "References" or "Bibliography" section heading. Preceding manual \section*{References},
  // \section{References}, \chapter*{References}, or \section*{Bibliography} headings
  // cause duplicate headings in the rendered PDF across all templates.
  const manualRefHeadingBeforeBib = /\\(?:section|chapter|subsection)\*?\s*\{\s*(?:References|Bibliography|REFERENCES|BIBLIOGRAPHY|Reference|Works\s+Cited)\s*\}(?:\s*\\label\{[^}]*\})?\s*(?=(?:\s*\\begin\s*\{thebibliography\}|\s*\\(?:input|include)\s*\{[^}]*(?:bib|ref)[^}]*\}|\s*\\bibliography\s*\{))/gi;
  if (manualRefHeadingBeforeBib.test(content)) {
    content = content.replace(manualRefHeadingBeforeBib, '');
    allFixes.push('Removed duplicate manual References/Bibliography heading preceding bibliography environment/input');
  }

  return { content, fixes: allFixes };
}

export function preprocessProjectFiles(
  files: FilePayload[],
  mainFile: string
): { files: FilePayload[]; fixes: string[] } {
  const allFixes: string[] = [];
  const normMain = normalizePath(mainFile);

  const processed = files.map(f => {
    const ext = f.path.split('.').pop()?.toLowerCase() || '';
    if (ext !== 'tex') return f;
    if (typeof f.content !== 'string') return f;

    const result = preprocessLatex(f.content, files);
    if (result.fixes.length > 0) {
      allFixes.push(`[${f.path}] ${result.fixes.join('; ')}`);
    }
    return { ...f, content: result.content };
  });

  return { files: processed, fixes: allFixes };
}
