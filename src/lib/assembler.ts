import { getTemplateById, mapLegacyTemplateId as mapTpl } from './templates/registry';
import { formatLatexCode } from './studio-core/formatting-utils';

/**
 * PackageRegistry: Centralized LaTeX package management
 * Ensures deduplication and prevents preamble conflicts.
 */
class PackageRegistry {
  private packages: Map<string, Set<string>> = new Map();
  private nativeText: string = "";

  constructor(nativePreamble: string[] = []) {
    this.nativeText = nativePreamble.join('\n');
    // Basic regex to pre-seed existing packages from native preamble
    const pkgMatches = this.nativeText.matchAll(/\\usepackage\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/g);
    for (const match of pkgMatches) {
      const opts = match[1] ? match[1].split(',').map(o => o.trim()) : [];
      const names = match[2].split(',').map(n => n.trim());
      names.forEach(name => {
        if (!this.packages.has(name)) this.packages.set(name, new Set());
        opts.forEach(opt => this.packages.get(name)!.add(opt));
      });
    }
  }

  add(name: string, options?: string) {
    if (name === 'acmart' || name === 'packages') return;
    if (this.nativeText.includes(`{${name}}`)) return;
    if (!this.packages.has(name)) this.packages.set(name, new Set());
    if (options) {
      options.split(',').forEach(o => this.packages.get(name)!.add(o.trim()));
    }
  }

  has(name: string): boolean {
    return this.packages.has(name) || this.nativeText.includes(`{${name}}`);
  }

  serialize(): string[] {
    const lines: string[] = [];
    this.packages.forEach((opts, name) => {
      // If the package is already in nativeText, we don't emit it again
      if (this.nativeText.includes(`{${name}}`)) return;
      const optStr = opts.size > 0 ? `[${Array.from(opts).join(',')}]` : '';
      lines.push(`\\usepackage${optStr}{${name}}`);
    });
    return lines;
  }
}

import { StructuredDocument, ContentNode } from './deep-parser';
const GREEK_MAP: Record<string, string> = {
  'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon',
  'ζ': 'zeta', 'η': 'eta', 'θ': 'theta', 'ι': 'iota', 'κ': 'kappa',
  'λ': 'lambda', 'μ': 'mu', 'ν': 'nu', 'ξ': 'xi', 'ο': 'o',
  'π': 'pi', 'ρ': 'rho', 'σ': 'sigma', 'τ': 'tau', 'υ': 'upsilon',
  'φ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'ω': 'omega',
  'Α': 'Alpha', 'Β': 'Beta', 'Γ': 'Gamma', 'Δ': 'Delta', 'Ε': 'Epsilon',
  'Ζ': 'Zeta', 'Η': 'Eta', 'Θ': 'Theta', 'Ι': 'Iota', 'Ｋ': 'Kappa',
  'Λ': 'Lambda', 'Ｍ': 'Mu', 'Ｎ': 'Nu', 'Ξ': 'Xi', 'Ｏ': 'O',
  'Π': 'Pi', 'Ρ': 'Rho', 'Σ': 'Sigma', 'Ｔ': 'Tau', 'Ｙ': 'Upsilon',
  'Φ': 'Phi', 'Ｘ': 'Chi', 'Ψ': 'Psi', 'Ω': 'Omega',
  '±': 'pm', '×': 'times', '÷': 'div', '≈': 'approx', '≠': 'neq',
  '≤': 'leq', '≥': 'geq', '∞': 'infty', '∫': 'int', '∂': 'partial',
  '√': 'sqrt', '∈': 'in', '∉': 'notin', '∑': 'sum', '∏': 'prod',
  '∇': 'nabla', '∠': 'angle', '°': 'circ', '…': 'dots',
  '→': 'rightarrow', '←': 'leftarrow', '↔': 'leftrightarrow', '⇒': 'Rightarrow',
  '∀': 'forall', '∃': 'exists', '⊂': 'subset', '⊃': 'supset', '∩': 'cap', '∪': 'cup',
  '∧': 'wedge', '∨': 'vee', '∬': 'iint', '∭': 'iiint', '∮': 'oint'
};

export class LatexAssembler {
  static assemble(doc: StructuredDocument, templateId: string = 'generic', templateMainTex?: string): { mainTex: string; files: Record<string, string> } {
    const mathBlocks: any[] = doc.mathBlocks || [];
    const files: Record<string, string> = {};
    
    let docClass = "\\documentclass{article}";
    let nativePreamble: string[] = [];

    if (templateMainTex && typeof templateMainTex === 'string') {
      const beginDocIdx = templateMainTex.indexOf('\\begin{document}');
      if (beginDocIdx !== -1) {
          const rawPreamble = templateMainTex.substring(0, beginDocIdx);
          nativePreamble = rawPreamble.split('\n').filter(line => {
              const l = line.trim();
              return !l.startsWith('\\title') && !l.startsWith('\\author') && !l.startsWith('\\date') && !l.startsWith('\\maketitle') && !l.startsWith('\\affil');
          });
          docClass = ""; // Handled by native preamble
      }
    }

    const isAcm = templateId === 't2' || templateId === 'article_acm' || templateId === 'acm_cacm' || templateId === 'conf_acm';
    const isIeee = templateId === 't1' || templateId === 'article_ieee' || templateId === 'ieee_tpami' || templateId === 'conf_ieee' || templateId === 'ieee_tnnls';
    const isElsevier = templateId === 't3' || templateId === 'article_elsevier' || templateId.startsWith('elsevier_');
    const isLncs = templateId === 't4' || templateId === 'article_lncs';
    const isSciRep = templateId === 't6' || templateId === 'article_scirep' || templateId === 'scirep';
    const isMdpi = templateId === 'article_mdpi';
    const isSciFile = templateId === 'scifile';
    const isNature = templateId === 'nature' || templateId === 'nature_comms' || templateId === 'nature_physics';
    if (!docClass) {
        // Native preamble will be used
    } else if (isAcm) docClass = "\\documentclass[nonacm,sigconf]{acmart}";
    else if (isIeee) docClass = "\\documentclass[journal]{IEEEtran}";
    else if (isElsevier) docClass = "\\documentclass[preprint,12pt]{elsarticle}";
    else if (isLncs) docClass = "\\documentclass{llncs}";
    else if (isSciRep) docClass = "\\documentclass[fleqn,10pt]{wlscirep}";
    else if (isMdpi) docClass = "\\documentclass[journal,article,submit,moreauthors,pdftex]{mdpi}";
    else if (isSciFile) docClass = "\\documentclass{scifile}";

    // --- 1. PREAMBLE GENERATION ---
    const preamble = [
      "\\nonstopmode",
      ...(docClass ? [docClass] : nativePreamble),
      "\\catcode`\\@=11",
      "\\ifdefined\\DeclareUnicodeCharacter",
      "  \\DeclareUnicodeCharacter{207B}{\\ensuremath{^{-}}}",
      "  \\DeclareUnicodeCharacter{025B}{\\ensuremath{\\epsilon}}",
      "  \\DeclareUnicodeCharacter{2126}{\\ensuremath{\\Omega}}",
      "  \\DeclareUnicodeCharacter{2013}{--}",
      "  \\DeclareUnicodeCharacter{2014}{---}",
      "  \\DeclareUnicodeCharacter{2212}{-}",
      "\\fi",
      "\\ifdefined\\DeclareUnicodeCharacter\\else\\long\\def\\DeclareUnicodeCharacter#1#2{}\\fi",
      "\\providecommand{\\botrule}{\\midrule}",
      "\\providecommand{\\toprule}{\\hline}",
      "\\providecommand{\\equalcont}[1]{}",
      "\\providecommand{\\bmhead}[1]{\\section*{#1}}",
      "\\providecommand{\\backmatter}{}",
      "\\providecommand{\\jnlcitation}[1]{}",
      "\\providecommand{\\authormark}[1]{}",
      "\\providecommand{\\address}[2]{}",
      "\\providecommand{\\corres}[1]{}",
      "\\providecommand{\\presentaddress}[1]{}",
      "\\providecommand{\\articletype}[1]{}",
      "\\@ifundefined{set@color}{\\providecommand{\\set@color}{}}{}",
      "\\@ifundefined{reset@color}{\\providecommand{\\reset@color}{}}{}",
      "\\providecommand{\\letterspace}[1]{#1}",
      "\\providecommand{\\naturalwidth}{0.9\\textwidth}",
      "\\catcode`\\@=12",
      "\\PassOptionsToPackage{export}{graphicx}",
      "\\PassOptionsToPackage{export}{adjustbox}",
      "\\usepackage[T1]{fontenc}",
      "\\usepackage[utf8]{inputenc}",
      "\\ifdefined\\DeclareUnicodeCharacter\\DeclareUnicodeCharacter{200B}{}\\fi",
      "\\usepackage{graphicx}",
      "\\usepackage{amsmath,amsfonts,amssymb}",
      "\\usepackage{booktabs,multirow,array,tabularx,adjustbox}",
      "\\usepackage{float,caption}",
      "\\usepackage{url,xurl}",
      "\\emergencystretch=3em",
      "\\righthyphenmin=2",
      "",
      "% --- UNIVERSAL SUBFIGURE FALLBACK ---",
      "\\catcode`\\@=11",
      "\\@ifundefined{subfigure}{",
      "  \\newcounter{localsubfig}[figure]",
      "  \\newenvironment{subfigure}[2][]{%",
      "    \\begin{minipage}{#2}%",
      "      \\refstepcounter{localsubfig}%",
      "      \\def\\caption##1{%",
      "        \\par\\vspace{5pt}{\\centering\\small(\\alph{localsubfig})~##1\\par}%",
      "      }%",
      "  }{%",
      "    \\end{minipage}%",
      "  }",
      "}{}",
      "\\catcode`\\@=12",
    ];

    // Standardize to algorithm and algpseudocode because our generator output is always algpseudocode-compatible
    preamble.push("\\usepackage{algorithm}", "\\usepackage{algpseudocode}");

    preamble.push(
      "\\usepackage{iftex,microtype}",
      "\\ifdefined\\pdfpxdimen\\pdfpxdimen=1in/3000\\fi",
      "\\graphicspath{{./}{./assets/}{./images/}{./figures/}{../}{../assets/}{../images/}{./figures/}}",
      "\\DeclareGraphicsExtensions{.pdf,.eps,.png,.PNG,.jpg,.JPG,.jpeg,.JPEG,.tif,.tiff,.bmp,.gif,.webp,.avif,.svg,.ico,.heic,.HEIC,.heif,.HEIF}",
      "\\setkeys{Gin}{max width=\\linewidth,max height=0.7\\textheight,keepaspectratio}",
      "",
      "% --- UNIVERSAL ASSET RESOLVER (zimg) ---",
      "\\ifdefined\\zimg\\else",
      "  \\newcommand{\\zimg}[4]{%",
      "    \\IfFileExists{#1}{%",
      "      \\csname includegraphics\\endcsname[#2,max height=0.7\\textheight]{#1}%",
      "    }{%",
      "      \\IfFileExists{assets/#1}{%",
      "        \\csname includegraphics\\endcsname[#2,max height=0.7\\textheight]{assets/#1}%",
      "      }{%",
      "        \\IfFileExists{figures/#1}{%",
      "          \\csname includegraphics\\endcsname[#2,max height=0.7\\textheight]{figures/#1}%",
      "        }{%",
      "          \\IfFileExists{images/#1}{%",
      "            \\csname includegraphics\\endcsname[#2,max height=0.7\\textheight]{images/#1}%",
      "          }{%",
      "            \\csname includegraphics\\endcsname[#2,max height=0.7\\textheight]{#1}%",
      "          }%",
      "        }%",
      "      }%",
      "    }%",
      "  }%",
      "}",
      "\\fi"
    );

    // --- 1b. SIAM / AUTHBLK DETECTION ---
    const nativeText = nativePreamble.join("\n");
    const isSiam = templateId === 'article_siam' || templateId.includes('siam') || nativeText.includes('siamart');
    const useAuthblk = !isAcm && !isIeee && !isElsevier && !isSciRep && !isSiam && !templateId.includes('scifile') && (!templateMainTex || templateId === 'blank');


    if (useAuthblk) {
      preamble.push("\\usepackage{authblk}");
      preamble.push("\\renewcommand\\Authfont{\\bfseries\\large}");
      preamble.push("\\renewcommand\\Affilfont{\\itshape\\small}");
      preamble.push("\\setlength{\\affilsep}{1em}");
    }

    const escTitle = LatexAssembler.escape(doc.title || "Research Paper", []);
    if (!isElsevier) preamble.push(`\\title{${escTitle}}`);
    
    // --- 2. METADATA FILES ---
    files['metadata/title.txt'] = doc.title || "";
    
    const orgs = (doc.organizations || []).map(o => LatexAssembler.escape(o, []));
    files['metadata/organizations.json'] = JSON.stringify(doc.organizations, null, 2);
    
    const authorLines = (doc.authors || []).map((a, idx) => {
      const name = LatexAssembler.escape(typeof a.name === 'string' ? a.name : (a as any).text || "Author", []);
      const email = a.email ? LatexAssembler.escape(a.email, []) : "";

      let affil = "Institution";
      if (a.affiliationIds && a.affiliationIds.length > 0) {
        const affilIdx = parseInt(a.affiliationIds[0]) - 1;
        if (!isNaN(affilIdx) && orgs[affilIdx]) {
          affil = orgs[affilIdx];
        } else {
          affil = orgs[idx] || orgs[0] || "Institution";
        }
      } else {
        affil = orgs[idx] || orgs[0] || "Institution";
      }

      if (isAcm) {
        const orgLines = (orgs || []).map(o => {
            // High-fidelity ACM affiliation mapping
            const parts = o.split(',').map(p => p.trim());
            const inst = parts[0] || "Institution";
            const city = parts.find(p => p.toLowerCase().includes('delhi') || p.toLowerCase().includes('city')) || "City";
            const country = parts[parts.length - 1] || "Country";
            return `\\affiliation{\n  \\institution{${inst}}\n  \\city{${city}}\n  \\country{${country}}\n}`;
        });
        let orgLine = orgLines[idx] || orgLines[0] || `\\affiliation{\n  \\institution{Institution}\n  \\city{City}\n  \\country{Country}\n}`;
        if (a.affiliationIds && a.affiliationIds.length > 0) {
          const affilIdx = parseInt(a.affiliationIds[0]) - 1;
          if (!isNaN(affilIdx) && orgLines[affilIdx]) {
            orgLine = orgLines[affilIdx];
          }
        }
        return `\\author{${name}}${email ? `\\email{${email}}` : ""}\n${orgLine}`;
      }
      if (isIeee) {
        return `\\IEEEauthorblockN{${name}}\n\\IEEEauthorblockA{${affil}${email ? `\\\\\\email: ${email}` : ""}}`;
      }
      if (templateId.includes('scifile')) {
          const id = a.affiliationIds?.[0] || "1";
          return `${name}$^{${id}${a.isCorresponding ? "\\ast" : ""}}$`;
      }
      if (isLncs) return `${name}\\inst{${a.affiliationIds?.join(',') || "1"}}`;
      if (isElsevier) {
        const ids = a.affiliationIds?.map(id => `aff${id}`).join(',') || "aff1";
        return `\\author[${ids}]{${name}${a.isCorresponding ? "\\corref{cor1}" : ""}}`;
      }
      if (isSciRep) {
        const id = a.affiliationIds?.[0] || "1";
        return `\\author[${id}${a.isCorresponding ? ',*' : ''}]{${name}}`;
      }
      const ids = a.affiliationIds?.join(',') || "1";
      return `\\author[${ids}]{${name}}`;
    });
    files['metadata/authors.json'] = JSON.stringify(doc.authors, null, 2);

    if (templateId.includes('scifile')) {
        preamble.push(`\\author{${authorLines.join(', ')}}`);
        preamble.push(`\\date{}`);
    } else if (isLncs) {
      preamble.push(`\\author{${authorLines.join(' \\and ')}}`);
      if (orgs.length > 0) {
        preamble.push(`\\institute{${orgs.join(' \\and ')}}`);
      } else {
        preamble.push(`\\institute{Institution}`);
      }
    } else if (isElsevier) {
      preamble.push(authorLines.join('\n'));
      if (orgs.length > 0) {
        orgs.forEach((o, i) => {
          preamble.push(`\\affiliation[aff${i+1}]{organization={${o}}, country={Country}}`);
        });
      } else {
        preamble.push(`\\affiliation[aff1]{organization={Institution}, country={Country}}`);
      }
      if (doc.authors.some(a => a.isCorresponding)) preamble.push("\\cortext[cor1]{Corresponding author}");
    } else if (isAcm) {
      preamble.push(...authorLines);
    } else if (isIeee) {
      preamble.push(`\\author{\n${authorLines.join('\n\\and\n')}\n}`);
    } else {
      preamble.push(authorLines.join(' \\and '));
      // UNIVERSAL: Filter noise-only orgs (email-only, "Email:" prefix, etc.)
      const EMAIL_NOISE_RE = /[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/;
      const cleanOrgsLA = orgs.filter(o => {
        const plain = o.replace(/[\\{}]/g, '').trim();
        if (/^Email[:\\s]/i.test(plain)) return false;
        if (EMAIL_NOISE_RE.test(plain) && plain.replace(EMAIL_NOISE_RE, '').replace(/[,;:\\s()/]/g, '').length < 5) return false;
        if (plain.replace(/[,;:\\s()/]/g, '').length < 3) return false;
        return true;
      });
      cleanOrgsLA.forEach((o, i) => preamble.push(`\\affil[${i+1}]{${o}}`));
      const corresponding = doc.authors.find(a => a.isCorresponding);
      if (corresponding?.email) preamble.push(`\\affil[*]{Corresponding author: ${LatexAssembler.escape(corresponding.email, [])}}`);
      preamble.push("\\date{}");
    }

    const header = ["\\begin{document}"];
    if (templateId.includes('scifile')) header.push("\\baselineskip24pt");

    // --- 3. MAKETITLE (must come before abstract/keywords for standard article class) ---
    if (isAcm || isSciRep) {
      // ACM/SciRep: maketitle after abstract env
    } else if (!isElsevier) {
      header.push("\\maketitle");
    }

    // --- 3b. ABSTRACT & KEYWORDS ---
    if (doc.abstract) {
      const env = templateId.includes('scifile') ? 'quote' : 'abstract';
      const abstractContent = `\\begin{${env}}\n${LatexAssembler.escape(doc.abstract, mathBlocks)}\n\\end{${env}}`;
      files['sections/abstract.tex'] = abstractContent;
      header.push("\\input{sections/abstract.tex}");
    }
    
    const kwText = doc.keywords.map(k => LatexAssembler.escape(k, mathBlocks)).join(isElsevier ? ' \\sep ' : ', ');
    if (kwText) {
      let kwContent = "";
      if (isIeee) kwContent = `\\begin{IEEEkeywords}\n${kwText}\n\\end{IEEEkeywords}`;
      else if (isElsevier) kwContent = `\\begin{keyword}\n${kwText}\n\\end{keyword}`;
      else if (isAcm || isSciRep) kwContent = `\\keywords{${kwText}}`;
      else kwContent = `\\noindent\\textbf{Keywords:} ${kwText}`;
      
      files['metadata/keywords.tex'] = kwContent;
      header.push("\\input{metadata/keywords.tex}");
    }

    // ACM/SciRep: maketitle AFTER keywords
    if (isAcm || isSciRep) {
      header.push("\\maketitle");
    }

    // --- 4. BODY CONTENT & SECTION SPLITTING ---
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const normalizedTitle = normalize(doc.title || "");
    const normalizedAuthors = (doc.authors || []).map(a => normalize(typeof a.name === 'string' ? a.name : (a as any).text || ""));

    // Canonical section names — same set as FORCED_L1 in assembleNode
    const FORCED_L1_ASSEMBLER = new Set([
      'abstract','introduction','background','related work','literature review',
      'methodology','proposed method','proposed approach','proposed framework',
      'experimental setup','experiments','results','results and discussion',
      'discussion','conclusion','conclusions','acknowledgements','acknowledgments',
      'references','bibliography','appendix','future work',
      'system model','system overview','problem formulation',
      'problem statement','performance evaluation','evaluation','simulation results',
      'comparison','related works','materials and methods','methods',
      // Universal literature survey variants (no bias to any specific document)
      'literature survey','literature review/survey','survey','literature review and survey',
      'existing literature','literature',
    ]);

    // Two-column detection: based on template ID or native preamble content
    const isTwoColumn = isIeee || isAcm || (
      typeof templateMainTex === 'string' && (
        /\btwocolumn\b/i.test(templateMainTex) ||
        /\bsigconf\b/i.test(templateMainTex) ||
        /\bIEEEtran\b/.test(templateMainTex) ||
        /\breprint\b/i.test(templateMainTex)
      )
    );

    let currentSectionNodes: any[] = [];
    let currentSectionTitle = "introduction";
    let sectionIdx = 1;
    let figureCounter = 0; // Sequential auto-caption counter for unnamed figures

    const flushSection = () => {
      if (currentSectionNodes.length === 0) return;
      const dedupedNodes: any[] = [];
      for (const n of currentSectionNodes) {
          if (n.type === 'equation' && dedupedNodes.length > 0) {
              const last = dedupedNodes[dedupedNodes.length - 1];
              if (last.type === 'equation' && last.latex === n.latex) continue;
          }
          if (n.type === 'paragraph') {
              const last = dedupedNodes[dedupedNodes.length - 1];
              const shouldMerge = (prev: any, curr: any) => {
                  if (!prev || prev.type !== 'paragraph' || curr.type !== 'paragraph') return false;
                  const prevText = (prev.text || '').trim();
                  const currText = (curr.text || '').trim();
                  if (prevText.length === 0 || currText.length === 0) return false;
                  // If previous paragraph ends with sentence-ending punctuation or colon/semicolon, DO NOT merge!
                  if (/[.?!:;]$/.test(prevText)) return false;
                  // Merge only if previous text ends with comma or hyphen, or current text starts with lowercase letter
                  if (/[,–\-]$/.test(prevText)) return true;
                  if (/^[a-z]/.test(currText) && !/[.?!:;]$/.test(prevText)) return true;
                  return false;
              };
              if (shouldMerge(last, n)) {
                  last.text = `${last.text} ${n.text}`.trim();
                  continue;
              }
          }
          dedupedNodes.push(n);
      }
      const sectionContent = dedupedNodes.map(n => LatexAssembler.assembleNode(n, mathBlocks)).join("\n\n");
      const safeTitle = currentSectionTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);
      const fileName = `sections/${sectionIdx.toString().padStart(2, '0')}_${safeTitle}.tex`;
      files[fileName] = sectionContent;
      header.push(`\\input{${fileName}}`);
      currentSectionNodes = [];
      sectionIdx++;
    };

    (doc.body || []).forEach((node, nodeIdx) => {
        const text = (node.text || '').trim();
        const norm = normalize(text);
        if (!norm && node.type !== 'figure' && node.type !== 'table' && node.type !== 'algorithm' && node.type !== 'equation' && node.type !== 'list' && node.type !== 'figure-group' && node.type !== 'chart') return;

        // Strip metadata duplicate content from front matter
        if (nodeIdx < 20) {
            if (norm === normalizedTitle || (normalizedTitle.length > 20 && norm.includes(normalizedTitle))) return;
            if (normalizedAuthors.some(a => a.length > 8 && norm === a)) return;
            if (node.type === 'heading') {
                const cleanLower = text.toLowerCase().replace(/[:.\-\s]*$/, '').trim();
                if (cleanLower.includes('keywords') || cleanLower.includes('index terms')) return;
                if (cleanLower === 'abstract' || cleanLower.startsWith('abstract ')) return;
            }
        }

        // UNIVERSAL METADATA GUARD: Skip keywords/abstract headings anywhere in document
        if (node.type === 'heading' || node.type === 'paragraph') {
            const headingText = text.toLowerCase().replace(/[:.\-\s]*$/, '').trim();
            if (/^(?:keywords?|index terms?|key words?|highlights?)(?:\s*[:\-].*)?$/i.test(headingText)) return;
        }

        // Section splitting: flush on level-1 headings OR canonical section names at any level
        if (node.type === 'heading') {
            const normHeading = text.toLowerCase()
              .replace(/^(?:\d+[.\s]+|[ivxlcdm]+[.\s]+|[a-g][.\s]+)+/i, '')
              .replace(/[:.\s]*$/, '')
              .trim();
            const isLevel1 = (node.level === 1 || !node.level);
            const isCanonical = FORCED_L1_ASSEMBLER.has(normHeading);
            if (isLevel1 || isCanonical) {
                flushSection();
                currentSectionTitle = text || "section";
            }
            // Subsection/subsubsection: do NOT split files, just accumulate
        }

        // Auto-caption unnamed figures/charts with sequential numbering
        if ((node.type === 'figure' || node.type === 'image') && !node.caption) {
            figureCounter++;
            node = { ...node, caption: `Figure ${figureCounter}` };
        }

        if (node.type === 'chart' && !node.caption) {
            figureCounter++;
            node = { ...node, caption: `Figure ${figureCounter}` };
        }

        // Propagate two-column flag to all structural nodes (universal, no template bias)
        if (isTwoColumn && (node.type === 'table' || node.type === 'figure' || node.type === 'image' || node.type === 'figure-group' || node.type === 'algorithm')) {
            node = { ...node, twoColumn: true };
        }
        
        currentSectionNodes.push(node);
        
        // Save individual components to dedicated folders
        if (node.type === 'table') {
            const tableContent = LatexAssembler.assembleTable(node, mathBlocks);
            files[`tables/table_${nodeIdx}.tex`] = tableContent;
        } else if (node.type === 'figure' || node.type === 'image') {
            const figContent = LatexAssembler.assembleNode(node, mathBlocks);
            files[`figures/figure_${nodeIdx}.tex`] = figContent;
        } else if (node.type === 'chart') {
            const chartContent = LatexAssembler.assembleNode(node, mathBlocks);
            files[`figures/figure_${nodeIdx}.tex`] = chartContent;
        } else if (node.type === 'figure-group') {
            const groupContent = LatexAssembler.assembleFigureGroup(node, mathBlocks);
            files[`figures/figure_group_${nodeIdx}.tex`] = groupContent;
        } else if (node.type === 'algorithm') {
            const algoContent = LatexAssembler.assembleAlgorithm(node, mathBlocks);
            files[`algorithms/algo_${nodeIdx}.tex`] = algoContent;
        } else if (node.type === 'equation') {
            const eqContent = LatexAssembler.assembleNode(node, mathBlocks);
            files[`equations/eq_${nodeIdx}.tex`] = eqContent;
        }
    });
    flushSection();


    // --- 5. FULL BACK-MATTER ASSEMBLY ---

    // Declarations: scan body for back-matter sections and extract into dedicated files
    const backMatterTitles: Record<string, string> = {
      'funding': 'metadata/funding.tex',
      'funding statement': 'metadata/funding.tex',
      'funding information': 'metadata/funding.tex',
      'conflict of interest': 'metadata/conflict_of_interest.tex',
      'conflicts of interest': 'metadata/conflict_of_interest.tex',
      'competing interests': 'metadata/conflict_of_interest.tex',
      'data availability': 'metadata/data_availability.tex',
      'data availability statement': 'metadata/data_availability.tex',
      'availability of data': 'metadata/data_availability.tex',
      'authors contributions': 'metadata/authors_contributions.tex',
      'author contributions': 'metadata/authors_contributions.tex',
      'ethics approval': 'metadata/ethics.tex',
      'ethical approval': 'metadata/ethics.tex',
      'ethics statement': 'metadata/ethics.tex',
      'declarations': 'metadata/declarations.tex',
      'consent to participate': 'metadata/consent.tex',
      'consent for publication': 'metadata/consent.tex',
      'informed consent': 'metadata/consent.tex',
      'acknowledgements': 'metadata/acknowledgements.tex',
      'acknowledgments': 'metadata/acknowledgements.tex',
      'acknowledgement': 'metadata/acknowledgements.tex',
      'supplementary material': 'metadata/supplementary.tex',
      'supplementary materials': 'metadata/supplementary.tex',
      'abbreviations': 'metadata/abbreviations.tex',
    };
    const normalizeSection = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const emittedBackMatter = new Set<string>();

    let i2 = 0;
    while (i2 < (doc.body || []).length) {
      const node = doc.body[i2];
      if (node.type === 'heading') {
        const headingNorm = normalizeSection(node.text || '');
        const targetFile = backMatterTitles[headingNorm];
        if (targetFile && !emittedBackMatter.has(targetFile)) {
          // Collect all paragraph content following this heading until the next heading
          const contentNodes: string[] = [];
          let j = i2 + 1;
          while (j < doc.body.length && doc.body[j].type !== 'heading') {
            const cn = doc.body[j];
            if (cn.type === 'paragraph' && cn.text) {
              contentNodes.push(LatexAssembler.escape(cn.text, mathBlocks));
            }
            j++;
          }
          const sectionLabel = (node.text || '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
          const content = `\\section*{${LatexAssembler.escapeText(sectionLabel, mathBlocks)}}\n${contentNodes.join('\n\n')}`;
          files[targetFile] = content;
          header.push(`\\input{${targetFile}}`);
          emittedBackMatter.add(targetFile);
        }
      }
      i2++;
    }

    // --- 6. BIBLIOGRAPHY ---
    if (doc.references.length > 0) {
      const bibItems: string[] = [];
      const seenKeys = new Set<string>();

      doc.references.forEach((ref, idx) => {
        const cleanRef = ref.replace(/^(?:\[\d+\][.:\s\t]*|\d+[.:\s\t]+)/, '');
        const escapedRef = LatexAssembler.escape(cleanRef, mathBlocks, { skipCitations: true, isBibItem: true });
        const primaryKey = `ref${idx + 1}`;
        bibItems.push(`\\bibitem{${primaryKey}} ${escapedRef}`);
        seenKeys.add(primaryKey);

        // Generate author-year alias key if reference contains author & year (e.g. Smith2020)
        const authorMatch = cleanRef.match(/^([A-Z][a-zA-Z\u00C0-\u017F\-']+)/);
        const yearMatch = cleanRef.match(/\b(19|20)\d{2}\b/);
        if (authorMatch && yearMatch) {
          const aliasKey = `${authorMatch[1]}${yearMatch[0]}`;
          if (!seenKeys.has(aliasKey)) {
            bibItems.push(`\\bibitem{${aliasKey}} ${escapedRef}`);
            seenKeys.add(aliasKey);
          }
        }
      });
      const bibPrefix = isNature ? "\\renewcommand{\\refname}{References}\n" : "";
      const bibContent = `\n${bibPrefix}\\begin{thebibliography}{99}\n${bibItems.join('\n')}\n\\end{thebibliography}`;
      files['references/bibliography.tex'] = bibContent;
      header.push("\\input{references/bibliography.tex}");
    }

    header.push("\\end{document}");

    return {
      mainTex: [...preamble, ...header].join("\n"),
      files
    };
  }

  // Patterns that indicate a generic/bad AI-generated image description (alt-text)
  private static GENERIC_ALT_PATTERNS = [
    /^a graph of a graph/i,
    /^a (graph|chart|diagram|plot|picture|image|photo|screenshot|figure) (of|showing|depicting|illustrating)/i,
    /^an? (graph|chart|diagram|plot|picture|image|photo|screenshot|figure) (of|showing|depicting|illustrating)/i,
    /^(graph|chart|diagram|plot) showing/i,
    /^a (red|blue|green|black|white) (and|or|colored|colour)/i,
  ];

  public static isGenericAltText(caption: string): boolean {
    const lower = caption.trim().toLowerCase();
    return LatexAssembler.GENERIC_ALT_PATTERNS.some(p => p.test(lower));
  }

  public static cleanFigureCaption(rawCaption: string): string {
    if (!rawCaption) return '';
    
    // Universally remove AI-generated disclaimers and normalize spacing/newlines
    let cleaned = rawCaption.replace(/(?:AI[- ]generated content may be incorrect\.?)/gi, '').trim();
    cleaned = cleaned.replace(/\s*\n\s*/g, '\n').replace(/\n+/g, '\n').trim();

    // UNIVERSAL GENERIC ALT-TEXT RECOVERY:
    // Word/DOCX images often have alt-text like "A graph of a graph with red and blue lines"
    // followed by the real caption on a new line (e.g. "\nFigure 5. Impact of changing...").
    // When the first line is a generic description, try to use the second line instead.
    if (LatexAssembler.isGenericAltText(cleaned)) {
      const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        // Try to find a non-generic, non-empty subsequent line
        for (let i = 1; i < lines.length; i++) {
          if (!LatexAssembler.isGenericAltText(lines[i]) && lines[i].length > 10) {
            cleaned = lines[i];
            break;
          }
        }
      }
    }
    
    const cleanPattern = /^(?:Figure|Fig\.?|Image|Photo|Chart|Diagram|Table|Tab\.?|TABLE)\s*(?:[\dIVX\.\-A-Z]+)?\s*[:\.\-–—]?\s*/i;
    const stripped = cleaned.replace(cleanPattern, '').trim();
    return stripped.length > 0 ? stripped : '';
  }

  public static assembleNode(node: ContentNode, mathBlocks: any[]): string {
    switch (node.type) {
      case 'heading': {
        const rawText = node.text || "Untitled Section";
        const isStarred = (node as any).sectionStyle === 'starred';
        
        // Comprehensive prefix stripping: removes "1. ", "1.1 ", "Section 1: ", "A. ", "I. ", "1.1.1 - "
        // to prevent double-numbering in compiled PDFs across all templates.
        let finalText = rawText.trim();
        const headingPrefix = /^(?:\s*(?:section|subsection|subsubsection|chapter|appendix|part)\s+)?(?:\[?\s*(?:\d+|[ivxlcdm]+|[a-z])(?:\.(?:\d+|[ivxlcdm]+|[a-z]))*\s*\]?\.?[:.\-–—\s)]+)+/i;
        
        if (headingPrefix.test(finalText)) {
          const cleanText = finalText.replace(headingPrefix, "").trim();
          if (cleanText.length >= 2) finalText = cleanText;
        }
        
        // 🛡️ FORCED LEVEL-1: canonical academic section names always use \section
        const FORCED_L1 = new Set([
          'abstract','introduction','background','related work','literature review',
          'methodology','proposed method','proposed approach','proposed framework',
          'experimental setup','experiments','results','results and discussion',
          'discussion','conclusion','conclusions','acknowledgements','acknowledgments',
          'references','bibliography','appendix','future work',
          'system model','system overview','problem formulation',
          'problem statement','performance evaluation','evaluation','simulation results',
          'comparison','related works',
          'declarations','ethics approval','ethical approval','ethics statement',
          'conflict of interest','conflicts of interest','competing interests',
          'funding','funding statement','funding information',
          'data availability','data availability statement','availability of data',
          'authors contributions','author contributions','contributors',
          'supplementary material','supplementary materials','supplementary information',
          'limitations','study limitations','abbreviations',
          'consent to participate','consent for publication','informed consent',
          // Universal literature survey variants
          'literature survey','literature review/survey','survey','literature review and survey',
          'existing literature','literature',
        ]);
        const normalizedFinal = finalText.toLowerCase().replace(/^(?:\d+[\s\.]+|[ivxlcdm]+[\s\.]+|[a-g][\s\.]+)+/i, '').trim();
        let level = node.level || 1;
        if (FORCED_L1.has(normalizedFinal)) level = 1;
        
        const cmd = level === 1 ? 'section' : level === 2 ? 'subsection' : 'subsubsection';
        const unnumberedList = [
          'contribution', 'contributions', 'organization', 'organization of paper', 'paper organization', 
          'overview', 'scope', 'outline', 'research contributions', 'main contributions',
          'problem statement', 'problem formulation', 'system model', 'system overview',
          'statements and declarations', 'declarations'
        ];
        const unnumbered = unnumberedList.some(u => normalizedFinal === u || normalizedFinal.startsWith(u));
        return `\n\\${cmd}${isStarred || unnumbered ? '*' : ''}{${LatexAssembler.escapeText(finalText, mathBlocks)}}\n`;
      }

      case 'paragraph': {
        const text = (node.text || "").trim();
        
        // --- LATEXIFY CONTENT SIEVE (Rescue missed components) ---
        
        // 1. PSEUDO-FIGURE DETECTION
        if (text.startsWith('[htbp]') && (text.toLowerCase().includes('.jpg') || text.toLowerCase().includes('.png') || text.toLowerCase().includes('.jpeg'))) {
             const figMatch = text.match(/\[htbp\]\s*(?:\[([^\]]*)\])?\s*([^\s]+\.(?:jpg|png|jpeg|pdf))\s*(.*)/i);
             if (figMatch) {
                 const opts = figMatch[1] || "width=0.9\\linewidth,keepaspectratio";
                 const fileId = figMatch[2].replace(/^assets\//, '');
                 const caption = LatexAssembler.escapeText(figMatch[3] || 'Figure', mathBlocks);
                 const guid = `fig_${Math.random().toString(36).substring(2, 7)}`;
                 return `\n\\begin{figure}[htbp]\n\\centering\n\\zimg{${fileId}}{${opts},max height=0.7\\textheight}{${guid}}{${fileId}}\n\\caption{${caption}}\n\\end{figure}\n`;
             }
        }

        // 2. MISSED EQUATION DETECTION (Lines like "a + b = c (1)")
        const eqMatch = text.match(/^([\s\S]+?)\s*\((\d+)\)$/);
        if (eqMatch && eqMatch[1].includes('=') && eqMatch[1].length < 150) {
             const content = eqMatch[1].trim();
             const label = eqMatch[2];
             return `\n\\begin{equation}\n${LatexAssembler.escapeText(content, mathBlocks)}\n\\label{eq:${label}}\n\\end{equation}\n`;
        }

        // 3. CAPTION-ONLY PARAGRAPH (Rescue missed table/figure titles)
        if (/^(?:Table|Figure|Fig\.|Algorithm)\s+\d+/i.test(text) && text.length < 200) {
             return `\n\\begin{center}\\small\\textit{${LatexAssembler.escapeText(text, mathBlocks)}}\\end{center}\n`;
        }

        const mathMatch = text.match(/MATHBLOCKX(\d+)XMARKER/i);
        const isStandaloneMath = /^\s*(?:MATHBLOCKX\d+XMARKER\s*|(?:\(\d+(?:\.\d+)*\)|\[\d+(?:\.\d+)*\])\s*|[,.:;]\s*)+$/i.test(text);
        if (mathMatch && isStandaloneMath) {
            const idx = parseInt(mathMatch[1]);
            const entry = mathBlocks[idx];
            const raw = typeof entry === 'string' ? entry : (entry?.latex || "");
            
            let assembledEq = '';
            // 🛡️ DEDUP: If mathBlock already has equation env, emit bare (no extra wrapper)
            if (raw.includes('\\begin{equation') || raw.includes('\\begin{align') || raw.includes('\\[')) {
                assembledEq = raw;
            } else {
                const inner = raw.trim().replace(/^\$+|\$+$/g, '').trim().replace(/^\\begin\{equation\}|\\end\{equation\}$/g, '').trim();
                assembledEq = `\\begin{equation}\n${inner}\n\\end{equation}`;
            }

            const before = text.substring(0, mathMatch.index!).trim();
            const after = text.substring(mathMatch.index! + mathMatch[0].length).trim();
            
            let resultTex = '';
            if (before) {
                resultTex += before + ' ';
            }
            resultTex += `\n${assembledEq}\n`;
            if (after) {
                resultTex += ' ' + after;
            }
            return `\n${resultTex}\n`;
        }
        return `\n\n${LatexAssembler.escapeText(node.text || "", mathBlocks)}\n\n`;

      }
      case 'table':
        return LatexAssembler.assembleTable(node, mathBlocks);
      case 'image': {
        const rawId = String(node.id || "image").replace(/\\/g, '/');
        const fileId = rawId.replace(/^assets\//, '') || "image";
        const guid = `img_${Math.random().toString(36).substring(2, 7)}`;
        return `\n\\begin{figure}[H]\n\\centering\n\\zimg{${fileId}}{width=0.9\\linewidth,max height=0.7\\textheight,keepaspectratio}{${guid}}{${fileId}}\n\\end{figure}\n`;
      }
      case 'figure': {
        const rawId = String(node.id || 'figure').replace(/\\/g, '/');
        const fileId = rawId.replace(/^assets\//, '') || 'figure';
        const rawCaption = node.caption || 'Figure';
        const cleaned = LatexAssembler.cleanFigureCaption(rawCaption);
        const caption = LatexAssembler.escapeText(cleaned.length > 0 ? cleaned : 'Figure', mathBlocks);
        const labelIdx = (node as any).labelIdx ?? Math.random().toString(36).substring(2, 7);
        const label = `fig:${String(labelIdx).replace(/[^a-z0-9]/gi, '_')}`;
        const guid = `fig_${String(labelIdx).replace(/[^a-z0-9]/gi, '_')}`;
        return `\n\\begin{figure}[H]\n\\centering\n\\zimg{${fileId}}{width=0.9\\linewidth,max height=0.7\\textheight,keepaspectratio}{${guid}}{${fileId}}\n\\caption{${caption}}\n\\label{${label}}\n\\end{figure}\n`;
      }
      case 'chart': {
        const rawId = String(node.id || 'chart').replace(/\\/g, '/');
        const fileId = rawId.replace(/^assets\//, '') || 'chart';
        const rawCaption = node.caption || 'Chart';
        const cleaned = LatexAssembler.cleanFigureCaption(rawCaption);
        const caption = LatexAssembler.escapeText(cleaned.length > 0 ? cleaned : 'Chart', mathBlocks);
        const labelIdx = (node as any).labelIdx ?? Math.random().toString(36).substring(2, 7);
        const label = `chart:${String(labelIdx).replace(/[^a-z0-9]/gi, '_')}`;
        const guid = `chart_${String(labelIdx).replace(/[^a-z0-9]/gi, '_')}`;
        return `\n\\begin{figure}[H]\n\\centering\n\\zimg{${fileId}}{width=0.9\\linewidth,max height=0.7\\textheight,keepaspectratio}{${guid}}{${fileId}}\n\\caption{${caption}}\n\\label{${label}}\n\\end{figure}\n`;
      }
      case 'figure-group':
        return LatexAssembler.assembleFigureGroup(node, mathBlocks);
      case 'algorithm':
        return LatexAssembler.assembleAlgorithm(node, mathBlocks);
      case 'equation': {
        const latex = (node.latex || "").trim();
        if (!latex) return "";
        let finalContent = latex;
        // Strip wrapping $ signs if present
        if (finalContent.startsWith('$') && finalContent.endsWith('$')) finalContent = finalContent.slice(1, -1).trim();

        // UNIVERSAL: Suppress stray sub-figure position markers like (a), (b), (c), (d)
        // that appear in the LaTeX source when sub-figures are labeled by letter.
        // These originate from Word documents where "(a)  (b)" follows a figure group.
        if (/^\s*(?:\([a-z]\)\s*){1,6}$/.test(finalContent.trim()) || /^\([a-z]\)\s+\([a-z]\)/.test(finalContent.trim())) {
          return ''; // Drop these — they're display artifacts, not real equations
        }
        
        // UNROLL MARKERS: Equations might still have markers from the parser
        finalContent = finalContent.replace(/MATHBLOCKX(\d+)XMARKER/g, (match, idx) => {
            const entry = mathBlocks[parseInt(idx)];
            return typeof entry === 'string' ? entry : (entry?.latex || "");
        });

        // Strip trailing plaintext equation numbers like (1), [1], \left( 3 \right), \tag{3} universally
        // MUST run before environment wrapping checks to ensure accurate regex matches at end of string.
        let labelStr = '';
        const trailingNumMatch = finalContent.match(/(?:\\hfill|\\quad|\\qquad|&|\s)*\s*(?:\(\s*(\d+(?:\.\d+)?)\s*\)|\[\s*(\d+(?:\.\d+)?)\s*\]|\\left\(\s*(\d+(?:\.\d+)?)\s*\\right\)|\\left\[\s*(\d+(?:\.\d+)?)\s*\\right\]|\\tag\{\s*(\d+(?:\.\d+)?)\s*\}\s*)\s*(?:\*|\s)*$/s);
        if (trailingNumMatch) {
            finalContent = finalContent.substring(0, trailingNumMatch.index).trim();
            const labelVal = trailingNumMatch[1] || trailingNumMatch[2] || trailingNumMatch[3] || trailingNumMatch[4] || trailingNumMatch[5];
            labelStr = `\\label{eq:${labelVal}}\n`;
        }

        // Strip wrapping environment and get bare equation content
        let envWrapper = '';
        const envMatch = finalContent.match(/^\\begin\{([a-gh-z]+[*]?)\}([\s\S]*?)\\end\{\1\}\s*$/);
        if (envMatch) {
            envWrapper = envMatch[1];
            finalContent = envMatch[2].trim();
        } else {
            const displayMatch = finalContent.match(/^\\\[([\s\S]*?)\\\]\s*$/) || finalContent.match(/^\$\$([\s\S]*?)\$\$\s*$/);
            if (displayMatch) {
                envWrapper = 'display';
                finalContent = displayMatch[1].trim();
            }
        }

        // Force conversion of \[ ... \] or $$ ... $$ to standard format
        finalContent = finalContent.replace(/^\\\[|\\\]$|^\$\$|\$\$$/g, '').trim();

        const lines = finalContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const activeEnv = envWrapper || 'equation';
        if (lines.length > 1 && activeEnv !== 'display') {
            return `\n\\begin{${activeEnv}}\n\\begin{aligned}\n${lines.join(' \\\\\n')}\n\\end{aligned}\n${labelStr}\\end{${activeEnv}}\n`;
        } else if (activeEnv === 'display') {
            return `\n\\[\n${finalContent}\n${labelStr}\\]\n`;
        } else {
            return `\n\\begin{${activeEnv}}\n${finalContent}\n${labelStr}\\end{${activeEnv}}\n`;
        }
      }

      case 'list': {
        const env = (node as any).listType === 'enumerate' ? 'enumerate' : 'itemize';
        // UNIVERSAL: Filter stray single-letter list items like "(b)" that are sub-figure position markers
        const filteredItems = (node.items || []).filter(item => {
          const clean = item.trim();
          // Suppress items that are ONLY a sub-figure letter label: "(a)", "(b)", "(c)", "(d)"
          if (/^\([a-zA-Z]\)$/.test(clean)) return false;
          // Suppress items that are ONLY letter-label sequences: "(a)  (b)"
          if (/^(?:\([a-zA-Z]\)\s*){1,6}$/.test(clean)) return false;
          // Suppress effectively empty items
          if (clean.length < 2) return false;
          return true;
        });
        if (filteredItems.length === 0) return '';
        return `\\begin{${env}}\n${filteredItems.map(item => `  \\item ${LatexAssembler.escapeText(item, mathBlocks)}`).join("\n")}\n\\end{${env}}`;
      }
      default:
        return "";
    }
  }

  static assembleTable(node: ContentNode, mathBlocks: any[]): string {
    if (!node.html) return '';
    const rowsMatch = node.html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    const rows = rowsMatch ? Array.from(rowsMatch) : [];
    if (rows.length === 0) return '';

    // Detect number of columns from widest row
    let totalGridCols = 0;
    for (const row of rows) {
      const cells = row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) || [];
      let cols = 0;
      cells.forEach(c => {
        const m = c.match(/colspan=["'](\d+)["']/i);
        cols += m ? parseInt(m[1]) : 1;
      });
      if (cols > totalGridCols) totalGridCols = cols;
    }
    if (totalGridCols === 0) return '';

    if (rows.length > 0) {
      const firstRowCells = rows[0].match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) || [];
      if (firstRowCells.length === 1) {
        const text = firstRowCells[0].replace(/<[^>]+>/g, '').trim();
        if (/^(?:Table|Tab\.|TABLE)\s*[\dIVX\.\-A-Z]+/i.test(text)) {
           node.caption = node.caption ? node.caption : text;
           rows.shift(); // Remove caption row
        }
      }
    }

    if (rows.length === 0) return '';

    // Measure max content length per column to decide column type
    const colMaxLen = Array(totalGridCols).fill(0);
    rows.forEach(row => {
      const cells = row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) || [];
      let curCol = 0;
      cells.forEach(c => {
        const colspan = parseInt(c.match(/colspan=["'](\d+)["']/i)?.[1] || '1');
        const text = c.replace(/<[^>]+>/g, '').trim();
        const effectiveCol = Math.min(curCol, totalGridCols - 1);
        if (text.length > colMaxLen[effectiveCol]) colMaxLen[effectiveCol] = text.length;
        curCol += colspan;
      });
    });

    // Column spec: X for long text, c for short
    let spec = colMaxLen.map(len => len > 15 ? '>{\\raggedright\\arraybackslash}X' : 'c').join('|');
    // Force at least one wrapping column if table is wide or has X
    if (totalGridCols > 4 || spec.includes('X')) {
      if (!spec.includes('X')) {
        let maxLenIdx = 0;
        let maxLen = -1;
        for (let idx = 0; idx < colMaxLen.length; idx++) {
          if (colMaxLen[idx] > maxLen) {
            maxLen = colMaxLen[idx];
            maxLenIdx = idx;
          }
        }
        const specsList = colMaxLen.map(() => 'c');
        specsList[maxLenIdx] = '>{\\raggedright\\arraybackslash}X';
        spec = specsList.join('|');
      }
    } else {
      spec = spec.replace('c', '>{\\raggedright\\arraybackslash}X');
    }
    const fullSpec = `|${spec}|`;

    // Build table rows
    const tableRows = rows.map((row, rowIdx) => {
      const cells = row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) || [];
      const isHeader = /<th[^>]*>/i.test(row);
      const rowData: string[] = [];
      let colIdx = 0;

      cells.forEach(c => {
        const colspan = parseInt(c.match(/colspan=["'](\d+)["']/i)?.[1] || '1');
        const inner = c.replace(/<t[hd][^>]*>/i, '').replace(/<\/t[hd]>/i, '').trim();
        const clean = inner.replace(/<[^>]+>/g, '').trim();
        let escaped = isHeader
          ? `\\textbf{${LatexAssembler.escapeText(clean, mathBlocks)}}`
          : LatexAssembler.escapeText(clean, mathBlocks);

        // Resolve math markers AFTER escaping to preserve backslashes!
        escaped = escaped.replace(/MATHBLOCKX(\d+)XMARKER/g, (_m, idx) => {
          const entry = mathBlocks[parseInt(idx)];
          const raw = typeof entry === 'string' ? entry : (entry?.latex || '');
          return (raw.includes('\\begin{equation}') || raw.includes('$')) ? raw : `$${raw}$`;
        });

        if (colspan > 1) {
          const mcSpec = colIdx === 0 ? `|c|` : `c|`;
          rowData.push(`\\multicolumn{${colspan}}{${mcSpec}}{${escaped}}`);
        } else {
          rowData.push(escaped);
        }
        colIdx += colspan;
      });

      // Pad missing cells
      while (colIdx < totalGridCols) { rowData.push(''); colIdx++; }

      const hasContent = rowData.some(d => d.replace(/\\multicolumn.*/, '').replace(/&/g,'').trim().length > 0);
      if (!hasContent) return null; // skip completely empty rows

      const hline = (rowIdx === 0 || isHeader) ? ' \\hline' : ' \\hline';
      return rowData.join(' & ') + ' \\\\' + hline;
    }).filter(Boolean).join('\n');

    // UNIVERSAL TABLE CAPTION CLEANING:
    // Strip duplicate "Table N" label prefixes and AI disclaimers universally
    let cleanedCaption = (node.caption || '').trim();
    if (cleanedCaption) {
      cleanedCaption = LatexAssembler.cleanFigureCaption(cleanedCaption);
    }
    const caption = LatexAssembler.escapeText(cleanedCaption.length > 1 ? cleanedCaption : `Data Table`, mathBlocks);
    const labelKey = `tab:${caption.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)}`;

    // Force tabularx line-wrapping for all multi-column or text-bearing tables to prevent right-margin overflow
    const useTabularx = true;
    const twoColWide = (node as any).twoColumn === true && (totalGridCols > 2 || colMaxLen.some(l => l > 30));
    const tableEnv = twoColWide ? 'table*' : 'table';
    const tablePlacement = twoColWide ? '[t]' : '[H]';
    const tabularEnv = 'tabularx';
    const widthParam = twoColWide ? '{\\textwidth}' : '{\\linewidth}';
    const activeSpec = fullSpec;

    return `\n\\begin{${tableEnv}}${tablePlacement}\n\\centering\n\\caption{${caption}}\n\\label{${labelKey}}\n\\renewcommand{\\arraystretch}{1.3}\n\\begin{adjustbox}{max width=${twoColWide ? '\\textwidth' : '\\linewidth'}}\n\\begin{${tabularEnv}}${widthParam}{${activeSpec}}\n\\hline\n${tableRows}\n\\end{${tabularEnv}}\n\\end{adjustbox}\n\\end{${tableEnv}}\n`;
  }


  // ──────────────────────────────────────────────────────────────
  // UNIVERSAL FIGURE-GROUP ASSEMBLER
  // Works for ALL templates:
  //  - Single-column: \begin{figure} with \begin{minipage} pairs
  //  - Two-column (IEEE/ACM): \begin{figure*} spans both columns
  // Falls back to single figure for 1 image.
  // ──────────────────────────────────────────────────────────────
  static assembleFigureGroup(node: ContentNode, mathBlocks: any[]): string {
    const images = (node.images || []) as Array<{ src: string; caption: string }>;
    if (images.length === 0) return '';

    if (images.length === 1) {
      const single = images[0];
      const fileId = (single.src || 'figure').replace(/^assets\//, '');
      const rawCap = single.caption || '';
      const cleanedCap = LatexAssembler.cleanFigureCaption(rawCap);
      const cap = cleanedCap ? `\\caption{${LatexAssembler.escapeText(cleanedCap, mathBlocks)}}\n` : '';
      const guid = `fig_${Math.random().toString(36).substring(2, 7)}`;
      return `\n\\begin{figure}[htbp]\n\\centering\n\\zimg{${fileId}}{width=0.9\\linewidth,max height=0.7\\textheight,keepaspectratio}{${guid}}{${fileId}}\n${cap}\\end{figure}\n`;
    }

    // Two-column templates (IEEE/ACM) use figure* to span both columns
    const twoCol = (node as any).twoColumn === true;
    const figEnv = twoCol ? 'figure*' : 'figure';

    // Width fraction per image
    const n = Math.min(images.length, 4);
    const widthFrac = n === 2 ? '0.48' : n === 3 ? '0.32' : '0.23';

    const subfigures = images.map((img, i) => {
      const fileId = (img.src || `figure_${i}`).replace(/^assets\//, '');
      // UNIVERSAL: Truncate very long subfigure captions (>150 chars) to avoid wall-of-text captions.
      // Long image captions (e.g. full explanation paragraphs) should go in the overall caption.
      const rawSubCap = img.caption || '';
      let cleanedSubCap = LatexAssembler.cleanFigureCaption(rawSubCap);
      
      // Strip any residual subfigure prefixes like (a), [a], a), a. universally (including with spaces)
      let prevSubCap = '';
      while (prevSubCap !== cleanedSubCap) {
        prevSubCap = cleanedSubCap;
        cleanedSubCap = cleanedSubCap.replace(/^\s*(?:\(\s*[a-zA-Z0-9]\s*\)|\[\s*[a-zA-Z0-9]\s*\]|\b[a-zA-Z0-9]\s*\)|\b[a-zA-Z0-9]\s*\.)\s*[:.\-–—]?\s*/i, '').trim();
      }
      
      // UNIVERSAL GENERIC SUPPRESSION: Don't emit generic AI alt-text as subfigure captions.
      // The overall figure caption will carry the correct description via the fallback mechanism.
      const isGeneric = LatexAssembler.isGenericAltText(cleanedSubCap);
      const subCap = (!isGeneric && cleanedSubCap.length > 150)
        ? cleanedSubCap.substring(0, cleanedSubCap.indexOf(' ', 120) || 120) + '...'
        : (isGeneric ? '' : cleanedSubCap);
      const capLine = subCap
        ? `  \\caption{${LatexAssembler.escapeText(subCap, mathBlocks)}}\n`
        : '';
      const guid = `fg_${i}_${Math.random().toString(36).substring(2, 7)}`;
      const maxSubH = n <= 2 ? '0.4\\textheight' : '0.3\\textheight';
      return [
        `\\begin{subfigure}[b]{${widthFrac}\\linewidth}`,
        `  \\centering`,
        `  \\zimg{${fileId}}{width=\\linewidth,max height=${maxSubH},keepaspectratio}{${guid}}{${fileId}}`,
        capLine ? `${capLine}` : '',
        `\\end{subfigure}`,
      ].filter(Boolean).join('\n');
    });

    // UNIVERSAL CAPTION DEDUPLICATION:
    // The overall caption is often joined from multiple identical sub-captions like "cap and cap and cap".
    // We detect this and collapse it to just the first unique part.
    let overallCaption = ((node as any).caption || '') as string;
    if (overallCaption) {
      // Split on " and " and take the first unique segment
      const parts = overallCaption.split(/ and (?=[A-Z])/g).map((p: string) => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        // Check if all parts are identical (or near-identical)
        const firstPart = parts[0];
        const allSame = parts.every((p: string) => p === firstPart || p.startsWith(firstPart.substring(0, Math.min(40, firstPart.length))));
        overallCaption = allSame ? firstPart : overallCaption;
      }
      overallCaption = LatexAssembler.cleanFigureCaption(overallCaption);
    }
    // UNIVERSAL GENERIC CAPTION FALLBACK:
    // If the resolved overall caption is still a generic/bad AI alt-text description,
    // fall back to the best (longest non-generic) subfigure caption available.
    if (!overallCaption || LatexAssembler.isGenericAltText(overallCaption)) {
      const subCaps = images.map(img => LatexAssembler.cleanFigureCaption(img.caption || '')).filter(c => c.length > 10 && !LatexAssembler.isGenericAltText(c));
      if (subCaps.length > 0) {
        // Take the longest good subfigure caption as the overall caption
        overallCaption = subCaps.reduce((a, b) => a.length >= b.length ? a : b, '');
      }
    }
    const capLine = overallCaption
      ? `\\caption{${LatexAssembler.escapeText(overallCaption, mathBlocks)}}\n`
      : '';
    const labelSuffix = Math.random().toString(36).substring(2, 7);

    return [
      `\n\\begin{${figEnv}}[htbp]`,
      `\\centering`,
      subfigures.join('\n\\hfill\n'),
      capLine,
      `\\label{fig:group_${labelSuffix}}`,
      `\\end{${figEnv}}\n`,
    ].filter(Boolean).join('\n');
  }

  static assembleAlgorithm(node: ContentNode, mathBlocks: any[]): string {
    const steps = node.items || (node as any).steps || [];
    const rawTitle = (node.title || node.text || '').trim();

    // GUARD: If no steps AND title matches a canonical section name, emit as \section
    const SECTION_NAMES = new Set([
      'introduction','methodology','methods','results','discussion','conclusion','conclusions',
      'abstract','background','related work','experiments','experimental setup','references',
      'acknowledgements','acknowledgments','literature review','future work','appendix',
      // Universal literature survey variants
      'literature survey','literature review/survey','survey','literature review and survey',
      'existing literature','literature','related works',
    ]);
    const titleLowerGuard = rawTitle.toLowerCase().replace(/^\d+[\s.]+/, '').trim();
    const hasNoSteps = steps.length === 0 && !node.text?.trim();
    if (hasNoSteps && SECTION_NAMES.has(titleLowerGuard)) {
      console.warn(`[ASSEMBLER] Correcting misclassified algorithm node to section: "${rawTitle}"`);
      return `\n\\section{${LatexAssembler.escapeText(rawTitle, mathBlocks)}}\n`;
    }

    let title = rawTitle;
    // The title now contains the description AFTER the label prefix (e.g. "Energy-Efficient Protocol")
    // Only suppress if: (a) it's just the raw label like "Algorithm I:" with nothing after, or
    //                   (b) it's a long prose sentence (> 120 chars starting with "This/The/In/We")
    if (title.length > 120 && /^(?:This|The|In|We)\s+/i.test(title)) title = "";
    else if (/^(?:Algorithm|Alg\.?|Listing|Pseudo-?code|Procedure|Step|Logic|Process)\s*[\dIVX\.]*\s*[:\.\-]*\s*$/i.test(title)) title = ""; // pure label, no desc
    const escapedTitle = LatexAssembler.escapeText(title, mathBlocks);

    let rawLines = steps;
    if (rawLines.length === 0 && node.text) {
        rawLines = node.text.split("\n");
    } else if (rawLines.length === 0 && (node as any).content) {
        rawLines = (node as any).content.split("\n");
    }
    
    // Split combined Input/Output lines (e.g. Input: ... Output: ...)
    const processedLines: string[] = [];
    rawLines.forEach((line: string) => {
        const match = line.match(/^(Input:\s*[\s\S]*?)(?:\b|\w+)(Output:\s*[\s\S]*)$/i);
        if (match) {
            processedLines.push(match[1].trim());
            processedLines.push(match[2].trim());
        } else {
            processedLines.push(line);
        }
    });
    rawLines = processedLines;
    
    // Preserve leading spaces for indentation detection, trim only trailing spaces
    rawLines = rawLines.map((l: string) => l.replace(/\s+$/, '')).filter(Boolean);
    
    const items = rawLines.map((line: string) => {
        const leadingSpaces = line.match(/^\s*/)?.[0].length || 0;
        const cleaned = line.trim().replace(/^[_\-=]{3,}$/, "").replace(/^[_\-=]{3,}/, "").replace(/[_\-=]{3,}$/, "");
        if (!cleaned.trim()) return null;
        
        // Skip lines that are exactly the title or just repeating "Algorithm X"
        const lowerRaw = cleaned.toLowerCase();
        if (lowerRaw === title.toLowerCase() || /^(?:algorithm|pseudo-?code|listing|procedure)\s*[\dIVX\.]*$/i.test(lowerRaw)) return null;

        let cleanLine = cleaned.replace(/^\d+[\.\s]*/, '').trim();

        // Check for Input/Output keywords to use \Require / \Ensure
        let isRequire = false;
        let isEnsure = false;
        if (/^input:\s*/i.test(cleanLine)) {
            isRequire = true;
            cleanLine = cleanLine.replace(/^input:\s*/i, '');
        } else if (/^output:\s*/i.test(cleanLine)) {
            isEnsure = true;
            cleanLine = cleanLine.replace(/^output:\s*/i, '');
        }

        const escaped = LatexAssembler.escapeText(cleanLine, mathBlocks);
        
        // Beautiful bold formatting for common algorithmic keywords
        const formatted = escaped
            .replace(/\b(if|then|else\s+if|elseif|else|endif|end\s+if|for|to|do|end\s+for|endfor|while|end\s+while|endwhile|repeat|until|return|input|output|data|result|ensure|require|procedure|function|begin|end)\b/gi, '\\textbf{$1}');

        // Structural Unrolling: Algorithm State math recovery
        const unrolled = formatted.replace(/MATHBLOCKX(\d+)XMARKER/g, (match, idx) => {
            const entry = mathBlocks[parseInt(idx)];
            const raw = typeof entry === 'string' ? entry : (entry?.latex || "");
            return (raw.includes('\\begin{equation}') || raw.includes('$')) ? raw : `$${raw}$`;
        });

        // Convert leading spaces to LaTeX horizontal space (preserves indentation perfectly!)
        const indentLevel = Math.floor(leadingSpaces / 2);
        const indentStr = indentLevel > 0 ? `\\hspace*{${indentLevel * 0.4}cm}` : '';

        if (isRequire) {
            return `\\Require ${indentStr}${unrolled}`;
        } else if (isEnsure) {
            return `\\Ensure ${indentStr}${unrolled}`;
        }

        return `\\State ${indentStr}${unrolled}`;
    }).filter(Boolean);
    
    const algoEnv = (node as any).twoColumn ? 'algorithm*' : 'algorithm';
    const placement = (node as any).twoColumn ? 't' : 'H'; // Force H to guarantee perfect ordering!

    const algoBody = `\n\\begin{${algoEnv}}[${placement}]\n\\caption{${escapedTitle}}\n\\begin{adjustbox}{max width=\\linewidth}\n\\begin{minipage}{\\linewidth}\n\\begin{algorithmic}[1]\n${items.join('\n')}\n\\end{algorithmic}\n\\end{minipage}\n\\end{adjustbox}\n\\end{${algoEnv}}\n`;
    return algoBody;
  }

  private static escapeText(text: string, mathBlocks: any[]): string {
    const escaped = LatexAssembler.escape(text, mathBlocks);
    // Only escape underscores outside of math blocks
    return escaped.replace(/(?<!\\)_(?![^$]*\$)/g, '\\_');
  }

  static escape(text: string, mathBlocks: any[], options?: { skipCitations?: boolean, isBibItem?: boolean }): string {
    if (!text) return "";

    // ATOMIC SYMBOL & MATH PRESERVATION
    const symbolMap = new Map<string, string>();
    
    // 🛡️ UNICODE ENHANCEMENT: Handle common scholarly symbols
    const EXTENDED_GREEK = { 
      ...GREEK_MAP, 
      '\u207B': '^{-}', 
      '\u025B': 'epsilon', 
      '\u2126': 'Omega', 
      '\u2212': '-',
      '\u03BC': 'mu',
      '\u03A9': 'Omega',
      '\u00B0': 'circ',
      '\u00B1': 'pm',
      '\u2264': 'le',
      '\u2265': 'ge',
      '\u2248': 'approx',
      '\u221E': 'infty',
      '\u2192': 'to',
      '\u00B9': '^{1}',
      '\u00B2': '^{2}',
      '\u00B3': '^{3}',
      '\u2070': '^{0}',
      '\u2074': '^{4}',
      '\u2075': '^{5}',
      '\u2076': '^{6}',
      '\u2077': '^{7}',
      '\u2078': '^{8}',
      '\u2079': '^{9}',
      '\u2071': '^{i}',
      '\u207A': '^{+}',
      '\u207C': '^{=}',
      '\u207D': '^{(',
      '\u207E': '^{)}',
      '\u2080': '_{0}',
      '\u2081': '_{1}',
      '\u2082': '_{2}',
      '\u2083': '_{3}',
      '\u2084': '_{4}',
      '\u2085': '_{5}',
      '\u2086': '_{6}',
      '\u2087': '_{7}',
      '\u2088': '_{8}',
      '\u2089': '_{9}',
      '\u208A': '_{+}',
      '\u208B': '_{-}',
      '\u2215': '/',
      '\u2010': '-'
    };
    
    for (const [char, cmd] of Object.entries(EXTENDED_GREEK)) {
      if (text.includes(char)) {
        const id = `G_SYM_${Math.random().toString(36).substring(7).toUpperCase()}`;
        symbolMap.set(id, cmd.startsWith('^') || cmd.startsWith('_') ? `$${cmd}$` : `$\\${cmd.startsWith('\\') ? cmd.substring(1) : cmd}$`);
        text = text.replace(new RegExp(char, 'g'), id);
      }
    }

    // 🌐 URL wrapping for bibitems — ensures long URLs break at hyphens/slashes in printed PDF
    if (options?.isBibItem) {
      text = text.replace(
        /(https?:\/\/[^\s,;.]+(?:\.[^\s,;.]+)*)|(www\.[^\s,;]+)|(\bdoi:\s*10\.\d{4,}[^\s,;.]+)/gi,
        (match) => `\\url{${match.trim()}}`
      );
    }

    // 2. PRIMARY ESCAPE (General LaTeX characters)
    let sanitized = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, "");
    
    // Shield markers before escaping backslashes
    const markers: string[] = [];
    sanitized = sanitized.replace(/MATHBLOCKX(\d+)XMARKER/g, (match) => {
        const id = `__M_ID_${markers.length}__`;
        markers.push(match);
        return id;
    });

    // Shield explicit citation/reference/label commands from double escaping
    const shieldedCommands: string[] = [];
    sanitized = sanitized.replace(/\\(?:cite|ref|eqref|label|cref|Cref|url)(?:\[[^\]]*\])?\{[^}]+\}/g, (match) => {
      const marker = `__CMD_SHIELD_${shieldedCommands.length}__`;
      shieldedCommands.push(match);
      return marker;
    });

    // UNIVERSAL: Shield already-escaped LaTeX special chars from double-escaping.
    // Handles cases where text was previously processed and already contains \%, \&, \$ etc.
    sanitized = sanitized.replace(/\\([%&$#{}_])/g, (match) => {
      const marker = `__CMD_SHIELD_${shieldedCommands.length}__`;
      shieldedCommands.push(match);
      return marker;
    });

    // Escape characters
    sanitized = sanitized.replace(/\\/g, '\\textbackslash ')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\^/g, '\\textasciicircum ')
      .replace(/~/g, '\\textasciitilde ')
      .replace(/</g, '\\textless ')
      .replace(/>/g, '\\textgreater ')
      .replace(/\|/g, '\\textbar ');

    // Fix double-escaped percent: \textbackslash \% -> \% (backslash was already converted above)
    sanitized = sanitized.replace(/\\textbackslash\s+\\%/g, '\\%');

    // Restore shielded commands
    shieldedCommands.forEach((cmd, idx) => {
      sanitized = sanitized.replace(`__CMD_SHIELD_${idx}__`, cmd);
    });

    // Restore markers
    markers.forEach((m, i) => {
        sanitized = sanitized.replace(`__M_ID_${i}__`, m);
    });

    // 3. ACADEMIC CITATION ENGINE
    if (!options?.skipCitations) {
        // Support [1], [1, 2], [1-3] exclusively (numeric patterns) to avoid matching non-citations like [Table 1]
        // Guard against mathematical intervals like [0, 1] or preceding words like interval, range, scale
        sanitized = sanitized.replace(/(?<!\b(?:interval|range|scale|domain|coordinates|matrix|vector|box|bounds|values|pixel|pixels|from|to|between)\s*)\[\s*(\d{1,3}(?:\s*[,;–\-]\s*\d{1,3})*)\s*\]/gi, (match, inner) => {
            const parts = inner.split(/[,;–\-\u2013\u2014]/).map((p: string) => p.trim()).filter(Boolean);
            const hasZero = parts.some((p: string) => p === '0');
            let offset = 0;
            if (hasZero && parts.every((p: string) => /^\d+$/.test(p))) {
                offset = 1;
            }
            const refs = inner.split(/[,;]/).map((r: string) => {
                const trimmed = r.trim();
                if (!trimmed) return null;
                // Handle ranges like [1-3] or [1–3]
                if (/^\d+\s*[-–]\s*\d+$/.test(trimmed)) {
                    const [start, end] = trimmed.split(/[-–]/).map(n => parseInt(n.trim()) + offset);
                    if (!isNaN(start) && !isNaN(end) && start < end && end - start < 20) {
                        return Array.from({ length: end - start + 1 }, (_, i) => `ref${start + i}`).join(',');
                    }
                }
                // Handle single numbers
                if (/^\d+$/.test(trimmed)) return `ref${parseInt(trimmed) + offset}`;
                return null;
            }).filter(Boolean).join(',');
            
            if (!refs) return match;
            return `\\cite{${refs}}`;
        });

        // 3.5 PARENTHETICAL CITATION ENGINE (e.g., (Smith, 2020; Doe et al., 2021))
        // Guard: Check for strict 4-digit years (19xx or 20xx) to avoid false positives on parameters like (n = 50, p < 0.05)
        sanitized = sanitized.replace(/\(([A-Z][a-zA-Z\u00C0-\u017F]+(?: et al\.?)?(?:,\s*|\s+)(?:19|20)\d{2}(?:[a-z])?(?:;\s*[A-Z][a-zA-Z\u00C0-\u017F]+(?: et al\.?)?(?:,\s*|\s+)(?:19|20)\d{2}(?:[a-z])?)*)\)/g, (match, inner) => {
            const refs = inner.split(';').map((p: string) => {
                // Strip non-alphanumeric to create a valid citation key (e.g. "Smithetal2020")
                return p.replace(/[^\w]/g, '');
            }).join(',');
            return `\\cite{${refs}}`;
        });
    } else if (options?.isBibItem) {
        // 🛡️ In Bibliography: strictly strip numeric labels like [1] to avoid double-labeling or cite loops
        sanitized = sanitized.replace(/^\[\s*\d+\s*\][\s\.]*/, "");
    }

    // 4. UNROLL MATH MARKERS
    const seenMath = new Set<string>();
    sanitized = sanitized.replace(/MATHBLOCKX(\d+)XMARKER/g, (match, idx) => {
        const entry = mathBlocks[parseInt(idx)] || "";
        const raw = typeof entry === 'string' ? entry : (entry.latex || "");
        // Strip display equation wrappers → always inline $...$ when inside paragraph text
        const inner = raw
            .replace(/^\\begin\{equation\*?\}/, '').replace(/\\end\{equation\*?\}$/, '')
            .replace(/^\\begin\{align\*?\}/, '').replace(/\\end\{align\*?\}$/, '')
            .replace(/^\\\[/, '').replace(/\\\]$/, '')
            .replace(/^\$\$/, '').replace(/\$\$$/, '')
            .replace(/^\$/, '').replace(/\$$/, '')
            .trim();
        
        if (!inner) return '';
        const normalized = inner.replace(/\s+/g, '');
        if (normalized.length > 5 && seenMath.has(normalized)) return ''; // Cross-marker dedup (only for non-trivial math to avoid stripping simple variables like $x$)
        seenMath.add(normalized);
        return `$${inner}$`;
    });


    // 5. RESTORE PROTECTED SYMBOLS
    symbolMap.forEach((content, id) => {
        sanitized = sanitized.replace(new RegExp(id, 'g'), content);
    });

    // Final cleanup of any potential double-escaped math delimiters
    return sanitized.replace(/\\\$\\textbackslash\s+/g, '$\\').replace(/\$\$+/g, '$');
  }
}

export class ModularLatexAssembler {
  static assemble(doc: StructuredDocument, templateId: string = 'generic', templateMainTex?: string | { hasBibFile?: boolean }): { mainTex: string, files: Record<string, string> } {
    const mathBlocks: any[] = doc.mathBlocks || [];
    const files: Record<string, string> = {};
    
    // Compatibility check for 3rd argument
    let actualTemplateMainTex: string | undefined = undefined;
    if (typeof templateMainTex === 'string') {
        actualTemplateMainTex = templateMainTex;
    }

    // --- DATA-DRIVEN TEMPLATE DISCOVERY ---
    const tpl = getTemplateById(mapTpl(templateId));
    
    // 1. Determine Document Class
    let docClass = "\\documentclass{article}";
    let nativePreamble: string[] = [];

    if (actualTemplateMainTex) {
        const beginDocIdx = actualTemplateMainTex.indexOf('\\begin{document}');
        if (beginDocIdx !== -1) {
            const rawPreamble = actualTemplateMainTex.substring(0, beginDocIdx);
            nativePreamble = rawPreamble.split('\n').filter(line => {
                const l = line.trim();
                return !l.startsWith('\\title') && !l.startsWith('\\author') && !l.startsWith('\\date') && !l.startsWith('\\maketitle') && !l.startsWith('\\affil');
            });
            docClass = ""; // Handled by native preamble
        }
    }

    if (docClass && tpl) {
        if (templateId === 'article_ieee' || tpl.assetFolder === 'ieee') docClass = "\\documentclass[journal]{IEEEtran}";
        else if (templateId === 'article_acm' || tpl.assetFolder === 'acm') docClass = "\\documentclass[nonacm,sigconf]{acmart}";
        else if (templateId === 'article_elsevier' || tpl.assetFolder === 'elsevier') docClass = "\\documentclass[preprint,12pt]{elsarticle}";
        else if (templateId === 'article_lncs' || tpl.publisher === 'Springer') docClass = "\\documentclass{llncs}";
        else if (templateId === 'article_scirep' || tpl.assetFolder === 'scirep') docClass = "\\documentclass[10pt]{wlscirep}";
        else if (tpl.assetFolder === 'nature') docClass = "\\documentclass{nature}";
        else if (tpl.assetFolder === 'aaas') docClass = "\\documentclass{scifile}";
        else if (tpl.assetFolder === 'pnas') docClass = "\\documentclass{pnas-new}";
        else if (tpl.assetFolder === 'plos') docClass = "\\documentclass{plos2015}";
        else if (tpl.assetFolder === 'aps') docClass = "\\documentclass[aps,prl,reprint]{revtex4-2}";
        else if (tpl.category === 'Thesis') docClass = "\\documentclass[12pt]{thesis}";
        else if (tpl.category === 'CV') docClass = "\\documentclass[11pt]{cv}";
        else if (tpl.category === 'Presentation') docClass = "\\documentclass{beamer}";
        else if (tpl.assetFolder) docClass = `\\documentclass{${tpl.assetFolder}}`;
    }

    if (tpl?.assetFolder) {
        const cls = `${tpl.assetFolder}.cls`;
        nativePreamble.push(`\\makeatletter`);
        nativePreamble.push(`\\@ifundefined{ver@${cls}}{}{}`);
        nativePreamble.push(`\\makeatother`);
    }

    const isAcm = templateId.includes('acm') || tpl?.assetFolder === 'acm';
    const isIeee = templateId.includes('ieee') || tpl?.assetFolder === 'ieee' || tpl?.assetFolder === 'ieee_conf';
    const isElsevier = templateId.includes('elsevier') || tpl?.assetFolder === 'elsevier';
    const isLncs = templateId.includes('lncs') || tpl?.publisher === 'Springer';
    const isSciRep = templateId.includes('scirep') || tpl?.assetFolder === 'scirep';
    const isNature = tpl?.assetFolder === 'nature';

    // --- DEDUPLICATED PACKAGE MANAGEMENT ---
    const pkgReg = new PackageRegistry(nativePreamble);
    const preamble: string[] = ["\\nonstopmode"];
    const metadataDeclarations: string[] = [];
    
    if (docClass) preamble.push(docClass);
    else if (nativePreamble.length > 0) preamble.push(...nativePreamble);

    // Engine-aware core packages
    preamble.push("\\usepackage{iftex}");
    preamble.push("\\ifxetex");
    preamble.push("  \\usepackage{fontspec}");
    preamble.push("\\else");
    preamble.push("  \\usepackage[T1]{fontenc}");
    preamble.push("  \\usepackage[utf8]{inputenc}");
    preamble.push("\\fi");

    pkgReg.add("amsmath");
    pkgReg.add("amsfonts");
    pkgReg.add("amssymb");
    pkgReg.add("mathrsfs");
    preamble.push("\\allowdisplaybreaks");
    preamble.push("\\emergencystretch 3em");
    
    pkgReg.add("graphicx", "export");
    pkgReg.add("xcolor");
    pkgReg.add("textcomp");
    pkgReg.add("gensymb");
    pkgReg.add("booktabs");
    pkgReg.add("multirow");
    pkgReg.add("array");
    pkgReg.add("tabularx");
    pkgReg.add("adjustbox", "export");
    pkgReg.add("float");
    pkgReg.add("placeins");
    pkgReg.add("rotating");
    pkgReg.add("pdflscape");
    pkgReg.add("microtype");
    pkgReg.add("url");
    pkgReg.add("xurl");
    pkgReg.add("siunitx");
    pkgReg.add("cleveref");

    const mapping = tpl?.mapping || {};
    
    // Standardize to algorithm and algpseudocode because our generator output is always algpseudocode-compatible
    pkgReg.add("algorithm");
    pkgReg.add("algpseudocode");

    // Preamble Extras
    if (mapping.preambleExtras && mapping.preambleExtras.length > 0) {
        preamble.push(...mapping.preambleExtras);
    }

    if (!isIeee && !isAcm && !isElsevier && !isSciRep && !isNature) {
      pkgReg.add("caption");
      pkgReg.add("enumitem");
      pkgReg.add("parskip");
    }

    if (!(isAcm || isSciRep)) {
      pkgReg.add("hyperref", "unicode,colorlinks=true,allcolors=blue,bookmarksnumbered");
    }

    preamble.push(
      "\\graphicspath{{./}{./assets/}{./images/}{./figures/}{../}{../assets/}{../images/}{./figures/}}",
      "\\DeclareGraphicsExtensions{.pdf,.eps,.png,.PNG,.jpg,.JPG,.jpeg,.JPEG,.tif,.tiff,.bmp,.gif,.webp,.avif,.svg,.ico,.heic,.HEIC,.heif,.HEIF}",
      "",
      "% --- UNIVERSAL ASSET RESOLVER (zimg) ---",
      "\\ifdefined\\zimg\\else",
      "  \\newcommand{\\zimg}[4]{%",
      "    \\IfFileExists{#1}{%",
      "      \\csname includegraphics\\endcsname[#2,max height=0.7\\textheight]{#1}%",
      "    }{%",
      "      \\IfFileExists{#1.png}{%",
      "        \\csname includegraphics\\endcsname[#2,max height=0.7\\textheight]{#1.png}%",
      "      }{%",
      "        \\IfFileExists{#1.jpg}{%",
      "          \\csname includegraphics\\endcsname[#2,max height=0.7\\textheight]{#1.jpg}%",
      "        }{%",
      "          \\IfFileExists{assets/#1}{%",
      "            \\csname includegraphics\\endcsname[#2,max height=0.7\\textheight]{assets/#1}%",
      "          }{%",
      "            \\IfFileExists{assets/#1.png}{%",
      "              \\csname includegraphics\\endcsname[#2,max height=0.7\\textheight]{assets/#1.png}%",
      "            }{%",
      "              \\IfFileExists{assets/#1.jpg}{%",
      "                \\csname includegraphics\\endcsname[#2,max height=0.7\\textheight]{assets/#1.jpg}%",
      "              }{%",
      "                \\framebox(\\linewidth,100pt){Missing Image: \\detokenize{#1}}%",
      "              }%",
      "            }%",
      "          }%",
      "        }%",
      "      }%",
      "    }%",
      "  }%",
      "}",
      "\\fi",
      "",
      "% --- UNIVERSAL SUBFIGURE FALLBACK ---",
      "\\catcode`\\@=11",
      "\\@ifundefined{subfigure}{",
      "  \\newcounter{localsubfig}[figure]",
      "  \\newenvironment{subfigure}[2][]{%",
      "    \\begin{minipage}{#2}%",
      "      \\refstepcounter{localsubfig}%",
      "      \\def\\caption##1{%",
      "        \\par\\vspace{5pt}{\\centering\\small(\\alph{localsubfig})~##1\\par}%",
      "      }%",
      "  }{%",
      "    \\end{minipage}%",
      "  }",
      "}{}",
      "\\catcode`\\@=12"
    );

    const authorStyle = mapping.authorStyle || (isAcm ? 'acm' : isIeee ? 'ieee' : isElsevier ? 'elsevier' : isLncs ? 'standard' : 'standard');
    const needsAuthBlk = (authorStyle === 'standard' || authorStyle === 'nature' || authorStyle === 'science') && 
                         !isSciRep && !isNature && !isAcm && !isIeee && !isElsevier && !isLncs;

    if (needsAuthBlk) {
      pkgReg.add("authblk");
      preamble.push("\\renewcommand\\Authfont{\\bfseries\\large}");
      preamble.push("\\renewcommand\\Affilfont{\\itshape\\small}");
      preamble.push("\\setlength{\\affilsep}{1em}");
    }

    // --- 2. METADATA EXTRACTION ---
    const escTitle = LatexAssembler.escape(doc.title || "Research Paper", []);
    files['metadata/title.tex'] = `\\title{${escTitle}}`;
    if (!isElsevier) metadataDeclarations.push(`\\input{metadata/title.tex}`);
    
    const orgs = (doc.organizations || []).map(o => {
      let cleaned = o;
      cleaned = cleaned.replace(/(?:corresponding\s+author\s*:\s*)?[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi, '');
      cleaned = cleaned.replace(/corresponding\s+author\s*:\s*/gi, '');
      cleaned = cleaned.replace(/corresponding\s+author\b/gi, '');
      cleaned = cleaned.split('\n')
                       .map(line => line.trim())
                       .filter(line => {
                          const plain = line.replace(/[,;:\s()]/g, '');
                          return plain.length > 0 && !/^(?:email|e-mail|corresponding|author|contact)$/i.test(plain);
                       })
                       .join(', ')
                       .replace(/,\s*,/g, ',')
                       .replace(/^[\s,]+|[\s,]+$/g, '')
                       .trim();
      return LatexAssembler.escape(cleaned || o, []);
    });
    files['metadata/organizations.json'] = JSON.stringify(doc.organizations, null, 2);
    
    const authorLines = (doc.authors || []).map((a, idx) => {
      const name = LatexAssembler.escape(typeof a.name === 'string' ? a.name : (a as any).text || 'Author', []);

      // Proper affiliation lookup by ID (matches LatexAssembler logic)
      let affil = "Institution";
      if (a.affiliationIds && a.affiliationIds.length > 0) {
        const affilIdx = parseInt(a.affiliationIds[0]) - 1;
        if (!isNaN(affilIdx) && orgs[affilIdx]) {
          affil = orgs[affilIdx];
        } else {
          affil = orgs[idx] || orgs[0] || "Institution";
        }
      } else {
        affil = orgs[idx] || orgs[0] || "Institution";
      }

      const email = a.email ? LatexAssembler.escape(a.email, []) : "";

      if (isAcm) {
        // High-fidelity ACM affiliation mapping
        const parts = affil.split(',').map(p => p.trim());
        const inst = parts[0] || "Institution";
        const city = parts.find(p => p.toLowerCase().includes('delhi') || p.toLowerCase().includes('city')) || "City";
        const country = parts[parts.length - 1] || "Country";
        return `\\author{${name}}${email ? `\\email{${email}}` : ""}\n\\affiliation{\n  \\institution{${inst}}\n  \\city{${city}}\n  \\country{${country}}\n}`;
      }
      if (authorStyle === 'ieee') {
        return `\\IEEEauthorblockN{${name}}\n\\IEEEauthorblockA{${affil}\\\\${email ? `email: ${email}` : ""}}`;
      }
      if (authorStyle === 'science') {
          const id = a.affiliationIds?.[0] || "1";
          return `${name}$^{${id}${a.isCorresponding ? "\\ast" : ""}}$`;
      }
      if (isNature) {
          const id = a.affiliationIds?.[0] || "1";
          return `${name}$^{${id}${a.isCorresponding ? ",*" : ""}}$`;
      }
      if (isLncs) return `${name}${a.affiliationIds?.length ? `\\inst{${a.affiliationIds.join(',')}}` : ""}`;
      if (isElsevier) return `\\author[aff1]{${name}}${email ? `\\email{${email}}` : ""}${a.isCorresponding ? "\\corref{cor1}" : ""}`;
      if (isSciRep || authorStyle === 'nature') {
        const id = a.affiliationIds?.[0] || "1";
        return `\\author[${id}${a.isCorresponding ? ',*' : ''}]{${name}}${email ? `\\email{${email}}` : ""}`;
      }
      const ids = a.affiliationIds?.join(',') || "1";
      return `\\author[${ids}]{${name}}`;
    }).filter(line => line.trim().length > 0);
    files['metadata/authors.tex'] = authorLines.join('\n');

    const fullAuthorsStr = authorLines.join('\n');
    if (authorStyle === 'science') {
        metadataDeclarations.push(`\\input{metadata/authors.tex}`);
        metadataDeclarations.push(`\\date{}`);
        files['metadata/authors.tex'] = `\\author{${authorLines.join(', ')}}\n`;
    } else if (isLncs) {
      metadataDeclarations.push(`\\input{metadata/authors.tex}`);
      files['metadata/authors.tex'] = `\\author{${authorLines.join(' \\and ')}}\n\\institute{${orgs[0] || "Institution"}}`;
    } else if (isElsevier) {
      metadataDeclarations.push(`\\input{metadata/authors.tex}`);
      const elsLines = [...authorLines];
      elsLines.push(`\\affiliation[aff1]{organization={${orgs[0] || "Institution"}}, country={Country}}`);
      if ((doc.authors || []).some(a => a.isCorresponding)) elsLines.push("\\cortext[cor1]{Corresponding author}");
      files['metadata/authors.tex'] = elsLines.join('\n');
    } else if (isAcm) {
      metadataDeclarations.push(`\\input{metadata/authors.tex}`);
      metadataDeclarations.push("\\setcopyright{none}", "\\acmDOI{}", "\\acmISBN{}", "\\acmConference[ArXiv]{Manuscript}{2026}{Source}");
      files['metadata/authors.tex'] = fullAuthorsStr;
    } else if (authorStyle === 'ieee') {
      const cleanAuthors = authorLines.map(a => a.trim()).filter(Boolean);
      metadataDeclarations.push(`\\input{metadata/authors.tex}`);
      files['metadata/authors.tex'] = `\\author{${cleanAuthors.join(' \\and ')}}`;
    } else if (isNature) {
      const cleanAuthors = authorLines.map(a => a.trim()).filter(Boolean);
      metadataDeclarations.push(`\\input{metadata/authors.tex}`);
      
      const corresponding = (doc.authors || []).find(a => a.isCorresponding) || (doc.authors || []).find(a => a.email);
      let thanksStr = "";
      if (corresponding?.email) {
        const emailEsc = LatexAssembler.escape(corresponding.email, []);
        const corrName = typeof corresponding.name === 'string' ? corresponding.name : (corresponding as any).text || 'the corresponding author';
        thanksStr = `\\thanks{Correspondence and requests for materials should be addressed to ${LatexAssembler.escape(corrName, [])} (email: ${emailEsc}).}`;
      }
      files['metadata/authors.tex'] = `\\author{${cleanAuthors.join(' \\& ')}${thanksStr}}`;
      
      const natureAffils = [
        "\\begin{affiliations}",
        ...orgs.map(o => `  \\item ${o}`),
        "\\end{affiliations}"
      ].join('\n');
      files['metadata/affiliations.tex'] = natureAffils;
    } else {
      metadataDeclarations.push(`\\input{metadata/authors.tex}`);
      const stdLines = [...authorLines];
      if (stdLines.length === 0) stdLines.push('\\author{}');
      // UNIVERSAL: Filter organizations that are noise-only (email-only, or starts with 'Email:')
      const EMAIL_RE_ORG = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
      const cleanOrgs = orgs.filter(o => {
        const plain = o.replace(/[\\{}]/g, '').trim();
        // Reject if it's entirely an email address, or starts with "Email:" (noise from deep-parser)
        if (/^Email[:\s]/i.test(plain)) return false;
        if (EMAIL_RE_ORG.test(plain) && plain.replace(EMAIL_RE_ORG, '').replace(/[,;:\s()/]/g, '').length < 5) return false;
        // Reject if it's just punctuation/noise
        if (plain.replace(/[,;:\s()/]/g, '').length < 3) return false;
        return true;
      });
      cleanOrgs.forEach((o, i) => stdLines.push(`\\affil[${i+1}]{${o}}`));
      const corresponding = (doc.authors || []).find(a => a.isCorresponding);
      if (corresponding?.email) stdLines.push(`\\affil[*]{Corresponding author: ${LatexAssembler.escape(corresponding.email, [])}}`);
      files['metadata/authors.tex'] = stdLines.join('\n');
      metadataDeclarations.push("\\date{}");
    }

    const header = ["\\begin{document}"];
    if (authorStyle === 'science') header.push("\\baselineskip24pt");

    // Build abstract & keywords content
    const cleanAbstract = (doc.abstract || "").replace(/^[\s:.\-–—−\u2013\u2014]+/, '').trim();
    const abstractEsc = cleanAbstract ? LatexAssembler.escape(cleanAbstract, mathBlocks) : '';
    const abstractEnv = mapping.abstractEnv || (authorStyle === 'science' ? 'quote' : 'abstract');
    if (abstractEsc) {
      if (isNature) {
        files['metadata/abstract.tex'] = `\\begin{${abstractEnv}}\n\\noindent\\textbf{Abstract}\\par\\vspace{0.5em}\n${abstractEsc}\n\\end{${abstractEnv}}`;
      } else {
        files['metadata/abstract.tex'] = `\\begin{${abstractEnv}}\n${abstractEsc}\n\\end{${abstractEnv}}`;
      }
    }
    const kwText = (doc.keywords || [])
      .map((k: string) => k.replace(/^[\s:.\-–—−\u2013\u2014]+/, '').trim())
      .filter(Boolean)
      .map((k: string) => LatexAssembler.escape(k, mathBlocks))
      .join(isElsevier ? ' \\sep ' : ', ');
    if (kwText) {
       const cmd = mapping.keywordsCmd;
       let kwContent = (isAcm || isSciRep) ? `\\keywords{${kwText}}` : `\n\n\\vspace{1em}\n\\noindent\\textbf{Keywords: } ${kwText}\n\n`;
       if (isIeee || cmd === 'IEEEkeywords') kwContent = `\\begin{IEEEkeywords}\n${kwText}\n\\end{IEEEkeywords}`;
       else if (isElsevier || cmd === 'keyword') kwContent = `\\begin{keyword}\n${kwText}\n\\end{keyword}`;
       files['metadata/keywords.tex'] = kwContent;
    }

    // FRONTMATTER PLACEMENT (Critical for layout fidelity)
    // FRONTMATTER PLACEMENT (Critical for layout fidelity)
    if (isElsevier) {
      const elsAbstract = abstractEsc ? `\\begin{abstract}\n${abstractEsc}\n\\end{abstract}` : '';
      const elsKeywords = kwText ? `\\begin{keyword}\n${kwText}\n\\end{keyword}` : '';
      const frontmatter = [
        '\\begin{frontmatter}',
        `\\input{metadata/title.tex}`,
        `\\input{metadata/authors.tex}`,
        elsAbstract,
        elsKeywords,
        '\\end{frontmatter}'
      ].filter(Boolean).join('\n');
      files['metadata/frontmatter.tex'] = frontmatter;
      header.push('\\input{metadata/frontmatter.tex}');
    } else if (isAcm) {
      // ACM: abstract/keywords MUST come before \maketitle
      if (files['metadata/abstract.tex']) header.push('\\input{metadata/abstract.tex}');
      if (files['metadata/keywords.tex']) header.push('\\input{metadata/keywords.tex}');
      header.push('\\maketitle');
    } else if (isIeee) {
      // IEEE: abstract and keywords in \IEEEtitleabstractindextext, then \maketitle
      const ieeeAbstract = abstractEsc ? `\\begin{abstract}\n${abstractEsc}\n\\end{abstract}` : '';
      const ieeeKeywords = kwText ? `\\begin{IEEEkeywords}\n${kwText}\n\\end{IEEEkeywords}` : '';
      
      if (ieeeAbstract || ieeeKeywords) {
        metadataDeclarations.push(`\\IEEEtitleabstractindextext{\n${ieeeAbstract}\n${ieeeKeywords}\n}`);
        header.push('\\maketitle');
        header.push('\\IEEEdisplaynontitleabstractindextext');
      } else {
        header.push('\\maketitle');
      }
    } else if (isNature) {
      header.push('\\maketitle');
      if (files['metadata/affiliations.tex']) header.push('\\input{metadata/affiliations.tex}');
      if (abstractEsc) header.push('\\input{metadata/abstract.tex}');
      if (kwText) header.push('\\input{metadata/keywords.tex}');
    } else {
      header.push('\\maketitle');
      if (abstractEsc) header.push('\\input{metadata/abstract.tex}');
      if (kwText) header.push('\\input{metadata/keywords.tex}');
    }

    // --- 3. BODY CONTENT & SECTION SPLITTING ---

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const normalizedTitle = normalize(doc.title || "");
    const normalizedAuthors = (doc.authors || []).map(a => normalize(typeof a.name === 'string' ? a.name : (a as any).text || ""));
    const normalizedAbstract = normalize(doc.abstract || "").substring(0, 100);

    let currentSectionNodes: any[] = [];
    let currentSectionTitle = "introduction";
    let sectionIdx = 1;

    const flushSection = () => {
      if (currentSectionNodes.length === 0) return;
      const dedupedNodes: any[] = [];
        for (const n of currentSectionNodes) {
            if (n.type === 'equation') {
                const windowSize = 5;
                const startIdx = Math.max(0, dedupedNodes.length - windowSize);
                const recent = dedupedNodes.slice(startIdx);
                if (recent.some(last => last.type === 'equation' && last.latex === n.latex)) {
                    continue; // skip duplicate equation in close proximity
                }
            }
            // FIX: Figures, tables, and algorithms are NOW placed INLINE at their correct
            // section position instead of being deferred to end-of-document.
            // The assets/figure.tex / table.tex reference files are still generated for the
            // IDE panel, but they are NOT \input'd at the end of main.tex anymore.
            
            if (n.type === 'paragraph') {
                const last = dedupedNodes[dedupedNodes.length - 1];
                const shouldMerge = (prev: any, curr: any) => {
                    if (!prev || prev.type !== 'paragraph' || curr.type !== 'paragraph') return false;
                    const prevText = (prev.text || '').trim();
                    const currText = (curr.text || '').trim();
                    if (prevText.length === 0 || currText.length === 0) return false;
                    if (prevText.endsWith('.') || prevText.endsWith('?') || prevText.endsWith('!')) return false;
                    if (prevText.endsWith(',') || prevText.endsWith(';') || prevText.endsWith(':')) return true;
                    if (/^[a-z(]/.test(currText)) return true;
                    if (prevText.length < 80 && currText.length < 80) return true;
                    return false;
                };
                if (shouldMerge(last, n)) {
                    last.text = `${last.text} ${n.text}`.trim();
                    continue;
                }
            }
            dedupedNodes.push(n);
        }
        const sectionContent = dedupedNodes.map(n => LatexAssembler.assembleNode({ ...n, sectionStyle: mapping.sectionStyle } as any, mathBlocks)).join("\n\n");
        const safeTitle = currentSectionTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);
        const fileName = `sections/${sectionIdx.toString().padStart(2, '0')}_${safeTitle}.tex`;
        files[fileName] = sectionContent + "\n";
      header.push(`\\input{${fileName}}`);
      currentSectionNodes = [];
      sectionIdx++;
    };

    const nodes = doc.body || (doc as any).nodes || [];
    let figureCounter = 0;

    nodes.forEach((node: any, nodeIdx: number) => {
        const text = (node.text || "").trim();
        const norm = normalize(text);
        const isStructural = ['figure', 'figure-group', 'table', 'algorithm', 'equation', 'image', 'chart', 'list'].includes(node.type);
        if (!norm && !isStructural) return;

        const cleanLower = text.toLowerCase()
          .replace(/^(?:\d+\.\s*|[IVX]+\.\s*|[A-G]\.\s*|Section\s+\d+[:\.\s]*)/i, "")
          .trim();

        // --- DYNAMIC DEDUPLICATION GATE ---
        const isMetadataMatch = norm === normalizedTitle || 
                                (normalizedTitle.length > 20 && (norm.includes(normalizedTitle) || normalizedTitle.includes(norm))) ||
                                normalizedAuthors.some(a => a.length > 8 && (norm === a || norm.includes(a))) ||
                                (normalizedAbstract.length > 30 && norm.includes(normalizedAbstract)) ||
                                cleanLower === 'abstract' || cleanLower.startsWith('abstract ') ||
                                cleanLower.match(/^(?:keywords|index terms|indexterms|highlights)$/);

        if (isMetadataMatch && !isStructural) return;

        // For headings specifically, block metadata section titles even if they trigger a split
        if (node.type === 'heading' && isMetadataMatch) return;

        if (node.type === 'heading' && (node.level === 1 || !node.level)) {
            flushSection();
            currentSectionTitle = text || "section";
        } else if (node.type === 'heading' && node.level === 2) {
            // Do NOT split files on subsection, just let it be emitted as \subsection
        }
        
        // Propagate two-column flag to table/figure nodes so assembler can choose table* vs table, figure* vs figure
        if (node.type === 'table' || node.type === 'figure-group' || node.type === 'algorithm') {
            node.twoColumn = isIeee || isAcm;
        }

        currentSectionNodes.push(node);

        // Auto-caption unnamed charts with sequential numbering
        if (node.type === 'chart' && !node.caption) {
            figureCounter++;
            node = { ...node, caption: `Figure ${figureCounter}` };
        }

        // Save individual components to dedicated folders (grouped for UI)
        if (node.type === 'table') {
            const content = LatexAssembler.assembleTable(node, mathBlocks);
            if (!files['assets/table.tex']) files['assets/table.tex'] = "% Required Packages: \\usepackage{booktabs}, \\usepackage{multirow}, \\usepackage{tabularx}\n\n";
            files['assets/table.tex'] += content + "\n\n";
            files[`tables/table_${nodeIdx}.tex`] = "% Required Packages: \\usepackage{booktabs}, \\usepackage{multirow}, \\usepackage{tabularx}\n\n" + content;
        } else if (node.type === 'figure' || node.type === 'image') {
            const content = LatexAssembler.assembleNode({ ...node, labelIdx: nodeIdx } as any, mathBlocks);
            if (!files['assets/figure.tex']) files['assets/figure.tex'] = "% Required Packages: \\usepackage{graphicx}, \\usepackage{float}\n\n";
            files['assets/figure.tex'] += content + "\n\n";
            files[`figures/figure_${nodeIdx}.tex`] = "% Required Packages: \\usepackage{graphicx}, \\usepackage{float}\n\n" + content;
        } else if (node.type === 'chart') {
            const content = LatexAssembler.assembleNode({ ...node, labelIdx: nodeIdx } as any, mathBlocks);
            if (!files['assets/figure.tex']) files['assets/figure.tex'] = "% Required Packages: \\usepackage{graphicx}, \\usepackage{float}\n\n";
            files['assets/figure.tex'] += content + "\n\n";
            files[`figures/figure_${nodeIdx}.tex`] = "% Required Packages: \\usepackage{graphicx}, \\usepackage{float}\n\n" + content;
        } else if (node.type === 'figure-group') {
            const content = LatexAssembler.assembleFigureGroup(node as any, mathBlocks);
            if (!files['assets/figure.tex']) files['assets/figure.tex'] = "% Required Packages: \\usepackage{graphicx}, \\usepackage{float}\n\n";
            files['assets/figure.tex'] += content + "\n\n";
            files[`figures/figure_${nodeIdx}.tex`] = "% Required Packages: \\usepackage{graphicx}, \\usepackage{float}\n\n" + content;
        } else if (node.type === 'algorithm') {
            const content = LatexAssembler.assembleAlgorithm(node, mathBlocks);
            if (!files['assets/algorithm.tex']) files['assets/algorithm.tex'] = "% Required Packages: \\usepackage{algorithm}, \\usepackage{algpseudocode}\n\n";
            files['assets/algorithm.tex'] += content + "\n\n";
            files[`algorithms/algo_${nodeIdx}.tex`] = "% Required Packages: \\usepackage{algorithm}, \\usepackage{algpseudocode}\n\n" + content;
        } else if (node.type === 'equation') {
            const content = LatexAssembler.assembleNode(node as any, mathBlocks);
            if (!files['assets/equation.tex']) files['assets/equation.tex'] = "% Required Packages: \\usepackage{amsmath}, \\usepackage{amssymb}, \\usepackage{amsfonts}\n\n";
            files['assets/equation.tex'] += content + "\n\n";
            files[`equations/eq_${nodeIdx}.tex`] = "% Required Packages: \\usepackage{amsmath}, \\usepackage{amssymb}, \\usepackage{amsfonts}\n\n" + content;
        }
    });
    flushSection();

    // NOTE: assets/figure.tex, table.tex, algorithm.tex are generated as REFERENCE files
    // for the IDE panel but are NOT \input'd at the end of main.tex.
    // Figures are rendered INLINE within their sections at the correct position.
    // Note: equation.tex is generated for reference only, equations must remain inline.

    // --- 4. ACKNOWLEDGEMENTS (standard academic: after body, BEFORE bibliography) ---
    if (doc.acknowledgements) {
      const ackContent = `\\section*{Acknowledgements}\n${LatexAssembler.escape(doc.acknowledgements, mathBlocks)}`;
      files['metadata/acknowledgements.tex'] = ackContent;
      header.push("\\input{metadata/acknowledgements.tex}");
    }

    // --- 5. BIBLIOGRAPHY ---
    if ((doc.references || []).length > 0) {
      const bibItems = (doc.references || []).map((ref: string, idx: number) => {
        // Always use sequential refN keys — ensures in-text \cite{refN} always resolves
        // regardless of whether the reference has a leading [N] label or author-year format
        let key = `ref${idx + 1}`;
        const numMatch = ref.match(/^\[(\d+)\]/);
        if (numMatch && parseInt(numMatch[1]) === idx + 1) key = `ref${numMatch[1]}`; // Accept only if sequential
        const cleanRef = ref.replace(/^(?:\[\d+\][.:\s\t]*|\d+[.:\s\t]+)/, '');
        return `\\bibitem{${key}} ${LatexAssembler.escape(cleanRef, mathBlocks, { skipCitations: true, isBibItem: true })}`;
      });
      const bibContent = `\n\\begin{thebibliography}{99}\n${bibItems.join('\n')}\n\\end{thebibliography}`;
      files['references/bibliography.tex'] = bibContent;
      header.push("\\input{references/bibliography.tex}");
    }

    header.push("\\end{document}");

    // Auto-apply beautiful paragraph formatting on assembly
    const formattedFiles: Record<string, string> = {};
    for (const [filename, content] of Object.entries(files)) {
      const ext = filename.split('.').pop()?.toLowerCase();
      if (ext === 'tex') {
        formattedFiles[filename] = formatLatexCode(content);
      } else {
        formattedFiles[filename] = content;
      }
    }

    return {
      mainTex: formatLatexCode([...preamble, ...pkgReg.serialize(), ...metadataDeclarations, ...header].join("\n")),
      files: formattedFiles
    };
  }
}


