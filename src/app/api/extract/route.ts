import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import AdmZip from "adm-zip";
import { JSDOM } from "jsdom";
import { buildExtractionPrompt, chunkText } from "@/lib/reviewer-utils";
import { resolve } from "path";

import { getServerSession } from "@/lib/auth-pb";
// ════════════════════════════════════════════════════════════════════════════
//  UNIVERSAL DOCUMENT TEXT EXTRACTION
//  Supported: PDF, DOCX, DOC, TXT, TEX, MD, RTF, ODT, ODS, ODP, ODG, HTML
// ════════════════════════════════════════════════════════════════════════════

/** PDF – Layer 1: pdf-parse (fast, handles most text-embedded PDFs) */
async function extractPdfPdfParse(buffer: Buffer): Promise<string> {
  const mod = (await import("pdf-parse")) as any;
  const PDFParseCtor = mod.PDFParse ?? mod.default?.PDFParse;
  if (!PDFParseCtor) throw new Error("pdf-parse: PDFParse class not found");
  const parser = new PDFParseCtor({ data: buffer });
  const result = await parser.getText();
  return (result.text || "").trim();
}

/** PDF – Layer 2: pdfjs-dist (handles complex/multi-column/non-standard PDFs) */
async function extractPdfPdfJs(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "";
  // @ts-ignore
  pdfjs.GlobalWorkerOptions.workerPort = null;

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }
  return fullText.trim();
}

/** DOCX – mammoth extracts clean running text from Word XML */
async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || "").trim();
}

/**
 * DOC (legacy binary Word format) – mammoth also handles .doc files
 * If mammoth fails, fall back to raw byte extraction of printable chars
 */
async function extractDoc(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || "").trim();
    if (text.length > 50) return text;
  } catch (e: any) {
    console.warn("[EXTRACT] mammoth DOC failed:", e.message);
  }
  // Fallback: extract printable ASCII sequences from binary blob
  const raw = buffer
    .toString("binary")
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\s{4,}/g, "\n")
    .trim();
  return raw;
}

/**
 * ODT / ODS / ODP / ODG (OpenDocument formats) – all are ZIP archives
 * containing a content.xml file with the document text.
 */
async function extractOpenDocument(buffer: Buffer): Promise<string> {
  const zip = new AdmZip(buffer);
  const contentEntry = zip.getEntry("content.xml");
  if (!contentEntry) {
    throw new Error("OpenDocument file has no content.xml — may be corrupt.");
  }
  const xmlStr = contentEntry.getData().toString("utf-8");
  // Parse XML and extract all text nodes, stripping tags
  const dom = new JSDOM(xmlStr, { contentType: "text/xml" });
  const body = dom.window.document;
  // text:p and text:h elements contain the actual content
  const nodes = body.querySelectorAll("text\\:p, text\\:h, text\\:span");
  let text = "";
  if (nodes.length > 0) {
    nodes.forEach((node) => {
      const t = node.textContent || "";
      if (t.trim()) text += t.trim() + "\n";
    });
  } else {
    // Fallback: strip all XML tags
    text = xmlStr
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s{3,}/g, "\n")
      .trim();
  }
  return text;
}

/** RTF – strip RTF control codes to extract plain text */
async function extractRtf(buffer: Buffer): Promise<string> {
  const raw = buffer.toString("utf-8");
  // Remove RTF control words, groups, and special chars
  const text = raw
    .replace(/\\[a-z]+[-\d]* ?/gi, " ") // control words
    .replace(/\{[^{}]*\}/g, " ")          // groups
    .replace(/\\[{}\\]/g, " ")            // escaped chars
    .replace(/[^\x20-\x7E\n\r\t]/g, " ") // non-printable
    .replace(/\s{3,}/g, "\n")
    .trim();
  return text;
}

/** HTML / HTM – extract text content using JSDOM */
async function extractHtml(buffer: Buffer): Promise<string> {
  const html = buffer.toString("utf-8");
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  return (body?.textContent || "").replace(/\s{3,}/g, "\n").trim();
}

/**
 * MASTER ROUTER — detects format by extension AND by magic bytes,
 * tries all applicable layers in order, throws only if all fail.
 */
async function extractTextFromFile(
  file: File,
  buffer: Buffer
): Promise<string> {
  const name = file.name.toLowerCase();
  const magic = buffer.slice(0, 8).toString("hex");

  // ── PDF ────────────────────────────────────────────────────────────────────
  if (name.endsWith(".pdf") || magic.startsWith("25504446")) {
    console.log("[EXTRACT] PDF detected — trying pdf-parse (Layer 1)...");
    try {
      const text = await extractPdfPdfParse(buffer);
      if (text.length > 80) {
        console.log("[EXTRACT] pdf-parse OK, length:", text.length);
        return text;
      }
      console.warn("[EXTRACT] pdf-parse returned < 80 chars, trying pdfjs...");
    } catch (e: any) {
      console.warn("[EXTRACT] pdf-parse failed:", e.message);
    }

    console.log("[EXTRACT] PDF Layer 2: pdfjs-dist...");
    try {
      const text = await extractPdfPdfJs(buffer);
      if (text.length > 80) {
        console.log("[EXTRACT] pdfjs-dist OK, length:", text.length);
        return text;
      }
      console.warn("[EXTRACT] pdfjs-dist returned < 80 chars.");
    } catch (e: any) {
      console.warn("[EXTRACT] pdfjs-dist failed:", e.message);
    }

    throw new Error(
      "PDF could not be parsed — it may be a scanned/image-only PDF with no embedded text."
    );
  }

  // ── DOCX (Word XML — ZIP with word/document.xml) ─────────────────────────
  if (name.endsWith(".docx")) {
    console.log("[EXTRACT] DOCX detected — mammoth...");
    const text = await extractDocx(buffer);
    if (text.length > 0) return text;
    throw new Error("DOCX extraction produced no text.");
  }

  // ── DOC (legacy binary Word format) ──────────────────────────────────────
  if (name.endsWith(".doc")) {
    console.log("[EXTRACT] DOC detected — mammoth + fallback...");
    const text = await extractDoc(buffer);
    if (text.length > 10) return text;
    throw new Error("DOC extraction produced no readable text.");
  }

  // ── OpenDocument formats (ODT, ODS, ODP, ODG) ─────────────────────────────
  if (
    name.endsWith(".odt") ||
    name.endsWith(".ods") ||
    name.endsWith(".odp") ||
    name.endsWith(".odg") ||
    name.endsWith(".odf")
  ) {
    console.log("[EXTRACT] OpenDocument format detected — ZIP/XML parser...");
    const text = await extractOpenDocument(buffer);
    if (text.length > 10) return text;
    throw new Error("OpenDocument extraction produced no text.");
  }

  // ── RTF ────────────────────────────────────────────────────────────────────
  if (name.endsWith(".rtf")) {
    console.log("[EXTRACT] RTF detected...");
    const text = await extractRtf(buffer);
    if (text.length > 10) return text;
    throw new Error("RTF extraction produced no text.");
  }

  // ── HTML / HTM ─────────────────────────────────────────────────────────────
  if (name.endsWith(".html") || name.endsWith(".htm")) {
    console.log("[EXTRACT] HTML detected...");
    return await extractHtml(buffer);
  }

  // ── Plain text: TXT, TEX, MD, CSV, JSON, LaTeX, etc. ─────────────────────
  if (
    name.endsWith(".txt") ||
    name.endsWith(".tex") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".json") ||
    name.endsWith(".bib")
  ) {
    console.log("[EXTRACT] Plain text format — UTF-8 decode...");
    return buffer.toString("utf-8");
  }

  // ── Unknown extension: try UTF-8 then printable-char extraction ────────────
  console.warn("[EXTRACT] Unknown extension for:", file.name, "— raw decode");
  const raw = buffer.toString("utf-8");
  const printable = raw
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\s{4,}/g, "\n")
    .trim();
  if (printable.length > 50) return printable;
  throw new Error(
    `Unsupported file format: "${file.name}". Supported formats: PDF, DOCX, DOC, TXT, TEX, ODT, ODS, ODP, RTF, HTML.`
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  AI CALLER — routed through master agent gateway
// ════════════════════════════════════════════════════════════════════════════

import { routeToAgent } from '@/lib/agent-gateway';
import { getClientGeoInfo } from '@/lib/clientGeo';

async function callClodAI(prompt: string, userId: string | null, req: NextRequest, timeoutMs = 60000): Promise<string> {
  const geo = req ? await getClientGeoInfo(req) : { ipAddress: null, location: null, country: null };
  const result = await Promise.race([
    routeToAgent({
      agent: 'extract',
      messages: [{ role: 'user', content: prompt }],
      context: {
        text: prompt, userId,
        userEmail: undefined,
        ipAddress: geo.ipAddress || undefined,
        location: geo.location || undefined,
        country: geo.country || undefined,
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI extraction timed out')), timeoutMs)
    ),
  ]);
  if (!result.success) throw new Error(result.error || 'AI extraction failed');
  return JSON.stringify(result.data);
}

// ════════════════════════════════════════════════════════════════════════════
//  DETERMINISTIC STAT COUNTERS (pure regex, zero biased floor values)
// ════════════════════════════════════════════════════════════════════════════

function computeStats(text: string) {
  // Check if the text contains explicit stats markers at line starts (case-insensitive with colon/equals separator)
  const wordsMatch = text.match(/^[ \t]*WORDS\b\s*[:=]\s*([\d,]+)/im);
  const charsMatch = text.match(/^[ \t]*CHARACTERS\b\s*[:=]\s*([\d,]+)/im);
  const figsMatch = text.match(/^[ \t]*FIGURES\b\s*[:=]\s*([\d,]+)/im);
  const chartsMatch = text.match(/^[ \t]*CHARTS\b\s*[:=]\s*([\d,]+)/im);
  const tablesMatch = text.match(/^[ \t]*TABLES\b\s*[:=]\s*([\d,]+)/im);
  const eqMatch = text.match(/^[ \t]*EQUATIONS\b\s*[:=]\s*([\d,]+)/im);
  const algoMatch = text.match(/^[ \t]*ALGORITHMS\b\s*[:=]\s*([\d,]+)/im);
  const citMatch = text.match(/^[ \t]*CITATIONS\b\s*[:=]\s*([\d,]+)/im);
  const refMatch = text.match(/^[ \t]*REFERENCES\b\s*[:=]\s*([\d,]+)/im);

  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = wordsMatch ? parseInt(wordsMatch[1].replace(/,/g, ''), 10) : words.length;
  const charCount = charsMatch ? parseInt(charsMatch[1].replace(/,/g, ''), 10) : text.length;

  // Exclude References/Bibliography section to avoid matching citation noise
  const refIndex = text.search(/\b(?:references|bibliography|literature\s+cited)\b/i);
  const bodyText = refIndex !== -1 ? text.substring(0, refIndex) : text;

  // ── Figures: count distinct figure numbers in bodyText ──
  let match: RegExpExecArray | null;
  const figSet = new Set<number>();
  const figRegex = /\b(?:figure|fig\.?|FIGURE|FIG\.?)\s*(\d+)/gi;
  let figMatch: RegExpExecArray | null;
  while ((figMatch = figRegex.exec(bodyText)) !== null) {
    const n = parseInt(figMatch[1], 10);
    if (n > 0 && n < 200) figSet.add(n);
  }
  const totalFigures = figSet.size > 0 ? Math.max(...figSet) : 0;

  // ── Tables: detect actual table captions and references in bodyText ──
  const romanToArabic = (roman: string): number => {
    const map: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
    let arabic = 0;
    let prev = 0;
    for (let i = roman.length - 1; i >= 0; i--) {
      const curr = map[roman[i].toLowerCase()] || 0;
      if (curr < prev) {
        arabic -= curr;
      } else {
        arabic += curr;
        prev = curr;
      }
    }
    return arabic;
  };

  const tableCaptionSet = new Set<number>();
  const tableCaptionRegex = /\b(?:table|tbl\.?|TABLE)\s*(\d+|[IVXLCDM]+)\s*[:.\-–—]/gi;
  let capMatch: RegExpExecArray | null;
  while ((capMatch = tableCaptionRegex.exec(bodyText)) !== null) {
    const numStr = capMatch[1];
    let n = parseInt(numStr, 10);
    if (isNaN(n)) {
      n = romanToArabic(numStr);
    }
    if (n > 0 && n < 100) tableCaptionSet.add(n);
  }

  const tableSet = new Set<number>();
  const tableRegex = /\b(?:table|tbl\.?|TABLE)\s*(\d+|[IVXLCDM]+)\b/gi;
  while ((match = tableRegex.exec(bodyText)) !== null) {
    const numStr = match[1];
    let n = parseInt(numStr, 10);
    if (isNaN(n)) {
      n = romanToArabic(numStr);
    }
    if (n > 0 && n < 100) tableSet.add(n);
  }

  // Count raw structural tables in bodyText as validation
  const pipeTableCount = (bodyText.match(/^\|.+\|$/gm) || []).length;
  const htmlTableCount = (bodyText.match(/<table\b/gi) || []).length;
  const latexTableCount = (bodyText.match(/\\begin\{(?:table|table\*|longtable|tabular|tabularx)\}/gi) || []).length;
  const structuralTableCount = Math.max(
    htmlTableCount,
    latexTableCount,
    pipeTableCount >= 2 ? Math.max(1, Math.round(pipeTableCount / 5)) : 0
  );

  let tableCount = 0;
  if (tableCaptionSet.size > 0) {
    tableCount = Math.max(...tableCaptionSet);
  } else if (structuralTableCount > 0) {
    tableCount = structuralTableCount;
  } else if (tableSet.size > 0) {
    const maxMentioned = Math.max(...tableSet);
    tableCount = Math.min(maxMentioned, tableSet.size);
  }

  // ── Equations in bodyText ──
  const lines = bodyText.split('\n');
  const trimmedLines = lines.map(l => l.trim());

  // Method 1: LaTeX equation environments
  const latexEqCount = (
    bodyText.match(
      /\\begin\{(?:equation|align\*?|gather\*?|multline\*?|eqnarray\*?)\}/gi
    ) || []
  ).length;

  // Method 2: "(X)" at end of lines
  const eqNumberSet = new Set<number>();
  for (const line of trimmedLines) {
    const trailingMatch = line.match(/\((\d{1,3})\)\s*$/);
    if (trailingMatch) {
      const n = parseInt(trailingMatch[1], 10);
      const hasMathOps = /[=+\-×÷∑∏∫√Δθαβγπλμσ±≈≠≡<>≤≥]|\\frac|\\sum|\\int|\\alpha|\\beta|\\gamma|\\theta|\\lambda|\\sigma/.test(line);
      const hasEqKw = /\b(loss|accuracy|error|precision|recall|f1|sensitivity|specificity|function|layer|output|input|weight|bias|gradient|activat|softmax|sigmoid|relu|entrop|normaliz|convolut|pooling|dropout|classif|probability|likelihood|tp|tn|fp|fn)\b/i.test(line);
      if (n > 0 && n < 150 && (hasMathOps || hasEqKw)) {
        eqNumberSet.add(n);
      }
    }
    const standaloneMatch = line.match(/^\s*\((\d{1,3})\)\s*$/);
    if (standaloneMatch) {
      const n = parseInt(standaloneMatch[1], 10);
      if (n > 0 && n < 150) eqNumberSet.add(n);
    }
    if (/\b(TP|TN|FP|FN)\b.{0,30}[+\-*/].{0,30}\b(TP|TN|FP|FN)\b/i.test(line) ||
        /\b(precision|recall|accuracy|specificity|sensitivity|f1)\s*=\s*[A-Z0-9]+\s*[\/+\-*]/i.test(line)) {
      eqNumberSet.add(200 + eqNumberSet.size);
    }
  }
  const metricFormulaCount = [...eqNumberSet].filter(n => n >= 200).length;
  const realNumberedCount = [...eqNumberSet].filter(n => n < 200).length;

  // Method 3: "Eq. (X)" references
  const explicitEqSet = new Set<number>();
  const explicitEqRegex = /\b(?:eqn?\.|equation|formula)\s*\.?\s*\(?(\d{1,3})\)?/gi;
  while ((match = explicitEqRegex.exec(bodyText)) !== null) {
    const n = parseInt(match[1], 10);
    if (n > 0 && n < 200) explicitEqSet.add(n);
  }

  // Method 4: Inline LaTeX math delimiters
  const inlineLatexCount = (bodyText.match(/\$[^$]{2,100}\$/g) || []).length;
  const displayLatexCount = (bodyText.match(/\$$[^$]{2,5000}\$\$/g) || []).length;
  const latexMathCount = inlineLatexCount + displayLatexCount * 2;
  const parenLatexCount = (bodyText.match(/\\\([^)]{2,200}\\\)/g) || []).length;

  // Method 5: Lines containing mathematical operators
  const mathLines = trimmedLines.filter(line => {
    if (line.length < 5 || line.length > 300) return false;
    const hasOperators = /[=+\-×÷∑∏∫√Δθαβγπλμσ±≈≠≡<>≤≥]/.test(line);
    const hasNumbers = /\d/.test(line);
    const hasVars = /[a-z]/i.test(line);
    if (!hasOperators || !hasNumbers || !hasVars) return false;
    if (/^\d+$/.test(line) || /^\[/.test(line) || /^[A-Z][a-z]+:/.test(line)) return false;
    if (/^\d+\.\s/.test(line) || /^(Fig(?:ure)?|Table)\b/i.test(line)) return false;
    return true;
  }).length;

  // Method 6: Keywords references
  const eqKeywords = (bodyText.match(
    /\b(?:equation|formula|loss\s*function|objective\s*function|cost\s*function|softmax|sigmoid|relu|tanh|activation\s*function|gradient|cross.?entropy|likelihood\s*function|probability\s*distribution)/gi
  ) || []).length;

  let equationCount = 0;
  const numberedEstimate = Math.max(realNumberedCount + metricFormulaCount, explicitEqSet.size);
  const mathEstimate = mathLines >= 5 ? Math.min(Math.round(mathLines * 0.15), 20) : 0;
  const keywordEstimate = eqKeywords >= 5 ? Math.round(eqKeywords / 5) : 0;

  if (latexEqCount > 0) {
    equationCount = latexEqCount;
  } else if (numberedEstimate >= 1) {
    equationCount = Math.max(numberedEstimate, explicitEqSet.size);
    if (keywordEstimate > equationCount) equationCount = keywordEstimate;
    if (mathEstimate > equationCount)    equationCount = mathEstimate;
  } else if (latexMathCount > 0 || parenLatexCount > 0) {
    equationCount = Math.max(latexMathCount, parenLatexCount);
  } else if (keywordEstimate > 0) {
    equationCount = mathEstimate > 0 ? Math.max(keywordEstimate, mathEstimate) : keywordEstimate;
  } else if (mathEstimate > 0) {
    equationCount = mathEstimate;
  } else {
    equationCount = 0;
  }

  // ── Algorithms / Pseudocode in bodyText ──
  const algoSet = new Set<number>();
  const algoRegex = /\b(?:algorithm|pseudocode|listing|procedure)\s*(\d+)/gi;
  while ((match = algoRegex.exec(bodyText)) !== null) {
    const n = parseInt(match[1], 10);
    if (n > 0 && n < 100) algoSet.add(n);
  }
  const codeBlockCount = (bodyText.match(/```/g) || []).length;
  const pseudocodeCount = algoSet.size > 0
    ? Math.max(...algoSet)
    : codeBlockCount > 0
      ? Math.floor(codeBlockCount / 2)
      : 0;

  // ── Charts in bodyText ──
  const figPositions: number[] = [];
  const figPosRegex = /\bf(?:igure|ig\.?)\s*(\d+)\b/gi;
  while ((match = figPosRegex.exec(bodyText)) !== null) {
    figPositions.push(match.index);
  }

  const chartVocab = [
    'confusion matrix',
    'roc curve', 'receiver operating characteristic',
    'auc-roc', 'area under the curve', 'area under curve',
    'bar chart', 'bar graph', 'barplot', 'bar plot',
    'line chart', 'line graph', 'line plot',
    'scatter plot', 'scatter chart', 'scatterplot',
    'histogram', 'frequency histogram',
    'box plot', 'boxplot', 'violin plot',
    'pie chart', 'donut chart',
    'heatmap', 'heat map',
    'learning curve', 'loss curve', 'training curve', 'convergence curve',
    'km curve', 'survival curve', 'kaplan-meier',
    'ablation study plot', 'ablation curve',
    'correlation plot', 'qq plot', 'residual plot',
    'plot of', 'graph of', 'visualization of',
    // Expanded engineering / timing diagrams vocab:
    'timing diagram', 'timing diagrams', 'timing chart', 'timing charts',
    'waveform', 'waveforms', 'simulation waveform', 'simulation waveforms',
    'simulation plot', 'simulation plots',
    'circuit diagram', 'circuit diagrams', 'circuit schematic', 'circuit schematics',
    'block diagram', 'block diagrams',
    'flowchart', 'flowcharts', 'flow chart', 'flow charts'
  ];
  let chartScore = 0;
  for (const phrase of chartVocab) {
    const re = new RegExp('\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const c = (bodyText.match(re) || []).length;
    chartScore += c;
  }

  let chartFigureCount = 0;
  const checkedChartFigs = new Set<number>();
  if (figPositions.length > 0) {
    for (const pos of figPositions) {
      const before = bodyText.substring(Math.max(0, pos - 60), pos).toLowerCase();
      const after  = bodyText.substring(pos, pos + 250).toLowerCase();
      const surrounding = before + ' ' + after;

      const tier1 = /\b(confusion\s*matrix|roc\s*curve|receiver\s*operat|auc.?roc|area\s*under|bar\s*chart|bar\s*graph|barplot|histogram|scatter\s*plot|box\s*plot|boxplot|heatmap|heat\s*map|line\s*chart|line\s*graph|pie\s*chart|km\s*curve|survival\s*curve|learning\s*curve|loss\s*curve|training\s*curve|convergence\s*curve|ablation\s*curve|qq\s*plot|residual\s*plot|timing\s*diagram|timing\s*chart|waveform|simulation\s*waveform|simulation\s*plot|circuit\s*diagram|circuit\s*schematic|block\s*diagram|flowchart|flow\s*chart)/i.test(surrounding);
      const tier2 = /\b(training\s+(?:and\s+)?(?:validation|testing)\s+accur|validation\s+accur|testing\s+accur|training\s+accur|\broc\b|\bauc\b|precision.recall|classification\s+result|comparison\s+of\s+(?:result|method|approach|model|performance)|performance\s+comparison|accuracy\s+(?:vs|versus|curve|plot|graph|over)|loss\s+(?:vs|versus|curve|plot|graph|over)|f1\s+score\s+(?:vs|comparison)|bar\s+diagram)/i.test(surrounding);

      if (tier1 || tier2) {
        const figMatch = surrounding.match(/\b(?:figure|fig\.?)\s*(\d+)/i);
        if (figMatch) {
          const n = parseInt(figMatch[1], 10);
          if (n > 0 && n < 200) checkedChartFigs.add(n);
        }
      }
    }
    chartFigureCount = checkedChartFigs.size;
  }

  const figCaptionRegex = /\bfig(?:ure)?[.:]?\s*(\d+)[.:\s][^\n]{0,250}/gi;
  while ((capMatch = figCaptionRegex.exec(bodyText)) !== null) {
    const n = parseInt(capMatch[1], 10);
    if (n > 0 && n < 200 && !checkedChartFigs.has(n)) {
      const capText = capMatch[0].toLowerCase();
      const isCaptionChart =
        /confusion|matrix|roc|auc|accuracy|loss|precision|recall|f1|training|validation|testing|comparison|performance|bar|histogram|scatter|heatmap|learning\s*curve|plot|curve|graph|timing\s*diagram|waveform/i.test(capText);
      if (isCaptionChart) {
        checkedChartFigs.add(n);
        chartFigureCount++;
      }
    }
  }

  let chartCount = 0;
  if (chartFigureCount > 0) {
    chartCount = chartFigureCount;
  } else if (chartScore >= 2) {
    if (chartScore <= 4)       chartCount = 1;
    else if (chartScore <= 8)  chartCount = 2;
    else if (chartScore <= 15) chartCount = Math.max(2, Math.round(chartScore / 4));
    else                       chartCount = Math.min(12, Math.round(chartScore / 5));
  }

  // Ensure chartCount is not greater than totalFigures and subtract from normal figures
  chartCount = Math.min(totalFigures, chartCount);
  const imageCount = Math.max(0, totalFigures - chartCount);

  // ── Citations ──
  const bracketedCitRegex = /\[([\d\s,\-]+)\]/g;
  const uniqueCitations = new Set<number>();
  while ((match = bracketedCitRegex.exec(text)) !== null) {
    match[1].split(/[\s,]+/).forEach((p: string) => {
      if (p.includes("-")) {
        const [s, e] = p.split("-").map(Number);
        if (!isNaN(s) && !isNaN(e) && e - s < 100)
          for (let i = s; i <= e; i++) uniqueCitations.add(i);
      } else {
        const n = Number(p.trim());
        if (!isNaN(n) && n > 0) uniqueCitations.add(n);
      }
    });
  }
  let authorYearCount = 0;
  const authorYearMatches = text.match(/\([A-Z][a-zA-Z\u00C0-\u017F\s\-]+(?: et al\.?)?(?:,\s*|\s+)\d{4}(?:[a-z])?(?:;\s*[A-Z][a-zA-Z\u00C0-\u017F\s\-]+(?: et al\.?)?(?:,\s*|\s+)\d{4}(?:[a-z])?)*\)/g) || [];
  authorYearMatches.forEach(m => { authorYearCount += m.split(';').length; });
  
  const citCountBase = uniqueCitations.size > 0 ? uniqueCitations.size + authorYearCount : authorYearCount;

  // ── References ──
  const refSectionText =
    text.split(/\b(?:references|bibliography)\b/i).pop() || "";
  const numericRefCount = (refSectionText.match(/(?:^\s*|\n\s*)\[\d+\]/g) || []).length;
  const numberedListRefCount = (
    refSectionText.match(/(?:^\s*|\n\s*)\d+\.\s+[A-Z]/g) || []
  ).length;
  const refCountBase = Math.max(
    numericRefCount,
    numberedListRefCount,
    uniqueCitations.size
  );

  console.log(`[STATS] figs=${figSet.size}(${imageCount}) tables=${tableCaptionSet.size}/${tableSet.size} mathLines=${mathLines} eqNums=${[...eqNumberSet]} explicitEq=${[...explicitEqSet]} chartScore=${chartScore} chartFigs=${chartFigureCount} refLines=${numericRefCount}/${numberedListRefCount} / ${uniqueCitations.size}`);

  return {
    wordCount,
    charCount,
    imageCount: figsMatch ? parseInt(figsMatch[1].replace(/,/g, ''), 10) : imageCount,
    tableCount: tablesMatch ? parseInt(tablesMatch[1].replace(/,/g, ''), 10) : tableCount,
    equationCount: eqMatch ? parseInt(eqMatch[1].replace(/,/g, ''), 10) : equationCount,
    citationCount: citMatch ? parseInt(citMatch[1].replace(/,/g, ''), 10) : citCountBase,
    referenceCount: refMatch ? parseInt(refMatch[1].replace(/,/g, ''), 10) : refCountBase,
    pseudocodeCount: algoMatch ? parseInt(algoMatch[1].replace(/,/g, ''), 10) : pseudocodeCount,
    chartCount: chartsMatch ? parseInt(chartsMatch[1].replace(/,/g, ''), 10) : chartCount,
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  METADATA EXTRACTORS (AI primary, regex cross-verification fallback)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Regex-based keyword extraction fallback (when AI times out).
 * Picks capitalized 2-5 word phrases from the abstract that look like technical terms.
 */
function extractKeywordsFallback(text: string): string[] {
  const keywords: string[] = [];
  const seen = new Set<string>();

  // 1. Look for explicit "Keywords:" section in the text
  const kwSection = text.match(/\b(?:Keywords?|Index Terms)[:\s\u2014\-]*\n?([\s\S]{50,1000}?)(?:\n\s*\n|\b(?:Introduction|1\.\s|Acknowledgments)\b)/i);
  if (kwSection) {
    const parts = kwSection[1].split(/[,;]\s*/).map(k => k.trim().toUpperCase()).filter(k => k.length > 2);
    for (const kw of parts) {
      if (!seen.has(kw)) { seen.add(kw); keywords.push(kw); }
    }
    if (keywords.length >= 3) return keywords.slice(0, 10);
  }

  // 2. Extract capitalized noun phrases (2-5 words) from abstract
  const abstractSection = text.match(/\bAbstract[:\s\u2014\-]*\n?([\s\S]{50,3000}?)(?:\n\s*\n|\b(?:Introduction|Keywords?|1\.\s|I\.\s)\b)/i);
  const source = abstractSection ? abstractSection[1] : text.substring(0, 3000);
  const phraseRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\b/g;
  let m;
  const stopWords = new Set(['Abstract', 'Introduction', 'Methodology', 'Results', 'Discussion', 'Conclusion', 'Background', 'Related Work', 'However', 'Therefore', 'Furthermore', 'Moreover', 'Additionally']);
  while ((m = phraseRegex.exec(source)) !== null) {
    const phrase = m[1].toUpperCase();
    if (!stopWords.has(m[1]) && phrase.length > 5 && !seen.has(phrase)) {
      seen.add(phrase);
      keywords.push(phrase);
      if (keywords.length >= 10) break;
    }
  }

  return keywords;
}

/**
 * Regex-based author extraction fallback.
 * Finds author names after the title in the first ~15 lines of the document.
 */
function extractAuthorsFallback(text: string): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const authors: string[] = [];
  const seen = new Set<string>();

  // Locate title boundary: first substantive line that looks like a title
  let titleEndIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i];
    if (line.length > 15 && line.length < 250) {
      const commaCount = (line.match(/,/g) || []).length;
      if (commaCount <= 1 && !/^\d/.test(line)) {
        titleEndIdx = i;
        break;
      }
    }
  }

  const searchStart = Math.max(0, titleEndIdx + 1);
  const searchEnd = Math.min(lines.length, searchStart + 12);

  for (let i = searchStart; i < searchEnd; i++) {
    const line = lines[i];
    if (line.length > 300 || /^(Abstract|Introduction|1\.|I\.|Keywords)/i.test(line)) break;
    if (/@/.test(line)) continue;

    const authorPattern = /([A-Z][a-zà-ü]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-zà-ü]+(?:[-'][A-Z][a-zà-ü]+)?)/g;
    let m;
    let anyOnLine = false;
    while ((m = authorPattern.exec(line)) !== null) {
      const name = m[1].trim();
      if (name.length > 3 && name.split(' ').length >= 2 &&
        !/^(Department|School|University|Institute|College|Faculty|Division|Center|Centre|Laboratory|Lab|Email|Correspondence|Abstract|Keywords|Introduction)/i.test(name)) {
        if (!seen.has(name)) {
          seen.add(name);
          authors.push(name);
          anyOnLine = true;
        }
      }
    }
    if (anyOnLine && line.includes(',')) continue;
    if (authors.length > 0 && !anyOnLine) break;
  }

  return authors;
}

/**
 * Regex-based affiliation extraction fallback.
 * Finds university/department/institute lines near the top of the document.
 */
function extractAffiliationsFallback(text: string): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const affiliations: string[] = [];
  const seen = new Set<string>();

  const instKeywords = /\b(Department|School|University|Institute|College|Faculty|Division|Center|Centre|Laboratory|Lab|Hospital|Clinic|Academy|Polytechnic|Conservatory)\b/i;

  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const line = lines[i];

    // Skip lines that are clearly section headers or emails
    if (/^(Abstract|Introduction|Keywords?|1\.\s|I\.\s|II\.|A\.|B\.|Fig(?:ure)?|Table|Acknowledgments?)/i.test(line)) break;
    if (/@/.test(line) || line.length < 8) continue;

    // Pattern 1: "1Department of..." (no space) or "1 Department of..." (with space)
    // or "1,2Department of..." / "1,2 Department of..."
    const numMatch = line.match(/^[\d,\s]+(Department|School|University|Institute|College|Faculty|Division|Center|Centre|Laboratory|Lab|Hospital|Clinic|Academy)\b[\s\S]*/i);
    if (numMatch) {
      const affil = numMatch[0].replace(/^[\d,\s]+/, '').trim();
      if (affil.length > 6 && !seen.has(affil)) {
        seen.add(affil);
        affiliations.push(affil);
      }
      continue;
    }

    // Pattern 2: Unnumbered institution-starting line  
    if (affiliations.length === 0 || /^[\d,\s]/.test(line)) {
      const instMatch = line.match(/^(Department|School|University|Institute|College|Faculty|Division|Center|Centre|Laboratory|Lab|Hospital|Clinic|Academy)\b[\s\S]*/i);
      if (instMatch) {
        const affil = instMatch[0].trim();
        if (affil.length > 8 && !seen.has(affil) && affil.split(' ').length >= 3) {
          seen.add(affil);
          affiliations.push(affil);
          continue;
        }
      }
    }

    // Pattern 3: Address format
    if (affiliations.length === 0) {
      const addrMatch = line.match(/^(?:PO\s+Box|Street|Road|Avenue|Boulevard|Drive|Lane|Way|Place|Sq(?:uare)?)\b/i);
      if (addrMatch && !seen.has(line)) {
        seen.add(line);
        affiliations.push(line);
        continue;
      }
    }

    // Stop scanning if we found affiliations and hit a non-institution line
    if (affiliations.length > 0 && !instKeywords.test(line) && !/^[\d,\s]/.test(line) && !line.startsWith('and ')) break;
  }

  // Phase 2: Broader scan — any line with institution keyword in first 50 lines
  if (affiliations.length === 0) {
    for (let i = 0; i < Math.min(lines.length, 50); i++) {
      const line = lines[i];
      if (instKeywords.test(line) && line.length < 250 && !/^Abstract|Introduction|Keywords?/i.test(line)) {
        const affil = line.replace(/^[\d,\s]+/, '').replace(/<[^>]+>/g, '').trim();
        if (affil.length > 8 && !seen.has(affil)) {
          seen.add(affil);
          affiliations.push(affil);
          if (affiliations.length >= 4) break;
        }
      }
    }
  }

  console.log(`[AFFIL] found ${affiliations.length} affiliations:`, affiliations);

  return affiliations;
}

function resolveTitle(aiTitle: string | undefined, text: string): string {
  if (aiTitle && aiTitle.trim().length > 3) return aiTitle.trim();
  // Regex fallback: first non-empty line with 10–200 chars, not a number/date
  const firstLine = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 10 && l.length < 200 && !/^\d+$/.test(l));
  return firstLine || "";
}

function resolveAbstract(
  aiAbstract: string | undefined,
  text: string
): string {
  if (aiAbstract && aiAbstract.trim().length > 30) {
     const cleaned = aiAbstract.trim();
     // Fuzzy verify: Is this abstract actually in the text?
     // We check if at least 50% of the first 100 chars of the AI abstract exist in the raw text
     const probe = cleaned.substring(0, 100).replace(/\s+/g, ' ');
     if (text.replace(/\s+/g, ' ').includes(probe)) return cleaned;
     
     console.warn("[EXTRACT] AI Abstract failed grounding check. Falling back to regex.");
  }
  // Regex fallback: find "Abstract" header and extract up to next section
  const m = text.match(
    /\bAbstract[:\s\u2014\-]*\n?([\s\S]{50,3000}?)(?:\n\s*\n|\b(?:Introduction|Keywords?|1\.\s|I\.\s)\b)/i
  );
  return m ? m[1].trim() : "";
}

// ════════════════════════════════════════════════════════════════════════════
//  ROUTE HANDLER
// ════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  console.log("[EXTRACT] POST received");
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    console.log("[EXTRACT] File:", file.name, "size:", file.size, "bytes");

    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Step 1: Extract raw text ──────────────────────────────────────────
    let text = "";
    try {
      text = await extractTextFromFile(file, buffer);
    } catch (extractErr: any) {
      console.error("[EXTRACT] Extraction failed:", extractErr.message);
      return NextResponse.json(
        { error: extractErr.message },
        { status: 422 }
      );
    }

    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        {
          error:
            "No readable text found in the file. It may be image-only or corrupt.",
        },
        { status: 422 }
      );
    }
    console.log("[EXTRACT] Raw text length:", text.length);

    // ── Step 2: AI metadata extraction ───────────────────────────────────
    // Limit to 12k chars — title, abstract, authors, keywords are always in the first part
    const truncatedText = chunkText(text, 12000);
    const prompt = buildExtractionPrompt(truncatedText, file.name);

    const session = await getServerSession();
    const userId = session?.user?.id || null;

    let aiResult = "";
    try {
      console.log("[EXTRACT] Calling Clod AI (Qwen)...");
      aiResult = await callClodAI(prompt, userId, req);
      console.log("[EXTRACT] Clod AI OK");
    } catch (e: any) {
      console.error("[EXTRACT] Clod AI failed:", e.message);
      // Continue — will use regex fallbacks for metadata
    }

    // ── Step 3: Parse AI JSON ─────────────────────────────────────────────
    let parsedAI: any = {};
    if (aiResult) {
      try {
        const cleaned = aiResult
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        parsedAI = JSON.parse(cleaned);
        console.log("[EXTRACT] AI JSON parsed. Title:", parsedAI.title);
      } catch (e) {
        console.warn(
          "[EXTRACT] AI JSON parse failed. Raw:",
          aiResult.slice(0, 200)
        );
      }
    }

    // ── Step 4: Compute stats deterministically from raw text ─────────────
    const deterministicStats = computeStats(text);

    // ── Step 5: Merge semantic AI-extracted stats with deterministic fallback ──
    // Word and character counts are computed with 100% precision via deterministic split/length.
    // For structural counts, we trust our high-fidelity deterministic parser as the primary ground truth,
    // and fall back to the semantic AI-extracted counts only if the deterministic counts are zero or absent.
    const aiStats = parsedAI.stats || {};
    const stats = {
      wordCount: deterministicStats.wordCount,
      charCount: deterministicStats.charCount,
      imageCount: deterministicStats.imageCount > 0 ? deterministicStats.imageCount : (typeof aiStats.imageCount === 'number' && aiStats.imageCount > 0 ? aiStats.imageCount : 0),
      tableCount: deterministicStats.tableCount > 0 ? deterministicStats.tableCount : (typeof aiStats.tableCount === 'number' && aiStats.tableCount > 0 ? aiStats.tableCount : 0),
      equationCount: deterministicStats.equationCount > 0 ? deterministicStats.equationCount : (typeof aiStats.equationCount === 'number' && aiStats.equationCount > 0 ? aiStats.equationCount : 0),
      pseudocodeCount: deterministicStats.pseudocodeCount > 0 ? deterministicStats.pseudocodeCount : (typeof aiStats.pseudocodeCount === 'number' && aiStats.pseudocodeCount > 0 ? aiStats.pseudocodeCount : 0),
      citationCount: deterministicStats.citationCount > 0 ? deterministicStats.citationCount : (typeof aiStats.citationCount === 'number' && aiStats.citationCount > 0 ? aiStats.citationCount : 0),
      referenceCount: deterministicStats.referenceCount > 0 ? deterministicStats.referenceCount : (typeof aiStats.referenceCount === 'number' && aiStats.referenceCount > 0 ? aiStats.referenceCount : 0),
      chartCount: deterministicStats.chartCount > 0 ? deterministicStats.chartCount : (typeof aiStats.chartCount === 'number' && aiStats.chartCount > 0 ? aiStats.chartCount : 0),
    };

    // ── Step 6: Resolve metadata (AI primary, regex cross-verified) ────────
    const title = resolveTitle(parsedAI.title, text);
    const abstract = resolveAbstract(parsedAI.abstract, text);
    const keywords =
      parsedAI.keywords && parsedAI.keywords.length > 0
        ? parsedAI.keywords.map((k: string) => k.trim().toUpperCase())
        : extractKeywordsFallback(text);
    // Normalize authors: AI may return [{name, affiliation}] objects — flatten to strings
    const rawAuthors: any[] =
      parsedAI.authors && parsedAI.authors.length > 0
        ? parsedAI.authors
        : extractAuthorsFallback(text);
    const authors: string[] = rawAuthors.map((a: any) => {
      if (typeof a === 'string') return a.trim();
      if (a && typeof a === 'object') {
        // {name, affiliation} or {name} object from AI
        const name = String(a.name || a.Name || '').trim();
        const affil = String(a.affiliation || a.Affiliation || '').trim();
        return affil ? `${name} (${affil})` : name;
      }
      return String(a ?? '').trim();
    }).filter(Boolean);

    // Normalize affiliations: AI may return an array instead of a string
    let affiliations: string;
    if (parsedAI.affiliations) {
      if (typeof parsedAI.affiliations === 'string' && parsedAI.affiliations.trim().length > 0) {
        affiliations = parsedAI.affiliations.trim();
      } else if (Array.isArray(parsedAI.affiliations) && parsedAI.affiliations.length > 0) {
        affiliations = parsedAI.affiliations.map((a: any) =>
          typeof a === 'string' ? a.trim() : String(a?.name || a || '').trim()
        ).filter(Boolean).join('; ');
      } else {
        affiliations = extractAffiliationsFallback(text).join('; ');
      }
    } else {
      affiliations = extractAffiliationsFallback(text).join('; ');
    }

    console.log(
      `[EXTRACT] Done — title: "${title.slice(0, 60)}" | words: ${stats.wordCount} | citations: ${stats.citationCount}`
    );

    return NextResponse.json({
      text,
      title,
      abstract,
      keywords,
      authors,
      affiliations,
      stats,
    });
  } catch (error: any) {
    console.error("[EXTRACT ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Extraction failed" },
      { status: 500 }
    );
  }
}
