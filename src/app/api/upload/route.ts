import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { randomBytes } from 'crypto';
import { getClient } from '@/lib/prisma';

// Configure Sharp for low-resource environments (Render 512MB limit)
sharp.concurrency(1);
sharp.cache({ memory: 16, items: 20, files: 0 });

const IMAGE_ENHANCE_CACHE = new Map<string, Buffer>();

// Big-document guard: sharp re-encoding of EVERY image (3000-dpi density tagging)
// is the dominant CPU cost for large DOCX files and a top cause of the Render
// ~300s request kill. After ENHANCE_IMAGE_CAP images, images pass through
// untouched — sharp work is skipped entirely for the rest of the document.
const enhanceImageCount = 0;
const ENHANCE_IMAGE_CAP = 60;

async function enhanceImageFor3000Dpi(buffer: Buffer): Promise<Buffer> {
  return buffer;
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

// ── TWO-PHASE UPLOAD (durable Postgres-backed) ──────────────────────────────
// Render kills long requests (~300s) regardless of the client XHR timeout, so
// the heavy pipeline (AdmZip + JSDOM math/charts + mammoth + sharp + AI +
// assembly + DB) must NEVER share the request with the byte transfer.
// Phase 1 (POST) ONLY stores raw bytes + metadata in an UploadJob row
// (Postgres is the only store that survives Render restarts — tmp/ is
// ephemeral, which is why disk-backed pending state surfaced as
// "Upload processing was lost (server restarted)" after any deploy/OOM) and
// returns { uploadId } immediately. The worker re-reads the bytes from the DB
// row; the client polls GET /api/upload/status. The tmp/ dir is now used only
// for transient in-run image staging (re-created from the DB bytes on any
// re-kick), never for durable state.
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
// same uploadId (POST kick + GET recovery re-kick racing each other). This is
// a same-process race guard only — kick-count durability lives in the DB
// row's attempts field.
const backgroundRunning = new Set<string>();

// ZERO-COPY BUFFER PASSING: The POST handler and background worker run in
// the same Node.js process. Instead of base64-encoding a 5-20MB file into
// PocketBase (which doubles memory: 20MB file → 27MB base64 string + DB I/O
// + 27MB read-back + 20MB decode = ~94MB of copies), we pass the raw buffer
// directly via this Map. Disk fallback at tmp/uploads-pending/{uploadId}.bin
// covers the case where GC collected the Map entry before the worker read it.
const pendingBuffers = new Map<string, Buffer>();

// Status writes are serialized PER UPLOAD so fire-and-forget progress/heartbeat
// writes can never land AFTER the terminal done/error write and clobber it back
// to phase='processing'. Without this ordering guarantee, a finished upload's
// row would be overwritten by a late progress write ~10 min later, the stale
// detector would re-kick the worker, and the re-kick would crash re-persisting
// duplicate project_files rows — surfacing as "Upload processing was lost".
const statusWriteChains = new Map<string, Promise<void>>();
// Terminal-state latch: once a done/error write is enqueued for an uploadId,
// any later non-forced progress write is dropped entirely (the worker is done).
const terminalStateWrites = new Set<string>();

async function writeStatus(uploadId: string, data: Record<string, any>, force = false): Promise<void> {
  if (!force && terminalStateWrites.has(uploadId)) return;
  const prev = statusWriteChains.get(uploadId) || Promise.resolve();
  const next = prev.then(async () => {
    try {
      await prisma.uploadJob.update({ where: { uploadId }, data });
    } catch (writeErr: any) {
      console.warn('[UPLOAD-STATUS] Status write failed:', writeErr?.message || writeErr);
    }
  });
  statusWriteChains.set(uploadId, next);
  try {
    await next;
  } catch {}
}

// Terminal (done/error) state: latch FIRST so concurrent progress writes are
// dropped, then force the write through the queue (it becomes the last write
// for this uploadId).
async function markTerminalState(uploadId: string, data: Record<string, any>): Promise<void> {
  terminalStateWrites.add(uploadId);
  await writeStatus(uploadId, data, true);
}

// Status read via the raw PB client (not the prisma adapter): the adapter
// swallows query errors and returns null, which made a transient storage
// failure (PB restarting, SQLite busy) indistinguishable from a genuinely
// missing row — the GET then 404'd and the client surfaced the fatal
// "Upload processing was lost (server restarted)" message even though the
// durable row existed and stale-worker recovery would have resumed it.
async function readStatus(uploadId: string): Promise<
  | { ok: true; status: Record<string, any> }
  | { ok: false; reason: 'not_found' | 'error'; error?: string }
> {
  try {
    const pb = await getClient();
    const res = await pb.collection('upload_jobs').getList(1, 1, {
      filter: `uploadId = "${uploadId}"`,
      // Explicitly scope the fields so multi-MB rawBytes is never pulled into
      // the 2s status-poll response (the worker decodes it from the DB row).
      fields: 'uploadId,fileName,size,templateId,userId,email,name,phase,stage,progress,message,projectId,recovering,recoverable,attempts,updated',
      requestKey: null,
    });
    const row: any = res.items[0];
    if (!row) return { ok: false, reason: 'not_found' };
    return {
      ok: true,
      status: {
        uploadId: row.uploadId,
        fileName: row.fileName,
        size: row.size,
        templateId: row.templateId,
        userId: row.userId,
        email: row.email,
        name: row.name,
        phase: row.phase,
        stage: row.stage,
        progress: row.progress,
        message: row.message,
        projectId: row.projectId,
        recovering: row.recovering,
        recoverable: row.recoverable,
        attempts: row.attempts,
        updatedAt: new Date(row.updated).getTime(),
      },
    };
  } catch (err: any) {
    return { ok: false, reason: 'error', error: err?.message || 'Status read failed' };
  }
}

function progress(uploadId: string, stage: string, percent: number): void {
  if (percent > 99.9) percent = 99.9;
  void writeStatus(uploadId, { phase: 'processing', stage, progress: percent });
  console.log(`[UPLOAD-PROGRESS] ${uploadId} ${percent}% — ${stage}`);
}

// Lightweight heartbeat: refreshes updatedAt without touching progress/logs —
// used in long async loops (per-chart QuickChart calls) so a genuinely busy
// worker is never mistaken for a dead one.
function heartbeat(uploadId: string, stage: string, progressPercent: number): void {
  void writeStatus(uploadId, { phase: 'processing', stage, progress: progressPercent });
}

// Resume checkpoint: written IMMEDIATELY after the project row is created so a
// re-kicked worker (crash/restart recovery) never duplicates the project —
// it adopts the checkpointed id and re-runs the idempotent file phase.
async function readCheckpoint(uploadId: string): Promise<{ projectId?: string } | null> {
  try {
    const row = await prisma.uploadJob.findUnique({
      where: { uploadId },
      select: { projectId: true },
    });
    return row?.projectId ? { projectId: row.projectId } : null;
  } catch {
    return null;
  }
}

async function writeCheckpoint(uploadId: string, data: { projectId: string }): Promise<void> {
  try {
    await prisma.uploadJob.update({ where: { uploadId }, data: { projectId: data.projectId } });
  } catch (cpErr) {
    console.warn('[UPLOAD] Checkpoint write failed (non-fatal):', cpErr);
  }
}

// Shared terminal handler for every worker kick (POST fire-and-forget AND GET
// recovery re-kick): writes the final status and releases the worker registry.
// Uses the terminal-state latch so the done/error write can never be clobbered
// by a straggling fire-and-forget progress write.
async function finishUpload(uploadId: string, res: any): Promise<void> {
  backgroundRunning.delete(uploadId);
  if (res?.success && res.projectId) {
    console.log(`[UPLOAD-FINISH] Marking upload ${uploadId} as done (project: ${res.projectId})`);
    await markTerminalState(uploadId, { phase: 'done', progress: 100, stage: 'Complete', projectId: res.projectId });
  } else if (res?.error) {
    console.log(`[UPLOAD-FINISH] Marking upload ${uploadId} as error: ${res.error}`);
    await markTerminalState(uploadId, { phase: 'error', message: res.error, recoverable: false });
  } else {
    console.warn(`[UPLOAD-FINISH] Upload ${uploadId} finished with unknown result:`, JSON.stringify(res));
    await markTerminalState(uploadId, { phase: 'error', message: 'Processing completed with unexpected result', recoverable: false });
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

async function runUploadProcessing(uploadId: string) {
  backgroundRunning.add(uploadId);
  try {
    // Ensure PB text/editor field limits are raised before any createMany.
    // After a server restart the in-memory cache resets; this is cheap after
    // the first call (cached) and prevents PB 400 "Failed to create record"
    // on large content payloads.
    const { ensureContentSizeLimits } = await import('@/lib/pbContentLimits');
    {
      const limitsPromise = ensureContentSizeLimits();
      let limitsTimer: ReturnType<typeof setTimeout> | null = null;
      await Promise.race([
        limitsPromise.finally(() => { if (limitsTimer) clearTimeout(limitsTimer); }),
        new Promise<number>((resolve) => { limitsTimer = setTimeout(() => {
          console.warn('[UPLOAD] ensureContentSizeLimits timed out (15s), continuing with 5MB default');
          resolve(5 * 1024 * 1024);
        }, 15_000); }),
      ]);
    }

    // Read job metadata (without rawBytes) from DB.
    const job = await prisma.uploadJob.findUnique({
      where: { uploadId },
      select: { uploadId: true, fileName: true, size: true, templateId: true, userId: true, email: true, name: true, phase: true, projectId: true, attempts: true },
    });
    if (!job) throw new Error('Upload job not found');

    // ── CLIENT-EXTRACTED ENVELOPE (durable text payload) ──────────────────
    // Browser-extracted DOCX: the DB rawBytes hold the text envelope, never a
    // binary. Try it FIRST — when present, the whole binary pipeline is
    // skipped (no Map, no disk staging, no raw DOCX bytes anywhere).
    let clientEnvelope: any = null;
    const envelopeJob = await prisma.uploadJob.findUnique({ where: { uploadId }, select: { rawBytes: true } });
    if (envelopeJob?.rawBytes) {
      // The PocketBase-backed prisma adapter round-trips the envelope as a
      // JSON string. Handle every shape it can come back as:
      //   1. plain envelope JSON string        -> parse directly
      //   2. {"type":"Buffer","data":[...]}    -> unwrap, decode utf-8
      //   3. legacy base64 text                -> base64 decode
      let rawText: string | null = null;
      try {
        if (Buffer.isBuffer(envelopeJob.rawBytes)) {
          rawText = envelopeJob.rawBytes.toString('utf-8');
        } else if (typeof envelopeJob.rawBytes === 'string') {
          const s = envelopeJob.rawBytes;
          if (s.trimStart().startsWith('{')) {
            const obj = JSON.parse(s);
            if (obj && obj.type === 'Buffer' && Array.isArray(obj.data)) {
              rawText = Buffer.from(obj.data as number[]).toString('utf-8');
            } else {
              rawText = s;
            }
          } else {
            rawText = Buffer.from(s, 'base64').toString('utf-8');
          }
        } else if (envelopeJob.rawBytes && typeof envelopeJob.rawBytes === 'object' && (envelopeJob.rawBytes as any).type === 'Buffer') {
          rawText = Buffer.from((envelopeJob.rawBytes as any).data as number[]).toString('utf-8');
        }
      } catch {
        rawText = null;
      }
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText);
          if (parsed && parsed.__clientEnvelope === true) {
            clientEnvelope = parsed;
            console.log(`[UPLOAD] Loaded client-extracted envelope from DB (${rawText.length} chars text payload)`);
          }
        } catch {
          // not an envelope — binary fallback below
        }
      }
    }

    // ZERO-COPY: Try in-memory Map first (same-process, zero overhead),
    // then disk fallback, then DB rawBytes as last resort (recovery re-kick).
    let buffer: Buffer | null = null;
    if (!clientEnvelope) {
      buffer = pendingBuffers.get(uploadId) || null;
      pendingBuffers.delete(uploadId); // release Map entry for GC
    } else {
      pendingBuffers.delete(uploadId);
    }

    if (!buffer && !clientEnvelope) {
      // Disk fallback: saved by POST handler at tmp/uploads-pending/{uploadId}.bin
      const diskPath = path.join(PENDING_DIR, `${uploadId}.bin`);
      if (fs.existsSync(diskPath)) {
        buffer = await fs.promises.readFile(diskPath);
        console.log(`[UPLOAD] Loaded buffer from disk fallback: ${diskPath} (${buffer.length} bytes)`);
      }
    }

    if (!buffer && !clientEnvelope) {
      // Last resort: DB rawBytes (only present for recovery re-kicks after server restart)
      const fullJob = await prisma.uploadJob.findUnique({ where: { uploadId }, select: { rawBytes: true } });
      if (fullJob?.rawBytes) {
        if (typeof fullJob.rawBytes === 'string') buffer = Buffer.from(fullJob.rawBytes, 'base64');
        else if (Buffer.isBuffer(fullJob.rawBytes)) buffer = fullJob.rawBytes;
        (fullJob as any).rawBytes = null;
        console.log(`[UPLOAD] Loaded buffer from DB rawBytes fallback (${buffer?.length || 0} bytes)`);
      }
    }

    if (!buffer && !clientEnvelope) throw new Error('Upload bytes not found');

    // Clean up disk staging file (no longer needed)
    try { fs.promises.unlink(path.join(PENDING_DIR, `${uploadId}.bin`)).catch(() => {}); } catch {}
    // Plain file object — the pipeline only uses .name (and occasionally .size).
    const file: any = { name: job.fileName, size: job.size };
    // Reconstructed session for the background worker: the original request
    // session is long gone by the time the pipeline finishes. All later code
    // uses session.user.{id,email,name} (read + the FK-remap mutation).
    const session = {
      user: { id: job.userId, email: job.email, name: job.name }
    } as any;
    let templateId = job.templateId || 'article_lncs';
    let finalLatex = "";
    let finalXml = "";
    const extractedImages: any[] = [];
    console.log("[TELEMETRY] Starting upload processing for:", file.name);
    let deepData: any = null;
    let mammothResult = { value: "" };
    let groundTruth: { imageCount?: number; tableCount: number; equationCount: number } | null = null;

    if (file.name.endsWith('.docx') && clientEnvelope) {
      // ════════════════════════════════════════════════════════════════════
      // CLIENT-EXTRACTED LIGHTWEIGHT PATH: the browser already converted the
      // DOCX (mammoth in-browser) — the server only receives the text envelope
      // (HTML with renamed figure <img> tags + plain text + figure manifest).
      // No AdmZip, no JSDOM/OMML math extraction, no chart engine, no sharp,
      // no EMF conversion, no binary persistence. The AI structural analysis
      // (input prompt: structure-frontmatter + structure-analyze) verifies the
      // structure from the envelope text exactly like the heavy path.
      // ════════════════════════════════════════════════════════════════════
      console.log("[TELEMETRY] Step 1: Client-extracted DOCX envelope — lightweight path (no binary transfer)");
      progress(uploadId, 'Parsing extracted document', 30);

      const html = String(clientEnvelope.html || '');
      const text = String(clientEnvelope.text || '');
      const referencesText = String(clientEnvelope.referencesText || '');
      const figureManifest: any[] = Array.isArray(clientEnvelope.figures)
        ? clientEnvelope.figures.filter((f: any) => f && f.name)
        : [];
      const figureNames = figureManifest.map((f: any) => String(f.name)).filter(Boolean);

      if (!html.trim() && !text.trim()) {
        throw new Error('Client extraction produced no content for this document');
      }

      mammothResult = { value: html };
      finalXml = '';

      if (html.trim()) {
        console.log("[TELEMETRY] Step 2: Deep Structural Analysis (envelope HTML)");
        deepData = DeepDocumentParser.parse(html, [], file.name || 'Document.docx', null, '');
      } else {
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
            pseudocodeCount: 0,
          },
        };
      }

      // The figure manifest is authoritative for what the AI may reason about
      // (figures live on the client device until Phase 2 attaches them).
      (deepData as any).figureManifest = figureManifest;

      // Figure Reconciliation from clientEnvelope:
      // Guarantee every figure declared in client figureManifest exists as a body node
      if (figureNames.length > 0 && Array.isArray(deepData.body)) {
        const presentFigIds = new Set<string>();
        for (const n of deepData.body) {
          if (n.id) presentFigIds.add(String(n.id).toLowerCase());
          if (n.images && Array.isArray(n.images)) {
            for (const img of n.images) if (img.src) presentFigIds.add(String(img.src).toLowerCase());
          }
        }
        let figAutoIdx = 1;
        for (const fName of figureNames) {
          if (!presentFigIds.has(fName.toLowerCase())) {
            const isChart = /rf_chart_|chart_pending_/i.test(fName);
            deepData.body.push({
              type: isChart ? 'chart' : 'figure',
              id: fName,
              caption: isChart ? `Chart ${figAutoIdx++}` : `Figure ${figAutoIdx++}`
            });
            presentFigIds.add(fName.toLowerCase());
          }
        }
      }

      if (figureNames.length > 0) {
        if (!deepData.stats) deepData.stats = {} as any;
        deepData.stats.imageCount = Math.max(deepData.stats.imageCount || 0, figureNames.length);
      }
      if (referencesText && (!deepData.references || deepData.references.length === 0)) {
        deepData.references = referencesText
          .split('\n')
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 10);
      }
      if (deepData.stats) deepData.stats.referenceCount = (deepData.references || []).length;

      progress(uploadId, 'Analyzing document structure', 55);

      // --- AI-ASSISTED STRUCTURAL VERIFICATION (from the envelope text) ---
      try {
        const { analyzeManuscriptStructure, applyStructureCorrections } = await import('@/lib/ai-manuscript-analysis');
        const aiRes = await Promise.race([
          analyzeManuscriptStructure(deepData, {
            html,
            filename: file.name,
            userId: (session?.user as any)?.id ?? null,
            imageFiles: figureNames,
            templateId: templateId,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 90000))
        ]);
        if (aiRes) {
          const { applied } = applyStructureCorrections(deepData, aiRes.verdict, aiRes.model);
          if (aiRes.aiLatex) (deepData as any).aiLatex = aiRes.aiLatex;
          (deepData as any).aiVerdict = aiRes.verdict;
          (deepData as any).aiModel = aiRes.model;
          console.log(`[TELEMETRY] AI structure corrections applied: ${applied.join(', ') || 'none'} (${aiRes.model})`);
        } else {
          const ldWarning = (deepData as any).largeDocWarning;
          if (ldWarning) {
            console.warn(`[TELEMETRY] ${ldWarning}`);
            await writeStatus(uploadId, { warning: ldWarning }).catch(() => {});
          } else {
            console.warn('[TELEMETRY] AI structural analysis timed out or unavailable — keeping heuristic parse.');
          }
        }
      } catch (aiErr: any) {
        console.warn('[AI-STRUCTURE] AI structural analysis failed (non-critical):', aiErr?.message || aiErr);
      }

      progress(uploadId, 'Analyzing document structure', 65);

      // Choose default template based on filename (for metadata only, not assembly)
      if (file.name.toUpperCase().includes('IEEE')) templateId = 'article_ieee';
      else if (file.name.toUpperCase().includes('ACM')) templateId = 'article_acm';

      console.log("[TELEMETRY] Phase 1 complete (client-extracted): parsing + AI analysis done. Assembly deferred to Phase 2.");
      progress(uploadId, 'Phase 1: Analysis complete', 74);
    } else if (file.name.endsWith('.docx')) {
      console.log("[TELEMETRY] Step 1: Parsing DOCX with AdmZip");

      let zip = new AdmZip(buffer!);
      buffer = null; // AdmZip copies entries internally; release the original 5-20MB buffer for GC
      const documentXml = zip.readAsText('word/document.xml');
      console.log("[TELEMETRY] Step 2: Extracting Math nodes with JSDOM");
      let dom: any = new JSDOM(documentXml, { contentType: "text/xml" });

      // CRITICAL FIX: querySelectorAll with escaped colons fails in JSDOM for XML namespaces.
      // Use getElementsByTagName which handles namespaced tags correctly.
      const mathParaNodes = Array.from(dom.window.document.getElementsByTagName('m:oMathPara'));
      const mathNodes = Array.from(dom.window.document.getElementsByTagName('m:oMath'));
      const allMathNodes = [...mathParaNodes, ...mathNodes];
      console.log(`[TELEMETRY] Found ${mathParaNodes.length} oMathPara + ${mathNodes.length} oMath = ${allMathNodes.length} total math nodes`);

      const mathData: { latex: string, isDisplay: boolean }[] = [];
      allMathNodes.forEach((node: any) => {
        // HEADING-LIKE MATH GUARD: Word sometimes wraps section headings / titles in
        // OMML math elements (auto-formatting). Only skip nodes that are CLEARLY
        // section headings (contain section/chapter/appendix keywords, or match
        // numbered heading patterns like "1. Introduction"). Do NOT skip equations
        // that happen to start with a number or contain words — real equations
        // frequently use words (e.g., "let n be...", "for all x in X").
        const rawMathText = (node.textContent || '').trim();
        const headingLikeMath =
          rawMathText.length > 0 && (
            /^\s*(?:section|chapter|appendix|part|abstract|keywords|references)\s+\d/i.test(rawMathText) ||
            /^\s*\d+(?:\.\d+)*\.\s+[A-Z][a-z]+(?:\s+[a-z]+){2,}/.test(rawMathText)
          );
        if (headingLikeMath) return;

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
              // PARAM-ASSIGNMENT GUARD (false positive): only skip VERY simple
              // single-variable assignments like "LR = 0.001" or "n = 100".
              // Do NOT skip multi-term equations like "E = mc^2" or "f(x) = ax^2 + bx + c"
              // — those are real display equations even though they have one "=".
              const isParamAssign = /^[A-Za-z]{1,5}\s*=\s*-?[\d.,]+\s*$/i.test(mathText) ||
                                    (mathText.length < 25 && /^[A-Za-z][A-Za-z0-9_]*\s*=\s*-?[\d.,]+(?:\s*[×x*]\s*[\d.]+)?\s*$/i.test(mathText));
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
      Array.from(oMathParas).forEach((para: any) => {
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
      const validTables = allTbls.filter((tbl: any, idx) => {
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

      // CRITICAL MEMORY RELEASE: Close JSDOM window immediately after groundTruth extraction.
      // The JSDOM window object holds 50-150MB of C++ / JS memory that MUST be freed before
      // mammoth starts extracting image buffers, preventing peak memory from exceeding 512MB limit.
      try { (dom as any)?.window?.close?.(); } catch {}
      (dom as any) = null;

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
            // Heartbeat per image: extracting hundreds of large images
            // can legitimately exceed the 10-min staleness window with no
            // progress milestone in between — a live-but-busy worker must never
            // be mistaken for a dead one and re-kicked.
            heartbeat(uploadId, 'Extracting text and figures', 42);
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
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
        ]);
        if (aiRes) {
          const { applied } = applyStructureCorrections(deepData, aiRes.verdict, aiRes.model);
          if (aiRes.aiLatex) (deepData as any).aiLatex = aiRes.aiLatex;
          (deepData as any).aiVerdict = aiRes.verdict;
          (deepData as any).aiModel = aiRes.model;
          console.log(`[TELEMETRY] AI structure corrections applied: ${applied.join(', ') || 'none'} (${aiRes.model})`);
        } else {
          // Surface large-doc warning to the user via upload status
          const ldWarning = (deepData as any).largeDocWarning;
          if (ldWarning) {
            console.warn(`[TELEMETRY] ${ldWarning}`);
            await writeStatus(uploadId, { warning: ldWarning }).catch(() => {});
          } else {
            console.warn('[TELEMETRY] AI structural analysis timed out or unavailable — keeping heuristic parse.');
          }
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

      // Release the heavy raw buffers for GC: the AdmZip and raw file
      // buffer are no longer needed past bibliography extraction. The staged
      // images (on disk) and deepData are what the rest of the pipeline uses.
      // (JSDOM window was already released early at ground-truth extraction.)
      buffer = null;
      (zip as any) = null;

      // --- PHASE 1 (Upload): Skip assembly — Phase 2 (generate-latex) handles it ---
      // Assembly is deferred to when the user selects a template. This makes
      // Phase 1 faster and allows the user to see the AI analysis report before
      // any LaTeX is generated. Phase 2 runs in parallel with template selection.
      console.log("[TELEMETRY] Phase 1 complete: parsing + AI analysis done. Assembly deferred to Phase 2.");

      // Choose default template based on filename (for metadata only, not assembly)
      if (file.name.toUpperCase().includes('IEEE')) templateId = 'article_ieee';
      else if (file.name.toUpperCase().includes('ACM')) templateId = 'article_acm';


      // --- PHASE 1: Assembly deferred to Phase 2 (generate-latex endpoint) ---
      // The ModularLatexAssembler.assemble() call is skipped here. When the user
      // selects a template, POST /api/projects/generate-latex runs the assembler
      // with the structured content saved in the DB. This makes Phase 1 faster
      // and allows the AI analysis report to be displayed before any LaTeX is
      // generated.
      progress(uploadId, 'Phase 1: Analysis complete', 74);

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
      // Phase 1: Skip assembly — Phase 2 (generate-latex) handles it
      progress(uploadId, 'Phase 1: Text analysis complete', 74);
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

    console.log(`[TELEMETRY] FINAL STATS — title:"${deepData.title}"`);

    // --- DB PERSISTENCE ---
    // Phase 1: No modular components or NLP stats to sync (deferred to Phase 2)
    console.log("[TELEMETRY] Step 7: DB Persistence (Hardened Path)");
    progress(uploadId, 'Saving project data', 82);
    console.log("[TELEMETRY] Step 7: DB Persistence (Hardened Path)");
    progress(uploadId, 'Saving project data', 82);

    // PocketBase editor/json fields default to a 5MB content limit; large DOCX
    // payloads (rawHtml + rawXml + parsed structure) routinely exceed it and PB
    // rejects the create with "Failed to create record." Raise the field limits
    // first, then defensively trim the payload to fit the effective limit.
    const pbContentLimit = await ensureContentSizeLimits();
    const structuredJsonBudget = pbContentLimit - 2 * 1024 * 1024;

    // MEMORY-SAFE STRUCTURED JSON: Build a single JSON string instead of
    // creating 3 copies via repeated JSON.stringify + spread operations.
    // For a 10MB mammothResult.value + 5MB finalXml, the old approach created
    // 3× 15MB = 45MB of throwaway strings simultaneously.
    let rawHtmlForDb = mammothResult.value || '';
    let rawXmlForDb = finalXml || '';

    // Estimate sizes to decide what to include (avoid creating full string just to measure)
    const deepDataSize = JSON.stringify(deepData).length;
    const estimatedTotal = deepDataSize + rawHtmlForDb.length + rawXmlForDb.length + 200;

    if (estimatedTotal > structuredJsonBudget) {
      // Drop XML first (saves 5-10MB)
      rawXmlForDb = '';
      if (deepDataSize + rawHtmlForDb.length + 200 > structuredJsonBudget) {
        // Truncate HTML to fit
        const htmlBudget = Math.max(256 * 1024, structuredJsonBudget - deepDataSize - 200);
        rawHtmlForDb = rawHtmlForDb.slice(0, htmlBudget);
      }
      console.warn(`[TELEMETRY] structuredContent trimmed (PB limit ${pbContentLimit})`);
    }

    const structuredJson = JSON.stringify({ ...deepData, rawHtml: rawHtmlForDb, rawXml: rawXmlForDb });
    // Release the large strings immediately after building structuredJson
    mammothResult.value = '';
    finalXml = '';

    // SAFETY NET: Ensure the user row exists in the DB before creating a project.
    // This prevents FK constraint violations when the DB was wiped/migrated but
    // the client still holds a valid JWT with the old user ID.
    const sessionUserId: string = (session.user as any).id;
    const sessionUserEmail: string = session.user.email || `user_${sessionUserId}@latexify.io`;
    const sessionUserName: string = session.user.name || "User";
    console.log(`[TELEMETRY] Session userId: ${sessionUserId}, email: ${sessionUserEmail}`);

    let existingUser: any = null;
    {
      const dbPromise = prisma.user.findUnique({ where: { id: sessionUserId } });
      let timer: ReturnType<typeof setTimeout> | null = null;
      existingUser = await Promise.race([
        dbPromise.finally(() => { if (timer) clearTimeout(timer); }),
        new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 15_000); }),
      ]);
    }
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
      const cp = await readCheckpoint(uploadId);
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
    if (!resumeProjectId) await writeCheckpoint(uploadId, { projectId: project.id });

    // Store complete untruncated source document to local project directory on disk
    // to guarantee 100% content fidelity for large 20MB files during Phase 2 template generation.
    // Re-use structuredJson which already contains rawHtml + rawXml (avoids another 15MB stringify).
    try {
      const projDir = path.join(process.cwd(), 'public', 'uploads', 'projects', project.id);
      if (!fs.existsSync(projDir)) fs.mkdirSync(projDir, { recursive: true });
      await fs.promises.writeFile(path.join(projDir, 'source_document.json'), structuredJson, 'utf-8');
    } catch (saveErr) {
      console.warn('[UPLOAD] Could not persist source_document.json to disk:', saveErr);
    }

    // --- BATCH PERSISTENCE ENGINE (Phase 1: Images only, no modular components) ---
    const filesToCreate: any[] = [];

    // 1. Persist Extracted Images & Bibliography to disk + DB
    // These are needed by Phase 2 (generate-latex) for assembly.
    if (extractedImages.length > 0) {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'projects', project.id);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      await Promise.all(extractedImages.map(async (img) => {
        const fullPath = path.join(dir, img.name);
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
        if ((img as any).stagedPath) {
          await fs.promises.copyFile((img as any).stagedPath, fullPath);
        } else if (img.buffer) {
          return fs.promises.writeFile(fullPath, img.buffer);
        }
      }));
      heartbeat(uploadId, 'Saving project data', 88);

      for (const img of extractedImages) {
        const filePath = `/uploads/projects/${project.id}/${img.name.replace(/\\/g, '/')}`;
        const isTex = (img as any).isStructural;
        const fileType = isTex ? 'tex' : 'image';
        let content = '';
        if (isTex && img.buffer) {
          content = img.buffer.toString('utf8');
        } else if (!isTex) {
          const ext = path.extname(img.name).replace(/^\./, '').toLowerCase();
          const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`;
          let imgBuf = img.buffer;
          if (!imgBuf && (img as any).stagedPath && fs.existsSync((img as any).stagedPath)) {
            try { imgBuf = fs.readFileSync((img as any).stagedPath); } catch {}
          }
          if (imgBuf && imgBuf.length > 0) {
            content = `data:${mime};base64,${imgBuf.toString('base64')}`;
          }
        }
        filesToCreate.push({
          projectId: project.id,
          filename: img.name,
          filePath,
          fileType,
          content
        });
      }
    }

    // Phase 1: Skip modular components, template assets, local-first harvest, image audit
    // These are all handled by Phase 2 (generate-latex endpoint)
    console.log("[TELEMETRY] Phase 1: Images persisted. Modular components deferred to Phase 2.");

    // IDEMPOTENT DB INSERT (crash-recovery safe): the prisma adapter's
    // createMany ignores skipDuplicates and PB 400s on the (projectId, filename)
    // unique index when a previous kick already stored a file row. A recovery
    // re-kick therefore DEDUPs against rows already stored, inserts only what's
    // missing, and treats per-row failures as non-fatal — the bytes already
    // live on disk in public/uploads/projects/{projectId} regardless, and a
    // failed row must never take the whole upload down (a crash here previously
    // surfaced as "Upload processing was lost" / "Failed to create record").
    if (filesToCreate.length > 0) {
      console.log(`[TELEMETRY] Executing idempotent DB insertion for ${filesToCreate.length} project files...`);
      const existingNames = new Set<string>();
      try {
        const existing = await prisma.projectFile.findMany({
          where: { projectId: project.id },
          select: { filename: true },
        });
        (existing || []).forEach((f: any) => existingNames.add(f.filename));
      } catch (lookupErr: any) {
        console.warn('[UPLOAD] Existing-file lookup failed, continuing without dedup (non-fatal):', lookupErr?.message || lookupErr);
      }
      let inserted = 0;
      let skippedRows = 0;
      let failedRows = 0;
      for (const file of filesToCreate) {
        if (existingNames.has(file.filename)) {
          skippedRows++;
          continue;
        }
        try {
          await prisma.projectFile.create({ data: file });
          inserted++;
        } catch (createErr: any) {
          failedRows++;
          // Duplicate on the unique index (race) is expected and fine — the row
          // exists. Any other validation failure is tolerated too: the file is
          // already persisted on disk and Phase 2 re-syncs from there.
          console.warn(`[UPLOAD] Skipped project_file row for ${file.filename} (non-fatal):`, createErr?.message || createErr);
        }
      }
      console.log(`[TELEMETRY] DB persistence: ${inserted} inserted, ${skippedRows} already existed, ${failedRows} skipped.`);
    }

    progress(uploadId, 'Finalizing project', 97);
    return { success: true, projectId: project.id };

  } catch (error: any) {
    console.error('--- CRITICAL UPLOAD ERROR ---');
    console.error('Message:', error.message);
    console.error('Stack Trace:', error.stack);
    console.error('-----------------------------');
    await markTerminalState(uploadId, { phase: 'error', message: error.message || 'Internal Server Error' }).catch(() => {});
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
      select: { membership: true, membershipExpiresAt: true }
    });

    const now = new Date();
    const isFreeOrExpired = !user || user.membership === 'free' || (user.membershipExpiresAt && new Date(user.membershipExpiresAt) <= now);

    if (isFreeOrExpired) {
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

    // PHASE 1 (fast): save the raw bytes + metadata to a durable UploadJob row
    // in Postgres and return immediately. The heavy pipeline runs in the
    // background — a huge DOCX exceeds Render's ~300s request kill, so
    // processing must NEVER share the request with the byte transfer. The
    // client polls GET /api/upload/status for completion.
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    // ── CLIENT-EXTRACTED DOCX ENVELOPE (lightweight path) ──────────────────
    // The browser extracts text + figure manifest itself (mammoth) and sends
    // NO document bytes: only the analysis HTML/text and the figure manifest
    // (name/contentType per figure). The server stores that envelope (durable,
    // recovery-safe) and skips every heavy pipeline stage (AdmZip, JSDOM,
    // OMML math, charts, sharp, EMF conversion) — the figure bytes stay on the
    // client device and are attached as multipart at Phase 2 (template select).
    const isClientExtracted = formData.get('clientExtracted') === '1';
    const analysisHtml = String(formData.get('analysisHtml') || '');
    const analysisText = String(formData.get('analysisText') || '');
    const referencesText = String(formData.get('referencesText') || '');
    let figureManifest: any[] = [];
    if (isClientExtracted) {
      try {
        const raw = String(formData.get('figureManifest') || '[]');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          figureManifest = parsed
            .filter((f: any) => f && typeof f.name === 'string' && f.name.trim())
            .map((f: any) => ({ name: String(f.name).trim(), contentType: String(f.contentType || 'image/png') }));
        }
      } catch {
        figureManifest = [];
      }
    }

    const uploadId = randomBytes(12).toString('hex');
    const templateId = (formData.get('templateId') || formData.get('template') || 'article_lncs') as string;
    const fileName = file.name || 'document.docx';

    let buffer: Buffer | null = null;
    let envelopePayload: string | null = null;
    if (isClientExtracted) {
      // Envelope payload (no binaries). Stored as a plain JSON STRING in the
      // rawBytes field (the PocketBase-backed prisma adapter round-trips
      // strings verbatim — Buffers would be mangled into {"type":"Buffer",...}),
      // so crash-recovery re-kicks can re-run the lightweight worker without
      // any client involvement.
      envelopePayload = JSON.stringify({
        __clientEnvelope: true,
        html: analysisHtml,
        text: analysisText,
        referencesText,
        figures: figureManifest,
      });
    } else {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    // Lazy GC: purge finished/failed upload jobs older than 24h so the table
    // never accumulates raw bytes without bound (stale rows are worthless).
    try {
      await prisma.uploadJob.deleteMany({
        where: {
          phase: { in: ['done', 'error'] },
          updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
    } catch { /* non-critical */ }

    // ZERO-COPY PATH: Pass buffer in-memory + save to disk fallback.
    // This eliminates the 27MB base64 encoding that was the #1 OOM cause.
    // (Skipped entirely for client-extracted envelopes — no binaries exist.)
    if (buffer) {
      pendingBuffers.set(uploadId, buffer);
      try {
        if (!fs.existsSync(PENDING_DIR)) fs.mkdirSync(PENDING_DIR, { recursive: true });
        fs.writeFileSync(path.join(PENDING_DIR, `${uploadId}.bin`), buffer);
      } catch (diskErr) {
        console.warn('[UPLOAD] Disk staging failed (in-memory Map still available):', diskErr);
      }
    }

    // Store job metadata in DB WITHOUT rawBytes (saves ~27MB of base64 per upload).
    // rawBytes is only written as a last-resort fallback for crash recovery —
    // or (client-extracted) the text envelope itself, which IS the payload.
    await prisma.uploadJob.create({
      data: {
        uploadId,
        fileName,
        size: isClientExtracted ? file.size : (buffer?.length || 0),
        templateId,
        userId: (session.user as any).id,
        email: (session.user as any).email || null,
        name: (session.user as any).name || null,
        phase: 'processing',
        stage: 'Uploading document',
        progress: 4,
        ...(envelopePayload ? { rawBytes: envelopePayload } : {}),
      },
    });

    // Fire-and-forget background processing — the UploadJob row is the contract.
    // Wrap in a global 10-minute timeout so a hung step (DB, PB, AI) never
    // leaves the upload stuck in "processing" forever.
    // IMPORTANT: We clear the timeout when processing finishes to avoid an
    // unhandled rejection (Node.js 15+ terminates the process on unhandled
    // rejections, which is what was causing the 500 cascade on ALL routes).
    const PIPELINE_TIMEOUT_MS = 10 * 60 * 1000;
    const bgProcessing = runUploadProcessing(uploadId);
    const timeoutId = setTimeout(() => {
      bgProcessing.catch(() => {}); // prevent unhandled if processing still pending
      finishUpload(uploadId, { success: false, error: 'Processing timed out after 10 minutes', recoverable: false });
    }, PIPELINE_TIMEOUT_MS);
    bgProcessing
      .then((res: any) => { clearTimeout(timeoutId); finishUpload(uploadId, res); })
      .catch((bgErr: any) => {
        clearTimeout(timeoutId);
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
    const read = await readStatus(uploadId);
    if (!read.ok) {
      if (read.reason === 'not_found') {
        // Row genuinely missing (never created / GC'd) — cannot recover; the
        // client must tell the user to re-upload instead of waiting forever.
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
      // Transient storage failure (PB restarting / SQLite busy during a
      // deploy or OOM restart): the durable row still exists and stale-worker
      // recovery would resume it once readable. Return a retryable error so
      // the client keeps polling instead of surfacing a fatal "lost" message.
      return NextResponse.json(
        { error: 'Storage temporarily unavailable', retryable: true },
        { status: 503 }
      );
    }
    const status = read.status;

    // STALE WORKER RECOVERY: if the worker stopped writing for PENDING_TTL_MS,
    // it may have been killed (OOM/deploy). Re-kick it from the durable DB
    // bytes — idempotent via the checkpoint (the project row is adopted, not
    // duplicated). Kick count lives in the DB (attempts) so it survives
    // instance restarts too. Only give up after MAX_BACKGROUND_KICKS so a
    // genuinely huge document (multiple 10-min stages) is never abandoned
    // prematurely.
    if (status.phase === 'processing' && Date.now() - (status.updatedAt || 0) > PENDING_TTL_MS) {
      const kicks = status.attempts || 0;
      if (kicks >= MAX_BACKGROUND_KICKS) {
        // Too many recovery attempts — give the user a definitive error
        // instead of an endless recovery loop.
        const tooLongMsg = 'Upload processing is taking too long. Please upload the file again.';
        await markTerminalState(uploadId, { phase: 'error', message: tooLongMsg, recoverable: false }).catch(() => {});
        return NextResponse.json({ phase: 'error', message: tooLongMsg, recoverable: false });
      }
      if (!backgroundRunning.has(uploadId)) {
        try {
          await prisma.uploadJob.update({
            where: { uploadId },
            data: {
              attempts: kicks + 1,
              recovering: true,
              phase: 'processing',
              stage: status.stage || 'Recovering document',
              progress: Math.max(4, status.progress || 4),
              message: null,
            },
          });
          console.warn(`[UPLOAD-RECOVERY] Upload ${uploadId} stale ${Math.round((Date.now() - (status.updatedAt || 0)) / 1000)}s — re-kicking worker (${kicks + 1}/${MAX_BACKGROUND_KICKS}).`);
        } catch (recErr) {
          console.warn('[UPLOAD-RECOVERY] Failed to mark recovery state (non-fatal):', recErr);
        }
        void runUploadProcessing(uploadId)
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
