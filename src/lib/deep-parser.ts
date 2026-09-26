import { JSDOM } from 'jsdom';
import { countCitationsFromHtml, mergeCitations } from './citationCounting';
import { FORCED_LEVEL1_SECTIONS, isCanonicalL1Heading } from './academic-sections';

export interface AuthorInfo {
  name: string;
  affiliation?: string;
  email?: string;
  isCorresponding?: boolean;
  affiliationIds?: string[];
}

export type ComponentRole =
  | 'title' | 'author' | 'affiliation' | 'abstract' | 'keywords'
  | 'contribution' | 'organization' | 'frontmatter'
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
  tables?: Array<{ caption: string, id: string; rowCount?: number; colCount?: number }>;
  charts?: Array<{ caption: string, id: string }>;
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

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.(?:[a-z]{2,10}(?:\.[a-z]{2,10})*|[A-Z]{2,10}(?:\.[A-Z]{2,10})*)(?=[A-Z\s,;:/()<>\[\]{}]|$)/;
// Narrow AFFIL_KEYWORDS: remove generic words (research, systems, lab, group, etc.)
const AFFIL_KEYWORDS = /(?:^|\b|\d|_|\W)(?:department|dept|university|institute|college|school|center|centre|organization|institution|corporation|inc|co\.|ltd|association|academy|laboratory|lab|division|faculty|campus|polytechnic|univ|inst|state|national)\b/i;
const CHART_KEYWORD_RE = /\b(?:chart|plot|graph|histogram|heatmap|scatter\s*plot|bar\s*chart|box\s*plot|pie\s*chart|line\s*chart|roc\s*curve|precision-recall\s*curve|confusion\s*matrix|pareto)\b/i;
const normImgSrc = (s: string) => String(s || '').replace(/\\/g, '/').replace(/^.*[\/\\]/, '').toLowerCase();

// ── UNIVERSAL FRONT-MATTER / AUTHOR-LINE GUARD ───────────────────────────────
// Word/PDF author blocks are frequently styled as Heading paragraphs
// ("Dr. Mohammad Aadil Khan", "1. Dr. Md. Abdullah", "Deputy Librarian",
// "Maulana Azad National Urdu University", "adilkabir30@gmail.com"). Every
// heading-classification site MUST run the same probe so names/designations/
// affiliations/emails never become \section/\subsection. The probe strips
// leading numbering + trailing superscript affiliation digits (which defeated
// every ^-anchored regex before) before matching.
const DESIGNATION_RE = /^(?:dr\.|prof\.|professor|deputy librarian|assistant professor|associate professor|visiting professor|lecturer|senior lecturer|dean|principal|head of|head of department|researcher|research scholar|phd scholar|scholar|librarian|bibliographer|fellow|senior research fellow|technical assistant|mr\.|ms\.|mrs\.|md)\b/i;
const EMAIL_PREFIX_RE = /^(?:email|e-mail|mail|phone|tel|orcid|corresponding author)\b/i;
export const NON_AUTHOR_NAME_RE = /^(?:dataset|datasets|data|abstract|keywords?|index\s*terms?|introduction|methods?|methodology|experiments?|results?|table|tables|fig(?:ure)?|figures|overview|proposed|paper|study|author|authors|references?|acknowledg(?:e)?ments?|conclusion|conclusions|discussion)\b/i;

function stripFrontMatterPrefix(text: string): string {
  return text
    .replace(/^\s*(?:\[|\()?(?:\d+(?:st|nd|rd|th)?(?:\.\d+)*|[ivxlcdm]+|[A-Za-z])[\).:.\s-]+\s*/i, '')
    .replace(/[\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u2070*†‡\d]+$/g, '')
    .trim();
}

const CANONICAL_SECTION_WHITELIST = [
  'literature review',
  'literature survey',
  'review of literature',
  'survey of literature',
  'related work',
  'related works',
  'prior work',
  'prior works',
  'state of the art',
  'background',
  'introduction',
  'overview',
  'methodology',
  'methods',
  'materials and methods',
  'experimental design',
  'experimental setup',
  'experiments and results',
  'experiments',
  'results',
  'discussion',
  'results and discussion',
  'evaluation',
  'implementation',
  'system architecture',
  'system design',
  'proposed method',
  'proposed system',
  'proposed architecture',
  'conclusion',
  'conclusions',
  'conclusion and future work',
  'conclusions and future work',
  'future work',
  'future scope',
  'acknowledgments',
  'acknowledgements',
  'references',
  'bibliography'
];

function isFrontMatterNoise(text: string): boolean {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 2) return false;
  if (EMAIL_RE.test(t)) return true;
  const probe = stripFrontMatterPrefix(t);
  if (!probe) return true;

  // Canonical section whitelist: standard academic section titles must NEVER be classified as noise
  const lowerProbe = probe.toLowerCase();
  for (const canon of CANONICAL_SECTION_WHITELIST) {
    if (lowerProbe === canon || lowerProbe.startsWith(canon + ' ') || lowerProbe.startsWith(canon + ':') || lowerProbe.startsWith(canon + ' -') || lowerProbe.startsWith(canon + '–')) {
      return false;
    }
  }

  if ((DESIGNATION_RE.test(probe) || EMAIL_PREFIX_RE.test(probe)) && probe.length < 80 && probe.split(/\s+/).length < 10) return true;
  if (/\b(?:university|polytechnic|college|institute|department|faculty|school of|laboratory|centre for|center for|hospital|foundation|academy|campus)\b/i.test(probe) && probe.length < 140 && probe.split(/\s+/).length < 25) return true;
  if (/\b(?:librarian|professor|scholar|fellow|lecturer|assistant|associate|researcher)\b/i.test(probe) && probe.length < 80 && probe.split(/\s+/).length < 15) return true;
  // Publisher names / repository headers that appear as standalone noise
  if (/\b(?:mdpi|springer|elsevier|ieee|acm|wiley|plos|biorxiv|medrxiv|arxiv|nature\s+publishing\s+group|frontiers\s+in)\b/i.test(probe) && probe.length < 60) return true;
  // Figure/Table/Algorithm caption lines are captions, never sections.
  if (/^(?:figure|fig\.?|table|tab\.?|algorithm|alg\.?|chart|image|photo|diagram|graph)\s*(?:[\dIVXLCDM]+|\([a-zA-Z0-9]+\)|[:.\-–—])/i.test(probe) && probe.length < 120) return true;
  return false;
}

function isValidSectionPrefix(cleanPrefix: string, fullMatch: string): boolean {
  if (!cleanPrefix) return false;
  if (/^\d+(?:\.\d+)*$/.test(cleanPrefix)) return true;
  if (/^(?:[IVXLCDM]+)(?:\.(?:[IVXLCDM]+|\d+))*$/i.test(cleanPrefix)) return true;
  if (/^(?:section|chapter|appendix|part)\b/i.test(fullMatch.trim())) return true;
  if (/^[A-Z](?:\.\d+)*$/i.test(cleanPrefix) && /[.:)]/.test(fullMatch)) return true;
  return false;
}


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
  private static readonly FORCED_LEVEL1 = FORCED_LEVEL1_SECTIONS;

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
      (result as any).fullText = fullText;
      
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
                               (line.includes(',') || /\b(and|&)\b/i.test(line) || /^[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){1,3}[\d*†‡¹²³⁴⁵⁶⁷⁸⁹⁰]?$/.test(line)) &&
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
                  if (cleanName.length > 2 && !AFFIL_KEYWORDS.test(cleanName) && !NON_AUTHOR_NAME_RE.test(cleanName) && cleanName.split(' ').length <= 7) {
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
          if (/^(?:(?:\d+|[ivxlcdm]+)\.?\s*)?(?:references?|bibliography|works\s+cited|literature\s+cited|references\s*(?:and|&)\s*notes|reference\s+list)(?:\s*[:.\-–—]|\s*<[^>]*>)*$/i.test(line.trim()) && i > lines.length * 0.4) {
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
                  } else if (CHART_KEYWORD_RE.test(lowerLine)) {
                      result.body.push({ type: 'chart', caption: captionText, id: `pdf_chart_${i}.png` } as any);
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

            // Check if we're inside a table context: if the last emitted node is a table,
            // this equation-looking line is likely a table cell's content
            const lastBodyNode = result.body[result.body.length - 1];
            const isInsideTableContext = lastBodyNode && lastBodyNode.type === 'table';

            // Require AT LEAST TWO distinct math signals (or explicit equation number with relational operator)
            const signalCount = (hasGreek ? 1 : 0) + (hasMultiOps ? 1 : 0) + (hasMathFn ? 1 : 0) + (hasSubSuper ? 1 : 0) + (hasRelOp ? 1 : 0);
            const isRealEquation = !isParamAssign && !isProseHeavy && !isTableDataRow && !isInsideTableContext && (
              signalCount >= 2 || (hasEqNum && hasRelOp && opCount >= 1)
            );
            if (isRealEquation && clean.length < 140) {
              result.body.push({ type: 'equation', text: clean, latex: clean });
              continue;
            }
          }
          const cleanLine = line.trim();
          const isSection = sectionRx.test(cleanLine) && cleanLine.length < 120;
          
          // Universal dynamic hierarchical prefix scan: e.g. "1.", "1.1", "1.1.1", "A.1", "I.A.1", "Section 3:"
          const prefixMatch = cleanLine.match(/^(?:\s*(?:(?:section|chapter|appendix|part)\s+)?((?:\d+|[ivxlcdm]+|[A-Za-z])(?:\.(?:\d+|[ivxlcdm]+|[A-Za-z]))*)(?:\.?[.:\s)]+))/i);
          const isNumberedHeading = prefixMatch !== null && isValidSectionPrefix(prefixMatch[1], prefixMatch[0]) && cleanLine.length < 120 && !cleanLine.endsWith('.');
          // Support Title Case AND ALL CAPS headings (e.g. "RESULTS AND DISCUSSION", "EXPERIMENTAL SETUP")
          const isShortTitleCase = cleanLine.length < 80 && cleanLine.length > 3 && !cleanLine.endsWith('.') && !cleanLine.includes(',') && 
            // Must not be a single ALL-CAPS word under 6 chars (likely table header or acronym)
            !(cleanLine.split(' ').length === 1 && /^[A-Z]{1,6}$/.test(cleanLine)) &&
            // Must not be a numeric/metric value line
            !/^\d/.test(cleanLine) &&
            (cleanLine.split(' ').every(w => /^[A-Z]/.test(w) || STOPWORDS.has(w.toLowerCase())) ||
             (/^[A-Z0-9\s_\-&:\(\)]+$/.test(cleanLine) && cleanLine.split(' ').length <= 8 && cleanLine.split(' ').length >= 2));
          
          const isPdfAuthorAffil = isFrontMatterNoise(cleanLine);

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

              // Hierarchy state machine: allow explicit multi-part prefixes (e.g. 1.2 or 3.2.1)
              // to set level directly BEFORE the first-heading override.
              if (prefixMatch && prefixMatch[1].includes('.')) {
                  // Explicit dot count in prefix gives authoritative level (e.g. 1.2 -> 2, 1.2.3 -> 3)
                  level = Math.min(3, prefixMatch[1].split('.').length);
              } else if (lastPdfHeadingLevel === 0) {
                  level = 1;
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
        if (n.type === 'figure' || n.type === 'image') {
          return sum + (n.images ? n.images.length : 1);
        }
        return sum;
      }, 0);
      result.stats.chartCount = result.body.filter(n => n.type === 'chart').length;
      result.stats.equationCount = result.body.filter(n => n.type === 'equation').length;
      result.stats.pseudocodeCount = result.body.filter(n => n.type === 'algorithm').length;
      result.stats.referenceCount = result.references.length;

      DeepDocumentParser.syncDerivedCollections(result);

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

    // Universal email-author boundary disentanglement:
    // If an email address is glued to a capitalized author name (e.g. "...@domain.comMala Kalra"),
    // inject a <br /> between the email and the author name so soft-return splitting separates them.
    const normalizedHtml = cleanHtml.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:[a-z]{2,10}(?:\.[a-z]{2,10})*|[A-Z]{2,10}(?:\.[A-Z]{2,10})*))([A-Z][a-z]+)/g, '$1<br />$2');

    let dom: JSDOM; try { dom = new JSDOM(normalizedHtml); } catch { return result; }
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

    // Separate inline <img> elements out of prose <p> elements so images and prose are both preserved
    Array.from(doc.querySelectorAll('p, div')).forEach(el => {
      const imgs = Array.from(el.querySelectorAll('img'));
      if (imgs.length > 0 && el.tagName.toLowerCase() === 'p') {
        const textWithoutImgs = (el.textContent || '').replace(/CHARTIMGX\w+XEND/g, '').trim();
        const isCaption = /^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram)\s*[\d.]+/i.test(textWithoutImgs);
        if (!isCaption && textWithoutImgs.length >= 5) {
          const parent = el.parentNode;
          if (parent) {
            imgs.forEach(img => {
              parent.insertBefore(img, el.nextSibling);
            });
          }
        }
      }
    });

    // Phase 1: Character/Word Census
    const allText = (doc.body.textContent || '');
    result.stats.charCount = allText.replace(/\s/g, '').length;
    result.stats.wordCount = allText.split(/\s+/).filter((w: string) => /[a-z]/i.test(w) && w.length > 1).length;
    (result as any).fullText = allText;

    const allSignificantRaw = Array.from(doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, table, img, figure, ul, ol, pre, blockquote, div')) as Element[];
    // Fix Figure/Table/Image Duplication: Filter out elements that are nested inside semantic block elements
    const allSignificant = allSignificantRaw.filter(el => {
      const tag = el.tagName.toLowerCase();
      
      // Discard generic divs if they contain block-level children (keeps block children instead)
      if (tag === 'div') {
        const hasBlockChildren = el.querySelector('p, h1, h2, h3, h4, h5, h6, table, img, figure, ul, ol, pre, blockquote') !== null;
        if (hasBlockChildren) return false;
      }
      
      // For p elements containing an image: if p has NO separate prose text, discard p in favor of img
      if (tag === 'p' && el.querySelector('img') !== null) {
        const clone = el.cloneNode(true) as Element;
        Array.from(clone.querySelectorAll('img')).forEach(i => i.remove());
        const prose = (clone.textContent || '').replace(/CHARTIMGX\w+XEND/g, '').trim();
        const isCaption = /^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram)\s*[\d.]+/i.test(prose);
        if (!isCaption && prose.length < 5) {
          // Paragraph is just a wrapper for the image -> discard p so img itself is processed cleanly
          return false;
        }
      }

      let parent = el.parentElement;
      while (parent) {
        const parentTag = parent.tagName.toLowerCase();
        // UNIVERSAL FIX: Discard any descendant of <table> (unless it is a nested <table> itself).
        // A table element formats all its own rows and cells (td, th, p, strong, math, etc.).
        // Letting table cells leak into allSignificant causes table contents to be re-processed
        // as independent document headings, equations, and corrupts reference parsing.
        if (parentTag === 'table' && tag !== 'table') {
          return false;
        }
        if (['table', 'figure', 'ul', 'ol', 'pre', 'blockquote', 'p'].includes(parentTag)) {
          if (allSignificantRaw.includes(parent)) {
            // Check if parent p was kept - only discard child if parent p was kept with prose caption
            if (parentTag === 'p') {
              const clone = parent.cloneNode(true) as Element;
              Array.from(clone.querySelectorAll('img')).forEach(i => i.remove());
              const prose = (clone.textContent || '').replace(/CHARTIMGX\w+XEND/g, '').trim();
              const isCaption = /^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram)\s*[\d.]+/i.test(prose);
              if (isCaption || prose.length >= 5) return false; // parent p is kept with prose, discard child
            }
            // For non-'p' parents (table, figure, ul, ol, pre, blockquote): only discard if
            // the parent is a figure and the child is not a table that should be kept
            // Tables inside figure should still be kept, so we skip the discard for non-p parents
            // unless it's clearly a decorative figure wrapper
            else if (parentTag === 'figure' && tag !== 'table') {
              // Only discard non-table children of figure if figure was kept with content
              const figureContent = parent.textContent || '';
              if (figureContent.trim().length < 10) return false;
            }
            // For other parents (ul, ol, pre, blockquote): keep the child
          }
        }
        parent = parent.parentElement;
      }

      return true;
    });
    
    // Phase 2: Component Landmark Scan
    const manifest = this.Phase2_landmarkScan(allSignificant);

    // Phase 3 & 4: Deep Extraction & Order Preservation
    this.Phase4_deepExtract(manifest, result, mathBlocks, rawHtmlForCitations);

    // ── UNIVERSAL REFERENCE RESCUE PASS ────────────────────────────────────
    // If landmarkScan did not detect the reference section (e.g. non-standard heading markup,
    // table format, or styled paragraph), find any heading in result.body matching
    // References/Bibliography and rescue all trailing items into result.references.
    if (result.references.length === 0) {
      const isRefHeadingText = (t: string): boolean =>
        /^(?:(?:\d+|[ivxlcdm]+)\.?\s*)?(?:references?|bibliography|works\s+cited|literature\s+cited|references\s*(?:and|&)\s*notes|reference\s+list)(?:\s*[:.\-–—]|\s*<[^>]*>)*$/i.test(t.trim());
      
      const isPostRefText = (t: string): boolean =>
        /^(?:(?:\d+|[ivxlcdm]+)\.?\s*)?(?:acknowledgments?|declarations?|ethics\s+(?:approval|statement)|conflict\s+of\s+interest|competing\s+interests|funding|data\s+availability|authors?\s+contributions?|supplementary|appendix|appendices|supporting|biography|author\s+biography|about\s+the\s+author)\b/i.test(t.trim());

      const refHeadingIdx = result.body.findIndex(n => n.type === 'heading' && n.text && isRefHeadingText(n.text));
      if (refHeadingIdx !== -1) {
        const rescuedRaw: string[] = [];
        let postIdx = result.body.length;
        for (let j = refHeadingIdx + 1; j < result.body.length; j++) {
          const n = result.body[j];
          if (n.type === 'heading' && n.text && isPostRefText(n.text)) {
            postIdx = j;
            break;
          }
          if (n.type === 'paragraph' && n.text) {
            const lines = n.text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            rescuedRaw.push(...lines);
          } else if (n.type === 'list' && Array.isArray((n as any).items)) {
            rescuedRaw.push(...(n as any).items);
          }
        }

        rescuedRaw.forEach(refText => {
          const cleanText = refText.replace(/[\u00A0\u202F\u2009\u200B\uFEFF]/g, ' ').trim();
          if (cleanText.length < 5) return;
          if (isRefHeadingText(cleanText)) return;

          const isNew = DeepDocumentParser.isNewReferenceStart(cleanText, result.references.length === 0);
          if (isNew || result.references.length === 0) {
            result.references.push(cleanText);
          } else {
            result.references[result.references.length - 1] += " " + cleanText;
          }
        });

        // Remove the rescued reference nodes from body so they aren't rendered as standard body paragraphs
        if (result.references.length > 0) {
          result.body.splice(refHeadingIdx, postIdx - refHeadingIdx);
        }
      }
    }

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

    // Collect all image sources already inside existing figure-group nodes
    const groupedSrcs = new Set<string>();
    for (const node of result.body) {
      if (node.type === 'figure-group' && Array.isArray((node as any).images)) {
        for (const img of (node as any).images) {
          if (img.src) groupedSrcs.add(normImgSrc(img.src));
        }
      }
    }

    const flushPendingGroup = () => {
      if (pendingGroup.length === 0) return;
      if (pendingGroup.length === 1) {
        groupedBody.push(pendingGroup[0]);
      } else {
        // Determine overall main caption for the entire group:
        // Prefer the most descriptive, non-generic caption from the group
        let overallCaption = '';
        const realCaps = pendingGroup
          .map(n => n.caption?.trim() || '')
          .filter(c => c.length > 0 && !/^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram)\s*$/i.test(c));

        if (realCaps.length > 0) {
          const prefixed = realCaps.find(c => /^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram)\b/i.test(c) && c.length > 10);
          overallCaption = prefixed || realCaps.sort((a, b) => b.length - a.length)[0];
        } else {
          overallCaption = 'Figure';
        }

        // If overallCaption contains subfigure markers like (a), (b), extract per-image subcaptions
        let groupSubCaps: string[] = [];
        if (/\(\s*[a-z]\s*\)/i.test(overallCaption)) {
          const parts = overallCaption.split(/\s*(?:\(\s*[a-z]\s*\))\s*/gi).map(p => p.trim()).filter(Boolean);
          if (parts.length - 1 >= pendingGroup.length) {
            groupSubCaps = parts.slice(1);
          }
        }

        const images = pendingGroup.map((n, idx) => ({
          src: String(n.id || n.url || '').replace(/\\/g, '/'),
          caption: (n as any).subCaption || groupSubCaps[idx] || (n.caption !== overallCaption && !/^(?:Figure|Chart|Fig\b\.?)\s*$/i.test(n.caption || '') ? n.caption : '') || ''
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
      const isSubfigPara = node.type === 'paragraph' && (
        /^\s*(?:\([a-z0-9]\)\s*)+$/i.test(node.text || '') ||
        /^\s*(?:\([a-z0-9]\)[^()]{0,40}\s*){2,}$/i.test(node.text || '')
      );

      if (isImg) {
        const imgSrc = normImgSrc(node.id || (node as any).url || '');
        if (imgSrc && groupedSrcs.has(imgSrc)) {
          // Skip this node — it is already contained within an existing figure-group
          continue;
        }
        pendingGroup.push(node);
      } else if (isEmptyPara || isSubfigPara) {
        // Keep accumulating (skip empty paragraph or subfigure label lines)
      } else {
        flushPendingGroup();
        groupedBody.push(node);
      }
    }
    flushPendingGroup();
    result.body = groupedBody;

    // ── UNIVERSAL FIGURE RECONCILIATION PASS ────────────────────────────────
    // Guarantee that genuine content images present in the document HTML are represented
    // as figure/chart nodes in result.body without resurrecting decorative header/footer logos.
    try {
      const allImgElements = Array.from(doc.querySelectorAll('img')) as Element[];
      const allImageSrcs = new Set<string>();
      const imgAltMap = new Map<string, string>();
      const decorativeImages = ((result as any)._decorativeImages as Set<string>) || new Set<string>();
      const emittedImageSrcs = ((result as any)._emittedImageSrcs as Set<string>) || new Set<string>();
      for (const img of allImgElements) {
        const src = (img.getAttribute('src') || img.getAttribute('data-src') || '').trim();
        const alt = (img.getAttribute('alt') || img.getAttribute('title') || '').trim();
        const isDeco = decorativeImages.has(src.toLowerCase()) ||
          /logo|icon|banner|watermark|divider|spacer|signature|qrcode|header|footer|decoration|license|badge|cc[-_]by|creative\s*commons|copyright/i.test(src) ||
          /logo|icon|banner|watermark|divider|spacer|signature|qrcode|header|footer|decoration|license|badge|cc[-_]by|creative\s*commons|copyright/i.test(alt);
        if (src && !src.startsWith('data:') && !isDeco) {
          allImageSrcs.add(src);
          if (alt) imgAltMap.set(src, alt);
        }
      }

      const presentFigureIds = new Set<string>();
      const figSrcPrefixes = new Set<string>();
      const chartNumIds = new Set<string>();

      for (const n of result.body) {
        if (n.type === 'figure' || n.type === 'chart' || n.type === 'image') {
          if (n.id) {
            const normId = normImgSrc(n.id);
            presentFigureIds.add(normId);
            const prefix = normId.replace(/\.\w+$/, '');
            figSrcPrefixes.add(prefix);
            const cMatch = normId.match(/(?:chart_pending_|rf_chart_|chart_)(\d+)/i);
            if (cMatch) chartNumIds.add(cMatch[1]);
          }
        } else if (n.type === 'figure-group' && Array.isArray((n as any).images)) {
          if (n.id) {
            const normId = normImgSrc(n.id);
            presentFigureIds.add(normId);
            figSrcPrefixes.add(normId.replace(/\.\w+$/, ''));
          }
          for (const img of (n as any).images) {
            if (img.src) {
              const normId = normImgSrc(img.src);
              presentFigureIds.add(normId);
              figSrcPrefixes.add(normId.replace(/\.\w+$/, ''));
              const cMatch = normId.match(/(?:chart_pending_|rf_chart_|chart_)(\d+)/i);
              if (cMatch) chartNumIds.add(cMatch[1]);
            }
          }
        }
      }

      let autoFigIdx = 1;
      for (const src of allImageSrcs) {
        const normSrc = normImgSrc(src);
        const srcChartMatch = normSrc.match(/(?:chart_pending_|rf_chart_|chart_)(\d+)/i);
        const isChartNumberMatch = srcChartMatch && chartNumIds.has(srcChartMatch[1]);

        // Skip if already present in result.body (exact match, prefix match, global emitted set, or chart number)
        const isAlreadyPresent = presentFigureIds.has(normSrc) ||
          emittedImageSrcs.has(normSrc) ||
          isChartNumberMatch ||
          // Check prefix match for ID format mismatches (e.g., "rf_fig_1.png" vs "fig_1.png")
          [...figSrcPrefixes].some(prefix => prefix.length > 2 && (normSrc.startsWith(prefix) || normSrc.endsWith(prefix)));
        if (isAlreadyPresent || decorativeImages.has(normSrc)) continue;

        const alt = imgAltMap.get(src) || '';
        const isChart = /rf_chart_|chart_pending_|chart_/i.test(src) || CHART_KEYWORD_RE.test(src) || CHART_KEYWORD_RE.test(alt);
        result.body.push({
          type: isChart ? 'chart' : 'figure',
          id: src,
          caption: alt || (isChart ? `Chart ${autoFigIdx++}` : `Figure ${autoFigIdx++}`)
        } as any);
        presentFigureIds.add(normSrc);
        emittedImageSrcs.add(normSrc);
        if (srcChartMatch) chartNumIds.add(srcChartMatch[1]);
      }
    } catch (reconcileErr) {
      console.warn('[PARSER] Figure reconciliation pass skipped:', reconcileErr);
    }

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
      if (typeof overrides.tableCount === 'number' && overrides.tableCount > 0) {
        result.stats.tableCount = Math.max(result.stats.tableCount, overrides.tableCount);
      }
      if (typeof overrides.equationCount === 'number' && overrides.equationCount > 0) {
        result.stats.equationCount = Math.max(result.stats.equationCount, overrides.equationCount);
      }
      if (typeof overrides.chartCount === 'number' && overrides.chartCount > 0) {
        result.stats.chartCount = Math.max(result.stats.chartCount, overrides.chartCount);
        let cCount = result.body.filter(n => n.type === 'chart').length;
        if (overrides.chartCount > cCount) {
          for (const node of result.body) {
            if (cCount >= overrides.chartCount) break;
            if (node.type === 'figure' || node.type === 'image') {
              node.type = 'chart';
              cCount++;
            }
          }
        }
      }
      if (typeof overrides.imageCount === 'number' && overrides.imageCount > 0) {
        result.stats.imageCount = Math.max(result.stats.imageCount, overrides.imageCount);
      }
      // Re-synchronize imageCount & chartCount to guarantee 100% mutual consistency
      result.stats.chartCount = result.body.filter(n => n.type === 'chart').length;
      result.stats.imageCount = result.body.reduce((sum, n) => {
        if (n.type === 'figure-group') return sum + (n.images ? n.images.length : 0);
        if (n.type === 'figure' || n.type === 'image') return sum + (n.images ? n.images.length : 1);
        return sum;
      }, 0);
      if (typeof overrides.imageCount === 'number' && overrides.imageCount > 0) {
        result.stats.imageCount = Math.max(result.stats.imageCount, overrides.imageCount);
      }
    }

    DeepDocumentParser.syncDerivedCollections(result);

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
    const seenSectionTitles = new Set<string>();

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
              f.text.length < 100 && f.wordCount < 15 &&
              /^(?:\d+\.?\s*)?(?:acknowledgments?|declarations?|ethics\s+(?:approval|statement)|conflict\s+of\s+interest|competing\s+interests|funding|data\s+availability|authors?\s+contributions?|supplementary|appendix|appendices|supporting|biography|author\s+biography|about\s+the\s+author)\b/i.test(lower.trim());
          
          if (isPostRefHeader) {
              foundRefs = false;
          } else {
              if (f.text.length > 5) {
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
      const isLitReviewNotRef = /^(?:(?:\d+|[ivxlcdm]+)\.?\s*)?(?:literature\s+review|literature\s+survey|review\s+of\s+literature|survey\s+of\s+literature)\b/i.test(refHeaderText);
      const isRefGuideline = /\b(?:within|content|main|guideline|style|how to|instruction|write|cite|citation|guidance|prepare)\b/i.test(refHeaderText);
      const isInsideTable = tagName === 'table' || tagName === 'td' || tagName === 'th' || Boolean(el.closest && el.closest('table'));
      const isRefHeader = !isInsideTable && !isLitReviewNotRef && !isRefGuideline && (
        /^(?:(?:\d+|[ivxlcdm]+)\.?\s*)?(?:references?|bibliography|works\s+cited|literature\s+cited|references\s*(?:and|&)\s*notes|reference\s+list)(?:\s*[:.\-–—]|\s*<[^>]*>)*$/i.test(refHeaderText) ||
        ((tagName.startsWith('h') || el.querySelector('strong, b') !== null) && /^(?:(?:\d+|[ivxlcdm]+)\.?\s*)?(?:references?|bibliography|works\s+cited|literature\s+cited)\b/i.test(refHeaderText)) ||
        (refHeaderText.length < 60 && /^(?:[\dIVXLCDM\.\s]+)?(?:references?|bibliography|works\s+cited|literature\s+cited)(?:\s*(?:and|&|source|notes|material|cited|list|section|chapter)\b.*|[.:\s]*(?:[\d.]{1,4})?)$/i.test(refHeaderText))
      );
      if (isRefHeader && (i > elements.length * 0.1 || i >= 2)) {
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
      const hasAbstractLabel = lower === 'abstract' || /^abstract[\s:.\-_—–]/.test(lower) ||
        (el.querySelector('strong, b') !== null && /^(?:abstract|summary)[\s:.\-_—–]?/i.test((el.querySelector('strong, b')?.textContent || '').trim()));
      if (tagName !== 'table' && hasAbstractLabel) {
          nextRole = 'abstract';
          foundAbstract = true;
      } else if (tagName !== 'table' && (lower.includes('keyword') || lower.includes('index term'))) {
          nextRole = 'keywords';
      }
      else if (
          tagName !== 'table' && !Boolean(el.closest && el.closest('table, td, th')) && (
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
          const hasTableHeaders = /\b(?:parameter|value|description|method|type|name|property|metric|score|unit|variable|dataset|model|accuracy|result|feature|category|symbol|formula|expression|notation|definition|condition|constraint|equation|meaning|specification|label|column|row|item|measure|index|range|bound|step|operation|operator|function|criteria|factor|component|element|dimension|attribute|field|input|output|quantity|coefficient|constant|weight|threshold|limit|status)\b/i.test(firstRowText);
          
          // Count actual data columns: a real table has multiple columns with different content
          const firstRowCols = el.querySelector('tr')?.querySelectorAll('td, th')?.length || 0;
          const hasMultipleDataColumns = firstRowCols >= 2;

          // Only reclassify as equation if there's truly only 1 column and NO table headers
          const isSingleRowMath = rows.length === 1 && !hasTableHeaders && !hasMultipleDataColumns &&
            (hasMathBlock || (mathSymbolCount >= 3 && f.text.includes('=')));
          
          if (isSingleRowMath || (rows.length <= 2 && hasMathBlock && !hasTableHeaders && !hasMultipleDataColumns && firstRowCols <= 1)) {
              nextRole = 'equation';
          } else {
              let isTableAlgo = ALGO_LABEL_PATTERN.test(firstRowText);
              if (!isTableAlgo) {
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
          const looksLikeCaption = /^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram|Graph)\s*(?:(?:\(|\b)(?:[\dIVXLCDM]+(?:\.[\dIVXLCDM]+)*|[a-zA-Z])(?:\)|\b))?[:.\-–—\s]/i.test(cleanText);
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
      else if (
          tagName === 'p' &&
          /^(?:Fig(?:ure)?|Chart|Diagram|Photo|Image|Table|Tab\b\.?|Algorithm|Alg\.?|Graph)\.?\s*(?:(?:\(|\b)(?:[\dIVXLCDM]+(?:\.[\dIVXLCDM]+)*|[a-zA-Z])(?:\)|\b))?[:.\-–—\s]\s*\S/i.test(f.text.trim()) &&
          !DeepDocumentParser.isFigureCaptionProse(f.text.trim()) &&
          !DeepDocumentParser.isTableCaptionProse(f.text.trim()) &&
          f.wordCount < 60
      ) {
          nextRole = 'paragraph';
      }
      else if (ALGO_LABEL_PATTERN.test(f.text) && f.text.length < 150) {
          nextRole = 'algorithm';
      }
      else if (!f.text.includes('\t') && !f.text.includes('|') &&
        !(/^\s*(?:Fig(?:ure)?|Chart|Diagram|Photo|Image|Table|Tab\b\.?|Algorithm|Alg\.?|Graph)\.?\s*(?:(?:\(|\b)(?:[\dIVXLCDM]+(?:\.[\dIVXLCDM]+)*|[a-zA-Z])(?:\)|\b))?[:.\-–—\s]/i.test(f.text.trim()) && !DeepDocumentParser.isFigureCaptionProse(f.text.trim()) && !DeepDocumentParser.isTableCaptionProse(f.text.trim())) &&
        (tagName.startsWith('h') || this.detectHeading(el, f.text, manifest) !== null || (
          tagName === 'p' && f.wordCount <= 12 && f.wordCount >= 1 &&
          el.querySelector('strong, b') !== null && this.getStrongTextRatio(el) > 0.8 &&
          !f.text.endsWith('.') && !f.text.endsWith(':') && !f.text.endsWith(';') &&
          f.text.length < 120 && f.text.length > 2 &&
          !/^(?:step|case|example|note|input|output|recall|proof|remark|definition|where|phase|stage|condition|rule|theorem|lemma|proposition|corollary|epoch|acc|accuracy|sen|sensitivity|spec|specificity|prec|precision|rec|recall|f1|f-score|tp|tn|fp|fn|auc|iou|dice|loss|val_loss|val_acc|lr|batch|dataset|layer|optimizer|train|test|val|validation|metric|value|description|parameter|unit|score|std|mean|total)\b/i.test(f.text.trim()) &&
          !/^(?:Fig(?:ure)?|Table|Tab|Algorithm|Equation|Chart)\b/i.test(f.text.trim())
        ))) {
          const detectedLvl = this.detectHeading(el, f.text, manifest);
          const isNumberedHeading = /^(?:\s*(?:section|chapter|appendix|part)\s+)?(?:\[|\()?((?:\d+|[ivxlcdm]+|[a-z])(?:\.(?:\d+|[ivxlcdm]+|[a-z]))*)(?:\]|\))?[.:\s)]/i.test(f.text);
          const isStandardSectionName = /^(?:(?:\d+|[ivxlcdm]+)\.?\s*)?(?:introduction|related\s+work|related\s+works|literature\s+review|literature\s+survey|review\s+of\s+literature|survey\s+of\s+literature|background|methodology|methods|materials\s+and\s+methods|conclusion|conclusions|abstract|acknowledgments|acknowledgements|references|bibliography|overview|implementation|proposed|experimental|experiments|results|discussion|system)/i.test(f.text);
          const isCaptionText = /^\s*(?:Fig(?:ure)?|Chart|Diagram|Photo|Image|Table|Tab\b\.?|Algorithm|Alg\.?|Graph)\.?\s*(?:(?:\(|\b)(?:[\dIVXLCDM]+(?:\.[\dIVXLCDM]+)*|[a-zA-Z])(?:\)|\b))?[:.\-–—\s]/i.test(f.text.trim()) &&
            !DeepDocumentParser.isFigureCaptionProse(f.text.trim()) &&
            !DeepDocumentParser.isTableCaptionProse(f.text.trim());
          const isAuthorAffilText = !isStandardSectionName && (
            isFrontMatterNoise(f.text) ||
            /^(?:dr\.|prof\.|professor|mr\.|ms\.|mrs\.|md)\b/i.test(f.text.trim()) ||
            /\b(?:librarian|deputy librarian|assistant professor|associate professor|lecturer|department|dept|university|institute)\b/i.test(f.text)
          );
          const rawSecTitle = f.text.trim();
          const normSecTitle = rawSecTitle.toLowerCase().replace(/^(?:\s*(?:section|chapter|appendix|part)\s+)?(?:\[|\()?((?:\d+|[ivxlcdm]+|[a-z])(?:\.(?:\d+|[ivxlcdm]+|[a-z]))*)(?:\]|\))?[.:\s)]*/i, '').trim();
          const isDuplicateSection = seenSectionTitles.has(normSecTitle);
          const isListElement = ['ol', 'ul', 'li'].includes(tagName) || Boolean(el.closest && el.closest('ol, ul'));

          const checkHasPrecedingImage = (elem: Element | null): boolean => {
            if (!elem) return false;
            let prevSib = elem.previousElementSibling;
            while (prevSib && !prevSib.textContent?.trim() && !prevSib.querySelector('img') && !['img', 'figure', 'table'].includes(prevSib.tagName.toLowerCase())) {
              prevSib = prevSib.previousElementSibling;
            }
            if (!prevSib) {
              if (elem.parentElement && ['ol', 'ul', 'div'].includes(elem.parentElement.tagName.toLowerCase())) {
                return checkHasPrecedingImage(elem.parentElement);
              }
              return false;
            }
            const prevTag = prevSib.tagName.toLowerCase();
            return prevTag === 'img' || prevTag === 'figure' || Boolean(prevSib.querySelector('img'));
          };
          const isDirectlyBelowImage = checkHasPrecedingImage(el);

          const isTableMetricWord = /^(?:epoch|acc|accuracy|sen|sensitivity|spec|specificity|prec|precision|rec|recall|f1|f-score|tp|tn|fp|fn|auc|iou|dice|loss|val_loss|val_acc|lr|batch|dataset|layer|optimizer|train|test|val|validation|metric|value|description|parameter|unit|score|std|mean|total)$/i.test(f.text.trim());
          const isSectionHeading = !isCaptionText && !isAuthorAffilText && !isListElement && !isDirectlyBelowImage && !isDuplicateSection && !isTableMetricWord && (
            isNumberedHeading ||
            isStandardSectionName ||
            (foundAbstract && (detectedLvl !== null || tagName.startsWith('h'))) ||
            (tagName === 'p' && el.querySelector('strong, b') !== null && this.getStrongTextRatio(el) > 0.8 && (isNumberedHeading || isStandardSectionName || (foundAbstract && f.wordCount >= 2 && f.text.length >= 10)))
          );

          const isAlreadyTitleStarted = currentRole === 'title' || manifest.some(m => m.role === 'title');
          const looksLikeAuthor = ((f.wordCount >= 2 && f.wordCount <= 50 &&
            (f.text.includes(',') || f.text.includes(';') || /\b(and|&)\b/i.test(f.text) || /\d/.test(f.text) || /#/.test(f.text) ||
             /orcid/i.test(f.text) ||
             /^(?:dr\.|prof\.|professor|mr\.|ms\.|mrs\.|md)\s+[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){0,3}$/i.test(f.text) ||
             /^[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){1,3}$/.test(f.text)) &&
            (f.capRatio > 0.15 || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(f.text)) &&
            !AFFIL_KEYWORDS.test(f.text) &&
            !STOPWORDS.has(f.text.split(' ')[0].toLowerCase()) &&
            !/(?:←|:=|<-|Require:|Input:|Output:|Ensure:)/i.test(f.text) &&
            !/^(?:\d+:\s*\w)/.test(f.text)) ||
            (f.wordCount === 1 && /^[A-Z][a-z]{2,}$/.test(f.text.trim()) && isAlreadyTitleStarted));

          const isLocationAffil = isAlreadyTitleStarted && !foundAbstract &&
            (/(?:\b\d{5,6}\b|\b(?:India|USA|UK|China|Japan|Germany|France|Australia|Canada|Brazil|Korea|Italy|Spain|Netherlands|Switzerland|Singapore|Malaysia|Iran|Egypt|Pakistan|Indonesia|Thailand|Turkey|Russia|Mexico|Colombia|Nigeria|Kenya|Ethiopia|South\s+Africa)\b)/i.test(f.text) || /orcid/i.test(f.text)) &&
            f.wordCount < 15 && f.text.length < 200;
          const isAffilOrDesignation = EMAIL_RE.test(f.text) || AFFIL_KEYWORDS.test(f.text) || isLocationAffil ||
            /\b(?:librarian|professor|assistant|associate|lecturer|department|dept|polytechnic|university|institute|college|faculty)\b/i.test(f.text);
          const startsWithDrOrProf = /^(?:dr\.|prof\.|professor)\b/i.test(f.text.trim());

          if (isSectionHeading) {
              nextRole = 'section';
              if (normSecTitle.length > 2) seenSectionTitles.add(normSecTitle);
          } else if (!foundAbstract && f.text.length > 5 && f.text.length < 500
              && !/ieee|journal|transactions|vol\.|no\.|arxiv|preprint|copyright|issn/i.test(f.text)) {

              if ((isAffilOrDesignation || EMAIL_RE.test(f.text)) && isAlreadyTitleStarted) {
                  if (startsWithDrOrProf && !AFFIL_KEYWORDS.test(f.text)) {
                      nextRole = 'author';
                  } else {
                      nextRole = 'affiliation';
                  }
              } else if (looksLikeAuthor && isAlreadyTitleStarted) {
                  nextRole = 'author';
              } else if (!isAlreadyTitleStarted) {
                  if (isAffilOrDesignation || isLocationAffil) {
                      nextRole = 'affiliation';
                  } else {
                      nextRole = 'title';
                  }
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
                  } else if (isAffilOrDesignation || isLocationAffil) {
                      nextRole = 'affiliation';
                  } else {
                      nextRole = 'paragraph';
                  }
              }
          } else {
              if (isCaptionText) {
                  nextRole = 'paragraph';
              } else if (isAuthorAffilText || looksLikeAuthor) {
                  nextRole = 'author';
              } else if (isAffilOrDesignation || isLocationAffil) {
                  nextRole = 'affiliation';
              } else {
                  nextRole = 'paragraph';
              }
          }
      }
      else if (tagName === 'ul' || tagName === 'ol') {
          nextRole = 'list';
      }
      else if (!foundAbstract && f.text.length > 10 && f.text.length < 500
          && !/ieee|journal|transactions|vol\.|no\.|arxiv|preprint|copyright|issn/i.test(f.text)
          && !/^(?:introduction|related work|literature review|background|methodology|conclusion|abstract|acknowledgments|references|overview)/i.test(f.text)) {
          const isAlreadyTitleStarted = currentRole === 'title' || manifest.some(m => m.role === 'title');
          const looksLikeAuthor = ((f.wordCount >= 2 && f.wordCount <= 50 &&
            (f.text.includes(',') || f.text.includes(';') || /\b(and|&)\b/i.test(f.text) || /\d/.test(f.text) || /#/.test(f.text) ||
             /orcid/i.test(f.text) ||
             /^(?:dr\.|prof\.|professor|mr\.|ms\.|mrs\.|md)\s+[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){0,3}$/i.test(f.text) ||
             /^[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){1,3}$/.test(f.text)) &&
            (f.capRatio > 0.15 || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(f.text)) &&
            !AFFIL_KEYWORDS.test(f.text) &&
            !STOPWORDS.has(f.text.split(' ')[0].toLowerCase()) &&
            !/(?:←|:=|<-|Require:|Input:|Output:|Ensure:)/i.test(f.text) &&
            !/^(?:\d+:\s*\w)/.test(f.text)) ||
            (f.wordCount === 1 && /^[A-Z][a-z]{2,}$/.test(f.text.trim()) && isAlreadyTitleStarted));

          const isLocationAffil = isAlreadyTitleStarted && !foundAbstract &&
            (/(?:\b\d{5,6}\b|\b(?:India|USA|UK|China|Japan|Germany|France|Australia|Canada|Brazil|Korea|Italy|Spain|Netherlands|Switzerland|Singapore|Malaysia|Iran|Egypt|Pakistan|Indonesia|Thailand|Turkey|Russia|Mexico|Colombia|Nigeria|Kenya|Ethiopia|South\s+Africa)\b)/i.test(f.text) || /orcid/i.test(f.text)) &&
            f.wordCount < 15 && f.text.length < 200;
          const startsWithDrOrProf = /^(?:dr\.|prof\.|professor)\b/i.test(f.text.trim());

          if ((EMAIL_RE.test(f.text) || AFFIL_KEYWORDS.test(f.text) || isLocationAffil) && isAlreadyTitleStarted) {
              nextRole = 'affiliation';
          } else if ((startsWithDrOrProf || looksLikeAuthor) && isAlreadyTitleStarted) {
              nextRole = 'author';
          } else if (!isAlreadyTitleStarted) {
              if (EMAIL_RE.test(f.text) || AFFIL_KEYWORDS.test(f.text) || isLocationAffil) {
                  nextRole = 'affiliation';
              } else {
                  nextRole = 'title';
              }
          } else if (currentRole === 'title') {
              if (startsWithDrOrProf || looksLikeAuthor || EMAIL_RE.test(f.text) || AFFIL_KEYWORDS.test(f.text) || isLocationAffil || /#/.test(f.text) || f.text.includes(',') || f.text.match(/\d/)) {
                  if (startsWithDrOrProf || looksLikeAuthor) {
                      nextRole = 'author';
                  } else if (EMAIL_RE.test(f.text) || AFFIL_KEYWORDS.test(f.text) || isLocationAffil) {
                      nextRole = 'affiliation';
                  } else {
                      nextRole = 'author';
                  }
              } else if (f.text.length < 200 && f.wordCount < 25 && !foundAbstract && !/^(?:abstract|introduction|related work)/i.test(f.text)) {
                  nextRole = 'title';
              } else {
                  nextRole = 'paragraph';
              }
          } else {
              if (startsWithDrOrProf || looksLikeAuthor) {
                  nextRole = 'author';
              } else if (EMAIL_RE.test(f.text) || AFFIL_KEYWORDS.test(f.text) || isLocationAffil) {
                  nextRole = 'affiliation';
              } else {
                  nextRole = 'paragraph';
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
      if (nextRole === 'algorithm') {
          if (currentRole !== 'algorithm') {
            flush(i);
            currentRole = 'algorithm';
            currentStart = i;
            currentElements = [el];
          } else {
            currentElements.push(el);
          }
          continue;
      }

      if (nextRole === 'section' || nextRole === 'equation' || nextRole === 'table' || nextRole === 'figure') {
          if (nextRole === 'figure') {
            const lastManifest = manifest.length > 0 ? manifest[manifest.length - 1] : null;
            if (lastManifest && lastManifest.role === 'figure') {
              let hasInterveningCaptionOrHeading = false;
              for (let k = lastManifest.endIdx + 1; k < i; k++) {
                const midEl = elements[k];
                const midTag = midEl.tagName.toLowerCase();
                const midText = (midEl.textContent || '').trim();
                const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(midTag);
                const isFigCap = /^\s*[\u200B\uFEFF\u00A0]*\s*(?:Figure|Fig\b\.?|Image|Chart|Diagram|Photo|Graph)\.?\s*(?:(?:\(|\b)(?:\d+|[IVXLCDMivxlcdm]+|[a-zA-Z])(?:\)|\b))?(?:\s*[:.\-–—\s]|\s*$)\s*\S/i.test(midText);
                if (isHeading || (isFigCap && midText.length <= 400)) {
                  hasInterveningCaptionOrHeading = true;
                  break;
                }
              }
              if (!hasInterveningCaptionOrHeading) {
                flush(i);
                lastManifest.elements.push(el);
                lastManifest.endIdx = i;
                continue;
              }
            }
          }

          flush(i);
          if (nextRole === 'table') {
            if (!foundAbstract && i < 15) {
              const tblText = (el.textContent || '').toLowerCase();
              const hasAffil = AFFIL_KEYWORDS.test(tblText) || EMAIL_RE.test(tblText) || /author|affiliation|department|university|college|institute|faculty|polytechnic|orcid/i.test(tblText);
              if (hasAffil) {
                manifest.push({ role: 'author', startIdx: i, endIdx: i, elements: [el] });
                continue;
              }
            }
            const innerTables = Array.from(el.querySelectorAll('table'));
            if (innerTables.length > 1) {
              for (const tbl of innerTables) {
                manifest.push({ role: 'table', startIdx: i, endIdx: i, elements: [tbl] });
              }
              continue;
            }
          }
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

      const consumedCaptionTexts = new Set<string>();

      // Pre-pass: discover and consume all captions for tables and figures
      for (let i = 0; i < manifest.length; i++) {
          const entry = manifest[i];
          if (entry.role === 'table') {
              entry.caption = this.findCaption(entry.elements[0], consumedCaptions, 'table', tablePositions, consumedCaptionTexts);
              if (entry.caption) consumedCaptionTexts.add(entry.caption.trim());
          } else if (entry.role === 'figure') {
              const el0 = entry.elements[0];
              const textContent = el0.textContent || '';
              const chartMatch = textContent.match(/CHARTIMGX(chart_pending_\d+)XEND/);
              if (chartMatch) {
                  entry.caption = this.findCaption(el0, consumedCaptions, 'figure', figurePositions, consumedCaptionTexts);
                  if (entry.caption) consumedCaptionTexts.add(entry.caption.trim());
              } else {
                  const imgs: Element[] = Array.from(el0.querySelectorAll('img'));
                  if (imgs.length === 0 && el0.tagName.toLowerCase() === 'img') imgs.push(el0);
                  if (imgs.length > 0) {
                      entry.caption = this.findCaption(el0, consumedCaptions, 'figure', figurePositions, consumedCaptionTexts);
                      if (entry.caption) consumedCaptionTexts.add(entry.caption.trim());
                  }
              }
          }
      }

      const processedMathBlocks = new Set<number>();

      // Heading hierarchy state: the first heading in a document is a main
      // section (level 1) even if it carries a numbered "X.Y" prefix — a
      // "3.1" at document start is not a subsection of a phantom section.
      let lastHeadingLevel = 0;
      let hasSeenFirstSectionOrAbstract = false;
      let hasSeenReferences = false;

      const emittedImageSrcs = new Set<string>();
      (result as any)._emittedImageSrcs = emittedImageSrcs;

      for (let i = 0; i < manifest.length; i++) {
          const entry = manifest[i];
          
          // Filter out already consumed elements (like captions)
          entry.elements = entry.elements.filter((el: Element) => !consumedCaptions.has(el) && !Array.from(consumedCaptions).some(c => c === el || c.contains(el) || el.contains(c)));
          if (entry.elements.length === 0) continue;

          const text = entry.elements.map((e: Element) => e.textContent || '').join('\n').trim();
          if (!text && entry.role !== 'table' && entry.role !== 'figure') continue;

          // If this is a paragraph whose text was consumed as a caption, skip it
          if (entry.role === 'paragraph') {
            const cleanP = text.replace(/\s+/g, ' ').trim();
            if (consumedCaptionTexts.has(cleanP) || Array.from(consumedCaptionTexts).some(ct => ct && (cleanP === ct || (cleanP.startsWith(ct) && cleanP.length < ct.length + 20)))) {
              continue;
            }
          }

          if (entry.role === 'title') {
              result.title = text
                .replace(/\((?:\d+\s*pt|bold|italic|title\s*case|single\s*column|line\s*spacing)[^)]*\)/gi, '')
                .replace(/^[\s,;()\-–—]+|[\s,;()\-–—]+$/g, '')
                .trim();
          }
          else if (entry.role === 'abstract') {
              hasSeenFirstSectionOrAbstract = true;
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
              // Check if entry elements contain a table (front-matter author grid)
              const tableEl = entry.elements.find((e: any) => e.tagName?.toLowerCase() === 'table' || (e.querySelector && e.querySelector('table')));
              if (tableEl) {
                const targetTable = tableEl.tagName?.toLowerCase() === 'table' ? tableEl : tableEl.querySelector('table');
                const cells: Element[] = Array.from(targetTable.querySelectorAll('td, th'));
                for (const cell of cells) {
                  const cellText = (cell.textContent || '').trim();
                  if (cellText.length < 2) continue;
                  const lines = cellText.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
                  if (lines.length === 0) continue;
                  const firstLine = lines[0];
                  const cleanName = firstLine
                    .replace(/^[*\u2020\u2021\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u2070\s.:)\-]+/g, '')
                    .replace(/[\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u2070*†‡]/g, '')
                    .replace(/\((?:\d+\s*pt|bold|italic|title\s*case)[^)]*\)/gi, '')
                    .replace(/^[\s,;()\-–—]+|[\s,;()\-–—]+$/g, '')
                    .trim();
                  if (cleanName.length >= 2 && !AFFIL_KEYWORDS.test(cleanName) && !NON_AUTHOR_NAME_RE.test(cleanName) && cleanName.split(' ').length <= 7) {
                    const emails = cellText.match(EMAIL_RE) || [];
                    const affilLines = lines.slice(1).filter((l: string) => !EMAIL_RE.test(l));
                    const affilStr = affilLines.join(', ').replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').trim();
                    let aut = result.authors.find(a => a.name.toLowerCase() === cleanName.toLowerCase());
                    if (!aut) {
                      aut = {
                        name: cleanName,
                        affiliationIds: [],
                        affiliation: affilStr || undefined,
                        email: emails[0] || undefined
                      };
                      result.authors.push(aut);
                    } else {
                      if (affilStr && !aut.affiliation) aut.affiliation = affilStr;
                      if (emails[0] && !aut.email) aut.email = emails[0];
                    }
                    if (affilStr && affilStr.length > 3 && !result.organizations.includes(affilStr)) {
                      result.organizations.push(affilStr);
                    }
                  }
                }
              }

              let authorText = text;
              authorText = authorText
                .replace(/\((?:\d+\s*pt|bold|italic|title\s*case|single\s*column|line\s*spacing|affiliations?|institution)[^)]*\)/gi, '')
                .replace(/\b(?:bold|italic|title\s*case)\b/gi, '');
              if (result.title && result.title.length > 20 && authorText.startsWith(result.title)) {
                authorText = authorText.substring(result.title.length).replace(/^\s*[,;]?\s*/, '').trim();
              }

              const cleanAuthorNameAndMarker = (rawInput: string): { cleanName: string; affilId: string } => {
                const trailingMarkerMatch = rawInput.match(/(?:[\s,]+)?(?:\(\s*([1-9\d,\s*†‡]+)\s*\)|\[\s*([1-9\d,\s*†‡]+)\s*\]|([\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u2070*†‡]+)|(?:\b|\s)([1-9]\d*(?:\s*,\s*[1-9]\d*)*))\s*$/);
                let affilId = '';
                let rawClean = rawInput;
                if (trailingMarkerMatch) {
                  const rawIds = trailingMarkerMatch[1] || trailingMarkerMatch[2] || trailingMarkerMatch[3] || trailingMarkerMatch[4] || '';
                  affilId = rawIds.replace(/\u00b9/g, '1').replace(/\u00b2/g, '2').replace(/\u00b3/g, '3').replace(/[^0-9,]/g, '').trim();
                  rawClean = rawInput.substring(0, trailingMarkerMatch.index).trim();
                }
                const cleanName = rawClean
                  .replace(/^[*\u2020\u2021\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u2070\s.:)\-]+/g, '')
                  .replace(/[\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u2070*†‡]/g, '')
                  .replace(/\((?:\d+\s*pt|bold|italic|title\s*case)[^)]*\)/gi, '')
                  .replace(/^[\s,;()\-–—]+|[\s,;()\-–—]+$/g, '')
                  .trim();
                return { cleanName, affilId };
              };

              // Process lines / blocks without prematurely dropping subsequent authors
              const lines = authorText.split(/\r?\n|;/).map((s: string) => s.trim()).filter(Boolean);
              let lastAddedAut: any = null;

              for (const line of lines) {
                const affilIdx = line.search(AFFIL_KEYWORDS);
                const hasEmail = EMAIL_RE.test(line);

                if (affilIdx === 0 || (affilIdx > 0 && line.substring(0, affilIdx).trim().length === 0)) {
                  // Pure affiliation line
                  let cleanOrg = line.replace(EMAIL_RE, '').replace(/[*†‡¹²³⁴⁵⁶⁷⁸⁹⁰\d]/g, '').trim();
                  cleanOrg = cleanOrg.replace(/(?:corresponding\s+author\s*:\s*|corresponding\s+author\b)/gi, '')
                    .replace(/^[\s,;()\-–—]+|[\s,;()\-–—]+$/g, '').trim();
                  if (cleanOrg.length > 3 && !result.organizations.includes(cleanOrg)) {
                    result.organizations.push(cleanOrg);
                  }
                  if (lastAddedAut && !lastAddedAut.affiliation) {
                    lastAddedAut.affiliation = cleanOrg;
                  }
                  const emails = line.match(EMAIL_RE) || [];
                  if (emails.length > 0 && lastAddedAut && !lastAddedAut.email) {
                    lastAddedAut.email = emails[0];
                  }
                } else if (affilIdx > 0) {
                  // Combined "Name, Affiliation" line
                  const namePart = line.substring(0, affilIdx).replace(/[,;]+$/, '').trim();
                  const affilPart = line.substring(affilIdx).trim();
                  let cleanOrg = affilPart.replace(EMAIL_RE, '').replace(/[*†‡¹²³⁴⁵⁶⁷⁸⁹⁰\d]/g, '').trim();
                  cleanOrg = cleanOrg.replace(/(?:corresponding\s+author\s*:\s*|corresponding\s+author\b)/gi, '')
                    .replace(/^[\s,;()\-–—]+|[\s,;()\-–—]+$/g, '').trim();
                  if (cleanOrg.length > 3 && !result.organizations.includes(cleanOrg)) {
                    result.organizations.push(cleanOrg);
                  }
                  const emails = line.match(EMAIL_RE) || [];

                  const subNames = namePart.split(/[,&]|\s+and\s+/i).map((n: string) => n.trim()).filter((n: string) => n.length > 2);
                  for (const n of subNames) {
                    const { cleanName, affilId } = cleanAuthorNameAndMarker(n);
                    if (cleanName.length < 2 || AFFIL_KEYWORDS.test(cleanName) || NON_AUTHOR_NAME_RE.test(cleanName) || cleanName.split(' ').length > 7) continue;
                    let aut = result.authors.find(a => a.name.toLowerCase() === cleanName.toLowerCase());
                    if (!aut) {
                      aut = {
                        name: cleanName,
                        affiliationIds: affilId ? affilId.split(',').map(s => s.trim()).filter(Boolean) : [],
                        affiliation: cleanOrg || undefined,
                        email: emails[0] || undefined
                      };
                      result.authors.push(aut);
                    } else {
                      if (cleanOrg && !aut.affiliation) aut.affiliation = cleanOrg;
                      if (emails[0] && !aut.email) aut.email = emails[0];
                    }
                    lastAddedAut = aut;
                  }
                } else if (hasEmail) {
                  const emails = line.match(EMAIL_RE) || [];
                  if (lastAddedAut && emails[0] && !lastAddedAut.email) {
                    lastAddedAut.email = emails[0];
                  }
                  // Check if there is also an author name on this line after removing emails
                  let remaining = line;
                  for (const em of emails) {
                    remaining = remaining.replace(em, ' ');
                  }
                  remaining = remaining.replace(/^[\s,;()\-–—]+|[\s,;()\-–—]+$/g, '').trim();
                  if (remaining.length >= 3 && !AFFIL_KEYWORDS.test(remaining) && !NON_AUTHOR_NAME_RE.test(remaining) && remaining.split(' ').length <= 7) {
                    const subNames = remaining.split(/[,&]|\s+and\s+/i).map((n: string) => n.trim()).filter((n: string) => n.length > 2);
                    for (const n of subNames) {
                      const { cleanName, affilId } = cleanAuthorNameAndMarker(n);
                      if (cleanName.length < 2 || AFFIL_KEYWORDS.test(cleanName) || NON_AUTHOR_NAME_RE.test(cleanName) || cleanName.split(' ').length > 7) continue;
                      let aut = result.authors.find(a => a.name.toLowerCase() === cleanName.toLowerCase());
                      if (!aut) {
                        aut = {
                          name: cleanName,
                          affiliationIds: affilId ? affilId.split(',').map(s => s.trim()).filter(Boolean) : [],
                          affiliation: undefined,
                          email: undefined
                        };
                        result.authors.push(aut);
                      }
                      lastAddedAut = aut;
                    }
                  }
                } else {
                  // Name(s) line
                  const subNames = line.split(/[,&]|\s+and\s+/i).map((n: string) => n.trim()).filter((n: string) => n.length > 2);
                  for (const n of subNames) {
                    const { cleanName, affilId } = cleanAuthorNameAndMarker(n);
                    if (cleanName.length < 2 || AFFIL_KEYWORDS.test(cleanName) || NON_AUTHOR_NAME_RE.test(cleanName) || cleanName.split(' ').length > 7) continue;
                    let aut = result.authors.find(a => a.name.toLowerCase() === cleanName.toLowerCase());
                    if (!aut) {
                      aut = {
                        name: cleanName,
                        affiliationIds: affilId ? affilId.split(',').map(s => s.trim()).filter(Boolean) : []
                      };
                      result.authors.push(aut);
                    }
                    lastAddedAut = aut;
                  }
                }
              }
          }
          else if (entry.role === 'affiliation') {
              const emails = text.match(EMAIL_RE) || [];
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
              // Reject email-only noise entries that Word documents produce
              const isNoise = /^(?:email|emails|primary|secondary|contact|corresponding|author|tel|phone|fax|e-mail|e-mails|[:,\s\-()\[\]])*$/i.test(cleanOrg) ||
                              /^Email[:\s,]/i.test(text.trim()) ||
                              (emails.length > 0 && text.replace(EMAIL_RE, '').replace(/[,;:\s()/]/g, '').length < 8);
              if (cleanOrg && cleanOrg.length > 3 && !isNoise && !result.organizations.includes(cleanOrg)) {
                result.organizations.push(cleanOrg);
              }
              // Associate with the most recent author(s) that lack an affiliation
              if (result.authors.length > 0) {
                const unassigned = result.authors.filter(a => !a.affiliation);
                if (unassigned.length > 0) {
                  unassigned[unassigned.length - 1].affiliation = cleanOrg;
                  if (emails.length > 0 && !unassigned[unassigned.length - 1].email) {
                    unassigned[unassigned.length - 1].email = emails[0];
                  }
                } else if (emails.length > 0 && !result.authors[result.authors.length - 1].email) {
                  result.authors[result.authors.length - 1].email = emails[0];
                }
              }
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
                    // HEADING-LIKE MATH GUARD (same as the equation-role branch):
                    // Word wraps section headings in OMML display math — counting
                    // them as equations inflates the equation count (false positive).
                    const rawM = typeof mb === 'string' ? mb : (mb.latex || mb.tex || '');
                    const cleanM = rawM
                      .replace(/^\\begin\{equation\*?\}/, '').replace(/\\end\{equation\*?\}$/, '')
                      .replace(/\\(?:mathrm|text|mathbf|mathit|textrm)\s*\{([^}]*)\}/g, '$1')
                      .replace(/[{}^_]/g, ' ')
                      .replace(/\s+/g, ' ').trim();
                    const isHeadingLikeMath = cleanM.length > 4 && (
                      /^\d+(?:\.\d+)*[.\s:]+[A-Za-z]/.test(cleanM) ||
                      /^[A-Z][A-Za-z'\-]*(?:\s+[A-Za-z'\-]+){2,10}$/.test(cleanM)
                    ) && !/[=+<>\u2264\u2265\u2248\u2260\u2211\u222B]/.test(cleanM);
                    if (!isHeadingLikeMath) {
                      result.stats.equationCount++;
                    }
                  }
                }
              }

              if (entry.role === 'section') {
                  hasSeenFirstSectionOrAbstract = true;
                  // UNIVERSAL: Check for embedded heading flag set in Phase2
                  const embeddedHeading = entry.elements[0] && (entry.elements[0] as any).__embeddedHeading;
                  if (embeddedHeading) {
                    // GUARD: never emit an author/affiliation line as a subsection —
                    // "1.1 Dr. Mohammad Aadil Khan: Deputy Librarian, ..." is front
                    // matter metadata, not a numbered sub-heading.
                    if (isFrontMatterNoise(embeddedHeading) || /^[^:.]{1,12}$/.test(embeddedHeading)) {
                      const sepIdx = text.indexOf(embeddedHeading);
                      const afterHeading = sepIdx !== -1
                        ? text.substring(sepIdx + embeddedHeading.length).replace(/^\s*[:.]+\s*/, '').trim()
                        : '';
                      if (afterHeading && !isFrontMatterNoise(afterHeading)) {
                        result.body.push({ type: 'paragraph', text: afterHeading });
                      } else {
                        result.body.push({ type: 'paragraph', text, componentRole: 'frontmatter' });
                      }
                    } else {
                      // Check for duplicate heading before emitting embedded heading
                      const lastNode = result.body[result.body.length - 1];
                      let isDup = false;
                      if (lastNode && lastNode.type === 'heading') {
                        const normPrev = (lastNode.text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        const normCurr = embeddedHeading.toLowerCase().replace(/[^a-z0-9]/g, '');
                        if (normPrev && normCurr && (normPrev === normCurr || (normPrev.length > 5 && (normPrev.includes(normCurr) || normCurr.includes(normPrev))))) {
                          isDup = true;
                        }
                      }
                      if (!isDup) {
                        // Enforce hierarchy: level can be at most lastHeadingLevel + 1
                        let embLevel = 2;
                        if (lastHeadingLevel === 0) {
                          embLevel = 1;
                        } else if (embLevel > lastHeadingLevel + 1) {
                          embLevel = lastHeadingLevel + 1;
                        }
                        result.body.push({ type: 'heading', level: embLevel, text: embeddedHeading });
                        lastHeadingLevel = embLevel;
                      }
                      // Emit body text (everything after the colon) as a paragraph
                      const sepIdx = text.indexOf(embeddedHeading);
                      const afterHeading = sepIdx !== -1
                        ? text.substring(sepIdx + embeddedHeading.length).replace(/^\s*[:.]+\s*/, '').trim()
                        : '';
                      if (afterHeading.length > 0) {
                        result.body.push({ type: 'paragraph', text: afterHeading });
                      }
                    }
                  } else {
                    let cleanText = text.trim();
                    const isAuthorNameMatch = (result.authors || []).some((a: any) => {
                      const aname = String(a.name || '').toLowerCase().replace(/[^a-z]/g, '');
                      const cname = cleanText.toLowerCase().replace(/[^a-z]/g, '');
                      return aname.length > 4 && (cname === aname || (cname.includes(aname) && cname.length < aname.length + 5));
                    });
                    const isCanonicalSec = CANONICAL_SECTION_WHITELIST.some(c => {
                      const low = cleanText.toLowerCase();
                      return low === c || low.includes(c) || low.startsWith(c + ' ');
                    });
                    if (!isCanonicalSec && (isAuthorNameMatch || isFrontMatterNoise(cleanText) || (/^(?:dr\.|prof\.|professor|mr\.|ms\.|mrs\.|md)\b/i.test(cleanText) && cleanText.length < 80))) {
                      if (hasSeenFirstSectionOrAbstract && cleanText.length > 100) {
                        result.body.push({ type: 'paragraph', text: withCitations });
                      } else {
                        result.body.push({ type: 'paragraph', text: withCitations, componentRole: 'frontmatter' });
                      }
                      continue;
                    } else {
                      let level = this.detectHeading(entry.elements[0], text, manifest) || 2;
                      const numericPrefix = /^(?:\s*(?:section|chapter|appendix|part)\s+)?(?:\d+)(?:\.\d+)*\.?[.:\s)]+\s*/i;
                      const alphaRomanPrefix = /^(?:\s*(?:section|chapter|appendix|part)\s+)?(?:[a-zA-Z](?:\.\d+)+|[ivxlcdm]{2,}|[a-zA-Z]|[ivxlcdm])\.?[.:)]+\s+/i;
                      const prefixMatchText = cleanText.match(numericPrefix) ||
                          (alphaRomanPrefix.test(cleanText) ? cleanText.match(alphaRomanPrefix) : null);
                      if (prefixMatchText) {
                          const withoutNumber = cleanText.slice(prefixMatchText[0].length).trim();
                          const numPart = prefixMatchText[0].match(/\d+(?:\.\d+)*/)?.[0];
                          if (numPart) {
                              level = Math.min(3, numPart.split('.').length);
                          }
                          if (withoutNumber && withoutNumber.length > 2) {
                              cleanText = withoutNumber;
                          }
                      } else {
                          const normClean = cleanText.toLowerCase().replace(/^(?:\d+[.\s]+|[ivxlcdm]+[.\s]+|[a-z][.\s]+)+\s*/i, '').replace(/[.\s:]+$/, '').trim();
                          if (DeepDocumentParser.FORCED_LEVEL1.has(normClean)) {
                              level = 1;
                          }
                      }
                      // First heading in the document is always a main section
                      if (lastHeadingLevel === 0 && level > 1 && /^(?:1(?:\.0)?\b|introduction|background|overview)/i.test(cleanText)) {
                          level = 1;
                      }
                      // Enforce hierarchy: level can be at most lastHeadingLevel + 1
                      // (e.g., cannot jump from section to subsubsection without subsection)
                      if (lastHeadingLevel > 0 && level > lastHeadingLevel + 1) {
                          level = lastHeadingLevel + 1;
                      }
                      const finalHeadingText = cleanText || text;
                      const lastNode = result.body[result.body.length - 1];
                      if (lastNode && lastNode.type === 'heading') {
                        const normPrev = (lastNode.text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        const normCurr = finalHeadingText.toLowerCase().replace(/[^a-z0-9]/g, '');
                        if (normPrev && normCurr && (normPrev === normCurr || (normPrev.length > 5 && (normPrev.includes(normCurr) || normCurr.includes(normPrev))))) {
                          if (level < (lastNode.level || 99)) {
                            lastNode.level = level;
                          }
                          continue;
                        }
                      }
                      result.body.push({ type: 'heading', level, text: finalHeadingText });
                      lastHeadingLevel = level;
                    }
                  }
              } else {
                  const isNoise = !hasSeenFirstSectionOrAbstract &&
                    (isFrontMatterNoise(text) || (/^(?:dr\.|prof\.|professor|mr\.|ms\.|mrs\.|md)\b/i.test(text.trim()) && text.trim().length < 80) ||
                     (/\b(?:mdpi|springer|elsevier|ieee|acm|wiley)\b/i.test(text.trim()) && text.trim().length < 60));
                  if (isNoise) {
                    result.body.push({ type: 'paragraph', text: withCitations, componentRole: 'frontmatter' });
                  } else {
                    result.body.push({ type: 'paragraph', text: withCitations });
                  }
                  
                  // UNIVERSAL IMAGE RESCUE: If this paragraph contains any <img> elements
                  // (e.g. inline Mammoth output or prose followed by an image), emit each image
                  // as a figure node so it is preserved and referenced in the LaTeX code!
                  const chartNumIds = new Set<string>();
                  for (const id of emittedImageSrcs) {
                    const chartNum = id.match(/(?:chart_pending_|rf_chart_)(\d+)/i);
                    if (chartNum) chartNumIds.add(chartNum[1]);
                  }

                  for (const pEl of entry.elements) {
                    const childImgs = Array.from(pEl.querySelectorAll('img')) as Element[];
                    for (const img of childImgs) {
                      const src = (img.getAttribute('src') || img.getAttribute('data-src') || '').trim();
                      if (!src) continue;
                      const normSrc = normImgSrc(src);
                      if (emittedImageSrcs.has(normSrc)) continue; // Already emitted
                      // Check if this is a renamed version of an already-emitted chart
                      const srcChartNum = src.match(/(?:chart_pending_|rf_chart_)(\d+)/i);
                      if (srcChartNum && chartNumIds.has(srcChartNum[1])) continue;
                      const isDeco = /logo|icon|banner|watermark|divider|spacer|signature|qrcode/i.test(src);
                      if (isDeco) continue;
                      const altText = img.getAttribute('alt') || img.getAttribute('title') || '';
                      const isChart = /rf_chart_|chart_pending_|chart_/i.test(src) || CHART_KEYWORD_RE.test(src) || CHART_KEYWORD_RE.test(altText);
                      result.body.push({
                        type: isChart ? 'chart' : 'figure',
                        id: src,
                        caption: altText || (isChart ? 'Chart' : 'Figure'),
                      } as any);
                      emittedImageSrcs.add(normSrc);
                      if (srcChartNum) chartNumIds.add(srcChartNum[1]);
                    }
                  }
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

              // Scan preceding and succeeding siblings or previous body node for table caption
              const isTableCapText = (text: string) =>
                /^\s*(?:Table|Tab\b\.?)\s*(?:(?:\(|\b)(?:[\dIVXLCDM]+(?:\.[\dIVXLCDM]+)*|[a-zA-Z])(?:\)|\b))?(?:\s*[:.\-–—\s]|\s*$)\s*\S/i.test(text) &&
                !this.isTableCaptionProse(text);

              const tableBlock = (tableEl.parentElement && ['div', 'p', 'section'].includes(tableEl.parentElement.tagName.toLowerCase()))
                ? tableEl.parentElement
                : tableEl;

              if (!tableCaption) {
                let prevSib = tableEl.previousElementSibling || tableBlock.previousElementSibling;
                for (let h = 0; h < 6 && prevSib; h++, prevSib = prevSib.previousElementSibling) {
                  const pText = (prevSib.textContent || '').trim();
                  if (isTableCapText(pText)) {
                    tableCaption = pText;
                    consumedCaptions.add(prevSib);
                    break;
                  }
                }
              }

              if (!tableCaption && result.body.length > 0) {
                const lastNode = result.body[result.body.length - 1];
                if (lastNode && lastNode.type === 'paragraph' && isTableCapText(lastNode.text || '')) {
                  tableCaption = (lastNode.text || '').trim();
                  result.body.pop();
                }
              }

              if (!tableCaption) {
                let nextSib = tableEl.nextElementSibling || tableBlock.nextElementSibling;
                for (let h = 0; h < 6 && nextSib; h++, nextSib = nextSib.nextElementSibling) {
                  const nText = (nextSib.textContent || '').trim();
                  if (isTableCapText(nText)) {
                    tableCaption = nText;
                    consumedCaptions.add(nextSib);
                    break;
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
              let { rowCount, colCount } = this.tableHtmlDimensions(tableHtml);
              if ((rowCount === 0 || colCount === 0) && entry.elements.length > 0) {
                  const recoveredHtml = this.convertPlainTextTableToHtml(entry.elements);
                  const recoveredDims = this.tableHtmlDimensions(recoveredHtml);
                  if (recoveredDims.rowCount > 0 && recoveredDims.colCount > 0) {
                    tableHtml = recoveredHtml;
                    rowCount = recoveredDims.rowCount;
                    colCount = recoveredDims.colCount;
                  }
              }
              if (rowCount === 0 || colCount === 0) {
                  const fallbackText = entry.elements.map((e: Element) => e.textContent || '').join('\n').trim();
                  if (fallbackText) result.body.push({ type: 'paragraph', text: fallbackText });
                  continue;
              }

              if (!tableCaption) {
                tableCaption = `Table (${rowCount} rows × ${colCount} cols)`;
              }
              entry.caption = tableCaption;
              if (tableCaption && consumedCaptionTexts) consumedCaptionTexts.add(tableCaption.trim());
              
              result.body.push({ type: 'table', html: tableHtml, caption: tableCaption } as any);
          }
          else if (entry.role === 'figure') {
              const el0 = entry.elements[0];
              const textContent = el0.textContent || '';
              const chartMatch = textContent.match(/CHARTIMGX(chart_pending_\d+)XEND/);
              
                  if (chartMatch) {
                      const src = chartMatch[1] + '.png';
                      const normSrc = normImgSrc(src);
                      if (emittedImageSrcs.has(normSrc)) continue;
                      emittedImageSrcs.add(normSrc);
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
                      if (!figCaption) {
                          let sib = el0.previousElementSibling;
                          for (let h = 0; h < 5 && sib; h++, sib = sib.previousElementSibling) {
                              const t = sib.textContent?.trim() || '';
                              if (/^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram)\.?\s*[\d.]+/i.test(t) && !this.isFigureCaptionProse(t)) {
                                  figCaption = t;
                                  consumedCaptions.add(sib);
                                  break;
                              }
                          }
                      }
                      if (!figCaption && result.body.length > 0) {
                          const lastNode = result.body[result.body.length - 1];
                          if (lastNode && lastNode.type === 'paragraph' && /^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram)\.?\s*[\d.]+/i.test(lastNode.text || '') && !this.isFigureCaptionProse(lastNode.text || '')) {
                              figCaption = (lastNode.text || '').trim();
                              result.body.pop();
                          }
                      }
                  result.stats.chartCount++;
                  result.body.push({ type: 'chart', id: src, caption: figCaption || '' } as any);
                  continue;
              }

              const imgs: Element[] = [];
              for (const elItem of (entry.elements || [el0])) {
                if (elItem.tagName.toLowerCase() === 'img') {
                  imgs.push(elItem as Element);
                } else {
                  const subImgs = Array.from(elItem.querySelectorAll('img')) as Element[];
                  if (subImgs.length > 0) imgs.push(...subImgs);
                  else if (elItem.tagName.toLowerCase() === 'img') imgs.push(elItem as Element);
                }
              }

              // PAIR STANDALONE CAPTIONS: If el0 has no <img>, check adjacent sibling elements
              if (imgs.length === 0) {
                let sib = el0.previousElementSibling;
                for (let h = 0; h < 5 && sib && imgs.length === 0; h++, sib = sib.previousElementSibling) {
                  const sibImgs = Array.from(sib.querySelectorAll('img')) as Element[];
                  if (sibImgs.length > 0) imgs.push(...sibImgs);
                  else if (sib.tagName.toLowerCase() === 'img') imgs.push(sib);
                }
                if (imgs.length === 0) {
                  sib = el0.nextElementSibling;
                  for (let h = 0; h < 5 && sib && imgs.length === 0; h++, sib = sib.nextElementSibling) {
                    const sibImgs = Array.from(sib.querySelectorAll('img')) as Element[];
                    if (sibImgs.length > 0) imgs.push(...sibImgs);
                    else if (sib.tagName.toLowerCase() === 'img') imgs.push(sib);
                  }
                }
              }

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

              // Detect group-level caption for multi-image containers
              let groupCaption = entry.caption;
              const imgBlock = (el0.parentElement && ['p', 'div', 'span', 'figure'].includes(el0.parentElement.tagName.toLowerCase()))
                ? el0.parentElement
                : el0;
              const isFigCapText = (t: string) =>
                /^(?:Fig(?:ure)?|Image|Photo|Chart|Diagram|Graph)\.?\s*(?:(?:\(|\b)(?:[\dIVXLCDM]+(?:\.[\dIVXLCDM]+)*|[a-zA-Z])(?:\)|\b))?(?:\s*[:.\-–—\s]|\s*$)\s*\S/i.test(t) &&
                !this.isFigureCaptionProse(t);

              if (!groupCaption) {
                let sib = el0.nextElementSibling || imgBlock.nextElementSibling;
                for (let h = 0; h < 6 && sib; h++, sib = sib.nextElementSibling) {
                  const t = sib.textContent?.trim() || '';
                  if (isFigCapText(t)) {
                    groupCaption = t;
                    consumedCaptions.add(sib);
                    break;
                  }
                }
              }
              if (!groupCaption) {
                let sib = el0.previousElementSibling || imgBlock.previousElementSibling;
                for (let h = 0; h < 6 && sib; h++, sib = sib.previousElementSibling) {
                  const t = sib.textContent?.trim() || '';
                  if (isFigCapText(t)) {
                    groupCaption = t;
                    consumedCaptions.add(sib);
                    break;
                  }
                }
              }
              if (!groupCaption && result.body.length > 0) {
                const lastNode = result.body[result.body.length - 1];
                if (lastNode && lastNode.type === 'paragraph' && isFigCapText(lastNode.text || '')) {
                  groupCaption = (lastNode.text || '').trim();
                  result.body.pop();
                }
              }

              const validImgs: Array<{ src: string; caption: string; isChart: boolean }> = [];

              for (let idx = 0; idx < imgs.length; idx++) {
                const img = imgs[idx];
                const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
                if (!src) continue;
                const normSrc = normImgSrc(src);
                const alreadyInBody = emittedImageSrcs.has(normSrc) || result.body.some((n: any) =>
                  (n.type === 'figure' || n.type === 'chart' || n.type === 'image' || n.type === 'figure-group') &&
                  (normImgSrc(n.id) === normSrc ||
                   (n.images && n.images.some((im: any) => normImgSrc(im.src) === normSrc)))
                );
                if (alreadyInBody) continue;

                const rawAlt = (img.getAttribute('alt') || img.getAttribute('title') || '').trim();
                // Word DOCX documents typically do NOT include alt-text; lack of alt-text must NEVER classify an image as decorative!
                const isExplicitAltDeco = Boolean(rawAlt) && (
                  /logo|icon|header|banner|footer|decoration|watermark|bullet|spacer|signature|qrcode|license|badge|cc[-_]by|creative\s*commons/i.test(rawAlt) ||
                  this.isGenericAltText(rawAlt)
                );
                const isFrontMatterImage = !hasSeenFirstSectionOrAbstract;
                const isFooterImage = hasSeenReferences;
                const isBodyRegion = hasSeenFirstSectionOrAbstract && !hasSeenReferences;
                const isExplicitSrcDeco = !src.startsWith('data:') && /logo|icon|header|banner|bullet|background|watermark|divider|spacer|signature|qr|qrcode|footer|license|badge|cc[-_]by|creative\s*commons/i.test(src);
                const decoHint = isExplicitAltDeco || isExplicitSrcDeco || (!isBodyRegion && !groupCaption && (isFrontMatterImage || isFooterImage));
                if (decoHint) {
                  (result as any)._decorativeImages = (result as any)._decorativeImages || new Set<string>();
                  (result as any)._decorativeImages.add(src.toLowerCase());
                  continue;
                }

                let subCaption = '';
                if (subCaptions.length === imgs.length) {
                  subCaption = subCaptions[idx];
                } else if (!isExplicitAltDeco) {
                  subCaption = rawAlt;
                }

                let cleanSubCaption = subCaption.trim();
                let prevClean = '';
                while (prevClean !== cleanSubCaption) {
                  prevClean = cleanSubCaption;
                  cleanSubCaption = cleanSubCaption.replace(/^\s*(?:\(\s*[a-zA-Z0-9]\s*\)|\[\s*[a-zA-Z0-9]\s*\]|\b[a-zA-Z0-9]\s*\)|\b[a-zA-Z0-9]\s*\.)\s*[:.\-–—]?\s*/i, '').trim();
                }

                const isChart = /rf_chart_|chart_pending_|chart_/i.test(src) || CHART_KEYWORD_RE.test(src) || CHART_KEYWORD_RE.test(rawAlt) || CHART_KEYWORD_RE.test(cleanSubCaption);
                validImgs.push({ src, caption: cleanSubCaption, isChart });
              }

              if (validImgs.length > 1) {
                // Group multiple side-by-side images into a single figure-group node
                result.stats.imageCount += validImgs.length;
                const anyChart = validImgs.some(vi => vi.isChart);
                if (anyChart) {
                  result.stats.chartCount += validImgs.filter(vi => vi.isChart).length;
                }
                for (const vi of validImgs) {
                  emittedImageSrcs.add(normImgSrc(vi.src));
                }
                result.body.push({
                  type: 'figure-group',
                  id: validImgs[0].src,
                  caption: groupCaption || '',
                  images: validImgs.map(vi => ({ src: vi.src, caption: vi.caption }))
                } as any);
              } else if (validImgs.length === 1) {
                const single = validImgs[0];
                emittedImageSrcs.add(normImgSrc(single.src));
                const figCap = groupCaption || single.caption || (single.isChart ? 'Chart' : 'Figure');
                if (single.isChart) {
                  result.stats.chartCount++;
                  result.body.push({
                    type: 'chart',
                    id: single.src,
                    caption: figCap,
                    subCaption: single.caption
                  } as any);
                } else {
                  result.stats.imageCount++;
                  result.body.push({
                    type: 'figure',
                    id: single.src,
                    caption: figCap,
                    subCaption: single.caption
                  } as any);
                }
              }
          }
          else if (entry.role === 'equation') {
              const mmMatches = Array.from(text.matchAll(/MATHBLOCKX(\d+)XMARKER/gi));
              for (const mm of mmMatches as RegExpExecArray[]) {
                processedMathBlocks.add(parseInt(mm[1]));
              }
              // HEADING-LIKE MATH GUARD: Word sometimes wraps a section heading in an
              // OMML math element ("6. AI-Assisted Responsible Citation (ARC)
              // Framework"). Its MATHBLOCKX content reads as English prose, not math.
              // Emit it as a heading so it never becomes \begin{equation} in the PDF.
              const resolvedMathText = text.replace(/MATHBLOCKX(\d+)XMARKER/gi, (_m: string, idxStr: string) => {
                const mb = _mathBlocks[parseInt(idxStr)];
                if (!mb) return '';
                const raw = typeof mb === 'string' ? mb : (mb?.latex || mb?.tex || '');
                return raw
                  .replace(/^\\begin\{equation\*?\}/, '').replace(/\\end\{equation\*?\}$/, '')
                  .replace(/^\\begin\{align\*?\}/, '').replace(/\\end\{align\*?\}$/, '')
                  .replace(/^\$\$/, '').replace(/\$\$$/, '')
                  .replace(/^\$/, '').replace(/\$$/, '')
                  .replace(/\\(?:mathrm|text|mathbf|mathit|textrm)\s*\{([^}]*)\}/g, '$1')
                  .replace(/[{}^_]/g, ' ')
                  .trim();
              }).trim();
              const cleanResolved = resolvedMathText.replace(/\s+/g, ' ').trim();
              const looksLikeHeadingMath =
                cleanResolved.length > 4 && (
                  /^(?:\s*(?:section|chapter|appendix|part)\s+)?\d+(?:\.\d+)*[.\s:]+[A-Za-z]/.test(cleanResolved) ||
                  /^[A-Z][A-Za-z'\-]*(?:\s+[A-Za-z'\-]+){2,10}$/.test(cleanResolved) ||
                  /^(?:introduction|abstract|conclusion|references|acknowledg|discussion|bibliography|related work|methodology|literature review|future work|results|overview|background)\b/i.test(cleanResolved)
                ) &&
                !/[=+<>\u2264\u2265\u2248\u2260\u2211\u222B]/.test(cleanResolved);
              if (looksLikeHeadingMath) {
                result.body.push({ type: 'heading', level: 1, text: cleanResolved });
              } else {
                let formula = text;
                let prevFormula = '';
                while (formula.includes('MATHBLOCKX') && formula !== prevFormula) {
                  prevFormula = formula;
                  formula = formula.replace(/MATHBLOCKX(\d+)XMARKER/gi, (_m: string, idxStr: string) => {
                    const mb = _mathBlocks[parseInt(idxStr)];
                    if (!mb) return '';
                    const raw = typeof mb === 'string' ? mb : (mb?.latex || mb?.tex || '');
                    return raw || '';
                  });
                }
                result.body.push({ type: 'equation', text: formula, latex: formula });
              }
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
                      if (consumedCaptions.has(listEl) || Array.from(consumedCaptions).some(c => c === listEl || c.contains(listEl) || listEl.contains(c))) continue;
                      const tag = listEl.tagName.toLowerCase();
                      if (tag === 'ul' || tag === 'ol') {
                          const lis = Array.from<Element>(listEl.querySelectorAll('li')).filter(li => !consumedCaptions.has(li));
                          items.push(...lis.map((li) => li.textContent?.trim() || '').filter(Boolean));
                      } else {
                          const t = listEl.textContent?.trim() || '';
                          if (t) items.push(t);
                      }
                  }
              // Filter out items that match consumed captions
              const validItems = items.filter(it => {
                const clean = it.replace(/\s+/g, ' ').trim();
                return clean.length > 0 && !consumedCaptionTexts.has(clean) &&
                  !Array.from(consumedCaptionTexts).some(ct => ct && (clean === ct || (clean.startsWith(ct) && clean.length < ct.length + 20)));
              });
              if (validItems.length === 1) {
                const single = validItems[0];
                const isCaptionLike = /^(?:Figure|Fig\b|Table|Tab\b|Chart|Graph|Plot|Diagram|Performance of|Graphical Representation|Comparison of)\b/i.test(single) ||
                  (single.length < 80 && !single.endsWith('.') && !single.includes(','));
                if (isCaptionLike) {
                  if (!consumedCaptionTexts.has(single)) {
                    result.body.push({ type: 'paragraph', text: single });
                  }
                  continue;
                }
              }
              if (validItems.length > 0) {
                result.body.push({ type: 'list', items: validItems, listType: 'itemize' });
              }
          }
          else if (entry.role === 'reference') {
              hasSeenReferences = true;
              const rawItems: string[] = [];
              entry.elements.forEach((el: Element) => {
                  const tag = el.tagName.toLowerCase();
                  if (tag === 'ul' || tag === 'ol') {
                      const lis = Array.from(el.querySelectorAll('li')).map(li => (li.textContent || '').trim()).filter(t => t.length > 5);
                      rawItems.push(...lis);
                  } else if (tag === 'table') {
                      const rows = Array.from(el.querySelectorAll('tr')).map(tr => (tr.textContent || '').trim()).filter(t => t.length > 5);
                      rawItems.push(...rows);
                  } else {
                      const htmlWithBr = el.innerHTML.replace(/<br\s*\/?>/gi, '\n');
                      const text = el.textContent || '';
                      if (htmlWithBr.includes('\n')) {
                        const lines = htmlWithBr.replace(/<[^>]*>/g, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                        rawItems.push(...lines);
                      } else if (text.trim().length > 5) {
                        rawItems.push(text.trim());
                      }
                  }
              });

              rawItems.forEach((refText) => {
                  const cleanText = refText.replace(/[\u00A0\u202F\u2009\u200B\uFEFF]/g, ' ').trim();
                  if (cleanText.length < 5) return;
                  if (/^(?:[\dIVX\.\s]+)?(?:references?|bibliography|works cited|literature cited)\s*[:.\-–—]?$/i.test(cleanText)) return;

                  // Universal guideline/instructional noise filter
                  const isGuidelineNoise = /^(?:references\s+within\s+main\s+content|references\s+in\s+the\s+reference\s+list|example\s+of\s+list\s+of\s+references|guidelines?|instructions?|notes?|format|how\s+to\s+cite|citation\s+format|sample\s+references)/i.test(cleanText) ||
                    /^(?:•|·|\*|\-)\s+(?:enclose|where\s+appropriate|the\s+reference|multiple\s+reference|when\s+referring|do\s+not|if\s+there|reference'\s+details|use\s+|there\s+must|if\s+website|separate\s+each|research\s+papers|titles\s+of|any\s+of|please\s+follow)/i.test(cleanText);
                  if (isGuidelineNoise) return;

                  const isNumberedRef = /^(?:\[\s*\d+\s*\]|\d+[\.\)\:\-\t\s]+|\(\s*\d+\s*\)|\[[\w\-]+\])\s*\S/.test(cleanText);
                  const isAuthorRef = DeepDocumentParser.isNewReferenceStart(cleanText, false);

                  // Reject table artifact items: short text without any bibliographic cues
                  const textWithoutMarker = cleanText.replace(/^(?:\[\s*\d+\s*\]|\d+[\.\)\:\-\t\s]+|\(\s*\d+\s*\)|\[[\w\-]+\])\s*/, '').trim();
                  const isTableArtifact = textWithoutMarker.length < 28 && !/\b(?:19|20)\d{2}\b|et\s+al|proceedings|journal|conference|doi|http|vol\.|pp\./i.test(cleanText);

                  if ((isNumberedRef || isAuthorRef) && !isTableArtifact) {
                      result.references.push(cleanText);
                  } else if (result.references.length > 0 && !isTableArtifact) {
                      result.references[result.references.length - 1] += " " + cleanText;
                  }
              });
          }
      }
      result.abstract = result.abstract.replace(/^[\s:.\-–—−\u2013\u2014]+/, '').trim();
      result.keywords = result.keywords.map(k => k.replace(/^[\s:.\-–—−\u2013\u2014]+/, '').trim()).filter(Boolean);

      // Post-pass cleanup: remove any paragraphs from result.body that duplicate consumed captions
      if (consumedCaptionTexts.size > 0) {
        result.body = result.body.filter(node => {
          if (node.type !== 'paragraph' || !node.text) return true;
          const pText = node.text.trim();
          if (consumedCaptionTexts.has(pText)) return false;
          for (const ct of consumedCaptionTexts) {
            if (ct && (pText === ct || (pText.startsWith(ct) && pText.length < ct.length + 20))) return false;
          }
          return true;
        });
      }
  }

  private static isNewReferenceStart(line: string, isFirst: boolean): boolean {
    const trimmed = line.trim();
    if (trimmed.length < 5) return false;
    const textWithoutNum = trimmed.replace(/^(?:\[\s*\d+\s*\]|\d+[\.\)\:\-\t\s]+|\(\s*\d+\s*\)|\[[\w\-]+\])\s*/, '').trim();
    if (textWithoutNum.length < 20 && !/\b(?:19|20)\d{2}\b|et\s+al|proceedings|journal|conference|doi|http|vol\.|pp\./i.test(trimmed)) {
      return false;
    }
    if (isFirst) return true;

    // 1. Matches numeric prefix: [1], 1., 1), (1), [12], 12., 12), [Smith2020], [SMI20]
    if (/^(?:\[\s*\d+\s*\]|\d+[\.\)\:\-\t\s]+|\(\s*\d+\s*\)|\[[\w\-]+\])\s*\S/.test(trimmed)) {
      return true;
    }

    // 2. Reject obvious continuation lines:
    if (/^[a-z]/.test(trimmed)) return false;
    if (/^(?:vol|volume|no|number|pp|pages|page|issue|doi|https?|url|www|isbn|issn|in|and|of|for|with|by|at|on|from|to|the|a|an)\b/i.test(trimmed)) return false;
    if (/^[&,.;\-:\/“"'\(\)\[\]]/.test(trimmed)) return false;

    // 3. Author name start patterns:
    // - "LastName, F." / "LastName, First"
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,30},\s+[A-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) return true;
    // - "LastName F." / "LastName F.M."
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,30}\s+[A-Z\u00C0-\u024F\u1E00-\u1EFF](?:\.[A-Z\u00C0-\u024F\u1E00-\u1EFF])*\.?\s*(?:,|\s|$)/.test(trimmed)) return true;
    // - "LastName et al."
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,30}\s+et\s+al\b/i.test(trimmed)) return true;
    // - "FirstName LastName" / "F. LastName" / "F. M. LastName"
    if (/^(?:[A-Z\u00C0-\u024F\u1E00-\u1EFF]\.?\s+){1,2}[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,30}\s*(?:,|\s|$)/.test(trimmed)) return true;
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF][a-z\u00C0-\u024F\u1E00-\u1EFF]+\s+(?:[A-Z\u00C0-\u024F\u1E00-\u1EFF]\.?\s+)?[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,30}\s*(?:,|\s|$)/.test(trimmed)) return true;
    // - "Author (Year)" or "Author, Author (Year)"
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF\-']{1,30}.*?\b(19|20)\d{2}\b/.test(trimmed.substring(0, 100))) return true;

    // 4. Any line starting with a capital letter that contains a year (19xx or 20xx) or quotation marks
    if (/^[A-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed) && (/\b(19|20)\d{2}\b/.test(trimmed) || /[“”"'\`‘]/.test(trimmed))) {
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
      const isProseLead = /^(?:step|case|example|note|input|output|recall|proof|remark|given|definition|phase|stage|condition|rule|law|theorem|lemma|proposition|corollary|where|and|or|if|then|else|question|hypothesis|such as|for example|as follows|method|algorithm|table|figure|fig)\b/i.test(cleanText);
      const isBoldOrHeading = el.tagName.toLowerCase().startsWith('h') || el.querySelector('b, strong') !== null || /bold|heading|title/i.test(el.getAttribute('class') || '') || /bold/i.test(el.getAttribute('style') || '');
      if (isCapitalized && !isStopWord && !isProseLead && isBoldOrHeading && wordsCount >= 1 && wordsCount <= 5) {
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
          if (matchesNumbered) {
            const prefixMatch = liText.match(/^(?:\s*(?:(?:section|chapter|appendix|part)\s+)?(?:\[|\()?((?:\d+|[ivxlcdm]+|[A-Za-z])(?:\.(?:\d+|[ivxlcdm]+|[A-Za-z]))*)(?:\]|\))?(?:\.?[.:\s)]+))/i);
            if (prefixMatch && isValidSectionPrefix(prefixMatch[1], prefixMatch[0])) {
              const cleanPrefix = prefixMatch[1];
              const parts = cleanPrefix.split('.');
              return Math.min(3, parts.length);
            }
          }
          if (matchesCanonical) {
            return 1;
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
    // Uses the shared UNIVERSAL isFrontMatterNoise probe: strips leading numbering
    // and trailing superscript affiliation digits so "1. Dr. Mohammad Aadil Khan",
    // "Deputy Librarian", "Maulana Azad National Urdu University" can never be
    // classified as headings.
    const isAuthorAffilText = isFrontMatterNoise(f.text);
    if (isAuthorAffilText && !/\b(?:introduction|methods|results|discussion|conclusion|references|related work|literature review)\b/i.test(f.text)) {
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

    // Guard: Subfigure labels (e.g. "(a)   (b)", "(a) Original (b) Enhanced") are not section headings
    if (/^\s*(?:\([a-z0-9]\)\s*)+$/i.test(f.text) || /^\s*(?:\([a-z0-9]\)\s*[\w\s.,-]{0,40}\s*){2,}$/i.test(f.text)) {
      return null;
    }

    // Priority 1: Numerical/Alpha Hierarchical Numbering Ground Truth (1., 1.1, 1.1.1, A., A.1, I., I.1, [1], (A))
    // Author numbering ALWAYS takes absolute precedence over generic canonical dictionaries
    const isNumbered = /^(?:\s*(?:section|chapter|appendix|part)\s+)?(?:\[|\()?((?:\d+|[ivxlcdm]+|[a-z])(?:\.(?:\d+|[ivxlcdm]+|[a-z]))*)(?:\]|\))?[.:\s)]/i.test(f.text);
    if (isNumbered) {
      const prefixMatch = f.text.match(/^(?:\s*(?:(?:section|chapter|appendix|part)\s+)?(?:\[|\()?((?:\d+|[ivxlcdm]+|[A-Za-z])(?:\.(?:\d+|[ivxlcdm]+|[A-Za-z]))*)(?:\]|\))?(?:\.?[.:\s)]+))/i);
      if (prefixMatch && isValidSectionPrefix(prefixMatch[1], prefixMatch[0])) {
        const afterPrefix = f.text.substring(prefixMatch[0].length).trim();
        // A valid section heading MUST have a real title following the numbering prefix
        if (!afterPrefix || afterPrefix.length < 2 || !/[a-zA-Z]{2,}/.test(afterPrefix) || /^\([a-z0-9]\)/i.test(afterPrefix)) {
          return null;
        }

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

    // Priority 2: HTML Tag Name Ground Truth (h1 -> 1, h2 -> 2, h3 -> 3)
    if (targetEl.tagName.toLowerCase().startsWith('h') && targetEl.tagName.toLowerCase().length > 1) {
      const parsed = parseInt(targetEl.tagName.toLowerCase().substring(1));
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 6) {
        return Math.min(3, parsed);
      }
    }

    // Priority 3: Canonical Academic Section Names (always level 1 fallback when unnumbered & untagged)
    if (this.FORCED_LEVEL1.has(normClean) || isCanonicalL1Heading(normClean)) return 1;

    // Priority 4: Stand-alone line heuristic: short, bold, title-cased, no trailing punctuation
    const trimmedText = f.text.trim();
    const endsWithPunct = /[.;,?!:–—]$/.test(trimmedText);
    const isProseLead = /^(?:step|case|example|note|input|output|recall|proof|remark|given|definition|phase|stage|where|and|or|if|then|else|however|furthermore|moreover|therefore|thus|in addition)\b/i.test(trimmedText);
    const isCaptionLead = /^(?:figure|fig\b|table|tab\b|chart|algorithm|algo\b|listing|eq\b|equation)\b/i.test(trimmedText);
    if (isCaptionLead) return null;

    // Check if element has previous sibling that looks like unfinished sentence
    const prevEl = targetEl.previousElementSibling;
    if (prevEl) {
      const prevText = (prevEl.textContent || '').trim();
      if (prevText.length > 0 && !/[.?!]$/.test(prevText)) {
        // Previous element is an unclosed sentence/paragraph - continuation fragment, not a heading
        return null;
      }
    }

    // Proximity check: if next sibling is a figure, image, table, or has caption lead, this line is likely a caption label
    const nextEl = targetEl.nextElementSibling;
    if (nextEl) {
      const nextTagName = (nextEl.tagName || '').toLowerCase();
      const nextText = (nextEl.textContent || '').trim();
      if (
        nextTagName === 'figure' ||
        nextTagName === 'table' ||
        nextTagName === 'img' ||
        (nextEl as any).querySelector?.('img, table, figure') ||
        /^(?:figure|fig\b|table|tab\b|chart|algorithm)\s*\d/i.test(nextText)
      ) {
        return null;
      }
    }

    // Domain metric/label stopwords that are often capitalized but are not sections
    const DOMAIN_LABEL_STOPWORDS = new Set([
      'precision and recall', 'mean squared error', 'true positive rate', 'false positive rate',
      'confusion matrix', 'training set', 'testing set', 'validation set', 'learning rate',
      'batch size', 'loss function', 'accuracy and loss', 'feature extraction', 'data preprocessing',
      'hyperparameter tuning', 'support vector machine', 'random forest', 'decision tree',
      'deep neural network', 'convolutional neural network', 'recurrent neural network',
      'linear regression', 'logistic regression', 'naive bayes', 'k-nearest neighbors',
      'gradient boosting', 'cross entropy', 'standard deviation', 'confidence interval',
      'roc curve', 'auc score', 'f1 score', 'f-measure', 'root mean squared error',
      'principal component analysis', 'natural language processing', 'reinforcement learning',
      'transfer learning', 'data augmentation', 'loss curve', 'epoch', 'learning curves',
      'ablation study', 'baseline model', 'ground truth', 'sample size', 'p-value',
      'statistical significance', 'sensitivity analysis', 'receiver operating characteristic',
      'area under curve', 'k-fold cross validation', 'cross-validation', 'grid search',
      'random search', 'gradient descent', 'stochastic gradient descent', 'adam optimizer',
      'weight decay', 'dropout rate', 'batch normalization', 'layer normalization',
      'attention mechanism', 'multi-head attention', 'transformer architecture',
      'encoder decoder', 'embedding layer', 'latent space', 'cosine similarity',
      'euclidean distance', 'silhouette score', 'clustering coefficient',
      'inclusion criteria', 'exclusion criteria', 'patient cohort', 'control group',
      'experimental group', 'study design', 'ethical approval', 'informed consent',
      'clinical trial', 'sample preparation', 'experimental setup', 'boundary conditions',
      'finite element analysis', 'signal to noise ratio', 'frequency response',
      'transfer function', 'degrees of freedom', 'time complexity', 'space complexity',
      'computational cost'
    ]);
    if (DOMAIN_LABEL_STOPWORDS.has(normClean)) {
      return null;
    }

    // Single-word title-case lines should not become headings unless in canonical academic L1 set
    if (f.wordCount === 1 && !this.FORCED_LEVEL1.has(normClean)) {
      return null;
    }

    const words = trimmedText.split(/\s+/).filter(Boolean);
    const isTitleCase = words.length > 0 && words.every(w => /^[A-Z]/.test(w) || STOPWORDS.has(w.toLowerCase()) || /^\d/.test(w));
    // Tightened standalone heuristic: require bold font, no sentence-trailing punctuation, reasonable length
    const isStandalone = !endsWithPunct && !isProseLead && !trimmedText.includes(',') && f.isBold && f.wordCount >= 2 && f.wordCount < 10 && (
      (f.capRatio > 0.2 || isTitleCase) ||
      (f.capRatio > 0.85 && f.wordCount <= 6)
    );
    if (isStandalone) {
      return 2;
    }
    return null;
  }

  // ── CAPTION FINDER ───────────────────────────────────────────────────────────
  private static isTableCaptionProse(t: string): boolean {
    // A genuine table caption with separator ("Table 1: Datasets", "Table 1. Overview of...", "Table 1 - Stats")
    // is a real caption even if it contains descriptive verbs like "summarizes" or "shows".
    // Only text WITHOUT a punctuation separator that immediately uses a running verb is body prose ("Table 1 summarizes the results").
    const trimmed = t.trim();
    const hasDelim = /^\s*(?:Table|Tab\b\.?)\s*[\d.\-:A-Za-z]+\s*[:.\-–—]/.test(trimmed);
    if (hasDelim) return false;

    // No delimiter present: check if the first word immediately following the label is a verb
    const noDelimMatch = trimmed.match(/^\s*(?:Table|Tab\b\.?)\s*[\d.\-:A-Za-z]+\s+([a-zA-Z]+)/i);
    if (noDelimMatch) {
      const firstWord = noDelimMatch[1].toLowerCase();
      if (/^(?:shows?|presents?|illustrates?|compares?|depicts?|displays?|demonstrates?|summarizes?|lists?|reports?|plots?|gives?|provides?|represents?|outlines?|describes?|highlights?|overviews?|contains?|yields?|produces?|indicates?|details?|tabulates?|portrays?|evaluates?|reveals?|reflects?|corresponds?|includes?|expresses?|exhibits?|is|are|was|were|uses?|used)$/.test(firstWord)) {
        return true;
      }
    }

    // Universal: Any text without delimiter that has multi-sentence prose, citations, or excessive length is body prose
    if (trimmed.length > 80 || /\.\s+[A-Z]/.test(trimmed) || /\[\d+\]/.test(trimmed) || /\b(?:Figure|Fig\b\.?)\s*\d/i.test(trimmed)) {
      return true;
    }
    return false;
  }

  private static isFigureCaptionProse(t: string): boolean {
    // A genuine figure caption with separator ("Figure 1: Model architecture that depicts...", "Figure 2. Results where...")
    // is a real caption even if it contains descriptive verbs.
    // Only text WITHOUT a punctuation separator that immediately uses a running verb is body prose ("Figure 2 shows the results").
    const trimmed = t.trim();
    const hasDelim = /^\s*(?:Figure|Fig\b\.?|Image|Chart|Diagram|Photo)\s*[\d.\-:A-Za-z]+\s*[:.–\-\—]/i.test(trimmed);
    if (hasDelim) return false;

    // No delimiter present: check if the first word immediately following the label is a verb
    const noDelimMatch = trimmed.match(/^\s*(?:Figure|Fig\b\.?|Image|Chart|Diagram|Photo)\s*[\d.\-:A-Za-z]+\s+([a-zA-Z]+)/i);
    if (noDelimMatch) {
      const firstWord = noDelimMatch[1].toLowerCase();
      if (/^(?:shows?|presents?|illustrates?|compares?|depicts?|displays?|demonstrates?|summarizes?|lists?|reports?|plots?|gives?|provides?|represents?|outlines?|describes?|highlights?|overviews?|contains?|yields?|produces?|indicates?|details?|tabulates?|portrays?|evaluates?|reveals?|reflects?|corresponds?|includes?|expresses?|exhibits?|is|are|was|were|uses?|used)$/.test(firstWord)) {
        return true;
      }
    }

    // Universal: Any text without delimiter that has multi-sentence prose, citations, or excessive length is body prose
    if (trimmed.length > 80 || /\.\s+[A-Z]/.test(trimmed) || /\[\d+\]/.test(trimmed) || /\b(?:Table|Tab\b\.?)\s*\d/i.test(trimmed)) {
      return true;
    }
    return false;
  }

  private static findCaption(
    el: Element,
    processed: Set<Element>,
    type: 'figure' | 'table',
    typePositions: Map<Element, number>,
    consumedTexts?: Set<string>
  ): string {
    // 1. Direct structured inner check (e.g. child <caption> tag generated by parser)
    if (type === 'table') {
      const internalCap = el.querySelector('caption');
      if (internalCap && !processed.has(internalCap)) {
        processed.add(internalCap);
        const cap = this.cleanCaption(internalCap.textContent?.trim() || '');
        if (consumedTexts && cap) consumedTexts.add(cap);
        return cap;
      }
    }

    const rx =
      type === 'figure'
        ? /^\s*[\u200B\uFEFF\u00A0]*\s*(?:Figure|Fig\b\.?|Image|Chart|Diagram|Photo|Graph)\s*(?:(?:\(|\b)(\d+(?:\.\d+)*|S?\d+|[a-zA-Z]\b|[IVXLCDMivxlcdm]+\b)(?:\)|\b))?(?:\s*[:.\-–—\s])?/i
        : /^\s*[\u200B\uFEFF\u00A0]*\s*(?:Table|Tab\b\.?)\s*(?:(?:\(|\b)(\d+(?:\.\d+)*|S?\d+|[a-zA-Z]\b|[IVXLCDMivxlcdm]+\b)(?:\)|\b))?(?:\s*[:.\-–—\s])?/i;

    // Caption ordinal extractor: extracts the figure/table number from captions
    // like "Figure 1", "Table 2", "Fig. 3", "Chart 1" etc.
    const captionOrdinal = (t: string): number | null => {
      const m = t.match(
        type === 'figure'
          ? /(?:Figure|Fig\.?|Image|Chart|Diagram|Photo|Graph)\s*(?:\(|\b)(\d+(?:\.\d+)*|S?\d+|[a-zA-Z]\b|[IVXLCDMivxlcdm]+\b)(?:\)|\b)/i
          : /(?:Table|Tab\.?)\s*(?:\(|\b)(\d+(?:\.\d+)*|S?\d+|[a-zA-Z]\b|[IVXLCDMivxlcdm]+\b)(?:\)|\b)/i
      );
      if (!m) return null;
      const s = m[1];
      // Arabic numeral: extract the integer part before any decimal
      const numMatch = s.match(/\d+/);
      if (numMatch) {
        return parseInt(numMatch[0], 10);
      }
      // Roman numeral: convert to integer
      if (/^[ivxlcdm]+$/i.test(s)) {
        const roman: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
        let sum = 0;
        let prev = 0;
        for (const ch of s.toUpperCase().split('').reverse()) {
          const v = roman[ch] ?? 0;
          sum += v < prev ? -v : v;
          prev = v;
        }
        return sum > 0 ? sum : null;
      }
      return null;
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
    const blockEl = ((el.tagName.toLowerCase() === 'img' || el.tagName.toLowerCase() === 'table') && el.parentElement && ['p', 'div', 'span', 'figure'].includes(el.parentElement.tagName.toLowerCase()))
      ? el.parentElement
      : el;

    let next = blockEl.nextElementSibling || el.nextElementSibling;
    let prev = blockEl.previousElementSibling || el.previousElementSibling;
    // In scholarly papers, table captions appear ABOVE the table (prev); figure captions appear BELOW (next).
    const checkPrevFirst = type === 'table';

    for (let i = 0; i < 35; i++) {
      const inspectCandidate = (candidate: Element | null, isForward: boolean): string | null => {
        if (!candidate || processed.has(candidate)) return null;
        const rawT = candidate.textContent || '';
        const t = rawT.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
        const isTableProse = type === 'table' && this.isTableCaptionProse(t);
        const isFigureProse = type === 'figure' && this.isFigureCaptionProse(t);
        if (rx.test(t) && t.length <= 500 && !isTableProse && !isFigureProse) {
          const capOrdinal = captionOrdinal(t);
          const farEl = farSibling(candidate, isForward ? 1 : -1);
          const farPos = farEl ? typePositions.get(farEl) : undefined;
          // Only skip this caption if the far element is the corresponding figure/table
          // (i.e., the caption's ordinal matches the far element's position AND the far element
          // is within a reasonable distance from the caption). This prevents double-counting
          // while still allowing captions to be found even if the position mapping is slightly off.
          const thisPos = typePositions.get(el);
          const belongsToFar = (capOrdinal !== null && farPos !== undefined && capOrdinal === farPos && i < 10) ||
                               (capOrdinal !== null && thisPos !== undefined && Math.abs(capOrdinal - thisPos) >= 2);
          if (!belongsToFar) {
            processed.add(candidate);
            if (consumedTexts) consumedTexts.add(t);
            const prefixMatch = t.match(rx);
            const cleanPrefix = prefixMatch ? prefixMatch[0].replace(/[:.–\-\s]+$/, '').trim() : '';
            let afterPrefix = prefixMatch ? t.slice(prefixMatch[0].length).replace(/^[:.–\-\s]*/, '').trim() : '';

            // DUAL PARAGRAPH MERGE:
            if (afterPrefix.length < 5) {
              let sibCont = isForward ? candidate.nextElementSibling : candidate.nextElementSibling;
              while (sibCont && sibCont !== el && !sibCont.textContent?.trim() && !['table', 'img', 'figure'].includes(sibCont.tagName.toLowerCase())) {
                sibCont = sibCont.nextElementSibling;
              }
              if (sibCont && sibCont !== el && !processed.has(sibCont) && ['p', 'div'].includes(sibCont.tagName.toLowerCase())) {
                const sibRaw = sibCont.textContent || '';
                const sibText = sibRaw.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
                if (sibText.length > 0 && sibText.length < 600 && !rx.test(sibText) && !/^(?:\d+[\.\s]+|[ivxlcdm]+[\.\s]+)+/i.test(sibText) && !this.FORCED_LEVEL1.has(sibText.toLowerCase()) && !this.isFigureCaptionProse(sibText) && !this.isTableCaptionProse(sibText) && sibText.split(/\s+/).length <= 60) {
                  processed.add(sibCont);
                  if (consumedTexts) consumedTexts.add(sibText);
                  afterPrefix = sibText;
                }
              }
            }

            const cleanCap = this.cleanCaption(afterPrefix.length > 0 ? `${cleanPrefix}: ${afterPrefix}` : cleanPrefix);
            if (consumedTexts) consumedTexts.add(cleanCap);
            return cleanCap;
          }
        }
        return null;
      };

      if (checkPrevFirst) {
        const found = inspectCandidate(prev, false);
        if (found) return found;
        const foundNext = inspectCandidate(next, true);
        if (foundNext) return foundNext;
      } else {
        const found = inspectCandidate(next, true);
        if (found) return found;
        const foundPrev = inspectCandidate(prev, false);
        if (foundPrev) return foundPrev;
      }

      // Boundary stopping checks
      if (next) {
        const tag = next.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag) || tag === 'table' || (tag === 'img' && next !== el) || next.querySelector('img, table, h1, h2, h3, h4, h5, h6')) {
          next = null;
        } else if (tag === 'p' || tag === 'div') {
          const textVal = next.textContent?.trim() || '';
          const isMatchingCaption = rx.test(textVal);
          if ((textVal.length > 500 && !isMatchingCaption) || (textVal.length > 250 && !isMatchingCaption && !textVal.includes('   '))) {
            next = null;
          }
        }
      }

      if (prev) {
        const tag = prev.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag) || tag === 'table' || (tag === 'img' && prev !== el) || prev.querySelector('img, table, h1, h2, h3, h4, h5, h6')) {
          prev = null;
        } else if (tag === 'p' || tag === 'div') {
          const textVal = prev.textContent?.trim() || '';
          const isMatchingCaption = rx.test(textVal);
          if ((textVal.length > 500 && !isMatchingCaption) || (textVal.length > 250 && !isMatchingCaption && !textVal.includes('   '))) {
            prev = null;
          }
        }
      }

      next = next?.nextElementSibling || null;
      prev = prev?.previousElementSibling || null;
    }

    // UNIVERSAL: Fallback for tables whose title/caption does not use an explicit "Table N:" prefix
    // (standard in IEEE, ACM, Springer templates where table title is a short paragraph directly above).
    if (type === 'table') {
      let cand: Element | null = blockEl.previousElementSibling || el.previousElementSibling;
      let currBlock: Element | null = blockEl;
      while (!cand && currBlock?.parentElement && ['div', 'section', 'article'].includes(currBlock.parentElement.tagName.toLowerCase())) {
        currBlock = currBlock.parentElement;
        cand = currBlock.previousElementSibling;
      }
      while (cand && !cand.textContent?.trim() && !['table', 'img', 'figure'].includes(cand.tagName.toLowerCase())) {
        cand = cand.previousElementSibling;
      }
      if (cand && !processed.has(cand)) {
        let rawT = (cand.textContent || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
        rawT = rawT.replace(/^[\u2022\u00b7*•\-]\s*/, '').trim();
        const words = rawT.split(/\s+/).filter(Boolean);
        const normClean = rawT.toLowerCase().replace(/^(?:\d+[\.\s]+|[ivxlcdm]+[\.\s]+)+\s*/i, '').replace(/[.:\s]+$/, '').trim();
        const isList = ['ol', 'ul', 'li'].includes(cand.tagName.toLowerCase()) || Boolean(cand.querySelector('li'));
        const isCanonicalL1 = !isList && this.FORCED_LEVEL1.has(normClean);
        const isProse = rawT.endsWith('.') && words.length > 8 && !/^[A-Z]/.test(rawT);
        const isRealTitle = rawT.length >= 3 && rawT.length <= 160 && !isCanonicalL1 && !isProse && words.length <= 18 &&
          !/^(?:abstract|introduction|background|methodology|proposed|results|discussion|conclusion|references|acknowledg)\b/i.test(normClean);
        if (isRealTitle || isList) {
          processed.add(cand);
          cand.querySelectorAll('*').forEach(c => processed.add(c));
          if (consumedTexts) consumedTexts.add(rawT);
          return this.cleanCaption(rawT);
        }
      }
    }

    // UNIVERSAL: Fallback for figures whose caption does not use an explicit "Figure N:" prefix
    // (e.g. diagrams or figures with short title/captions directly below).
    if (type === 'figure') {
      let cand: Element | null = blockEl.nextElementSibling || el.nextElementSibling;
      let currBlock: Element | null = blockEl;
      while (!cand && currBlock?.parentElement && ['div', 'section', 'article'].includes(currBlock.parentElement.tagName.toLowerCase())) {
        currBlock = currBlock.parentElement;
        cand = currBlock.nextElementSibling;
      }
      while (cand && !cand.textContent?.trim() && !['table', 'img', 'figure'].includes(cand.tagName.toLowerCase())) {
        cand = cand.nextElementSibling;
      }
      // If cand is a subfigure label line (e.g. "(a)  (b)", "(e)  (f)", "(a) Glaucoma (b) Normal"), advance past it!
      while (cand && (/^\s*(?:\([a-z0-9]\)\s*)+$/i.test((cand.textContent || '').trim()) ||
                     /^\s*(?:\([a-z0-9]\)\s*[\w\s.,-]{0,40}\s*){2,}$/i.test((cand.textContent || '').trim()) ||
                     !cand.textContent?.trim())) {
        cand = cand.nextElementSibling;
      }
      if (cand && !processed.has(cand)) {
        let rawT = (cand.textContent || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
        // Strip leading bullets (e.g. "• Sample Glaucoma and Normal images...")
        rawT = rawT.replace(/^[\u2022\u00b7*•\-]\s*/, '').trim();
        const words = rawT.split(/\s+/).filter(Boolean);
        const normClean = rawT.toLowerCase().replace(/^(?:\d+[\.\s]+|[ivxlcdm]+[\.\s]+)+\s*/i, '').replace(/[.:\s]+$/, '').trim();
        const isList = ['ol', 'ul', 'li'].includes(cand.tagName.toLowerCase()) || Boolean(cand.querySelector('li'));
        const isCanonicalL1 = !isList && this.FORCED_LEVEL1.has(normClean);
        const isProse = rawT.endsWith('.') && words.length > 12 && !/^[A-Z]/.test(rawT);
        const isRealTitle = rawT.length >= 3 && rawT.length <= 500 && !isCanonicalL1 && !isProse && words.length <= 60 &&
          !/^(?:abstract|introduction|literature review|related work|background|methodology|experiments|results|discussion|conclusion|references|acknowledg)\b/i.test(normClean);
        if (isRealTitle || isList) {
          processed.add(cand);
          cand.querySelectorAll('*').forEach(c => processed.add(c));
          if (consumedTexts) consumedTexts.add(rawT);
          return this.cleanCaption(rawT);
        }
      }
    }

    return '';
  }

  private static cleanCaption(s: string): string {
    return s.replace(/&lt;[\s\S]*?&gt;/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private static isGenericAltText(caption: string): boolean {
    if (!caption) return true;
    const lower = caption.trim().toLowerCase();
    return /^(?:a\s+)?(?:graph|chart|diagram|plot|picture|image|photo|screenshot|figure|logo|banner|icon|header|footer|decoration|watermark)\s+(?:of|showing|depicting|illustrating)/i.test(lower) ||
           /^(?:graph|chart|diagram|plot)\s+showing/i.test(lower) ||
           /^(?:a\s+)?(?:red|blue|green|black|white)\s+(?:and|or|colored|colour)/i.test(lower) ||
           /^(?:logo|icon|banner|header|footer|decoration|watermark|bullet|divider|spacer|signature|qrcode)$/i.test(lower);
  }

  public static tableHtmlDimensions(html: string): { rowCount: number; colCount: number } {
    let rowCount = 0;
    let colCount = 0;
    if (!html) return { rowCount: 0, colCount: 0 };
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;

    while ((trMatch = trRegex.exec(html)) !== null) {
      rowCount++;
      const rowContent = trMatch[1] || '';
      // Count cells in this row, handling colspan
      const cellMatches = rowContent.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || rowContent.match(/<t[dh][^>]*>/gi) || [];
      let maxCellsInRow = cellMatches.length;

      // Calculate effective cell count considering colspan cleanly without stateful regex
      let effectiveColCount = 0;
      for (let i = 0; i < cellMatches.length; i++) {
        const cellTag = cellMatches[i];
        const csMatch = cellTag.match(/colspan=["']?(\d+)["']?/i);
        const colSpanVal = csMatch ? Math.max(1, parseInt(csMatch[1], 10) || 1) : 1;
        effectiveColCount += colSpanVal;
      }
      const rowCols = Math.max(effectiveColCount > 0 ? effectiveColCount : maxCellsInRow, maxCellsInRow);
      if (Number.isFinite(rowCols) && rowCols > colCount) {
        colCount = rowCols;
      }
    }
    // Ensure minimum column count of 1 if there are rows
    if (rowCount > 0 && (!Number.isFinite(colCount) || colCount === 0)) colCount = 1;
    return { rowCount, colCount: Number.isFinite(colCount) ? colCount : 0 };
  }

  public static syncDerivedCollections(doc: StructuredDocument): void {
    if (!doc || !Array.isArray(doc.body)) return;
    doc.algorithms = doc.body.filter(n => n.type === 'algorithm').map(n => ({
      title: n.title || 'Algorithm', content: (n.items || []).join('\n') || n.text || ''
    }));
    doc.tables = doc.body.filter(n => n.type === 'table').map((n: any) => {
      const dims = n.html ? DeepDocumentParser.tableHtmlDimensions(n.html) : { rowCount: 0, colCount: 0 };
      return {
        caption: n.caption || 'Table',
        id: n.id || '',
        rowCount: dims.rowCount,
        colCount: dims.colCount
      };
    });
    doc.charts = doc.body.filter(n => n.type === 'chart').map((n: any) => ({
      caption: n.caption || 'Chart',
      id: n.id || '',
    }));
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
        } else if (/\s{2,}/.test(line)) {
          cells = line.split(/\s{2,}/).map(c => c.trim());
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
      if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);
      return line.split(',').map(c => c.trim()).filter(Boolean);
    };
    const numericCellCount = (cells: string[]) => cells.filter(c => /\d/.test(c)).length;

    const multiSpaceCount = (f.text.match(/\s{2,}/g) || []).length;
    if (tabCount >= 1 || pipeCount >= 2 || (multiSpaceCount >= 2 && (numericDensity > 0.05 || isMultiLine))) {
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

    // Tab-delimited rows or table cell data must NEVER be classified as display equations
    if (text.includes('\t') || text.includes('|')) return false;
    if (/^\s*\S+\s{2,}\S+\s{2,}\S+/.test(text)) return false;
    if (/\b(?:TN|TP|FN|FP)\b/.test(text) && !text.includes('MATHBLOCKX') && !/\(\d+\)\s*$/.test(text) && !/^\s*(?:[A-Za-z]\s*=|Formula\b)/i.test(text)) {
      return false;
    }

    // Email addresses should never be classified as equations
    if (EMAIL_RE.test(text)) return false;

    // Reference lines: "[N] Author, Title, ..." — must NOT be classified as equations
    if (/^\s*\[\d+\]/.test(text) && text.length > 40) return false;
    if (/\b(?:et\s+al|vol\.|pp\.|doi:|proceedings|journal|conference)\b/i.test(text)) return false;

    // Subfigure indicator lines (e.g. "(a)   (b)", "(c)   (d)", "(a) Glaucoma (b) Normal")
    // are figure labels, NEVER mathematical display equations
    if (/^\s*(?:\([a-z0-9]\)\s*)+$/i.test(text) || /^\s*(?:\([a-z0-9]\)\s*[\w\s.,-]{0,40}\s*){2,}$/i.test(text)) {
      return false;
    }

    // 1. Exclude lines that are clearly normal headings, captions, or list items
    if (/^(?:figure|fig\.|table|tab\.|algorithm|algo\.|section|chapter|appendix)/i.test(text)) return false;

    // Numbered headings with formula-like titles ("3.1 Loss = L1 + L2") are
    // headings, never equations — equations do not carry "X.Y" prefixes.
    if (/^(?:\s*(?:section|chapter|appendix|part)\s+)?\d+(?:\.\d+)*[.\s:]+[A-Z]/.test(text) && text.length < 150) return false;
    // Also reject "N. Title" patterns (e.g. "6. AI-Assisted Responsible Citation...")
    if (/^\d+\.\s+[A-Z]/.test(text) && text.length < 200) return false;

    // Prose cross-references to numbered items ("Eq. (5)", "Figure 2", "see (3)")
    // are not equations themselves.
    if (/\b(?:eq|equation|fig|figure|sec|section|ref|shown|depicted|displayed|numbered|denoted|defined)\b[^.]*[\(\[]?\s*\d/i.test(text) && !text.includes('=')) return false;

    // Parenthesized years are never equations ("published in (2020)").
    if (/\(\s*(?:19|20)\d{2}\s*\)/.test(text)) return false;

    // Parameter lists like "n = 100, LR = 0.001, batch = 32" are prose, never
    // equations — reject the whole "WORD = value[, ...]" pattern up front.
    if (/^[A-Za-z][A-Za-z0-9_\s]*\s*=\s*[\d.,+\-eE%]+\s*(?:[,;]\s*[A-Za-z][A-Za-z0-9_\s]*\s*=\s*[\d.,+\-eE%]+\s*)*$/.test(text)) return false;

    // Metric-score patterns like "AUC-0.90, Accuracy-0.91" or "Precision: 0.85, Recall: 0.79"
    // are prose reporting results, not equations.
    if (/\b(?:AUC|Accuracy|Precision|Recall|F1|F-score|Sensitivity|Specificity|PPV|NPV|MCC|IoU|Dice|Loss|Error|Rate|Score)\s*[-:=]\s*[\d.]+/i.test(text)) return false;
    
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
    // MUST contain at least one actual mathematical operator or relation symbol (parens alone are NOT equations)
    const realMathOps = (text.match(/[=+\-*/^\\∑∫√²³α-ωΑ-Ωθλπμσδφψωηρ<>~≈≠≤≥_]/g) || []).length;
    if (mathSymbolCount >= 3 && realMathOps >= 1 && mathSymbolDensity > 0.3 && f.wordCount < 20) {
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
