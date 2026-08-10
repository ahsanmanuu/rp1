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
 */

import mammoth from 'mammoth';

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

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
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

  const html = result.value || '';
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