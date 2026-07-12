const GREEK_MAP: Record<string, string> = {
  'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ', 'ε': '\\epsilon ',
  'ζ': '\\zeta ', 'η': '\\eta ', 'θ': '\\theta ', 'ι': '\\iota ', 'κ': '\\kappa ',
  'λ': '\\lambda ', 'μ': '\\mu ', 'ν': '\\nu ', 'ξ': '\\xi ', 'ο': 'o ',
  'π': '\\pi ', 'ρ': '\\rho ', 'σ': '\\sigma ', 'τ': '\\tau ', 'υ': '\\upsilon ',
  'φ': '\\phi ', 'χ': '\\chi ', 'ψ': '\\psi ', 'ω': '\\omega ',
  'Α': 'A ', 'Ｂ': 'B ', 'Γ': '\\Gamma ', 'Δ': '\\Delta ', 'Ｅ': 'E ',
  'Ｚ': 'Z ', 'Ｈ': 'H ', 'Θ': '\\Theta ', 'Ｉ': 'I ', 'Ｋ': 'K ',
  'Λ': '\\Lambda ', 'Ｍ': 'M ', 'Ｎ': 'N ', 'Ξ': '\\Xi ', 'Ｏ': 'O ',
  'Π': '\\Pi ', 'Ρ': 'P ', 'Σ': '\\Sigma ', 'Ｔ': 'T ', 'Ｙ': '\\Upsilon ',
  'Φ': '\\Phi ', 'Ｘ': 'X ', 'Ψ': '\\Psi ', 'Ω': '\\Omega ',
  '±': '\\pm ', '×': '\\times ', '÷': '\\div ', '≈': '\\approx ', '≠': '\\neq ',
  '≤': '\\leq ', '≥': '\\geq ', '∞': '\\infty ', '∫': '\\int ', '∂': '\\partial ',
  '√': '\\sqrt ', '∈': '\\in ', '∉': '\\notin ', '∑': '\\sum ', '∏': '\\prod ',
  '∇': '\\nabla ', '∠': '\\angle ', '°': '^{\\circ}', '…': '\\dots ',
  '→': '\\ensuremath{\\rightarrow} ', '←': '\\ensuremath{\\leftarrow} ', '↔': '\\ensuremath{\\leftrightarrow} ', '⇒': '\\ensuremath{\\Rightarrow} ',
  '∘': '\\ensuremath{^{\\circ}}', 'ǁ': '\\ensuremath{\\parallel} ', '◦': '\\ensuremath{^{\\circ}}',
  '⋅': '\\ensuremath{\\cdot}', '·': '\\ensuremath{\\cdot}',
  '\u2212': '\\ensuremath{-}', '\u2217': '*',
  '\u207B': '\\ensuremath{^{-}}', '\u025B': '\\epsilon ', '\u2126': '\\Omega ', '\u2013': '--', '\u2014': '---',
  '\u2019': "'", '\u2018': "`", '\u201C': "``", '\u201D': "''",
  '\u2215': '/', '\u2010': '-'
};

/**
 * PHASE 23.0 MASTER SIEVE
 * Aggressively scrubs engine-specific phantom artifacts that trigger
 * during remote LaTeX compilation (e.g. "color color", "Scale=MatchLowercase").
 */
export function applyFinalSanitizationSieve(content: string): string {
  if (!content) return "";
  let sanitized = content;

  // 0. Universal Unicode & Delimiter Sieve
  for (const [char, tex] of Object.entries(GREEK_MAP)) {
    sanitized = sanitized.split(char).join(tex);
  }
  sanitized = sanitized.replace(/\\texttimes\b/g, "\\ensuremath{\\times}");
  sanitized = sanitized.replace(/\\textellipsis\b/g, "\\dots");

  // Delimiter mismatch fix: strip illegal '$' from display math environments
  const mathEnvs = ['equation', 'align', 'gather', 'multline', 'eqnarray', 'displaymath'];
  mathEnvs.forEach(env => {
    const envRegex = new RegExp(`(\\\\begin\\s*\\{\\s*${env}\\*?\\s*\\})([\\s\\S]*?)(\\\\end\\s*\\{\\s*${env}\\*?\\s*\\})`, 'g');
    sanitized = sanitized.replace(envRegex, (_match, begin, body, end) => {
      return begin + body.replace(/\$/g, '') + end;
    });
  });
  sanitized = sanitized.replace(/(\\\[)([\s\S]*?)(\\\])/g, (_match, begin, body, end) => {
    return begin + body.replace(/\$/g, '') + end;
  });

  // 1. Scrub orphaned "color color" artifacts
  sanitized = sanitized.replace(/color\s+color/gi, "");
  sanitized = sanitized.replace(/color\s+color\s+bstract/gi, "");
  sanitized = sanitized.replace(/\bbstract\b/gi, "abstract");
  sanitized = sanitized.replace(/\\color\s*\{color\}/gi, "");

  // 2. Scrub font feature injections from XeLaTeX leakage
  sanitized = sanitized.replace(/\\defaultfontfeatures\s*\{[^}]*Scale=MatchLowercase[^}]*\}/gi, "");
  sanitized = sanitized.replace(/Scale=MatchLowercase/g, "");
  sanitized = sanitized.replace(/\\ifPDFTeX[\s\S]*?\\else[\s\S]*?\\fi/gi, (match) => {
    if (match.includes('Scale=MatchLowercase') && !match.includes('fontspec')) {
       return "% Removed phantom font feature block\n";
    }
    return match;
  });

  // 3. Fix \Beta → \beta (\Beta does not exist in LaTeX)
  sanitized = sanitized.replace(/\\Beta(?![a-zA-Z])/g, "\\beta");

  // 4. Strip epstopdf and svg packages (auto-loaded or conflicting)
  sanitized = sanitized.replace(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{epstopdf(?:,svg)?\}\s*\n?/g, "");
  sanitized = sanitized.replace(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{svg\}\s*\n?/g, "");
  sanitized = sanitized.replace(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{(?:[^}]*,)?epstopdf(?:,[^}]*)?\}\s*\n?/g, "");

  // 🛡️ Universal Style Fix: Comment out missing local dependencies (e.g. packages.sty)
  sanitized = sanitized.replace(/\\(?:usepackage|RequirePackage|input)\s*\{packages\}\s*/gi, "% Removed missing local dependency\n");
  sanitized = sanitized.replace(/\\(?:usepackage|input)\s*\{siamart190516.sty\}\s*/gi, "\\usepackage{siamart190516}\n");


  // 5. Deduplicate \usepackage lines in preamble (keep first occurrence)
  const docStart = sanitized.indexOf('\\begin{document}');
  if (docStart !== -1) {
    let preamble = sanitized.substring(0, docStart);
    const body = sanitized.substring(docStart);
    const seenPkgs = new Set<string>();
    preamble = preamble.split('\n').filter(line => {
      const pkgMatch = line.match(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);
      if (pkgMatch) {
        const key = line.trim().replace(/\s+/g, ' ');
        if (seenPkgs.has(key)) return false;
        seenPkgs.add(key);
      }
      return true;
    }).join('\n');
    // 6. Remove duplicate \allowdisplaybreaks (keep only one)
    let adCount = 0;
    preamble = preamble.replace(/\\allowdisplaybreaks\s*\n?/g, (m) => {
      adCount++;
      return adCount === 1 ? m : '';
    });
    // 7. Remove body-mode settings that snuck into preamble area (before \begin{document})
    // These ONLY work inside the document body, not the preamble
    preamble = preamble.replace(/^\\sloppy\s*$/mg, '');
    preamble = preamble.replace(/^\\raggedbottom\s*$/mg, '');
    preamble = preamble.replace(/^\\emergencystretch\s*=\s*\d+\w+\s*$/mg, '');
    preamble = preamble.replace(/^\\hbadness\s*=\s*\d+\s*$/mg, '');
    preamble = preamble.replace(/^\\vbadness\s*=\s*\d+\s*$/mg, '');
    preamble = preamble.replace(/^\\hfuzz\s*=\s*[\d.]+\w+\s*$/mg, '');
    preamble = preamble.replace(/^\\vfuzz\s*=\s*[\d.]+\w+\s*$/mg, '');
    preamble = preamble.replace(/^\\maxdeadcycles\s*=\s*\d+\s*$/mg, '');
    // 8. Fix "There's no line here to end" errors
    // Remove \\ immediately before environments or at end of lines where they are illegal
    let cleanBody = body.replace(/\\\\\s*(\\end\{|\\section|\\subsection|\\item|\\begin\{list|\\begin\{description|\\begin\{enumerate|\\begin\{itemize})/g, "$1");

  // 9. Inject universally required packages (adjustbox for tables/algos, placeins for FloatBarrier)
  // Use \providecommand-safe injection: only add if not already in preamble
  const universalPkgs: [string, string][] = [
    ['adjustbox', '\\usepackage[export]{adjustbox}'],
    ['booktabs', '\\usepackage{booktabs}'],
    ['placeins', '\\usepackage{placeins}'],
    ['float', '\\usepackage{float}'],
    ['caption', '\\usepackage[labelfont=bf,labelsep=period]{caption}'],
  ];
  const docClassMatch = preamble.match(/\\documentclass[^{]*\{([^}]+)\}/);
  const docClass = docClassMatch ? docClassMatch[1].toLowerCase() : '';
  // Don't inject caption for IEEEtran (it redefines caption internally)
  const skipCaption = docClass.includes('ieee') || docClass.includes('acm');
  for (const [pkgName, pkgLine] of universalPkgs) {
    if (pkgName === 'caption' && skipCaption) continue;
    if (!preamble.includes(`{${pkgName}}`)) {
      // Insert before \begin{document} marker position
      preamble = preamble.trimEnd() + '\n' + pkgLine + '\n';
    }
  }

  // Inject universal subfigure fallback
  if (!preamble.includes('UNIVERSAL SUBFIGURE FALLBACK')) {
    const subfigureFallback = `
% --- UNIVERSAL SUBFIGURE FALLBACK ---
\\catcode\`\\@=11
\\@ifundefined{subfigure}{
  \\newcounter{localsubfig}[figure]
  \\newenvironment{subfigure}[2][]{%
    \\begin{minipage}{#2}%
      \\refstepcounter{localsubfig}%
      \\def\\caption##1{%
        \\par\\vspace{5pt}{\\centering\\small(\\alph{localsubfig})~##1\\par}%
      }%
  }{%
    \\end{minipage}%
  }
}{}
\\catcode\`\\@=12
`;
    preamble = preamble.trimEnd() + '\n' + subfigureFallback + '\n';
  }

    // Universal Preamble Healing: Extract and safeguard authblk/style overrides
    const authOverrides: string[] = [];
    const authOverrideRegex = /(?:\\(?:renewcommand|newcommand|providecommand)\s*(?:\\Authfont|\\Affilfont|\\AuthCmd|\\AffilCmd|\{\\Authfont\}|\{\\Affilfont\}|\{\\AuthCmd\}|\{\\AffilCmd\})\s*(?:\[[^\]]*\])?\s*\{([\s\S]*?)\}|\\setlength\s*\{\s*\\affilsep\s*\}\s*\{[^{}]*\}|\\setlength\s*\\affilsep\s*\{[^{}]*\})/g;
    
    preamble = preamble.replace(authOverrideRegex, (match) => {
      authOverrides.push(match);
      return `% Extracted for safe AtBeginDocument ordering\n`;
    });

    if (authOverrides.length > 0) {
      // Wrap each override in \ifdefined guards so they are no-ops if the package is absent
      const safeOverrides = authOverrides.map(ov => {
        if (ov.includes('\\affilsep')) {
          return `\\ifdefined\\affilsep\n${ov}\n\\fi`;
        }
        if (ov.includes('\\Authfont') || ov.includes('\\Affilfont')) {
          return `\\ifdefined\\Authfont\n${ov}\n\\fi`;
        }
        return ov;
      });
      preamble = preamble.trimEnd() + `\n\n% --- Safe authblk Overrides ---\n\\AtBeginDocument{\n${safeOverrides.join('\n')}\n}\n`;
    }

  // 10. Fix illegal \\\\ immediately before \hline (causes "There's no line here" errors)
  cleanBody = cleanBody.replace(/\\\\(\s*\\hline)/g, '$1');
  // Fix double \hline
  cleanBody = cleanBody.replace(/(\\hline\s*){2,}/g, '\\hline\n');

  sanitized = preamble + cleanBody;
  }

  return sanitized;
}



function sanitizeMetadata(str: string): string {
  if (!str) return "";
  return str.replace(/\\(maketitle|nonstopmode|sloppy|geometry|hypersetup)(?![a-zA-Z])/g, "");
}

function repairAcmAffiliation(str: string): string {
  if (!str) return "";
  const r = str;
  // Only repair if it's an affiliation block and is missing mandatory acmart fields
  if (r.includes("\\affiliation")) {
    if (!r.includes("\\city") && !r.includes("\\institution")) {
       // Only add if literally nothing exists
       return r.replace(/(\\affiliation\s*\{)([^}]*)\}/g, "$1$2\n  \\institution{Affiliation}\n  \\city{City}\n  \\country{Country}\n}");
    }
    return r;
  }
  return r;
}

export function extractEnvironment(latex: string, envName: string): { body: string, extracted: string[] } {
  let currentBody = latex;
  const extracted: string[] = [];
  const startRegex = new RegExp(`\\\\begin\\s*\\{\\s*${envName}\\s*\\}`, 'g');
  let match;
  while ((match = startRegex.exec(currentBody)) !== null) {
    const startIdx = match.index;
    const endRegex = new RegExp(`\\\\end\\s*\\{\\s*${envName}\\s*\\}`);
    const endMatch = currentBody.substring(startIdx).match(endRegex);
    if (endMatch) {
      const endIdxTotal = startIdx + endMatch.index! + endMatch[0].length;
      const fullEnv = currentBody.substring(startIdx, endIdxTotal);
      extracted.push(fullEnv);
      currentBody = currentBody.substring(0, startIdx) + currentBody.substring(endIdxTotal);
      startRegex.lastIndex = 0;
    } else {
      break;
    }
  }
  return { body: currentBody, extracted };
}

function normalizeAcmStructure(pre: string, body: string): { preamble: string, body: string } {
  let patchedPre = pre;
  let patchedBody = body;

  // 1. Repair affiliations in preamble
  patchedPre = patchedPre.replace(/\\author\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_m, c) => `\\author{${repairAcmAffiliation(c)}}`);
  patchedPre = patchedPre.replace(/\\affiliation\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_m, c) => `\\affiliation{${repairAcmAffiliation(c)}}`);

  // 2. Extract abstract and keywords from body
  const absRes = extractEnvironment(patchedBody, "abstract");
  patchedBody = absRes.body;
  const abs = absRes.extracted[0] || "";

  const kwRes = extractAndRemoveCommand(patchedBody, "keywords");
  patchedBody = kwRes.body;
  const kws = kwRes.extracted?.[0] || "";

  // 3. Remove all maketitle from body to re-position
  patchedBody = patchedBody.replace(/\\maketitle(?![a-zA-Z])/g, "");

  // 4. Re-assemble body: Abstract -> Keywords -> Maketitle -> Rest
  const finalBody = `${abs}\n${kws}\n\\maketitle\n${patchedBody}`;

  return { preamble: patchedPre, body: finalBody };
}

// Regexes moved inside autoHealLatex to prevent lastIndex leakage

export function safeReplace(text: any, pattern: RegExp | string, replacement: any): string {
  if (typeof text !== 'string') return String(text || "");
  return text.replace(pattern, replacement);
}

export function escapeLatexSpecialChars(text: string): string {
  if (!text) return "";
  // Shield math environments, LaTeX commands, and specific scholarly macros
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$.*?\$|\\begin\{[^}]*\}[\s\S]*?\\end\{[^}]*\}|\\[a-zA-Z]+\*?(?:\s*\[[^\]]*\])?(?:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*)/g);
  return parts.map((part, index) => {
    if (index % 2 === 0) {
      // Only escape in non-shielded parts
      return part
        .replace(/(?<!\\)&/g, '\\&')
        .replace(/(?<!\\)_/g, '\\_')
        .replace(/(?<!\\)#/g, '\\#')
        .replace(/(?<!\\)(?<=\d\s*)%/g, '\\%');
    }
    return part;
  }).join("");
}

export function findBalancedBraces(text: string, startIndex: number): number {
  let depth = 0;
  let foundStart = false;
  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === '{') { depth++; foundStart = true; }
    else if (text[i] === '}') { depth--; if (foundStart && depth === 0) return i; }
  }
  return -1;
}

export function extractAndRemoveCommand(content: string, commandName: string): { body: string, extracted: string[] } {
  let currentBody = content;
  const extracted: string[] = [];
  const cmdPattern = new RegExp(`(?<!%)\\\\${commandName}\\*?\\s*(?:\\s*\\[[^\\]]*\\])?\\s*\\{`, 'g');
  let match;
  while ((match = cmdPattern.exec(currentBody)) !== null) {
    const startIdx = match.index;
    const openBraceIdx = currentBody.indexOf('{', startIdx);
    if (openBraceIdx === -1) break;
    const closeBraceIdx = findBalancedBraces(currentBody, openBraceIdx);
    if (closeBraceIdx !== -1) {
      let lastEnd = closeBraceIdx + 1;
      while (lastEnd < currentBody.length) {
        const remaining = currentBody.slice(lastEnd).trimStart();
        const trimLen = currentBody.slice(lastEnd).length - remaining.length;
        if (remaining.startsWith('{')) {
          const nextStart = lastEnd + trimLen;
          const nextEnd = findBalancedBraces(currentBody, nextStart);
          if (nextEnd === -1) break;
          lastEnd = nextEnd + 1;
        } else if (remaining.startsWith('[')) {
          const nextStart = lastEnd + trimLen;
          const nextEnd = currentBody.indexOf(']', nextStart);
          if (nextEnd === -1) break;
          lastEnd = nextEnd + 1;
        } else { break; }
      }
      extracted.push(currentBody.substring(startIdx, lastEnd));
      currentBody = currentBody.substring(0, startIdx) + currentBody.substring(lastEnd);
      cmdPattern.lastIndex = 0;
    } else { cmdPattern.lastIndex = startIdx + 1; }
  }
  return { body: currentBody, extracted };
}

function normalizeImageInner(optsStr: string | undefined): string {
  let optStr = optsStr ? optsStr.trim().slice(1, -1) : "";
  optStr = optStr.replace(/width\s*=\s*\\(text|column)width/g, "width=\\linewidth");
  
  if (!optStr.includes("max width")) optStr = optStr ? `${optStr},max width=\\linewidth` : "max width=\\linewidth";
  if (!optStr.includes("max height")) optStr += (optStr ? "," : "") + "max height=0.9\\textheight";
  
  if (!optStr.includes("keepaspectratio")) {
    if (optStr.length > 0) optStr += ",keepaspectratio";
    else optStr = "keepaspectratio";
  }
  return optStr;
}

export function hasPackage(preamble: string, pkg: string): boolean {
  if (!preamble) return false;
  const regex = new RegExp(`\\\\(usepackage|RequirePackage)\\s*(?:\\[[^\\]]*\\])?\\s*\\{[^}]*\\b${pkg}\\b[^}]*\\}`, 'i');
  return regex.test(preamble);
}

export function autoHealLatex(latex: string): string {
  if (!latex) return "";

  // SHIELDING & HEALING REGEXES (Local scope to prevent lastIndex memory leakage)
  const RX_HEAL_1 = /\\(begin|end|section|subsection|subsubsection|textbf|textit|caption|label|ref|cite|title|author|date|usepackage|documentclass|includegraphics|zimg|url|href|item|keywords|abstract|caption|centering|appendix|chapter|footnote)(\s*\[[^\]]*\])?\s*\\\{/g;
  const RX_HEAL_2 = /\\(begin|end|section|subsection|subsubsection|textbf|textit|caption|label|ref|cite|title|author|date|usepackage|documentclass|includegraphics|zimg|url|href|item|keywords|abstract|caption|centering|appendix|chapter|footnote)\s+([\[\{])/g;
  const RX_HEAL_TABULAR = /\\begin\{tabular\}\s*\\\{/g;
  const RX_HEAL_MATH = /(\$|\\\[)\s*\\begin\{(equation|align|gather|math|displaymath|multline|eqnarray)\*?\}([\s\S]*?)\\end\{\2\*?\}\s*(\$|\\\])/g;
  const RX_HEAL_BLOCK = /\\(begin|end|section|subsection|subsubsection|textbf|textit|caption|label|ref|cite|title|author|date|usepackage|documentclass|includegraphics|zimg|url|href|item|keywords|abstract|caption|centering|appendix|chapter|footnote)(\s*\[[^\]]*\])?\s*\{([^{}]*?)\\\}/g;
  const RX_HEAL_CLOSE = /(?<!\d)\\\}(?=\s*($|\\|\n))/g;
  const RX_HEAL_SAFE_BRACE = /\\(begin|end|section|subsection|subsubsection|textbf|textit|caption|label|ref|cite|title|author|date|usepackage|documentclass|includegraphics|zimg)(\s*\[[^\]]*\])?\{([^{}]*?)\\\}/g;

  let raw = latex;

  // 0. UNIVERSAL UNICODE MAPPING
  for (const [char, tex] of Object.entries(GREEK_MAP)) { raw = raw.split(char).join(tex); }

  // 0a. SMART SCAN & ESCAPE (Only Body, Preserve Preamble)
  const docStartIdx = raw.indexOf('\\begin{document}');
  if (docStartIdx !== -1) {
    const preamble = raw.substring(0, docStartIdx);
    let body = raw.substring(docStartIdx);
    
    // Shield commands in preamble too, but less aggressively
    body = escapeLatexSpecialChars(body);
    raw = preamble + body;
  } else {
    raw = escapeLatexSpecialChars(raw);
  }

  // 1. FORBIDDEN ELEMENTS (Aggressively stripped for pdflatex stability)
  raw = raw.replace(/\\usepackage\{unicode-math\}/g, "");
  raw = raw.replace(/\\usepackage\{fontspec\}/g, "");
  raw = raw.replace(/\\usepackage\{polyglossia\}/g, "");
  raw = raw.replace(/\\usepackage\{luacode\*?\}/g, "");
  raw = raw.replace(/\\setmainfont\{.*?\}/g, "");
  raw = raw.replace(/\\setmathfont\{.*?\}/g, "");
  raw = raw.replace(/\\setmonofont\{.*?\}/g, "");
  raw = raw.replace(/\\defaultfontfeatures\{.*?\}/g, "");
  raw = raw.replace(/\\addtokomafont\{.*?\}/g, "");
  raw = raw.replace(/\\setkomafont\{.*?\}/g, "");
  
  // SANITIZE UNICODE (pdflatex hates zero-width spaces and others)
  raw = raw.replace(/[\u200B\u200C\u200D\uFEFF]/g, "").replace(/[\u202F\u00A0]/g, " ");

  // 2. DETECT COMPLETE DOCUMENT STRUCTURE
  const hasDocumentEnv = raw.includes('\\begin{document}') && raw.includes('\\end{document}');
  let preamble = "";
  let body = raw;
  let footer = "";

  if (hasDocumentEnv) {
    const startIdx = raw.indexOf('\\begin{document}');
    const endIdx = raw.lastIndexOf('\\end{document}');
    preamble = raw.substring(0, startIdx);
    body = raw.substring(startIdx + 16, endIdx);
    footer = raw.substring(endIdx);
  }

  // SHIELD: Extract already-escaped characters to prevent corruption by healing regexes
  const escapeShield: string[] = [];
  const escapeRX = /\\([&%$#_{}])/g;
  const shielded = body.replace(escapeRX, (match) => {
    const idx = escapeShield.length;
    escapeShield.push(match); // e.g. "\&"
    return `__ESCAPED_CHAR_${idx}__`;
  });

  // SHIELD: Extract frontmatter blocks before healing (elsarticle)
  const frontmatterBlocks: string[] = [];
  let healed = shielded.replace(/(\\begin\{frontmatter\}[\s\S]*?\\end\{frontmatter\})/g, (match) => {
    const idx = frontmatterBlocks.length;
    frontmatterBlocks.push(match);
    return `__FRONTMATTER_BLOCK_${idx}__`;
  });

  // SHIELD: Extract all math and documentation environments before applying Greek replacements
  const mathShield: string[] = [];
  // NUCLEAR VERB SHIELD: Strictly match on single line, handle variety of delimiters
  const mathShieldRX = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$]+?\$|\\begin\{(?:equation|align|gather|math|displaymath|multline|eqnarray|verbatim|lstlisting|alltt|quote|quotation|table|figure|tabular|tabularx|adjustbox|algorithm|algorithmic|frontmatter)\*?\}[\s\S]*?\\end\{(?:equation|align|gather|math|displaymath|multline|eqnarray|verbatim|lstlisting|alltt|quote|quotation|table|figure|tabular|tabularx|adjustbox|algorithm|algorithmic|frontmatter)\*?\}|\\verb(?:([^\w\s]).*?\2|(\w).*?\3))/g;
  healed = healed.replace(mathShieldRX, (match) => {
    const idx = mathShield.length;
    mathShield.push(match);
    return `__MATH_SHIELD_${idx}__`;
  });

  let prev;
  let loopCount = 0;
  do {
    prev = healed;
    healed = safeReplace(healed, RX_HEAL_1, "\\$1$2{");
    healed = safeReplace(healed, RX_HEAL_2, "\\$1$2");
    healed = safeReplace(healed, RX_HEAL_TABULAR, "\\begin{tabular}{");
    healed = safeReplace(healed, RX_HEAL_MATH, "\\begin{$2}$3\\end{$2}");
    healed = safeReplace(healed, RX_HEAL_BLOCK, "\\$1$2{$3}");
    healed = safeReplace(healed, RX_HEAL_CLOSE, "}");
    healed = safeReplace(healed, RX_HEAL_SAFE_BRACE, "\\$1$2{$3}");
    loopCount++;
  } while (healed !== prev && loopCount < 5);

  // Restore frontmatter blocks
  frontmatterBlocks.forEach((val, i) => {
    healed = healed.replace(`__FRONTMATTER_BLOCK_${i}__`, val);
  });

  // Restore escaped character shield
  escapeShield.forEach((val, i) => {
    healed = healed.replace(`__ESCAPED_CHAR_${i}__`, val);
  });

  healed = healed.replace(/\\begin\{center\}\s*\\begin\{adjustbox\}/g, "\\begin{adjustbox}").replace(/\\end\{adjustbox\}\s*\\end\{center\}/g, "\\end{adjustbox}");
  
  healed = healed.replace(/\\begin\{tabular\}\{([^}]*?)\\\}/g, "\\begin{tabular}{$1}").replace(/\\begin\{enumerate\}\\\[/g, "\\begin{enumerate}[").replace(/\\end\{enumerate\}\\\]/g, "\\end{enumerate}");

  const figRX = /(\\begin\{figure\*?\}[\s\S]*?\\end\{figure\*?\})/g;
  healed = healed.split(figRX).map(s => {
    if (!s) return "";
    if (/^\\begin\{figure\*?\}/.test(s)) {
      let f = s.replace(/\\begin\{center\}|\\end\{center\}/g, "").replace(/\\includegraphics\s*(\[[^\]]*\])?\s*\{([^}]*)\}/g, (_m, o, p) => {
        const cleanO = normalizeImageInner(o);
        return `\\includegraphics[${cleanO}]{${p || ""}}`;
      });
      if (!f.includes("\\centering")) f = f.replace(/(\\begin\{figure\*?\}(?:\[[^\]]*\])?)/, "$1\n\\centering");
      return f;
    }
    return s.replace(/(\\begin\{center\}|\\centering)?\s*(\\(?:includegraphics|zimg)\s*(\[[^\]]*\])?\s*\{([^}]*)\}(?:\{([^}]*)\})?(?:\{([^}]*)\})?(?:\{([^}]*)\})?)\s*(\\end\{center\})?/g, (_m, pre, _i, o, p, arg2, arg3, arg4, suf) => {
      if (s.includes("figure")) return _m; // Inside figure, let the figure healing handle it
      const cmd = _i.startsWith("\\zimg") ? "zimg" : "includegraphics";
      if (cmd === "zimg") {
          // zimg has four arguments: \zimg{file}{opts}{guid}{path}
          // We need to capture them and normalize the options
          const zMatch = _i.match(/\\zimg\{([^}]*)\}\{([^}]*)\}(?:\{([^}]*)\})?(?:\{([^}]*)\})?/);
          if (zMatch) {
              const file = zMatch[1];
              const opts = normalizeImageInner(`[${zMatch[2]}]`);
              const guid = zMatch[3] || "fig_auto";
              const path = zMatch[4] || file;
              return `${pre || "\\begin{center}"}\\zimg{${file}}{${opts}}{${guid}}{${path}}${suf || "\\end{center}"}`;
          }
      }
      return `${pre || "\\begin{center}"}\\includegraphics[${normalizeImageInner(o)}]{${p || ""}}${suf || "\\end{center}"}`;
    });
  }).join("");

  const mathPlaceholders: string[] = [];
  const mathRXZ = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$.*?\$|\\begin\{(?:equation|align|gather|math|displaymath|multline|eqnarray|algorithmic|algorithm|table|adjustbox|tabularx)\*?\}(?:\s*\[[^\]]*\])?[\s\S]*?\\end\{(?:equation|align|gather|math|displaymath|multline|eqnarray|algorithmic|algorithm|table|adjustbox|tabularx)\*?\})/g;
  healed = healed.replace(mathRXZ, (match) => {
    const placeholder = `__MATH_BLOCK_${mathPlaceholders.length}__`;
    mathPlaceholders.push(match);
    return placeholder;
  });

  const rawGreek = Object.values(GREEK_MAP).map(v => v.replace(/[\s\\]/g, '').trim()).filter(v => v.length > 1).join('|');
  const rxFloating = new RegExp(`(?<![\\\\\\{])\\\\(${rawGreek})(?![a-zA-Z])`, 'g');
  healed = healed.replace(rxFloating, (_m, s) => `$ \\${s.trim()} $ `);
  
  mathPlaceholders.forEach((val, i) => {
    healed = healed.replace(`__MATH_BLOCK_${i}__`, val);
  });
  healed = healed.replace(/\$\s+\$/g, " ").replace(/\$\$/g, "$").replace(/\$\s*\$/g, "").replace(/\$\$[ \t]*\$\$/g, "$");

  // 4. REASSEMBLE OR REBUILD
  if (hasDocumentEnv) {
    const isA = /\\documentclass\s*(?:\[[^\]]*\])?\s*\{acmart\}/.test(preamble);
    const isElsevier = /\\documentclass\s*(?:\[[^\]]*\])?\s*\{elsarticle\}/.test(preamble);
    // DEEP STRIPPING: Remove ONLY standalone legacy algorithm packages and conflicting guards
    let patchedPreamble = preamble
      .replace(/\\usepackage\s*(\[[^\]]*\])?\s*\{(?:[^}]*,)*algorithmic(?:,[^}]*)*\}/g, match => {
        if (match.includes("{algorithm,algorithmic}")) return "\\usepackage{algorithm}";
        if (match.includes("{algorithmic,algorithm}")) return "\\usepackage{algorithm}";
        return "";
      })
      .replace(/\\usepackage\s*(\[[^\]]*\])?\s*\{algorithmicx\}/g, "")
      .replace(/\\usepackage\s*(\[[^\]]*\])?\s*\{algcompatible\}/g, "")
      .replace(/\\usepackage\s*(\[[^\]]*\])?\s*\{algorithm2e\}/g, "")
      // NO STRIP: amsmath, amssymb, amsfonts are essential for academic manuscripts
      // and may not be included in the target class. We let them stay and
      // let the compiler handle potential duplications or better yet,
      // the user preamble merging handles its own deduplication.
      .replace(/\\Urlmuskip\s*=\s*[^%\n]*/g, "")
      .replace(/\\urlstyle\{[^}]*\}/g, "")
      .replace(/<[^>]+>/g, ""); // FINAL HTML STRIP: Remove any residual Word artifacts

    // NOTE: \nonstopmode must go AFTER \documentclass, never before
    patchedPreamble = patchedPreamble.replace(/\\nonstopmode\s*\n?/g, "");
    patchedPreamble = patchedPreamble.replace(
      /(\\documentclass\s*(?:\[[^\]]*\])?\s*\{[^}]*\})/,
      '$1\n\\nonstopmode'
    );
    
    // Prevent double loading of elsarticle
    if (isElsevier) {
      patchedPreamble = patchedPreamble.replace(/\\usepackage\s*\{elsarticle\}/g, "");
    }
    
    const isACM = /\\documentclass\s*(?:\[[^\]]*\])?\s*\{acmart\}/.test(patchedPreamble);
    const docClassMatch = patchedPreamble.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);
    const docClassName = docClassMatch ? docClassMatch[1].trim() : "article";
    const isAcademic = !["article", "report", "book", "letter"].includes(docClassName);
    if (isACM) patchedPreamble = patchedPreamble.replace(/\\documentclass(\[[^\]]*\])?\{acmart\}/, "\\documentclass[nonacm,sigconf]{acmart}");

    // PassOptionsToPackage must come AFTER \documentclass — inject them immediately after it
    if (!/\\PassOptionsToPackage\{unicode\}\{hyperref\}/.test(patchedPreamble)) {
      const guards = [
        "\\PassOptionsToPackage{unicode}{hyperref}",
        !isAcademic ? "\\PassOptionsToPackage{margin=1in}{geometry}" : "",
        "\\PassOptionsToPackage{final}{microtype}",
        "\\ifdefined\\hypersetup\\AtBeginDocument{\\hypersetup{colorlinks=true,allcolors=blue,bookmarksnumbered=true}}\\fi",
        ""
      ].filter(Boolean).join("\n");
      // Insert guards AFTER \documentclass line, not before it
      patchedPreamble = patchedPreamble.replace(
        /(\\documentclass\s*(?:\[[^\]]*\])?\s*\{[^}]*\}\s*(?:\n|$))/,
        `$1${guards}\n`
      );
    }

    // Strip duplicated or conflicting hyperref calls if it's acmart
    if (isACM) {
      patchedPreamble = patchedPreamble.replace(/\\usepackage\[.*?\]\{hyperref\}/g, "");
      patchedPreamble = patchedPreamble.replace(/\\usepackage\{hyperref\}/g, "");
      patchedPreamble = patchedPreamble.replace(/\\usepackage\{breakurl\}/g, "");
    }

    // ─── DEDUPLICATION: Strip from user preamble what we inject ─────────────────
    // We only strip packages we actually re-inject to avoid breaking other imports (like natbib, biblatex, svg, etc.)
    const SYSTEM_PKGS = ["microtype","placeins","enumitem","geometry","parskip","hyperref","url","float","caption","adjustbox","algorithm","amsmath","amsfonts","amssymb","graphicx","booktabs","cleveref","xurl","rotating","pdflscape","algpseudocode","textcomp","gensymb","bm","listings","pifont","appendix"];
    SYSTEM_PKGS.forEach(pkg => {
        const pkgRegex = new RegExp(`\\\\usepackage\\s*(?:\\[[^\\]]*\\])?\\s*\\{[^}]*\\b${pkg}\\b[^}]*\\}\\s*\n?`, 'g');
        patchedPreamble = patchedPreamble.replace(pkgRegex, '');
    });
    // Also strip standalone conflicting commands already injected
    patchedPreamble = patchedPreamble.replace(/\\allowdisplaybreaks\s*\n?/g, '');
    patchedPreamble = patchedPreamble.replace(/\\setlist\{nosep\}\s*\n?/g, '');
    patchedPreamble = patchedPreamble.replace(/\\raggedbottom\s*\n?/g, '');
    patchedPreamble = patchedPreamble.replace(/\\hypersetup\{[^}]*\}\s*\n?/g, '');
    patchedPreamble = patchedPreamble.replace(/\\AtBeginDocument\{[^}]*\}\s*\n?/g, '');
    patchedPreamble = patchedPreamble.replace(/\\graphicspath\s*\{[^{}]*\{[^{}]*\}[^{}]*\}\s*\n?/g, '');
    patchedPreamble = patchedPreamble.replace(/\\graphicspath\s*\{[^{}]*\}\s*\n?/g, '');

    // ─── USEPACKAGE GUARD LIST ──────────────────────────────────────────────────
    // CRITICAL: \usepackage MUST NOT appear inside a \catcode block.
    // All usepackage calls go here, to be injected AFTER \catcode`\@=12 is restored.
    const usepackageGuards: string[] = [];

    // amsmath first — everything math-related depends on it
    if (!hasPackage(patchedPreamble, "amsmath")) {
      usepackageGuards.push(isA ? "\\usepackage{amsmath,amsfonts}" : "\\usepackage{amsmath,amsfonts,amssymb,mathrsfs}");
      usepackageGuards.push("\\allowdisplaybreaks");
    } else if (!patchedPreamble.includes("allowdisplaybreaks")) {
      usepackageGuards.push("\\allowdisplaybreaks");
    }
    if (!hasPackage(patchedPreamble, "iftex")) usepackageGuards.push("\\usepackage{iftex}");
    if (!hasPackage(patchedPreamble, "fontenc")) usepackageGuards.push("\\usepackage[T1]{fontenc}");
    if (!hasPackage(patchedPreamble, "inputenc")) usepackageGuards.push("\\usepackage[utf8]{inputenc}");
    if (!hasPackage(patchedPreamble, "graphicx")) usepackageGuards.push("\\usepackage{graphicx}");
    if (!hasPackage(patchedPreamble, "xcolor")) {
      usepackageGuards.push("\\PassOptionsToPackage{table,x11names}{xcolor}");
      usepackageGuards.push("\\usepackage{xcolor}");
    }
    if (!hasPackage(patchedPreamble, "parskip")) usepackageGuards.push("\\usepackage{parskip}");
    if (!hasPackage(patchedPreamble, "booktabs")) usepackageGuards.push("\\usepackage{booktabs,multirow,array,tabularx}");
    if (!hasPackage(patchedPreamble, "float")) usepackageGuards.push("\\usepackage{float,caption}");
    if (!hasPackage(patchedPreamble, "adjustbox")) {
      usepackageGuards.push("\\PassOptionsToPackage{export}{adjustbox}");
      usepackageGuards.push("\\usepackage{adjustbox}");
    }
    if (!hasPackage(patchedPreamble, "placeins")) usepackageGuards.push("\\usepackage{placeins}");
    if (!hasPackage(patchedPreamble, "enumitem")) usepackageGuards.push("\\usepackage{enumitem}");
    if (!hasPackage(patchedPreamble, "rotating")) usepackageGuards.push("\\usepackage{rotating,pdflscape}");
    if (!hasPackage(patchedPreamble, "algorithm")) {
      usepackageGuards.push(
        "\\makeatletter",
        "\\let\\c@algorithm\\relax",
        "\\let\\algorithm\\relax",
        "\\let\\endalgorithm\\relax",
        "\\makeatother",
        "\\usepackage{algorithm,algpseudocode}",
        "\\providecommand{\\algorithmicrequire}{\\textbf{Require:}}",
        "\\providecommand{\\algorithmicensure}{\\textbf{Ensure:}}",
        "\\renewcommand{\\algorithmicrequire}{\\textbf{Input:}}",
        "\\renewcommand{\\algorithmicensure}{\\textbf{Output:}}"
      );
    }
    if (!hasPackage(patchedPreamble, "microtype")) usepackageGuards.push("\\usepackage{microtype}");
    if (!hasPackage(patchedPreamble, "url")) usepackageGuards.push("\\usepackage{url}");
    if (!hasPackage(patchedPreamble, "xurl")) usepackageGuards.push("\\usepackage{xurl}");
    if (!isAcademic && !hasPackage(patchedPreamble, "geometry")) usepackageGuards.push("\\usepackage[margin=1in]{geometry}");
    
    // Dynamically load authblk if affiliations are used in standard templates
    if (!isAcademic && !hasPackage(patchedPreamble, "authblk")) {
      const hasAuthblkCmds = patchedPreamble.includes("\\affil") || 
                             healed.includes("\\affil") || 
                             patchedPreamble.includes("\\author[") || 
                             healed.includes("\\author[");
      if (hasAuthblkCmds) {
        usepackageGuards.push("\\usepackage{authblk}");
      }
    }
    const hasHyperref = hasPackage(patchedPreamble, "hyperref") || /\\documentclass\s*(?:\[[^\]]*\])?\s*\{(?:acmart|sn-jnl)\}/.test(patchedPreamble);
    if (!hasHyperref) usepackageGuards.push("\\usepackage{hyperref}");
    
    // Auto-added general scholastic packages requested by the user
    if (!hasPackage(patchedPreamble, "textcomp")) usepackageGuards.push("\\usepackage{textcomp}");
    if (!hasPackage(patchedPreamble, "gensymb")) usepackageGuards.push("\\usepackage{gensymb}");
    if (!hasPackage(patchedPreamble, "bm")) usepackageGuards.push("\\usepackage{bm}");
    if (!hasPackage(patchedPreamble, "listings")) usepackageGuards.push("\\usepackage{listings}");
    if (!hasPackage(patchedPreamble, "pifont")) usepackageGuards.push("\\usepackage{pifont}");
    if (!hasPackage(patchedPreamble, "appendix")) usepackageGuards.push("\\usepackage{appendix}");
    if (!isAcademic && !hasPackage(patchedPreamble, "natbib") && !hasPackage(patchedPreamble, "biblatex")) {
      // Intentionally omitting cite package to prevent collapsing [1,2,3] into [1-3]
    }
    // cleveref MUST be loaded last
    if (!hasPackage(patchedPreamble, "cleveref")) usepackageGuards.push("\\usepackage{cleveref}");

    if (isACM) usepackageGuards.push("\\ifdefined\\hypersetup\\hypersetup{colorlinks=true,allcolors=blue}\\fi");
    if (!patchedPreamble.includes("graphicspath")) usepackageGuards.push("\\graphicspath{{./}}");
    if (!patchedPreamble.includes("DeclareUnicodeCharacter{200B}")) usepackageGuards.push("\\ifdefined\\DeclareUnicodeCharacter\\DeclareUnicodeCharacter{200B}{}\\fi");
    if (!patchedPreamble.includes("DeclareUnicodeCharacter{202F}")) usepackageGuards.push("\\ifdefined\\DeclareUnicodeCharacter\\DeclareUnicodeCharacter{202F}{ }\\fi");
    if (!patchedPreamble.includes("DeclareUnicodeCharacter{00A0}")) usepackageGuards.push("\\ifdefined\\DeclareUnicodeCharacter\\DeclareUnicodeCharacter{00A0}{ }\\fi");
    usepackageGuards.push("\\providecommand{\\keywords}[1]{\\par\\vspace{0.5em}\\noindent\\textbf{Keywords---} #1}");
    usepackageGuards.push("\\let\\Bbbk\\relax");

    // ─── INJECTION STRATEGY ─────────────────────────────────────────────────────
    // Phase 1 (catcode block): Only @-using internal macros — NO \usepackage.
    // Phase 2 (after catcode block): All \usepackage calls and other safe commands.
    if (usepackageGuards.length > 0 && !patchedPreamble.includes("\\DeclareUnicodeCharacter{207B}")) {
      // Phase 1: @-internal macros that need \catcode`\@=11
      const catcodeBlock = [
        "\\catcode`\\@=11",
        "\\ifdefined\\DeclareUnicodeCharacter",
        "  \\DeclareUnicodeCharacter{207B}{\\ensuremath{^{-}}}",
        "  \\DeclareUnicodeCharacter{025B}{\\ensuremath{\\epsilon}}",
        "  \\DeclareUnicodeCharacter{2126}{\\ensuremath{\\Omega}}",
        "  \\DeclareUnicodeCharacter{2013}{--}",
        "  \\DeclareUnicodeCharacter{2014}{---}",
        "  \\DeclareUnicodeCharacter{2212}{-}",
        "\\fi",
        "\\ifdefined\\DeclareUnicodeCharacter\\else\\long\\def\\DeclareUnicodeCharacter#1#2{}\\fi",
        "\\providecommand{\\botrule}{\\midrule}",
        "\\providecommand{\\toprule}{\\hline}",
        "\\providecommand{\\equalcont}[1]{}",
        "\\providecommand{\\bmhead}[1]{\\section*{#1}}",
        "\\providecommand{\\backmatter}{}",
        "\\providecommand{\\jnlcitation}[1]{}",
        "\\providecommand{\\authormark}[1]{}",
        "\\providecommand{\\address}[2]{}",
        "\\providecommand{\\corres}[1]{}",
        "\\providecommand{\\presentaddress}[1]{}",
        "\\providecommand{\\articletype}[1]{}",
        "\\@ifundefined{set@color}{\\providecommand{\\set@color}{}}{}",
        "\\@ifundefined{reset@color}{\\providecommand{\\reset@color}{}}{}",
        "\\providecommand{\\letterspace}[1]{#1}",
        "\\providecommand{\\naturalwidth}{0.9\\textwidth}",
        "\\providecommand{\\@abstract}{}",
        "\\providecommand{\\institute}[1]{\\thanks{#1}}",
        "\\providecommand{\\inst}[1]{$^{#1}$}",
        "\\catcode`\\@=12"

      ].join("\n");

      // Phase 2: Theorem styles, \usepackage calls, zimg — all OUTSIDE catcode block
      const postCatcodeBlock = [
        "\\ifdefined\\newtheoremstyle",
        "  \\ifdefined\\thmstyleone \\else \\newtheoremstyle{thmstyleone}{}{}{\\itshape}{}{\\bfseries}{.}{.5em}{} \\fi",
        "  \\ifdefined\\thmstyletwo \\else \\newtheoremstyle{thmstyletwo}{}{}{}{}{\\bfseries}{.}{.5em}{} \\fi",
        "  \\ifdefined\\thmstylethree \\else \\newtheoremstyle{thmstylethree}{}{}{}{}{\\itshape}{.}{.5em}{} \\fi",
        "\\fi",
        "\\ifdefined\\theorem \\else \\newtheorem{theorem}{Theorem} \\fi",
        "\\ifdefined\\proposition \\else \\newtheorem{proposition}{Proposition} \\fi",
        "\\ifdefined\\definition \\else \\newtheorem{definition}{Definition} \\fi",
        "\\ifdefined\\remark \\else \\newtheorem{remark}{Remark} \\fi",
        ...usepackageGuards,
        "\\ifdefined\\setlist\\setlist{nosep}\\fi",

        "% --- NUCLEAR TRACKER (zimg Support) ---",
        `\\ifdefined\\zimg\\else`,
        `  \\newcommand{\\zimg}[4]{%`,
        `    \\leavevmode`,
        `    \\IfFileExists{\\detokenize{#1}}{%`,
        `      \\csname includegraphics\\endcsname[#2,max height=0.85\\textheight]{\\detokenize{#1}}%`,
        `    }{%`,
        `      \\IfFileExists{\\detokenize{#1.png}}{%`,
        `        \\csname includegraphics\\endcsname[#2,max height=0.85\\textheight]{\\detokenize{#1.png}}%`,
        `      }{%`,
        `        \\IfFileExists{\\detokenize{#1.jpg}}{%`,
        `          \\csname includegraphics\\endcsname[#2,max height=0.85\\textheight]{\\detokenize{#1.jpg}}%`,
        `        }{%`,
        `          \\framebox(100,100){Missing Image: \\detokenize{#1}}%`,
        `        }%`,
        `      }%`,
        `    }%`,
        `  }`,
        `\\fi`,
      ].join("\n");

      patchedPreamble = patchedPreamble.replace(
        /(\\documentclass\s*(?:\[[^\]]*\])?\s*\{[^}]*\})/,
        `$1\n${catcodeBlock}\n${postCatcodeBlock}`
      );
    }

    // 6. LATE BODY GUARDS (Settings only) — only add if not already present
    const bodyGuardLines: string[] = [];
    if (!healed.includes("\\sloppy")) bodyGuardLines.push("\\sloppy");
    if (!healed.includes("\\raggedbottom")) bodyGuardLines.push("\\raggedbottom");
    if (!healed.includes("\\emergencystretch")) bodyGuardLines.push("\\emergencystretch=3em");
    if (!healed.includes("\\hbadness")) bodyGuardLines.push("\\hbadness=10000");
    if (!healed.includes("\\tolerance")) bodyGuardLines.push("\\tolerance=1000");
    if (!healed.includes("\\urlstyle")) bodyGuardLines.push("\\ifdefined\\urlstyle\\urlstyle{same}\\fi");
    if (!healed.includes("\\Urlmuskip")) bodyGuardLines.push("\\ifdefined\\Urlmuskip\\Urlmuskip=0mu plus 1mu\\fi");
    if (!healed.includes("setkeys{Gin}")) bodyGuardLines.push("\\ifdefined\\setkeys\\setkeys{Gin}{max width=\\linewidth,max height=0.75\\textheight,keepaspectratio}\\fi");
    const bodyGuards = bodyGuardLines.join("\n");

    let patchedPre = patchedPreamble;
    let patchedB = healed;

    // NUCLEAR 38.3: SURGICAL UNIVERSAL SCALING (Rotation & Context Aware)
    // Targets tabular structures exclusively to avoid "outer par mode" errors from float wrapping
    const tableEnvs = ["tabular", "tabular\\*", "tabularx", "tabulary"];
    const tablePattern = new RegExp(`\\\\begin\\{(${tableEnvs.join("|")})\\}(?:\\s*(?:\\[[^\\]]*\\]|\\{(?:[^{}]*|\\{[^{}]*\\})*\\}))*([\\s\\S]*?)\\\\end\\{\\1\\}`, "g");
    
    // We process in a way that respects landscape/rotation context
    patchedB = patchedB.replace(tablePattern, (match, _envName, _innerContent) => {
        // Skip if already shielded or special cases like longtable handled elsewhere
        if (match.includes("adjustbox") || match.includes("\\resizebox") || match.includes("max height")) {
            return match;
        }

        // Context Detection (Is this table inside a sideways/landscape environment?)
        // We look for nearest parent environment by checking previous content block (heuristic)
        const around = patchedB.substring(Math.max(0, patchedB.indexOf(match) - 500), patchedB.indexOf(match));
        const isRotated = around.includes("sidewaystable") || around.includes("landscape") || around.includes("sidewaysfigure");

        const widthConstraint = isRotated ? "0.9\\textheight" : "\\linewidth";
        const heightConstraint = isRotated ? "\\linewidth" : "0.75\\textheight";

        // Wrap only the tabular content to ensure captions (which are part of the float) stay outside
        return `\\begin{center}\\begin{adjustbox}{max width=${widthConstraint}, max height=${heightConstraint}, keepaspectratio}\n${match}\n\\end{adjustbox}\\end{center}`;
    });

    // Handle Algorithms and Minipages separately as they are block-level but have different constraints
    const blockEnvs = ["algorithm", "algorithmic", "minipage"];
    const blockPattern = new RegExp(`\\\\begin\\{(${blockEnvs.join("|")})\\}(?:\\s*(?:\\[[^\\]]*\\]|\\{(?:[^{}]*|\\{[^{}]*\\})*\\}))*[\\s\\S]*?\\\\end\\{\\1\\}`, "g");
    
    patchedB = patchedB.replace(blockPattern, (match, envName) => {
        if (match.includes("adjustbox") || match.includes("\\resizebox") || match.includes("max size")) return match;
        // Avoid wrapping algorithm if it's a float, but minipages are safe
        if (envName === "algorithm") return match; 
        return `\\begin{adjustbox}{max width=\\linewidth, max height=0.9\\textheight, keepaspectratio}\n${match}\n\\end{adjustbox}`;
    });

    if (isA) {
      const norm = normalizeAcmStructure(patchedPre, patchedB);
      patchedPre = norm.preamble;
      patchedB = norm.body;
    }

    const res = `${patchedPre}\n\\begin{document}\n${bodyGuards}\n${patchedB}\n${footer}`;
    
    // FINAL RESTORE of Documentation Shield (Lazy Restoration to prevent nest corruption)
    let finalRes = res;
    mathShield.forEach((val, i) => {
      finalRes = finalRes.replace(`__MATH_SHIELD_${i}__`, val);
    });
    
    finalRes = applyFinalSanitizationSieve(finalRes);

    return finalRes.replace(/[\u200B\u200C\u200D\uFEFF]/g, "").replace(/[\u202F\u00A0]/g, " ");
  } else {
    // TRADITIONAL REBUILD (for fragments)
    // ... (rest of the code follows same logic)
    const cmds = ["documentclass", "usepackage", "title", "author", "affil", "affiliation", "email", "date", "keywords", "abstract", "geometry", "hypersetup", "maketitle", "newcommand", "renewcommand", "DeclareMathOperator", "setmainfont", "setmathfont", "graphicspath", "acmConference", "acmBooktitle", "acmConference", "acmPrice", "acmISBN", "acmDOI", "setcopyright", "setkeys"];
    const ext: Record<string, string[]> = {};
    let clean = healed;
    cmds.forEach(c => { const r = extractAndRemoveCommand(clean, c); clean = r.body; ext[c] = (r.extracted || []).filter(b => !b.includes("[object Object]")); });
    
    clean = clean.replace(/\\begin\{luacode\*?\}[\s\S]*?\\end\{luacode\*?\}/g, "");
    clean = clean.replace(/\\(nonstopmode|let\\Bbbk\\relax|maketitle)(?![a-zA-Z])/g, "");
    
    const dcl = (ext["documentclass"]?.length > 0) ? ext["documentclass"][0] : "\\documentclass[11pt,a4paper]{article}";
    const isA = dcl.includes("acmart");
    
    // Explicitly handle abstract as an environment
    const envRes = extractEnvironment(clean, "abstract");
    clean = envRes.body;
    if (envRes.extracted.length > 0) {
      if (!ext["abstract"]) ext["abstract"] = [];
      ext["abstract"].push(...envRes.extracted);
    }

    // Sanitize metadata to prevent structural pollution
    ["title", "author", "abstract", "keywords"].forEach(k => {
      if (ext[k]) ext[k] = ext[k].map(s => sanitizeMetadata(s));
    });

    // Repair ACM Affiliations
    if (isA) {
      if (ext["affiliation"]) {
        ext["affiliation"] = ext["affiliation"].map(s => repairAcmAffiliation(s));
      }
    }

    let abs = (ext["abstract"]?.length > 0) ? ext["abstract"][0] : "";
    if (abs && !abs.includes("\\begin{abstract}")) abs = `\\begin{abstract}\n${abs}\n\\end{abstract}`;
    
    // Final aggressive purge of \maketitle and other blockers from document body
    clean = clean.replace(/\\(maketitle|nonstopmode|let\\Bbbk\\relax)(?![a-zA-Z])/g, "");

    const pkgs = new Map<string, string>();
    pkgs.set("iftex", "\\usepackage{iftex}");
    pkgs.set("graphicx", "\\usepackage{graphicx}");
    pkgs.set("adjustbox", "\\usepackage[export]{adjustbox}");
    // ACM Conflict Guard
    pkgs.set("amsmath", isA ? "\\usepackage{amsmath,amsfonts}" : "\\usepackage{amsmath,amssymb,amsfonts}");
    ["booktabs", "float", "caption", "hyperref", "url"].forEach(p =>
      pkgs.set(p, `\\usepackage{${p}}`)
    );
    
    if (isA || clean.includes("\\begin{algorithmic}") || clean.includes("\\begin{algorithm}")) { 
        pkgs.set("algorithm", "\\usepackage{algorithm}"); 
        pkgs.set("algpseudocode", "\\usepackage{algpseudocode}");
        pkgs.set("algorithmic", "\\usepackage{algorithmic}");
    }
    else if (clean.includes("\\SetAlgoVlined") || clean.includes("\\SetKwInput")) { pkgs.set("algorithm2e", "\\usepackage[ruled,vlined,linesnumbered]{algorithm2e}"); }

    if (clean.includes("\\begin{tabularx}")) pkgs.set("tabularx", "\\usepackage{tabularx}");
    if (clean.includes("\\setlist") || clean.includes("\\begin{description}")) pkgs.set("enumitem", "\\usepackage{enumitem}");


    const dclName = dcl.match(/\{([^}]*)\}/)?.[1] || "";

    (ext["usepackage"] || []).forEach(p => {
      const m = p.match(/\{([^}]*)\}/);
      if (m) m[1].split(",").forEach(n => {
        const nm = n.trim();
        // Prevent loading package if it matches documentclass name or is a known conflict for non-standard classes
        if (nm === dclName) return;
        if (!["fontspec", "unicode-math", "polyglossia", "luacode"].includes(nm)) pkgs.set(nm, `\\usepackage{${nm}}`);
      });
    });


    const preParts = [
      // documentclass MUST be first — PassOptionsToPackage comes immediately after
      isA ? "\\documentclass[nonacm,sigconf]{acmart}" : dcl,
      "\\PassOptionsToPackage{unicode}{hyperref}",
      "\\nonstopmode",
      "\\ifdefined\\abstract\\let\\abstract\\relax\\fi",
      "\\ifdefined\\endabstract\\let\\endabstract\\relax\\fi",
      "\\ifdefined\\DeclareUnicodeCharacter\\else\\long\\def\\DeclareUnicodeCharacter#1#2{}\\fi",
      "\\let\\Bbbk\\relax",
      "\\usepackage[utf8]{inputenc}",
      "\\DeclareUnicodeCharacter{200B}{}",
      "\\DeclareUnicodeCharacter{202F}{ }",
      "\\DeclareUnicodeCharacter{00A0}{ }",
      "\\DeclareUnicodeCharacter{2019}{'}",
      "\\DeclareUnicodeCharacter{201C}{``}",
      "\\DeclareUnicodeCharacter{201D}{''}",
      ...Array.from(pkgs.values()),
      "\\hypersetup{colorlinks=true,allcolors=blue,bookmarksnumbered=true}",
      "\\graphicspath{{./}}",
      "\\providecommand{\\keywords}[1]{\\par\\vspace{0.5em}\\noindent\\textbf{Keywords---} #1}",
      "\\providecommand{\\tightlist}{\\setlength{\\itemsep}{0pt}\\setlength{\\parskip}{0pt}}",
      ...(ext["newcommand"] || []),
      ...(ext["renewcommand"] || []),
      ...(ext["DeclareMathOperator"] || []),
      ...(ext["hypersetup"] || []),
      ...(ext["geometry"] || []),
      ...(isA ? ["\\setcopyright{none}", "\\acmDOI{}", "\\acmISBN{}", "\\acmConference[ArXiv]{Manuscript}{2026}{Source}"] : [])
    ];
    if (!dcl.includes("elsarticle")) ["title", "author", "affil", "affiliation", "email", "date", "keywords"].forEach(k => preParts.push(...(ext[k] || [])));

    const bodyGuards = [
      "\\sloppy",
      "\\emergencystretch=5em",
      "\\ifdefined\\urlstyle\\urlstyle{same}\\fi",
      "\\ifdefined\\Urlmuskip\\Urlmuskip=0mu plus 1mu\\fi",
      "\\ifdefined\\setkeys\\setkeys{Gin}{max width=\\linewidth,max height=0.85\\textheight,keepaspectratio}\\fi"
    ].join("\n");

    const finalPre = preParts.join("\n").trim();
    
    // Use centralized normalization logic for consistency
    let finalBody = "";
    const isSiam = dcl.includes("siamart");

    if (isA) {
      const norm = normalizeAcmStructure(finalPre, clean);
      finalBody = norm.body;
    } else if (isSiam) {
      // SIAM requires abstract/keywords BEFORE maketitle
      finalBody = `${abs}\n\\maketitle\n${clean}`;
    } else if (dcl.includes("elsarticle")) {
      finalBody = `${clean}`;
    } else {
      const mk = (finalPre.includes("\\title") && !clean.includes("\\maketitle")) ? "\\maketitle" : "";
      finalBody = `${mk}\n${abs}\n${clean}`;
    }


    const res = `${finalPre}\n\\begin{document}\n${bodyGuards}\n${finalBody}\n\\end{document}`;
    const finalRes = applyFinalSanitizationSieve(res);
    return finalRes.replace(/[\u200B\u200C\u200D\uFEFF]/g, "").replace(/[\u202F\u00A0]/g, " ");
  }
}

export interface ScholarlyAuthor {
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  affiliationIds: string[];
  isCorresponding?: boolean;
  orcid?: string;
}

export interface ScholarlyAffiliation {
  id: string;
  organization?: string;
  department?: string;
  street?: string;
  city?: string;
  postcode?: string;
  state?: string;
  country?: string;
}

export interface ScholarlyMetadata {
  title: string;
  runningTitle?: string;
  authors: ScholarlyAuthor[];
  runningAuthor?: string;
  affiliations: ScholarlyAffiliation[];
  abstract: string;
  keywords: string;
}

/**
 * High-Precision Metadata Extraction for Academic Manuscripts.
 */
export function extractProfessionalMetadata(latex: string): ScholarlyMetadata {
  const meta: ScholarlyMetadata = { title: "", authors: [], affiliations: [], abstract: "", keywords: "" };
  
  // Running heads (Springer/Elsevier)
  const rtMatch = latex.match(/\\titlerunning\s*\{([^}]*)\}/i);
  if (rtMatch) meta.runningTitle = rtMatch[1].trim();
  const raMatch = latex.match(/\\authorrunning\s*\{([^}]*)\}/i);
  if (raMatch) meta.runningAuthor = raMatch[1].trim();
  
  // 1. Title
  const titleMatch = latex.match(/\\title\s*(?:\[[^\]]*\])?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/i);
  if (titleMatch) meta.title = titleMatch[1].trim();

  // 2. Abstract
  const absEnvMatch = latex.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/i);
  if (absEnvMatch) {
    meta.abstract = absEnvMatch[1].trim();
  } else {
    const absCmdMatch = latex.match(/\\abstract\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/i);
    if (absCmdMatch) meta.abstract = absCmdMatch[1].trim();
  }

  // 3. Keywords
  const kwMatch = latex.match(/\\keywords\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/i) || 
                  latex.match(/\\begin\{IEEEkeywords\}([\s\S]*?)\\end\{IEEEkeywords\}/i) ||
                  latex.match(/\\begin\{keyword\}([\s\S]*?)\\end\{keyword\}/i);
  if (kwMatch) meta.keywords = kwMatch[1].trim();

  // 4. Authors & Affiliations (Deep Springer sn-jnl Logic)
  if (latex.includes("\\fnm") || latex.includes("\\sur") || latex.includes("\\affil") || latex.includes("\\affiliation")) {
    // SPRINGER LOGIC - Robust balanced brace scanner
    const authorRegex = /\\author\*?\s*(?:\[([^\]]*)\])?\s*\{/gi;
    let authMatch;
    while ((authMatch = authorRegex.exec(latex)) !== null) {
      const ids = Array.from(new Set(authMatch[1] ? authMatch[1].split(",").map(id => id.trim()) : [])) as string[];
      const startBrace = latex.indexOf('{', authMatch.index);
      const endBrace = findBalancedBraces(latex, startBrace);
      if (endBrace === -1) continue;
      
      const content = latex.substring(startBrace + 1, endBrace);
      // Check for following \email
      let email = "";
      const remaining = latex.substring(endBrace);
      const emailMatch = remaining.match(/^\s*\\email\s*\{([^}]*)\}/i);
      if (emailMatch) email = emailMatch[1];

      const fnm = content.match(/\\fnm\{([^}]*)\}/)?.[1] || "";
      const sur = content.match(/\\sur\{([^}]*)\}/)?.[1] || "";
      let name = `${fnm} ${sur}`.trim() || content.replace(/\\(fnm|sur)\{[^}]*\}/g, "").trim();

      // NUCLEAR METADATA ENHANCEMENT: Split implicit affiliations inside the author name if separated by \\
      if (name.includes('\\\\')) {
        const parts = name.split('\\\\').map(p => p.trim());
        name = parts[0];
        if (parts.length > 1) {
          const affId = `aff_auto_${meta.authors.length + 1}`;
          meta.affiliations.push({
            id: affId,
            organization: parts.slice(1).join(", ")
          });
          ids.push(affId);
        }
      }

      meta.authors.push({
        name,
        email,
        affiliationIds: ids,
        isCorresponding: authMatch[0].includes("*")
      });
    }

    // Support both \affil and \affiliation commands (inclusive of ACM, MDPI, etc.)
    const affilRegex = /\\affi(?:l|liation)\*?\s*(?:\[([^\]]*)\])?\s*\{/gi;
    let affMatch;
    while ((affMatch = affilRegex.exec(latex)) !== null) {
      const id = affMatch[1] || "";
      const startBrace = latex.indexOf('{', affMatch.index);
      const endBrace = findBalancedBraces(latex, startBrace);
      if (endBrace === -1) continue;
      
      const content = latex.substring(startBrace + 1, endBrace);
      
      let organization = content.match(/\\orgname\{([^}]*)\}/)?.[1] || content.match(/\\institution\{([^}]*)\}/)?.[1] || "";
      const department = content.match(/\\orgdiv\{([^}]*)\}/)?.[1] || content.match(/\\department\{([^}]*)\}/)?.[1] || "";
      const city = content.match(/\\city\{([^}]*)\}/)?.[1] || "";
      const state = content.match(/\\state\{([^}]*)\}/)?.[1] || "";
      const postcode = content.match(/\\postcode\{([^}]*)\}/)?.[1] || "";
      const country = content.match(/\\country\{([^}]*)\}/)?.[1] || "";
      const street = content.match(/\\street\{([^}]*)\}/)?.[1] || content.match(/\\orgaddress\{[\s\S]*?\\street\{([^}]*)\}/)?.[1] || "";

      // Fallback: If no structured tags were extracted, use the whole block as organization
      if (!organization && !department && !city && !country) {
        organization = content.replace(/[\n\r]+/g, " ").replace(/\s+/g, " ").trim();
      }

      meta.affiliations.push({
        id,
        organization,
        department,
        street,
        city,
        postcode,
        state,
        country
      });
    }
  } else if (latex.includes("\\IEEEauthorblock")) {
    // IEEE LOGIC
    const blockN = [...latex.matchAll(/\\IEEEauthorblockN\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gi)];
    const blockA = [...latex.matchAll(/\\IEEEauthorblockA\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gi)];
    blockN.forEach((m, i) => {
      const emailMatch = blockA[i]?.[1].match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      meta.authors.push({
        name: m[1].replace(/\\and/g, "").trim(),
        email: emailMatch?.[0] || "",
        affiliationIds: [String(i)]
      });
      if (blockA[i]) {
        meta.affiliations.push({
          id: String(i),
          organization: blockA[i][1].replace(/\\textit\{([^}]*)\}/g, "$1").trim()
        });
      }
    });
  } else {
    // STANDARD / ACM / ELSEVIER LOGIC (Simplified fallback)
    const authRegex = /\\author\s*(?:\[([^\]]*)\])?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gi;
    let m;
    while ((m = authRegex.exec(latex)) !== null) {
      meta.authors.push({
        name: m[2].trim(),
        affiliationIds: m[1] ? m[1].split(",") : []
      });
    }
    const emailRegex = /\\email\s*\{([^}]*)\}/gi;
    let em;
    while ((em = emailRegex.exec(latex)) !== null) {
      if (meta.authors.length > 0) meta.authors[meta.authors.length - 1].email = em[1];
    }
  }

  return meta;
}

/**
 * Template-Specific Metadata Injection.
 * Targets: article_acm, article_ieee, article_elsevier, article_mdpi, thesis, letter, blank.
 */
export function injectProfessionalMetadata(templateId: string, meta: ScholarlyMetadata): string {
  let output = "";

  if (templateId === "article_acm") {
    output += `\\title{${meta.title || "Untitled"}}\n\n`;
    meta.authors.forEach(a => {
      output += `\\author{${a.name}}\n`;
      if (a.email) output += `\\email{${a.email}}\n`;
      a.affiliationIds.forEach(fid => {
        const aff = meta.affiliations.find(f => f.id === fid);
        if (aff) {
          output += `\\affiliation{\n`;
          if (aff.organization) output += `  \\institution{${aff.organization}}\n`;
          if (aff.department) output += `  \\department{${aff.department}}\n`;
          if (aff.street) output += `  \\streetaddress{${aff.street}}\n`;
          if (aff.city) output += `  \\city{${aff.city}}\n`;
          if (aff.state) output += `  \\state{${aff.state}}\n`;
          if (aff.postcode) output += `  \\postcode{${aff.postcode}}\n`;
          if (aff.country) output += `  \\country{${aff.country}}\n`;
          output += `}\n`;
        }
      });
    });
    output += `\n\\begin{abstract}\n${meta.abstract || "Abstract text goes here."}\n\\end{abstract}\n\n`;
    if (meta.keywords) output += `\\keywords{${meta.keywords}}\n`;
  } else if (templateId === "article_ieee") {
    output += `\\title{${meta.title || "Untitled"}}\n\n`;
    output += `\\author{\n`;
    meta.authors.forEach((a, index) => {
      output += `  \\IEEEauthorblockN{${a.name}}\n`;
      output += `  \\IEEEauthorblockA{`;
      a.affiliationIds.forEach(fid => {
        const aff = meta.affiliations.find(f => f.id === fid);
        if (aff) {
          output += `\\textit{${aff.organization || ""}}${aff.department ? `\\\\ ${aff.department}` : ""} \\\\ ${aff.city || ""}, ${aff.country || ""} \\\\ ${a.email || ""}`;
        }
      });
      output += `}${index < meta.authors.length - 1 ? " \\and\n" : ""}\n`;
    });
    output += `}\n\n\\maketitle\n\n\\begin{abstract}\n${meta.abstract || "Abstract goes here."}\n\\end{abstract}\n\n`;
    if (meta.keywords) output += `\\begin{IEEEkeywords}\n${meta.keywords}\n\\end{IEEEkeywords}\n`;
  } else if (templateId === "article_elsevier") {
    output += `\\begin{frontmatter}\n\n\\title{${meta.title || "Untitled"}}\n\n`;
    meta.authors.forEach(a => {
      output += `\\author[${a.affiliationIds.join(",") || "inst1"}]{${a.name}}\n`;
    });
    meta.affiliations.forEach(aff => {
      output += `\\affiliation[${aff.id || "inst1"}]{organization={${aff.organization || ""}}, department={${aff.department || ""}}, city={${aff.city || ""}}, country={${aff.country || ""}}}\n`;
    });
    output += `\n\\begin{abstract}\n${meta.abstract || "Abstract goes here."}\n\\end{abstract}\n\n`;
    if (meta.keywords) {
      output += `\\begin{keyword}\n${meta.keywords}\n\\end{keyword}\n`;
    }
    output += `\n\\end{frontmatter}\n`;
  } else if (templateId === "article_springer_lncs") {
    output += `\\title{${meta.title || "Untitled"}}\n`;
    if (meta.runningTitle) output += `\\titlerunning{${meta.runningTitle}}\n`;
    output += `\\author{${meta.authors.map((a, i) => `${a.name}\\inst{${a.affiliationIds.join(',') || (i+1)}}`).join(' \\and ') || "Author Name"}}\n`;
    if (meta.runningAuthor) output += `\\authorrunning{${meta.runningAuthor}}\n`;
    
    output += `\\institute{`;
    meta.affiliations.forEach((aff, i) => {
      output += `${aff.organization || ""}, ${aff.city || ""}, ${aff.country || ""}${i < meta.affiliations.length - 1 ? " \\and\n" : ""}`;
    });
    output += `}\n`;
    
    output += `\\maketitle\n\n\\begin{abstract}\n${meta.abstract || "Abstract goes here."}\n\n\\keywords{${meta.keywords || ""}}\n\\end{abstract}\n`;
  } else if (templateId === "article_scirep") {
    output += `\\title{${meta.title || "Untitled"}}\n\n`;
    meta.authors.forEach((a, _i) => {
      const ids = a.affiliationIds.join(",") || "1";
      output += `\\author[${ids}${a.isCorresponding ? ',*' : ''}]{${a.name}}\n`;
    });
    meta.affiliations.forEach(aff => {
      output += `\\affil[${aff.id || "1"}]{${aff.organization || ""}, ${aff.city || ""}, ${aff.country || ""}}\n`;
    });
    const corresponding = meta.authors.find(a => a.isCorresponding);
    if (corresponding?.email) output += `\\affil[*]{${corresponding.email}}\n`;
    
    if (meta.keywords) output += `\\keywords{${meta.keywords}}\n\n`;
    output += `\\begin{abstract}\n${meta.abstract || "Abstract text goes here."}\n\\end{abstract}\n`;
  } else {
    // Standard Article (arXiv, Blank, etc.)
    output += `\\title{${meta.title || "Untitled"}}\n`;
    if (meta.affiliations && meta.affiliations.length > 0) {
      meta.authors.forEach(a => {
        const ids = a.affiliationIds.join(",") || "1";
        output += `\\author[${ids}]{${a.name}}\n`;
      });
      meta.affiliations.forEach(aff => {
        output += `\\affil[${aff.id || "1"}]{${aff.organization || ""}${aff.department ? `, ${aff.department}` : ""}${aff.city ? `, ${aff.city}` : ""}${aff.country ? `, ${aff.country}` : ""}}\n`;
      });
    } else {
      output += `\\author{${meta.authors.map(a => a.name).join(", ") || "Author Name"}}\n`;
    }
    output += `\\date{\\today}\n\n\\maketitle\n\n`;
    if (meta.abstract) output += `\\begin{abstract}\n${meta.abstract}\n\\end{abstract}\n\n`;
    if (meta.keywords) output += `\\providecommand{\\keywords}[1]{\\textbf{\\textit{Keywords:}} #1}\n\\keywords{${meta.keywords}}\n\n`;
  }

  return output;
}

/**
 * Universal Metadata Injector (Nuclear 35.0)
 * Auto-detects the target template's metadata style without hardcoded bias.
 */
export function injectUniversalMetadata(templateContent: string, templateId: string, meta: ScholarlyMetadata): string {
  // 1. HARDCODED ROUTING (For built-in templates with known special requirements)
  // Use regex to match \documentclass{...} to avoid false positives from comments/conditional code
  if (templateId.includes('acm') || /\\documentclass\s*(?:\[[^\]]*\])?\s*\{acmart\}/.test(templateContent)) return injectProfessionalMetadata('article_acm', meta);
  if (templateId.includes('ieee') || /\\documentclass\s*(?:\[[^\]]*\])?\s*\{IEEEtran\}/.test(templateContent)) return injectProfessionalMetadata('article_ieee', meta);
  if (templateId.includes('elsevier') || /\\documentclass\s*(?:\[[^\]]*\])?\s*\{elsarticle\}/.test(templateContent)) return injectProfessionalMetadata('article_elsevier', meta);
  if (templateId.includes('scirep') || /\\documentclass\s*(?:\[[^\]]*\])?\s*\{wlscirep\}/.test(templateContent)) return injectProfessionalMetadata('article_scirep', meta);
  if (/\\documentclass\s*(?:\[[^\]]*\])?\s*\{llncs\}/.test(templateContent)) return injectProfessionalMetadata('article_springer_lncs', meta);

  // 2. HEURISTIC DETECTION (For custom/unknown templates)
  
  // Elsevier style
  if (templateContent.includes('\\begin{frontmatter}')) return injectProfessionalMetadata('article_elsevier', meta);

  // Springer Style
  if (templateContent.includes('\\institute{')) return injectProfessionalMetadata('article_springer_lncs', meta);

  // Nature Style (\affil)
  if (templateContent.includes('\\affil[')) return injectProfessionalMetadata('article_scirep', meta);

  // MDPI Style (\abstract{...})
  if (templateContent.includes('\\abstract{')) {
    let output = `\\title{${meta.title || "Untitled"}}\n`;
    output += `\\author{${meta.authors.map(a => a.name).join(", ") || "Author"}}\n`;
    output += `\\abstract{${meta.abstract || "Abstract text"}}\n`;
    if (meta.keywords) output += `\\keyword{${meta.keywords}}\n`;
    output += `\\maketitle\n`;
    return output;
  }

  // Fallback to Standard
  return injectProfessionalMetadata('standard', meta);
}

/**
 * Lightweight sanitization for the LaTeX Studio.
 * Fixes Greek symbols and escapes special characters without 
 * aggressively restructuring the document (to preserve user intent).
 */
export function sanitizeLatexStudioCode(latex: string): string {
  if (!latex) return "";
  let raw = latex;
  
  // 1. Greek & Math Symbol Mapping
  for (const [char, tex] of Object.entries(GREEK_MAP)) {
    raw = raw.split(char).join(tex);
  }

  // 2. Character Escaping (Underscores, Ampersands, etc.)
  // We apply this but respect existing LaTeX commands
  raw = escapeLatexSpecialChars(raw);

  // 3. Invisible character cleanup
  raw = raw.replace(/[\u200B\u200C\u200D\uFEFF]/g, "").replace(/[\u202F\u00A0]/g, " ");

  // NUCLEAR 32.0: MATH HEALER (Protect leaky symbols)
  // Wrap common symbols that often escape math mode
  raw = raw
    .replace(/(\d+)\s*\^{\\circ}/g, "$1\\ensuremath{^{\\circ}}") // e.g. 30^{\circ}
    .replace(/(\d+)\s*\\circ/g, "$1\\ensuremath{^{\\circ}}")     // e.g. 30\circ
    .replace(/\\parallel\s*(?![^$]*\$)/g, "\\ensuremath{\\parallel} ") // \parallel outside $
    .replace(/\\theta\s*(?![^$]*\$)/g, "\\ensuremath{\\theta} ");     // \theta outside $

  return raw;
}
