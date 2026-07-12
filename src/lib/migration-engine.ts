import JSZip from 'jszip';
import { 
  extractProfessionalMetadata, 
  injectUniversalMetadata, 
  autoHealLatex,
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
  
  // Clean Preamble
  let pRes = { body: userPreamble, extracted: [] as string[] };
  for (const cmd of scrubList) {
    if (cmd === 'usepackage' || cmd === 'documentclass') continue;
    pRes = extractAndRemoveCommand(pRes.body, cmd);
  }
  userPreamble = pRes.body.replace(/\\documentclass[\s\S]*?\{[^}]*\}/gi, '% [Scrubbed documentclass]');

  let userBody = (docStart !== -1 && docEnd !== -1) 
    ? userMainTex.substring(docStart + beginLength, docEnd) 
    : userMainTex;
  userBody = userBody.trim();

  // Scrub Body
  let bRes = { body: userBody, extracted: [] as string[] };
  for (const cmd of scrubList) {
    bRes = extractAndRemoveCommand(bRes.body, cmd);
  }
  userBody = bRes.body
    .replace(/\\documentclass[\s\S]*?\{[^}]*\}/gi, '% [Scrubbed documentclass]')
    .replace(/\\begin\s*\{\s*document\s*\}/gi, '% [Scrubbed begin{document}]')
    .replace(/\\end\s*\{\s*document\s*\}/gi, '% [Scrubbed end{document}]')
    .replace(/\\begin\s*\{\s*abstract\s*\}[\s\S]*?\\end\s*\{\s*abstract\s*\}/gi, '% [Migrated] Abstract moved')
    .replace(/\\begin\s*\{\s*keyword\s*\}[\s\S]*?\\end\s*\{\s*keyword\s*\}/gi, '% [Migrated] Keywords moved')
    .replace(/\\begin\s*\{\s*IEEEkeywords\s*\}[\s\S]*?\\end\s*\{\s*IEEEkeywords\s*\}/gi, '% [Migrated] Keywords moved')
    .replace(/\\maketitle(?![a-zA-Z])/gi, '% [Migrated] maketitle moved');

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
      
      // DEEP SCRUBBING: Remove ALL template placeholders to prevent duplicates
      const scrubCmds = ['title', 'author', 'email', 'affiliation', 'abstract', 'keywords', 'thanks', 'institute'];
      let tRes = { body: templatePre, extracted: [] as string[] };
      let tbRes = { body: templateBody, extracted: [] as string[] };
      scrubCmds.forEach(cmd => {
        tRes = extractAndRemoveCommand(tRes.body, cmd);
        tbRes = extractAndRemoveCommand(tbRes.body, cmd);
      });
      templatePre = tRes.body;
      templateBody = tbRes.body
        .replace(/\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/gi, '')
        .replace(/\\begin\{keyword\}[\s\S]*?\\end\{keyword\}/gi, '')
        .replace(/\\begin\{IEEEkeywords\}[\s\S]*?\\end\{IEEEkeywords\}/gi, '');

      // ENVIRONMENT SEQUENCING: Target Specific Structural Optimization
      const isACM = templateId.includes('acm') || templateContent.includes('acmart');
      const isIEEE = templateId.includes('ieee') || templateContent.includes('IEEEtran');
      const isElsevier = templateId.includes('elsevier') || templateContent.includes('elsarticle');
      
      if (isElsevier) {
        const fmStart = templatePre.indexOf('\\begin{frontmatter}');
        const fmEnd = templatePre.indexOf('\\end{frontmatter}');
        if (fmStart !== -1 && fmEnd !== -1) {
          templatePre = templatePre.substring(0, fmStart) + injectedMeta + templatePre.substring(fmEnd + 17);
        } else {
          templatePre = templatePre.replace('\\begin{document}', `\n${injectedMeta}\n\\begin{document}`);
        }
      } else if (isACM) {
        // ACM expects abstract/keywords BEFORE maketitle
        templatePre = templatePre.replace('\\begin{document}', `\n${injectedMeta}\n\\begin{document}`);
      } else if (isIEEE) {
        // IEEE expects abstract/keywords in a specific block or before maketitle
        templatePre = templatePre.replace('\\begin{document}', `\n${injectedMeta}\n\\begin{document}`);
      } else {
        templatePre = templatePre.replace('\\begin{document}', `\n${injectedMeta}\n\\begin{document}`);
      }

      // IV. BODY FUSION & REDUNDANCY FILTER
      // Detect if user text already has a \section{Introduction} to avoid duplicates
      if (userBody.toLowerCase().includes('\\section{introduction}')) {
          templateBody = templateBody.replace(/\\section\{Introduction\}[\s\S]*?(?=\\section)/i, '');
      }

      const makeTitleIdx = templateBody.indexOf('\\maketitle');
      const introIdx = templateBody.search(/\\section\{/i);
      const endIdx = templateBody.lastIndexOf('\\end{document}');
      
      if (endIdx !== -1) {
          const footerStr = templateBody.substring(endIdx);
          let headerEnd = 0;
          if (makeTitleIdx !== -1) headerEnd = makeTitleIdx + 10;
          else if (introIdx !== -1) headerEnd = introIdx;
          templateBody = templateBody.substring(0, headerEnd) + "\n" + userBody + "\n" + footerStr;
      }

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
      }

      finalMainTex = templatePre + "\n" + templateBody;
  } else {
      finalMainTex = templateContent + "\n" + userPreamble + "\n" + userBody;
  }

  finalMainTex = normalizeBibReferences(finalMainTex, bibFiles);
  finalMainTex = autoHealLatex(finalMainTex);

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
