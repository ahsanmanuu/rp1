import { 
  FilePayload, 
  sanitizeFiles, 
  prepareStructuredPayload,
  robustPreambleInjector,
  flattenProject, 
  parseLog,
  calculatePayloadSize,
  isBinaryFile
} from './compiler-utils';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { PipelineGC } from '@/lib/pipeline-gc';
import { applyFinalSanitizationSieve } from '@/lib/latex';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function normalizePath(p: string): string {
  return (p || '').replace(/^\.\//, '').replace(/\\/g, '/').toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL CITATION RESOLUTION
// Canonical numeric BibTeX style that ALWAYS emits \bibitem entries. Two variants:
//   - WITH thebibliography wrapper (standard classes provide the env via \bibliography)
//   - WITHOUT the wrapper (natbib classes wrap thebibliography themselves)
// Both are written with direct write$ calls to avoid the tectonic bibtex buffer bug.
// ─────────────────────────────────────────────────────────────────────────────
const CANONICAL_BST_BODY = `
ENTRY
  { address author booktitle chapter edition editor howpublished institution
    journal key month note number organization pages publisher school series
    title type volume year }
  {}
  { label }

STRINGS { s }

FUNCTION {bibitem}
{ newline$
  "\\bibitem{" write$
  cite$ write$
  "}" write$
  newline$
}

FUNCTION {fmt.names}
{ 's := s }

FUNCTION {fmt.authors}
{ author empty$
    { "" }
    { author fmt.names }
  if$
}

FUNCTION {fmt.editors}
{ editor empty$
    { "" }
    { editor fmt.names ", editors" * }
  if$
}

FUNCTION {article}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  journal empty$
    { "no journal" }
    { journal }
  if$
  write$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {book}
{ bibitem
  author empty$ { editor fmt.editors } { author fmt.names } if$ write$
  newline$
  title write$
  newline$
  publisher empty$ 'skip$ { publisher write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {incollection}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  "In " editor fmt.editors write$
  booktitle empty$ 'skip$ { " " booktitle write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {inproceedings}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  "In " editor fmt.editors write$
  booktitle empty$ 'skip$ { " " booktitle write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {techreport}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  institution empty$ 'skip$ { institution write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {misc}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  howpublished empty$ 'skip$ { howpublished write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {phdthesis}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  "PhD thesis" write$
  school empty$ 'skip$ { ", " school * write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {mastersthesis}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  "Master's thesis" write$
  school empty$ 'skip$ { ", " school * write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {proceedings}
{ bibitem
  editor empty$
    { title }
    { editor fmt.editors ", " title * }
  if$
  write$
  newline$
  publisher empty$ 'skip$ { publisher write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {manual}
{ bibitem
  author empty$ { organization } { author fmt.names } if$ write$
  newline$
  title write$
  newline$
  organization empty$ 'skip$ { organization write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {default.type} { misc }

MACRO {jan} {"January"}
MACRO {feb} {"February"}
MACRO {mar} {"March"}
MACRO {apr} {"April"}
MACRO {may} {"May"}
MACRO {jun} {"June"}
MACRO {jul} {"July"}
MACRO {aug} {"August"}
MACRO {sep} {"September"}
MACRO {oct} {"October"}
MACRO {nov} {"November"}
MACRO {dec} {"December"}
`;

function buildCanonicalBst(wrapEnv: boolean): string {
  // READ must precede any EXECUTE; the env wrapper (begin/end) is only needed
  // for standard classes — natbib classes wrap thebibliography themselves.
  const open = wrapEnv
    ? 'FUNCTION {begin.bib} { "\\begin{thebibliography}{99}" write$ newline$ }\nEXECUTE {begin.bib}\n'
    : '';
  const close = wrapEnv
    ? 'FUNCTION {end.bib} { newline$ "\\end{thebibliography}" write$ newline$ }\nEXECUTE {end.bib}\n'
    : '';
  return `% Latexify Studio universal numeric bibliography style (auto-injected)\n${CANONICAL_BST_BODY}\nREAD\n${open}ITERATE { call.type$ }\nREVERSE { newline$ }\n${close}`;
}

const NATBIB_CLASS_SET = new Set([
  'elsarticle', 'nature', 'ieee', 'ieeetran', 'acmart', 'sigconf', 'sigplan', 'sigchi',
  'llncs', 'svproc', 'springer', 'siamart', 'siam', 'amsart', 'amscls',
  'revtex', 'apa', 'apa6', 'apa7', 'bjnp', 'bjnpp', 'rnc', 'chemmacros',
  'chemacs', 'gloss', 'glossaries', 'memoir', 'scrartcl', 'scrreprt', 'scrbook',
  'achemso', 'rsc', 'frontiers', 'mdpi', 'oup', 'oxford', 'wiley',
]);

function isPlaceholderBst(content: string): boolean {
  // A real BibTeX style emits \bibitem entries; placeholders never do.
  if (/\\bibitem/.test(content)) return false;
  if (/Minimal placeholder/i.test(content)) return true;
  // No ITERATE over entries and no \bibitem => cannot produce citations.
  return !/ITERATE\s*\{\s*call\.type\$/.test(content);
}

function extractCiteKeys(tex: string): string[] {
  const keys = new Set<string>();
  const re = /\\(?:cite|citep|citet|citeauthor|citeyear|citeyearpar|citealp|citealt|cites|autocite|textcite|parencite|footcite|smartcite|parentcite|nocite)\*?\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tex)) !== null) {
    const inner = m[1] || '';
    if (/^\s*\*\s*$/.test(inner)) continue; // \nocite{*}
    inner.split(',').forEach((k) => {
      const key = k.trim();
      if (key && /^[^\s{}#,]+$/.test(key)) keys.add(key);
    });
  }
  return [...keys];
}

function extractBibKeys(bibContent: string): Set<string> {
  const keys = new Set<string>();
  const re = /@\s*\w+\s*\{\s*([^,}\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bibContent)) !== null) {
    const k = (m[1] || '').trim();
    if (k) keys.add(k);
  }
  return keys;
}

/**
 * Guarantees a resolvable bibliography for any BibTeX-based document:
 *  - Injects synthetic @misc entries for cited keys missing from .bib files.
 *  - Substitutes a working numeric .bst for any placeholder style file.
 * Mutates `activeFiles` in place and may rewrite the main .tex bibliography list.
 */
function applyUniversalBibliographyFix(activeFiles: FilePayload[], cleanMain: string): void {
  const mainObj = activeFiles.find(f => normalizePath(f.path) === normalizePath(cleanMain));
  if (!mainObj) return;
  const tex = mainObj.content || '';

  // Determine document class + natbib usage for env-aware .bst selection.
  const dcMatch = tex.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);
  const docClass = (dcMatch ? dcMatch[1].trim().toLowerCase() : '');
  const isNatbib =
    NATBIB_CLASS_SET.has(docClass) ||
    /ieee|nature|elsarticle|acmart|llncs|svproc|siam|revtex|apa/i.test(docClass) ||
    /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bnatbib\b[^}]*\}/i.test(tex) ||
    /\\(?:citep|citet|citeauthor|citeyear|citealp|citealt)\*?\s*(?:\[[^\]]*\])?\s*\{/.test(tex);

  // 1) Gather cited keys and existing bib keys.
  const allTex = activeFiles.filter(f => f.path.toLowerCase().endsWith('.tex')).map(f => f.content || '').join('\n');
  const citedKeys = extractCiteKeys(allTex);
  const bibFiles = activeFiles.filter(f => f.path.toLowerCase().endsWith('.bib'));
  const presentKeys = new Set<string>();
  bibFiles.forEach(f => extractBibKeys(f.content || '').forEach(k => presentKeys.add(k)));

  const missingKeys = citedKeys.filter(k => !presentKeys.has(k));
  if (missingKeys.length > 0) {
    console.log(`[BIBFIX] Missing cited keys (will inject): ${missingKeys.join(', ')}`);
    const entries = missingKeys.map(k =>
      `@misc{${k},\n  author = {Author, Anonymous},\n  title = {Reference: ${k}},\n  journal = {},\n  year = {2024}\n}`
    ).join('\n\n');
    const autociteName = 'scholarly-autocite.bib';
    const existing = activeFiles.find(f => normalizePath(f.path) === autociteName);
    if (existing) {
      existing.content = `${existing.content}\n\n${entries}`;
    } else {
      activeFiles.push({ path: autociteName, content: entries });
    }
    // Ensure the autocite .bib is listed in \bibliography{...}.
    if (/\\bibliography\s*\{/.test(tex)) {
      mainObj.content = tex.replace(/\\bibliography\s*\{([^}]*)\}/, (mm, list) =>
        list.split(',').map((s: string) => s.trim()).filter(Boolean).includes('scholarly-autocite')
          ? mm
          : `\\bibliography{${list},scholarly-autocite}`
      );
    } else if (/\\bibliographystyle\s*\{/.test(tex)) {
      mainObj.content = tex.replace(/\\bibliographystyle\s*\{[^}]*\}/, (mm) => `${mm}\n\\bibliography{scholarly-autocite}`);
    }
  }

  // 2) Supply a bibliographystyle if none present (bibtex needs one).
  const refreshedTex = mainObj.content || tex;
  if (/\\bibliography\b/.test(refreshedTex) && !/\\bibliographystyle\s*\{/.test(refreshedTex)) {
    mainObj.content = refreshedTex.replace(/\\bibliography\s*\{/, '\\bibliographystyle{plain}\n\\bibliography{');
    console.log('[BIBFIX] Injected default \\bibliographystyle{plain}.');
  }

  // 3) Substitute placeholder .bst files with a working numeric style.
  const bstStyleMatch = (mainObj.content || tex).match(/\\bibliographystyle\s*\{\s*([^}]+)\s*\}/);
  const styleNames = bstStyleMatch ? [bstStyleMatch[1].trim()] : [];
  // Also catch .bst files pulled in via \bibliographystyle or present in payload.
  activeFiles.forEach(f => {
    if (!f.path.toLowerCase().endsWith('.bst')) return;
    if (isPlaceholderBst(f.content || '')) {
      f.content = buildCanonicalBst(!isNatbib);
      console.log(`[BIBFIX] Replaced placeholder .bst with working style: ${f.path} (wrapEnv=${!isNatbib})`);
    }
  });
  // If the referenced style's .bst is missing, inject the canonical one.
  styleNames.forEach(name => {
    const bstPath = `${name}.bst`;
    const has = activeFiles.some(f => normalizePath(f.path) === bstPath.toLowerCase());
    if (!has) {
      activeFiles.push({ path: bstPath, content: buildCanonicalBst(!isNatbib) });
      console.log(`[BIBFIX] Injected missing style .bst: ${bstPath} (wrapEnv=${!isNatbib})`);
    }
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// NUCLEAR 17.0 MASTER ENGINE (Recursive Sanitization & HA Discovery)
// ─────────────────────────────────────────────────────────────────────────────

export interface CompileResult {
  success: boolean;
  pdfBase64: string | null;
  pdfUrl?: string;
  log: string;
  errors: any[];
  strategy?: string;
  suggestion?: string;
}

const YTOTECH_URL = 'https://latex.ytotech.com/builds/sync';
const LATEXONLINE_MIRRORS = ['https://latex.asls.dev', 'https://texonline.cc'];
const TEXLIVE_MIRRORS = ['https://texlive.net/cgi-bin/latexcgi', 'https://learnlatex.org/cgi-bin/latexcgi'];

// Proxy assets for GHOST SHIELD
const PROXY_IMAGE_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const PROXY_JPG_B64 = "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpAB//Z";
const PROXY_PDF_B64 = "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqIDIgMCBvYmo8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PmVuZG9iaiAzIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0vUmVzb3VyY2VzPDw+Pi9Db250ZW50cyA0IDAgUj4+ZW5kb2JqIDQgMCBvYmo8PC9MZW5ndGggMjM+PnN0cmVhbQpCVC9GMSAxMiBUcyAoSGVsbG8pIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAgbiAKMDAwMDAwMDExMSAwMDAwMCBuIAowMDAwMDAwMjEyIDAwMDAwIG4gCnRyYWlsZXI8PC9TaXplIDUvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoyODYKJSVFT0YK";

async function fetchWithRetry(urls: string[], options: any, mirrorPath = ''): Promise<Response> {
  let lastError: any;
  for (const url of urls) {
    try {
      const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
      const target = mirrorPath ? `${baseUrl}${mirrorPath.startsWith('/') ? mirrorPath : '/' + mirrorPath}` : baseUrl;
      const res = await fetch(target, options);
      if (res.ok) return res;
      continue;
    } catch (e: any) { lastError = e; }
  }
  throw lastError || new Error("All mirrors exhausted");
}

// --- MASTER ORCHESTRATOR (ELEVATED FOR TURBOPACK VISIBILITY) ---

export async function runHardenedPipeline(
  engine: string,
  files: FilePayload[],
  mainFile: string,
  projectId: string | null,
  config: { profile: string, ghostMode: boolean } = { profile: 'generic', ghostMode: true }
): Promise<CompileResult> {
  try {
    const discovered = await hardenedDiscovery(projectId, files, mainFile);
    
    // NUCLEAR 28.0: MASTER PRE-PROCESSING (Sanitization)
    // CRITICAL: ONLY sanitize the main file to prevent mangling of support files (.cls, .sty, .bib)
    const normalized = discovered.map(f => {
      // Passthrough content exactly without aggressive sanitization
      return f;
      
      // Passthrough for support files and sub-documents
      return f;
    });

    // Auto-link/copy support files (.cls, .sty, .bst, .bib, .clo, .def, .cfg, .ldf, .fd, .bbx, .cbx)
    // from subdirectories to the root directory to make them discoverable by the LaTeX engine.
    const autoLinkedFiles: FilePayload[] = [];
    const rootFilenames = new Set(
      normalized
        .filter(f => !f.path.includes('/') && !f.path.includes('\\'))
        .map(f => f.path.toLowerCase())
    );

    for (const f of normalized) {
      const hasSubdir = f.path.includes('/') || f.path.includes('\\');
      if (hasSubdir) {
        const basename = path.basename(f.path);
        const ext = basename.split('.').pop()?.toLowerCase() || '';
        const isSupportFile = /^(cls|sty|bst|bib|clo|def|cfg|ldf|fd|bbx|cbx)$/i.test(ext);
        
        if (isSupportFile && !rootFilenames.has(basename.toLowerCase())) {
          autoLinkedFiles.push({
            path: basename,
            content: f.content
          });
          rootFilenames.add(basename.toLowerCase());
          console.log(`[PIPELINE] Auto-linked support file to root: ${f.path} -> ${basename}`);
        }
      }
    }
    
    const finalNormalized = [...normalized, ...autoLinkedFiles];

    const cleanMain = finalNormalized.find(f => f.path.toLowerCase() === mainFile.toLowerCase())?.path || mainFile;

    // SAFETY: Ensure all file content values are strings (disk reads may return Buffers)
    finalNormalized.forEach(f => { if (typeof f.content !== 'string') f.content = String(f.content || ''); });

    const totalBytes = calculatePayloadSize(finalNormalized);
    const imageCount = finalNormalized.filter(f => f.content.startsWith('data:image')).length;

    const renames: Record<string, string> = {};
    // Strategy Selection — declared here so the optimizeAssets closure below can reference it.
    const useGhostMode = config.ghostMode;
    const optimizeAssets = async (assets: FilePayload[]) => {
        // Process all assets in parallel — avoids sequential image decode/encode bottleneck
        const results = await Promise.all(assets.map(async (f) => {
            if (isBinaryFile(f.path) && f.content.startsWith('data:image')) {

                // ── NON-GHOST (Latexify Studio) ─────────────────────────────────────
                // Transcode non-standard formats to standard PNG, preserve standard formats verbatim.
                if (!useGhostMode) {
                    const ext = f.path.split('.').pop()?.toLowerCase() || '';
                    const isNonStandard = ['webp', 'avif', 'gif', 'tiff', 'tif', 'bmp', 'svg', 'heic', 'heif'].includes(ext);
                    if (isNonStandard) {
                        try {
                            const b64 = f.content.split(',')[1] || f.content;
                            const buffer = Buffer.from(b64, 'base64');
                            let pipeline = sharp(buffer);
                            
                            if (ext === 'svg') {
                                pipeline = sharp(buffer, { density: 300 }); // Render SVG at high-resolution
                            }
                            
                            const processedBuffer = await pipeline.png().toBuffer();
                            const newPath = f.path.replace(/\.[^.]+$/, `.png`);
                            if (newPath !== f.path) {
                                renames[f.path] = newPath;
                                console.log(`[OMEGA] Non-Ghost Asset Transformed: ${f.path} -> ${newPath}`);
                            }
                            return { ...f, path: newPath, content: `data:image/png;base64,${processedBuffer.toString('base64')}` };
                        } catch (e) {
                            console.error('[OMEGA] Non-Ghost normalization fail:', f.path, e);
                        }
                    }

                    const rawMime = f.content.split(';')[0].split(':')[1] || '';
                    const canonMime = rawMime === 'image/jpg'  ? 'image/jpeg'
                                    : rawMime === 'image/JPG'  ? 'image/jpeg'
                                    : rawMime === 'image/JPEG' ? 'image/jpeg'
                                    : rawMime === 'image/PNG'  ? 'image/png'
                                    : rawMime;
                    if (canonMime && canonMime !== rawMime) {
                        const rest = f.content.indexOf(',');
                        return { ...f, content: `data:${canonMime};base64,${f.content.slice(rest + 1)}` };
                    }
                    return f;
                }

                // ── GHOST MODE (Migrator / Doc2Latex) ────────────────────────────────
                const b64 = f.content.split(',')[1] || f.content;
                const buffer = Buffer.from(b64, 'base64');
                const ext = f.path.split('.').pop()?.toLowerCase() || '';

                try {
                    // FAST PASSTHROUGH for vector graphics (PDF and EPS are native; SVG needs transcoding)
                    if (['pdf', 'eps'].includes(ext)) {
                        return f;
                    }

                    const meta = await sharp(buffer).metadata();
                    let pipeline = sharp(buffer);

                    let finalExt = ext;
                    let mime = `image/${ext === 'pdf' ? 'pdf' : ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext}`;

                    const targetQuality = 40;
                    const targetDim = 600;

                    // FAST PASSTHROUGH: If image is already optimized, skip expensive sharp pipeline
                    if (meta.width && meta.height && meta.width <= targetDim && meta.height <= targetDim && 
                        !meta.hasAlpha && (ext === 'jpg' || ext === 'jpeg') && buffer.length < 102400) {
                        return f;
                    }

                    const isNonStandard = ['webp', 'avif', 'gif', 'tiff', 'tif', 'bmp', 'svg', 'heic', 'heif'].includes(ext);
                    
                    if (ext === 'png' || meta.hasAlpha || ext === 'svg') {
                        pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: targetQuality, mozjpeg: true });
                        finalExt = 'jpg';
                        mime = 'image/jpeg';
                    } else if (isNonStandard || ext === 'jpg' || ext === 'jpeg') {
                        pipeline = pipeline.jpeg({ quality: targetQuality, mozjpeg: true });
                        finalExt = 'jpg';
                        mime = 'image/jpeg';
                    }

                    pipeline = pipeline.resize(targetDim, targetDim, { fit: 'inside', withoutEnlargement: true });

                    const processedBuffer = await pipeline.toBuffer();
                    const newPath = f.path.replace(/\.[^.]+$/, `.${finalExt}`);
                    if (newPath !== f.path) {
                        renames[f.path] = newPath;
                        console.log(`[OMEGA] Asset Transformed: ${f.path} -> ${newPath}`);
                    }
                    return { ...f, path: newPath, content: `data:${mime};base64,${processedBuffer.toString('base64')}` };
                } catch (e) {
                    console.error('[OMEGA] Normalization fail, dropping corrupt asset:', f.path, e);
                    // Return a 1x1 transparent PNG instead of a corrupt file that crashes the compiler
                    const transparent1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                    const newPath = f.path.replace(/\.[^.]+$/, `.png`);
                    if (newPath !== f.path) {
                        renames[f.path] = newPath;
                    }
                    return { ...f, path: newPath, content: `data:image/png;base64,${transparent1x1}` };
                }
            }
            return f;
        }));
        return results;
    };

    console.log(`[PIPELINE] Omega Strategy. Size: ${(totalBytes / (1024*1024)).toFixed(2)} MB, Images: ${imageCount}, Mode: ${useGhostMode ? 'GHOST' : 'FULL'}`);

    if (useGhostMode) {
        normalized.forEach(f => {
            if (normalizePath(f.path) === normalizePath(cleanMain)) {
                f.content = robustPreambleInjector(f.content);
            }
        });
    }

    // DEFENSIVE CLOSURE: Ensure the main entrypoint has a structural boundaries
    normalized.forEach(f => {
        if (normalizePath(f.path) === normalizePath(cleanMain)) {
            const hasDoc = f.content.includes('\\documentclass');
            const hasBegin = f.content.includes('\\begin{document}');
            const hasEnd = f.content.includes('\\end{document}');
            
            if (hasDoc) {
                if (!hasBegin) {
                    f.content = `${f.content}\n\\begin{document}\n\\end{document}`;
                } else if (!hasEnd) {
                    f.content = `${f.content}\n\\end{document}`;
                }
            }
        }
    });

    let activeFiles = await optimizeAssets(finalNormalized);

    // SAFETY: Ensure all file content values are strings (disk reads may return Buffers)
    activeFiles.forEach(f => { if (typeof f.content !== 'string') f.content = String(f.content || ''); });
    
    // PATH SYNCHRONIZATION: Update LaTeX references if images were renamed (e.g. .png -> .jpg)
    if (Object.keys(renames).length > 0) {
        activeFiles.forEach(f => {
            const ext = f.path.split('.').pop()?.toLowerCase() || '';
            if (/^(tex|cls|sty|bib)$/i.test(ext)) {
                for (const [oldPath, newPath] of Object.entries(renames)) {
                    const oldBase = oldPath.split('/').pop() || '';
                    const newBase = newPath.split('/').pop() || '';
                    if (oldBase && newBase) {
                        f.content = f.content.split(oldBase).join(newBase);
                        f.content = f.content.split(`{${oldBase.replace(/\.[^.]+$/, '')}}`).join(`{${newBase.replace(/\.[^.]+$/, '')}}`);
                    }
                }
            }
        });
    }

    // PACKAGE RESOLUTION: Strip path prefixes from \usepackage or \RequirePackage
    activeFiles.forEach(f => {
        const ext = f.path.split('.').pop()?.toLowerCase() || '';
        if (/^(tex)$/i.test(ext)) {
            // Apply Master Sieve for phantom artifacts — ONLY on .tex files
            // .cls, .sty, .bib files are template-specific and must not be sanitized
            f.content = applyFinalSanitizationSieve(f.content);

            f.content = f.content.replace(/\\(usepackage|RequirePackage)\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/g, (match, cmd, opts, pkgList) => {
                const cleanedPkgs = pkgList.split(',').map((pkg: string) => {

                    const trimmed = pkg.trim();
                    if (trimmed.includes('/')) {
                        const base = trimmed.split('/').pop() || trimmed;
                        console.log(`[OMEGA] Rewriting package inclusion: ${trimmed} -> ${base}`);
                        return base;
                    }
                    return trimmed;
                }).join(', ');
                
                return `\\${cmd}${opts ? `[${opts}]` : ''}{${cleanedPkgs}}`;
            });
        }
    });

    // ── UNIVERSAL BIBLIOGRAPHY CONFLICT FIX ──────────────────────────────────
    // Many journal classes (elsarticle, nature, IEEEtran, acmart, etc.) load
    // natbib or have built-in citation handling. \usepackage{cite} conflicts
    // with these classes and causes fatal "File ended while scanning \@citex" errors.
    // Strip \usepackage{cite} when the class already provides citation support.
    const NATBIB_CLASSES = new Set([
        'elsarticle', 'nature', 'ieee', 'ieeetran', 'acmart', 'sigconf', 'sigplan', 'sigchi',
        'llncs', 'svproc', 'springer', 'siamart', 'siam', 'amsart', 'amscls',
        'revtex', 'apa', 'apa6', 'apa7', 'bjnp', 'bjnpp', 'rnc', 'chemmacros',
        'chemacs', 'gloss', 'glossaries', 'memoir', 'scrartcl', 'scrreprt', 'scrbook'
    ]);
    activeFiles.forEach(f => {
        const ext = f.path.split('.').pop()?.toLowerCase() || '';
        if (ext !== 'tex') return;
        if (normalizePath(f.path) !== normalizePath(cleanMain)) return;

        const dcMatch = f.content.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);
        if (!dcMatch) return;
        const docClass = dcMatch[1].trim().toLowerCase();

        const isNatbibClass = NATBIB_CLASSES.has(docClass) ||
            /ieee|nature|elsarticle|acmart|llncs|svproc|siam|revtex|apa/.test(docClass);
        const hasNatbibPkg = /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bnatbib\b[^}]*\}/i.test(f.content);

        if (isNatbibClass || hasNatbibPkg) {
            const beforeLen = f.content.length;
            // Strip only the "cite" package from comma-separated lists, not the entire \usepackage line
            f.content = f.content.replace(/\\(usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/gi, (match: string, cmd: string, pkgList: string) => {
                const pkgs = pkgList.split(',').map((p: string) => p.trim()).filter((p: string) => p.toLowerCase() !== 'cite');
                if (pkgs.length === 0) return ''; // All packages removed, drop the entire line
                return `\\${cmd}{${pkgs.join(', ')}}`;
            });
            if (f.content.length !== beforeLen) {
                console.log(`[PIPELINE] Stripped \\usepackage{cite} — document class "${docClass}" has built-in citation support.`);
            }
        }
    });

    // REMOVED ATOMIC FLATTENING: Modern clusters natively handle nested directories
    const pathMap: Record<string, string> = {};
    
    // ── NUCLEAR 29.0: ROBUST PREAMBLE INJECTION ──────────────────────────────
    // Apply zimg and graphics path resolution to all .tex files
    activeFiles = activeFiles.map(f => {
        if (f.path.toLowerCase().endsWith('.tex')) {
            let content = robustPreambleInjector(f.content);
            
            // UNIVERSAL WARNING IGNORE & AUTO-HEALER
            if (!content.includes('\\nonstopmode')) {
                if (content.includes('\\documentclass')) {
                    content = content.replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/, match => `${match}\n\\nonstopmode\n`);
                } else if (normalizePath(f.path) === normalizePath(cleanMain)) {
                    content = `\\nonstopmode\n${content}`;
                }
            }
            
            if (content.includes('\\begin{document}') && !content.includes('\\end{document}')) {
                content += '\n\\end{document}\n';
            }
            
            return { ...f, content };
        }
        return f;
    });

    const finalMain = cleanMain;

    if (useGhostMode) {
        activeFiles.forEach(f => {
            const ext = f.path.split('.').pop()?.toLowerCase() || '';
            if (ext === 'tex') {
                // Safeguard any custom \zimg definitions inside the user's tex files
                f.content = f.content.replace(/\\(newcommand|renewcommand|providecommand)\s*\\?zimg\b[\s\S]*?\{([\s\S]*?)\}/g, (m) => {
                    if (m.includes('\\includegraphics')) {
                        return m.replace(/\\includegraphics/g, '\\csname includegraphics\\endcsname');
                    }
                    return m;
                });
                
                let counter = 0;
                f.content = f.content.replace(/\\includegraphics\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/g, (match, opts, filePathRaw) => {
                    const filePath = filePathRaw.trim();
                    let finalPath = filePath;
                    const normPath = filePath.toLowerCase().replace(/^\.\//, '').replace(/\\/g, '/');
                    
                    const foundFlat = Object.entries(pathMap).find(([old, _flat]) => 
                        old === normPath || 
                        old.endsWith('/' + normPath) || 
                        normPath.endsWith('/' + old) ||
                        old.replace(/\.[^.]+$/, '') === normPath ||
                        old.replace(/\.[^.]+$/, '').endsWith('/' + normPath)
                    );
                    if (foundFlat) {
                        finalPath = foundFlat[1];
                    }

                    if (filePath.startsWith('data:image')) {
                        const vExt = filePath.split(';')[0].split('/')[1] || 'png';
                        const vName = `vasset${counter}${f.path.replace(/[^a-z0-9]/gi, '')}.${vExt}`;
                        activeFiles.push({ path: vName, content: filePath });
                        finalPath = vName;
                    }
                    const originalPath = Object.entries(pathMap).find(([_old, flat]) => flat === finalPath)?.[0] || finalPath;
                    const guid = `tr${f.path.replace(/[^a-z0-9]/gi, '')}${counter++}`;
                    const _B = "\u005c";
                    return `${_B}zimg{${finalPath}}{${(opts || '').replace(/\n/g, ' ')}}{${guid}}{${originalPath}}`;
                });
            }
        });
    }

    const realBinaryCache: Record<string, string> = {};
    activeFiles.forEach(f => {
        if (isBinaryFile(f.path)) {
            realBinaryCache[normalizePath(f.path)] = f.content;
        }
    });

    // Build fullAssets for ghost inking (real binary data before proxy replacement)
    // Preserve original (non-normalized) paths for proper matching in inkGhostPdf
    const fullAssets: FilePayload[] = activeFiles.map(f => {
        const isBinary = isBinaryFile(f.path);
        return {
            path: f.path,
            content: isBinary ? (realBinaryCache[normalizePath(f.path)] || f.content) : f.content
        };
    });

    if (useGhostMode) {
        const normMain = normalizePath(finalMain);

        activeFiles = activeFiles.map(f => {
            const ext = f.path.split('.').pop()?.toLowerCase() || '';
            const isBinary = isBinaryFile(f.path);
            if (normalizePath(f.path) === normMain) return f;
            if (/^(cls|sty|bib|bst|cfg|clo|def|fd|ldf|tex)$/i.test(ext)) return f;
            if (isBinary) {
                if (ext === 'pdf') return { ...f, content: `data:application/pdf;base64,${PROXY_PDF_B64}` };
                if (ext === 'jpg' || ext === 'jpeg') return { ...f, content: `data:image/jpeg;base64,${PROXY_JPG_B64}` };
                return { ...f, content: `data:image/png;base64,${PROXY_IMAGE_B64}` };
            }
            return f;
        });
    }

    // ── PROPRIETARY PACKAGE STUB INJECTOR ───────────────────────────────────
    // Many journal cls files (Wiley USG, Springer, etc.) ship companion .sty
    // files that are NOT in the public TeX Live distribution. We auto-inject
    // minimal stubs so the cloud compilers don't abort on missing files.
    // Add entries here whenever a new proprietary package causes failures.
    const PROPRIETARY_STUBS: Record<string, string> = {
        // soul v3.2 (TeX Live 2026) internally requires lettersp.sty
        'lettersp.sty': [
            '% lettersp.sty stub – Latexify Studio TeX Live 2026 compatibility shim',
            '\\NeedsTeXFormat{LaTeX2e}',
            '\\ProvidesPackage{lettersp}[2024/01/01 v0.1 letterspacing stub]',
            '\\endinput',
        ].join('\n'),

        // Wiley USG.cls companion – loads natbib with Wiley-specific options
        'NJDnatbib.sty': [
            '% NJDnatbib.sty stub – Latexify Studio shim for Wiley USG.cls',
            '\\NeedsTeXFormat{LaTeX2e}',
            '\\ProvidesPackage{NJDnatbib}[2024/01/01 v1.0 Wiley NJDnatbib stub]',
            '\\RequirePackage{natbib}',
            '\\setcitestyle{numbers,sort&compress}',
            '\\endinput',
        ].join('\n'),

        // Wiley NJD shared macros – sometimes required alongside NJDnatbib
        'wileyNJD.sty': [
            '% wileyNJD.sty stub – Latexify Studio shim for Wiley journal classes',
            '\\NeedsTeXFormat{LaTeX2e}',
            '\\ProvidesPackage{wileyNJD}[2024/01/01 v1.0 Wiley NJD stub]',
            '\\endinput',
        ].join('\n'),

        // Springer SN companion helper
        'sn-mathbf-bold.sty': [
            '% sn-mathbf-bold.sty stub – Latexify Studio shim for Springer sn-jnl',
            '\\NeedsTeXFormat{LaTeX2e}',
            '\\ProvidesPackage{sn-mathbf-bold}[2024/01/01 v1.0 stub]',
            '\\endinput',
        ].join('\n'),

        // Frequently missing packages in minimal mirrors
        'lastpage.sty': [
            '% lastpage.sty stub',
            '\\NeedsTeXFormat{LaTeX2e}',
            '\\ProvidesPackage{lastpage}[2024/01/01 v1.0 stub]',
            '\\providecommand{\\lastpage@lastpage}{1}',
            '\\providecommand{\\lastpage@putlabel}{}',
            '\\endinput',
        ].join('\n'),

        // frequently used generic name for user package lists
        'packages.sty': [
            '% packages.sty stub – Latexify Studio compatibility shim',
            '\\NeedsTeXFormat{LaTeX2e}',
            '\\ProvidesPackage{packages}[2024/01/01 v1.0 User Package Stub]',
            '\\endinput',
        ].join('\n'),

        // prevents crash if a template or user file incorrectly does \usepackage{acmart}
        'acmart.sty': [
            '% acmart.sty stub – Latexify Studio safety shim',
            '\\NeedsTeXFormat{LaTeX2e}',
            '\\ProvidesPackage{acmart}[2024/01/01 v1.0 Class Proxy Stub]',
            '\\endinput',
        ].join('\n'),

        'totpages.sty': [
            '% totpages.sty stub',
            '\\NeedsTeXFormat{LaTeX2e}',
            '\\ProvidesPackage{totpages}[2024/01/01 v1.0 stub]',
            '\\providecommand{\\TotPages}{1}',
            '\\endinput',
        ].join('\n'),
    };

    // Scan the payload and inject any missing proprietary stubs
    const stubsToInject: FilePayload[] = [];
    for (const [stubName, stubContent] of Object.entries(PROPRIETARY_STUBS)) {
        if (!activeFiles.some(f => normalizePath(f.path) === stubName)) {
            stubsToInject.push({ path: stubName, content: stubContent });
            console.log(`[PIPELINE] Injected proprietary stub: ${stubName}`);
        }
    }
    const pristineFiles = [...activeFiles];
    for (const [stubName, stubContent] of Object.entries(PROPRIETARY_STUBS)) {
        if (!pristineFiles.some(f => normalizePath(f.path) === stubName)) {
            pristineFiles.push({ path: stubName, content: stubContent });
        }
    }
                    if (stubsToInject.length > 0) {
        activeFiles = [...stubsToInject, ...activeFiles];
    }
    // ────────────────────────────────────────────────────────────────────────
    // UNIVERSAL CITATION RESOLUTION (run BEFORE monolithic collapse so the
    // flattened main file and injected .bib/.bst survive into every strategy)
    {
        const _mainObj = activeFiles.find(f => normalizePath(f.path) === normalizePath(cleanMain));
        const _mainContent = _mainObj?.content || '';
        if (
            (/\\(?:bibliography|addbibresource)\s*\{/.test(_mainContent) ||
                /\\cite[tpsnra]?\s*(?:\[[^\]]*\])?\s*\{/.test(_mainContent)) &&
            !/\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bbiblatex\b[^}]*\}/i.test(_mainContent)
        ) {
            try {
                applyUniversalBibliographyFix(activeFiles, cleanMain);
                console.log('[BIBFIX] Universal bibliography resolution applied.');
            } catch (bibErr) {
                console.warn('[BIBFIX] Universal bibliography fix skipped due to error:', bibErr);
            }
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // NUCLEAR 31.0: MONOLITHIC COLLAPSE FOR ULTRA-LARGE PROJECTS
    const monolithContent = flattenProject(activeFiles, cleanMain);
    const monoFiles: FilePayload[] = activeFiles.map(f => {
        const isBinary = isBinaryFile(f.path);
        if (isBinary) {
            return {
                path: f.path,
                content: realBinaryCache[normalizePath(f.path)] || f.content
            };
        }
        return f;
    }).filter(f => {
        const ext = f.path.split('.').pop()?.toLowerCase() || '';
        if (ext === 'tex') {
            return normalizePath(f.path) === normalizePath(cleanMain);
        }
        return /^(cls|sty|bib|bst|cfg|clo|def|fd|ldf|tikz|lua|png|jpg|jpeg|webp|gif|pdf|eps|svg)$/i.test(ext);
    });
    
    const monoMainIdx = monoFiles.findIndex(f => normalizePath(f.path) === normalizePath(cleanMain));
    if (monoMainIdx !== -1) {
        monoFiles[monoMainIdx].content = monolithContent;
    } else {
        monoFiles.push({ path: cleanMain, content: monolithContent });
    }

    // ── BIBLIOGRAPHY DETECTION (shared across strategies) ─────────────────────
    const mainFileObj = activeFiles.find(f => normalizePath(f.path) === normalizePath(cleanMain));
    const mainContent = mainFileObj?.content || '';
    const hasBibliography = /\\(?:bibliography|addbibresource)\s*\{/.test(mainContent);
    const hasBibStyle = /\\bibliographystyle\s*\{/.test(mainContent);
    const hasCitations = /\\cite[tpsnra]?\s*(?:\[[^\]]*\])?\s*\{/.test(mainContent);
    const bibFiles = activeFiles.filter(f => f.path.toLowerCase().endsWith('.bib'));
    if (hasCitations || hasBibliography) {
        console.log(`[TECTONIC] Bibliography detected: \\bibliography=${hasBibliography}, \\bibliographystyle=${hasBibStyle}, \\cite=${hasCitations}, .bib files=[${bibFiles.map(f => f.path).join(', ')}]`);
    }

    const strategies = [
        {
          name: 'TECTONIC_LOCAL',
          fn: async () => {
            if (!projectId) return { pdfBase64: null, log: 'Tectonic Local: No project ID provided.' };
            const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
            const isWin = process.platform === 'win32';
            const tectonicBin = isWin ? 'tectonic.exe' : 'tectonic';
            const tectonicPath = path.join(process.cwd(), 'bin', tectonicBin);

            if (!fs.existsSync(tectonicPath)) {
                return { pdfBase64: null, log: `Tectonic Local: ${tectonicBin} binary missing.` };
            }

            const os = require('os');
            const crypto = require('crypto');
            const compileTempDir = path.join(os.tmpdir(), `scholarly-compile-${projectId}-${crypto.randomBytes(4).toString('hex')}`);
            if (!fs.existsSync(compileTempDir)) {
                fs.mkdirSync(compileTempDir, { recursive: true });
            }

            // ── Cleanup temporary compilation folder ──────────────────────────
            const cleanupTempDir = () => {
                try {
                    if (fs.existsSync(compileTempDir)) {
                        fs.rmSync(compileTempDir, { recursive: true, force: true });
                        console.log(`[TECTONIC] Cleaned up temporary directory: ${compileTempDir}`);
                    }
                } catch (cleanupErr) {
                    console.warn(`[TECTONIC] Temporary directory cleanup deferred:`, cleanupErr);
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(compileTempDir)) {
                                fs.rmSync(compileTempDir, { recursive: true, force: true });
                            }
                        } catch {}
                    }, 1000);
                }
            };

            activeFiles.forEach(f => { if (typeof f.content !== 'string') f.content = String(f.content || ''); });
            console.log(`[TECTONIC] Writing ${activeFiles.length} files to temp dir: ${activeFiles.map(f => `${f.path}(${typeof f.content === 'string' && f.content.startsWith('data:') ? 'BIN:' + f.content.split(';')[0].split(':')[1] : (typeof f.content === 'string' ? f.content.length : 0) + 'b'})`).join(', ')}`);
            try {
                await Promise.all(activeFiles.map(async (f) => {
                    const isBinary = isBinaryFile(f.path);
                    let newBuffer: Buffer;
                    if (!isBinary) {
                        const text = f.content.startsWith('data:')
                            ? Buffer.from(f.content.split(',')[1] || '', 'base64').toString('utf8')
                            : f.content;
                        newBuffer = Buffer.from(text, 'utf8');
                    } else {
                        const realContent = realBinaryCache?.[normalizePath(f.path)] ?? f.content;
                        const b64Data = realContent.startsWith('data:') ? (realContent.split(',')[1] || '') : realContent;
                        newBuffer = Buffer.from(b64Data, 'base64');
                    }

                    // Write to temporary directory
                    const tempP = path.join(compileTempDir, f.path);
                    if (!fs.existsSync(path.dirname(tempP))) {
                        fs.mkdirSync(path.dirname(tempP), { recursive: true });
                    }
                    fs.writeFileSync(tempP, newBuffer);

                    // Write to physical project uploads dir (catching locks gracefully)
                    try {
                        const fullP = path.join(projectDir, f.path);
                        if (!fs.existsSync(path.dirname(fullP))) {
                            fs.mkdirSync(path.dirname(fullP), { recursive: true });
                        }
                        if (fs.existsSync(fullP)) {
                            const existingBuffer = fs.readFileSync(fullP);
                            if (existingBuffer.equals(newBuffer)) return;
                        }
                        fs.writeFileSync(fullP, newBuffer);
                    } catch (pWriteErr) {
                        console.warn(`[TECTONIC] Non-fatal project dir write warning:`, pWriteErr);
                    }
                }));
            } catch (writeErr: any) {
                cleanupTempDir();
                return { pdfBase64: null, log: `Tectonic Local Pre-compile Error: ${writeErr.message || writeErr}` };
            }

            // Delete stale PDF inside compileTempDir
            const expectedPdfPath = path.join(compileTempDir, cleanMain.replace(/\.tex$/i, '.pdf'));
            try { if (fs.existsSync(expectedPdfPath)) fs.unlinkSync(expectedPdfPath); } catch {}

            // ── Helper: validate and read a PDF file as base64 ────────────────
            const readPdfSafe = async (pdfFilePath: string): Promise<string | null> => {
                for (let attempt = 1; attempt <= 5; attempt++) {
                    try {
                        const stat = fs.statSync(pdfFilePath);
                        if (stat.size > 0) {
                            return fs.readFileSync(pdfFilePath).toString('base64');
                        }
                    } catch {}
                    await new Promise(r => setTimeout(r, 200));
                }
                return null;
            };

            const readSyncTexSafe = async (synctexPath: string): Promise<string | null> => {
                const { gunzipSync } = require('zlib');
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        const stat = fs.statSync(synctexPath);
                        if (stat.size > 0) {
                            return gunzipSync(fs.readFileSync(synctexPath)).toString('utf8');
                        }
                    } catch {}
                    await new Promise(r => setTimeout(r, 200));
                }
                return null;
            };

            // ── Run tectonic ASYNC (non-blocking execFile) ────────────────────
            const { execFile } = require('child_process');
            const { promisify } = require('util');
            const execFileAsync = promisify(execFile);

            const mainRelative = cleanMain.replace(/\\/g, '/');

            console.log(`[TECTONIC] Executing: ${tectonicBin} -Z continue-on-errors --synctex "${mainRelative}" in ${compileTempDir}`);

            let logOutput = '';
            let currentTimeout = 30000; // Start at 30s
            const MAX_TIMEOUT = 300000; // Cap at 5 minutes for massive thesis
            
            let compileResultObj: any = null;
            const maxTries = 3;
            let currentTry = 1;

            while (currentTimeout <= MAX_TIMEOUT && currentTry <= maxTries) {
                try {
                    const { stdout, stderr } = await execFileAsync(
                        tectonicPath,
                        ['-Z', 'continue-on-errors', '--synctex', mainRelative],
                        { cwd: compileTempDir, timeout: currentTimeout }
                    );
                    logOutput = (stdout || '') + (stderr || '');
                    break; // Success!
                } catch (e: any) {
                    logOutput = (e.stdout || '') + (e.stderr || '');
                    
                    // ── NUCLEAR AUTO-HEALER: Dynamic Package Stubbing ──
                    const missingPkgMatch = logOutput.match(/!\s+LaTeX\s+Error:\s+File\s+[`']([^']+\.sty)['`]\s+not\s+found/i);
                    if (missingPkgMatch && currentTry < maxTries) {
                        const missingPkgName = missingPkgMatch[1];
                        console.log(`[TECTONIC] Auto-Healer: Missing package detected: ${missingPkgName}. Generating dynamic stub...`);
                        
                        const stubContent = [
                            `% Auto-generated stub for ${missingPkgName}`,
                            `\\NeedsTeXFormat{LaTeX2e}`,
                            `\\ProvidesPackage{${missingPkgName.replace(/\.sty$/i, '')}}[2024/01/01 v1.0 Auto-Stub]`,
                            `\\endinput`
                        ].join('\n');
                        
                        const stubPath = path.join(compileTempDir, missingPkgName);
                        require('fs').writeFileSync(stubPath, Buffer.from(stubContent, 'utf8'));
                        
                        currentTry++;
                        continue; // Retry compilation with the injected stub
                    }
                    
                    // AUTO-INCREASE TIMEOUT (Interval of 30s)
                    if (e.code === 'ETIMEDOUT' && currentTimeout < MAX_TIMEOUT) {
                        console.warn(`[TECTONIC] Project too large for ${currentTimeout/1000}s, retrying with ${currentTimeout/1000 + 30}s...`);
                        currentTimeout += 30000;
                        continue;
                    }

                    // Not a timeout, or hit max timeout limit
                    if (e.code === 'ETIMEDOUT') {
                        cleanupTempDir();
                        return { pdfBase64: null, log: `Compilation timed out after reaching maximum limit of ${MAX_TIMEOUT/1000}s.\n${logOutput}` };
                    }
                    
                    // Fallback to reading PDF even if process returned non-zero (warnings)
                    const expectedSyncTexPath = expectedPdfPath.replace(/\.pdf$/i, '.synctex.gz');
                    const pdfB64 = await readPdfSafe(expectedPdfPath);
                    const syncTex = pdfB64 ? await readSyncTexSafe(expectedSyncTexPath) : null;
                    
                    const trcPath = path.join(compileTempDir, 'ghost.trc');
                    if (fs.existsSync(trcPath)) {
                        logOutput += '\n' + fs.readFileSync(trcPath, 'utf8');
                    }
                    
                    if (pdfB64) {
                        // Copy compiled PDF and syncTex back to project uploads dir
                        try {
                            const destPdfPath = path.join(projectDir, cleanMain.replace(/\.tex$/i, '.pdf'));
                            if (!fs.existsSync(path.dirname(destPdfPath))) fs.mkdirSync(path.dirname(destPdfPath), { recursive: true });
                            fs.writeFileSync(destPdfPath, Buffer.from(pdfB64, 'base64'));
                            fs.writeFileSync(path.join(projectDir, 'main.pdf'), Buffer.from(pdfB64, 'base64'));
                            
                            if (syncTex) {
                                const { gzipSync } = require('zlib');
                                fs.writeFileSync(destPdfPath.replace(/\.pdf$/i, '.synctex.gz'), gzipSync(Buffer.from(syncTex, 'utf8')));
                            }
                        } catch (cErr) {
                            console.error("[TECTONIC] Non-fatal PDF fallback copy error:", cErr);
                        }

                        compileResultObj = {
                            pdfBase64: pdfB64,
                            pdfUrl: `/api/projects/${projectId}/pdf?t=${Date.now()}`,
                            syncTex,
                            log: `Compilation finished with warnings/errors.\n${logOutput}`,
                        };
                        break;
                    }
                    
                    // Final fallback if no PDF is found after an error
                    cleanupTempDir();
                    return { pdfBase64: null, log: `Tectonic Local Exception: ${e.message || 'Unknown error'}\n${logOutput}` };
                }
            }

            if (compileResultObj) {
                cleanupTempDir();
                return compileResultObj;
            }

            // ── SUCCESS PATH (Reached after break in while loop) ──────────────
            const expectedSyncTexPath = expectedPdfPath.replace(/\.pdf$/i, '.synctex.gz');
            const pdfB64 = await readPdfSafe(expectedPdfPath);
            const syncTex = pdfB64 ? await readSyncTexSafe(expectedSyncTexPath) : null;
            
            const trcPath = path.join(compileTempDir, 'ghost.trc');
            if (fs.existsSync(trcPath)) {
                logOutput += '\n' + fs.readFileSync(trcPath, 'utf8');
            }
            
            if (pdfB64) {
                // Copy compiled PDF and syncTex back to project uploads dir
                try {
                    const destPdfPath = path.join(projectDir, cleanMain.replace(/\.tex$/i, '.pdf'));
                    if (!fs.existsSync(path.dirname(destPdfPath))) fs.mkdirSync(path.dirname(destPdfPath), { recursive: true });
                    fs.writeFileSync(destPdfPath, Buffer.from(pdfB64, 'base64'));
                    fs.writeFileSync(path.join(projectDir, 'main.pdf'), Buffer.from(pdfB64, 'base64'));
                    
                    if (syncTex) {
                        const { gzipSync } = require('zlib');
                        fs.writeFileSync(destPdfPath.replace(/\.pdf$/i, '.synctex.gz'), gzipSync(Buffer.from(syncTex, 'utf8')));
                    }
                } catch (cErr) {
                    console.error("[TECTONIC] Non-fatal PDF success copy error:", cErr);
                }

                // Nuclear Cleanup: Flush residue immediately after success
                await PipelineGC.flushResidue(projectId);
                cleanupTempDir();
                
                return {
                    pdfBase64: pdfB64,
                    pdfUrl: `/api/projects/${projectId}/pdf?t=${Date.now()}`,
                    syncTex,
                    log: `Compilation finished successfully.\n${logOutput}`,
                };
            }

            // 2) Glob fallback — any .pdf tectonic may have written under a different name
            try {
                const anyPdf = fs.readdirSync(compileTempDir).find((f: string) => f.toLowerCase().endsWith('.pdf'));
                if (anyPdf) {
                    const fallbackPath = path.join(compileTempDir, anyPdf);
                    const fallbackB64  = await readPdfSafe(fallbackPath);
                    const fallbackSyncTex = fallbackB64 ? await readSyncTexSafe(fallbackPath.replace(/\.pdf$/i, '.synctex.gz')) : null;
                    if (fallbackB64) {
                        // Copy fallback back to project dir
                        try {
                            const destPdfPath = path.join(projectDir, anyPdf);
                            if (!fs.existsSync(path.dirname(destPdfPath))) fs.mkdirSync(path.dirname(destPdfPath), { recursive: true });
                            fs.writeFileSync(destPdfPath, Buffer.from(fallbackB64, 'base64'));
                            fs.writeFileSync(path.join(projectDir, 'main.pdf'), Buffer.from(fallbackB64, 'base64'));
                        } catch (cErr) {
                            console.error("[TECTONIC] Non-fatal PDF fallback copy error:", cErr);
                        }

                        cleanupTempDir();
                        return {
                            pdfBase64: fallbackB64,
                            pdfUrl: `/api/projects/${projectId}/pdf?t=${Date.now()}`,
                            syncTex: fallbackSyncTex,
                            log: `Compilation finished with warnings/errors (PDF: ${anyPdf}).\n${logOutput}`,
                        };
                    }
                }
            } catch { /* ignore */ }

            return { pdfBase64: null, log: `Tectonic finished but no PDF was found.\n${logOutput}` };
        } },
        { name: 'YTOTECH_MONO_GHOST', fn: () => compileWithYtoTech(engine, monoFiles, cleanMain) },

        { name: 'TEXLIVE_MONO_GHOST', fn: () => compileWithTexLive(monoFiles, cleanMain, engine) },
        { name: 'YTOTECH_PRISTINE', fn: () => compileWithYtoTech(engine, pristineFiles, cleanMain) },
        { name: useGhostMode ? 'YTOTECH_GHOST' : 'YTOTECH_FULL', fn: () => compileWithYtoTech(engine, activeFiles, finalMain) },
        { name: useGhostMode ? 'TEXLIVE_GHOST' : 'TEXLIVE_FULL', fn: () => compileWithTexLive(activeFiles, finalMain, engine) },
        { name: 'LATEXONLINE_MONOLITH', fn: () => compileWithLatexOnline(activeFiles, finalMain) }
    ];

    // ── AUTOMATIC ENGINE SELECTION ──────────────────────────────────────────
    let selectedEngine = engine;
    if (engine === 'auto' || !engine) {
        const mainContent = activeFiles.find(f => normalizePath(f.path) === normalizePath(cleanMain))?.content || "";
        const { detectBestEngine } = require('./compiler-utils');
        selectedEngine = detectBestEngine(mainContent);
        console.log(`[PIPELINE] Auto-Engine detected: ${selectedEngine}`);
    }

    // Helper to persist the final high-fidelity inked PDF to the project upload directory
    const savePdfToDisk = (pdfB64: string | null) => {
        if (!projectId || !pdfB64) return;
        try {
            const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
            if (!fs.existsSync(projectDir)) {
                fs.mkdirSync(projectDir, { recursive: true });
            }
            const mainBase = cleanMain.replace(/\.tex$/i, '.pdf');
            const pdfPath = path.join(projectDir, mainBase);
            fs.writeFileSync(pdfPath, Buffer.from(pdfB64, 'base64'));
            
            // Also write to main.pdf as a secondary fallback for backward compatibility
            if (mainBase !== 'main.pdf') {
                fs.writeFileSync(path.join(projectDir, 'main.pdf'), Buffer.from(pdfB64, 'base64'));
            }
            console.log(`[PIPELINE] Saved compiled inked PDF to disk: ${pdfPath}`);
        } catch (saveDiskErr: any) {
            console.error(`[PIPELINE] Failed to save compiled PDF to disk:`, saveDiskErr);
        }
    };

    // ── PHASE 1: TECTONIC LOCAL (Primary for Scholarly/Modular) ──────────────
    let combinedLog = "";
    try {
        const res = (await strategies[0].fn()) as any;
        if (res.pdfBase64 || res.pdfUrl) {
            let finalPdf = res.pdfBase64;
            // Ghost Inking: composite real images onto the ghost PDF
            if (useGhostMode && finalPdf && fullAssets.length > 0) {
                try {
                    finalPdf = await inkGhostPdf(finalPdf, res.log, fullAssets);
                    console.log(`[PIPELINE] Ghost inking completed: ${fullAssets.length} assets`);
                } catch (inkErr: any) {
                    console.warn(`[PIPELINE] Ghost inking failed (PDF still returned): ${inkErr.message}`);
                }
            }
            if (finalPdf) {
                savePdfToDisk(finalPdf);
            }
            return {
                success: true,
                pdfBase64: finalPdf,
                pdfUrl: `/api/projects/${projectId}/pdf?t=${Date.now()}`,
                log: res.log,
                errors: parseLog(res.log || ""),
                strategy: 'TECTONIC_LOCAL'
            };
        }
        combinedLog += `--- TECTONIC LOCAL FAILED ---\n${res.log}\n`;
    } catch (e: any) { combinedLog += `--- TECTONIC LOCAL ERROR ---\n${e.message}\n`; }

    // ── PHASE 2: REMOTE FALLBACK ─────────────────────────────────────────────
    const remoteBibFiles = monoFiles.filter(f => f.path.toLowerCase().endsWith('.bib'));
    if (hasCitations || hasBibliography) {
        console.log(`[PIPELINE] Remote fallback with bibliography: .bib files=[${remoteBibFiles.map(f => f.path).join(', ')}], main includes \\bibliography=${hasBibliography}`);
    }
    const remoteStrategies = [
        { name: 'YTOTECH', fn: () => compileWithYtoTech(selectedEngine, monoFiles, cleanMain) },
        { name: 'TEXLIVE', fn: () => compileWithTexLive(monoFiles, cleanMain, selectedEngine) }
    ];

    for (const strat of remoteStrategies) {
        try {
            const res = (await strat.fn()) as any;
            if (res.pdfBase64 || res.pdfUrl) {
                let finalPdf = res.pdfBase64;
                // Ghost Inking: composite real images onto the ghost PDF
                if (useGhostMode && finalPdf && fullAssets.length > 0) {
                    try {
                        finalPdf = await inkGhostPdf(finalPdf, res.log, fullAssets);
                        console.log(`[PIPELINE] Ghost inking completed (${strat.name}): ${fullAssets.length} assets`);
                    } catch (inkErr: any) {
                        console.warn(`[PIPELINE] Ghost inking failed (${strat.name}, PDF still returned): ${inkErr.message}`);
                    }
                }
                if (finalPdf) {
                    savePdfToDisk(finalPdf);
                }
                return {
                    success: true,
                    pdfBase64: finalPdf,
                    pdfUrl: `/api/projects/${projectId}/pdf?t=${Date.now()}`,
                    log: res.log,
                    errors: parseLog(res.log || ""),
                    strategy: strat.name
                };
            }
            combinedLog += `--- ${strat.name} FAILED ---\n${res.log}\n`;
        } catch (e: any) { combinedLog += `--- ${strat.name} ERROR ---\n${e.message}\n`; }
    }

    // ── PHASE 3: FINAL RECOMMENDATION ────────────────────────────────────────
    const recommendation = selectedEngine === 'pdflatex' ? 'xelatex' : 'pdflatex';
    return { 
        success: false, 
        pdfBase64: null, 
        log: combinedLog, 
        errors: parseLog(combinedLog), 
        strategy: 'FAIL',
        suggestion: `The current engine (${selectedEngine}) failed. Try switching to ${recommendation} in the project settings.`
    };

  } catch (err: any) { 
    return { success: false, pdfBase64: null, log: `ENGINE_FATAL: ${err.message}`, errors: [], strategy: 'CRASH' }; 
  }
}

// --- SPECIALIZED INDEPENDENT ENGINES ---

export async function runLatexifyCompiler(
  engine: string,
  files: FilePayload[],
  mainFile: string,
  projectId: string | null = null
): Promise<CompileResult> {
    return runHardenedPipeline(engine, files, mainFile, projectId, { profile: 'studio', ghostMode: false });
}

export async function runMigratorCompiler(
  engine: string,
  files: FilePayload[],
  mainFile: string,
  projectId: string | null = null
): Promise<CompileResult> {
    return runHardenedPipeline(engine, files, mainFile, projectId, { profile: 'migrator', ghostMode: true });
}

export async function runDoc2LatexCompiler(
  engine: string,
  files: FilePayload[],
  mainFile: string,
  projectId: string | null = null
): Promise<CompileResult> {
    return runHardenedPipeline(engine, files, mainFile, projectId, { profile: 'doc2latex', ghostMode: true });
}

// --- 1. CORE BRIDGES ---

export async function compileWithYtoTech(engine: string, files: FilePayload[], mainFile: string): Promise<{ pdfBase64: string | null, log: string }> {
  try {
    const normMain = normalizePath(mainFile);
    const resources = files.map(f => {
      const isMain = normalizePath(f.path) === normMain;
      const isBinary = isBinaryFile(f.path);
      const c = f.content;
      
      if (isBinary) {
          const b64 = c.startsWith('data:') ? (c.split(',')[1] || '') : c;
          return { path: f.path, file: b64, main: isMain };
      } else {
          const text = c.startsWith('data:') ? Buffer.from(c.split(',')[1] || '', 'base64').toString('utf8') : c;
          return { path: f.path, content: text, main: isMain };
      }
    });

    const compiler = engine.includes('lua') ? 'lualatex' : engine.includes('xe') ? 'xelatex' : 'pdflatex';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await fetch(YTOTECH_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ compiler, resources, main: mainFile }),
        signal: controller.signal
      });

      const buf = Buffer.from(await res.arrayBuffer());
      if (!res.ok) {
         let errorLog = `UPSTREAM_YTO: ${buf.toString('utf8')}`;
         try {
             const parsed = JSON.parse(buf.toString('utf8'));
             if (parsed.log_files && Object.keys(parsed.log_files).length > 0) {
                 const logContent = Object.values(parsed.log_files)[0];
                 if (logContent) errorLog = String(logContent);
             }
         } catch {}
         return { pdfBase64: null, log: errorLog };
      }
      if (buf.length > 4 && buf.slice(0, 4).toString() === '%PDF') return { pdfBase64: buf.toString('base64'), log: 'YtoTech Success' };
      return { pdfBase64: null, log: 'Malformed YtoTech response' };
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) { return { pdfBase64: null, log: `BRIDGE_FAIL: ${err.message}` }; }
}

export async function compileWithTexLive(files: FilePayload[], mainFile: string, engine: string): Promise<{ pdfBase64: string | null, log: string }> {
  try {
    const fd = new (global as any).FormData();
    const engineParam = engine.includes('lua') ? 'lualatex' : engine.includes('xe') ? 'xelatex' : 'pdflatex';
    fd.append('engine', engineParam);
    fd.append('return', 'pdf');

    const normMain = normalizePath(mainFile);
    const sortedFiles = [...files].sort((a,b) => (normalizePath(a.path) === normMain ? -1 : normalizePath(b.path) === normMain ? 1 : 0));
    
    sortedFiles.forEach(f => {
      const isBinary = isBinaryFile(f.path);
      if (isBinary) return; // SKIP binary files to prevent TexLive form upload corruption
      const c = f.content;
      
      const text = c.startsWith('data:') ? Buffer.from(c.split(',')[1] || '', 'base64').toString('utf8') : c;
      fd.append('filecontents[]', text);
      
      const originalPath = f.path;
      const isMain = normalizePath(originalPath) === normMain;
      let finalName = originalPath;
      if (isMain) {
          finalName = 'document.tex';
      } else if (normalizePath(originalPath) === 'document.tex') {
          finalName = 'original_document.tex';
      }
      fd.append('filename[]', finalName);
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
        const res = await fetchWithRetry(TEXLIVE_MIRRORS, { 
          method: 'POST', 
          body: fd, 
          signal: controller.signal 
        });
        const log = res.headers.get('X-Latex-Log') || 'TexLive: Log unavailable';
        if (!(res.headers.get('content-type') || '').includes('application/pdf')) return { pdfBase64: null, log: await res.text() || log };
        return { pdfBase64: Buffer.from(await res.arrayBuffer()).toString('base64'), log };
    } finally {
        clearTimeout(timer);
    }
  } catch (e: any) { return { pdfBase64: null, log: `BRIDGE_FAIL: ${e.message}` }; }
}

export async function compileWithLatexOnline(files: FilePayload[], mainFile: string): Promise<{ pdfBase64: string | null; log: string }> {
  try {
    const monolith = flattenProject(files, mainFile);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
        const res = await fetchWithRetry(LATEXONLINE_MIRRORS, {
          method: 'POST',
          body: `text=${encodeURIComponent(monolith)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: controller.signal 
        });
        if (res.ok && (res.headers.get('content-type') || '').includes('application/pdf')) {
          return { pdfBase64: Buffer.from(await res.arrayBuffer()).toString('base64'), log: 'LatexOnline Success' };
        }
        return { pdfBase64: null, log: 'LatexOnline failed to produce PDF.' };
    } finally {
        clearTimeout(timer);
    }
  } catch (e: any) { return { pdfBase64: null, log: `LatexOnline Error: ${e.message}` }; }
}

export async function compileInSafeMode(ghostFiles: FilePayload[], mainFile: string, engine: string): Promise<CompileResult> {
  const normMain = normalizePath(mainFile);
  const mainEntry = ghostFiles.find(f => normalizePath(f.path) === normMain);
  let content = mainEntry?.content || '';
  
  // INLINE COMPONENTS: Recursively replace \input and \include with actual content
  const MAX_RECURSION = 5;
  for (let i = 0; i < MAX_RECURSION; i++) {
    const inputRegex = /\\(?:input|include)\{([^}]*)\}/g;
    let found = false;
    content = content.replace(inputRegex, (match, ref) => {
      const normRef = normalizePath(ref);
      const candidates = [normRef, `${normRef}.tex`].map(c => c.replace(/^\.\//,''));
      const component = ghostFiles.find(f => candidates.includes(normalizePath(f.path)));
      if (component) {
        found = true;
        return `\n% --- INLINED: ${ref} ---\n${component.content}\n% --- END INLINE ---\n`;
      }
      return match;
    });
    if (!found) break;
  }

  const hasDocumentClass = content.includes('\\documentclass');
  const hasBeginDocument = content.includes('\\begin{document}');
  const hasEndDocument = content.includes('\\end{document}');

  let tex = content;
  if (hasDocumentClass) {
    if (!hasBeginDocument) {
      tex = `${content}\n\\begin{document}\n\\end{document}`;
    } else if (!hasEndDocument) {
      tex = `${content}\n\\end{document}`;
    }
  } else {
    tex = `\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n\\begin{document}\n${content}\n\\end{document}`;
  }

  // FIX: Bundle .cls/.sty/.bib support files with rescue.tex so custom classes
  // (e.g. USG.cls, sn-jnl.cls) are available during safe-mode compilation.
  const supportFiles: FilePayload[] = ghostFiles.filter(f => {
    const ext = (f.path.split('.').pop() || '').toLowerCase();
    return /^(cls|sty|bib|bst|cfg|clo|def|fd|ldf)$/.test(ext) && f.path !== 'rescue.tex';
  });

  const safePayload: FilePayload[] = [
    { path: 'rescue.tex', content: tex },
    ...supportFiles
  ];

  let res = await compileWithYtoTech(engine, safePayload, 'rescue.tex');
  if (!res.pdfBase64) {
      const tRes = await compileWithTexLive(safePayload, 'rescue.tex', engine);
      if (tRes.pdfBase64) res = tRes;
  }
  return { success: res.pdfBase64 !== null, pdfBase64: res.pdfBase64, log: "SAFE_MODE: " + res.log, errors: parseLog(res.log), strategy: 'SAFE_MODE' };
}

// --- 2. GHOST INKING (100% RELIABILITY) ---

export async function inkGhostPdf(ghostPdfBase64: string, log: string, fullAssets: FilePayload[]): Promise<string> {
    // NUCLEAR 24.0: Robust De-wrapping
    // LaTeX logs wrap at 79 chars. We must re-assemble split @PI@STABLE markers.
    const dewrappedLog = (log || '')
        .split('\n')
        .reduce((acc: string[], line) => {
            const trimmed = line.trim();
            // Stop appending when we see a terminator or start of a new marker
            if (acc.length > 0 && acc[acc.length - 1].includes('@PI@') && !acc[acc.length - 1].includes('EOF@PI')) {
                const cleanLine = trimmed.startsWith('...') ? trimmed.substring(3).trim() : trimmed;
                acc[acc.length - 1] += cleanLine;
            } else {
                acc.push(trimmed);
            }
            return acc;
        }, [])
        .join('\n');

    // NUCLEAR 25.0: GUID-to-Asset Mapping
    // We scan ALL active files for trackers injected by the pipeline
    const guidToPathMap: Record<string, string> = {};
    const zimgRegex = /\\zimg\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/g;
    
    fullAssets.forEach(f => {
        const ext = f.path.split('.').pop()?.toLowerCase() || '';
        if (ext !== 'tex' && ext !== 'sty' && ext !== 'cls') return;
        let m;
        while ((m = zimgRegex.exec(f.content)) !== null) {
            // \zimg{fileId}{opts}{uniqueId}{originalPath}
            const guid = m[3];
            const originalPath = m[4];
            guidToPathMap[guid] = originalPath;
        }
    });

    const lRegex = /@PI@L:([^:]+):(-?\d+):(-?\d+)/g;
    const rRegex = /@PI@R:([^:]+):(-?\d+):(\d+):EOF@PI/g;
    
    const lMap: Record<string, { x: number, y: number }> = {};
    let m;
    while ((m = lRegex.exec(dewrappedLog)) !== null) {
        lMap[m[1]] = { x: parseInt(m[2]), y: parseInt(m[3]) };
    }

    const inclusions: any[] = [];
    while ((m = rRegex.exec(dewrappedLog)) !== null) {
        const guid = m[1];
        const lData = lMap[guid];
        if (!lData) continue;
        
        const x2 = parseInt(m[2]);
        const page = parseInt(m[3]);
        const actualPath = guidToPathMap[guid] || guid;
        
        inclusions.push({ 
            filename: actualPath, 
            x: lData.x, 
            y: lData.y, 
            w: x2 - lData.x, 
            page: page 
        });
    }
    if (inclusions.length === 0) {
        console.warn("[INKER] No markers found in log. Full log size:", dewrappedLog.length);
        if (dewrappedLog.includes('@PI@')) {
            console.warn("[INKER] Markers seen but regex failed. First 200 chars of markers:", dewrappedLog.substring(dewrappedLog.indexOf('@PI@'), dewrappedLog.indexOf('@PI@') + 200));
        }
        return ghostPdfBase64;
    }
    console.log(`[INKER] Processing ${inclusions.length} image placements.`);
    const pdfDoc = await PDFDocument.load(Buffer.from(ghostPdfBase64, 'base64'));
    const pdfPages = pdfDoc.getPages();
    for (const inc of inclusions) {
      const pageIdx = inc.page - 1;
      if (pageIdx < 0 || pageIdx >= pdfPages.length) continue;
      const asset = fullAssets.find(f => {
          const normP = normalizePath(f.path).replace(/\.[^.]+$/, '');
          const normI = normalizePath(inc.filename).replace(/\.[^.]+$/, '');
          return normP === normI || normP.endsWith('/' + normI) || normI.endsWith('/' + normP);
      });
      if (!asset) {
          console.warn(`[INKER] Asset not found for ${inc.filename}. Available asset paths:`, fullAssets.map(a => a.path));
          continue;
      }
      try {
        const b64 = asset.content.split(',')[1] || asset.content;
        const buf = Buffer.from(b64, 'base64');
        const ext = asset.path.toLowerCase().split('.').pop() || '';
        let img;
        
        // RECURSIVE MIME FALLBACK: pdf-lib is strict, but sharp is forgiving
        try {
            if (ext === 'png') img = await pdfDoc.embedPng(buf);
            else if (ext === 'jpg' || ext === 'jpeg') img = await pdfDoc.embedJpg(buf);
            else if (ext === 'pdf') {
                const [ePage] = await pdfDoc.embedPdf(await PDFDocument.load(buf), [0]);
                img = ePage;
            } else throw new Error("Fallback required");
        } catch {
            // Force-Convert to PNG if native embedding fails
            const converted = await sharp(buf).png().toBuffer();
            img = await pdfDoc.embedPng(converted);
        }
        const xPt = inc.x / 65536;
        const yPt = inc.y / 65536;
        const wPt = inc.w / 65536;
        const imgW = img.width;
        const imgH = img.height;
        const hPt = wPt / (imgW / imgH);
        
        const opt = { x: xPt, y: yPt, width: wPt, height: hPt };
        if (ext === 'pdf') pdfPages[pageIdx].drawPage(img as any, opt);
        else pdfPages[pageIdx].drawImage(img as any, opt);
      } catch { }
    }
    return await pdfDoc.saveAsBase64();
}

// --- 3. HARDENED DISCOVERY (Nuclear 21.0 Disk-Native) ---

function walkSync(dir: string, baseDir: string = dir): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkSync(filePath, baseDir));
    } else {
      results.push(path.relative(baseDir, filePath));
    }
  });
  return results;
}

export async function hardenedDiscovery(projectId: string | null, files: FilePayload[], mainFile: string): Promise<FilePayload[]> {
  const sanitized = sanitizeFiles(files).map(f => {
    let c = f.content;
    if (typeof c !== 'string') {
      if (c && typeof c === 'object' && typeof (c as any).value === 'string') {
        c = (c as any).value;
      } else {
        c = String(c ?? '');
      }
    }
    return { ...f, content: c };
  });
  const { files: normalized, mainFile: cleanMain } = prepareStructuredPayload(sanitized, mainFile);
  
  if (!projectId) return normalized;

  // ── UNIVERSAL DB FALLBACK: Restore main.tex from DB if missing/empty ─────
  // This prevents the "\nonstopmode"-only main.tex bug where a previous compile
  // wrote a corrupt main.tex to disk that has no \documentclass or content.
  try {
    const normCleanMain = normalizePath(cleanMain);
    const mainInSession = normalized.find(f => normalizePath(f.path) === normCleanMain);
    const isCorruptNonstopmode = mainInSession && mainInSession.content && 
      (mainInSession.content.trim() === '\\nonstopmode' || 
       mainInSession.content.trim() === '\\nonstopmode\n' || 
       mainInSession.content.trim() === '\\nonstopmode\r\n');
    const mainIsMissingOrEmpty = !mainInSession || 
      !mainInSession.content || 
      mainInSession.content.trim().length === 0 ||
      isCorruptNonstopmode;
    
    if (mainIsMissingOrEmpty && projectId) {
      console.log(`[PIPELINE] main.tex missing or too short (${mainInSession?.content?.length ?? 0} bytes) — attempting DB restore.`);
      const { prisma } = require('@/lib/prisma');
      
      // Try ProjectFile first
      const dbFile = await prisma.projectFile.findFirst({
        where: { projectId, filename: cleanMain }
      }).catch(() => null);
      
      // Fallback to Project.latexContent
      const dbProject = (!dbFile?.content || dbFile.content.trim().length < 50)
        ? await prisma.project.findUnique({ where: { id: projectId }, select: { latexContent: true } }).catch(() => null)
        : null;
      
      const restoredContent = dbFile?.content?.trim().length >= 50 
        ? dbFile.content 
        : dbProject?.latexContent;
      
      if (restoredContent && restoredContent.includes('\\documentclass')) {
        console.log(`[PIPELINE] Restored main.tex from DB (${restoredContent.length} bytes).`);
        if (mainInSession) {
          mainInSession.content = restoredContent;
        } else {
          normalized.push({ path: cleanMain, content: restoredContent });
        }
        // Also write restored content back to disk to prevent repeat failures
        try {
          const diskMainPath = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId, cleanMain);
          fs.mkdirSync(path.dirname(diskMainPath), { recursive: true });
          fs.writeFileSync(diskMainPath, restoredContent, 'utf-8');
          console.log(`[PIPELINE] Wrote restored main.tex to disk: ${diskMainPath}`);
        } catch (diskWriteErr) {
          console.warn('[PIPELINE] Could not write restored main.tex to disk:', diskWriteErr);
        }
      } else {
        console.warn('[PIPELINE] DB restore failed — no valid latexContent found.');
      }
    }
  } catch (dbFallbackErr) {
    console.warn('[PIPELINE] DB fallback for main.tex encountered error:', dbFallbackErr);
  }

  const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);


  // --- UNIVERSAL TEMPLATE CLASS AUTO-PROVISIONING ---
  try {
    const mainFileItem = normalized.find(f => normalizePath(f.path) === normalizePath(cleanMain));
    if (mainFileItem) {
      const docClassMatch = mainFileItem.content.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);
      if (docClassMatch) {
        const docClassName = docClassMatch[1].trim();
        const clsFilename = `${docClassName}.cls`;

        console.log(`[PIPELINE] Detected document class: ${clsFilename}. Scanning templates...`);
        const templatesBaseDir = path.join(process.cwd(), 'src', 'assets', 'templates');
        if (fs.existsSync(templatesBaseDir)) {
          const findFile = (dir: string, targetName: string): string | null => {
            const list = fs.readdirSync(dir);
            for (const item of list) {
              const fullP = path.join(dir, item);
              const stat = fs.statSync(fullP);
              if (stat.isDirectory()) {
                const res = findFile(fullP, targetName);
                if (res) return res;
              } else if (item.toLowerCase() === targetName.toLowerCase()) {
                return fullP;
              }
            }
            return null;
          };

          const matchedClsPath = findFile(templatesBaseDir, clsFilename);
          if (matchedClsPath) {
            const templateFolder = path.dirname(matchedClsPath);
            console.log(`[PIPELINE] Found matching template folder: ${templateFolder}. Copying all missing assets...`);

            if (!fs.existsSync(projectDir)) {
              fs.mkdirSync(projectDir, { recursive: true });
            }

            const filesToCopy = fs.readdirSync(templateFolder);
            const LATEX_EXTS = new Set(['.tex', '.bib', '.bst', '.cls', '.sty', '.ldf', '.cfg', '.clo']);
            
            for (const fileToCopy of filesToCopy) {
              if (fileToCopy.toLowerCase() === 'main.tex') continue;
              const ext = '.' + (fileToCopy.split('.').pop() || '');
              if (!LATEX_EXTS.has(ext.toLowerCase())) continue;

              const srcFile = path.join(templateFolder, fileToCopy);
              const destFile = path.join(projectDir, fileToCopy);

              const inSession = normalized.some(f => normalizePath(f.path) === normalizePath(fileToCopy));
              const onDisk = fs.existsSync(destFile);

              if (!inSession || !onDisk) {
                if (fs.statSync(srcFile).isFile()) {
                  fs.copyFileSync(srcFile, destFile);
                  console.log(`[PIPELINE] Auto-copied: ${fileToCopy} to project directory`);

                  // Sync to the Database
                  try {
                    const { prisma } = require('@/lib/prisma');
                    const fileContent = fs.readFileSync(srcFile, 'utf-8');
                    
                    const existingAux = await prisma.projectFile.findFirst({
                      where: { projectId, filename: fileToCopy }
                    });
                    if (existingAux) {
                      await prisma.projectFile.update({
                        where: { id: existingAux.id },
                        data: { content: fileContent, filePath: `/uploads/projects/${projectId}/${fileToCopy}` }
                      });
                    } else {
                      await prisma.projectFile.create({
                        data: {
                          projectId,
                          filename: fileToCopy,
                          content: fileContent,
                          fileType: fileToCopy.split('.').pop() || 'tex',
                          filePath: `/uploads/projects/${projectId}/${fileToCopy}`
                        }
                      });
                    }
                  } catch (dbErr) {
                    console.warn(`[PIPELINE] Database sync warning for ${fileToCopy}:`, dbErr);
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (provErr) {
    console.error(`[PIPELINE] Error in universal class auto-provisioning:`, provErr);
  }

  if (!fs.existsSync(projectDir)) return normalized;

  const diskFiles = walkSync(projectDir);
  const renames: Record<string, string> = {};
  const caseMap: Record<string, string> = {}; // lowercase -> actual disk/session path

  // 0. SESSION-FIRST SYNC: Map everything from the current editor session
  for (const f of normalized) {
    const p = f.path.replace(/\\/g, '/');
    caseMap[p.toLowerCase()] = p;
    // Also map the filename alone for flat references
    caseMap[path.basename(p).toLowerCase()] = p;
  }

  // 1. DISK-FIRST SYNC: Include everything on disk
  for (const relPath of diskFiles) {
    const fullPath = path.join(projectDir, relPath);
    const ext = path.extname(relPath).toLowerCase();
    const isStructural = /^(tex|cls|sty|bib|bst|cfg|clo|def|fd|ldf|tikz|lua)$/i.test(ext.slice(1));
    const isBinary = /^(png|jpg|jpeg|webp|gif|pdf|eps|otf|ttf|woff|woff2|tfm|pfb|afm|heic|heif|tiff|tif|bmp|avif|svg)$/i.test(ext.slice(1));

    if (!isStructural && !isBinary) continue;

    const existingIdx = normalized.findIndex(f => normalizePath(f.path) === normalizePath(relPath));
    if (existingIdx !== -1) {
        if (isBinary) {
            // Prioritize pristine disk buffer for binary files to fix frontend data URI corruption
            normalized.splice(existingIdx, 1);
        } else {
            // For text/structural files, trust the frontend (unsaved user edits)
            continue;
        }
    }

    const buffer = fs.readFileSync(fullPath);
    let finalPath = relPath.replace(/\\/g, '/');
    const dirName = path.dirname(finalPath);
    
    // Auto-Sanitize spaces in filenames only (keep directory structure)
    if (finalPath.includes(' ')) {
        const sanitizedFilename = path.basename(finalPath).replace(/\s+/g, '_');
        const oldPath = finalPath;
        finalPath = dirName === '.' ? sanitizedFilename : `${dirName}/${sanitizedFilename}`;
        renames[oldPath] = finalPath;
    }

    caseMap[finalPath.toLowerCase()] = finalPath;
    caseMap[relPath.toLowerCase().replace(/\\/g, '/')] = finalPath;

    let contentB64 = '';
    if (isBinary) {
        let mime = 'application/octet-stream';
        if (ext === '.pdf') mime = 'application/pdf';
        else if (ext.match(/\.(png|jpg|jpeg|webp|gif|avif|tiff|tif|bmp|svg|heic|heif)$/i)) {
            const cleanExt = ext.slice(1);
            mime = cleanExt === 'jpg' ? 'image/jpeg' 
                 : cleanExt === 'svg' ? 'image/svg+xml'
                 : cleanExt === 'tif' || cleanExt === 'tiff' ? 'image/tiff'
                 : cleanExt === 'heic' ? 'image/heic'
                 : cleanExt === 'heif' ? 'image/heif'
                 : `image/${cleanExt}`;
        }
        contentB64 = `data:${mime};base64,${buffer.toString('base64')}`;
    }

    normalized.push({
      path: finalPath,
      content: isBinary ? contentB64 : buffer.toString('utf8'),
    });
  }

  // 2. UNIVERSAL CASE-INSENSITIVE MAPPING & SANITIZATION
  // We scan ALL text files and correct any mismatched pointers
  normalized.forEach(f => {
      const fExt = path.extname(f.path).toLowerCase();
      if (!/^(tex|cls|sty|bib)$/i.test(fExt.slice(1))) return;

      let content = f.content;

      // a) Apply specific renames (for spaces)
      for (const [oldPath, newPath] of Object.entries(renames)) {
          content = content.split(oldPath).join(newPath);
          const oldBase = path.basename(oldPath, path.extname(oldPath));
          const newBase = path.basename(newPath, path.extname(newPath));
          content = content.split(oldBase).join(newBase);
      }

      // b) Case-Insensitive Logic: Match references to disk files
      const refRegex = /\\(documentclass|includegraphics|zimg|addbibresource|bibliography|include|input|import|usepackage)(?:\s*\[.*?\])?\s*\{([^}]*)\}/gi;
      content = content.replace(refRegex, (match, cmd, refPath) => {
          const normRef = refPath.replace(/\\/g, '/').toLowerCase();
          // Try exact match, then with extensions
          const candidates = [
            normRef, 
            `${normRef}.png`, `${normRef}.jpg`, `${normRef}.jpeg`, `${normRef}.pdf`, 
            `${normRef}.tex`, `${normRef}.sty`, `${normRef}.cls`, `${normRef}.bib`, 
            `${normRef}.bst`, `${normRef}.cfg`, `${normRef}.clo`, `${normRef}.def`, 
            `${normRef}.fd`, `${normRef}.ldf`, `${normRef}.tikz`
          ];
          for (const cand of candidates) {
              if (caseMap[cand]) {
                  let newPath = caseMap[cand];
                  
                  // STRIP EXTENSION for commands that prohibit it in LaTeX
                  if (['usepackage', 'documentclass', 'bibliography', 'include'].includes(cmd.toLowerCase())) {
                      const lastDot = newPath.lastIndexOf('.');
                      if (lastDot !== -1) {
                          newPath = newPath.substring(0, lastDot);
                      }
                  }
                  
                  if (newPath !== refPath) {
                      console.log(`[PIPELINE] Remapping: ${refPath} -> ${newPath}`);
                      return match.replace(refPath, newPath);
                  }
                  return match;
              }
              // Also try without directory prefix if user referenced a flat name
              const flatRef = path.basename(cand, path.extname(cand)).toLowerCase();
              const matchedFlat = Object.keys(caseMap).find(k => {
                  const kBase = path.basename(k, path.extname(k)).toLowerCase();
                  return kBase === flatRef;
              });
              
              if (matchedFlat) {
                  let newPath = caseMap[matchedFlat];
                  
                  // STRIP EXTENSION for commands that prohibit it in LaTeX
                  if (['usepackage', 'documentclass', 'bibliography', 'include'].includes(cmd.toLowerCase())) {
                      const lastDot = newPath.lastIndexOf('.');
                      if (lastDot !== -1) {
                          newPath = newPath.substring(0, lastDot);
                      }
                  }
                  
                  if (newPath !== refPath) {
                      console.log(`[PIPELINE] Flat-Remapping: ${refPath} -> ${newPath}`);
                      return match.replace(refPath, newPath);
                  }
                  return match;
              }
          }
          return match;
      });

      f.content = content;
  });

  return normalized;
}

// --- 4. PERSISTENCE ---

export async function persistPdf(projectId: string | null, pdfBase64: string | null, filename: string = 'output.pdf'): Promise<string | null> {
  if (!projectId || !pdfBase64) return null;
  const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
  if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });
  const pdfPath = path.join(projectDir, filename);
  fs.writeFileSync(pdfPath, Buffer.from(pdfBase64, 'base64'));
  return `/api/projects/${projectId}/pdf?t=${Date.now()}`;
}

/** 
 * ALIAS FOR COMPATIBILITY (Hoisted safely)
 */
export const nuclearCompile = runHardenedPipeline;
