import { JSDOM } from 'jsdom';
import { countCitationsFromHtml, mergeCitations } from './citationCounting';

export interface AuthorInfo {
  name: string;
  affiliation?: string;
  email?: string;
  isCorresponding?: boolean;
  affiliationIds?: string[];
}

export type ComponentRole =
  | 'title' | 'author' | 'affiliation' | 'abstract' | 'keywords'
  | 'contribution' | 'organization'
  | 'section' | 'subsection' | 'subsubsection'
  | 'paragraph' | 'equation' | 'figure' | 'figure-group' | 'chart'
  | 'table' | 'algorithm' | 'list'
  | 'conclusion' | 'acknowledgement' | 'funding'
  | 'conflict' | 'reference' | 'idle';

export interface ContentNode {
  type: 'heading' | 'paragraph' | 'table' | 'figure' | 'figure-group' | 'equation' | 'algorithm' | 'list' | 'image' | 'chart';
  level?: number;
  text?: string;
  html?: string;
  latex?: string;
  id?: string;
  url?: string;
  caption?: string;
  items?: string[];
  title?: string;
  listType?: string;
  images?: Array<{ src: string; caption: string }>;
  componentRole?: ComponentRole;
  orderIndex?: number;
  twoColumn?: boolean;
}

export interface StructuredDocument {
  title: string;
  authors: AuthorInfo[];
  organizations: string[];
  keywords: string[];
  abstract: string;
  contribution: string;
  acknowledgements: string;
  body: ContentNode[];
  references: string[];
  mathBlocks?: any[];
  algorithms?: Array<{ title: string, content: string }>;
  tables?: Array<{ caption: string, id: string }>;
  stats: {
    wordCount: number;
    charCount: number;
    imageCount: number;
    tableCount: number;
    equationCount: number;
    pseudocodeCount: number;
    citationCount: number;
    referenceCount: number;
    chartCount: number;
  };
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
// Narrow AFFIL_KEYWORDS: remove generic words (research, systems, lab, group, etc.)
const AFFIL_KEYWORDS = /(?:^|\b|\d|_|\W)(?:department|dept|university|institute|college|school|center|centre|organization|institution|corporation|inc|co\.|ltd|association|academy|laboratory|lab|division|faculty|campus|polytechnic|univ|inst|state|national)\b/i;


// Algorithm label: match lines that START with Algorithm/Procedure/etc keyword
// The word-count guard in the SCAP loop handles mid-sentence false positives
// Do NOT use $ anchor — titled algorithms like 'Algorithm 1 Illumination Failure' must match
const ALGO_LABEL_PATTERN = /^(?:\[?(?:\d+|[IVXLCDM]+)\]?[.\)]?\s*)?(?:Algorithm|Alg\.?|Pseudocode|Procedure|ALGORITHM|PROCEDURE|Listing)\b/i;

// Patterns that identify a line as an algorithm BODY step
const STOPWORDS = new Set([
  'the','and','of','in','to','a','with','is','for','on','as','by','that','it','from','at',
  'was','an','be','this','which','are','were','had','has','have','but','not','or','such',
  'also','can','should','would','been','their','they','we','our','its','than','more',
  'used','using','based','system','method','approach','results','paper','proposed',
  'show','shows','shown','while','when','where','however','therefore','thus','hence',
  'each','both','between','among','within','well','number','different','various',
  'figure','table','section','algorithm','equation','ref','et','al','fig','tab',
]);
// Extended domain stopwords for keyword NLP (CS/Engineering papers)
const DOMAIN_STOPWORDS = new Set([
  ...STOPWORDS,
  'perform','performance','propose','design','implement','evaluation','experiment',
  'data','model','network','learning','training','testing','accuracy','error',
  'value','values','set','sets','high','low','large','small','new','existing',
  'present','work','study','research','analysis','comparison','use','uses',
  'process','processes','given','provide','achieve','improve','reduce','increase',
  'application','applications','information','feature','features','input','output',
]);

interface LineFeatures {
  text: string;
  wordCount: number;
  capRatio: number;
  digitRatio: number;
  symbolDensity: number;
  stopwordDensity: number;
  isBold: boolean;
  tagName: string;
}

export class DeepDocumentParser {
  private static readonly FORCED_LEVEL1 = new Set([
    'abstract','introduction','background','related work','related works','literature review','literature','existing literature',
    'literature survey','literature review/survey','survey','literature review and survey',
    'methodology','methods','materials and methods','proposed method','proposed approach','proposed framework','experimental framework and findings',
    'results','results and discussion',
    'conclusion','conclusions','conclusions and future scope','conclusions and future work','future work','future directions',
    'summary','system model','system overview','problem formulation','problem statement',
    'performance evaluation','simulation results','simulation',
    'anomaly detection','logic failure anomaly detection',
    'acknowledgements','acknowledgments','acknowledgement','acknowledgment',
    'references','bibliography','appendix','appendices',
    // Universal major paper-specific sections
    'proposed methodology','statements and declarations','declarations and statements',
    'pretrained models and transfer learning','pretrained model and transfer learning','transfer learning and pretrained models',
    // Back-matter declarations
    'declarations','ethics approval','ethical approval','ethics statement',
    'conflict of interest','conflicts of interest','competing interests',
    'funding','funding statement','funding information',
    'data availability','data availability statement','availability of data',
    'authors contributions','author contributions','contributors',
    'supplementary material','supplementary materials','supplementary information',
    'limitations','study limitations','abbreviations',
    'consent to participate','consent for publication','informed consent'
  ]);

  /**
   * Determines if a text line is an algorithm body step (not prose).
   * Used to decide whether a paragraph following an algorithm header
   * should be accumulated into the algorithm or should break it.
   */
  private static isAlgorithmBodyLine(text: string, el?: Element): boolean {
    if (!text || text.length === 0) return false;
    if (text.length > 400) return false; // Broaden slightly for long complex steps
    
    const cleanText = text.trim();
    
    // 1. Check for monospace or code element structure in HTML
    if (el) {
      const style = el.getAttribute('style') || '';
      const className = el.className || '';
      const isMonospace = /courier|consolas|monospace|dejavu|courier new|fixed/i.test(style) ||
                          /code|monospace|pseudocode|algorithm/i.test(className) ||
                          el.querySelector('code, pre, tt, kbd, samp') !== null;
      if (isMonospace && cleanText.length < 250) return true;
      
      // Indentation checks
      const hasLargeIndent = /margin-left:\s*[2-9][0-9]px|padding-left:\s*[2-9][0-9]px/i.test(style) ||
                             /(?:^|\s)indent-?[1-9]/i.test(className);
      if (hasLargeIndent && cleanText.length < 250) return true;
    }
    
    // 2. Numbered step: "1.", "1)", "2.1.", "Step 1:", "1 Do this", "1For i=1"
    if (/^(?:step\s*)?\d+[\d.]*[\.\)]?\s*/i.test(cleanText) && cleanText.length < 150) return true;
    
    // 3. Bullet/dash/arrow prefixed steps
    if (/^[-–—•▸►\-+*]/.test(cleanText)) return true;
    
    // 4. Keyword-prefixed line (enhanced list)
    // Add words like "next", "break", "continue", "switch", "case", "default", "yield", "each", "stop"
    const enhancedAlgoKeywords = /^(?:input|output|require|ensure|initialize|result|data|return|begin|end|for|while|if|else|elif|do|repeat|until|procedure|function|compute|calculate|set|let|find|define|select|assign|given|assume|otherwise|get|put|push|pop|append|remove|check|step|read|write|print|call|execute|wait|next|break|continue|switch|case|default|yield|each|stop|update|generate|optimize|train|test|eval|evaluate)\b/i;
    if (enhancedAlgoKeywords.test(cleanText)) return true;
    
    // 5. Code-like structures and mathematical symbols
    // Math/programming operators: <-, :=, ←, =, +=, -=, *=, /=, ++, --, ==, !=, <=, >=, &&, ||, |, &
    if (/(?:←|:=|<-|<=|>=|==|!=|\+=|-=|\*=|\/=|&&|\|\||\+\+|--)/.test(cleanText) && cleanText.length < 180) return true;
    
    // 6. Inline braces, brackets, parentheses balance or structures (e.g. "if (x > y) {")
    if (/(?:\{|\}|\(\s*\)|\[\s*\])/.test(cleanText) && cleanText.length < 120) return true;
    
    // 7. Very short lines starting with digits or math symbols
    if (/^[\d+\-*\/()]/.test(cleanText) && cleanText.length < 80) return true;
    
    // 8. Line ends with standard loop/conditional markers (e.g. ";", "do", "then", "{")
    if (/(?:;|\bdo|\bthen|\{)$/i.test(cleanText) && cleanText.length < 150) return true;

    return false;
  }

  
  static parsePdfText(lines: string[]): StructuredDocument {
      const result: StructuredDocument = {
        title: 'Document', authors: [], organizations: [], keywords: [], abstract: '',
        contribution: '', acknowledgements: '', body: [], references: [], stats: {
            wordCount: 0, charCount: 0, imageCount: 0, tableCount: 0,
            equationCount: 0, pseudocodeCount: 0, citationCount: 0, referenceCount: 0, chartCount: 0
        }
      };
      
      const fullText = lines.join(' ');
      result.stats.wordCount = fullText.split(/\s+/).filter(w => w.length > 1).length;
      result.stats.charCount = fullText.length;
      
      const sectionRx = /^(?:(\d+\.?\s+|[IVXLCDM]+\.\s+|[A-Za-z]\.\s+)?)(Abstract|Introduction|Background|Related\s+Work|Related\s+Works|Literature\s+Review|Methodology|Methods|Materials\s+and\s+Methods|Proposed\s+Method|Proposed\s+Approach|Proposed\s+Framework|Experimental\s+Setup|Experiments|Results?|Results?\s+and\s+Discussion|Discussion|Conclusion|Conclusions|Summary|Acknowledgements?|Acknowledgments?|References?|Bibliography|Appendix|Appendices|Future\s+Work|Future\s+Directions|System\s+Model|System\s+Overview|Problem\s+Formulation|Problem\s+Statement|Performance\s+Evaluation|Evaluation|Simulation\s+Results?|Comparison|Anomaly\s+Detection|Declarations?|Ethics\s+(?:Approval|Statement)|Conflict\s+of\s+Interest|Conflicts\s+of\s+Interest|Competing\s+Interests|Funding(?:\s+Statement|\s+Information)?|Data\s+Availability(?:\s+Statement)?|Authors?\s+Contributions?|Supplementary\s+(?:Material|Information)|Limitations?|Abbreviations?|Consent\s+(?:to\s+Participate|for\s+Publication)|Informed\s+Consent)s?[.:,]?\s*$/i;
      
      let inRefs = false;
      
      // UNIVERSAL NLP: Author and Affiliation Extraction Pass for PDF
      for (let i = 0; i < Math.min(40, lines.length); i++) {
          const line = lines[i].trim();
          if (sectionRx.test(line) || /^abstract[\s:.\-_—–]/i.test(line) || line.toLowerCase() === 'abstract') {
              break;
          }
          if (i === 0 && line.length > 10) {
              result.title = line;
              continue;
          }
          if (line.length < 5 || result.title === line) continue;
          
          const isEmail = EMAIL_RE.test(line);
          const isAffil = AFFIL_KEYWORDS.test(line);
          const wordCount = line.split(/\s+/).length;
          const isAuthorLike = wordCount >= 2 && wordCount <= 30 &&
                               (line.includes(',') || /\b(and|&)\b/i.test(line) || /^[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){1,3}$/.test(line)) &&
                               !isAffil && !isEmail &&
                               !STOPWORDS.has(line.split(' ')[0].toLowerCase());
          
          if (isEmail || isAffil) {
              const cleanOrg = line.replace(EMAIL_RE, '').replace(/[*†‡¹²³⁴⁵⁶⁷⁸⁹⁰\d]/g, '').trim();
              if (cleanOrg && cleanOrg.length > 5 && !result.organizations.includes(cleanOrg)) {
                  result.organizations.push(cleanOrg);
              }
              if (isEmail && result.authors.length > 0 && !result.authors[result.authors.length - 1].email) {
                  result.authors[result.authors.length - 1].email = line.match(EMAIL_RE)?.[0];
              }
          } else if (isAuthorLike) {
              const names = line.split(/[,;&]|\s+and\s+/i).map(n => n.trim()).filter(n => n.length > 2);
              names.forEach(n => {
                  const cleanName = n.replace(/[*\u2020\u2021\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u2070\d]/g, '').trim();
                  if (cleanName.length > 2 && !AFFIL_KEYWORDS.test(cleanName) && cleanName.split(' ').length <= 7) {
                      if (!result.authors.find(a => a.name === cleanName)) {
                          result.authors.push({ name: cleanName, affiliationIds: [] });
                      }
                  }
              });
          }
      }

      let lastPdfHeadingLevel = 0;
      for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/^(?:\d+\.?\s*)?(?:REFERENCES|BIBLIOGRAPHY|WORKS CITED)\.?\s*$/i.test(line) && i > lines.length * 0.4) {
              inRefs = true; continue;
          }          if (inRefs) {
              const isPostRef = /^(?:\d+\.?\s*)?(?:acknowledgments?|declarations?|ethics\s+(?:approval|statement)|conflict\s+of\s+interest|competing\s+interests|funding|data\s+availability|authors?\s+contributions?|supplementary|appendix|appendices|supporting|biography|author\s+biography|about\s+the\s+author)s?[.:]?\s*$/i.test(line.trim());
              if (isPostRef) {
                  inRefs = false;
              } else {
                  if (DeepDocumentParser.isNewReferenceStart(line, result.references.length === 0)) {
                      if (line.length > 10) result.references.push(line);
                  } else if (result.references.length > 0) {
                      result.references[result.references.length - 1] += " " + line;
                  }
                  continue;
              }
          }
          
          if (/^(?:Figure|Fig\.|Table|Tab\.|Algorithm|Algo\.|Pseudocode|Listing)\s*(?:\d+|[IVX]+|[A-Z])?[:\.\s]/i.test(line)) {
              // Reject running text that merely starts with a keyword (e.g. "Figure 2 shows the performance...")
              // A genuine caption is short (< 100 chars) and does NOT contain a verb like shows/presents/illustrates
              const firstLineClean = line.replace(/^(?:Figure|Fig\.|Table|Tab\.|Algorithm|Algo\.|Pseudocode|Listing)\s*(?:\d+|[IVX]+|[A-Z])?[:\.\s]*/i, '').trim();
              const hasVerb = /\b(?:shows?|presents|illustrates|compares|depicts|displays|demonstrates|summarizes|lists|reports|plots|gives|provides|represents|outlines|describes|highlights|overviews|contains|yields|produces|indicates)\b/i.test(firstLineClean.slice(0, 60));
              const isTooLong = line.length > 100;
              const isRunningText = isTooLong || hasVerb;
              if (!isRunningText) {
                  let captionText = line;
                  let j = i + 1;
                  while (j < lines.length && j < i + 6) {
                      const nextLine = lines[j].trim();
                      if (!nextLine || sectionRx.test(nextLine) || /^(?:Figure|Fig\.|Table|Tab\.|Algorithm|Algo\.|Pseudocode|Listing)/i.test(nextLine)) {
                          break;
                      }
                      if (nextLine.length > 150) break;
                      captionText += ' ' + nextLine;
                      j++;
                  }
                  i = j - 1;

                  const lowerLine = captionText.toLowerCase();
                  if (lowerLine.startsWith('tab')) {
                      result.body.push({ type: 'table', caption: captionText, id: `pdf_tab_${i}` } as any);
                  } else if (/^(?:algorithm|algo\.|pseudocode|listing)/i.test(lowerLine.trim())) {
                      result.body.push({ type: 'algorithm', title: captionText, items: [] } as any);
                  } else {
                      result.body.push({ type: 'figure', caption: captionText, id: `pdf_fig_${i}.png` } as any);
                  }
                  continue;
              }
          }

          // Equation detection for PDF text lines.
          // STRICT: require strong mathematical content (multiple signals) — not just any line with '=' or math ops.
          // Rejects parameter assignments, table rows, and prose text containing minor math characters.
          {
            const clean = line.trim();
            const words = clean.split(/\s+/);
            // Count prose-like dictionary words (long alphabetic words without numbers/symbols)
            const proseWordCount = words.filter(w => /^[a-zA-Z]{3,}$/.test(w) && !/^(sin|cos|tan|log|ln|exp|sqrt|lim|max|min|sum|prod|det|softmax|sigmoid|relu|tanh)$/i.test(w)).length;
            const isProseHeavy = words.length > 4 && (proseWordCount / words.length) > 0.55;
            // Reject table data rows: multiple columns of numbers/percentages/units
            const isTableDataRow = /^[\d.,\s\-\+%±\(\)\/a-zA-Z]{5,}$/.test(clean) && (clean.match(/\s{2,}|\t/g) || []).length >= 2;

            const hasGreek = /[∑∫≈≤≥≠≡α-ωΑ-Ωθλπμσδφψωηρ±×÷√∞∂∇]/.test(clean);
            const opCount = (clean.match(/[+\-*\/^]/g) || []).length;
            const hasMultiOps = opCount >= 2;
            const hasMathFn = /\b(sin|cos|tan|log|ln|exp|sqrt|lim|max|min|sum|prod|det|softmax|sigmoid|relu|tanh)\b/i.test(clean);
            const hasSubSuper = /[_^][{\w]/.test(clean) || /\{[a-zA-Z0-9]+\}/.test(clean);
            const hasEqNum = /\(\d{1,3}\)\s*$/.test(clean);
            const hasRelOp = /[=<>]/.test(clean);
            const isParamAssign = /^[A-Za-z][A-Za-z0-9\s_]{0,35}\s*=\s*[\d.,+\-eE%]+\s*$/.test(clean)
                                || /^[A-Z]{1,6}\s*=\s*[\d.,+\-eE%]+\s*$/.test(clean);

            // Require AT LEAST TWO distinct math signals (or explicit equation number with relational operator)
            const signalCount = (hasGreek ? 1 : 0) + (hasMultiOps ? 1 : 0) + (hasMathFn ? 1 : 0) + (hasSubSuper ? 1 : 0) + (hasRelOp ? 1 : 0);
            const isRealEquation = !isParamAssign && !isProseHeavy && !isTableDataRow && (
              signalCount >= 2 || (hasEqNum && hasRelOp && opCount >= 1)
            );
            if (isRealEquation && clean.length < 140) {
              result.body.push({ type: 'equation', text: clean });
              continue;
            }
          }
          const cleanLine = line.trim();
          const isSection = sectionRx.test(cleanLine) && cleanLine.length < 120;
          
          // Universal dynamic hierarchical prefix scan: e.g. "1.", "1.1", "1.1.1", "A.1", "I.A.1", "Section 3:"
          const prefixMatch = cleanLine.match(/^(?:\s*(?:(?:section|chapter|appendix|part)\s+)?((?:\d+|[ivxlcdm]+|[A-Za-z])(?:\.(?:\d+|[ivxlcdm]+|[A-Za-z]))*)(?:\.?[.:\s)]+))/i);
          const isNumberedHeading = prefixMatch !== null && cleanLine.length < 120 && !cleanLine.endsWith('.');
          // Support Title Case AND ALL CAPS headings (e.g. "RESULTS AND DISCUSSION", "EXPERIMENTAL SETUP")
          const isShortTitleCase = cleanLine.length < 80 && cleanLine.length > 3 && !cleanLine.endsWith('.') && !cleanLine.includes(',') && 
            (cleanLine.split(' ').every(w => /^[A-Z]/.test(w) || STOPWORDS.has(w.toLowerCase())) ||
             (/^[A-Z0-9\s_\-&:\(\)]+$/.test(cleanLine) && cleanLine.split(' ').length <= 8));
          
          const isPdfAuthorAffil = /@/.test(cleanLine) || /^(?:dr\.|prof\.|professor|deputy librarian|assistant professor|associate professor|lecturer|dean|principal|head of|researcher)\b/i.test(cleanLine) || /\b(?:university|polytechnic|college|institute|department|faculty|school of|laboratory|center for|centre for|hospital|foundation)\b/i.test(cleanLine);

          if (!isPdfAuthorAffil && (isSection || isNumberedHeading || isShortTitleCase)) {
              let level = 1;
              if (prefixMatch) {
                  const cleanPrefix = prefixMatch[1];
                  const parts = cleanPrefix.split('.');
                  level = Math.min(3, parts.length);
                  
                  // Single character prefix safety check
                  if (parts.length === 1 && /^[a-z]$/i.test(cleanPrefix)) {
                      const fullMatch = prefixMatch[0];
                      const hasPunctuation = /[.:)]/.test(fullMatch);
                      if (!hasPunctuation && !isSection && !isShortTitleCase) {
                          if (cleanLine.length > 20) result.body.push({ type: 'paragraph', text: line });
                          continue;
                      }
                  }
              } else if (isShortTitleCase && !isSection) {
                  level = 2; // Default unnumbered subheading
              }
              
              let headingText = cleanLine;
              if (prefixMatch) {
                  headingText = cleanLine.substring(prefixMatch[0].length).trim();
              }
              if (!headingText) headingText = cleanLine;

              // Hierarchy state machine: the first heading is always a main section.
              // Allow explicit multi-part prefixes (e.g. 3.2.1) to set level 3 directly.
              if (lastPdfHeadingLevel === 0) {
                  level = 1;
              } else if (prefixMatch && prefixMatch[1].includes('.')) {
                  // Explicit dot count in prefix gives authoritative level (e.g. 1.2 -> 2, 1.2.3 -> 3)
                  level = Math.min(3, prefixMatch[1].split('.').length);
              } else if (level > lastPdfHeadingLevel + 1) {
                  level = lastPdfHeadingLevel + 1;
              }
              lastPdfHeadingLevel = level;

              result.body.push({ type: 'heading', level, text: headingText });
          } else if (line.length > 20) {
              result.body.push({ type: 'paragraph', text: line });
          }
      }
      
      // Finalize Stats
      result.stats.tableCount = result.body.filter(n => n.type === 'table').length;
      result.stats.imageCount = result.body.reduce((sum, n) => {
        if (n.type === 'figure-group') {
          return sum + (n.images ? n.images.length : 0);
        }
        if (n.type === 'figure' || n.type === 'image' || n.type === 'chart') {
          return sum + (n.images ? n.images.length : 1);
        }
        return sum;
      }, 0);
      result.stats.equationCount = result.body.filter(n => n.type === 'equation').length;
      result.stats.pseudocodeCount = result.body.filter(n => n.type === 'algorithm').length;
      result.stats.referenceCount = result.references.length;

      return result;
  }

  static parse(
    html: string | null | undefined,
    mathBlocks: any[] = [],
    filename: string,
    overrides?: any,
    _rawXml?: string
  ): StructuredDocument {
    const rawHtmlForCitations = typeof html === 'string' ? html : '';
    const result: StructuredDocument = {
      title: filename || 'Untitled Document', authors: [], organizations: [], keywords: [], abstract: '',
      contribution: '', acknowledgements: '', body: [], references: [], mathBlocks,
      stats: { wordCount: 0, charCount: 0, imageCount: 0, tableCount: 0, equationCount: 0, pseudocodeCount: 0, citationCount: 0, referenceCount: 0, chartCount: 0 },
      algorithms: [], tables: [],
    };

    const cleanHtml = (html || '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
      .replace(/[\u202F\u00A0]/g, ' ').trim();
    if (!cleanHtml) return result;

    let dom: JSDOM; try { dom = new JSDOM(cleanHtml); } catch { return result; }
    const doc = dom.window.document;

    // Break apart <p> elements that contain <br> so that Title/Author/Affiliation on soft-returns are evaluated independently.
    Array.from(doc.querySelectorAll('p, div')).forEach(el => {
        if (el.querySelector('br')) {
            const htmlSplit = el.innerHTML.split(/<br\s*\/?>/i);
            if (htmlSplit.length > 1) {
                const fragment = doc.createDocumentFragment();
                htmlSplit.forEach(segment => {
                    const newP = doc.createElement(el.tagName.toLowerCase());
                    newP.innerHTML = segment.trim();
                    if (newP.textContent?.trim()) {
                        fragment.appendChild(newP);
                    }
                });
                el.replaceWith(fragment);
            }
        }
    });

    // Phase 1: Character/Word Census
    const allText = (doc.body.textContent || '');
    result.stats.charCount = allText.replace(/\s/g, '').length;
    result.stats.wordCount = allText.split(/\s+/).filter((w: string) => /[a-z]/i.test(w) && w.length > 1).length;

    const allSignificantRaw = Array.from(doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, table, img, figure, ul, ol, pre, blockquote, div')) as Element[];
    // Fix Figure/Table Duplication: Filter out elements that are nested inside semantic block elements that are processed as single units
    const allSignificant = allSignificantRaw.filter(el => {
      const tag = el.tagName.toLowerCase();
      let parent = el.parentElement;
      while (parent) {
        const parentTag = parent.tagName.toLowerCase();
        if (['table', 'figure', 'ul', 'ol', 'pre', 'blockquote'].includes(parentTag)) {
          if (allSignificantRaw.includes(parent)) return false;
        }
        parent = parent.parentElement;
      }
      
      // Discard generic divs if they contain block-level children (keeps block children instead)
      if (tag === 'div') {
        const hasBlockChildren = el.querySelector('p, h1, h2, h3, h4, h5, h6, table, img, figure, ul, ol, pre, blockquote') !== null;
        if (hasBlockChildren) return false;
      }
      
      // For p elements containing an image: if p has NO prose text (just image/caption), discard p in favor of img
      if (tag === 'p' && el.querySelector('img') !== null) {
        const textWithoutImg = (el.textContent || '').replace(/CHARTIMGX\w+XEND/g, '').trim();
        const isCaption = /^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram)\s*[\d.]+/i.test(textWithoutImg);
        if (!isCaption && textWithoutImg.length < 5) {
          // Empty paragraph containing an image -> discard p so the img element itself is processed cleanly
          return false;
        }
      }

      return true;
    });
    
    // Phase 2: Component Landmark Scan
    const manifest = this.Phase2_landmarkScan(allSignificant);

    // Phase 3 & 4: Deep Extraction & Order Preservation
    this.Phase4_deepExtract(manifest, result, mathBlocks, rawHtmlForCitations);

    // Phase 4.5: NLP Metadata Enrichment
    const allDocText = result.body.map(n => n.text).join(' ');
    if (result.keywords.length === 0) {
      result.keywords = this.extractKeywordsNLP(allDocText);
    }
    if (!result.contribution) {
      const targetText = result.abstract + ' ' + allDocText.substring(0, 5000);
      result.contribution = this.extractContributionNLP(targetText);
    }

    // Universal Side-by-Side Image Grouping Pass
    const groupedBody: ContentNode[] = [];
    let pendingGroup: ContentNode[] = [];

    const flushPendingGroup = () => {
      if (pendingGroup.length === 0) return;
      if (pendingGroup.length === 1) {
        groupedBody.push(pendingGroup[0]);
      } else {
        // Determine overall main caption for the entire group
        let overallCaption = '';
        for (const n of pendingGroup) {
          if (n.caption && /^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram)\b/i.test(n.caption)) {
            overallCaption = n.caption;
            break;
          }
        }
        if (!overallCaption) {
          overallCaption = pendingGroup.map(n => n.caption).filter(Boolean)[0] || 'Group of Figures';
        }

        const images = pendingGroup.map(n => ({
          src: String(n.id || n.url || '').replace(/\\/g, '/'),
          caption: (n as any).subCaption || (n.caption !== overallCaption ? n.caption : '') || ''
        }));

        const groupNode: ContentNode = {
          type: 'figure-group',
          id: `fig_group_${Math.random().toString(36).substring(2, 7)}`,
          text: overallCaption,
          caption: overallCaption,
          images: images as any,
          level: 1
        } as any;
        groupedBody.push(groupNode);
      }
      pendingGroup = [];
    };

    for (const node of result.body) {
      const isImg = node.type === 'figure' || node.type === 'image';
      const isEmptyPara = node.type === 'paragraph' && (!node.text || !node.text.trim());

      if (isImg) {
        pendingGroup.push(node);
      } else if (isEmptyPara) {
        // Keep accumulating (skip empty paragraph)
      } else {
        flushPendingGroup();
        groupedBody.push(node);
      }
    }
    flushPendingGroup();
    result.body = groupedBody;

    // Phase 5: Stats Finalization from Store
    result.stats.tableCount = result.body.filter(n => n.type === 'table').length;
    // imageCount = figure/figure-group images only; chart nodes are counted
    // separately as chartCount so figures and charts are never double-counted.
    result.stats.imageCount = result.body.reduce((sum, n) => {
      if (n.type === 'figure-group') {
        return sum + (n.images ? n.images.length : 0);
      }
      if (n.type === 'figure' || n.type === 'image') {
        return sum + (n.images ? n.images.length : 1);
      }
      return sum;
    }, 0);
    // Equation count = standalone equation body nodes + display math blocks
    // that appear inside paragraph MATHBLOCKX markers (accumulated during Phase4).
    const standaloneEqs = result.body.filter(n => n.type === 'equation').length;
    result.stats.equationCount = standaloneEqs + result.stats.equationCount;
    result.stats.pseudocodeCount = result.body.filter(n => n.type === 'algorithm').length;
    result.stats.chartCount = result.body.filter(n => n.type === 'chart').length;
    result.stats.referenceCount = result.references.length;
    // In-text citation counting: only count brackets OUTSIDE the reference-list
    // entries (reference entries "[1]. Author, ..." are not citations themselves).
    // Shared with the client studio so displayed counts always match server logic.
    result.stats.citationCount = countCitationsFromHtml(rawHtmlForCitations);

    if (overrides) {
      if (overrides.tableCount) result.stats.tableCount = overrides.tableCount;
      if (overrides.equationCount) result.stats.equationCount = overrides.equationCount;
      // AI-provided figure/chart overrides are applied only when the document
      // actually contains that media — a hallucinated count must never inflate
      // the stats, so we clamp to what the parser found.
      if (overrides.imageCount) {
        result.stats.imageCount = Math.min(overrides.imageCount, result.stats.imageCount);
      }
      if (overrides.chartCount) {
        result.stats.chartCount = Math.min(overrides.chartCount, result.stats.chartCount);
      }
    }

    result.algorithms = result.body.filter(n => n.type === 'algorithm').map(n => ({
      title: n.title || 'Algorithm', content: (n.items || []).join('\n')
    }));

    result.tables = result.body.filter(n => n.type === 'table').map((n: any) => {
      const dims = n.html ? this.tableHtmlDimensions(n.html) : { rowCount: 0, colCount: 0 };
      return {
        caption: n.caption || 'Table',
        id: n.id || '',
        rowCount: dims.rowCount,
        colCount: dims.colCount
      };
    });

    return result;
  }

  private static featurize(el: Element): LineFeatures {
    const text = (el.textContent || '').trim();
    const words = text.split(/\s+/).filter(Boolean);
    const upperCount = (text.match(/[A-Z]/g) || []).length;
    const digitCount = (text.match(/\d/g) || []).length;
    const symbolCount = (text.match(/[=+\-*/^\\(){}[\]]/g) || []).length;
    const stopCount = words.filter(w => STOPWORDS.has(w.toLowerCase())).length;

    return {
      text,
      wordCount: words.length,
      capRatio: text.length > 0 ? upperCount / text.length : 0,
      digitRatio: text.length > 0 ? digitCount / text.length : 0,
      symbolDensity: words.length > 0 ? symbolCount / words.length : 0,
      stopwordDensity: words.length > 0 ? stopCount / words.length : 0,
      isBold: el.querySelector('strong, b') !== null || (el as any).style?.fontWeight === 'bold',
      tagName: el.tagName.toLowerCase()
    };
  }

  private static getStrongTextRatio(el: Element): number {
    const totalText = (el.textContent || '').trim();
    if (!totalText) return 0;
    const strongEls = Array.from(el.querySelectorAll('strong, b'));
    const strongText = strongEls.map(s => (s.textContent || '').trim()).join('');
    return strongText.length / totalText.length;
  }

  // ── 2. METADATA EXTRACTION (SCORE-BASED) ──────────────────────────────────
  
  private static Phase2_landmarkScan(elements: Element[]): any[] {
    const manifest: any[] = [];
    let currentRole: ComponentRole = 'idle';
    let currentStart = -1;
    let currentElements: Element[] = [];

    const flush = (idx: number) => {
      if (currentRole !== 'idle' && currentElements.length > 0) {
        manifest.push({ role: currentRole, startIdx: currentStart, endIdx: idx - 1, elements: [...currentElements] });
      }
      currentRole = 'idle';
      currentElements = [];
      currentStart = -1;
    };

    let foundAbstract = false;
    let foundRefs = false;

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const f = this.featurize(el);
      const lower = f.text.toLowerCase();
      const tagName = f.tagName;

      if (/^\s*\d{1,3}\s*$/.test(f.text) || /^\s*page\s+\d+(?:\s+of\s+\d+)?\s*$/i.test(f.text) || /colorlinks=|allcolors=|bookmarks=|\bhypersetup\{/i.test(lower) || f.text.length === 0) {
          if (tagName !== 'table' && tagName !== 'img' && !el.querySelector('img')) continue;
      }

      if (foundRefs) {
          const isPostRefHeader = (tagName.startsWith('h') || this.detectHeading(el, f.text, manifest) !== null || /^[IVXLCDM\d\.\s]+$/.test(f.text)) &&
              /^(?:\d+\.?\s*)?(?:acknowledgments?|declarations?|ethics\s+(?:approval|statement)|conflict\s+of\s+interest|competing\s+interests|funding|data\s+availability|authors?\s+contributions?|supplementary|appendix|appendices|supporting|biography|author\s+biography|about\s+the\s+author)/i.test(lower.trim());
          
          if (isPostRefHeader) {
              foundRefs = false;
          } else {
              if (f.text.length > 20) {
                 if (currentRole !== 'reference') flush(i);
                 currentRole = 'reference';
                 if (currentStart === -1) currentStart = i;
                 currentElements.push(el);
              }
              continue;
          }
      }

      // UNIVERSAL: Normalize away template style annotations before header matching,
      // e.g. "REFERENCES <10 point, Bold>" (often HTML-escaped as &lt;10 point, Bold&gt;)
      const refHeaderText = lower.replace(/&lt;[\s\S]*?&gt;/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const isRefGuideline = /\b(?:within|content|main|guideline|style|how to|instruction|write|cite|citation|guidance|prepare)\b/i.test(refHeaderText);
      const isRefHeader = !isRefGuideline && (
                            (tagName.startsWith('h') && (refHeaderText.includes('reference') || refHeaderText.includes('bibliography'))) ||
                            (refHeaderText.length < 60 && /^(?:[\dIVX\.\s]+)?(?:references?|bibliography|works cited|literature cited)(?:\s*(?:and|&|source|notes|material|cited|list|section|chapter)\b.*|[.:\s]*(?:[\d.]{1,4})?)$/i.test(refHeaderText))
                          );
      if (isRefHeader && i > elements.length * 0.3) {
          flush(i);
          foundRefs = true;
          continue;
      }

      let nextRole: ComponentRole = 'paragraph';

      // UNIVERSAL: Detect embedded numbered subsection headings inside paragraph text.
      // e.g., "2.1 Carbon Nanotube (CNT): The discovery of..."
      // When a <p> starts with a numbered prefix + short title + colon separator,
      // treat as 'section' so Phase4 emits a \subsection command.
      if (tagName === 'p' && f.text.length > 30 && f.text.length < 4000) {
        const embeddedHeadingMatch = f.text.match(/^((?:\d+\.\d+(?:\.\d+)*)\s+[A-Z][^:.]{3,80}?)[:.]\s+\S/);
        if (embeddedHeadingMatch) {
          const headingPart = embeddedHeadingMatch[1].trim();
          if (headingPart.length <= 80 && !headingPart.includes(',')) {
            nextRole = 'section';
            (el as any).__embeddedHeading = headingPart;
          }
        }
      }

      // Table cells often contain the words "Abstract"/"Keywords" (e.g. style-guide tables) —
      // abstract/keyword detection must never fire on table elements.
      if (tagName !== 'table' && (lower === 'abstract' || /^abstract[\s:.\-_—–]/.test(lower))) {
          nextRole = 'abstract';
          foundAbstract = true;
      } else if (tagName !== 'table' && (lower.includes('keyword') || lower.includes('index term'))) {
          nextRole = 'keywords';
      }
      else if (
          tagName !== 'table' && (
            (/^\s*(?:MATHBLOCKX\d+XMARKER)(?:\s*(?:MATHBLOCKX\d+XMARKER|(?:\(\d+(?:\.\d+)*\)|\[\d+(?:\.\d+)*\])|[,.:;()\[\]\s*-]))*$/i.test(f.text)) ||
            this.detectEquation(f)
          )
      ) {
          nextRole = 'equation';
      }
      else if (tagName === 'table') {
          const rows = Array.from(el.querySelectorAll('tr'));
          const hasMathBlock = /MATHBLOCKX\d+XMARKER/i.test(f.text);
          const mathSymbolCount = (f.text.match(/[=+\-*/^\\∑∫√²³α-ωΑ-Ωθλπμσδφψωηρ<>~≈≠≤≥_()\[\]{}]/g) || []).length;
          const firstRowText = (el.querySelector('tr')?.textContent || '').trim();
          const hasTableHeaders = /\b(?:parameter|value|description|method|type|name|property|metric|score|unit|variable|dataset|model|accuracy|result|feature|category)\b/i.test(firstRowText);
          const isSingleRowMath = rows.length === 1 && !hasTableHeaders && (hasMathBlock || (mathSymbolCount >= 3 && f.text.includes('=')));
          
          if (isSingleRowMath || (rows.length <= 2 && hasMathBlock && !hasTableHeaders)) {
              nextRole = 'equation';
          } else {
              let isTableAlgo = ALGO_LABEL_PATTERN.test(firstRowText);
              if (!isTableAlgo) {
                  const firstRowCols = el.querySelector('tr')?.querySelectorAll('td, th')?.length || 0;
                  const hasStrongAlgoKeywords = /\b(?:input|output|require|ensure)\s*[:=]|(?:\bfor\b.*\bdo\b)|(?:\bwhile\b.*\bdo\b)|(?:\bif\b.*\bthen\b)/i.test(f.text);
                  let isMostlyCode = false;
                  if (!hasStrongAlgoKeywords) {
                      const bodyLines = f.text.split('\n').map(l => l.trim()).filter(Boolean);
                      const algoLines = bodyLines.filter(l => DeepDocumentParser.isAlgorithmBodyLine(l, el));
                      isMostlyCode = bodyLines.length >= 3 && (algoLines.length >= bodyLines.length * 0.4);
                  }
                  if ((hasStrongAlgoKeywords || isMostlyCode) && firstRowCols <= 2 && f.text.length < 3000 && !hasTableHeaders) {
                      isTableAlgo = true;
                  }
              }
              nextRole = isTableAlgo ? 'algorithm' : 'table';
          }
      }
      else if (this.detectTableCandidate(f, el)) {
          nextRole = 'table';
      }
      else if (tagName === 'img' || tagName === 'figure' || f.text.includes('CHARTIMGX')) {
          nextRole = 'figure';
      }
      else if (el.querySelector('img')) {
          const cleanText = f.text.replace(/CHARTIMGX\w+XEND/g, '').trim();
          const looksLikeCaption = /^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram)\s*[\d.]+[:.\s]/i.test(cleanText);
          const isShort = f.wordCount < 12 && cleanText.length < 100;
          const hasProseStart = /^(?:The |We |This |Our |An? |In |As |However |Therefore |Thus |Hence |While |When |For |These |Those |Such |It |They |Figure \d+ shows|Fig\. \d+ shows|Table \d+ (?:shows|lists|presents))/i.test(cleanText);
          if (looksLikeCaption || isShort) {
              nextRole = 'figure';
          } else if (hasProseStart) {
              nextRole = 'paragraph';
          } else {
              nextRole = 'figure';
          }
      }
      else if (ALGO_LABEL_PATTERN.test(f.text) && f.text.length < 150) {
          nextRole = 'algorithm';
      }
      else if (!f.text.includes('\t') && !f.text.includes('|') && (tagName.startsWith('h') || this.detectHeading(el, f.text, manifest) !== null || (tagName === 'p' && f.wordCount <= 12 && f.wordCount >= 1 && el.querySelector('strong, b') !== null && this.getStrongTextRatio(el) > 0.8 && !f.text.endsWith('.') && f.text.length < 120 && f.text.length > 2))) {
          const detectedLvl = this.detectHeading(el, f.text, manifest);
          const isNumberedHeading = /^(?:\s*(?:section|chapter|appendix|part)\s+)?(?:\[|\()?((?:\d+|[ivxlcdm]+|[a-z])(?:\.(?:\d+|[ivxlcdm]+|[a-z]))*)(?:\]|\))?[.:\s)]/i.test(f.text);
          const isStandardSectionName = /^(?:[\d\.]+\s*)?(?:introduction|related work|background|methodology|conclusion|abstract|acknowledgments|references|overview|implementation|proposed|experimental|results|discussion|system)/i.test(f.text);
          const isAuthorAffilText = /@/.test(f.text) || /^(?:dr\.|prof\.|professor|deputy librarian|assistant professor|associate professor|lecturer|dean|principal|head of|researcher)\b/i.test(f.text) || /\b(?:university|polytechnic|college|institute|department|faculty|school of|laboratory|center for|centre for|hospital|foundation)\b/i.test(f.text);
          const isSectionHeading = !isAuthorAffilText && (detectedLvl !== null || isNumberedHeading || isStandardSectionName || tagName.startsWith('h') || (tagName === 'p' && el.querySelector('strong, b') !== null && this.getStrongTextRatio(el) > 0.8));

          if (isSectionHeading) {
              nextRole = 'section';
          } else if (!foundAbstract && i < 20 && f.text.length > 10 && f.text.length < 500
              && !/ieee|journal|transactions|vol\.|no\.|arxiv|preprint|copyright|issn/i.test(f.text)) {
              const isAlreadyTitleStarted = currentRole === 'title' || manifest.some(m => m.role === 'title');
              const looksLikeAuthor = ((f.wordCount >= 2 && f.wordCount <= 30 &&
                (f.text.includes(',') || f.text.includes(';') || /\b(and|&)\b/i.test(f.text) || /\d/.test(f.text) || /#/.test(f.text) ||
                 /orcid/i.test(f.text) ||
                 /^[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){1,3}$/.test(f.text)) &&
                (f.capRatio > 0.15 || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(f.text)) &&
                !AFFIL_KEYWORDS.test(f.text) &&
                !STOPWORDS.has(f.text.split(' ')[0].toLowerCase())) ||
                (f.wordCount === 1 && /^[A-Z][a-z]{2,}$/.test(f.text.trim()) && isAlreadyTitleStarted));

              const isLocationAffil = isAlreadyTitleStarted && !foundAbstract &&
                (/(?:\b\d{5,6}\b|\b(?:India|USA|UK|China|Japan|Germany|France|Australia|Canada|Brazil|Korea|Italy|Spain|Netherlands|Switzerland|Singapore|Malaysia|Iran|Egypt|Pakistan|Indonesia|Thailand|Turkey|Russia|Mexico|Colombia|Nigeria|Kenya|Ethiopia|South\s+Africa)\b)/i.test(f.text) || /orcid/i.test(f.text)) &&
                f.wordCount < 15 && f.text.length < 200;
              const isAffilOrDesignation = EMAIL_RE.test(f.text) || AFFIL_KEYWORDS.test(f.text) || isLocationAffil ||
                /\b(?:librarian|professor|assistant|associate|lecturer|department|dept|polytechnic|university|institute|college|faculty)\b/i.test(f.text);
              const startsWithDrOrProf = /^(?:dr\.|prof\.|professor)\b/i.test(f.text.trim());

              if ((isAffilOrDesignation || EMAIL_RE.test(f.text)) && isAlreadyTitleStarted) {
                  if (startsWithDrOrProf && !AFFIL_KEYWORDS.test(f.text)) {
                      nextRole = 'author';
                  } else {
                      nextRole = 'affiliation';
                  }
              } else if (looksLikeAuthor && isAlreadyTitleStarted) {
                  nextRole = 'author';
              } else if (!isAlreadyTitleStarted) {
                  nextRole = 'title';
              } else if (currentRole === 'title') {
                  if (startsWithDrOrProf || looksLikeAuthor) {
                      nextRole = 'author';
                  } else if (isAffilOrDesignation) {
                      nextRole = 'affiliation';
                  } else if (f.text.length < 200 && f.wordCount < 25 && !foundAbstract && !/^(?:abstract|introduction|related work)/i.test(f.text)) {
                      nextRole = 'title';
                  } else {
                      nextRole = 'author';
                  }
              } else {
                  if (startsWithDrOrProf || looksLikeAuthor) {
                      nextRole = 'author';
                  } else if (isAffilOrDesignation) {
                      nextRole = 'affiliation';
                  } else if (!foundAbstract && i < 20 && f.text.length < 150) {
                      nextRole = 'affiliation';
                  } else {
                      nextRole = 'section';
                  }
              }
          } else {
              nextRole = 'section';
          }
      }
      else if (tagName === 'ul' || tagName === 'ol') {
          nextRole = 'list';
      }
      else if (!foundAbstract && i < 20 && f.text.length > 10 && f.text.length < 500
          && !/ieee|journal|transactions|vol\.|no\.|arxiv|preprint|copyright|issn/i.test(f.text)
          && !/^(?:introduction|related work|background|methodology|conclusion|abstract|acknowledgments|references|overview)/i.test(f.text)) {
          const isAlreadyTitleStarted = currentRole === 'title' || manifest.some(m => m.role === 'title');
          const looksLikeAuthor = ((f.wordCount >= 2 && f.wordCount <= 30 &&
            (f.text.includes(',') || f.text.includes(';') || /\b(and|&)\b/i.test(f.text) || /\d/.test(f.text) || /#/.test(f.text) ||
             /orcid/i.test(f.text) ||
             /^[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){1,3}$/.test(f.text)) &&
            (f.capRatio > 0.15 || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(f.text)) &&
            !AFFIL_KEYWORDS.test(f.text) &&
            !STOPWORDS.has(f.text.split(' ')[0].toLowerCase())) ||
            (f.wordCount === 1 && /^[A-Z][a-z]{2,}$/.test(f.text.trim()) && isAlreadyTitleStarted));

          const isLocationAffil = isAlreadyTitleStarted && !foundAbstract &&
            (/(?:\b\d{5,6}\b|\b(?:India|USA|UK|China|Japan|Germany|France|Australia|Canada|Brazil|Korea|Italy|Spain|Netherlands|Switzerland|Singapore|Malaysia|Iran|Egypt|Pakistan|Indonesia|Thailand|Turkey|Russia|Mexico|Colombia|Nigeria|Kenya|Ethiopia|South\s+Africa)\b)/i.test(f.text) || /orcid/i.test(f.text)) &&
            f.wordCount < 15 && f.text.length < 200;

          if ((EMAIL_RE.test(f.text) || AFFIL_KEYWORDS.test(f.text) || isLocationAffil) && isAlreadyTitleStarted) {
              nextRole = 'affiliation';
          } else if (looksLikeAuthor && isAlreadyTitleStarted) {
              nextRole = 'author';
          } else if (!isAlreadyTitleStarted) {
              nextRole = 'title';
          } else if (currentRole === 'title') {
              if (looksLikeAuthor || EMAIL_RE.test(f.text) || AFFIL_KEYWORDS.test(f.text) || isLocationAffil || /#/.test(f.text) || f.text.includes(',') || f.text.match(/\d/)) {
                  if (looksLikeAuthor) {
                      nextRole = 'author';
                  } else if (EMAIL_RE.test(f.text) || AFFIL_KEYWORDS.test(f.text) || isLocationAffil) {
                      nextRole = 'affiliation';
                  } else {
                      nextRole = 'author';
                  }
              } else if (f.text.length < 200 && f.wordCount < 25 && !foundAbstract && !/^(?:abstract|introduction|related work)/i.test(f.text)) {
                  nextRole = 'title';
              } else {
                  nextRole = 'section';
              }
          } else {
              if (looksLikeAuthor) {
                  nextRole = 'author';
              } else if (EMAIL_RE.test(f.text) || AFFIL_KEYWORDS.test(f.text) || isLocationAffil) {
                  nextRole = 'affiliation';
              }
          }
      }

      // 1. Apply override/continuation heuristics to nextRole first
      if (currentRole === 'abstract' && nextRole === 'paragraph' && i < currentStart + 25 && f.wordCount > 5) {
          nextRole = 'abstract';
      } else if ((currentRole as string) === 'algorithm' && ['paragraph', 'list', 'table'].includes(nextRole)) {
          const isActualHeading = this.detectHeading(el, f.text, manifest) !== null ||
            tagName.startsWith('h') ||
            DeepDocumentParser.FORCED_LEVEL1.has(f.text.toLowerCase().replace(/^(?:\d+[\.\s]+|[ivxlcdm]+[\.\s]+)+/i, '').replace(/[.:\s]*$/, '').trim());
          if (isActualHeading) {
              nextRole = 'section';
          }           else if (nextRole === 'list' || nextRole === 'table' || this.isAlgorithmBodyLine(f.text, el)) {
              nextRole = 'algorithm';
          }
      } else if (['idle', 'title', 'author', 'affiliation', 'paragraph'].includes(currentRole) && nextRole === 'paragraph' && !foundAbstract) {
          const isAlreadyTitleStarted = currentRole === 'title' || manifest.some(m => m.role === 'title');
          const isLocationAffil = isAlreadyTitleStarted && !foundAbstract &&
            (/(?:\b\d{5,6}\b|\b(?:India|USA|UK|China|Japan|Germany|France|Australia|Canada|Brazil|Korea|Italy|Spain|Netherlands|Switzerland|Singapore|Malaysia|Iran|Egypt|Pakistan|Indonesia|Thailand|Turkey|Russia|Mexico|Colombia|Nigeria|Kenya|Ethiopia|South\s+Africa)\b)/i.test(f.text) || /orcid/i.test(f.text)) &&
            f.wordCount < 15 && f.text.length < 200;

          if (isAlreadyTitleStarted && (EMAIL_RE.test(f.text) || AFFIL_KEYWORDS.test(f.text) || isLocationAffil)) {
            const affilIdx = f.text.search(AFFIL_KEYWORDS);
            const preAffil = affilIdx > 0 ? f.text.substring(0, affilIdx).trim() : '';
            const lookLikeNames = preAffil
              .split(/[,;\n]/)
              .map(s => s.trim())
              .filter(s => s.length > 1 && /^[A-Z][a-z]/.test(s) && s.split(' ').length <= 6 && !AFFIL_KEYWORDS.test(s));
            if (lookLikeNames.length >= 1 && preAffil.length > 0) {
              nextRole = 'author';
            } else {
              nextRole = 'affiliation';
            }
          }
          else if (isAlreadyTitleStarted && f.text.length < 700 && f.wordCount >= 2 && f.wordCount <= 30
            && (f.capRatio > 0.12 || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(f.text))
            && !AFFIL_KEYWORDS.test(f.text)
            && !STOPWORDS.has(f.text.split(' ')[0].toLowerCase())
            && !/\b(?:we|this|propose|present|study|paper|in|the|a|an)\b/i.test(f.text.split(/[,;\s]/)[0])
            && !/^(?:introduction|related work|background|methodology|conclusion|abstract|acknowledgments|references|overview)/i.test(f.text)) {
               nextRole = 'author';
          }
      }

      // 2. Perform the flush check
      if (nextRole === 'section' || nextRole === 'equation' || nextRole === 'table' || nextRole === 'figure' || nextRole === 'algorithm') {
          flush(i);
          manifest.push({ role: nextRole, startIdx: i, endIdx: i, elements: [el] });
          continue;
      }

      if (nextRole !== currentRole) {
          flush(i);
      }

      currentRole = nextRole;
      if (currentStart === -1) currentStart = i;
      currentElements.push(el);
    }
    flush(elements.length);
    return manifest;
  }

  private static Phase4_deepExtract(manifest: any[], result: StructuredDocument, _mathBlocks: any[], _rawHtml: string) {
      const consumedCaptions = new Set<Element>();

      // Position maps (1-based document order per type) so adjacent table/figure captions
      // can be disambiguated: a caption whose label ordinal matches the FAR-side media
      // element's position belongs to that media, not the current one.
      const tablePositions = new Map<Element, number>();
      const figurePositions = new Map<Element, number>();
      {
          let tIdx = 0;
          let fIdx = 0;
          for (let i = 0; i < manifest.length; i++) {
              const entry = manifest[i];
              if (entry.role === 'table') {
                  tIdx++;
                  tablePositions.set(entry.elements[0], tIdx);
              } else if (entry.role === 'figure') {
                  fIdx++;
                  figurePositions.set(entry.elements[0], fIdx);
              }
          }
      }

      // Pre-pass: discover and consume all captions for tables and figures
      for (let i = 0; i < manifest.length; i++) {
          const entry = manifest[i];
          if (entry.role === 'table') {
              entry.caption = this.findCaption(entry.elements[0], consumedCaptions, 'table', tablePositions);
          } else if (entry.role === 'figure') {
              const el0 = entry.elements[0];
              const textContent = el0.textContent || '';
              const chartMatch = textContent.match(/CHARTIMGX(chart_pending_\d+)XEND/);
              if (chartMatch) {
                  entry.caption = this.findCaption(el0, consumedCaptions, 'figure', figurePositions);
              } else {
                  const imgs: Element[] = Array.from(el0.querySelectorAll('img'));
                  if (imgs.length === 0 && el0.tagName.toLowerCase() === 'img') imgs.push(el0);
                  if (imgs.length > 0) {
                      entry.caption = this.findCaption(el0, consumedCaptions, 'figure', figurePositions);
                  }
              }
          }
      }

      const processedMathBlocks = new Set<number>();

      // Heading hierarchy state: the first heading in a document is a main
      // section (level 1) even if it carries a numbered "X.Y" prefix — a
      // "3.1" at document start is not a subsection of a phantom section.
      let lastHeadingLevel = 0;

      for (let i = 0; i < manifest.length; i++) {
          const entry = manifest[i];
          
          // Filter out already consumed elements (like captions) across non-media roles
          if (entry.role !== 'table' && entry.role !== 'figure') {
              entry.elements = entry.elements.filter((el: Element) => !consumedCaptions.has(el));
              if (entry.elements.length === 0) continue;
          }

          const text = entry.elements.map((e: Element) => e.textContent || '').join('\n').trim();
          if (!text && entry.role !== 'table' && entry.role !== 'figure') continue;

          if (entry.role === 'title') {
              result.title = text;
          }
          else if (entry.role === 'abstract') {
              result.abstract += text.replace(/^(?:abstract|summary)\s*[:.\u2013\u2014\u2212\-\—\–]*/i, '').trim() + " ";
          }
          else if (entry.role === 'keywords') {
              const match = text.match(/(?:Keywords|Index Terms|Key\s*Words)\s*[:.\u2013\u2014\u2212\-\—\–]*\s*(.*)/is);
              const rawKeywordText = match?.[1] ? match[1] : text.replace(/^(?:Keywords|Index Terms|Key\s*Words)\s*[:.\u2013\u2014\u2212\-\—\–]*\s*/i, '');
              
              let keywordPart = rawKeywordText;
              let remainingProse = '';
              
              const periodIdx = rawKeywordText.search(/\.\s+[A-Z]/);
              if (periodIdx !== -1) {
                keywordPart = rawKeywordText.substring(0, periodIdx).trim();
                remainingProse = rawKeywordText.substring(periodIdx + 1).trim();
              }
              
              const rawList = keywordPart.split(/[,;·•–—|]|\n/).map((k: string) => k.trim().replace(/\.$/, '')).filter(Boolean);
              const validKeywords: string[] = [];
              
              for (let kIdx = 0; kIdx < rawList.length; kIdx++) {
                const item = rawList[kIdx];
                const wordCount = item.split(/\s+/).length;
                if (wordCount <= 6) {
                  validKeywords.push(item);
                } else {
                  remainingProse = rawList.slice(kIdx).join(', ') + (remainingProse ? ' ' + remainingProse : '');
                  break;
                }
              }
              
              if (validKeywords.length > 0) result.keywords.push(...validKeywords);
              if (remainingProse.length > 15) {
                result.body.push({ type: 'paragraph', text: remainingProse });
              }
          }
          else if (entry.role === 'author') {
              let authorText = text;
              let orgFragment = '';
              const affilIdx = text.search(AFFIL_KEYWORDS);
              if (affilIdx > 0) {
                const preAffil = text.substring(0, affilIdx);
                const lastSep = Math.max(preAffil.lastIndexOf(','), preAffil.lastIndexOf('\n'), preAffil.lastIndexOf(';'));
                if (lastSep > 0) {
                  authorText = preAffil.substring(0, lastSep).trim();
                  orgFragment = text.substring(lastSep + 1).trim();
                } else {
                  authorText = preAffil.trim();
                  orgFragment = text.substring(affilIdx).trim();
                }
              }
              if (result.title && result.title.length > 20 && authorText.startsWith(result.title)) {
                authorText = authorText.substring(result.title.length).replace(/^\s*[,;]?\s*/, '').trim();
              }
              const names = authorText.split(/[,;&]|\s+and\s+/i).map((n: string) => n.trim()).filter((n: string) => n.length > 2);
              names.forEach((n: string) => {
                  const fnMatch = n.match(/([\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u2070\d]+)/);
                  const affilId = fnMatch ? fnMatch[1].replace(/\u00b9/g, '1').replace(/\u00b2/g, '2').replace(/\u00b3/g, '3') : '';
                  const cleanName = n.replace(/[*\u2020\u2021\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u2070\d]/g, '').trim();
                  if (cleanName.length < 2) return;
                  if (AFFIL_KEYWORDS.test(cleanName) || cleanName.split(' ').length > 7) return;
                  let aut = result.authors.find(a => a.name === cleanName);
                  if (!aut) {
                      aut = { name: cleanName, affiliationIds: affilId ? [affilId] : [] };
                      result.authors.push(aut);
                  }
              });
              if (orgFragment && orgFragment.length > 5) {
                let cleanOrg = orgFragment.replace(EMAIL_RE, '').replace(/[*\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u2070\d]/g, '').trim();
                cleanOrg = cleanOrg.replace(/(?:corresponding\s+author\s*:\s*|corresponding\s+author\b)/gi, '')
                                   .split('\n')
                                   .map((line: string) => line.trim())
                                   .filter((line: string) => {
                                      const plain = line.replace(/[,;:\s()]/g, '');
                                      return plain.length > 0 && !/^(?:email|e-mail|corresponding|author|contact)$/i.test(plain);
                                   })
                                   .join(', ')
                                   .replace(/,\s*,/g, ',')
                                   .replace(/^[\s,]+|[\s,]+$/g, '')
                                   .trim();
                if (cleanOrg && !result.organizations.includes(cleanOrg)) result.organizations.push(cleanOrg);
              }
          }
          else if (entry.role === 'affiliation') {
              const emails = text.match(EMAIL_RE) || [];
              if (emails.length > 0 && result.authors.length > 0) result.authors[result.authors.length - 1].email = emails[0];
              let cleanOrg = text.replace(EMAIL_RE, '').replace(/[*†‡¹²³⁴⁵⁶⁷⁸⁹⁰\d]/g, '').trim();
              cleanOrg = cleanOrg.replace(/(?:corresponding\s+author\s*:\s*|corresponding\s+author\b)/gi, '')
                                 .split('\n')
                                 .map((line: string) => line.trim())
                                 .filter((line: string) => {
                                    const plain = line.replace(/[,;:\s()]/g, '');
                                    return plain.length > 0 && !/^(?:email|e-mail|corresponding|author|contact)$/i.test(plain);
                                 })
                                 .join(', ')
                                 .replace(/,\s*,/g, ',')
                                 .replace(/^[\s,]+|[\s,]+$/g, '')
                                 .trim();
              // UNIVERSAL: Reject email-only noise entries that Word documents often produce
              // e.g. "Email:, (Primary), name@domain.com (Secondary)"
              const isNoise = /^(?:email|emails|primary|secondary|contact|corresponding|author|tel|phone|fax|e-mail|e-mails|[:,\s\-()\[\]])*$/i.test(cleanOrg) ||
                              /^Email[:\s,]/i.test(text.trim()) || // starts with "Email:"
                              (emails.length > 0 && text.replace(EMAIL_RE, '').replace(/[,;:\s()/]/g, '').length < 8); // mostly just email
              if (cleanOrg && cleanOrg.length > 5 && !isNoise && !result.organizations.includes(cleanOrg)) result.organizations.push(cleanOrg);
          }
          else if (entry.role === 'section' || entry.role === 'paragraph') {
              const mergedText = mergeCitations(text);
              const withCitations = mergedText.replace(/(?<!\b(?:interval|range|scale|domain|coordinates|matrix|vector|box|bounds|values|pixel|pixels|from|to|between|like|such\s+as|e\.g\.?|eg\.?|bracket|for\s+example|example)\s*(?:\[\s*\d{1,3}\s*\]\s*[,;\s]*)*)\[\s*(\d{1,3}(?:\s*[,;–\-]\s*\d{1,3})*)\s*\]/gi, (match: string, inner: string) => {
                  const parts = inner.split(/[,;–\-\u2013\u2014]/).map(p => p.trim()).filter(Boolean);
                  const hasZero = parts.some(p => p === '0');
                  let offset = 0;
                  if (hasZero && parts.every(p => /^\d+$/.test(p))) {
                      offset = 1;
                  }
                  const refs = parts.map(r => {
                      const trimmed = r.trim();
                      if (!trimmed) return null;
                      // Handle ranges like [1-3] or [1–3]
                      if (/^\d+\s*[-–]\s*\d+$/.test(trimmed)) {
                          const [start, end] = trimmed.split(/[-–]/).map(n => parseInt(n.trim()) + offset);
                          if (!isNaN(start) && !isNaN(end) && start < end && end - start < 30) {
                              return Array.from({ length: end - start + 1 }, (_, i) => `ref${start + i}`).join(',');
                          }
                      }
                      // Handle single numbers
                      if (/^\d+$/.test(trimmed)) return `ref${parseInt(trimmed) + offset}`;
                      return trimmed;
                  }).filter(Boolean).join(',');
                  
                  if (!refs) return match;
                  return `\\cite{${refs}}`;
              });

              // Enrich equation count for inline/display MATHBLOCKX markers inside paragraphs
              const markerMatches = Array.from(text.matchAll(/MATHBLOCKX(\d+)XMARKER/gi));
              for (const mm of markerMatches as RegExpExecArray[]) {
                const mbIdx = parseInt(mm[1]);
                if (!processedMathBlocks.has(mbIdx)) {
                  processedMathBlocks.add(mbIdx);
                  const mb = _mathBlocks[mbIdx];
                  if (mb && (typeof mb === 'object' ? mb.isDisplay : false)) {
                    result.stats.equationCount++;
                  }
                }
              }

              if (entry.role === 'section') {
                  // UNIVERSAL: Check for embedded heading flag set in Phase2
                  const embeddedHeading = entry.elements[0] && (entry.elements[0] as any).__embeddedHeading;
                  if (embeddedHeading) {
                    // Emit the short heading as a level-2 subsection
                    result.body.push({ type: 'heading', level: 2, text: embeddedHeading });
                    lastHeadingLevel = 2;
                    // Emit body text (everything after the colon) as a paragraph
                    const sepIdx = text.indexOf(embeddedHeading);
                    const afterHeading = sepIdx !== -1
                      ? text.substring(sepIdx + embeddedHeading.length).replace(/^\s*[:.]+\s*/, '').trim()
                      : '';
                    if (afterHeading.length > 0) {
                      result.body.push({ type: 'paragraph', text: afterHeading });
                    }
                  } else {
                    let level = this.detectHeading(entry.elements[0], text, manifest) || 2;
                    // First heading in the document is always a main section —
                    // a leading "X.Y" numbered prefix does not make it a subsection.
                    if (lastHeadingLevel === 0 && level > 1) level = 1;
                    let cleanText = text.trim();
                    const numericPrefix = /^(?:\s*(?:section|chapter|appendix|part)\s+)?(?:\d+)(?:\.\d+)*\.?[.:\s)]+\s*/i;
                    const alphaRomanPrefix = /^(?:\s*(?:section|chapter|appendix|part)\s+)?(?:[a-zA-Z](?:\.\d+)+|[ivxlcdm]{2,}|[a-zA-Z]|[ivxlcdm])\.?[.:)]+\s+/i;
                    const prefixMatchText = cleanText.match(numericPrefix) ||
                        (alphaRomanPrefix.test(cleanText) ? cleanText.match(alphaRomanPrefix) : null);
                    if (prefixMatchText) {
                        // "X.Y Title" numbered prefixes encode the heading depth.
                        // If the number is the only thing that makes this line a
                        // heading, keep it in the text and derive the level from it
                        // — stripping it would erase the depth signal entirely.
                        const withoutNumber = cleanText.slice(prefixMatchText[0].length).trim();
                        if (withoutNumber && this.detectHeading(entry.elements[0], withoutNumber, manifest)) {
                            cleanText = withoutNumber;
                        } else {
                            const numPart = prefixMatchText[0].match(/\d+(?:\.\d+)*/)?.[0];
                            level = Math.min(3, numPart ? numPart.split('.').length : 1);
                        }
                    }
                    result.body.push({ type: 'heading', level, text: cleanText || text });
                    lastHeadingLevel = level;
                  }
              } else {
                  result.body.push({ type: 'paragraph', text: withCitations });
              }
          }
          else if (entry.role === 'table') {
              // tableCount computed in Phase5 from body nodes — no Phase4 increment needed.
              let tableCaption = entry.caption;
              
              const tableEl = entry.elements[0];
              const isNativeTable = tableEl.tagName.toLowerCase() === 'table';

              if (isNativeTable) {
                  const firstRow = tableEl.querySelector('tr');
                  if (firstRow) {
                      const firstRowText = firstRow.textContent?.trim() || '';
                      const normalizedFirstRowText = firstRowText.replace(/[\u00A0\u202F\u2009\u200B\uFEFF]/g, ' ').trim();
                      if (/^\s*(?:Table|Tab\b\.?)\s*[\d.\-:A-Za-z]+/i.test(normalizedFirstRowText)) {
                          if (!tableCaption) {
                              const prefixMatch = normalizedFirstRowText.match(/^\s*(?:Table|Tab\b\.?)\s*[\d.\-:A-Za-z]+/i);
                              const cleanPrefix = prefixMatch ? prefixMatch[0].replace(/[:.–\-\s]+$/, '').trim() : '';
                              const afterPrefix = prefixMatch ? normalizedFirstRowText.slice(prefixMatch[0].length).replace(/^[:.–\-\s]*/, '').trim() : '';
                              tableCaption = afterPrefix.length > 0 ? `${cleanPrefix}: ${afterPrefix}` : cleanPrefix;
                          }
                          firstRow.remove(); // Remove the caption row so it's not rendered inside the table
                      }
                  }

                  if (!tableCaption) {
                    const firstTh = tableEl.querySelector('th');
                    const thText = firstTh?.textContent?.trim() || '';
                    if (/^\s*(?:Table|Tab\b\.?)\s*[\d.\-:A-Za-z]+/i.test(thText)) {
                      tableCaption = thText;
                      firstTh?.parentElement?.remove();
                    }
                  }
              }

              // Standard HTML <table> vs Plain-text table elements
              let tableHtml = '';
              if (isNativeTable) {
                tableHtml = tableEl.outerHTML;
              } else {
                tableHtml = this.convertPlainTextTableToHtml(entry.elements);
              }

              // UNIVERSAL: A table must actually contain rows and columns to be emitted.
              // Degenerate detections (tab-stopped layout/prose lines, empty shells) are
              // demoted to plain paragraphs so they neither pollute the table count nor
              // render as empty tables.
              const { rowCount, colCount } = this.tableHtmlDimensions(tableHtml);
              if (rowCount === 0 || colCount === 0) {
                  const fallbackText = entry.elements.map((e: Element) => e.textContent || '').join('\n').trim();
                  if (fallbackText) result.body.push({ type: 'paragraph', text: fallbackText });
                  continue;
              }

              if (!tableCaption) {
                tableCaption = `Table (${rowCount} rows × ${colCount} cols)`;
              }
              
              result.body.push({ type: 'table', html: tableHtml, caption: tableCaption } as any);
          }
          else if (entry.role === 'figure') {
              const el0 = entry.elements[0];
              const textContent = el0.textContent || '';
              const chartMatch = textContent.match(/CHARTIMGX(chart_pending_\d+)XEND/);
              
                  if (chartMatch) {
                      const src = chartMatch[1] + '.png';
                      let figCaption = entry.caption;
                      if (!figCaption) {
                          let sib = el0.nextElementSibling;
                          for (let h = 0; h < 5 && sib; h++, sib = sib.nextElementSibling) {
                              const t = sib.textContent?.trim() || '';
                              if (/^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram)\.?\s*[\d.]+/i.test(t) && !this.isFigureCaptionProse(t)) {
                                  figCaption = t;
                                  consumedCaptions.add(sib);
                                  break;
                              }
                          }
                      }
                  result.stats.chartCount++;
                  result.body.push({ type: 'chart', id: src, caption: figCaption || '' } as any);
                  continue;
              }

              const imgs: Element[] = Array.from(el0.querySelectorAll('img'));
              if (imgs.length === 0 && el0.tagName.toLowerCase() === 'img') imgs.push(el0 as Element);

              // Extract sub-captions if multiple images are side-by-side
              let subCaptions: string[] = [];
              if (imgs.length > 1) {
                let nextSib = el0.nextElementSibling;
                while (nextSib && !nextSib.textContent?.trim() && !nextSib.querySelector('img') && !['table', 'img', 'figure'].includes(nextSib.tagName.toLowerCase())) {
                  nextSib = nextSib.nextElementSibling;
                }
                if (nextSib && ['p', 'div', 'ol', 'ul'].includes(nextSib.tagName.toLowerCase())) {
                  const sibText = nextSib.textContent?.trim() || '';
                  let parts: string[] = [];
                  
                  if (/\(\s*[a-z]\s*\)/i.test(sibText)) {
                    parts = sibText.split(/\s*(?:\(\s*[a-z]\s*\))\s*/gi).map((p: string) => p.trim()).filter(Boolean);
                  } else if (/\b[a-z]\s*\)/i.test(sibText)) {
                    parts = sibText.split(/\s*(?:\b[a-z]\s*\))\s*/gi).map((p: string) => p.trim()).filter(Boolean);
                  } else if (/\b[a-z]\s*\.\s+/i.test(sibText)) {
                    parts = sibText.split(/\s*(?:\b[a-z]\s*\.)\s+/gi).map((p: string) => p.trim()).filter(Boolean);
                  }

                  if (parts.length !== imgs.length) {
                    parts = sibText.split(/\s{2,}|\t+/).map((p: string) => p.trim()).filter(Boolean);
                  }

                  if (parts.length === imgs.length) {
                    subCaptions = parts.map((p: string) => p.replace(/[,;.]\s*$/, '').trim());
                    consumedCaptions.add(nextSib);
                  }
                }

                // If sub-captions not found in next sibling, try extracting from the overall caption
                if (subCaptions.length === 0 && entry.caption) {
                  const capText = entry.caption;
                  let parts: string[] = [];
                  if (/\(\s*[a-z]\s*\)/i.test(capText)) {
                    parts = capText.split(/\s*(?:\(\s*[a-z]\s*\))\s*/gi).map((p: string) => p.trim()).filter(Boolean);
                  } else if (/\b[a-z]\s*\)/i.test(capText)) {
                    parts = capText.split(/\s*(?:\b[a-z]\s*\))\s*/gi).map((p: string) => p.trim()).filter(Boolean);
                  }
                  if (parts.length - 1 === imgs.length) {
                    subCaptions = parts.slice(1).map((p: string) => p.replace(/[,;.]\s*$/, '').trim());
                  }
                }
              }

              for (let idx = 0; idx < imgs.length; idx++) {
                  const img = imgs[idx];
                  const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
                  if (!src) continue;

                  let figCaption = entry.caption;
                  if (!figCaption) figCaption = img.getAttribute('alt') || img.getAttribute('title') || '';
                  if (!figCaption) {
                      let sib = el0.nextElementSibling;
                      for (let h = 0; h < 5 && sib; h++, sib = sib.nextElementSibling) {
                          const t = sib.textContent?.trim() || '';
                          if (/^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram)\.?\s*[\d.]+/i.test(t) && !this.isFigureCaptionProse(t)) {
                              figCaption = t;
                              consumedCaptions.add(sib);
                              break;
                          }
                      }
                  }
                  
                  let subCaption = '';
                  if (subCaptions.length === imgs.length) {
                      subCaption = subCaptions[idx];
                  }

                  let cleanSubCaption = subCaption.trim();
                  let prevClean = '';
                  while (prevClean !== cleanSubCaption) {
                      prevClean = cleanSubCaption;
                      cleanSubCaption = cleanSubCaption.replace(/^\s*(?:\(\s*[a-zA-Z0-9]\s*\)|\[\s*[a-zA-Z0-9]\s*\]|\b[a-zA-Z0-9]\s*\)|\b[a-zA-Z0-9]\s*\.)\s*[:.\-–—]?\s*/i, '').trim();
                  }

                  const isChart = /rf_chart_/i.test(src);
                  if (isChart) {
                    result.stats.chartCount++;
                    result.body.push({
                        type: 'chart',
                        id: src,
                        caption: figCaption || '',
                        subCaption: cleanSubCaption
                    } as any);
                  } else {
                    result.stats.imageCount++;
                    result.body.push({
                        type: 'figure',
                        id: src,
                        caption: figCaption || '',
                        subCaption: cleanSubCaption
                    } as any);
                  }
              }
          }
          else if (entry.role === 'equation') {
              const mmMatches = Array.from(text.matchAll(/MATHBLOCKX(\d+)XMARKER/gi));
              for (const mm of mmMatches as RegExpExecArray[]) {
                processedMathBlocks.add(parseInt(mm[1]));
              }
              result.body.push({ type: 'equation', latex: text });
          }
          else if (entry.role === 'algorithm') {
              let steps: string[] = [];
              let titleText = 'Algorithm';
              
              if (entry.elements.length === 1 && entry.elements[0].tagName.toLowerCase() === 'table') {
                  const rows = Array.from<Element>(entry.elements[0].querySelectorAll('tr')).map((r) => r.textContent?.trim() || '').filter(Boolean);
                  if (rows.length > 0) {
                      const titleMatch = rows[0].match(/^(?:\s*(?:Algorithm|Alg\.?|Pseudocode|Procedure|ALGORITHM|PROCEDURE|Listing)\s*(?:\d+(?:\.\d+)*)?)/i);
                      titleText = titleMatch ? rows[0].substring(titleMatch[0].length).trim().replace(/^[:\.\-\s]+/, '') || rows[0] : rows[0];
                      steps = rows.slice(1);
                  }
              } else {
                  const firstText = entry.elements[0].textContent?.trim() || '';
                  const titleMatch = firstText.match(/^(?:\s*(?:Algorithm|Alg\.?|Pseudocode|Procedure|ALGORITHM|PROCEDURE|Listing)\s*(?:\d+(?:\.\d+)*)?)/i);
                  titleText = titleMatch ? firstText.substring(titleMatch[0].length).trim().replace(/^[:\.\-\s]+/, '') || firstText : firstText;
                  
                  if (entry.elements.length === 1 && firstText.includes('\n')) {
                      steps = firstText.split('\n').map((l: string) => l.trim()).filter(Boolean).slice(1);
                  } else {
                      // Extract algorithm steps recursively from child paragraphs, list items, or table rows
                      steps = [];
                      for (let idx = 1; idx < entry.elements.length; idx++) {
                          const el = entry.elements[idx];
                          const tag = el.tagName.toLowerCase();
                          if (tag === 'ul' || tag === 'ol') {
                              const items = Array.from(el.querySelectorAll('li')).map((li: any) => li.textContent?.trim() || '').filter(Boolean);
                              steps.push(...items);
                          } else if (tag === 'table') {
                              const rows = Array.from(el.querySelectorAll('tr')).map((r: any) => r.textContent?.trim() || '').filter(Boolean);
                              steps.push(...rows);
                          } else {
                              const lines = (el.textContent || '').split('\n').map((l: string) => l.trim()).filter(Boolean);
                              steps.push(...lines);
                          }
                      }
                  }
              }
              
              result.body.push({ type: 'algorithm', title: titleText, items: steps.length ? steps : [titleText] } as any);
          }
          else if (entry.role === 'list') {
                  const items: string[] = [];
                  for (const listEl of entry.elements) {
                      const tag = listEl.tagName.toLowerCase();
                      if (tag === 'ul' || tag === 'ol') {
                          items.push(...Array.from<Element>(listEl.querySelectorAll('li')).map((li) => li.textContent?.trim() || '').filter(Boolean));
                      } else {
                          const t = listEl.textContent?.trim() || '';
                          if (t) items.push(t);
                      }
                  }
              result.body.push({ type: 'list', items, listType: 'itemize' });
          }
          else if (entry.role === 'reference') {
              const allItems: string[] = [];
              entry.elements.forEach((el: Element) => {
                  const tag = el.tagName.toLowerCase();
                  if (tag === 'ul' || tag === 'ol') {
                      const lis = Array.from(el.querySelectorAll('li')).map(li => li.textContent?.trim() || '').filter(t => t.length > 10);
                      allItems.push(...lis);
                  } else {
                      const text = el.textContent?.trim() || '';
                      if (text.length > 10) allItems.push(text);
                  }
              });

              allItems.forEach((refText) => {
                  if (DeepDocumentParser.isNewReferenceStart(refText, result.references.length === 0)) {
                      result.references.push(refText);
                  } else if (result.references.length > 0) {
                      result.references[result.references.length - 1] += " " + refText;
                  } else {
                      // NOT a reference! Add it back as body paragraph so it doesn't get lost or contaminate bib!
                      result.body.push({ type: 'paragraph', text: refText });
                  }
              });
          }
      }
      result.abstract = result.abstract.replace(/^[\s:.\-–—−\u2013\u2014]+/, '').trim();
      result.keywords = result.keywords.map(k => k.replace(/^[\s:.\-–—−\u2013\u2014]+/, '').trim()).filter(Boolean);
  }

  private static isNewReferenceStart(line: string, _isFirst: boolean): boolean {
    const trimmed = line.trim();
    if (trimmed.length < 10) return false;

    // 1. Matches numeric prefix: [1], 1., 1), [Author2020]
    // If it starts with a clear numbered or bracketed prefix inside the reference block, it is almost certainly a new reference start.
    const hasNumberedPrefix = /^\[?\d+\]?[\dots\-\t\s]+/.test(trimmed) || /^\[?\d+\]?[\.\-\t\s]+/.test(trimmed) || /^\[[\w\-]+\]\s*\S/.test(trimmed);
    if (hasNumberedPrefix) return true;

    // Safety check: a real reference almost always contains a year, quotes, or academic publication keywords.
    // If none of these are present, it is highly likely instructional text or name list examples.
    const hasYear = /\b(19|20)\d{2}\b/.test(trimmed);
    const hasQuotes = /[“”"'\`‘]/.test(trimmed);
    const hasRefKeywords = /\b(?:vol|volume|no|issue|pp|pages|page|press|university|dept|department|journal|proceedings|proc|conf|conference|transactions|trans|ieee|acm|elsevier|springer|doi|https?|url|www|unpublished|submitted|to\s+be\s+published|in\s+press)\b/i.test(trimmed);
    
    if (!hasYear && !hasQuotes && !hasRefKeywords) {
      return false;
    }

    // 1. Matches numeric prefix: [1], 1., 1)
    if (/^\[?\d+\]?[\dots\-\t\s]+/.test(trimmed) || /^\[?\d+\]?[\.\-\t\s]+/.test(trimmed)) return true;

    // 2. Common continuation check: if it starts with lowercase or continuation word, it is NOT a new reference
    if (/^[a-z]/.test(trimmed)) return false;
    if (/^(?:vol|no|pp|pages|page|issue|doi|https?|url|journal|proceedings|press|university|edited|editor|editors|in|and|of|for|with|by|at|on|from|to|the|a|an)\b/i.test(trimmed)) return false;
    if (/^[&,.;\-:\/“"']/.test(trimmed)) return false;

    // 3. Author patterns:
    // - LastName, F. or LastName, First (including Unicode accents)
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,25},\s+[A-Z\u00C0-\u024F\u1E00-\u1EFF][a-z\u00C0-\u024F\u1E00-\u1EFF]?\.?\b/.test(trimmed)) return true;
    // - LastName F. / LastName F.M. / LastName F.M.,
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,25}\s+[A-Z\u00C0-\u024F\u1E00-\u1EFF](?:\.[A-Z\u00C0-\u024F\u1E00-\u1EFF])*\.?\s*(?:,|\s|$)/.test(trimmed)) return true;
    // - LastName et al.
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,25}\s+et\s+al\b/i.test(trimmed)) return true;
    // - FirstName LastName / FirstName M. LastName,
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF][a-z\u00C0-\u024F\u1E00-\u1EFF]+\s+(?:[A-Z\u00C0-\u024F\u1E00-\u1EFF]\.?\s+)?[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,25}\s*(?:,|\s|$)/.test(trimmed)) return true;
    // - Author (Year)
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,25}\s+\(\d{4}\)/.test(trimmed)) return true;
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,25}\s*,\s*[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,25}\s+\(\d{4}\)/.test(trimmed)) return true;

    // Default fallback: if it starts with a Capital letter and has a year in the first 60 characters
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed) && /\(\d{4}\)/.test(trimmed.substring(0, 60))) {
      return true;
    }


    return false;
  }

  private static detectHeading(el: Element, text: string, manifest?: any[]): number | null {
    if (/MATHBLOCKX\d+XMARKER/i.test(text)) return null;
    
    const tagName = el.tagName.toLowerCase();
    if (['table', 'img', 'figure'].includes(tagName)) return null;
    
    const targetTextClean = text.trim();
    if (targetTextClean.endsWith(':') && targetTextClean.length < 60 && targetTextClean.length > 3) {
      const cleanText = targetTextClean.replace(/:$/, '').trim();
      const wordsCount = cleanText.split(/\s+/).filter(Boolean).length;
      const firstChar = cleanText.charAt(0);
      const isCapitalized = firstChar >= 'A' && firstChar <= 'Z';
      const isStopWord = STOPWORDS.has(cleanText.toLowerCase());
      if (isCapitalized && !isStopWord && wordsCount <= 3 && !/^(?:where|and|or|if|then|else)$/i.test(cleanText)) {
        return 3;
      }
    }
    
    const targetEl = el;
    
    if (tagName === 'ul' || tagName === 'ol') {
      const lis = Array.from(el.querySelectorAll('li'));
      if (lis.length > 0 && lis.length <= 2) {
        const liText = (lis[0].textContent || '').trim();
        const liNorm = liText.toLowerCase().replace(/^(?:\d+[\.\s]+|[ivxlcdm]+[\.\s]+)+/i, '').replace(/[.:\s]*$/, '').trim();
        const matchesCanonical = this.FORCED_LEVEL1.has(liNorm);
        const matchesNumbered = /^(?:\s*(?:section|chapter|appendix|part)\s+)?(?:\[|\()?((?:\d+|[ivxlcdm]+|[a-z])(?:\.(?:\d+|[ivxlcdm]+|[a-z]))*)(?:\]|\))?[.:\s)]/i.test(liText);
        
        const words = liText.split(/\s+/).filter(w => w.length > 0);
        const isTitleCase = words.length > 0 && words.every(w => /^[A-Z]/.test(w) || STOPWORDS.has(w.toLowerCase()) || /^\d/.test(w));
        
        const isHeadingLike = liText.length > 2 && liText.length < 120 && 
          !liText.includes('   ') && 
          liText.split(/\s{2,}/).length === 1 && (
            matchesCanonical || 
            matchesNumbered || 
            isTitleCase ||
            (lis[0].querySelector('strong, b') !== null) ||
            (el.querySelector('strong, b') !== null)
          );
        
        if (isHeadingLike) {
          if (matchesCanonical) {
            return 1;
          }
          if (matchesNumbered) {
            const prefixMatch = liText.match(/^(?:\s*(?:(?:section|chapter|appendix|part)\s+)?(?:\[|\()?((?:\d+|[ivxlcdm]+|[A-Za-z])(?:\.(?:\d+|[ivxlcdm]+|[A-Za-z]))*)(?:\]|\))?(?:\.?[.:\s)]+))/i);
            if (prefixMatch) {
              const cleanPrefix = prefixMatch[1];
              const parts = cleanPrefix.split('.');
              return Math.min(3, parts.length);
            }
          }
          return 2;
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    const f = this.featurize(targetEl);
    if (f.text.length > 200 || f.text.length < 3) return null;
    // Headings never contain tab/pipe column structure (tab-stopped layout/legend lines are not headings)
    if (f.text.includes('\t') || f.text.includes('|')) return null;
    if (f.text.endsWith('.') && !/^(?:\d+[.\s]+|[ivxlcdm]+[.\s]+|[a-z][.\s]+)/i.test(f.text) && !(f.isBold || f.wordCount < 3)) return null;

    // Guard: Exclude Author/Affiliation metadata lines that start with number indices (e.g., "1 Designation of 1st Author...", "1 Department of CS...")
    const isAuthorAffilText = /\b(?:designation|department|organization|university|faculty|institute|college|school|author|affiliation|prof\.|professor|lecturer|student)\b/i.test(f.text) ||
                             /^\d+\s*(?:st|nd|rd|th)?\s*(?:author|designation|department|organization|university|faculty|institute|college|school)/i.test(f.text);
    if (isAuthorAffilText && !/\b(?:introduction|methods|results|discussion|conclusion|references)\b/i.test(f.text)) {
      return null;
    }

    const normClean = f.text.toLowerCase()
      .replace(/^(?:\d+[.\s]+|[ivxlcdm]+[.\s]+|[a-z][.\s]+)+\s*/i, '')
      .replace(/[.\s:]+$/, '')
      .trim();

    // Guard: a "heading" that is actually an author/affiliation metadata line
    // repeating a manifest author (e.g. numbered "4. John Smith" before the
    // author-details block) must not hijack the role and erase the real section.
    const authorMatch = (manifest || []).some((m: any) => {
      if (!m || m.role !== 'author') return false;
      const el0 = m.elements && m.elements[0];
      const a = String(el0?.textContent || '').toLowerCase().replace(/[.,:;]+$/, '').trim();
      if (a.split(/\s+/).length < 2) return false;
      return normClean === a || (normClean.length <= a.length + 3 && normClean.includes(a));
    });
    if (authorMatch) return null;

    // Priority 1: Canonical Academic Section Names (always level 1)
    if (this.FORCED_LEVEL1.has(normClean)) return 1;

    // Priority 2: Numerical/Alpha Hierarchical Numbering Ground Truth (1., 1.1, 1.1.1, A., A.1, I., I.1, [1], (A))
    const isNumbered = /^(?:\s*(?:section|chapter|appendix|part)\s+)?(?:\[|\()?((?:\d+|[ivxlcdm]+|[a-z])(?:\.(?:\d+|[ivxlcdm]+|[a-z]))*)(?:\]|\))?[.:\s)]/i.test(f.text);
    if (isNumbered) {
      const prefixMatch = f.text.match(/^(?:\s*(?:(?:section|chapter|appendix|part)\s+)?(?:\[|\()?((?:\d+|[ivxlcdm]+|[A-Za-z])(?:\.(?:\d+|[ivxlcdm]+|[A-Za-z]))*)(?:\]|\))?(?:\.?[.:\s)]+))/i);
      if (prefixMatch) {
        const cleanPrefix = prefixMatch[1];
        const parts = cleanPrefix.split('.');
        const level = Math.min(3, parts.length);
        
        // Safety guard for single-character prefixes (e.g., "A", "I", "V")
        if (parts.length === 1 && /^[a-z]$/i.test(cleanPrefix)) {
          const fullMatch = prefixMatch[0];
          const hasPunctuation = /[.:)]/.test(fullMatch);
          if (!hasPunctuation) {
            // Must satisfy strong standalone heading indicators
            const isHeadingLike = f.wordCount < 10 && (f.isBold || f.capRatio > 0.3);
            if (!isHeadingLike) return null;
          }
        }
        return level;
      }
    }

    // Priority 3: HTML Tag Name Fallback
    if (targetEl.tagName.toLowerCase().startsWith('h') && targetEl.tagName.toLowerCase().length > 1) {
      const parsed = parseInt(targetEl.tagName.toLowerCase().substring(1));
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 6) {
        return Math.min(3, parsed);
      }
    }

    // Priority 4: Stand-alone line heuristic: short, bold or high-cap, no trailing period
    const isStandalone = (f.wordCount < 12 && (f.isBold || f.capRatio > 0.4) && !f.text.includes(','));
    if (isStandalone) {
      return 2;
    }
    return null;
  }

  // ── CAPTION FINDER ───────────────────────────────────────────────────────────
  private static isTableCaptionProse(t: string): boolean {
    // A genuine table caption does not begin running prose.
    // "Table 1 summarizes the datasets used in our experiments..." is body text, not a caption.
    const remainder = t.replace(/^\s*(?:Table|Tab\b\.?)\s*[\d.\-:A-Za-z]*\s*[:.–\-\s]*/i, '').trim().slice(0, 60);
    return /\b(?:shows?|presents|illustrates|compares|depicts|displays|demonstrates|summarizes|lists|reports|plots|gives|provides|represents|outlines|describes|highlights|overviews|contains|yields|produces|indicates|details|tabulates)\b/i.test(remainder);
  }

  private static isFigureCaptionProse(t: string): boolean {
    // A genuine figure caption does not begin running prose — "Figure 2 shows
    // the performance comparison..." is a body sentence, not a caption. Without
    // this guard, normal paragraphs that merely START with a figure label are
    // consumed as captions and vanish from the document body.
    const remainder = t.replace(/^\s*(?:Figure|Fig\b\.?|Image|Chart|Diagram|Photo)\s*\d+(?:\.\d+)*\s*[.:.–\-\s]*/i, '').trim().slice(0, 60);
    return /\b(?:shows?|presents|illustrates|compares|depicts|displays|demonstrates|summarizes|lists|reports|plots|gives|provides|represents|outlines|describes|highlights|overviews|contains|yields|produces|indicates|details|tabulates|is|are|was|were|uses?|used|show)\b/i.test(remainder);
  }

  private static findCaption(
    el: Element,
    processed: Set<Element>,
    type: 'figure' | 'table',
    typePositions: Map<Element, number>
  ): string {
    // 1. Direct structured inner check (e.g. child <caption> tag generated by parser)
    if (type === 'table') {
      const internalCap = el.querySelector('caption');
      if (internalCap && !processed.has(internalCap)) {
        processed.add(internalCap);
        return this.cleanCaption(internalCap.textContent?.trim() || '');
      }
    }

    const rx =
      type === 'figure'
        ? /^\s*[\u200B\uFEFF\u00A0]*\s*(?:Figure|Fig\b\.?|Image|Chart|Diagram|Photo)\s*(\d+(?:\.\d+)*|[IVXLCDM]+)(?:\s*[.:.–\-])?/i
        : /^\s*[\u200B\uFEFF\u00A0]*\s*(?:Table|Tab\b\.?)\s*(\d+(?:\.\d+)*|[IVXLCDM]+)(?:\s*[.:.–\-])?/i;

    const captionOrdinal = (t: string): number | null => {
      const m = t.match(
        type === 'figure'
          ? /(?:Figure|Fig\.?|Image|Chart|Diagram|Photo)\s*(\d+(?:\.\d+)*|[IVXLCDM]+)/i
          : /(?:Table|Tab\.?)\s*(\d+(?:\.\d+)*|[IVXLCDM]+)/i
      );
      if (!m) return null;
      const s = m[1];
      if (/^\d/.test(s)) return parseInt(s.split('.')[0], 10);
      const roman: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
      let sum = 0;
      let prev = 0;
      for (const ch of s.toUpperCase().split('').reverse()) {
        const v = roman[ch] ?? 0;
        sum += v < prev ? -v : v;
        prev = v;
      }
      return sum > 0 ? sum : null;
    };

    const farSibling = (node: Element | null, dir: 1 | -1): Element | null => {
      let sib = dir === 1 ? node?.nextElementSibling || null : node?.previousElementSibling || null;
      while (sib) {
        const tag = sib.tagName.toLowerCase();
        const txt = (sib.textContent || '').trim();
        if (txt.length > 0 || ['table', 'img', 'figure'].includes(tag)) return sib;
        sib = dir === 1 ? sib.nextElementSibling || null : sib.previousElementSibling || null;
      }
      return null;
    };

    // Scan next and previous siblings up to 35 hops (mammoth can inject several empty paragraphs between img and caption)
    let next = el.nextElementSibling;
    let prev = el.previousElementSibling;
    for (let i = 0; i < 35; i++) {
      if (next && !processed.has(next)) {
        const t = next.textContent?.trim() || '';
        // Captions are single logical lines — multi-line element text (e.g. a whole table) is never a caption
        const isTableProse = type === 'table' && this.isTableCaptionProse(t);
        const isFigureProse = type === 'figure' && this.isFigureCaptionProse(t);
        if (rx.test(t) && !t.includes('\n') && !isTableProse && !isFigureProse) {
          // If this caption's label ordinal matches the media element that directly follows it,
          // the caption belongs to THAT media (above-caption convention), not the current one.
          const capOrdinal = captionOrdinal(t);
          const farEl = farSibling(next, 1);
          const farPos = farEl ? typePositions.get(farEl) : undefined;
          const belongsToFar = capOrdinal !== null && farPos !== undefined && capOrdinal === farPos;
          if (!belongsToFar) {
            processed.add(next);
            // Return full caption text — e.g. "Figure 1: Architecture of proposed framework"
            // Strip only leading whitespace/colon after the label prefix
            const prefixMatch = t.match(rx);
            const cleanPrefix = prefixMatch ? prefixMatch[0].replace(/[:.–\-\s]+$/, '').trim() : '';
            let afterPrefix = prefixMatch ? t.slice(prefixMatch[0].length).replace(/^[:.–\-\s]*/, '').trim() : '';
            
            // DUAL PARAGRAPH MERGE (FORWARD SENSE):
            if (afterPrefix.length < 5) {
              let nextSib = next.nextElementSibling;
              while (nextSib && !nextSib.textContent?.trim() && !['table', 'img', 'figure'].includes(nextSib.tagName.toLowerCase())) {
                nextSib = nextSib.nextElementSibling;
              }
              if (nextSib && !processed.has(nextSib) && ['p', 'div'].includes(nextSib.tagName.toLowerCase())) {
                const sibText = nextSib.textContent?.trim() || '';
                // The merged continuation must READ like a caption: short, no
                // running-prose verbs — otherwise a bare "Figure 1" would
                // swallow the entire following paragraph into the caption.
                if (sibText.length > 0 && sibText.length < 300 && !rx.test(sibText) && !/^(?:\d+[\.\s]+|[ivxlcdm]+[\.\s]+)+/i.test(sibText) && !this.FORCED_LEVEL1.has(sibText.toLowerCase()) && !this.isFigureCaptionProse(sibText) && sibText.split(/\s+/).length <= 20) {
                  processed.add(nextSib);
                  afterPrefix = sibText;
                }
              }
            }
            
            return this.cleanCaption(afterPrefix.length > 0 ? `${cleanPrefix}: ${afterPrefix}` : cleanPrefix);
          }
        }
        // Stop scanning forward if we hit a substantial text paragraph (not a caption, not empty, not sub-caption)
        if (next.tagName.toLowerCase() === 'p' || next.tagName.toLowerCase() === 'div') {
          const textVal = next.textContent?.trim() || '';
          if (textVal.length > 300 || (textVal.length > 150 && !rx.test(textVal) && !textVal.includes('   '))) {
            next = null;
          }
        }
        if (next && ['table'].includes(next.tagName.toLowerCase())) {
          next = null;
        }
      }
      
      if (prev && !processed.has(prev)) {
        const t = prev.textContent?.trim() || '';
        // Captions are single logical lines — multi-line element text (e.g. a whole table) is never a caption
        const isTableProse = type === 'table' && this.isTableCaptionProse(t);
        const isFigureProse = type === 'figure' && this.isFigureCaptionProse(t);
        if (rx.test(t) && !t.includes('\n') && !isTableProse && !isFigureProse) {
          // If this caption's label ordinal matches the media element that directly precedes it,
          // the caption belongs to THAT media (below-caption convention), not the current one.
          const capOrdinal = captionOrdinal(t);
          const farEl = farSibling(prev, -1);
          const farPos = farEl ? typePositions.get(farEl) : undefined;
          const belongsToFar = capOrdinal !== null && farPos !== undefined && capOrdinal === farPos;
          if (!belongsToFar) {
            processed.add(prev);
            const prefixMatch = t.match(rx);
            const cleanPrefix = prefixMatch ? prefixMatch[0].replace(/[:.–\-\s]+$/, '').trim() : '';
            let afterPrefix = prefixMatch ? t.slice(prefixMatch[0].length).replace(/^[:.–\-\s]*/, '').trim() : '';
            
            // DUAL PARAGRAPH MERGE (BACKWARD SENSE):
            if (afterPrefix.length < 5) {
              let descSib = prev.nextElementSibling;
              while (descSib && descSib !== el) {
                if (!processed.has(descSib) && ['p', 'div'].includes(descSib.tagName.toLowerCase())) {
                  const sibText = descSib.textContent?.trim() || '';
                  if (sibText.length > 0 && sibText.length < 300 && !rx.test(sibText) && !/^(?:\d+[\.\s]+|[ivxlcdm]+[\.\s]+)+/i.test(sibText) && !this.FORCED_LEVEL1.has(sibText.toLowerCase()) && !this.isFigureCaptionProse(sibText) && sibText.split(/\s+/).length <= 20) {
                    processed.add(descSib);
                    afterPrefix = sibText;
                    break;
                  }
                }
                descSib = descSib.nextElementSibling;
              }
            }
            
            return this.cleanCaption(afterPrefix.length > 0 ? `${cleanPrefix}: ${afterPrefix}` : cleanPrefix);
          }
        }
        // Stop scanning backward if we hit a substantial text paragraph
        if (prev.tagName.toLowerCase() === 'p' || prev.tagName.toLowerCase() === 'div') {
          const textVal = prev.textContent?.trim() || '';
          if (textVal.length > 300 || (textVal.length > 150 && !rx.test(textVal) && !textVal.includes('   '))) {
            prev = null;
          }
        }
        if (prev && ['table'].includes(prev.tagName.toLowerCase())) {
          prev = null;
        }
      }
      next = next?.nextElementSibling || null;
      prev = prev?.previousElementSibling || null;
    }
    return '';
  }

  private static cleanCaption(s: string): string {
    return s.replace(/&lt;[\s\S]*?&gt;/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private static tableHtmlDimensions(html: string): { rowCount: number; colCount: number } {
    let rowCount = 0;
    let colCount = 0;
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(html)) !== null) {
      rowCount++;
      const cellMatches = trMatch[1].match(/<t[dh][^>]*>/gi) || [];
      colCount = Math.max(colCount, cellMatches.length);
    }
    return { rowCount, colCount };
  }

  private static convertPlainTextTableToHtml(elements: Element[]): string {
    let html = '<table>';
    let rowIdx = 0;
    elements.forEach((el) => {
      const text = (el.textContent || '').trim();
      if (!text) return;

      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        let cells: string[] = [];
        if (line.includes('|')) {
          cells = line.split('|').map(c => c.trim());
          if (line.startsWith('|')) cells.shift();
          if (line.endsWith('|')) cells.pop();
        } else if (line.includes('\t')) {
          cells = line.split('\t').map(c => c.trim());
        } else {
          cells = line.split(',').map(c => c.trim());
        }

        const tag = rowIdx === 0 ? 'th' : 'td';
        html += '<tr>';
        for (const cell of cells) {
          html += `<${tag}>${cell}</${tag}>`;
        }
        html += '</tr>';
        rowIdx++;
      }
    });
    html += '</table>';
    return html;
  }

  private static detectTableCandidate(f: LineFeatures, el: Element): boolean {
    // If it matches equation, it cannot be a table candidate (prevents math symbol collisions)
    if (this.detectEquation(f)) return false;

    // Check if this is actually a sub-caption paragraph adjacent to a figure row
    let prevSib = el.previousElementSibling;
    while (prevSib && !prevSib.textContent?.trim() && !prevSib.querySelector('img') && !['table', 'img', 'figure'].includes(prevSib.tagName.toLowerCase())) {
      prevSib = prevSib.previousElementSibling;
    }
    if (prevSib) {
      const imgs = Array.from(prevSib.querySelectorAll('img'));
      if (imgs.length > 1) {
        const parts = f.text.split(/\s{2,}|\t+/).map((p: string) => p.trim()).filter(Boolean);
        const hasFigKeywords = /image|fig|original|normalized|sheared|zoomed|flipped|resized|matrix|confusion/i.test(f.text);
        if (parts.length === imgs.length || parts.length >= 2 || hasFigKeywords) {
          return false; // It's a sub-caption, not a table!
        }
      }
    }

    let nextSib = el.nextElementSibling;
    while (nextSib && !nextSib.textContent?.trim() && !nextSib.querySelector('img') && !['table', 'img', 'figure'].includes(nextSib.tagName.toLowerCase())) {
      nextSib = nextSib.nextElementSibling;
    }
    if (nextSib) {
      const imgs = Array.from(nextSib.querySelectorAll('img'));
      if (imgs.length > 1) {
        const parts = f.text.split(/\s{2,}|\t+/).map((p: string) => p.trim()).filter(Boolean);
        const hasFigKeywords = /image|fig|original|normalized|sheared|zoomed|flipped|resized|matrix|confusion/i.test(f.text);
        if (parts.length === imgs.length || parts.length >= 2 || hasFigKeywords) {
          return false; // It's a sub-caption, not a table!
        }
      }
    }

    if (f.text.length < 10 || f.text.length > 500) return false;
    const commaCount = (f.text.match(/,/g) || []).length;
    const tabCount = (f.text.match(/\t/g) || []).length;
    const pipeCount = (f.text.match(/\|/g) || []).length;
    
    const numericCharCount = (f.text.match(/\d/g) || []).length;
    const numericDensity = f.text.length > 0 ? numericCharCount / f.text.length : 0;
    
    if (f.stopwordDensity > 0.15) return false;

    if (f.text.match(/^(?:according|due|however|therefore|additionally|furthermore|consequently|although|whereas|specifically|in\s+addition|we\s+can|observe|note|notice)\b/i)) return false;

    // ── STRUCTURAL TABLE EVIDENCE (UNIVERSAL — no template/layout bias) ──
    // A genuine plain-text table must show consistent multi-column structure:
    //  - Multi-row: at least 2 rows carrying the same delimiter with a matching column count
    //  - Single row: at least 3 columns AND at least 2 numeric cells (data row, not a label/legend line)
    const lines = f.text.split('\n').map(l => l.trim()).filter(Boolean);
    const isMultiLine = lines.length >= 2;

    const splitCells = (line: string): string[] => {
      if (line.includes('\t')) return line.split(/\t/).map(c => c.trim()).filter(Boolean);
      if (line.includes('|')) return line.split('|').map(c => c.trim()).filter(Boolean);
      return line.split(',').map(c => c.trim()).filter(Boolean);
    };
    const numericCellCount = (cells: string[]) => cells.filter(c => /\d/.test(c)).length;

    if (tabCount >= 1 || pipeCount >= 2) {
      if (isMultiLine) {
        const rowCols = lines.map(l => splitCells(l).length).filter(n => n >= 2);
        if (rowCols.length >= 2 && Math.max(...rowCols) - Math.min(...rowCols) <= 1) return true;
      } else {
        const cells = splitCells(f.text);
        if (cells.length >= 3 && numericCellCount(cells) >= 2) return true;
      }
    }

    // Comma structure: statistical hint PLUS numeric evidence in multiple cells
    if (commaCount >= 3 && f.wordCount < 25 && f.stopwordDensity < 0.05 && numericDensity > 0.1) {
      const cells = f.text.split(',').map(c => c.trim()).filter(Boolean);
      if (numericCellCount(cells) >= 2) return true;
    }
    
    return false;
  }

  private static detectEquation(f: LineFeatures): boolean {
    if (f.tagName === 'table') return false;
    const text = f.text.trim();
    if (text.length === 0 || text.length > 300) return false;

    const cleanMath = text.replace(/MATHBLOCKX\d+XMARKER/gi, '')
                          .replace(/[0-9\s()\\[\]{}.,:;=+\-*\/^<>~≈≠≤≥_∑∫√²³α-ωΑ-Ωθλπμσδφψωηρ\u2212\u2013\u2014]/g, '')
                          .trim();
    if (cleanMath.length === 0 && text.includes('MATHBLOCKX')) return true;

    // Email addresses should never be classified as equations
    if (EMAIL_RE.test(text)) return false;

    // Reference lines: "[N] Author, Title, ..." — must NOT be classified as equations
    if (/^\s*\[\d+\]/.test(text) && text.length > 40) return false;
    if (/\b(?:et\s+al|vol\.|pp\.|doi:|proceedings|journal|conference)\b/i.test(text)) return false;

    // 1. Exclude lines that are clearly normal headings, captions, or list items
    if (/^(?:figure|fig\.|table|tab\.|algorithm|algo\.|section|chapter|appendix)/i.test(text)) return false;

    // Numbered headings with formula-like titles ("3.1 Loss = L1 + L2") are
    // headings, never equations — equations do not carry "X.Y" prefixes.
    if (/^(?:\s*(?:section|chapter|appendix|part)\s+)?\d+(?:\.\d+)*\s+[A-Z]/.test(text) && text.length < 120) return false;

    // Prose cross-references to numbered items ("Eq. (5)", "Figure 2", "see (3)")
    // are not equations themselves.
    if (/\b(?:eq|equation|fig|figure|sec|section|ref|shown|depicted|displayed|numbered|denoted|defined)\b[^.]*[\(\[]?\s*\d/i.test(text) && !text.includes('=')) return false;

    // Parenthesized years are never equations ("published in (2020)").
    if (/\(\s*(?:19|20)\d{2}\s*\)/.test(text)) return false;

    // Parameter lists like "n = 100, LR = 0.001, batch = 32" are prose, never
    // equations — reject the whole "WORD = value[, ...]" pattern up front.
    if (/^[A-Za-z][A-Za-z0-9_\s]*\s*=\s*[\d.,+\-eE%]+\s*(?:[,;]\s*[A-Za-z][A-Za-z0-9_\s]*\s*=\s*[\d.,+\-eE%]+\s*)*$/.test(text)) return false;
    
    // 2. Explicit Math Markers
    const isStandaloneMath = /^\s*(?:MATHBLOCKX\d+XMARKER\s*|(?:\(\d+(?:\.\d+)*\)|\[\d+(?:\.\d+)*\])\s*|[,.:;]\s*)+$/i.test(text);
    if (isStandaloneMath || text.includes('\\begin{equation}') || text.includes('\\begin{align}')) {
      return true;
    }

    // 3. Equation with trailing/leading equation number: e.g., "y = mx + c (1)" or "(1) y = mx + c"
    // Equation numbers use (N) format. Square brackets [N] are ambiguous (could be references).
    // Only treat [N] as equation number if the text has NO reference-like content.
    const hasParenEquationNum = /\(\d+(?:\.\d+)*\)\s*$/.test(text) || /^\s*\(\d+(?:\.\d+)*\)/.test(text);
    const hasBracketNum = /\[\d+(?:\.\d+)*\]\s*$/.test(text) || /^\s*\[\d+(?:\.\d+)*\]/.test(text);
    const isReferenceContent = /\b(?:et\s+al|vol\.|no\.|pp\.|doi:|issn|isbn|proceedings|journal|conference|trans\.|ieee|acm|springer|elsevier|wiley)\b/i.test(text) ||
                               /\b(?:19|20)\d{2}\b/.test(text); // Contains a year (1900-2099)
    const hasEquationNumber = hasParenEquationNum || (hasBracketNum && !isReferenceContent);

    // Prose guard FIRST: any sentence with ordinary English words is not an
    // equation, even when it ends with "(N)" ("The loss is computed as shown
    // in Eq. (5)", "Results are shown below (2)", "(5) The confusion matrix...").
    const stopCount = text.split(/\s+/).filter(w => DOMAIN_STOPWORDS.has(w.toLowerCase())).length;
    const stopwordDensity = f.wordCount > 0 ? stopCount / f.wordCount : 0;
    if (hasEquationNumber && stopwordDensity > 0.08 && !text.includes('\\text')) {
      return false;
    }

    // Math symbols: basic operators, Greek letters, summation, integration, brackets, relations
    const mathSymbolCount = (text.match(/[=+\-*/^\\∑∫√²³α-ωΑ-Ωθλπμσδφψωηρ<>~≈≠≤≥_()\[\]{}]/g) || []).length;
    const hasRelational = /[=<>\u2248\u2260\u2264\u2265]/.test(text); // =, <, >, ≈, ≠, ≤, ≥

    if (hasEquationNumber) {
      // The content before/after the "(N)" must actually look like math:
      // a real operator/relation (parens alone are NOT math) plus either a
      // second operator or digits. Bare "(5)" / "Figure (5)" prose fails.
      const eqBody = text
        .replace(/[\(\[]\s*\d+(?:\.\d+)*\s*[\)\]]\s*$/, '')
        .replace(/^\s*[\(\[]\s*\d+(?:\.\d+)*\s*[\)\]]\s*/, '')
        .trim();
      const realOps = (eqBody.match(/[=+\-*/^∑∫√²³<>~≈≠≤≥_α-ωΑ-Ω]/g) || []).length;
      if (realOps >= 2 || (realOps >= 1 && /\d/.test(eqBody))) {
        return true;
      }
      return false;
    }

    // 4. Density/Heuristic analysis for standalone equations without numbers
    // (stopCount/stopwordDensity were computed above for the numbered path)

    // An equation should have very low stopword density (usually 0, unless using \text{})
    if (stopwordDensity > 0.08 && !text.includes('\\text')) {
      return false;
    }

    const letters = (text.match(/[a-zA-Z]/g) || []).length;
    const letterDensity = text.length > 0 ? letters / text.length : 0;

    const mathSymbolDensity = f.wordCount > 0 ? mathSymbolCount / f.wordCount : 0;

    // Case A: Highly symbolic line (very high math symbol density, e.g. "x_i = y_i + z_i")
    if (mathSymbolCount >= 3 && mathSymbolDensity > 0.3 && f.wordCount < 20) {
      return true;
    }

    // Case B: Has relation and moderate math symbols (e.g. "a = b + c")
    if (hasRelational && mathSymbolCount >= 3 && f.wordCount < 25 && letterDensity < 0.8) {
      return true;
    }

    // Case C: Standard math functions / variables (e.g. "f(x) = sin(x)")
    const hasMathFunction = /\b(sin|cos|tan|log|ln|exp|lim|max|min|sqrt|sum|prod|div|grad|curl)\b/i.test(text);
    if (hasMathFunction && hasRelational && f.wordCount < 15) {
      return true;
    }

    // Case D: Pure math formatting with sub/superscripts (e.g. "x_2 + y^2 = 10")
    if (hasRelational && (text.includes('_') || text.includes('^')) && mathSymbolCount >= 2 && f.wordCount < 15) {
      return true;
    }

    // Case E: Simple standalone equations (e.g., "E = mc^2", "F = ma")
    // STRICT: reject parameter assignments like "n = 100", "LR = 0.001",
    // "accuracy = 99.94%", "batch size = 32" — these are NOT display equations.
    if (hasRelational && f.wordCount < 10 && stopwordDensity === 0 && letters > 0) {
      // Reject "WORD = number" or "WORD = number%" patterns (parameter assignments)
      const isParamAssign = /^[A-Za-z][A-Za-z0-9\s_]{0,30}\s*=\s*[\d.,+\-eE%]+\s*$/.test(text)
                         || /^[A-Z]{1,8}\s*=\s*[\d.,+\-eE%]+\s*$/.test(text);
      if (isParamAssign) return false;
      // Reject text labels with multiple long plain English words: e.g. "0 = illumination failure, 1 = illumination available"
      const longPlainWords = text.split(/\s+/).filter(w => {
        const clean = w.replace(/[^a-zA-Z]/g, '');
        return clean.length >= 5 && !/\b(sin|cos|tan|log|ln|exp|lim|max|min|sqrt|sum|prod|div|grad|curl)\b/i.test(clean);
      });
      if (longPlainWords.length <= 1) {
        // Must have at least one math characteristic beyond a simple '=' sign:
        // sub/superscript, multiple operators, or math functions
        const opCount = (text.match(/[+\-*/^]/g) || []).length;
        if (opCount >= 1 || text.includes('_') || text.includes('^') || mathSymbolCount >= 3) {
          return true;
        }
      }
    }

    return false;
  }

  public static extractKeywordsNLP(text: string): string[] {
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !DOMAIN_STOPWORDS.has(w));
    // Unigram frequency
    const freq: Record<string, number> = {};
    words.forEach(w => freq[w] = (freq[w] || 0) + 1);
    // Bigram extraction — multi-word technical terms score higher
    const bigrams: Record<string, number> = {};
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length > 3 && words[i+1].length > 3) {
        const bg = `${words[i]} ${words[i+1]}`;
        bigrams[bg] = (bigrams[bg] || 0) + 1;
      }
    }
    // Combine: bigrams with freq >= 2 rank highest
    const candidates: Array<[string, number]> = [
      ...Object.entries(bigrams).filter(([,f]) => f >= 2).map<[string,number]>(([k,f]) => [k, f * 2]),
      ...Object.entries(freq).filter(([,f]) => f >= 2),
    ];
    candidates.sort((a, b) => b[1] - a[1]);
    // Deduplicate: if bigram contains a unigram, prefer bigram
    const seen = new Set<string>();
    const result: string[] = [];
    for (const [kw] of candidates) {
      const parts = kw.split(' ');
      if (parts.some(p => seen.has(p))) continue;
      parts.forEach(p => seen.add(p));
      result.push(kw);
      if (result.length >= 8) break;
    }
    return result.slice(0, 6);
  }

  public static extractContributionNLP(text: string): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const contributionRegex = /\b(we propose|this paper proposes|in this (?:study|work|paper)|we present|our (?:key |main )?contribution|main contribution|this work introduces|this paper presents|we develop|we introduce|we design|we investigate|the (?:proposed|presented|developed)|our (?:approach|method|framework|system))\b/i;
    for (const s of sentences) {
      if (contributionRegex.test(s) && s.length > 30) return s.trim();
    }
    return '';
  }
}
