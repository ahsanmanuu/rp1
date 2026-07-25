import JSZip from 'jszip';
import { 
  extractProfessionalMetadata, 
  injectUniversalMetadata, 
  applyFinalSanitizationSieve,
  extractAndRemoveCommand
} from './latex';

export interface MigratedProject {
  files: { 
    path: string; 
    content: string | Uint8Array; 
    isBinary: boolean;
    metadata?: { isUserStyle?: boolean }
  }[];
  mainFile: string;
}

export interface TemplateAsset {
  path: string;
  content: string;
}

export interface TemplateData {
  content: string;
  assets?: TemplateAsset[];
  // Legacy fields
  clsContent?: string;
  bstContent?: string;
  bibContent?: string;
}

/**
 * Intelligent LaTeX Migration Engine (Nuclear 30.0)
 * Partitioned Workspace Fusion: Target at Root | Source in Reference Folder.
 */
export async function migrateToTemplate(
  zipBuffer: ArrayBuffer, 
  templateData: TemplateData,
  templateId: string
): Promise<MigratedProject> {
  const auditLog: string[] = ["LaTeX Migration Audit Report", "============================", ""];
  const zip = await JSZip.loadAsync(zipBuffer);
  
  // 1. Full Project Intake
  const fileMap: Record<string, string> = {};
  const binaryFiles: { path: string; content: Uint8Array }[] = [];
  const rawPaths: string[] = [];
  
  for (const path of Object.keys(zip.files)) {
    const entry = zip.files[path];
    if (entry.dir) continue;
    
    rawPaths.push(path);
    if (path.includes('__MACOSX') || path.includes('.DS_Store') || /\.(aux|log|out|toc)$/i.test(path)) continue;

    if (/\.(png|jpg|jpeg|gif|pdf|eps)$/i.test(path)) {
      binaryFiles.push({ path, content: await entry.async('uint8array') });
    } else {
      fileMap[path] = await entry.async('string');
    }
  }

  const bibFiles = Object.keys(fileMap).filter(p => p.toLowerCase().endsWith('.bib'));

  // Find Main File in ZIP with robust multi-layered heuristics
  let mainFilePath = Object.keys(fileMap).find(p => /\\begin\s*\{\s*document\s*\}/.test(fileMap[p])) || '';

  if (!mainFilePath) {
    mainFilePath = Object.keys(fileMap).find(p => p.toLowerCase().endsWith('main.tex')) || '';
  }

  if (!mainFilePath) {
    mainFilePath = Object.keys(fileMap).find(p => /\\documentclass/.test(fileMap[p])) || '';
  }

  if (!mainFilePath) {
    const texFiles = Object.keys(fileMap).filter(p => p.toLowerCase().endsWith('.tex'));
    if (texFiles.length > 0) {
      texFiles.sort((a, b) => fileMap[b].length - fileMap[a].length);
      mainFilePath = texFiles[0];
    }
  }

  // If absolutely no main file could be resolved (e.g. no .tex files in ZIP),
  // construct a default one so that text files are still processed and we don't return only binary files.
  if (!mainFilePath) {
    mainFilePath = 'main.tex';
    fileMap['main.tex'] = '\\documentclass{article}\n\\begin{document}\n\\section{Introduction}\n\n\\end{document}';
  }

  // 2. Greedy Preamble & Body Extraction (Capture BEFORE scrubbing)
  const userMainTex = fileMap[mainFilePath];
  
  const beginMatch = userMainTex.match(/\\begin\s*\{\s*document\s*\}/);
  const docStart = beginMatch ? beginMatch.index! : -1;
  const beginLength = beginMatch ? beginMatch[0].length : 16;

  const endMatch = userMainTex.match(/\\end\s*\{\s*document\s*\}/);
  const docEnd = endMatch ? endMatch.index! : -1;
  
  let userPreamble = docStart !== -1 ? userMainTex.substring(0, docStart) : '';
  const scholarlyMeta = extractProfessionalMetadata(userMainTex);

  // GLOBAL SCRUBBING: Neutralize all structural headers in ALL project files (Nuclear 3.0)
  Object.keys(fileMap).forEach(path => {
    if (path.endsWith('.tex')) {
      fileMap[path] = fileMap[path]
        .replace(/\\documentclass[\s\S]*?\{[^}]*\}/gi, '% [Scrubbed documentclass]')
        .replace(/\\begin\s*\{\s*document\s*\}/gi, '% [Scrubbed begin{document}]')
        .replace(/\\end\s*\{\s*document\s*\}/gi, '% [Scrubbed end{document}]');
    }
  });

  const scrubList = [
    'title', 'author', 'email', 'affil', 'affiliation', 'abstract', 'keywords', 
    'received', 'accepted', 'revised', 'jvol', 'jnum', 'jyear', 'jpart', 'jcp', 'jname', 
    'pacs', 'MSC', 'KWD', 'DOI', 'acmConference', 'acmBooktitle', 'acmPrice', 'acmISBN', 
    'acmDOI', 'setcopyright', 'journal', 'address', 'cortext', 'fntext'
  ];

  // Body-level structural commands that must be scrubbed to prevent duplicate titles/metadata
  const bodyScrubList = [
    'maketitle', 'thanks', 'date', 'curraddr', 'subjclass', 'dedicatory',
    'address', 'cortext', 'fntext'
  ];
  
  // Clean Preamble
  let pResBody = userPreamble;
  for (const cmd of scrubList) {
    if (cmd === 'usepackage' || cmd === 'documentclass') continue;
    const res = extractAndRemoveCommand(pResBody, cmd);
    pResBody = res.body;
    if (res.extracted.length > 0) {
      auditLog.push(`- Scrubbed from Preamble: \\${cmd} (${res.extracted.length} instances)`);
    }
  }
  // Add Universal Fallbacks for common legacy macros across all major publisher classes (VGTC, ACM, IEEE, Elsevier, Springer, RevTeX, JFM)
  const universalFallbacks = `
% --- UNIVERSAL FALLBACKS ---
\\catcode\`\\@=11
\\providecommand{\\authororcid}[2]{#1}
\\providecommand{\\subref}[1]{\\ref{#1}}
\\providecommand{\\theoremstyle}[1]{}
\\providecommand{\\subjclass}[2][]{}
\\providecommand{\\curraddr}[1]{}
\\providecommand{\\dedicatory}[1]{}

% VGTC (IEEE VIS / TVCG / VR / ISMAR) Fallbacks
\\providecommand{\\onlineid}[1]{}
\\providecommand{\\vgtccategory}[1]{}
\\providecommand{\\authorfooter}[1]{}
\\providecommand{\\teaser}[1]{#1}
\\providecommand{\\firstsection}[1]{\\section{#1}}
\\providecommand{\\subfigsCaption}[1]{\\caption{#1}}
\\providecommand{\\iflabelexists}[2]{#2}
\\providecommand{\\preprinttext}[1]{}
\\providecommand{\\ieeedoi}[1]{}
\\providecommand{\\manuscriptnotetxt}[1]{}
\\providecommand{\\nocopyrightspace}{}

% ACMart Fallbacks
\\providecommand{\\acmConference}[4]{}
\\providecommand{\\acmBooktitle}[1]{}
\\providecommand{\\acmPrice}[1]{}
\\providecommand{\\acmISBN}[1]{}
\\providecommand{\\acmDOI}[1]{}
\\providecommand{\\setcopyright}[1]{}
\\providecommand{\\acmJournal}[1]{}
\\providecommand{\\acmVolume}[1]{}
\\providecommand{\\acmNumber}[1]{}
\\providecommand{\\acmArticle}[1]{}
\\providecommand{\\acmYear}[1]{}
\\providecommand{\\acmMonth}[1]{}
\\providecommand{\\authorsaddresses}[1]{}

% Elsevier Fallbacks
\\providecommand{\\corref}[1]{}
\\providecommand{\\cortext}[2][]{}
\\providecommand{\\fnref}[1]{}
\\providecommand{\\fntext}[2][]{}
\\providecommand{\\ead}[2][]{}
\\providecommand{\\sep}{, }

% IEEEtran Fallbacks
\\providecommand{\\IEEEauthorblockN}[1]{#1}
\\providecommand{\\IEEEauthorblockA}[1]{#1}
\\providecommand{\\IEEEpeerreviewmaketitle}{\\maketitle}
\\providecommand{\\IEEEpubid}[1]{}
\\providecommand{\\IEEEpubidmailingonly}[1]{}
\\providecommand{\\IEEEspecialpapernotice}[1]{}

% Springer / LLNCS Fallbacks
\\providecommand{\\institute}[1]{}
\\providecommand{\\inst}[1]{}
\\providecommand{\\titlerunning}[1]{}
\\providecommand{\\authorrunning}[1]{}
\\providecommand{\\tocauthor}[1]{}
\\providecommand{\\toctitle}[1]{}

% RevTeX / APS / AIP Fallbacks
\\providecommand{\\collaboration}[1]{}
\\providecommand{\\homepage}[1]{}
\\providecommand{\\altaffiliation}[1]{}
\\providecommand{\\pacs}[1]{}

% General Structural Fallbacks
\\providecommand{\\acknowledgments}[1]{}
\\providecommand{\\acknowledgements}[1]{}
\\providecommand{\\suppmaterial}[1]{}

\\@ifundefined{subfigure}{
  \\newenvironment{subfigure}[2][]{}{}
}{}
\\@ifundefined{newtheorem*}{
  \\@ifundefined{proof}{
    \\RequirePackage{amsthm}
  }{
    \\let\\savedproof\\proof
    \\let\\savedendproof\\endproof
    \\let\\proof\\relax
    \\let\\endproof\\relax
    \\RequirePackage{amsthm}
  }
}{}
\\catcode\`\\@=12
`;

  // Scrub usepackage calls for documentclass names to prevent "File '.sty' not found" crashes
  const knownClassNames = ['jfm', 'vgtc', 'IEEEtran', 'acmart', 'elsarticle', 'llncs', 'revtex4', 'revtex4-1', 'revtex4-2', 'svjour3', 'amsart', 'article', 'report', 'book', 'mdpi', 'nature', 'wlscirep', 'aip', 'aps'];
  for (const clsName of knownClassNames) {
    pResBody = pResBody.replace(new RegExp(`\\\\usepackage(?:\\s*\\[[^\\]]*\\])?\\s*\\{${clsName}\\}`, 'gi'), `% [Scrubbed class package: ${clsName}]`);
  }

  // Wrap ALL \newtheorem definitions in \@ifundefined guards to prevent
  // "already defined" conflicts when source and target classes define the same theorem env.
  let scrubbedPreamble = pResBody.replace(/\\documentclass[\s\S]*?\{[^}]*\}/gi, '% [Scrubbed documentclass]');
  // Match \newtheorem and \newtheorem* in all forms and wrap each in a guard
  scrubbedPreamble = scrubbedPreamble.replace(
    /\\newtheorem\*?\s*\{([^}]+)\}((?:\s*\[[^\]]*\])?)(?=\s*\{)(\ *\{[^}]*\})((?:\s*\[[^\]]*\])?)/g,
    (match, name, optBefore, label, optAfter) => {
      const isStarred = match.startsWith('\\newtheorem*');
      const cmdName = isStarred ? '\\newtheorem*' : '\\newtheorem';
      return `\\makeatletter\\@ifundefined{${name}}{${cmdName}{${name}}${optBefore}${label}${optAfter}}{}\\makeatother`;
    }
  );
// Helper: Recursively expand \input{...} and \include{...} files from fileMap into body content
function expandSubTexFiles(content: string, fileMap: Record<string, string>, depth = 0): string {
  if (depth > 5 || !content) return content;
  
  return content.replace(/\\(?:input|include)\s*\{([^}]+)\}/gi, (match, relPath) => {
    let cleanPath = relPath.trim();
    if (!cleanPath.toLowerCase().endsWith('.tex')) cleanPath += '.tex';
    
    const matchingKey = Object.keys(fileMap).find(k => {
      const normK = k.replace(/\\/g, '/').toLowerCase();
      const normP = cleanPath.replace(/\\/g, '/').toLowerCase();
      return normK === normP || normK.endsWith('/' + normP);
    });

    if (matchingKey && fileMap[matchingKey]) {
      let subContent = fileMap[matchingKey]
        .replace(/\\documentclass[\s\S]*?\{[^}]*\}/gi, '')
        .replace(/\\begin\s*\{\s*document\s*\}/gi, '')
        .replace(/\\end\s*\{\s*document\s*\}/gi, '');
      return `\n% --- BEGIN INPUT: ${cleanPath} ---\n` + expandSubTexFiles(subContent, fileMap, depth + 1) + `\n% --- END INPUT: ${cleanPath} ---\n`;
    }
    return match;
  });
}

  // Scrub Preamble of page break and maketitle artifacts
  userPreamble = userPreamble
    .replace(/\\newpage(?![a-zA-Z])/gi, '% [Scrubbed newpage]')
    .replace(/\\clearpage(?![a-zA-Z])/gi, '% [Scrubbed clearpage]')
    .replace(/\\pagebreak(?![a-zA-Z])/gi, '% [Scrubbed pagebreak]')
    .replace(/\\maketitle(?![a-zA-Z])/gi, '% [Scrubbed maketitle]');

  // Clean userPreamble of raw un-commented text lines that would spill onto Page 1 before title
  userPreamble = userPreamble.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('%') || trimmed.startsWith('\\')) return line;
    return `% [Scrubbed non-declaration preamble line]: ${line}`;
  }).join('\n');

  userPreamble = universalFallbacks + scrubbedPreamble;

  let rawUserBody = (docStart !== -1 && docEnd !== -1) 
    ? userMainTex.substring(docStart + beginLength, docEnd) 
    : (docStart !== -1 ? userMainTex.substring(docStart + beginLength) : userMainTex);
  
  // Recursively expand all sub-included .tex files from ZIP into body
  let userBody = expandSubTexFiles(rawUserBody, fileMap).trim();

  // Scrub Body
  let bResBody = userBody;
  for (const cmd of scrubList) {
    const res = extractAndRemoveCommand(bResBody, cmd);
    bResBody = res.body;
    if (res.extracted.length > 0) {
      auditLog.push(`- Scrubbed from Body: \\${cmd} (${res.extracted.length} instances)`);
    }
  }
  // Scrub body-structural commands that would cause duplicate metadata
  for (const cmd of bodyScrubList) {
    const res = extractAndRemoveCommand(bResBody, cmd);
    bResBody = res.body;
  }

  userBody = bResBody
    .replace(/\\documentclass[\s\S]*?\{[^}]*\}/gi, '% [Scrubbed documentclass]')
    .replace(/\\begin\s*\{\s*document\s*\}/gi, '% [Scrubbed begin{document}]')
    .replace(/\\end\s*\{\s*document\s*\}/gi, '% [Scrubbed end{document}]')
    .replace(/\\begin\s*\{\s*abstract\s*\}[\s\S]*?\\end\s*\{\s*abstract\s*\}/gi, '% [Migrated] Abstract moved')
    .replace(/\\begin\s*\{\s*keyword\s*\}[\s\S]*?\\end\s*\{\s*keyword\s*\}/gi, '% [Migrated] Keywords moved')
    .replace(/\\begin\s*\{\s*IEEEkeywords\s*\}[\s\S]*?\\end\s*\{\s*IEEEkeywords\s*\}/gi, '% [Migrated] Keywords moved')
    // Remove all remaining maketitle/body-structural occurrences
    .replace(/\\maketitle(?![a-zA-Z])/gi, '')
    .replace(/\\thanks\s*\{[^}]*\}/gi, '')
    .replace(/\\date\s*\{[^}]*\}/gi, '')
    .replace(/\\curraddr\s*\{[^}]*\}/gi, '')
    .replace(/\\dedicatory\s*\{[^}]*\}/gi, '')
    .replace(/\\subjclass\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/gi, '');

  // Strip leading page breaks from the start of userBody so Introduction flows directly on Page 1 below title
  userBody = userBody.replace(/^\s*(?:\\newpage|\\clearpage|\\pagebreak)\s*/gi, '');

  // 3. TARGET SKELETON GESTATION
  const templateContent = templateData.content || '';
  const templateDocStart = templateContent.indexOf('\\begin{document}');
  let finalMainTex = '';

  if (templateDocStart !== -1) {
      let templatePre = templateContent.substring(0, templateDocStart + 16);
      let templateBody = templateContent.substring(templateDocStart + 16);
      
      // I. INJECT PREAMBLE
      templatePre = templatePre.replace('\\begin{document}', `
% --- BEGIN SOURCE PREAMBLE ---
${userPreamble}
\n% --- END SOURCE PREAMBLE ---
\\begin{document}`);

      // II. ASSET DISCOVERY (With Migration Folder Awareness)
      const assetDirs = Array.from(new Set(rawPaths
        .filter(p => /\.(png|jpg|jpeg|gif|pdf|eps)$/i.test(p))
        .map(p => {
          const dir = p.includes('/') ? p.substring(0, p.lastIndexOf('/') + 1) : '';
          return `MIGRATION FILES/${dir}`;
        })));
      
      const gPath = `\n\\graphicspath{{./}{MIGRATION FILES/}${assetDirs.map(d => `{${d}}`).join('')}}\n`;
      templatePre = templatePre.replace('\\begin{document}', `${gPath}\\begin{document}`);

      // III. METADATA FUSION
      const injectedMeta = injectUniversalMetadata(templateContent, templateId, scholarlyMeta);

      // ENVIRONMENT DETECTION
      const isACM = templateId.includes('acm') || templateContent.includes('acmart');
      const isIEEE = templateId.includes('ieee') || templateContent.includes('IEEEtran');
      const isElsevier = templateId.includes('elsevier') || templateContent.includes('elsarticle');

      // TWO-COLUMN FLOAT AUTO-PROMOTION
      const isTwoColumnTarget = isIEEE || isACM || 
        /\\documentclass\s*\[[^\]]*\b(?:twocolumn|sigconf|reprint|2column|5p)\b[^\]]*\]/.test(templateContent) ||
        /\\twocolumn\b/.test(templateContent);

      if (isTwoColumnTarget) {
        // Promote wide single-column tables to table* [htbp]
        userBody = userBody.replace(/\\begin\s*\{\s*table\s*\}(?:\[[^\]]*\])?([\s\S]*?)\\end\s*\{\s*table\s*\}/gi, (match, inner) => {
          const colCount = (inner.match(/&/g) || []).length;
          if (colCount > 6 || inner.includes('tabularx') || inner.includes('adjustbox')) {
            return `\\begin{table*}[htbp]${inner}\\end{table*}`;
          }
          return match;
        });

        // Replace invalid [H] or [h] on starred floats with [htbp]
        userBody = userBody.replace(/\\begin\s*\{\s*(figure\*|table\*|algorithm\*)\s*\}\s*\[[^\]]*\]/gi, (match, envName) => {
          return `\\begin{${envName}}[htbp]`;
        });
      }

      // PREAMBLE SCRUBBING: Remove only placeholder metadata and residual maketitle from preamble
      const scrubCmds = ['title', 'author', 'email', 'affiliation', 'abstract', 'keywords', 'thanks', 'institute'];
      let tRes = { body: templatePre, extracted: [] as string[] };
      scrubCmds.forEach(cmd => {
        tRes = extractAndRemoveCommand(tRes.body, cmd);
      });
      templatePre = tRes.body.replace(/\\maketitle(?![a-zA-Z])/gi, '');

      // For Elsevier: remove native frontmatter placeholder (injectedMeta supplies a fresh one)
      if (isElsevier) {
        templateBody = templateBody.replace(/\\begin\{frontmatter\}[\s\S]*?\\end\{frontmatter\}/gi, '');
      }
      templateBody = templateBody.replace(/\\begin\{frontmatter\}|\\end\{frontmatter\}/gi, '');

      // IV. UNIVERSAL BODY FUSION
      // Instead of merging around a \maketitle anchor (which differs per template),
      // we completely replace the template body's placeholder section with:
      //   [injectedMeta] — real metadata in the target-template's exact format
      //   [userBody]     — user's actual academic content, scrubbed of source metadata
      //   [footerStr]    — bibliography commands + \end{document} from template skeleton
      //
      // injectProfessionalMetadata() already generates the correct structure
      // (frontmatter for Elsevier, \maketitle sequence for IEEE/LNCS/Standard, etc.)
      // so this approach is bias-free across all template types.

      // Defensive second-pass: strip any residual \maketitle / abstract / frontmatter from userBody
      userBody = userBody
        .replace(/\\maketitle(?![a-zA-Z])/gi, '')
        .replace(/\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/gi, '')
        .replace(/\\begin\{frontmatter\}|\\end\{frontmatter\}/gi, '');

      // Extract the bibliographic footer from the skeleton
      // (any \bibliographystyle / \bibliography / \printbibliography + \end{document})
      const endDocIdx = templateBody.lastIndexOf('\\end{document}');
      let footerStr = '\\end{document}';
      if (endDocIdx !== -1) {
        const beforeEnd = templateBody.substring(0, endDocIdx);
        const bibPatterns = ['\\bibliographystyle', '\\bibliography{', '\\printbibliography', '\\addbibresource'];
        let footerStart = endDocIdx;
        for (const pat of bibPatterns) {
          const patIdx = beforeEnd.lastIndexOf(pat);
          if (patIdx !== -1 && patIdx < footerStart) {
            footerStart = patIdx;
          }
        }
        footerStr = templateBody.substring(footerStart);
      }

      // Assemble: real metadata (target format) + user content + bibliography footer
      templateBody = '\n' + injectedMeta + '\n' + userBody + '\n' + footerStr;

      // V. BIBLIOGRAPHY REMAPPING
      const hasInlineBib = userBody.includes('\\begin{thebibliography}');
      
      if (bibFiles.length > 0) {
        // Since bib files are promoted to the root folder, we use direct root filenames to avoid absolute path warning issues
        const bibBases = bibFiles.map(bf => {
          const fileName = bf.includes('/') ? bf.split('/').pop()! : bf;
          return fileName.replace(/\.bib$/i, '');
        });
        const bibBaseString = bibBases.join(',');
        
        const usesBibLaTeX = templateContent.includes('biblatex') || userMainTex.includes('biblatex');
        
        // UNIVERSAL BIBSTYLE DETECTION: Read from template instead of hardcoding
        const tBibStyleMatch = templateContent.match(/\\bibliographystyle\{([^}]*)\}/);
        const bibStyle = tBibStyleMatch ? tBibStyleMatch[1].trim() : 
                         templateId.includes('ieee') ? 'IEEEtran' : 
                         templateId.includes('acm') ? 'ACM-Reference-Format' : 
                         isElsevier ? 'elsarticle-num' : 'plain';

        if (usesBibLaTeX) {
          bibFiles.forEach(bf => {
            const fileName = bf.includes('/') ? bf.split('/').pop()! : bf;
            templatePre = templatePre.replace('\\begin{document}', `\\addbibresource{${fileName}}\n\\begin{document}`);
          });
          templateBody = templateBody.replace('\\end{document}', `\\printbibliography\n\\end{document}`);
        } else {
          const bibCmd = `\n\\bibliographystyle{${bibStyle}}\n\\bibliography{${bibBaseString}}\n`;
          templateBody = templateBody.replace(/\\bibliographystyle\{[^}]*\}/gi, '').replace(/\\bibliography\{[^}]*\}/gi, '');
          templateBody = templateBody.replace('\\end{document}', `${bibCmd}\\end{document}`);
        }
      } else if (hasInlineBib) {
        // Remove native template bibliography commands if the user has inline thebibliography
        templateBody = templateBody.replace(/\\bibliographystyle\{[^}]*\}/gi, '').replace(/\\bibliography\{[^}]*\}/gi, '');
      } else {
        // Universal Bibliography Guarantee: Ensure a clean, compliant \begin{thebibliography} block is present
        // so the References / Bibliography heading ALWAYS appears on the generated PDF
        const tBibStyleMatch = templateContent.match(/\\bibliographystyle\{([^}]*)\}/);
        const bibStyle = tBibStyleMatch ? tBibStyleMatch[1].trim() : (isElsevier ? 'elsarticle-num' : 'plain');
        const fallbackBib = `\n\\bibliographystyle{${bibStyle}}\n\\begin{thebibliography}{99}\n\\bibitem{ref1} Author Name, \\textit{Title of Paper}, Journal/Conference, 2025.\n\\end{thebibliography}\n`;
        templateBody = templateBody.replace(/\\bibliographystyle\{[^}]*\}/gi, '').replace(/\\bibliography\{[^}]*\}/gi, '');
        templateBody = templateBody.replace('\\end{document}', `${fallbackBib}\\end{document}`);
      }

      finalMainTex = templatePre + "\n" + templateBody;
  } else {
      finalMainTex = templateContent + "\n" + userPreamble + "\n" + userBody;
  }

  finalMainTex = normalizeBibReferences(finalMainTex, bibFiles);
  // NOTE: We do NOT call autoHealLatex here — it is designed for Latexify/DocIDE workflows
  // and aggressively restructures document layout, which would corrupt the migrated template.
  // We only apply the safe sanitization sieve (unicode fixes, pkg deduplication, etc.).
  finalMainTex = applyFinalSanitizationSieve(finalMainTex);

  // 4. PACKAGING: PARTITIONED WORKSPACE & ASSET PROMOTION
  const resultFiles: { 
    path: string; 
    content: string | Uint8Array; 
    isBinary: boolean;
    metadata?: { isUserStyle?: boolean }
  }[] = [];
  
  // A. TARGET ASSETS (Root) - Mandatory Journal Structure
  resultFiles.push({ path: 'main.tex', content: finalMainTex, isBinary: false });

  const availableAssets = templateData.assets || [];
  availableAssets.forEach(asset => {
    // Skip only the main template entrypoint file (typically main.tex or template.tex)
    // to avoid overwriting our freshly generated and merged main.tex,
    // while perfectly preserving sub-skeleton files (e.g. metadata/authors.tex, sections/*.tex).
    const isMainTemplateFile = asset.path.toLowerCase() === 'main.tex' || 
                               asset.path.toLowerCase() === 'template.tex' ||
                               asset.content === templateData.content;
                               
    if (isMainTemplateFile) return;
    resultFiles.push({ path: asset.path, content: asset.content, isBinary: false });
  });

  // II. Legacy Asset Fallbacks (Safety)
  const docClassMatch = finalMainTex.match(/\\documentclass(?:\[[^\]]*\])?\{([^}]*)\}/);
  const targetClsBase = docClassMatch ? docClassMatch[1].trim() : '';
  const targetClsName = targetClsBase ? `${targetClsBase}.cls` : '';

  if (targetClsName && !resultFiles.some(f => f.path.toLowerCase() === targetClsName.toLowerCase()) && templateData.clsContent) {
    resultFiles.push({ path: targetClsName, content: templateData.clsContent, isBinary: false });
  }

  const bibStyleMatch = finalMainTex.match(/\\bibliographystyle\{([^}]*)\}/);
  const targetBstBase = bibStyleMatch ? bibStyleMatch[1].trim() : '';
  const targetBstName = targetBstBase ? `${targetBstBase}.bst` : '';

  if (targetBstName && !resultFiles.some(f => f.path.toLowerCase() === targetBstName.toLowerCase()) && templateData.bstContent) {
    resultFiles.push({ path: targetBstName, content: templateData.bstContent, isBinary: false });
  }

  // III. SOURCE ASSET PROMOTION (1000% Accuracy Enhancement)
  // We promote project-essential source files to root IF they don't conflict with target template.
  const PROMOTABLE_EXTS = ['.sty', '.bib', '.bst', '.cfg', '.clo', '.tex'];
  Object.keys(fileMap).forEach(path => {
    const extMatch = PROMOTABLE_EXTS.find(ext => path.toLowerCase().endsWith(ext));
    if (extMatch && path !== mainFilePath) {
      // For .tex files, we MUST preserve their original relative directory structures
      // to ensure nested \input{...} and \include{...} statements compile successfully.
      // Other global style, class, and bibliography assets are promoted directly to the root.
      const isTexFile = path.toLowerCase().endsWith('.tex');
      const targetPath = isTexFile ? path : (path.includes('/') ? path.split('/').pop()! : path);
      const isConflicting = resultFiles.some(f => f.path.toLowerCase() === targetPath.toLowerCase());
      
      if (!isConflicting) {
        resultFiles.push({ 
          path: targetPath, 
          content: fileMap[path], 
          isBinary: false,
          metadata: { isUserStyle: true }
        });
      }
    }
  });

  // B. SOURCE REFERENCE ASSETS (MIGRATION FILES/) - Immutable Reference Folder
  binaryFiles.forEach(b => resultFiles.push({ ...b, path: `MIGRATION FILES/${b.path}`, isBinary: true }));
  Object.keys(fileMap).forEach(path => {
    resultFiles.push({ path: `MIGRATION FILES/${path}`, content: fileMap[path], isBinary: false });
  });

  // C. AUDIT REPORT
  auditLog.push("");
  auditLog.push("Migration completed successfully.");
  resultFiles.push({ path: 'migration_report.txt', content: auditLog.join('\n'), isBinary: false });

  return { files: resultFiles, mainFile: 'main.tex' };
}

/**
 * Universal Bibliography Reference Path Normalizer.
 * Rewrites relative paths in \bibliography and \addbibresource to point to promoted root filenames.
 */
function normalizeBibReferences(latex: string, bibFiles: string[]): string {
  if (!latex) return "";
  let result = latex;
  
  // 1. Normalize \bibliography{...} paths
  result = result.replace(/\\bibliography\s*\{([^}]*)\}/gi, (match, pathList) => {
    const paths = pathList.split(',').map((p: string) => {
      const trimmed = p.trim();
      const baseName = trimmed.includes('/') ? trimmed.split('/').pop()! : trimmed;
      return baseName.replace(/\.bib$/i, '');
    });
    return `\\bibliography{${paths.join(',')}}`;
  });

  // 2. Normalize \addbibresource{...} paths
  result = result.replace(/\\addbibresource\s*\{([^}]*)\}/gi, (match, filepath) => {
    const trimmed = filepath.trim();
    const baseName = trimmed.includes('/') ? trimmed.split('/').pop()! : trimmed;
    return `\\addbibresource{${baseName}}`;
  });

  return result;
}
