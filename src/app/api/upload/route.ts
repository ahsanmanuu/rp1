import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { randomBytes } from 'crypto';

// Configure Sharp image processing engine cache and threadpool buffers for maximum upload throughput
sharp.concurrency(4);
sharp.cache({ memory: 256, items: 200, files: 0 });

const IMAGE_ENHANCE_CACHE = new Map<string, Buffer>();

// Big-document guard: sharp re-encoding of EVERY image (3000-dpi density tagging)
// is the dominant CPU cost for large DOCX files and a top cause of the Render
// ~300s request kill. After ENHANCE_IMAGE_CAP images, images pass through
// untouched — sharp work is skipped entirely for the rest of the document.
let enhanceImageCount = 0;
const ENHANCE_IMAGE_CAP = 60;

async function enhanceImageFor3000Dpi(buffer: Buffer): Promise<Buffer> {
  if (enhanceImageCount >= ENHANCE_IMAGE_CAP) return buffer;
  try {
    if (!buffer || buffer.length === 0 || buffer.length > 5 * 1024 * 1024) return buffer;
    
    // Quick hash lookup for duplicate image buffers (e.g. logos, bullet graphics)
    const bufKey = `${buffer.length}_${buffer.slice(0, 32).toString('hex')}`;
    if (IMAGE_ENHANCE_CACHE.has(bufKey)) {
      return IMAGE_ENHANCE_CACHE.get(bufKey)!;
    }

    const metadata = await sharp(buffer).metadata();
    const origWidth = metadata.width || 800;

    let result: Buffer;
    // Fast high-DPI density tagging: avoid heavy CPU thrashing & proxy timeouts on Render
    if (origWidth >= 1200 || buffer.length > 500 * 1024) {
      result = await sharp(buffer)
        .withMetadata({ density: 3000 })
        .toBuffer();
    } else {
      const targetWidth = Math.min(Math.max(origWidth * 2, 1200), 1800);
      result = await sharp(buffer)
        .resize(targetWidth, null, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .sharpen()
        .png({ compressionLevel: 4 })
        .withMetadata({ density: 3000 })
        .toBuffer();
    }

    if (IMAGE_ENHANCE_CACHE.size > 100) IMAGE_ENHANCE_CACHE.clear();
    IMAGE_ENHANCE_CACHE.set(bufKey, result);
    enhanceImageCount++;
    return result;
  } catch (err) {
    return buffer;
  }
}

import { getServerSession } from "@/lib/auth-pb";
// Runtime Console Logger Wrapper to debug hangs on Render
const runtimeLogPath = path.resolve(process.cwd(), 'runtime.log');
if (!(globalThis as any).__console_wrapped) {
  (globalThis as any).__console_wrapped = true;
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  const appendLog = (type: string, args: any[]) => {
    const time = new Date().toISOString();
    const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    const line = `[${time}] [${type}] ${msg}\n`;
    fs.promises.appendFile(runtimeLogPath, line).catch(() => {});
  };

  console.log = (...args: any[]) => {
    appendLog('LOG', args);
    originalLog(...args);
  };
  console.error = (...args: any[]) => {
    appendLog('ERR', args);
    originalError(...args);
  };
  console.warn = (...args: any[]) => {
    appendLog('WARN', args);
    originalWarn(...args);
  };
}

import mammoth from 'mammoth';
import { prisma } from '@/lib/prisma';
import { extractBibliography } from '@/lib/docx-extractor';
import AdmZip from 'adm-zip';
import { JSDOM } from 'jsdom';
import { exec } from 'child_process';
import { generateChartImageFromXml } from "@/lib/chart-parser";
import { promisify } from 'util';
const execAsync = promisify(exec);
import { DeepDocumentParser } from '@/lib/deep-parser';
import { LatexAssembler, ModularLatexAssembler } from '@/lib/assembler';
import { ensureContentSizeLimits } from '@/lib/pbContentLimits';

// Simple concurrency queue for powershell execution to prevent CPU thrashing
class PQueue {
  private queue: (() => Promise<void>)[] = [];
  private active = 0;
  constructor(private limit: number) {}
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try { resolve(await fn()); } catch (err) { reject(err); }
      });
      this.next();
    });
  }
  private next() {
    if (this.active >= this.limit || this.queue.length === 0) return;
    this.active++;
    const task = this.queue.shift();
    if (task) {
      task().finally(() => {
        this.active--;
        this.next();
      });
    }
  }
}
const psQueue = new PQueue(3); // Max 3 concurrent powershell instances

// ── TWO-PHASE UPLOAD (huge-file fix) ────────────────────────────────────────
// Render kills long requests (~300s) regardless of the client XHR timeout, so a
// large DOCX pipeline (AdmZip + JSDOM math/charts + mammoth + sharp + AI +
// assembly + DB) routinely exceeds it and the client gave up with
// "Connection timed out while uploading". Phase 1 (POST) now ONLY saves the raw
// bytes to a pending dir and returns { uploadId } immediately; the heavy
// pipeline runs in the background (same process) and the client polls
// GET /api/upload/status. Pending files live OUTSIDE public/ so the raw bytes
// are never statically served.
const PENDING_DIR = path.join(process.cwd(), 'tmp', 'uploads-pending');
// Staleness window before a worker is suspected dead. Generous on purpose:
// stages between progress milestones (chart QuickChart loop, sync assembly
// string work, disk batch writes) can legitimately take several minutes for
// huge documents. Recovery re-kicks the worker instead of failing outright.
const PENDING_TTL_MS = 600 * 1000;
// Max re-kicks per uploadId — after this the job is presumed impossible and
// the client gets a definitive error instead of an infinite recovery loop.
const MAX_BACKGROUND_KICKS = 3;

// Module-level worker registry: prevents duplicate concurrent runs of the
// same uploadId (POST kick + GET recovery re-kick racing each other).
const backgroundRunning = new Set<string>();
const backgroundKicks = new Map<string, number>();

function ensurePendingDir(): void {
  if (!fs.existsSync(PENDING_DIR)) fs.mkdirSync(PENDING_DIR, { recursive: true });
}

function statusPath(uploadId: string): string {
  return path.join(PENDING_DIR, `${uploadId}.json`);
}

function writeStatus(uploadId: string, data: Record<string, any>): void {
  try {
    ensurePendingDir();
    fs.writeFileSync(statusPath(uploadId), JSON.stringify({ ...data, updatedAt: Date.now() }));
  } catch (writeErr) {
    console.warn('[UPLOAD-STATUS] Status write failed:', writeErr);
  }
}

function readStatus(uploadId: string): Record<string, any> | null {
  try {
    const raw = fs.readFileSync(statusPath(uploadId), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function progress(uploadId: string, stage: string, percent: number): void {
  if (percent > 99.9) percent = 99.9;
  writeStatus(uploadId, { phase: 'processing', stage, progress: percent });
  console.log(`[UPLOAD-PROGRESS] ${uploadId} ${percent}% — ${stage}`);
}

// Lightweight heartbeat: refreshes updatedAt without touching progress/logs —
// used in long async loops (per-chart QuickChart calls) so a genuinely busy
// worker is never mistaken for a dead one.
function heartbeat(uploadId: string, stage: string, progressPercent: number): void {
  writeStatus(uploadId, { phase: 'processing', stage, progress: progressPercent });
}

function metaPath(uploadId: string): string {
  return path.join(PENDING_DIR, `${uploadId}.meta.json`);
}

function readMeta(uploadId: string): Record<string, any> | null {
  try {
    return JSON.parse(fs.readFileSync(metaPath(uploadId), 'utf-8'));
  } catch {
    return null;
  }
}

function checkpointPath(uploadId: string): string {
  return path.join(PENDING_DIR, `${uploadId}.checkpoint.json`);
}

// Resume checkpoint: written IMMEDIATELY after the project row is created so a
// re-kicked worker (crash/restart recovery) never duplicates the project —
// it adopts the checkpointed id and re-runs the idempotent file phase.
function readCheckpoint(uploadId: string): { projectId?: string } | null {
  try {
    return JSON.parse(fs.readFileSync(checkpointPath(uploadId), 'utf-8'));
  } catch {
    return null;
  }
}

function writeCheckpoint(uploadId: string, data: { projectId: string }): void {
  try {
    fs.writeFileSync(checkpointPath(uploadId), JSON.stringify(data));
  } catch (cpErr) {
    console.warn('[UPLOAD] Checkpoint write failed (non-fatal):', cpErr);
  }
}

// Shared terminal handler for every worker kick (POST fire-and-forget AND GET
// recovery re-kick): writes the final status and releases the worker registry.
function finishUpload(uploadId: string, res: any): void {
  backgroundRunning.delete(uploadId);
  backgroundKicks.delete(uploadId);
  if (res?.success && res.projectId) {
    writeStatus(uploadId, { phase: 'done', progress: 100, stage: 'Complete', projectId: res.projectId });
  } else if (res?.error) {
    writeStatus(uploadId, { phase: 'error', message: res.error });
  }
}

function getFallbackPngBuffer(): Buffer {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
}

async function convertEmfToPngWindowsBatchAsync(emfBuffers: Buffer[]): Promise<(Buffer | null)[]> {
  if (process.platform !== 'win32' || emfBuffers.length === 0) return emfBuffers.map(() => null);
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  
  const tempId = Math.random().toString(36).substring(2, 9);
  
  const paths = await Promise.all(emfBuffers.map(async (buf, i) => {
    const tempEmfPath = path.join(tmpDir, `temp_${tempId}_${i}.emf`);
    const tempPngPath = path.join(tmpDir, `temp_${tempId}_${i}.png`);
    await fs.promises.writeFile(tempEmfPath, buf);
    return { emf: tempEmfPath, png: tempPngPath };
  }));

  try {
    const psScript = `
      Add-Type -AssemblyName System.Drawing;
      ${paths.map(p => `
        try {
          $img = [System.Drawing.Image]::FromFile('${p.emf.replace(/'/g, "''")}');
          $img.Save('${p.png.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png);
          $img.Dispose();
        } catch {}
      `).join('\n')}
    `;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    
    // Execute ONE powershell instance for all images with a 30s timeout to prevent hanging the queue
    await psQueue.add(() => execAsync(`powershell -NoProfile -EncodedCommand ${encoded}`, { timeout: 30000 }));
    
    const results = await Promise.all(paths.map(async p => {
      if (fs.existsSync(p.png)) {
        return await fs.promises.readFile(p.png);
      }
      return null;
    }));
    return results;
  } catch (err) {
    console.error("[CHART] EMF batch conversion error:", err);
    return emfBuffers.map(() => null);
  } finally {
    for (const p of paths) {
      try {
        if (fs.existsSync(p.emf)) await fs.promises.unlink(p.emf);
        if (fs.existsSync(p.png)) await fs.promises.unlink(p.png);
      } catch {}
    }
  }
}

// Helper to convert OMML (Office Math) to LaTeX
function ommlToLatex(mathNode: Element, isDisplay: boolean): string {
  const symbolMap: Record<string, string> = {
    'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\epsilon',
    'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta', 'ι': '\\iota', 'κ': '\\kappa',
    'λ': '\\lambda', 'μ': '\\mu', 'ν': '\\nu', 'ξ': '\\xi', 'ο': 'o',
    'π': '\\pi', 'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon',
    'φ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
    'Α': 'A', 'Ｂ': 'B', 'Γ': '\\Gamma', 'Δ': '\\Delta', 'Ｅ': 'E',
    'Ｚ': 'Z', 'Ｈ': 'H', 'Θ': '\\Theta', 'Ｉ': 'I', 'Ｋ': 'K',
    'Λ': '\\Lambda', 'Ｍ': 'M', 'Ｎ': 'N', 'Ξ': '\\Xi', 'Ｏ': 'O',
    'Π': '\\Pi', 'Ρ': 'P', 'Σ': '\\Sigma', 'Ｔ': 'T', 'Ｙ': '\\Upsilon',
    'Φ': '\\Phi', 'Ｘ': 'X', 'Ψ': '\\Psi', 'Ω': '\\Omega',
    '±': '\\pm', '×': '\\times', '÷': '\\div', '≈': '\\approx', '≠': '\\neq',
    '≤': '\\leq', '≥': '\\geq', '∞': '\\infty', '∫': '\\int', '∂': '\\partial',
    '√': '\\sqrt', '∈': '\\in', '∉': '\\notin', '∑': '\\sum', '∏': '\\prod',
    '∇': '\\nabla', '∠': '\\angle', '°': '^{\\circ}', '…': '\\dots', '⋯': '\\cdots',
    '→': '\\rightarrow', '←': '\\leftarrow', '↔': '\\leftrightarrow', '⇒': '\\Rightarrow',
    '∀': '\\forall', '∃': '\\exists', '∅': '\\emptyset',
    '⊂': '\\subset', '⊃': '\\supset', '∪': '\\cup', '∩': '\\cap',
    '⋅': '\\cdot', '·': '\\cdot',
    '\u2212': '-', '\u2217': '*'
  };

  const replaceSymbols = (str: string): string => {
    let res = str;
    for (const [char, tex] of Object.entries(symbolMap)) {
      const replacement = tex.startsWith('\\') ? `${tex} ` : tex;
      res = res.split(char).join(replacement);
    }
    return res;
  };

  const processNode = (node: Node | null): string => {
    if (!node) return "";
    if (node.nodeType === 3) return replaceSymbols(node.textContent || "");
    const el = node as Element;
    const tagName = String(el.tagName || "");
    const tag = tagName.toLowerCase().replace(/^m:/, '');

    const getChildByTag = (parent: Element, tagName: string): Element | null => {
      if (!parent || !parent.childNodes) return null;
      return Array.from(parent.childNodes).find(n => {
        const nEl = n as Element;
        return nEl && String(nEl.tagName || "").toLowerCase().replace(/^m:/, '') === tagName;
      }) as Element || null;
    };

    const getChildrenByTag = (parent: Element, tagName: string): Element[] => {
      if (!parent || !parent.childNodes) return [];
      return Array.from(parent.childNodes).filter(n => {
        const nEl = n as Element;
        return nEl && String(nEl.tagName || "").toLowerCase().replace(/^m:/, '') === tagName;
      }) as Element[];
    };

    switch (tag) {
      case 'omath':
      case 'omathpara':
      case 'r': case 't':
        return Array.from(el.childNodes).map(node => {
          const txt = (node.textContent || "").trim();
          if (symbolMap[txt]) return symbolMap[txt];
          return processNode(node);
        }).join('');
      case 'sym':
        const chr = (el.getAttribute('m:char') || "").trim();
        return symbolMap[chr] || chr;
      case 'f': {
        const num = getChildByTag(el, 'num');
        const den = getChildByTag(el, 'den');
        return `\\frac{${processNode(num)}}{${processNode(den)}}`;
      }
      case 'ssup': {
        const base = getChildByTag(el, 'e');
        const sup = getChildByTag(el, 'sup');
        return `${processNode(base)}^{${processNode(sup)}}`;
      }
      case 'ssub': {
        const base = getChildByTag(el, 'e');
        const sub = getChildByTag(el, 'sub');
        return `${processNode(base)}_{${processNode(sub)}}`;
      }
      case 'ssubsup': {
        const base = getChildByTag(el, 'e');
        const sub = getChildByTag(el, 'sub');
        const sup = getChildByTag(el, 'sup');
        return `${processNode(base)}_{${processNode(sub)}}^{${processNode(sup)}}`;
      }
      case 'rad': {
        const deg = getChildByTag(el, 'deg');
        const e = getChildByTag(el, 'e');
        if (deg && deg.textContent?.trim()) return `\\sqrt[${processNode(deg)}]{${processNode(e)}}`;
        return `\\sqrt{${processNode(e)}}`;
      }
      case 'nary': {
        const pr = getChildByTag(el, 'narypr');
        const sub = getChildByTag(el, 'sub');
        const sup = getChildByTag(el, 'sup');
        const e = getChildByTag(el, 'e');
        const chrVal = pr?.getAttribute('m:chr') || '';
        let op = '\\int';
        if (chrVal === '\u2211' || chrVal === '\u03A3') op = '\\sum';
        else if (chrVal === '\u220F' || chrVal === '\u03A0') op = '\\prod';
        let res = op;
        if (sub) res += `_{${processNode(sub)}}`;
        if (sup) res += `^{${processNode(sup)}}`;
        return `${res} ${processNode(e)}`;
      }
      case 'd': {
        const dPr = getChildByTag(el, 'dpr');
        const open = dPr?.getAttribute('m:begChr') || '(';
        const close = dPr?.getAttribute('m:endChr') || ')';
        const e = getChildByTag(el, 'e');
        return `\\left${open} ${processNode(e)} \\right${close}`;
      }
      case 'm': {
        const rows = getChildrenByTag(el, 'mr');
        const content = rows.map(r => {
          const cells = getChildrenByTag(r, 'e');
          return cells.map(processNode).join(' & ');
        }).join(' \\\\ ');
        return `\\begin{matrix} ${content} \\end{matrix}`;
      }
      case 'eqarr': {
        const rows = getChildrenByTag(el, 'e');
        const content = rows.map(processNode).join(' \\\\ ');
        return `\\begin{array}{l} ${content} \\end{array}`;
      }
      case 'acc': {
        const accPr = getChildByTag(el, 'accpr');
        const chr = accPr?.getAttribute('m:chr') || '';
        const e = getChildByTag(el, 'e');
        if (chr === '\u0307') return `\\dot{${processNode(e)}}`;
        if (chr === '\u0308') return `\\ddot{${processNode(e)}}`;
        if (chr === '\u0304') return `\\bar{${processNode(e)}}`;
        if (chr === '\u0302') return `\\hat{${processNode(e)}}`;
        return processNode(e);
      }
      case 'limlow': return `\\lim_{${processNode(getChildByTag(el, 'lim'))}} ${processNode(getChildByTag(el, 'e'))}`;
      case 'groupchr': return `\\underbrace{${processNode(getChildByTag(el, 'e'))}}`;
      default: return Array.from(el.childNodes).map(processNode).join('');
    }
  };
  if (!mathNode) return "";
  const rawLatex = processNode(mathNode).trim();
  if (!rawLatex) return "";
  return isDisplay ? `\\begin{equation}\n${rawLatex}\n\\end{equation}` : `$${rawLatex}$`;
}

export const maxDuration = 300;
export const runtime = "nodejs";

async function runUploadProcessing(uploadId: string, meta: any) {
  backgroundRunning.add(uploadId);
  try {
    const filePath = path.join(PENDING_DIR, `${uploadId}__${meta.fileName}`);
    let buffer: Buffer | null = await fs.promises.readFile(filePath);
    // Plain file object — the pipeline only uses .name (and occasionally .size).
    const file: any = { name: meta.fileName, size: meta.size };
    // Reconstructed session for the background worker: the original request
    // session is long gone by the time the pipeline finishes. All later code
    // uses session.user.{id,email,name} (read + the FK-remap mutation).
    const session = {
      user: { id: meta.userId, email: meta.email, name: meta.name }
    } as any;
    let templateId = meta.templateId || 'article_lncs';
    let finalLatex = "";
    let finalXml = "";
    const extractedImages: any[] = [];
    console.log("[TELEMETRY] Starting upload processing for:", file.name);
    let deepData: any = null;
    let mammothResult = { value: "" };
    let groundTruth: { imageCount?: number; tableCount: number; equationCount: number } | null = null;

    if (file.name.endsWith('.docx')) {
      console.log("[TELEMETRY] Step 1: Parsing DOCX with AdmZip");

      let zip = new AdmZip(buffer!);
      const documentXml = zip.readAsText('word/document.xml');
      console.log("[TELEMETRY] Step 2: Extracting Math nodes with JSDOM");
      const dom = new JSDOM(documentXml, { contentType: "text/xml" });

      // CRITICAL FIX: querySelectorAll with escaped colons fails in JSDOM for XML namespaces.
      // Use getElementsByTagName which handles namespaced tags correctly.
      const mathParaNodes = Array.from(dom.window.document.getElementsByTagName('m:oMathPara'));
      const mathNodes = Array.from(dom.window.document.getElementsByTagName('m:oMath'));
      const allMathNodes = [...mathParaNodes, ...mathNodes];
      console.log(`[TELEMETRY] Found ${mathParaNodes.length} oMathPara + ${mathNodes.length} oMath = ${allMathNodes.length} total math nodes`);

      const mathData: { latex: string, isDisplay: boolean }[] = [];
      allMathNodes.forEach((node: any) => {
        // HEADING-LIKE MATH GUARD: Word sometimes wraps section headings / titles in
        // OMML math elements (auto-formatting). Extracting those as math turns a
        // heading like "6. AI-Assisted Responsible Citation (ARC) Framework" into a
        // \begin{equation} in the compiled PDF. If the math content reads like a
        // heading (numbered title, or mostly-English words with no math operators),
        // leave the node untouched so mammoth renders it as plain text instead.
        const rawMathText = (node.textContent || '').trim();
        const headingLikeMath =
          rawMathText.length > 0 && (
            /^\s*(?:section|chapter|appendix|part)?\s*\d+(?:\.\d+)*[.\s:]+[A-Za-z]/.test(rawMathText) ||
            /^\d+\.\s+[A-Z]/.test(rawMathText)
          );
        const mathOperatorCount = (rawMathText.match(/[=+\-*/^<>\u2264\u2265\u2248\u2260\u2211\u222B\u221A_α-ωΑ-Ω]/g) || []).length;
        const wordCount = (rawMathText.match(/[A-Za-z]{2,}/g) || []).length;
        const proseLikeMath = rawMathText.length > 15 && mathOperatorCount === 0 && wordCount >= 3;
        if (headingLikeMath || proseLikeMath) return;

        // UNIFIED ROOT FILTER: Only process nodes that are NOT contained within another math node
        let parent: any = node.parentNode;
        let isNested = false;
        let isDisplay = String(node.tagName || "").toLowerCase().includes('omathpara');

        while (parent) {
          const pTag = String(parent.tagName || "").toLowerCase();
          if (pTag === 'm:omath' || pTag === 'm:omathpara') {
            isNested = true;
            if (pTag === 'm:omathpara') isDisplay = true; // Inherit display if ancestor is oMathPara
            break;
          }
          
          const cleanPTag = pTag.replace(/^w:/, '');
          if (cleanPTag === 'p') {
            const pText = (parent.textContent || '').trim();
            const mathText = (node.textContent || '').trim();
            const nonMathText = pText.replace(mathText, '').trim();
            if (nonMathText.length === 0 || /^\s*[\(\d\.\-\s\)]+\s*$/.test(nonMathText)) {
              // PARAM-ASSIGNMENT GUARD (false positive): a standalone paragraph
              // like "LR = 0.001" or "n = 100" typed in Word's equation editor
              // is a parameter assignment, NOT a display equation. Without this,
              // every such line inflates the equation count in the report.
              const isParamAssign = /^[A-Za-z][A-Za-z0-9\s_]{0,35}\s*=\s*-?[\d.,+\-eE%×x*]+\s*$/i.test(mathText) ||
                                    /^[A-Z]{1,6}\s*=\s*-?[\d.,+\-eE%]+$/i.test(mathText) ||
                                    (mathText.replace(/[A-Za-z0-9\s=.\-+_×*x%,()]/g, '').length === 0 && mathText.length < 40 && /^[A-Za-z][A-Za-z0-9_]*\s*=\s*[\d]/.test(mathText));
              if (!isParamAssign) {
                isDisplay = true;
              }
            }
          }
          parent = parent.parentNode;
        }
        if (isNested) return;

        const mathLatex = ommlToLatex(node, isDisplay);
        if (!mathLatex) return;

        const index = mathData.length;
        mathData.push({ latex: mathLatex, isDisplay });
        // CRITICAL: marker name must match what deep-parser & assembler expect: MATHBLOCKX{n}XMARKER
        const marker = `MATHBLOCKX${index}XMARKER`;

        const wrapper = dom.window.document.createElement('w:r');
        const textNode = dom.window.document.createElement('w:t');
        textNode.textContent = marker;
        wrapper.appendChild(textNode);

        node.parentNode?.replaceChild(wrapper, node);
      });

      // SYNC: Update the zip with markers AND unwrapped oMathPara before mammoth reads it
      // First unwrap surviving m:oMathPara wrappers so mammoth does not silently drop our markers
      const oMathParas = dom.window.document.getElementsByTagName('m:oMathPara');
      Array.from(oMathParas).forEach(para => {
        const wp = dom.window.document.createElement('w:p');
        while (para.firstChild) wp.appendChild(para.firstChild);
        para.parentNode?.replaceChild(wp, para);
      });

      // Map chart r:id to fallback raster image relationship ID BEFORE modifying the DOM
      const chartFallbackMap = new Map<string, string>();
      const chartElements = [
        ...Array.from(dom.window.document.getElementsByTagName('c:chart')),
        ...Array.from(dom.window.document.getElementsByTagName('chart')),
      ];

      try {
        chartElements.forEach((chartEl: any) => {
          const chartRId = chartEl.getAttribute('r:id') || chartEl.getAttribute('id');
          if (!chartRId) return;
          
          let parent = chartEl.parentNode;
          while (parent) {
            const pTag = String(parent.tagName || "").toLowerCase().replace(/^mc:/, '');
            if (pTag === 'alternatecontent') {
              break;
            }
            parent = parent.parentNode;
          }
          
          if (parent) {
            // Find mc:fallback tag directly in parent
            const fallbackEl = Array.from(parent.childNodes).find((el: any) => {
              const tag = (el.tagName || '').toLowerCase().replace(/^mc:/, '');
              return tag === 'fallback';
            }) as any;
            
            if (fallbackEl) {
              // Find blips and imagedata directly
              const blips = [
                ...Array.from(fallbackEl.getElementsByTagName('a:blip')),
                ...Array.from(fallbackEl.getElementsByTagName('blip')),
              ];
              const vmlImages = [
                ...Array.from(fallbackEl.getElementsByTagName('v:imagedata')),
                ...Array.from(fallbackEl.getElementsByTagName('imagedata')),
              ];
              let fallbackRId = '';
              
              if (blips.length > 0) {
                fallbackRId = (blips[0] as any).getAttribute('r:embed') || (blips[0] as any).getAttribute('embed') || '';
              }
              if (!fallbackRId && vmlImages.length > 0) {
                fallbackRId = (vmlImages[0] as any).getAttribute('r:id') || (vmlImages[0] as any).getAttribute('id') || '';
              }
              
              if (fallbackRId) {
                chartFallbackMap.set(chartRId, fallbackRId);
                console.log(`[CHART_MAP] Mapped chart ${chartRId} to fallback image relationship ${fallbackRId}`);
              }
            }
          }
        });
      } catch (err) {
        console.warn("[CHART_MAP] Failed to build chart-to-fallback map:", err);
      }

      // UNIVERSAL FIGURE SUPPORT: Mammoth drops complex DrawingML elements (Charts, SmartArt, Shapes, Groups).
      // We look for mc:AlternateContent containing these unsupported elements and replace the entire 
      // block with its mc:Fallback node, which contains a standard image (v:imagedata).
      // This allows Mammoth to natively extract ALL complex figure types as real images!
      const alternateContents = [
        ...Array.from(dom.window.document.getElementsByTagName('mc:AlternateContent')),
        ...Array.from(dom.window.document.getElementsByTagName('AlternateContent')),
        ...Array.from(dom.window.document.getElementsByTagName('mc:alternatecontent')),
        ...Array.from(dom.window.document.getElementsByTagName('alternatecontent')),
      ];

      alternateContents.forEach((alt: any) => {
        const fallbacks = [
          ...Array.from(alt.getElementsByTagName('mc:Fallback')),
          ...Array.from(alt.getElementsByTagName('Fallback')),
          ...Array.from(alt.getElementsByTagName('mc:fallback')),
          ...Array.from(alt.getElementsByTagName('fallback')),
        ];
        const fallback = fallbacks[0] as any;
        if (fallback) {
          // Replace alternate content with its fallback unconditionally to ensure maximum compatibility with Mammoth
          const fragment = dom.window.document.createDocumentFragment();
          while (fallback.firstChild) {
            fragment.appendChild(fallback.firstChild);
          }
          alt.parentNode?.replaceChild(fragment, alt);
        }
      });

      // ===== CHART / GRAPH EXTRACTION ENGINE (Phase 1: DOM-based Marker Injection) =====
      const chartRels: Map<string, string> = new Map(); // rId -> target path
      try {
        const docRelsEntry = zip.getEntry('word/_rels/document.xml.rels');
        if (docRelsEntry) {
          const relsXml = docRelsEntry.getData().toString('utf-8');
          const relMatches = relsXml.matchAll(/Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g);
          for (const rm of relMatches) chartRels.set(rm[1], rm[2]);
        }
      } catch { /* non-critical */ }

      // Map rId -> element for direct lookup
      const rIdToElementMap = new Map<string, any>();
      
      chartElements.forEach((chartEl: any) => {
        for (let i = 0; i < chartEl.attributes.length; i++) {
          const attr = chartEl.attributes[i];
          if (attr.name.toLowerCase().endsWith('id') && attr.value.startsWith('rId')) {
            rIdToElementMap.set(attr.value, chartEl);
            break;
          }
        }
      });

      const vmlElements = [
        ...Array.from(dom.window.document.getElementsByTagName('v:imagedata')),
        ...Array.from(dom.window.document.getElementsByTagName('imagedata')),
      ];

      vmlElements.forEach((vmlEl: any) => {
        for (let i = 0; i < vmlEl.attributes.length; i++) {
          const attr = vmlEl.attributes[i];
          if (attr.name.toLowerCase().endsWith('id') && attr.value.startsWith('rId')) {
            rIdToElementMap.set(attr.value, vmlEl);
            break;
          }
        }
      });

      // Traversal helper: walk up parent node chain to find ancestor and replace it
      const replaceAncestorWithMarker = (targetId: string, markerName: string, ancestorTag: string): boolean => {
        const el = rIdToElementMap.get(targetId);
        if (!el) return false;
        
        let parent = el.parentNode;
        const shortTag = ancestorTag.split(':').pop()!;
        const shortTagLower = shortTag.toLowerCase();
        const ancestorTagLower = ancestorTag.toLowerCase();
        
        while (parent) {
          const tagLower = String(parent.tagName || '').toLowerCase();
          if (tagLower === ancestorTagLower || tagLower.endsWith(':' + shortTagLower)) {
            const wEl = dom.window.document.createElement('w:r');
            const tEl = dom.window.document.createElement('w:t');
            tEl.textContent = `CHARTIMGX${markerName}XEND`;
            wEl.appendChild(tEl);
            parent.parentNode?.replaceChild(wEl, parent);
            return true;
          }
          parent = parent.parentNode;
        }
        return false;
      };

      const chartRIds = new Set<string>(rIdToElementMap.keys());
      const pendingCharts: Array<{ rId: string; target: string; imagePath: string | null; marker: string }> = [];
      let chartIdx = 0;

      for (const chartRId of chartRIds) {
        // Skip VML elements in the first loop (they are processed separately below)
        const matchedEl = rIdToElementMap.get(chartRId);
        if (matchedEl && (matchedEl.tagName || '').toLowerCase().includes('imagedata')) continue;

        const chartTarget = chartRels.get(chartRId);
        const fallbackRId = chartFallbackMap.get(chartRId);
        const fallbackTarget = fallbackRId ? chartRels.get(fallbackRId) : null;
        let chartImagePath: string | null = null;
        let targetType = chartTarget || '';
        if (fallbackTarget) {
          chartImagePath = fallbackTarget;
          targetType = 'vml';
          console.log(`[CHART] Mapped chart ${chartRId} directly to fallback image: ${fallbackTarget}`);
        } else if (chartTarget) {
          const chartRelsPath = chartTarget.replace(/charts\/([^/]+)$/, 'charts/_rels/$1.rels');
          try {
            const chartRelsEntry = zip.getEntry(`word/${chartRelsPath}`);
            if (chartRelsEntry) {
              const chartRelsXml = chartRelsEntry.getData().toString('utf-8');
              const imgRel = chartRelsXml.match(/Relationship[^>]*Type="[^"]*\/image"[^>]*Target="([^"]+)"/);
              if (imgRel) chartImagePath = imgRel[1];
            }
          } catch { /* non-critical */ }
        }
        if (!chartImagePath && !chartTarget) continue;
        const markerName = `chart_pending_${chartIdx++}`;
        pendingCharts.push({ rId: chartRId, target: targetType, imagePath: chartImagePath, marker: markerName });
        replaceAncestorWithMarker(chartRId, markerName, 'w:drawing');
      }

      // VML imagedata: process elements and inject markers
      vmlElements.forEach((vmlEl: any) => {
        let vmlRId = '';
        for (let i = 0; i < vmlEl.attributes.length; i++) {
          const attr = vmlEl.attributes[i];
          if (attr.name.toLowerCase().endsWith('id') && attr.value.startsWith('rId')) { vmlRId = attr.value; break; }
        }
        if (!vmlRId) return;
        const vmlTarget = chartRels.get(vmlRId);
        if (!vmlTarget) return;
        const markerName = `chart_pending_${chartIdx++}`;
        pendingCharts.push({ rId: vmlRId, target: 'vml', imagePath: vmlTarget, marker: markerName });
        replaceAncestorWithMarker(vmlRId, markerName, 'w:pict');
      });

      // NOW SERIALIZE — single serialization after ALL DOM mutations (math + alternateContent + chart markers)
      finalXml = dom.serialize();
      zip.updateFile('word/document.xml', Buffer.from(finalXml));
      const zipBuffer = zip.toBuffer();
      zip = new AdmZip(zipBuffer);
      if (pendingCharts.length > 0) {
        console.log(`[CHART] Injected ${pendingCharts.length} chart/VML position markers via DOM. Serialized once.`);
      }
      // ===== END CHART EXTRACTION ENGINE PHASE 1 =====

      // 1000% Accuracy: Extract ground truth (Semantic + Positional Law)
      const allTbls = Array.from(dom.window.document.getElementsByTagName('w:tbl'));
      const validTables = allTbls.filter((tbl, idx) => {
        const text = (tbl.textContent || "").toLowerCase();
        // Rule 1: Structural Integrity (must be a table with content)
        const rows = tbl.getElementsByTagName('w:tr').length;
        const cells = tbl.getElementsByTagName('w:tc').length;
        const isGrid = (rows >= 1 && cells >= 2);

        // Rule 2: Semantic Exclusion (remove Title/Author tables)
        const hasEmailContext = (text.includes('@') && /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(text));
        const isMetadata = hasEmailContext || text.includes('affiliation') || text.includes('institution') || text.includes('orcid');

        // Rule 3: Positional suppression for Header Region (Template Tables)
        // Only suppress the very first w:tbl if it has very little data content (layout table)
        const isEarly = idx === 0 && text.length < 200 && rows < 3;

        return isGrid && !isMetadata && !isEarly;
      }).length;

      // Ground Truth Equation Count — DISPLAY-ONLY (block-level math, not inline).
      // mathData entries with isDisplay===true correspond to m:oMathPara (standalone equations).
      // Inline m:oMath (within prose) must NOT be counted as standalone equations.
      const finalEquationCount = mathData.filter(m => m.isDisplay).length;

      const imageRefs = new Set();
      const embedMatches = finalXml.matchAll(/r:(?:embed|id)="([^"]+)"/g);
      for (const match of embedMatches) {
        if (match[1].startsWith('rId')) imageRefs.add(match[1]);
      }

      groundTruth = {
        tableCount: Math.max(0, validTables),
        equationCount: finalEquationCount,
      };

      console.log("[TELEMETRY] Step 4: Extracting Images (Parallel Mode)");
      // Fixed: Removed local const declaration of extractedImages to prevent shadowing outer array
      let figIdx = 1;
      console.time("[PERF] Mammoth DOCX Extraction");
      mammothResult = await mammoth.convertToHtml({ buffer: zipBuffer }, {
        convertImage: mammoth.images.imgElement(async (image) => {
          const imgContentType = image.contentType || 'image/png';
          const ext = imgContentType.includes('jpeg') || imgContentType.includes('jpg') ? 'jpg' : 'png';
          const name = `rf_fig_${figIdx++}.${ext}`;

          try {
            // CRITICAL: Await image.read() directly in the main callback to capture the buffer
            // while the zip stream is open and valid.
            const rawBuffer = await image.read();
            const enhancedBuffer = await enhanceImageFor3000Dpi(rawBuffer);
            extractedImages.push({ name, buffer: enhancedBuffer });
            console.log(`[IMAGE] Extracted 3000 DPI enhanced image buffer: ${name}`);
          } catch (readErr) {
            console.error(`[ERROR] Failed to read ZIP entry for image ${name}:`, readErr);
          }

          return { src: name };
        })
      });
      console.timeEnd("[PERF] Mammoth DOCX Extraction");
      progress(uploadId, 'Extracting text and figures', 42);

      // 🛡️ BINARY SAFETY SWEEP: Catch any base64 images that mammoth missed or bypassed
      console.time("[PERF] Binary Safety Sweep");
      const base64Matches = String(mammothResult.value).matchAll(/src="data:image\/([a-zA-Z]*);base64,([^"]*)"/g);
      const replacements: [string, string][] = [];
      for (const match of base64Matches) {
        const ext = match[1] === 'jpeg' ? 'jpg' : (match[1] || 'png');
        const base64Data = match[2];
        const name = `rf_fig_${figIdx++}.${ext}`;
        try {
          const buffer = Buffer.from(base64Data, 'base64');
          if (buffer.length > 0) {
            const enhancedBuffer = await enhanceImageFor3000Dpi(buffer);
            extractedImages.push({ name, buffer: enhancedBuffer });
            replacements.push([match[0], `src="${name}"`]);
          }
        } catch { }
      }

      if (replacements.length > 0) {
        let newValue = mammothResult.value;
        for (const [target, replacement] of replacements) {
          newValue = newValue.replace(target, replacement);
        }
        mammothResult.value = newValue;
      }
      console.timeEnd("[PERF] Binary Safety Sweep");
      progress(uploadId, 'Extracting text and figures', 46);

      // ===== CHART EXTRACTION ENGINE (Phase 2: Image Extraction + Marker Resolution) =====
      console.time("[PERF] Chart Extraction Engine");
      if (pendingCharts.length > 0) {
        const markerToFinalName: Map<string, string> = new Map();

        let chartFileIdx = 1;
        for (const pc of pendingCharts) {
          // Heartbeat per chart: QuickChart conversion can take ~6s per chart
          // and large documents carry dozens — without this the 600s staleness
          // window could still trip and falsely declare the worker dead.
          heartbeat(uploadId, `Processing chart ${chartFileIdx}/${pendingCharts.length}`, 50);
          const isTrueChart = pc.target.includes('charts/');
          const chartName = isTrueChart ? `rf_chart_${chartFileIdx++}.png` : `rf_fig_${figIdx++}.png`;
          markerToFinalName.set(pc.marker, chartName);

          let chartImagePath = pc.imagePath;
          if (chartImagePath) {
            const resolvedPath = pc.target === 'vml'
              ? `word/${chartImagePath.replace(/^\.\.\//, '')}`.replace(/\/+/g, '/')
              : `word/${pc.target.replace(/charts\/[^/]+$/, '')}${chartImagePath.replace(/^\.\.\//, '')}`.replace(/\/+/g, '/');
            if (isTrueChart) {
              // TRUE CHARTS: skip ZIP extraction — QuickChart generates far higher resolution
              // from the OOXML chart data (3600x2400px @ 3x DPR vs 72-150 DPI screen captures).
              chartImagePath = null;
            } else {
              // VML CHART FALLBACK: only embedded raster images available, no OOXML for QuickChart.
              try {
                const imgEntry = zip.getEntry(resolvedPath);
                if (imgEntry) {
                  const rawBuf = imgEntry.getData();
                  let processedBuf: Buffer | null = null;
                  
                  try {
                    if (rawBuf.length < 2000) {
                      throw new Error("Image too small, likely a transparent VML spacer");
                    }
                    processedBuf = rawBuf;
                    extractedImages.push({ name: chartName, buffer: processedBuf });
                    console.log(`[CHART] Extracted VML chart image: ${chartName} from ${resolvedPath}`);
                  } catch {
                    // ZIP Raster Sibling Search
                    const dotIdx = resolvedPath.lastIndexOf('.');
                    const baseWithoutExt = dotIdx !== -1 ? resolvedPath.substring(0, dotIdx) : resolvedPath;
                    console.log(`[CHART] Failed to extract raw buffer. Searching for raster fallbacks in ZIP for: ${baseWithoutExt}`);
                    
                    for (const tryExt of ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG']) {
                      const fallbackEntry = zip.getEntry(baseWithoutExt + tryExt);
                      if (fallbackEntry) {
                        const fallBuf = fallbackEntry.getData();
                        if (fallBuf.length >= 2000) {
                          processedBuf = fallBuf;
                          extractedImages.push({ name: chartName, buffer: processedBuf });
                          console.log(`[CHART] Successfully recovered raster fallback from ZIP: ${baseWithoutExt + tryExt}`);
                          break;
                        }
                      }
                    }
                    
                    if (!processedBuf) {
                      console.warn(`[CHART] No usable raster fallback in ZIP.`);
                      chartImagePath = null;
                    }
                  }
                } else { chartImagePath = null; }
              } catch { chartImagePath = null; }
            }
          }

          if (!chartImagePath) {
            if (isTrueChart) {
              const xmlPath = `word/${pc.target.replace(/^\.\.\//, '')}`.replace(/\/+/g, '/');
              const xmlEntry = zip.getEntry(xmlPath);
              if (xmlEntry) {
                console.log(`[CHART] Extracting OOXML chart data for QuickChart conversion: ${xmlPath}`);
                const xmlContent = xmlEntry.getData().toString('utf8');
                const pngBuf = await generateChartImageFromXml(xmlContent);
                if (pngBuf) {
                  extractedImages.push({ name: chartName, buffer: pngBuf });
                  console.log(`[CHART] Successfully generated QuickChart PNG for ${chartName}`);
                  continue;
                }
              }
            }
            
            // Standard SVG placeholder if all fails
            extractedImages.push({ name: chartName, buffer: getFallbackPngBuffer() });
          }
        }

        // Resolve CHARTIMGX markers to final rf_fig_N.png names
        if (mammothResult.value.includes('CHARTIMGX')) {
          mammothResult.value = mammothResult.value.replace(
            /CHARTIMGX(chart_pending_\d+)XEND/g,
            (_, markerName) => {
              const finalName = markerToFinalName.get(markerName) || markerName;
              return `<img src="${finalName}" alt="Chart" />`;
            }
          );
          console.log('[CHART] Resolved chart markers to <img> tags in Mammoth HTML');
        }
      }

      // ---------------------------------------------------------
      // BATCH PROCESS EMFs
      // ---------------------------------------------------------
      const emfTasks = extractedImages.filter((img: any) => img.needsEmfConversion);
      if (emfTasks.length > 0) {
        console.log(`[PERF] Batch converting ${emfTasks.length} EMF images...`);
        const batchResults = await convertEmfToPngWindowsBatchAsync(emfTasks.map(t => t.buffer));
        for (let i = 0; i < emfTasks.length; i++) {
          const pngBuf = batchResults[i];
          if (pngBuf) {
            emfTasks[i].buffer = pngBuf;
            emfTasks[i].name = emfTasks[i].name.replace(/\.emf$/i, '.png');
            emfTasks[i].isStructural = false;
            emfTasks[i].needsEmfConversion = false;
            console.log(`[IMAGE] Successfully batch converted EMF: ${emfTasks[i].name}`);
          }
          
          if (!pngBuf) {
            emfTasks[i].buffer = getFallbackPngBuffer();
            emfTasks[i].name = emfTasks[i].name.replace(/\.emf$/i, '.png');
            emfTasks[i].isStructural = false;
            emfTasks[i].needsEmfConversion = false;
            console.log(`[CHART] Generated placeholder fallback for failed EMF: ${emfTasks[i].name}`);
          }
        }
      }
      // ===== END CHART EXTRACTION ENGINE PHASE 2 =====

      // DEDUPLICATION GUARD: Eliminate any duplicate image names before committing
      const seenImageNames = new Set<string>();
      const deduplicatedImages: typeof extractedImages = [];
      for (const img of extractedImages) {
        if (!seenImageNames.has(img.name)) {
          seenImageNames.add(img.name);
          deduplicatedImages.push(img);
        }
      }
      extractedImages.length = 0;
      extractedImages.push(...deduplicatedImages);
      console.timeEnd("[PERF] Chart Extraction Engine");

      // MEMORY STAGING (huge-file/OOM fix): extracted image buffers can total
      // hundreds of MB for a large DOCX (Reward: each is held in RAM through AI
      // analysis + assembly + persistence). Write NON-structural image buffers
      // to a staging dir NOW and keep only the path — persistence later copies
      // the staged file instead of holding every buffer in memory, which is what
      // pushed single instances over Render's RAM cap and OOM-killed the whole
      // process (surfacing as the "processing was lost" error).
      const stagingDir = path.join(PENDING_DIR, `${uploadId}_staging`);
      fs.mkdirSync(stagingDir, { recursive: true });
      for (const img of extractedImages) {
        if ((img as any).isStructural || !img.buffer) continue;
        if (img.buffer.length === 0) continue;
        const stagedName = img.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const stagedPath = path.join(stagingDir, stagedName);
        await fs.promises.writeFile(stagedPath, img.buffer);
        (img as any).stagedPath = stagedPath;
        img.buffer = null; // release for GC
      }
      progress(uploadId, 'Extracting text and figures', 48);

      console.log(`[TELEMETRY] Extraction complete. Final image count: ${extractedImages.length}`);

      console.log("[TELEMETRY] Step 5: Deep Structural Analysis");
      console.time("[PERF] Deep Structural Analysis");
      deepData = DeepDocumentParser.parse(mammothResult.value, mathData, file.name || "Document", groundTruth, finalXml);
      console.timeEnd("[PERF] Deep Structural Analysis");
      progress(uploadId, 'Analyzing document structure', 55);

      const placeholders = deepData.body.filter((n: any) => (n.type === 'figure' || n.type === 'chart') && n.id?.startsWith('chart_pending_'));
      if (placeholders.length > 0) {
        console.log(`[TELEMETRY] Generating ${placeholders.length} physical placeholders for missing charts.`);
        for (const p of placeholders) {
          extractedImages.push({ name: p.id, buffer: getFallbackPngBuffer() });
        }
      }

      // --- AI-ASSISTED STRUCTURAL VERIFICATION ---
      // Second opinion from the AI backend: verifies/corrects title, authors,
      // affiliations, abstract, keywords, section hierarchy, component counts
      // and references BEFORE modular assembly, so the mapped/flushed LaTeX
      // files carry the corrected structure. Heuristics remain the fallback.
      try {
        const { analyzeManuscriptStructure, applyStructureCorrections } = await import('@/lib/ai-manuscript-analysis');
        const imageNames = extractedImages
          .filter((img: any) => !(img as any).isStructural && /\.(png|jpe?g|webp|gif|pdf|eps|svg|heic|heif|tiff?|bmp|avif)$/i.test(img.name))
          .map((img: any) => img.name);
        const aiRes = await Promise.race([
          analyzeManuscriptStructure(deepData, {
            html: mammothResult.value,
            filename: file.name,
            userId: (session?.user as any)?.id ?? null,
            imageFiles: imageNames,
            templateId: templateId,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 14000))
        ]);
        if (aiRes) {
          const { applied } = applyStructureCorrections(deepData, aiRes.verdict, aiRes.model);
          if (aiRes.aiLatex) (deepData as any).aiLatex = aiRes.aiLatex;
          (deepData as any).aiVerdict = aiRes.verdict;
          (deepData as any).aiModel = aiRes.model;
          console.log(`[TELEMETRY] AI structure corrections applied: ${applied.join(', ') || 'none'} (${aiRes.model})`);
        } else {
          console.warn('[TELEMETRY] AI structural analysis timed out or unavailable — keeping heuristic parse.');
        }
      } catch (aiErr: any) {
        console.warn('[AI-STRUCTURE] AI structural analysis failed (non-critical):', aiErr?.message || aiErr);
      }

      progress(uploadId, 'Analyzing document structure', 65);
      // XML GROUND-TRUTH OVERRIDE: the DOCX XML table/equation counts (validTables,
      // finalEquationCount) are exact — layout/metadata tables and parameter
      // assignments are already excluded there. Body-walk counts can over-count
      // (comma-separated numeric lines parsed as tables, headings wrapped in
      // OMML counted as equations), so the XML ground truth wins when present.
      if (typeof validTables === 'number' && validTables > 0) {
        deepData.stats.tableCount = validTables;
      }
      if (typeof finalEquationCount === 'number' && finalEquationCount > 0) {
        // XML display-math count is exact (heading-like OMML and parameter
        // assignments are excluded upstream) — it wins over any AI/heuristic count.
        deepData.stats.equationCount = finalEquationCount;
      }
      // --- END AI-ASSISTED STRUCTURAL VERIFICATION ---

      // --- BIBLIOGRAPHY EXTRACTION ---
      console.time("[PERF] Bibliography Extraction");
      const bibContent = extractBibliography(zip);
      if (bibContent) {
        extractedImages.push({
          name: 'references.bib',
          buffer: Buffer.from(bibContent),
          isStructural: true
        });
        console.log("[TELEMETRY] Bibliography extracted and queued for persistence.");
      }
      console.timeEnd("[PERF] Bibliography Extraction");

      // Release the heavy raw buffers for GC: the DOM, AdmZip and raw file
      // buffer are no longer needed past bibliography extraction. The staged
      // images (on disk) and deepData are what the rest of the pipeline uses.
      buffer = null;
      (zip as any) = null;
      try { (dom as any)?.window?.close?.(); } catch { /* non-critical */ }

      console.log("[TELEMETRY] Step 6: Modular LaTeX Assembly");
      console.time("[PERF] Modular LaTeX Assembly");
      // Choose template based on filename, defaulting to llncs for standard academic papers
      // NOTE: templateId is declared in outer scope so asset injection can use it
      if (file.name.toUpperCase().includes('IEEE')) templateId = 'article_ieee';
      else if (file.name.toUpperCase().includes('ACM')) templateId = 'article_acm';


      let templateMainTex: string | undefined = undefined;
      try {
        const { getTemplateById, mapLegacyTemplateId } = require('@/lib/templates/registry');
        const tpl = getTemplateById(mapLegacyTemplateId(templateId));
        if (tpl && tpl.assetFolder) {
          const mainPath = path.join(process.cwd(), 'src', 'assets', 'templates', tpl.assetFolder, 'main.tex');
          if (fs.existsSync(mainPath)) {
            templateMainTex = fs.readFileSync(mainPath, 'utf-8');
            console.log(`[TELEMETRY] Native template preamble found for ${templateId} (${tpl.assetFolder})`);
          }
        }
      } catch (err) {
        console.warn("[TELEMETRY] Failed to load template registry or main.tex for upload preview:", err);
      }

      const modular = ModularLatexAssembler.assemble(deepData, templateId, templateMainTex || { hasBibFile: !!bibContent });
      finalLatex = modular.mainTex;
      // Attach modular files so asset persistence block can write them to disk + DB
      (deepData as any).modularComponents = modular.files;

      // BIBLIOGRAPHY MERGE: when the DOCX carried a native references.bib AND
      // the assembler generated its own (refN + author-year alias entries for
      // our in-text \cite{refN}/\cite{AuthorYear} keys), the native file wins
      // the filename at persistence — leaving our citation keys with no bib
      // entries (renders as "[?]" with a blank references section). Append the
      // generated entries (deduped by key) to the native file.
      const genBibPath = modular.files && typeof modular.files['references/references.bib'] === 'string'
        ? modular.files['references/references.bib']
        : null;
      const nativeBibIdx = extractedImages.findIndex((img: any) => img.name === 'references.bib');
      if (genBibPath && nativeBibIdx !== -1) {
        try {
          const nativeText = extractedImages[nativeBibIdx].buffer.toString('utf-8') || '';
          const nativeKeys = new Set(
            (nativeText.match(/@\w+\s*\{\s*([^,\s]+)/g) || [])
              .map((k: string) => k.replace(/@\w+\s*\{\s*/, '').trim())
          );
          const genEntries = (genBibPath.split('\n\n') || []).filter((e: string) => {
            const km = e.match(/@\w+\s*\{\s*([^,\s]+)/);
            return km && !nativeKeys.has(km[1].trim());
          });
          if (genEntries.length > 0) {
            extractedImages[nativeBibIdx].buffer = Buffer.from(`${nativeText}\n\n${genEntries.join('\n\n')}`, 'utf-8');
            console.log(`[TELEMETRY] Merged ${genEntries.length} assembler-generated bib entries into native references.bib.`);
          }
        } catch (bibMergeErr) {
          console.warn('[TELEMETRY] Bibliography merge failed (non-critical):', bibMergeErr);
        }
      }
      console.timeEnd("[PERF] Modular LaTeX Assembly");
      progress(uploadId, 'Assembling LaTeX project', 74);

    } else if (file.name.endsWith('.txt')) {
      const text = buffer!.toString('utf-8');
      deepData = {
        title: file.name,
        authors: [],
        keywords: [],
        abstract: "",
        contribution: "",
        body: [{ type: 'paragraph', text }],
        references: [],
        stats: {
          wordCount: text.split(/\s+/).length,
          charCount: text.length,
          imageCount: 0,
          tableCount: 0,
          equationCount: 0,
          referenceCount: 0,
          citationCount: 0,
          pseudocodeCount: 0
        }
      };
      const txtAssembled = LatexAssembler.assemble(deepData);
      finalLatex = txtAssembled.mainTex;
      // Persist all section files generated by the assembler
      (deepData as any).modularComponents = txtAssembled.files;
    } else if (file.name.endsWith('.tex')) {
      const text = buffer!.toString('utf-8');
      finalLatex = text;
      deepData = {
        title: file.name,
        authors: [],
        keywords: [],
        abstract: "Imported from LaTeX source.",
        contribution: "",
        body: [{ type: 'paragraph', text: "Raw LaTeX source imported." }],
        references: [],
        stats: {
          wordCount: text.split(/\s+/).length,
          charCount: text.length,
          imageCount: 0,
          tableCount: 0,
          equationCount: 0,
          referenceCount: 0,
          citationCount: 0,
          pseudocodeCount: 0
        }
      };
    } else if (file.name.endsWith('.pdf')) {
      console.log("[TELEMETRY] Step 1: PDF text extraction via pdfjs");
      let pdfText = "";
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = '';
        // @ts-ignore
        pdfjs.GlobalWorkerOptions.workerPort = null;
        const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(buffer!) }).promise;
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          const pageWidth = viewport.width || 612;
          const content = await page.getTextContent();
          
          interface PdfItem { str: string; x: number; y: number; width: number }
          const items: PdfItem[] = [];
          content.items.forEach((item: any) => {
            if (!('str' in item) || !item.str.trim()) return;
            const x = item.transform?.[4] || 0;
            const y = item.transform?.[5] || 0;
            items.push({ str: item.str, x, y, width: item.width || 0 });
          });

          if (items.length === 0) continue;

          // Group items into baseline lines (Y tolerance = 3.5 points)
          const lines: { y: number; items: PdfItem[] }[] = [];
          items.sort((a, b) => b.y - a.y);
          for (const item of items) {
            let placed = false;
            for (const line of lines) {
              if (Math.abs(line.y - item.y) <= 3.5) {
                line.items.push(item);
                placed = true;
                break;
              }
            }
            if (!placed) {
              lines.push({ y: item.y, items: [item] });
            }
          }

          // Sort items in each line left-to-right (X ascending)
          lines.forEach(l => l.items.sort((a, b) => a.x - b.x));

          // Detect two-column layout: items present on both left and right sides of page center
          const midX = pageWidth / 2;
          const leftItems = items.filter(it => it.x < midX - 20);
          const rightItems = items.filter(it => it.x > midX + 20);
          const isTwoColumn = leftItems.length > 10 && rightItems.length > 10;

          if (isTwoColumn) {
            // Classify lines into Header, Left Column, Right Column, Footer
            const headerLines: string[] = [];
            const leftColLines: string[] = [];
            const rightColLines: string[] = [];
            const footerLines: string[] = [];

            const maxY = Math.max(...lines.map(l => l.y));
            const minY = Math.min(...lines.map(l => l.y));

            lines.forEach(l => {
              const lineText = l.items.map(it => it.str).join(' ');
              const lineMinX = Math.min(...l.items.map(it => it.x));
              const lineMaxX = Math.max(...l.items.map(it => it.x + it.width));
              const isFullWidth = (lineMaxX - lineMinX) > (pageWidth * 0.6);

              if (isFullWidth || l.y > maxY - 72) {
                // Top header / full-width title / abstract
                headerLines.push(lineText);
              } else if (l.y < minY + 36) {
                // Bottom footer / page numbers
                footerLines.push(lineText);
              } else {
                // Determine column: if all items are on the left side vs right side
                const avgX = l.items.reduce((s, it) => s + it.x, 0) / l.items.length;
                if (avgX < midX) {
                  leftColLines.push(lineText);
                } else {
                  rightColLines.push(lineText);
                }
              }
            });

            // Reassemble in reading order: Header -> Left Column -> Right Column -> Footer
            const pageTextOrder = [...headerLines, ...leftColLines, ...rightColLines, ...footerLines];
            pdfText += pageTextOrder.join('\n') + '\n\n';
          } else {
            // Single column: top-to-bottom lines
            const pageTextOrder = lines.map(l => l.items.map(it => it.str).join(' '));
            pdfText += pageTextOrder.join('\n') + '\n\n';
          }
        }
      } catch (e: any) {
        console.error('[PDF_EXTRACT]', e.message);
      }

      // Delegate to the NLP-enhanced DeepDocumentParser for robust PDF phase-scanning
      const pdfLines = pdfText.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const { DeepDocumentParser: PdfParser } = await import('@/lib/deep-parser');
      deepData = PdfParser.parsePdfText(pdfLines);

      // AI-ASSISTED STRUCTURAL VERIFICATION for PDF path (non-blocking of pipeline)
      try {
        const { analyzeManuscriptStructure, applyStructureCorrections } = await import('@/lib/ai-manuscript-analysis');
        const aiRes = await Promise.race([
          analyzeManuscriptStructure(deepData, {
            pdfText,
            filename: file.name,
            userId: (session?.user as any)?.id ?? null,
            imageFiles: [],
            templateId: templateId,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 14000))
        ]);
        if (aiRes) {
          const { applied } = applyStructureCorrections(deepData, aiRes.verdict, aiRes.model);
          if (aiRes.aiLatex) (deepData as any).aiLatex = aiRes.aiLatex;
          (deepData as any).aiVerdict = aiRes.verdict;
          (deepData as any).aiModel = aiRes.model;
          console.log(`[TELEMETRY] PDF AI structure corrections applied: ${applied.join(', ') || 'none'} (${aiRes.model})`);
        }
      } catch (aiErr: any) {
        console.warn('[AI-STRUCTURE] PDF AI structural analysis failed (non-critical):', aiErr?.message || aiErr);
      }

      const { ModularLatexAssembler: PdfAssembler } = await import('@/lib/assembler');
      let pdfTemplateMainTex: string | undefined = undefined;
      try {
        const { getTemplateById, mapLegacyTemplateId } = require('@/lib/templates/registry');
        const tpl = getTemplateById(mapLegacyTemplateId(templateId));
        if (tpl && tpl.assetFolder) {
          const mainPath = path.join(process.cwd(), 'src', 'assets', 'templates', tpl.assetFolder, 'main.tex');
          if (fs.existsSync(mainPath)) {
            pdfTemplateMainTex = fs.readFileSync(mainPath, 'utf-8');
            console.log(`[TELEMETRY] Native PDF template preamble found for ${templateId} (${tpl.assetFolder})`);
          }
        }
      } catch (err) {
        console.warn("[TELEMETRY] Failed to load template registry for PDF upload:", err);
      }

      const pdfModular = PdfAssembler.assemble(deepData as any, templateId, pdfTemplateMainTex || { hasBibFile: false });
      finalLatex = pdfModular.mainTex;
      // CRITICAL FIX: attach modular files so they are persisted to disk + DB
      (deepData as any).modularComponents = pdfModular.files;
    } else if (file.name.endsWith('.zip')) {
      console.log("[TELEMETRY] Step 1: Processing ZIP Project Intake");
      const zip = new AdmZip(buffer!);
      const entries = zip.getEntries();

      // Preliminary main.tex discovery
      const mainTexEntry = entries.find(e => e.entryName === 'main.tex') || entries.find(e => e.entryName.endsWith('.tex') && !e.entryName.includes('/'));
      finalLatex = mainTexEntry ? zip.readAsText(mainTexEntry) : "% Imported ZIP Project\n% No main.tex found.";

      // Scan and prepare all project assets
      entries.forEach(entry => {
        if (entry.isDirectory) return;
        const entryName = entry.entryName;
        const ext = path.extname(entryName).toLowerCase().substring(1);
        const isStructural = /^(tex|cls|sty|bib|bst|cfg|clo|def|fd|ldf|tikz|lua)$/i.test(ext);
        const isBinary = /^(png|jpg|jpeg|webp|gif|pdf|eps|otf|ttf|woff|woff2|tfm|pfb|afm|heic|heif|tiff|tif|bmp|avif|svg)$/i.test(ext);

        if (isStructural || isBinary) {
          extractedImages.push({
            name: entryName,
            buffer: entry.getData(),
            isStructural: isStructural
          });
        }
      });

      deepData = {
        title: file.name,
        authors: [],
        keywords: [],
        abstract: "Imported from ZIP archive.",
        contribution: "",
        body: [{ type: 'paragraph', text: `Project structure imported from ZIP. Total assets: ${extractedImages.length}` }],
        references: [],
        stats: { wordCount: 0, charCount: 0, imageCount: extractedImages.length, tableCount: 0, equationCount: 0, referenceCount: 0, citationCount: 0, pseudocodeCount: 0 }
      };
    } else {
      return NextResponse.json({ error: 'Unsupported format. Please upload .docx, .txt, .tex, .pdf, or .zip' }, { status: 400 });
    }

    console.log(`[TELEMETRY] FINAL STATS BEFORE NLP SYNC — title:"${deepData.title}"`);

    // --- UNIFIED NLP STATS SYNC ---
    // Strategy: HTML/PDF parser (deepData.stats) is authoritative for PROSE metrics
    // (wordCount, charCount) because it parses clean extracted text.
    // LaTeX parser (calculateDocumentStats) is authoritative for STRUCTURAL metrics
    // (tables, equations, citations, references, algorithms, images) because it
    // can see the full assembled template structure.
    const { calculateDocumentStats } = await import('@/lib/stats');
    
    let consolidatedLatex = finalLatex;
    const activeModularComponents = (deepData as any).modularComponents as Record<string, string> | undefined;
    const zipComponents: Record<string, string> = {};
    if (extractedImages && extractedImages.length > 0) {
      for (const img of extractedImages) {
        if ((img as any).isStructural) {
          try {
            zipComponents[img.name] = img.buffer.toString('utf-8');
          } catch {}
        }
      }
    }

    const getComponentContent = (cleanPath: string): string | undefined => {
      if (activeModularComponents) {
        const content = activeModularComponents[cleanPath] || activeModularComponents[cleanPath.replace(/\.tex$/, '')];
        if (content !== undefined) return content;
      }
      const content = zipComponents[cleanPath] || zipComponents[cleanPath.replace(/\.tex$/, '')];
      if (content !== undefined) return content;
      for (const key of Object.keys(zipComponents)) {
        if (key.endsWith(cleanPath) || key.endsWith(cleanPath + '.tex')) {
          return zipComponents[key];
        }
      }
      return undefined;
    };

    let replaced = true;
    let iterations = 0;
    while (replaced && iterations < 10) {
      replaced = false;
      iterations++;
      consolidatedLatex = consolidatedLatex.replace(/\\input\{([^}]+)\}/g, (match, pathVal) => {
        let cleanPath = pathVal.trim();
        if (!cleanPath.endsWith('.tex') && !cleanPath.includes('.')) cleanPath += '.tex';
        const content = getComponentContent(cleanPath);
        if (content !== undefined) {
          replaced = true;
          return content;
        }
        return match;
      });
      consolidatedLatex = consolidatedLatex.replace(/\\include\{([^}]+)\}/g, (match, pathVal) => {
        let cleanPath = pathVal.trim();
        if (!cleanPath.endsWith('.tex') && !cleanPath.includes('.')) cleanPath += '.tex';
        const content = getComponentContent(cleanPath);
        if (content !== undefined) {
          replaced = true;
          return content;
        }
        return match;
      });
    }

    const latexStats = calculateDocumentStats(consolidatedLatex);
    // Count only true binary image files (not .bib/.cls/.sty structural files)
    const actualImageFiles = extractedImages.filter(img => !(img as any).isStructural && /\.(png|jpe?g|webp|gif|pdf|eps|svg|heic|heif|tiff|tif|bmp|avif)$/i.test(img.name));
    const actualChartFiles = actualImageFiles.filter(img => /rf_chart_|chart_pending_/i.test(img.name));
    const actualFigureFiles = actualImageFiles.filter(img => !/rf_chart_|chart_pending_/i.test(img.name));

    let bibRefCount = 0;
    if (extractedImages && extractedImages.length > 0) {
      for (const img of extractedImages) {
        if (img.name.endsWith('.bib')) {
          try {
            const bibText = img.buffer.toString('utf-8');
            const matches = bibText.match(/@\s*[a-zA-Z]+\s*\{\s*[^,\s]+/g);
            if (matches) bibRefCount += matches.length;
          } catch {}
        }
      }
    }
    if (activeModularComponents) {
      for (const [filename, content] of Object.entries(activeModularComponents)) {
        if (filename.endsWith('.bib') && typeof content === 'string') {
          const matches = content.match(/@\s*[a-zA-Z]+\s*\{\s*[^,\s]+/g);
          if (matches) {
            bibRefCount = Math.max(bibRefCount, matches.length);
          }
        }
      }
    }

    const aiComp = (deepData as any).aiStructure?.components as
      | { figures?: number | null; charts?: number | null; tables?: number | null; equations?: number | null; pseudocode?: number | null; citations?: number | null; references?: number | null }
      | undefined;
    // When the AI full-document analysis ran, its verified counts are the
    // authoritative ground truth (exact, not raise-only). Fall back to the
    // inclusive Math.max semantics only when the AI pass did not provide a
    // count for a given component.
    const aiPick = (key: keyof NonNullable<typeof aiComp>, fallback: number): number => {
      const v = aiComp ? aiComp[key] : undefined;
      return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
    };

    const refCountFinal = aiPick('references', Math.max(deepData.stats.referenceCount || 0, latexStats.referenceCount || 0, bibRefCount));
    const citCountFinal = aiPick('citations', Math.max(deepData.stats.citationCount || 0, latexStats.citationCount || 0));

    deepData.stats = {
      ...deepData.stats,
      wordCount:       Math.max(deepData.stats.wordCount || 0, latexStats.wordCount || 0),
      charCount:       Math.max(deepData.stats.charCount || 0, latexStats.charCount || 0),
      imageCount:      Math.min(aiPick('figures', Math.max(deepData.stats.imageCount || 0, latexStats.imageCount || 0, actualFigureFiles.length)), actualFigureFiles.length),
      tableCount:      aiPick('tables', Math.max(deepData.stats.tableCount || 0, latexStats.tableCount || 0)),
      // AI-verified exact counts win over the HTML/LaTeX maxima
      equationCount:   aiPick('equations', Math.max(deepData.stats.equationCount || 0, latexStats.equationCount || 0)),
      citationCount:   citCountFinal,
      referenceCount:  refCountFinal,
      pseudocodeCount: aiPick('pseudocode', Math.max(deepData.stats.pseudocodeCount || 0, latexStats.pseudocodeCount || 0)),
      chartCount:      Math.min(aiPick('charts', Math.max(deepData.stats.chartCount || 0, latexStats.chartCount || 0, actualChartFiles.length)), actualChartFiles.length),
    };

    // --- DB PERSISTENCE ---
    console.log("[TELEMETRY] Step 7: DB Persistence (Hardened Path)");
    progress(uploadId, 'Saving project data', 82);

    // PocketBase editor/json fields default to a 5MB content limit; large DOCX
    // payloads (rawHtml + rawXml + parsed structure) routinely exceed it and PB
    // rejects the create with "Failed to create record." Raise the field limits
    // first, then defensively trim the payload to fit the effective limit.
    const pbContentLimit = await ensureContentSizeLimits();
    const structuredJsonBudget = pbContentLimit - 2 * 1024 * 1024;

    const structuredWithXml = JSON.stringify({ ...deepData, rawHtml: mammothResult.value, rawXml: finalXml });
    let structuredJson: string = structuredWithXml;
    if (Buffer.byteLength(structuredWithXml, 'utf8') > structuredJsonBudget) {
      // Pathological document: drop the raw XML (only used for template
      // re-parses — the route falls back to LaTeX there), then cap rawHtml.
      const withoutXml = JSON.stringify({ ...deepData, rawHtml: mammothResult.value });
      if (Buffer.byteLength(withoutXml, 'utf8') <= structuredJsonBudget) {
        structuredJson = withoutXml;
      } else {
        const baseJson = JSON.stringify({ ...deepData, rawHtml: '' });
        const htmlBudget = Math.max(256 * 1024, structuredJsonBudget - Buffer.byteLength(baseJson, 'utf8'));
        const fullHtml = String(mammothResult.value || '');
        structuredJson = JSON.stringify({
          ...deepData,
          rawHtml: fullHtml.length > htmlBudget ? fullHtml.slice(0, htmlBudget) : fullHtml,
        });
      }
      console.warn(`[TELEMETRY] structuredContent trimmed to ${Buffer.byteLength(structuredJson, 'utf8')} bytes (PB limit ${pbContentLimit})`);
    }

    // SAFETY NET: Ensure the user row exists in the DB before creating a project.
    // This prevents FK constraint violations when the DB was wiped/migrated but
    // the client still holds a valid JWT with the old user ID.
    const sessionUserId: string = (session.user as any).id;
    const sessionUserEmail: string = session.user.email || `user_${sessionUserId}@latexify.io`;
    const sessionUserName: string = session.user.name || "User";
    console.log(`[TELEMETRY] Session userId: ${sessionUserId}, email: ${sessionUserEmail}`);

    const existingUser = await prisma.user.findUnique({ where: { id: sessionUserId } });
    if (!existingUser) {
      console.warn(`[TELEMETRY] User row missing for id=${sessionUserId} — upserting now to satisfy FK constraint`);
      // Check if email conflicts with another row
      const emailConflict = await prisma.user.findUnique({ where: { email: sessionUserEmail } });
      if (emailConflict) {
        // Use the existing row's ID — remap the session to this user
        console.warn(`[TELEMETRY] Email ${sessionUserEmail} belongs to another user (id=${emailConflict.id}), using that id`);
        (session.user as any).id = emailConflict.id;
      } else {
        // PB's users collection requires password + passwordConfirm on create.
        // Generate a random unrecoverable password — the user authenticates
        // through their original auth provider, this row only satisfies the
        // projects.userId relation FK.
        const generatedPassword = randomBytes(24).toString('hex');
        try {
          await prisma.user.create({
            data: {
              id: sessionUserId,
              name: sessionUserName,
              email: sessionUserEmail,
              password: generatedPassword,
              passwordConfirm: generatedPassword,
              points: 50,
              theme: "dark",
            },
          });
        } catch (createErr: any) {
          // The user row may have appeared between our check and this create
          // (race or the check failed transiently) — re-verify before failing.
          const recheck = await prisma.user.findUnique({ where: { id: sessionUserId } });
          if (!recheck) throw createErr;
          console.warn(`[TELEMETRY] User row for id=${sessionUserId} appeared during safety-net create, continuing`);
        }
        console.log(`[TELEMETRY] Created missing user row for id=${sessionUserId}`);
      }
    }

    // Latex content guard: keep the assembled LaTeX under the raised PB field
    // limit (only triggers for pathological documents; modular components
    // remain on disk + in project_files so the editor can still open it).
    let latexContentForDb: string = finalLatex;
    if (Buffer.byteLength(finalLatex, 'utf8') > pbContentLimit) {
      const budget = Math.max(1024 * 1024, pbContentLimit - 2048);
      latexContentForDb = finalLatex.slice(0, budget) + "\n% [CONTENT TRIMMED BY LIMIT]\n";
      console.warn(`[TELEMETRY] latexContent trimmed to ${Buffer.byteLength(latexContentForDb, 'utf8')} bytes (PB limit ${pbContentLimit})`);
    }

    // ── RESUME CHECKPOINT (crash-recovery idempotency) ──────────────────────
    // If a previous worker run created the project row but died before
    // finishing (OOM/deploy), a re-kicked run MUST adopt that project instead
    // of creating a duplicate. The checkpoint is written immediately after
    // create() below.
    let resumeProjectId: string | null = null;
    try {
      const cp = readCheckpoint(uploadId);
      if (cp?.projectId) {
        const existing = await prisma.project.findUnique({
          where: { id: cp.projectId },
          select: { id: true }
        });
        if (existing) resumeProjectId = existing.id;
      }
    } catch (cpErr) {
      console.warn('[UPLOAD] Checkpoint probe failed (non-fatal):', cpErr);
    }
    if (resumeProjectId) {
      console.log(`[UPLOAD-RESUME] Adopting checkpointed project ${resumeProjectId} (previous worker died after project creation).`);
    }

    const project = resumeProjectId
      ? { id: resumeProjectId }
      : await prisma.project.create({
      data: {
        userId: session.user.id,
        title: (deepData.title || file.name).trim(),
        originalFilename: file.name,
        latexContent: latexContentForDb,
        structuredContent: structuredJson,
        status: "draft",
        projectType: file.name.endsWith('.docx') ? "DOC2LATEX" : "LATEX_STUDIO",
        // SANITIZE: Ensure all stats are valid non-negative integers (defensive fallback for AI reconciliation edge cases)
        wordCount: Math.max(1, Math.floor(deepData.stats?.wordCount || 0)),
        charCount: Math.max(1, Math.floor(deepData.stats?.charCount || 0)),
        imageCount: Math.max(0, Math.floor(deepData.stats?.imageCount || 0)),
        tableCount: Math.max(0, Math.floor(deepData.stats?.tableCount || 0)),
        equationCount: Math.max(0, Math.floor(deepData.stats?.equationCount || 0)),
        citationCount: Math.max(0, Math.floor(deepData.stats?.citationCount || 0)),
        referenceCount: Math.max(0, Math.floor(deepData.stats?.referenceCount || 0)),
        pseudocodeCount: Math.max(0, Math.floor(deepData.stats?.pseudocodeCount || 0)),
        chartCount: Math.max(0, Math.floor(deepData.stats?.chartCount || 0)),
      }
    });
    if (!resumeProjectId) writeCheckpoint(uploadId, { projectId: project.id });

    // --- BATCH PERSISTENCE ENGINE (Nuclear 50.0 - Speed Optimization) ---
    const filesToCreate: any[] = [];

    // 1. Queue Extracted Images & Bibliography
    if (extractedImages.length > 0) {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'projects', project.id);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      // Parallel Filesystem Writes (Extremely fast, non-blocking)
      await Promise.all(extractedImages.map(async (img) => {
        const fullPath = path.join(dir, img.name);
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
        if ((img as any).stagedPath) {
          // Already staged to disk during extraction — copy, don't re-hold the buffer.
          await fs.promises.copyFile((img as any).stagedPath, fullPath);
        } else if (img.buffer) {
          return fs.promises.writeFile(fullPath, img.buffer);
        }
      }));
      heartbeat(uploadId, 'Saving project data', 88);

      extractedImages.forEach(img => {
        const filePath = `/uploads/projects/${project.id}/${img.name.replace(/\\/g, '/')}`;
        const fileType = (img as any).isStructural ? 'tex' : 'image';
        const content = (img as any).isStructural ? img.buffer.toString('utf8') : '';
        
        filesToCreate.push({
          projectId: project.id,
          filename: img.name,
          filePath,
          fileType,
          content
        });
      });
    }

    // 2. Queue Modular LaTeX Components
    const modularComponents = (deepData as any).modularComponents as Record<string, string> | undefined;
    if (modularComponents && Object.keys(modularComponents).length > 0) {
      console.log(`[TELEMETRY] Queueing ${Object.keys(modularComponents).length} modular LaTeX components`);
      const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', project.id);
      if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

      const componentEntries = Object.entries(modularComponents);

      // Parallel Filesystem Writes
      await Promise.all(componentEntries.map(([filename, content]) => {
        const fullPath = path.join(projectDir, filename);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return fs.promises.writeFile(fullPath, content as string, 'utf-8');
      }));

      for (const [filename, content] of componentEntries) {
        const ext = (filename.split('.').pop() || 'tex').toLowerCase();
        const filePath = `/uploads/projects/${project.id}/${filename.replace(/\\/g, '/')}`;
        
        if (!filesToCreate.some(f => f.filename === filename)) {
          filesToCreate.push({
            projectId: project.id,
            filename,
            content: content as string,
            fileType: ext,
            filePath
          });
        }
      }
    }

    // 3. Queue Template Support Assets
    try {
      const { getTemplateById, mapLegacyTemplateId } = require('@/lib/templates/registry');
      const tpl = getTemplateById(mapLegacyTemplateId(templateId));
      if (tpl && tpl.assetFolder) {
        const assetsPath = path.join(process.cwd(), 'src', 'assets', 'templates', tpl.assetFolder);
        const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', project.id);
        if (fs.existsSync(assetsPath)) {
          const LATEX_EXTS = new Set(['.tex', '.bib', '.bst', '.cls', '.sty', '.ldf', '.cfg', '.clo']);
          
          const injectRecursive = (currentSrc: string, currentDest: string, currentSub = '') => {
            const items = fs.readdirSync(currentSrc);
            for (const name of items) {
              const srcPath = path.join(currentSrc, name);
              const relPath = currentSub ? `${currentSub}/${name}` : name;
              const destPath = path.join(currentDest, name);
              
              if (fs.statSync(srcPath).isDirectory()) {
                if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
                injectRecursive(srcPath, destPath, relPath);
              } else {
                if (relPath === 'main.tex') continue;
                if (modularComponents && modularComponents[relPath]) continue;

                const ext = '.' + (name.split('.').pop() || '');
                if (!LATEX_EXTS.has(ext.toLowerCase())) continue;
                // Do NOT copy template .bib files (e.g. sample.bib) into generated
                // projects — the assembler emits the bibliography inline and stray
                // .bib files only confuse the project directory and downloads.
                if (ext.toLowerCase() === '.bib') continue;

                const content = fs.readFileSync(srcPath, 'utf-8');
                if (!fs.existsSync(destPath)) fs.writeFileSync(destPath, content);

                const normalizedRelPath = relPath.replace(/\\/g, '/');
                if (!filesToCreate.some(f => f.filename === normalizedRelPath)) {
                  filesToCreate.push({
                    projectId: project.id,
                    filename: normalizedRelPath,
                    content,
                    fileType: name.split('.').pop() || 'tex',
                    filePath: `/uploads/projects/${project.id}/${normalizedRelPath}`
                  });
                }
              }
            }
          };

          injectRecursive(assetsPath, projectDir);
        }
      }
    } catch (err) {
      console.warn("[TELEMETRY] Template asset injection failed during upload (non-critical):", err);
    }

    // 4. Local-first harvest: persist the full project (main.tex, images,
    //    modular components, AI snapshot) to server disk so recompiles and
    //    recovery never depend on PocketBase record caps or DB content alone.
    try {
      const { persistProjectToLocalFs } = await import('@/lib/local-project-fs');
      const localFiles: any[] = [];
      if (finalLatex) localFiles.push({ filename: 'main.tex', content: finalLatex });
      extractedImages.forEach((img: any) => {
        if ((img as any).isStructural) return;
        // Staged images were already copied to public/uploads/projects/<id> in
        // the persistence block — re-reading them here would re-hold every
        // buffer in memory. Skip them (main.tex + modular components + AI
        // snapshot are still harvested).
        if ((img as any).stagedPath) return;
        localFiles.push({ filename: img.name, buffer: img.buffer });
      });
      const modularEntries = Object.entries(modularComponents || {}) as [string, string][];
      for (const [filename, content] of modularEntries) {
        if (!localFiles.some((f: any) => f.filename === filename)) {
          localFiles.push({ filename, content });
        }
      }
      const written = persistProjectToLocalFs(project.id, localFiles, {
        savedAt: Date.now(),
        aiLatex: (deepData as any).aiLatex || null,
        aiVerdict: (deepData as any).aiVerdict || null,
        aiModel: (deepData as any).aiModel || null,
      });
      if (written.length > 0) {
        console.log(`[TELEMETRY] Local-first harvest: ${written.length} artifact(s) persisted to server disk.`);
      }
    } catch (localErr: any) {
      console.warn('[TELEMETRY] Local-first harvest failed (non-critical):', localErr?.message || localErr);
    }

    // 5. Include-graphics audit (Phase 4): every image referenced by the
    //    assembled latex must resolve to a real file — missing references
    //    indicate image loss and must never be silent.
    try {
      const { auditLatexImageReferences } = await import('@/lib/latex-image-audit');
      const audit = auditLatexImageReferences(
        finalLatex,
        extractedImages.filter((img: any) => !(img as any).isStructural).map((img: any) => img.name)
      );
      if (audit.total === 0) {
        console.log('[IMAGE-AUDIT] Assembled latex references no images.');
      } else if (audit.missing.length === 0) {
        console.log(`[IMAGE-AUDIT] All ${audit.total} referenced image(s) resolve for project ${project.id}.`);
      } else {
        const shown = audit.missing.slice(0, 10).join(', ');
        console.warn(
          `[IMAGE-AUDIT] ${audit.missing.length} of ${audit.total} referenced image(s) MISSING for project ${project.id}: ${shown}${audit.missing.length > 10 ? '...' : ''}`
        );
      }
    } catch (auditErr: any) {
      console.warn('[IMAGE-AUDIT] Image reference audit failed (non-critical):', auditErr?.message || auditErr);
    }

    // 6. Executing single bulk DB transaction to prevent SQLite connection locks
    if (filesToCreate.length > 0) {
      console.log(`[TELEMETRY] Executing single-batch DB insertion for ${filesToCreate.length} project files...`);
      await prisma.projectFile.createMany({
        data: filesToCreate,
        skipDuplicates: true
      });
      console.log("[TELEMETRY] Batch DB persistence fully completed.");
    }

    progress(uploadId, 'Finalizing project', 97);
    return { success: true, projectId: project.id };

  } catch (error: any) {
    console.error('--- CRITICAL UPLOAD ERROR ---');
    console.error('Message:', error.message);
    console.error('Stack Trace:', error.stack);
    console.error('-----------------------------');
    writeStatus(uploadId, { phase: 'error', message: error.message || 'Internal Server Error' });
    return { success: false, error: error.message || 'Internal Server Error' };
  } finally {
    backgroundRunning.delete(uploadId);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check project limits for Free tier
    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { membership: true }
    });

    if (user?.membership === 'free' || !user?.membership) {
      const [projectsCount, citationCount, reviewCount] = await Promise.all([
        prisma.project.count({ where: { userId: (session.user as any).id } }),
        prisma.citationProject.count({ where: { userId: (session.user as any).id } }),
        prisma.paperReview.count({ where: { userId: (session.user as any).id } }),
      ]);
      const totalCount = projectsCount + citationCount + reviewCount;
      if (totalCount >= 7) {
        return NextResponse.json({ 
          error: 'LIMIT_REACHED', 
          message: 'Free membership is restricted to a total of 7 projects. Please upgrade to Premium.' 
        }, { status: 403 });
      }
    }

    // PHASE 1 (fast): save the raw bytes to the pending dir and return
    // immediately. The heavy pipeline (parse/AI/assembly/persist) runs in the
    // background in runUploadProcessing() — a huge DOCX exceeds Render's
    // ~300s request kill, so processing must NEVER share the request with the
    // byte transfer. The client polls GET /api/upload/status for completion.
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const uploadId = randomBytes(12).toString('hex');
    const templateId = (formData.get('templateId') || formData.get('template') || 'article_lncs') as string;
    const fileName = file.name || 'document.docx';

    ensurePendingDir();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(path.join(PENDING_DIR, `${uploadId}__${fileName}`), buffer);

    const meta = {
      fileName,
      size: buffer.length,
      templateId,
      userId: (session.user as any).id,
      email: (session.user as any).email || null,
      name: (session.user as any).name || null,
      startedAt: Date.now(),
    };
    try {
      fs.writeFileSync(path.join(PENDING_DIR, `${uploadId}.meta.json`), JSON.stringify(meta));
    } catch (metaErr) {
      console.warn('[UPLOAD] Meta write failed (non-fatal):', metaErr);
    }
    writeStatus(uploadId, { phase: 'processing', stage: 'Uploading document', progress: 4 });

    // Fire-and-forget background processing — the status file is the contract.
    void runUploadProcessing(uploadId, meta)
      .then((res: any) => finishUpload(uploadId, res))
      .catch((bgErr: any) => {
        console.error('[UPLOAD-BACKGROUND] Fatal background error:', bgErr?.message || bgErr);
        finishUpload(uploadId, { success: false, error: bgErr?.message || 'Internal processing error' });
      });

    return NextResponse.json({ success: true, uploadId, pending: true });
  } catch (error: any) {
    console.error('--- CRITICAL UPLOAD ERROR ---');
    console.error('Message:', error.message);
    console.error('Stack Trace:', error.stack);
    console.error('-----------------------------');
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uploadId = searchParams.get('uploadId');
    if (!uploadId || !/^[a-f0-9]{24}$/.test(uploadId)) {
      return NextResponse.json({ error: 'Invalid uploadId' }, { status: 400 });
    }
    const status = readStatus(uploadId);
    if (!status) {
      // Pending bytes were lost (instance restart/deploy wiped tmp/) — the
      // client must tell the user to re-upload instead of waiting forever.
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // STALE WORKER RECOVERY: if the worker stopped writing for PENDING_TTL_MS,
    // it may have been killed (OOM/deploy). Re-kick it from the saved bytes —
    // idempotent via the checkpoint (the project row is adopted, not
    // duplicated). Only give up after MAX_BACKGROUND_KICKS so a genuinely huge
    // document (multiple 10-min stages) is never abandoned prematurely.
    if (status.phase === 'processing' && Date.now() - (status.updatedAt || 0) > PENDING_TTL_MS) {
      const kicks = backgroundKicks.get(uploadId) || 0;
      if (kicks >= MAX_BACKGROUND_KICKS) {
        // Too many recovery attempts — give the user a definitive error
        // instead of an endless recovery loop.
        const tooLongMsg = 'Upload processing is taking too long. Please upload the file again.';
        writeStatus(uploadId, { phase: 'error', message: tooLongMsg, recoverable: false });
        return NextResponse.json({ phase: 'error', message: tooLongMsg, recoverable: false });
      }
      if (!backgroundRunning.has(uploadId)) {
        const meta = readMeta(uploadId);
        if (!meta || typeof meta.fileName !== 'string') {
          // Bytes gone (instance restart wiped tmp/) — recovery is impossible;
          // surface a definitive error instead of polling forever.
          const lostMsg = 'Upload data was lost (server restart). Please upload the file again.';
          writeStatus(uploadId, { phase: 'error', message: lostMsg, recoverable: false });
          return NextResponse.json({ phase: 'error', message: lostMsg, recoverable: false });
        }
        backgroundKicks.set(uploadId, kicks + 1);
        console.warn(`[UPLOAD-RECOVERY] Upload ${uploadId} stale ${Math.round((Date.now() - (status.updatedAt || 0)) / 1000)}s — re-kicking worker (${kicks + 1}/${MAX_BACKGROUND_KICKS}).`);
        writeStatus(uploadId, {
          phase: 'processing',
          stage: status.stage || 'Recovering document',
          progress: Math.max(4, status.progress || 4),
          recovering: true,
        });
        void runUploadProcessing(uploadId, meta)
          .then((res: any) => finishUpload(uploadId, res))
          .catch((bgErr: any) => {
            console.error('[UPLOAD-RECOVERY] Re-kick fatal:', bgErr?.message || bgErr);
            finishUpload(uploadId, { success: false, error: bgErr?.message || 'Recovery processing failed' });
          });
        return NextResponse.json({
          phase: 'processing',
          stage: 'Recovering document processing…',
          progress: status.progress || 4,
          recovering: true,
        });
      }
    }

    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Status check failed' }, { status: 500 });
  }
}
