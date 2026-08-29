/**
 * Client-side DOCX extraction (browser-only).
 *
 * The heavy DOCX pipeline (AdmZip + JSDOM + OMML math + charts + sharp + EMF
 * conversion) previously ran on the server inside the upload request/worker,
 * which made uploads slow, memory-heavy and killed on request limits. This
 * module moves the cheap part (text + figures) into the BROWSER using
 * mammoth's browser build:
 *
 *   - HTML (with figure <img> tags renamed to stable `rf_fig_N.ext` names)
 *   - plain text (analysis evidence) + the trailing references block
 *   - figure list with same names as the HTML references (base64 data URLs,
 *     held client-side only — never uploaded as part of the text envelope)
 *
 * The server receives ONLY the text envelope (HTML + text + figure manifest =
 * name/contentType per figure) inside the upload POST. The document bytes and
 * figure data stay on this device; figures are attached as multipart when the
 * user picks a template (Phase 2 generate-latex). The manifest names keep the
 * server-side report, AI analysis and LaTeX assembly consistent with the
 * local figure set.
 *
 * FALLBACK IMAGE EXTRACTION: mammoth's convertImage only handles <a:blip>
 * (DrawingML) images. Real-world DOCX files frequently contain images via:
 *   - VML <v:imagedata> (compatibility mode / Word 2003 era)
 *   - OOXML chart objects (<c:chart>) with raster fallbacks
 *   - mc:AlternateContent fallback blocks
 *   - Images inside <w:object> / <w:pict> wrappers
 * A secondary JSZip pass scans the DOCX ZIP to find these missed images and
 * injects <img> tags into the HTML output so the server-side pipeline
 * (DeepDocumentParser → AI analysis → LaTeX assembly) can use them.
 */

import mammoth from 'mammoth';
import JSZip from 'jszip';

export interface ClientFigure {
  name: string;
  contentType: string;
  dataUrl: string;
}

export interface ClientDocxEnvelope {
  fileName: string;
  html: string;
  text: string;
  referencesText: string;
  figures: ClientFigure[];
  warnings: string[];
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function extFromContentType(ct: string): string {
  const lc = (ct || '').toLowerCase();
  if (lc.includes('jpeg') || lc.includes('jpg')) return 'jpg';
  if (lc.includes('gif')) return 'gif';
  if (lc.includes('bmp')) return 'bmp';
  if (lc.includes('tiff') || lc.includes('tif')) return 'tiff';
  return 'png';
}

function extFromFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return 'png';
  return name.substring(dot + 1).toLowerCase();
}

function contentTypeFromExt(ext: string): string {
  switch (ext) {
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    case 'tiff': case 'tif': return 'image/tiff';
    case 'png': default: return 'image/png';
  }
}

/**
 * Splits the references/bibliography block off the tail of the document text
 * (the AI structure pass needs the full text for reference counting; the
 * separate block is used as the references evidence).
 */
export function splitReferencesText(
  text: string,
): { mainText: string; referencesText: string } {
  const lines = text.split('\n');
  let refStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^(?:[\d\.]+\s*)?(?:references?|bibliography|works cited|literature cited)\s*[:.\-]?$/i.test(t) && t.length < 60) {
      refStart = i;
      break;
    }
  }
  if (refStart === -1) return { mainText: text, referencesText: '' };
  return {
    mainText: lines.slice(0, refStart).join('\n'),
    referencesText: lines.slice(refStart).join('\n'),
  };
}

/**
 * Fallback image extraction using JSZip.
 *
 * mammoth only handles <a:blip> (DrawingML) images. This pass scans the
 * DOCX XML directly to find VML images (<v:imagedata>), OOXML chart raster
 * fallbacks, and images inside mc:AlternateContent blocks that mammoth
 * silently drops.
 *
 * Returns the additional figures found and an updated HTML string with <img>
 * tags injected at the end of the document body.
 */
async function fallbackZipImageExtraction(
  arrayBuffer: ArrayBuffer,
  html: string,
  figures: ClientFigure[],
  figIdx: number,
  warnings: string[],
): Promise<{ html: string; figures: ClientFigure[]; figIdx: number; warnings: string[] }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch (err) {
    console.warn('[DOCX-EXTRACT] JSZip: failed to open DOCX as ZIP:', err);
    return { html, figures, figIdx, warnings };
  }

  // 1. Build relationship map: rId -> target relative path (e.g. "media/image1.png")
  const relsMap = new Map<string, string>();
  const relsEntry = zip.file('word/_rels/document.xml.rels');
  if (relsEntry) {
    try {
      const relsXml = await relsEntry.async('text');
      const relRegex = /Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = relRegex.exec(relsXml))) {
        relsMap.set(m[1], m[2]);
      }
    } catch { /* non-critical */ }
  }

  if (relsMap.size === 0) {
    console.warn('[DOCX-EXTRACT] JSZip: no document.xml.rels found or 0 relationships');
    return { html, figures, figIdx, warnings };
  }

  // 2. Parse document.xml to find ALL image reference rIds
  const docEntry = zip.file('word/document.xml');
  if (!docEntry) {
    console.warn('[DOCX-EXTRACT] JSZip: no word/document.xml found');
    return { html, figures, figIdx, warnings };
  }

  let docXml: string;
  try {
    docXml = await docEntry.async('text');
  } catch {
    return { html, figures, figIdx, warnings };
  }

  // Collect every rId referenced by image-bearing elements.
  // We look for: a:blip r:embed, v:imagedata r:id, v:shape filled image,
  // c:chart r:id, o:OLEObject r:id, and any generic r:embed / r:id on
  // drawing-related elements.
  const referencedRIds = new Set<string>();

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(docXml, 'application/xml');

    // DrawingML blip images (mammoth handles these, but we track for dedup)
    doc.querySelectorAll('a\\:blip, blip').forEach(el => {
      const rid = el.getAttribute('r:embed') || el.getAttribute('embed');
      if (rid) referencedRIds.add(rid);
    });

    // VML imagedata
    doc.querySelectorAll('v\\:imagedata, imagedata').forEach(el => {
      const rid = el.getAttribute('r:id') || el.getAttribute('id');
      if (rid) referencedRIds.add(rid);
    });

    // VML shape with fill type="frame" or "pattern" referencing an image
    doc.querySelectorAll('v\\:fill, fill').forEach(el => {
      const rid = el.getAttribute('r:id') || el.getAttribute('id');
      if (rid) referencedRIds.add(rid);
    });

    // OLE objects
    doc.querySelectorAll('o\\:OLEObject, OLEObject').forEach(el => {
      const rid = el.getAttribute('r:id') || el.getAttribute('id');
      if (rid) referencedRIds.add(rid);
    });

    // w:object / w:pict wrappers may have r:id directly
    doc.querySelectorAll('object').forEach(el => {
      const rid = el.getAttribute('r:id') || el.getAttribute('id');
      if (rid && relsMap.has(rid)) referencedRIds.add(rid);
    });

    // Any element with r:embed that points to a media file
    doc.querySelectorAll('[r\\:embed]').forEach(el => {
      const rid = el.getAttribute('r:embed');
      if (rid && relsMap.has(rid)) referencedRIds.add(rid);
    });
  } catch {
    // DOMParser failed — fall through to regex-based extraction
  }

  // Regex fallback if DOMParser produced nothing (some browsers / malformed XML)
  if (referencedRIds.size === 0) {
    const ridRegex = /(?:r:embed|r:id|embed|id)=["']([^"']*rId\d+[^"']*)/gi;
    let rm: RegExpExecArray | null;
    while ((rm = ridRegex.exec(docXml))) {
      const rid = rm[1].trim();
      if (/^rId\d+$/i.test(rid) || relsMap.has(rid)) {
        referencedRIds.add(rid);
      }
    }
  }

  console.log(`[DOCX-EXTRACT] JSZip: ${relsMap.size} relationships, ${referencedRIds.size} image-bearing rIds found in document.xml`);
  if (referencedRIds.size > 0) {
    const ridTargets = [...referencedRIds].map(r => `${r} -> ${relsMap.get(r) || '?'}`);
    console.log(`[DOCX-EXTRACT] JSZip: rId targets:`, ridTargets.join(', '));
  }

  // Scan word/media/ to see what's actually in the ZIP
  const mediaFiles: string[] = [];
  zip.folder('word/media')?.forEach((relativePath) => {
    mediaFiles.push(relativePath);
  });
  console.log(`[DOCX-EXTRACT] JSZip: ${mediaFiles.length} files in word/media/: ${mediaFiles.slice(0, 10).join(', ')}${mediaFiles.length > 10 ? '...' : ''}`);

  // 3. Build a set of image paths already captured by mammoth
  //    (mammoth replaces <img> src with the rId's target path)
  const alreadyCaptured = new Set<string>();
  for (const fig of figures) {
    alreadyCaptured.add(fig.name);
  }

  // Also scan HTML for any src attributes that reference media files
  const srcRegex = /src="([^"]*media\/[^"]+)"/gi;
  let srcMatch: RegExpExecArray | null;
  while ((srcMatch = srcRegex.exec(html))) {
    const srcPath = srcMatch[1].replace(/^.*?word\//, 'word/');
    alreadyCaptured.add(srcPath);
  }

  // Also check for <img src="rf_fig_"> tags in the HTML
  const rfFigRegex = /src="(rf_fig_\d+\.[^"]+)"/gi;
  let rfMatch: RegExpExecArray | null;
  while ((rfMatch = rfFigRegex.exec(html))) {
    alreadyCaptured.add(rfMatch[1]);
  }

  console.log(`[DOCX-EXTRACT] JSZip: mammoth already captured ${alreadyCaptured.size} image(s): ${[...alreadyCaptured].join(', ')}`);

  // 4. For each referenced rId, check if the target is an image we missed
  const IMAGE_EXTS = /\.(png|jpe?g|gif|bmp|tiff?|emf|wmf|svg)$/i;
  const newFigures: ClientFigure[] = [];
  const newImgTags: string[] = [];

  for (const rid of referencedRIds) {
    const target = relsMap.get(rid);
    if (!target) continue;
    if (!IMAGE_EXTS.test(target)) continue;

    // Skip if already captured by mammoth
    const basename = target.replace(/^.*\//, '');
    if (alreadyCaptured.has(basename)) continue;
    // Also check full path
    if (alreadyCaptured.has(target)) continue;

    const zipPath = target.startsWith('word/') ? target : `word/${target}`;
    const entry = zip.file(zipPath);
    if (!entry) continue;

    try {
      const rawBytes = await entry.async('uint8array');
      if (rawBytes.length < 100) continue; // Skip tiny placeholders

      const ext = extFromFilename(target);
      // Skip EMF/WMF — they cannot be displayed as raster images
      if (ext === 'emf' || ext === 'wmf') {
        warnings.push(`Skipped vector image ${basename} (EMF/WMF not displayable in browser)`);
        continue;
      }

      const ct = contentTypeFromExt(ext);
      const name = `rf_fig_${figIdx++}.${ext}`;
      const dataUrl = `data:${ct};base64,${bytesToBase64(rawBytes)}`;
      newFigures.push({ name, contentType: ct, dataUrl });

      // Inject an <img> tag so DeepDocumentParser can pick it up
      newImgTags.push(`<img src="${name}" alt="${basename}" />`);
    } catch {
      warnings.push(`Failed to extract fallback image ${basename}`);
    }
  }

  // 5. Merge new figures and inject <img> tags into the HTML
  figures.push(...newFigures);

  console.log(`[DOCX-EXTRACT] JSZip fallback: extracted ${newFigures.length} additional figure(s) from ZIP (${warnings.filter(w => w.startsWith('Failed')).length} failed, ${warnings.filter(w => w.startsWith('Skipped')).length} skipped EMF/WMF)`);

  if (newImgTags.length > 0) {
    // Inject before closing </body> or at end of HTML
    const bodyClose = html.lastIndexOf('</body>');
    const injectPoint = bodyClose !== -1 ? bodyClose : html.length;
    html = html.substring(0, injectPoint) +
      `\n<!-- fallback-extracted figures -->\n${newImgTags.join('\n')}\n` +
      html.substring(injectPoint);
  }

  return { html, figures, figIdx, warnings };
}

/**
 * Extracts the text envelope from a DOCX in the browser.
 * The figures are renamed in the HTML to `rf_fig_N.ext` and collected into
 * `figures` with the same names — the manifest keeps server and client in
 * sync without transferring any binary data during upload.
 */
export async function extractClientDocx(file: File): Promise<ClientDocxEnvelope> {
  const arrayBuffer = await file.arrayBuffer();
  const figures: ClientFigure[] = [];
  const warnings: string[] = [];
  let figIdx = 1;

  let processedArrayBuffer = arrayBuffer;
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docEntry = zip.file('word/document.xml');
    if (docEntry) {
      let docXml = await docEntry.async('text');
      if (docXml.includes('AlternateContent')) {
        docXml = docXml.replace(/<mc:AlternateContent[\s\S]*?<mc:Fallback>([\s\S]*?)<\/mc:Fallback>[\s\S]*?<\/mc:AlternateContent>/gi, '$1');
        docXml = docXml.replace(/<AlternateContent[\s\S]*?<Fallback>([\s\S]*?)<\/Fallback>[\s\S]*?<\/AlternateContent>/gi, '$1');
        zip.file('word/document.xml', docXml);
        processedArrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
      }
    }
  } catch {
    /* non-critical, proceed with original buffer */
  }

  const result = await mammoth.convertToHtml(
    { arrayBuffer: processedArrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const contentType = String(image.contentType || 'image/png');
        const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('gif') ? 'gif' : 'png';
        const name = `rf_fig_${figIdx++}.${ext}`;
        try {
          const imageBuffer: Uint8Array = await image.read();
          figures.push({ name, contentType, dataUrl: `data:${contentType};base64,${bytesToBase64(imageBuffer)}` });
        } catch (err) {
          warnings.push(`Skipped unreadable image "${name}"`);
        }
        return { src: name, alt: (image as any).altText ? String((image as any).altText) : '' };
      }),
    },
  );

  let html = result.value || '';

  // FALLBACK: JSZip-based extraction for VML/chart/AlternateContent images
  // that mammoth silently drops. This mirrors the server-side heavy path
  // (JSDOM + AdmZip chart/VML extraction) but runs entirely in the browser.
  const zipResult = await fallbackZipImageExtraction(
    arrayBuffer, html, figures, figIdx, warnings,
  );
  html = zipResult.html;
  figures.length = 0;
  figures.push(...zipResult.figures);
  figIdx = zipResult.figIdx;
  warnings.push(...zipResult.warnings);

  let text = stripTags(html);
  try {
    const raw = await mammoth.extractRawText({ arrayBuffer });
    if (raw && raw.value && raw.value.trim().length > text.trim().length) {
      text = raw.value;
    }
  } catch {
    /* keep the html-derived text */
  }

  if (!html && !text.trim()) {
    throw new Error('No readable content found in this document. It may be corrupted or password-protected.');
  }

  // Deduplicate figure names (mammoth can revisit the same relationship).
  const seen = new Set<string>();
  const deduped: ClientFigure[] = [];
  for (const fig of figures) {
    if (seen.has(fig.name)) continue;
    seen.add(fig.name);
    deduped.push(fig);
  }

  const { mainText, referencesText } = splitReferencesText(text);

  return {
    fileName: file.name,
    html,
    text: `${mainText}${referencesText ? `\n\n${referencesText}` : ''}`.trim(),
    referencesText,
    figures: deduped,
    warnings,
  };
}