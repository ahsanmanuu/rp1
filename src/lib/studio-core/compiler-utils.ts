// ─────────────────────────────────────────────────────────────────────────────
// COMPILER UTILITIES (Standardized Alignment)
// ─────────────────────────────────────────────────────────────────────────────

import { applyFinalSanitizationSieve } from '@/lib/latex';

export interface FilePayload { 
  path: string; 
  content: string; 
  metadata?: { isUserStyle?: boolean };
}

export const ALLOWED_EXTENSIONS = new Set([
  '.tex', '.bib', '.cls', '.sty', '.bst', '.cfg', '.clo', '.def', '.fd', '.ldf', '.tikz', '.txt',
  '.otf', '.ttf', '.woff', '.woff2', '.tfm', '.pfb', '.afm',
  '.lua', '.lbx', '.bbx', '.cbx',
  '.png', '.jpg', '.jpeg', '.pdf', '.eps', '.svg', '.webp', '.avif', '.gif', '.tif', '.tiff', '.bmp', '.heic', '.heif'
]);

export function isBinaryFile(filename: string): boolean {
  if (!filename) return false;
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return /^\.(png|jpg|jpeg|webp|avif|gif|tif|tiff|bmp|pdf|eps|heic|heif|otf|ttf|woff|woff2|tfm|pfb|afm)$/i.test(ext);
}

export function sanitizeFiles(files: FilePayload[]): FilePayload[] {
  return (files || []).filter(f => {
    if (!f.path) return false;
    const ext = f.path.substring(f.path.lastIndexOf('.')).toLowerCase();
    const isJunk = f.path.includes('__MACOSX') || f.path.includes('.DS_Store') || f.path.includes('.bak');
    return ALLOWED_EXTENSIONS.has(ext) && !isJunk;
  });
}

export function prepareStructuredPayload(files: FilePayload[], mainFile: string) {
  const structured = (files || []).map(f => ({
    ...f,
    path: (f.path || '').replace(/\\/g, '/').replace(/^\.\//, '')
  }));
  return { 
    files: structured, 
    mainFile: (mainFile || 'main.tex').replace(/\\/g, '/').replace(/^\.\//, '') 
  };
}

export function robustPreambleInjector(content: string): string {
  if (!content || !/\\documentclass\b/.test(content)) return content;
  let modified = content;
  
  // 1. NUCLEAR 30.0 GLOBAL HARMONIZATION (\zimg Support)
  if (!modified.includes('NuclearTrackerV30')) {
     const _B = "\u005c"; // Literal backslash
     const posCode = `
% --- NUCLEAR 30.0 CORE DEFINITIONS (NuclearTrackerV30) ---
${_B}ifdefined${_B}NuclearTrackerV30${_B}else
  ${_B}def${_B}NuclearTrackerV30{1}
  ${_B}usepackage{iftex} % MANDATORY Engine Guard
  ${_B}ifdefined${_B}pdfsavepos${_B}else${_B}let${_B}pdfsavepos${_B}savepos${_B}fi
  ${_B}ifdefined${_B}pdflastxpos${_B}else${_B}let${_B}pdflastxpos${_B}lastxpos${_B}fi
  ${_B}ifdefined${_B}pdflastypos${_B}else${_B}let${_B}pdflastypos${_B}lastypos${_B}fi
  ${_B}maxdeadcycles=2000
  ${_B}usepackage{graphicx}
  ${_B}graphicspath{{.}{./assets/}{./images/}{./figures/}{../}{../assets/}{../images/}{./figures/}}
  ${_B}newwrite${_B}ghostwriter
  ${_B}immediate${_B}openout${_B}ghostwriter=ghost.trc
  ${_B}ifdefined${_B}zimgRender${_B}else
    ${_B}newcommand{${_B}zimgRender}[3]{%
      ${_B}pdfsavepos
      ${_B}immediate${_B}write${_B}ghostwriter{@PI@L:${_B}detokenize{#3}:${_B}the${_B}pdflastxpos:${_B}the${_B}pdflastypos}%
      ${_B}csname includegraphics${_B}endcsname[#2]{#1}%
      ${_B}pdfsavepos
      ${_B}immediate${_B}write${_B}ghostwriter{@PI@R:${_B}detokenize{#3}:${_B}the${_B}pdflastxpos:${_B}thepage:EOF@PI}%
    }
  ${_B}fi
  ${_B}ifdefined${_B}zimg${_B}else
    ${_B}newcommand{${_B}zimg}[4]{%
      ${_B}leavevmode
      ${_B}IfFileExists{${_B}detokenize{#1}}{%
        ${_B}zimgRender{${_B}detokenize{#1}}{#2}{#3}%
      }{%
        ${_B}IfFileExists{${_B}detokenize{#1.png}}{%
          ${_B}zimgRender{${_B}detokenize{#1.png}}{#2}{#3}%
        }{%
          ${_B}IfFileExists{${_B}detokenize{#1.jpg}}{%
            ${_B}zimgRender{${_B}detokenize{#1.jpg}}{#2}{#3}%
          }{%
            ${_B}IfFileExists{../${_B}detokenize{#1}}{%
              ${_B}zimgRender{../${_B}detokenize{#1}}{#2}{#3}%
            }{%
              ${_B}IfFileExists{../${_B}detokenize{#1.png}}{%
                ${_B}zimgRender{../${_B}detokenize{#1.png}}{#2}{#3}%
              }{%
                ${_B}IfFileExists{../${_B}detokenize{#1.jpg}}{%
                  ${_B}zimgRender{../${_B}detokenize{#1.jpg}}{#2}{#3}%
                }{%
                  ${_B}IfFileExists{assets/${_B}detokenize{#1}}{%
                    ${_B}zimgRender{assets/${_B}detokenize{#1}}{#2}{#3}%
                  }{%
                    ${_B}write16{NUCLEAR WARNING: Image ${_B}detokenize{#1} not found, skipping safely.}%
                    ${_B}framebox(100,100){Image Missing: ${_B}detokenize{#1}}%
                  }%
                }%
              }%
            }%
          }%
        }%
      }%
    }
  ${_B}fi

  % --- TABLE & LINENO HARMONIZATION ---
  ${_B}makeatletter
  ${_B}AtBeginDocument{
    ${_B}ifdefined${_B}nolinenumbers
      ${_B}ifdefined${_B}tabular
        ${_B}let${_B}oldtabular${_B}tabular
        ${_B}let${_B}oldendtabular${_B}endtabular
        ${_B}renewenvironment{tabular}[2][]{%
          ${_B}nolinenumbers${_B}oldtabular[#1]{#2}%
        }{%
          ${_B}oldendtabular%
        }
      ${_B}fi
    ${_B}fi
    % --- UNIVERSAL BIBLIOGRAPHY HEADING FALLBACK ---
    ${_B}providecommand{${_B}refname}{References}%
    ${_B}ifdefined${_B}bibsection
      ${_B}ifx${_B}bibsection${_B}empty
        ${_B}renewcommand{${_B}bibsection}{${_B}section*{${_B}refname}}%
      ${_B}else
        ${_B}ifx${_B}bibsection${_B}@empty
          ${_B}renewcommand{${_B}bibsection}{${_B}section*{${_B}refname}}%
        ${_B}fi
      ${_B}fi
    ${_B}fi
  }
  ${_B}makeatother
${_B}fi
% --- END NUCLEAR DEFINITIONS ---
`;
     // OMEGA: Surgical injection AFTER \documentclass for maximum compatibility
     const dcRegex = /\\documentclass\s*(?:\[[\s\S]*?\])?\s*\{[\s\S]*?\}/;
     if (dcRegex.test(modified)) {
         modified = modified.replace(dcRegex, (match) => `${match}\n${posCode}`);
     } else {
         modified = posCode + "\n" + modified;
     }
  }

  // 2. PREAMBLE PACKAGE INJECTION — inject essential packages if not already present
  // These run BEFORE the sieve so the sieve can deduplicate them safely.
  const docClassMatch = modified.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);
  if (docClassMatch) {
    const hasPackage = (pkg: string) =>
      new RegExp(`\\\\usepackage\\s*(?:\\[[^\\]]*\\])?\\s*\\{[^}]*\\b${pkg}\\b[^}]*\\}`).test(modified);

    const docClass = docClassMatch[1].toLowerCase();
    const isAcademic = !['article','report','book','letter'].includes(docClass);

    // Find the insertion point: just before \begin{document}
    const beginDocMatch = modified.match(/\\begin\s*\{\s*document\s*\}/);
    if (beginDocMatch && beginDocMatch.index !== undefined) {
      const beginDocIdx = beginDocMatch.index;
      const preamblePkgs: string[] = [];
      // T1 fontenc: improves font encoding and enables correct hyphenation for modern Western languages
      if (!hasPackage('fontenc')) {
        preamblePkgs.push('\\ifPDFTeX\\usepackage[T1]{fontenc}\\fi');
      }
      // xurl: enables URL breaking at any character (must come after url if loaded)
      if (!hasPackage('xurl') && !hasPackage('url')) {
        preamblePkgs.push('\\usepackage{xurl}');
      } else if (!hasPackage('xurl') && hasPackage('url')) {
        preamblePkgs.push('\\usepackage{xurl}');
      }
      // microtype: character-level typesetting, reduces hbox overflow significantly
      if (!hasPackage('microtype')) {
        preamblePkgs.push('\\usepackage{microtype}');
      }
      // geometry: proper page margins (1in standard)
      if (!isAcademic && !hasPackage('geometry')) {
        preamblePkgs.push('\\usepackage[margin=1in]{geometry}');
      }
      // listings: ensure breaklines is available
      if (!hasPackage('listings')) {
        preamblePkgs.push('\\usepackage{listings}');
      }

      if (preamblePkgs.length > 0) {
        modified =
          modified.slice(0, beginDocIdx) +
          preamblePkgs.join('\n') + '\n' +
          modified.slice(beginDocIdx);
      }
    }
  }

  // 3. PHANTOM ARTIFACT SIEVE (runs BEFORE overflow guards so sieve can't strip them)
  modified = applyFinalSanitizationSieve(modified);

  // 4. OVERFLOW GUARD INJECTION — inject AFTER the sieve, so guards are never stripped.
  // Prevents text, URLs, code, and verbatim from overflowing beyond the page margin.
  // These are injected AFTER \begin{document} so they apply globally to the whole document.
  const beginDocMatch = modified.match(/\\begin\s*\{\s*document\s*\}/);
  if (beginDocMatch && !modified.includes('% StudioOverflowGuards')) {
    const overflowGuards = [
      '% StudioOverflowGuards — injected by Latexify compiler for proper line breaking',
      '\\emergencystretch=8em',            // Extra stretch budget for lines that can\'t fit
      '\\hbadness=10000',                  // Suppress overfull hbox log warnings
      '\\tolerance=2000',                  // Moderate tolerance — prevents ugly wide word gaps
      '\\hyphenpenalty=10',                // Encourage more hyphenation at line breaks
      '\\exhyphenpenalty=10',              // Encourage breaks after explicit hyphens too
      '\\binoppenalty=100',                // Encourage breaks in inline math at binary operators
      '\\relpenalty=100',                  // Encourage breaks in inline math at relation operators
      '\\makeatletter',
      // URL breaking (safe \@undefined guards so they don\'t error if package not loaded)
      '\\ifx\\urlstyle\\@undefined\\else\\urlstyle{same}\\fi',
      '\\ifx\\Urlmuskip\\@undefined\\else\\Urlmuskip=0mu plus 1mu\\fi',
      // Fallback: force url package to break URLs at any letter or digit if xurl is not active
      '\\ifx\\UrlBreaks\\@undefined\\else',
      '  \\g@addto@macro{\\UrlBreaks}{\\do\\/\\do\\-\\do\\.\\do\\a\\do\\b\\do\\c\\do\\d\\do\\e\\do\\f\\do\\g\\do\\h\\do\\i\\do\\j\\do\\k\\do\\l\\do\\m\\do\\n\\do\\o\\do\\p\\do\\q\\do\\r\\do\\s\\do\\t\\do\\u\\do\\v\\do\\w\\do\\x\\do\\y\\do\\z\\do\\A\\do\\B\\do\\C\\do\\D\\do\\E\\do\\F\\do\\G\\do\\H\\do\\I\\do\\J\\do\\K\\do\\L\\do\\M\\do\\N\\do\\O\\do\\P\\do\\Q\\do\\R\\do\\S\\do\\T\\do\\U\\do\\V\\do\\W\\do\\X\\do\\Y\\do\\Z\\do\\0\\do\\1\\do\\2\\do\\3\\do\\4\\do\\5\\do\\6\\do\\7\\do\\8\\do\\9}',
      '\\fi',
      // Image constraint: all images respect page width automatically
      '\\ifx\\setkeys\\@undefined\\else\\setkeys{Gin}{max width=\\linewidth,max height=0.85\\textheight,keepaspectratio}\\fi',
      // listings: enable line breaking for ALL lstlisting environments (if listings is loaded)
      '\\ifx\\lstset\\@undefined\\else',
      '  \\lstset{breaklines=true,breakatwhitespace=false,basicstyle=\\small\\ttfamily,',
      '    columns=flexible,keepspaces=true,breakindent=0pt}%',
      '\\fi',
      '\\makeatother',
    ].join('\n');

    modified = modified.replace(
      /\\begin\s*\{\s*document\s*\}/,
      `${beginDocMatch[0]}\n${overflowGuards}`
    );
  }

  return modified;
}


export function calculatePayloadSize(files: FilePayload[]): number {
  return (files || []).reduce((acc, f) => {
    if (f.content.startsWith('data:')) {
      // Estimate raw size from base64 (roughly 0.75x)
      return acc + (f.content.length - f.content.indexOf(',') - 1) * 0.75;
    }
    return acc + Buffer.byteLength(f.content, 'utf8');
  }, 0);
}

export function flattenProject(files: FilePayload[], mainPath: string): string {
  const fileMap = new Map((files || []).map(f => [f.path.toLowerCase().replace(/^\.\//, ''), f.content]));
  const visited = new Set<string>();
  function resolve(p: string, depth: number = 0): string {
    if (depth > 20) return ''; // Protection against deep recursion
    const norm = p.toLowerCase().replace(/^\.\//, '');
    if (visited.has(norm)) return ''; 
    visited.add(norm);
    const content = fileMap.get(norm) || '';
    const includeRegex = /\\(?:input|include|subfile|import|subimport)\s*(?:\{([^}]*)\}\s*\{([^}]*)\}|\{([^}]*)\})/gi;
    return content.replace(includeRegex, (match, dir, file, single) => {
      let target = (single || file || '').trim().toLowerCase().replace(/^\.\//, '');
      if (!target) return match;
      if (!target.endsWith('.tex') && !target.includes('.')) target += '.tex';
      const dirPath = norm.includes('/') ? norm.substring(0, norm.lastIndexOf('/') + 1) : '';
      const candidates = [target, dirPath + target, `chapters/${target}`, `sections/${target}`];
      const matchPath = candidates.find(c => fileMap.has(c));
      return matchPath ? resolve(matchPath, depth + 1) : match;
    });
  }
  return resolve(mainPath, 0);
}

export interface DiagnosticError {
  line: number;
  type: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  raw?: string;
}

export function parseLog(log: string): DiagnosticError[] {
  const errors: DiagnosticError[] = [];
  const lines = (log || '').split('\n');

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;

    // Pattern 1: Classic LaTeX error "! Error message"
    if (line.startsWith('!')) {
      let errorLineNum = 0;
      const errorMsg = line.substring(1).trim();
      
      // Lookahead up to 10 lines to find the line number (e.g., "l.42")
      for (let j = idx + 1; j < Math.min(idx + 10, lines.length); j++) {
        const nextLine = lines[j].trim();
        const lMatch = nextLine.match(/^l\.(\d+)/);
        if (lMatch) {
          errorLineNum = parseInt(lMatch[1]);
          break;
        }
      }

      errors.push({ 
        line: errorLineNum, 
        type: 'error', 
        message: errorMsg, 
        raw: line 
      });
      return;
    }

    // Pattern 2: Tectonic prefixed diagnostics
    // Tectonic always prefixes each diagnostic with "warning:" or "error:"
    const tectonicWarning = line.match(/^warning:\s+(.*)/i);
    const tectonicError   = line.match(/^error:\s+(.*)/i);

    if (tectonicWarning) {
      const rest  = tectonicWarning[1];
      const inner = rest.match(/^(.*?):(\d+):\s*(.*)/);
      errors.push({
        file:    inner ? inner[1].replace(/^\.\//,'') : undefined,
        line:    inner ? parseInt(inner[2]) : 0,
        type:    'warning',
        message: inner ? inner[3].trim() : rest.trim(),
        raw:     line,
      });
      return;
    }

    if (tectonicError) {
      const rest  = tectonicError[1];
      const inner = rest.match(/^(.*?):(\d+):\s*(.*)/);
      errors.push({
        file:    inner ? inner[1].replace(/^\.\//,'') : undefined,
        line:    inner ? parseInt(inner[2]) : 0,
        type:    'error',
        message: inner ? inner[3].trim() : rest.trim(),
        raw:     line,
      });
      return;
    }

    // Pattern 3: Legacy file:line:msg (non-tectonic upstream responses)
    if (line.match(/^(.*?):(\d+):\s*(.*)/)) {
      const match = line.match(/^(.*?):(\d+):\s*(.*)/);
      if (match) {
        errors.push({
          file:    match[1].replace(/^\.\//,''),
          line:    parseInt(match[2]),
          type:    'error',
          message: match[3].trim(),
          raw:     line,
        });
      }
      return;
    }

    // Pattern 4: LaTeX Warning: ... on input line 42
    if (line.includes('LaTeX Warning:') || (line.includes('Package') && line.includes('Warning:'))) {
      const lineMatch = line.match(/line\s+(\d+)/i);
      const fileMatch = rawLine.match(/\((.*?)\)/);
      errors.push({
        file:    fileMatch ? fileMatch[1].split('/').pop() : undefined,
        line:    lineMatch ? parseInt(lineMatch[1]) : 0,
        type:    'warning',
        message: line.split(':').pop()?.trim() || line,
        raw:     line,
      });
    }

    // Pattern 5: Phantom Artifact Detection
    if (line.includes('color color') || line.includes('Scale=MatchLowercase') || line.includes('bstract')) {
      errors.push({
        line: 0,
        type: 'warning',
        message: `Detected phantom artifact in output: ${line.substring(0, 50)}...`,
        raw: line
      });
    }
  });

  return errors;
}

export function detectBestEngine(content: any): 'pdflatex' | 'xelatex' | 'lualatex' {
  const c = typeof content === 'string' ? content : (Object.values(content || {})[0] as string || '');
  if (!c) return 'pdflatex';

  // LUATEX Indicators (Strong specificity)
  if (c.includes('\\usepackage{luacode}') || c.includes('\\directlua') || c.includes('luacode*')) {
    return 'lualatex';
  }

  // XELATEX Indicators
  if (c.includes('\\usepackage{fontspec}') || c.includes('\\usepackage{unicode-math}')) {
    // If it has fontspec but also luacode indicators (handled above), it prefers lualatex
    // Otherwise, xelatex is the standard for fontspec
    return 'xelatex';
  }

  if (c.includes('\\usepackage{polyglossia}')) return 'xelatex';

  // PDFLATEX Indicators (Modern packages that only work or are optimized for pdflatex)
  if (c.includes('\\usepackage[T1]{fontenc}') && !c.includes('\\usepackage{fontspec}')) {
    return 'pdflatex';
  }

  // Default to pdflatex for general compatibility
  return 'pdflatex';
}

export function getProjectStatusInfo(status?: string) {
  switch (status) {
    case 'processing': return { color: '#f59e0b', label: 'Processing' };
    case 'ready':      return { color: '#10b981', label: 'Ready' };
    case 'failed':     return { color: '#ef4444', label: 'Failed' };
    default:           return { color: '#6366f1', label: 'Idle' };
  }
}
