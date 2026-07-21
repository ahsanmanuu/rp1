import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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


    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let finalLatex = "";
    let finalXml = "";
    const extractedImages: any[] = [];
    console.log("[TELEMETRY] Starting upload processing for:", file.name);
    let deepData: any = null;
    let mammothResult = { value: "" };
    let templateId = 'article_lncs'; // Default — may be overridden in docx block
    let groundTruth: { imageCount?: number; tableCount: number; equationCount: number } | null = null;

    if (file.name.endsWith('.docx')) {
      console.log("[TELEMETRY] Step 1: Parsing DOCX with AdmZip");

      let zip = new AdmZip(buffer);
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
        // UNIFIED ROOT FILTER: Only process nodes that are NOT contained within another math node
        let parent: any = node.parentNode;
        let isNested = false;
        let isDisplay = String(node.tagName || "").toLowerCase().includes('omathpara');

        while (parent) {
          const pTag = String(parent.tagName || "").toLowerCase();
          if (pTag === 'm:omath' || pTag === 'm:omathpara') {
            isNested = true;
            break;
          }
          if (pTag === 'm:omathpara') isDisplay = true; // Inherit display if ancestor is oMathPara
          
          const cleanPTag = pTag.replace(/^w:/, '');
          if (cleanPTag === 'p') {
            const pText = (parent.textContent || '').trim();
            const mathText = (node.textContent || '').trim();
            const nonMathText = pText.replace(mathText, '').trim();
            if (nonMathText.length === 0 || /^\s*[\(\[\d\.\-\s\)\]]+\s*$/.test(nonMathText)) {
              isDisplay = true;
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
      zip = new AdmZip(zip.toBuffer());
      if (pendingCharts.length > 0) {
        console.log(`[CHART] Injected ${pendingCharts.length} chart/VML position markers via DOM. Serialized once.`);
      }
      // ===== END CHART EXTRACTION ENGINE PHASE 1 =====

      // 1000% Accuracy: Extract ground truth (Semantic + Positional Law)
      const allTbls = Array.from(dom.window.document.getElementsByTagName('w:tbl'));
      const validTables = allTbls.filter((tbl, idx) => {
        const text = (tbl.textContent || "").toLowerCase();
        // Rule 1: Structural Integrity (must be a grid)
        const rows = tbl.getElementsByTagName('w:tr').length;
        const cells = tbl.getElementsByTagName('w:tc').length;
        const isGrid = (rows >= 2 && cells >= 4);

        // Rule 2: Semantic Exclusion (remove Title/Author tables)
        const isMetadata = text.includes('@') || text.includes('email') || text.includes('affiliation') || text.includes('institution') || text.includes('orcid');

        // Rule 3: Positional suppression for Header Region (Template Tables)
        const isEarly = idx < 3 && (text.length < 500);

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
      mammothResult = await mammoth.convertToHtml({ buffer: zip.toBuffer() }, {
        convertImage: mammoth.images.imgElement(async (image) => {
          const imgContentType = image.contentType || 'image/png';
          const ext = imgContentType.includes('jpeg') || imgContentType.includes('jpg') ? 'jpg' : 'png';
          const name = `rf_fig_${figIdx++}.${ext}`;

          try {
            // CRITICAL: Await image.read() directly in the main callback to capture the buffer
            // while the zip stream is open and valid.
            const rawBuffer = await image.read();
            // Bypassing sharp optimization to prevent CPU/memory thrashing and native deadlocks on Render.
            // Using the raw lossless image buffer directly from the DOCX package.
            extractedImages.push({ name, buffer: rawBuffer });
            console.log(`[IMAGE] Extracted raw image buffer: ${name}`);
          } catch (readErr) {
            console.error(`[ERROR] Failed to read ZIP entry for image ${name}:`, readErr);
          }

          return { src: name };
        })
      });
      console.timeEnd("[PERF] Mammoth DOCX Extraction");

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
            extractedImages.push({ name, buffer });
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

      // ===== CHART EXTRACTION ENGINE (Phase 2: Image Extraction + Marker Resolution) =====
      console.time("[PERF] Chart Extraction Engine");
      if (pendingCharts.length > 0) {
        const markerToFinalName: Map<string, string> = new Map();

        let chartFileIdx = 1;
        for (const pc of pendingCharts) {
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

      console.log(`[TELEMETRY] Extraction complete. Final image count: ${extractedImages.length}`);

      console.log("[TELEMETRY] Step 5: Deep Structural Analysis");
      console.time("[PERF] Deep Structural Analysis");
      deepData = DeepDocumentParser.parse(mammothResult.value, mathData, file.name || "Document", groundTruth, finalXml);
      console.timeEnd("[PERF] Deep Structural Analysis");

      const placeholders = deepData.body.filter((n: any) => (n.type === 'figure' || n.type === 'chart') && n.id?.startsWith('chart_pending_'));
      if (placeholders.length > 0) {
        console.log(`[TELEMETRY] Generating ${placeholders.length} physical placeholders for missing charts.`);
        for (const p of placeholders) {
          extractedImages.push({ name: p.id, buffer: getFallbackPngBuffer() });
        }
      }

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
      console.timeEnd("[PERF] Modular LaTeX Assembly");

      // ===== DOC2LATEX AI ENHANCEMENT (Non-blocking fire-and-forget) =====
      // The main upload response is NOT delayed by this AI call.
      // Results are available via GET /api/doc2latex-agent and stored in the response payload.
      try {
        const { routeToAgent } = await import('@/lib/agent-gateway');
        const sectionTitles = (deepData?.body || [])
          .filter((n: any) => n.type === 'section' || n.type === 'subsection')
          .map((n: any) => n.text || n.title || '')
          .filter(Boolean)
          .slice(0, 20);
        const mathSnippets = (deepData?.mathData || [])
          .filter((m: any) => m.latex)
          .map((m: any) => m.latex)
          .slice(0, 5);
        const rawText = mammothResult?.value
          ? mammothResult.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          : '';

        // Store enhancement promise — will be logged when resolved, not awaited
        const doc2latexPromise = routeToAgent({
          agent: 'doc2latex',
          messages: [{ role: 'user', content: 'Analyze this DOCX-to-LaTeX conversion and return enhancement suggestions as JSON.' }],
          context: {
            userId:        session?.user?.id || null,
            documentTitle: deepData?.title || file.name.replace(/\.[^/.]+$/, ''),
            templateId,
            documentText:  rawText.substring(0, 5000),
            latexDraft:    finalLatex.substring(0, 4000),
            sectionTitles,
            mathSnippets,
            figureCount:   deepData?.stats?.imageCount    || 0,
            tableCount:    deepData?.stats?.tableCount    || 0,
            equationCount: deepData?.stats?.equationCount || 0,
            wordCount:     deepData?.stats?.wordCount     || 0,
          },
        });

        // Attach promise data to the response — fire and forget
        doc2latexPromise.then(result => {
          if (result.success) {
            console.log(`[doc2latex-agent] AI enhancement complete. Model: ${result.model}. Score: ${(result.data as any)?.qualityScore ?? 'n/a'}. Time: ${result.timing.total}ms`);
          } else {
            console.warn(`[doc2latex-agent] AI enhancement failed (non-critical):`, result.error);
          }
        }).catch(err => {
          console.warn(`[doc2latex-agent] AI enhancement threw (non-critical):`, err?.message || err);
        });

        // Capture result for immediate response if it resolves quickly (< 5s)
        const fastResult = await Promise.race([
          doc2latexPromise,
          new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
        ]);

        if (fastResult && (fastResult as any).success) {
          (deepData as any).doc2latexEnhancement = (fastResult as any).data;
          (deepData as any).doc2latexModel = (fastResult as any).model;
          console.log(`[doc2latex-agent] Fast-path AI enhancement captured for response.`);
        }
      } catch (aiErr: any) {
        // NEVER block the upload on AI failure
        console.warn('[doc2latex-agent] Non-blocking AI call setup failed (non-critical):', aiErr?.message || aiErr);
      }
      // ===== END DOC2LATEX AI ENHANCEMENT =====

    } else if (file.name.endsWith('.txt')) {
      const text = buffer.toString('utf-8');
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
      const text = buffer.toString('utf-8');
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
        const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const content = await page.getTextContent();
          const pageLines: Map<number, string[]> = new Map();
          content.items.forEach((item: any) => {
            if (!('str' in item)) return;
            const y = Math.round(item.transform?.[5] || 0);
            if (!pageLines.has(y)) pageLines.set(y, []);
            pageLines.get(y)!.push(item.str);
          });
          // Sort by Y descending (top to bottom) then join
          const sortedYs = Array.from(pageLines.keys()).sort((a, b) => b - a);
          sortedYs.forEach(y => { pdfText += pageLines.get(y)!.join(' ') + '\n'; });
          pdfText += '\n';
        }
      } catch (e: any) {
        console.error('[PDF_EXTRACT]', e.message);
      }

      // Delegate to the NLP-enhanced DeepDocumentParser for robust PDF phase-scanning
      const pdfLines = pdfText.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const { DeepDocumentParser: PdfParser } = await import('@/lib/deep-parser');
      deepData = PdfParser.parsePdfText(pdfLines);

      const { ModularLatexAssembler: PdfAssembler } = await import('@/lib/assembler');
      const pdfModular = PdfAssembler.assemble(deepData as any, 'article_lncs', { hasBibFile: false });
      finalLatex = pdfModular.mainTex;
      // CRITICAL FIX: attach modular files so they are persisted to disk + DB
      (deepData as any).modularComponents = pdfModular.files;
    } else if (file.name.endsWith('.zip')) {
      console.log("[TELEMETRY] Step 1: Processing ZIP Project Intake");
      const zip = new AdmZip(buffer);
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
    const actualChartFiles = actualImageFiles.filter(img => /rf_chart_/i.test(img.name));
    const actualFigureFiles = actualImageFiles.filter(img => !/rf_chart_/i.test(img.name));

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

    const refCountFinal = Math.max(deepData.stats.referenceCount || 0, latexStats.referenceCount || 0, bibRefCount);
    const citCountFinal = Math.max(deepData.stats.citationCount || 0, latexStats.citationCount || 0);

    deepData.stats = {
      ...deepData.stats,
      wordCount:       Math.max(deepData.stats.wordCount || 0, latexStats.wordCount || 0),
      charCount:       Math.max(deepData.stats.charCount || 0, latexStats.charCount || 0),
      imageCount:      Math.max(deepData.stats.imageCount || 0, latexStats.imageCount || 0, actualFigureFiles.length),
      tableCount:      Math.max(deepData.stats.tableCount || 0, latexStats.tableCount || 0),
      // Prioritize the larger, more inclusive count between the HTML parser and assembled LaTeX
      equationCount:   Math.max(deepData.stats.equationCount || 0, latexStats.equationCount || 0),
      citationCount:   citCountFinal,
      referenceCount:  refCountFinal,
      pseudocodeCount: Math.max(deepData.stats.pseudocodeCount || 0, latexStats.pseudocodeCount || 0),
      chartCount:      Math.max(deepData.stats.chartCount || 0, latexStats.chartCount || 0, actualChartFiles.length),
    };

    // --- DB PERSISTENCE ---
    console.log("[TELEMETRY] Step 7: DB Persistence (Hardened Path)");

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
        await prisma.user.create({
          data: {
            id: sessionUserId,
            name: sessionUserName,
            email: sessionUserEmail,
            points: 50,
            theme: "dark",
          },
        });
        console.log(`[TELEMETRY] Created missing user row for id=${sessionUserId}`);
      }
    }

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        title: (deepData.title || file.name).trim(),
        originalFilename: file.name,
        latexContent: finalLatex,
        structuredContent: JSON.stringify({ ...deepData, rawHtml: mammothResult.value, rawXml: finalXml }),
        status: "draft",
        projectType: file.name.endsWith('.docx') ? "DOC2LATEX" : "LATEX_STUDIO",
        wordCount: Math.floor(deepData.stats.wordCount || 0),
        charCount: Math.floor(deepData.stats.charCount || 0),
        imageCount: Math.floor(deepData.stats.imageCount || 0),
        tableCount: Math.floor(deepData.stats.tableCount || 0),
        equationCount: Math.floor(deepData.stats.equationCount || 0),
        citationCount: Math.floor(deepData.stats.citationCount || 0),
        referenceCount: Math.floor(deepData.stats.referenceCount || 0),
        pseudocodeCount: Math.floor(deepData.stats.pseudocodeCount || 0)
      }
    });

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
        return fs.promises.writeFile(fullPath, img.buffer);
      }));

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

    // 4. Executing single bulk DB transaction to prevent SQLite connection locks
    if (filesToCreate.length > 0) {
      console.log(`[TELEMETRY] Executing single-batch DB insertion for ${filesToCreate.length} project files...`);
      await prisma.projectFile.createMany({
        data: filesToCreate
      });
      console.log("[TELEMETRY] Batch DB persistence fully completed.");
    }

    return NextResponse.json({
      success: true,
      projectId: project.id,
      ...(deepData && (deepData as any).doc2latexEnhancement ? {
        doc2latexEnhancement: (deepData as any).doc2latexEnhancement,
        doc2latexModel: (deepData as any).doc2latexModel,
      } : {}),
    });

  } catch (error: any) {
    console.error('--- CRITICAL UPLOAD ERROR ---');
    console.error('Message:', error.message);
    console.error('Stack Trace:', error.stack);
    console.error('-----------------------------');
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
