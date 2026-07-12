import { StructuredDocument, ContentNode } from './deep-parser';

const GREEK_MAP: Record<string, string> = {
  'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon',
  'ζ': 'zeta', 'η': 'eta', 'θ': 'theta', 'ι': 'iota', 'κ': 'kappa',
  'λ': 'lambda', 'μ': 'mu', 'ν': 'nu', 'ξ': 'xi', 'ο': 'o',
  'π': 'pi', 'ρ': 'rho', 'σ': 'sigma', 'τ': 'tau', 'υ': 'upsilon',
  'φ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'ω': 'omega',
  'Α': 'Alpha', 'Ｂ': 'Beta', 'Γ': 'Gamma', 'Δ': 'Delta', 'Ε': 'Epsilon',
  'Ζ': 'Zeta', 'Ｈ': 'Eta', 'Θ': 'Theta', 'Ι': 'Iota', 'Ｋ': 'Kappa',
  'Λ': 'Lambda', 'Ｍ': 'Mu', 'Ｎ': 'Nu', 'Ξ': 'Xi', 'Ｏ': 'O',
  'Π': 'Pi', 'Ρ': 'Rho', 'Σ': 'Sigma', 'Ｔ': 'Tau', 'Ｙ': 'Upsilon',
  'Φ': 'Phi', 'Ｘ': 'Chi', 'Ψ': 'Psi', 'Ω': 'Omega',
  '±': 'pm', '×': 'times', '÷': 'div', '≈': 'approx', '≠': 'neq',
  '≤': 'leq', '≥': 'geq', '∞': 'infty', '∫': 'int', '∂': 'partial',
  '√': 'sqrt', '∈': 'in', '∉': 'notin', '∑': 'sum', '∏': 'prod',
  '∇': 'nabla', '∠': 'angle', '°': 'circ', '…': 'dots',
  '→': 'rightarrow', '←': 'leftarrow', '↔': 'leftrightarrow', '⇒': 'Rightarrow'
};

export class LatexAssembler {
  static assemble(doc: StructuredDocument, templateId: string = 'generic'): string {
    const mathBlocks: any[] = doc.mathBlocks || [];
    
    let docClass = "\\documentclass{article}";
    const isAcm = templateId === 't2' || templateId === 'article_acm';
    const isIeee = templateId === 't1' || templateId === 'article_ieee';
    const isElsevier = templateId === 't3' || templateId === 'article_elsevier';
    const isLncs = templateId === 't4' || templateId === 'article_lncs';
    const isSciRep = templateId === 't6' || templateId === 'article_scirep';
    const isMdpi = templateId === 'article_mdpi';

    if (isAcm) docClass = "\\documentclass[nonacm,sigconf]{acmart}";
    else if (isIeee) docClass = "\\documentclass[journal]{IEEEtran}";
    else if (isElsevier) docClass = "\\documentclass[preprint,12pt]{elsarticle}";
    else if (isLncs) docClass = "\\documentclass{llncs}";
    else if (isSciRep) docClass = "\\documentclass[fleqn,10pt]{wlscirep}";
    else if (isMdpi) docClass = "\\documentclass[journal,article,submit,moreauthors,pdftex]{mdpi}";

    const preamble = [
      "\\nonstopmode",
      docClass,
      isAcm ? "\\let\\Bbbk\\relax" : "",
      "\\usepackage[T1]{fontenc}",
      "\\usepackage[utf8]{inputenc}",
      "\\ifdefined\\DeclareUnicodeCharacter\\DeclareUnicodeCharacter{200B}{}\\fi",
      "\\usepackage{graphicx}",
      "\\usepackage{amsmath,amsfonts,amssymb}",
      "\\usepackage{booktabs,multirow,array,tabularx}",
      "\\usepackage[export]{adjustbox}",
      "\\usepackage{float,caption}",
      "\\usepackage{url}",
      "\\usepackage{algorithm,algpseudocode}",
      "\\usepackage{iftex,microtype}",
      "\\graphicspath{{./}}",
      "\\setkeys{Gin}{max width=\\linewidth,keepaspectratio}",
    ];

    if (!isAcm && !isIeee && !isElsevier && !isSciRep) {
      preamble.push("\\usepackage{authblk}");
      preamble.push("\\renewcommand\\Authfont{\\bfseries\\large}");
      preamble.push("\\renewcommand\\Affilfont{\\itshape\\small}");
      preamble.push("\\setlength{\\affilsep}{1em}");
    }

    const escTitle = LatexAssembler.escape(doc.title || "Research Paper", []);
    preamble.push(`\\title{${escTitle}}`);
    
    const orgs = (doc.organizations || []).map(o => LatexAssembler.escape(o, []));
    
    const authorLines = doc.authors.map((a, idx) => {
      const name = LatexAssembler.escape(typeof a.name === 'string' ? a.name : (a as any).text || "Author", []);
      const affil = orgs[idx] || orgs[0] || "Institution";
      const email = a.email ? LatexAssembler.escape(a.email, []) : "";

      if (isAcm) {
        return `\\author{${name}}\n${email ? `\\email{${email}}` : ""}\n\\affiliation{\n  \\institution{${affil}}\n  \\city{City}\n  \\country{Country}\n}`;
      }
      if (isIeee) {
        return `\\IEEEauthorblockN{${name}}\n\\IEEEauthorblockA{${affil}\\\\${email ? `email: ${email}` : ""}}`;
      }
      if (isLncs) return `${name}${email ? `\\inst{1}` : ""}`;
      if (isElsevier) return `\\author[aff1]{${name}${a.isCorresponding ? "\\corref{cor1}" : ""}}`;
      if (isSciRep) {
        const id = a.affiliationIds?.[0] || "1";
        return `\\author[${id}${a.isCorresponding ? ',*' : ''}]{${name}}`;
      }
      const ids = a.affiliationIds?.join(',') || "1";
      return `\\author[${ids}]{${name}}`;
    });

    if (isLncs) {
      preamble.push(`\\author{${authorLines.join(' \\and ')}}`);
      preamble.push(`\\institute{${orgs[0] || "Institution"}}`);
    } else if (isElsevier) {
      preamble.push(authorLines.join('\n'));
      preamble.push(`\\affiliation[aff1]{organization={${orgs[0] || "Institution"}}, country={Country}}`);
      if (doc.authors.some(a => a.isCorresponding)) preamble.push("\\cortext[cor1]{Corresponding author}");
    } else if (isAcm) {
      preamble.push(...authorLines);
    } else if (isIeee) {
      preamble.push(`\\author{\n${authorLines.join('\n\\and\n')}\n}`);
    } else {
      preamble.push(authorLines.join('\n'));
      orgs.forEach((o, i) => preamble.push(`\\affil[${i+1}]{${o}}`));
      const corresponding = doc.authors.find(a => a.isCorresponding);
      if (corresponding?.email) preamble.push(`\\affil[*]{Corresponding author: ${LatexAssembler.escape(corresponding.email, [])}}`);
      preamble.push("\\date{}");
    }

    const header = ["\\begin{document}"];
    
    const abstractBlock = [];
    if (doc.abstract) {
      abstractBlock.push("\\begin{abstract}");
      abstractBlock.push(LatexAssembler.escape(doc.abstract, mathBlocks));
      abstractBlock.push("\\end{abstract}");
    }
    
    const kwText = doc.keywords.map(k => LatexAssembler.escape(k, mathBlocks)).join(', ');
    let kwBlock: string[] = [];
    if (kwText) {
      if (isIeee) kwBlock = [`\\begin{IEEEkeywords}\n${kwText}\n\\end{IEEEkeywords}`];
      else if (isElsevier) kwBlock = [`\\begin{keyword}\n${kwText}\n\\end{keyword}`];
      else if (isAcm || isSciRep) kwBlock = [`\\keywords{${kwText}}`];
      else kwBlock = [`\\noindent\\textbf{Keywords: } ${kwText}`];
    }

    if (isAcm) {
      header.push(...kwBlock, ...abstractBlock, "\\maketitle");
    } else if (isElsevier) {
      header.push("\\begin{frontmatter}", `\\title{${escTitle}}`, ...authorLines, ...abstractBlock, ...kwBlock, "\\end{frontmatter}");
    } else {
      header.push("\\maketitle", ...abstractBlock, ...kwBlock);
    }

    if (doc.contribution && doc.contribution.length > 50) {
        header.push("\\section{Main Contributions}");
        header.push(LatexAssembler.escape(doc.contribution, mathBlocks));
    }
    const orgOfPaper = (doc as any).organizationOfPaper;
    if (orgOfPaper && orgOfPaper.length > 50) {
        header.push("\\section{Organization of the Paper}");
        header.push(LatexAssembler.escape(orgOfPaper, mathBlocks));
    }

    const seenContent = new Set<string>();
    
    const body = doc.body.filter(node => {
        const text = (node.text || "").trim().toLowerCase();
        if (text === (doc.title || "").trim().toLowerCase()) return false;
        if (node.type === 'heading' && (text === 'abstract' || text === 'references' || text === 'bibliography' || text === 'keywords' )) return false;
        if (node.type === 'algorithm' || node.type === 'table' || node.type === 'figure') {
            const contentHash = (node.html || node.latex || node.items?.join('') || "").substring(0, 200).replace(/\s+/g, '');
            const fingerprint = `${node.type}:${node.title || node.caption || ''}:${contentHash}`;
            if (seenContent.has(fingerprint)) return false;
            seenContent.add(fingerprint);
            if (node.type === 'algorithm' && (!node.items || node.items.length === 0) && !node.title) return false;
            if (node.type === 'table' && (!node.html || node.html.length < 15)) return false;
        }
        if (doc.contribution && doc.contribution.toLowerCase().includes(text) && text.length > 20) return false;
        if (orgOfPaper && orgOfPaper.toLowerCase().includes(text) && text.length > 20) return false;
        if (doc.abstract && doc.abstract.toLowerCase().includes(text) && text.length > 20) return false;
        if (node.type === 'paragraph' && text.length > 20 && doc.references.length > 0) {
            const isRefLeaked = doc.references.some(ref => {
                const rText = ref.toLowerCase();
                if (rText.length < 10) return false;
                if (rText.includes(text) && text.length > rText.length * 0.85) return true;
                if (text.includes(rText) && rText.length > text.length * 0.85) return true;
                return false;
            });
            if (isRefLeaked) return false;
        }
        return true;
    }).map(node => LatexAssembler.assembleNode(node, mathBlocks)).join("\n\n");

    const bibliography = doc.references.length > 0 ? [
      "",
      "\\begin{thebibliography}{99}",
      ...doc.references.map((ref, idx) => `\\bibitem{ref${idx + 1}} ${LatexAssembler.escape(ref, mathBlocks)}`),
      "\\end{thebibliography}"
    ] : [];

    const footer = [
      "",
      doc.acknowledgements ? `\\section*{Acknowledgements}\n${LatexAssembler.escape(doc.acknowledgements, mathBlocks)}` : "",
      ...bibliography,
      "\\end{document}"
    ];

    return [...preamble, ...header, body, ...footer].join("\n");
  }

  private static assembleNode(node: ContentNode, mathBlocks: any[]): string {
    switch (node.type) {
      case 'heading': {
        const level = node.level || 1;
        const cmd = level === 1 ? 'section' : level === 2 ? 'subsection' : 'subsubsection';
        const cleanText = (node.text || "").replace(/^(?:\d+[\.\s]*|[ivxlcdm]+[\.\s]*|[A-Z][\.\s]+)+\s*/i, "").trim();
        return `\n\\${cmd}{${LatexAssembler.escapeText(cleanText || "Untitled Section", mathBlocks)}}\n`;
      }
      case 'paragraph':
        return `\n\n${LatexAssembler.escapeText(node.text || "", mathBlocks)}\n\n`;
      case 'table':
        return LatexAssembler.assembleTable(node, mathBlocks);
      case 'figure':
        const fileId = String(node.id || "figure").replace(/\\/g, '/').split('/').pop() || "figure";
        const caption = LatexAssembler.escapeText(node.caption || "Figure", mathBlocks);
        return `\n\\begin{figure}[htbp]\n\\centering\n\\includegraphics[width=\\linewidth, keepaspectratio]{${fileId}}\n\\caption{${caption}}\n\\end{figure}\n`;
      case 'algorithm':
        return LatexAssembler.assembleAlgorithm(node, mathBlocks);
      case 'equation':
        const latex = node.latex || "";
        if (latex.includes('\\begin{') || latex.includes('\\[')) return `\n${latex}\n`;
        return `\n\\begin{equation}\n${latex}\n\\end{equation}\n`;
      case 'list':
        return `\\begin{itemize}\n${(node.items || []).map(item => `  \\item ${LatexAssembler.escapeText(item, mathBlocks)}`).join("\n")}\n\\end{itemize}`;
      default:
        return "";
    }
  }

  private static assembleTable(node: ContentNode, mathBlocks: any[]): string {
    if (!node.html) return "";
    const rows = node.html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    if (rows.length === 0) return "";
    let totalGridCols = 0;
    const firstRow = rows[0];
    if (!firstRow) return "";
    const firstRowCells = firstRow.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || [];
    firstRowCells.forEach(c => {
        const colspanMatch = c.match(/colspan=["'](\d+)["']/i);
        totalGridCols += colspanMatch ? parseInt(colspanMatch[1]) : 1;
    });
    const colDensity = Array(totalGridCols).fill(0);
    rows.forEach(row => {
        const cells = row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || [];
        let colIdx = 0;
        cells.forEach(c => {
            const colspan = parseInt(c.match(/colspan=["'](\d+)["']/i)?.[1] || "1");
            const text = c.replace(/<[^>]+>/g, '').trim();
            for (let i = 0; i < colspan; i++) {
                if (colIdx + i < totalGridCols) colDensity[colIdx + i] += text.length;
            }
            colIdx += colspan;
        });
    });
    let spec = colDensity.map(len => {
        const avg = len / rows.length;
        if (avg > 150) return '>{\\raggedright\\arraybackslash}X';
        if (avg > 60) return '>{\\raggedright\\arraybackslash}p{12em}';
        if (avg > 25) return '>{\\raggedright\\arraybackslash}p{6em}';
        return 'l';
    }).join('|');
    if (!spec.includes('X') && !spec.includes('p{')) spec = spec.replace(/l/, 'X');
    spec = '|' + spec + '|';
    const tableContent = rows.map((row, idx) => {
      const cells = row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || [];
      const rowData: string[] = [];
      cells.forEach(c => {
        const colspanMatch = c.match(/colspan=["'](\d+)["']/i);
        const colspan = colspanMatch ? parseInt(colspanMatch[1]) : 1;
        const inner = c.replace(/<t[hd][^>]*>/i, '').replace(/<\/t[hd]>/i, '').trim();
        const clean = inner.replace(/<[^>]+>/g, '').trim();
        const escaped = LatexAssembler.escapeText(clean, mathBlocks);
        if (colspan > 1) rowData.push(`\\multicolumn{${colspan}}{c}{${escaped}}`);
        else rowData.push(escaped);
      });
      return rowData.join(" & ") + " \\\\ \\hline";
    }).join("\n");
    const tabular = `{\\setlength{\\tabcolsep}{8pt}\\renewcommand{\\arraystretch}{1.4}\n\\begin{tabularx}{\\linewidth}{${spec}}\n\\hline\n${tableContent}\n\\end{tabularx}}`;
    const caption = LatexAssembler.escapeText(node.caption || "Table", mathBlocks);
    return `\n\\begin{table}[htbp]\n\\centering\n\\caption{${caption}}\n${tabular}\n\\end{table}\n`;
  }

  private static assembleAlgorithm(node: ContentNode, mathBlocks: any[]): string {
    let title = (node.title || "").trim();
    const cleanedTitle = title.replace(/^(?:Algorithm|Alg\.?|Listing|Pseudo-?code|Procedure|Step|Logic|Process)\s*[\d\.\-\:a-z]*\s*[:\.\-]*\s*/i, "").trim();
    if (cleanedTitle.length > 80 && /^(?:This|The|In|We)\s+/i.test(cleanedTitle)) title = "Logical Procedure";
    else title = cleanedTitle;
    if (!title || title.length < 2) title = "";
    const escapedTitle = LatexAssembler.escapeText(title, mathBlocks);
    const rawLines = (node.items || []).join("\n").split("\n").map(l => l.trim()).filter(Boolean);
    const items = rawLines.map(line => {
        const cleaned = line.replace(/^[_\-=]{3,}$/, "").replace(/^[_\-=]{3,}/, "").replace(/[_\-=]{3,}$/, "");
        if (!cleaned.trim()) return null;
        const cleanLine = cleaned.replace(/^\d+[\.\s]*/, '').trim();
        let escaped = LatexAssembler.escapeText(cleanLine, mathBlocks);
        escaped = escaped.replace(/^(Input|Output|Data|Result|Ensure|Require|Step\s*\d+)[: ]/i, (m) => `\\textbf{${m.trim()}} `);
        return `\\State ${escaped}`;
    }).filter(Boolean);
    return `\n\\begin{algorithm}[htbp]\n\\caption{${escapedTitle}}\n\\begin{algorithmic}[1]\n${items.join('\n')}\n\\end{algorithmic}\n\\end{algorithm}\n`;
  }

  private static escapeText(text: string, mathBlocks: any[]): string {
    const escaped = LatexAssembler.escape(text, mathBlocks);
    return escaped.replace(/_/g, '\\_');
  }

  static escape(text: string, mathBlocks: any[]): string {
    if (!text) return "";
    let sanitized = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
      .replace(/\\/g, '\\textbackslash ')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\^/g, '\\textasciicircum ')
      .replace(/~/g, '\\textasciitilde ');

    sanitized = sanitized.replace(/\[([\d\s,\-]+)\]/g, (match, inner) => {
        const refs = inner.split(',').map((r: string) => {
            const trimmed = r.trim();
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(Number);
                if (!isNaN(start) && !isNaN(end)) return Array.from({length: end - start + 1}, (_, i) => `ref${start + i}`).join(',');
            }
            return trimmed.startsWith('ref') ? trimmed : `ref${trimmed}`;
        }).join(',');
        return `\\cite{${refs}}`;
    });

    const mathMap = new Map<string, string>();
    sanitized = sanitized.replace(/MATHBLOCKX(\d+)XMARKER/g, (match, idx) => {
        const entry = mathBlocks[parseInt(idx)] || "";
        const raw = typeof entry === 'string' ? entry : (entry.latex || "");
        const id = `MATHUNWRAP${idx}TOKEN`;
        const content = (raw.includes('\\begin{equation}') || raw.includes('$')) ? raw : `$${raw}$`;
        mathMap.set(id, content);
        return id;
    });

    for (const [char, cmd] of Object.entries(GREEK_MAP)) sanitized = sanitized.replace(new RegExp(char, 'g'), `$\\${cmd}$`);
    sanitized = sanitized.replace(/\\textbackslash\s*(omega|alpha|beta|gamma|delta|theta|lambda|pi|sigma|phi|psi)/gi, (_, sym) => `$\\${sym}$`);
    sanitized = sanitized.replace(/\\_(\d+|i|j|k|n|m|x|y|z|L|R|D)/g, (_, sub) => `$_{\\text{${sub}}}$`);

    for (const [token, content] of mathMap.entries()) sanitized = sanitized.replace(token, content);
    return sanitized.replace(/\\\$\\textbackslash\s+/g, '$\\').replace(/\$\$+/g, '$');
  }
}
