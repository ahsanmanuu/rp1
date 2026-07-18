import { type StudioFile } from './studio-fs';

export const getLatexSuggestions = (monaco: any, model: any, position: any, files: StudioFile[] = []) => {
  const kinds = monaco.languages.CompletionItemKind;
  const rules = monaco.languages.CompletionItemInsertValueRule;

  const word = model.getWordUntilPosition(position);
  const lineContent = model.getLineContent(position.lineNumber);
  const charBefore = word.startColumn > 1 ? lineContent[word.startColumn - 2] : '';
  const hasBackslash = charBefore === '\\';

  const commandRange = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: hasBackslash ? word.startColumn - 1 : word.startColumn,
    endColumn: word.endColumn
  };

  const normalRange = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn
  };

  const suggestions: any[] = [
    // ═══════════════════════════════════════════════════════════════════════
    // DOCUMENT STRUCTURE
    // ═══════════════════════════════════════════════════════════════════════
    {
      label: 'documentclass',
      kind: kinds.Function,
      insertText: '\\documentclass[${1:options}]{${2:article}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\documentclass',
      documentation: 'Document class declaration'
    },
    {
      label: 'usepackage',
      kind: kinds.Function,
      insertText: '\\usepackage{${1:package}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\usepackage',
      documentation: 'Import LaTeX packages'
    },
    {
      label: 'begin',
      kind: kinds.Function,
      insertText: '\\begin{${1:environment}}\n\t$0\n\\end{$1}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\begin',
      documentation: 'Generic environment block'
    },
    {
      label: 'section',
      kind: kinds.Function,
      insertText: '\\section{${1:title}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\section',
      documentation: 'Primary section heading'
    },
    {
      label: 'subsection',
      kind: kinds.Function,
      insertText: '\\subsection{${1:title}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\subsection',
      documentation: 'Secondary section heading'
    },
    {
      label: 'subsubsection',
      kind: kinds.Function,
      insertText: '\\subsubsection{${1:title}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\subsubsection',
      documentation: 'Tertiary section heading'
    },
    {
      label: 'paragraph',
      kind: kinds.Function,
      insertText: '\\paragraph{${1:title}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\paragraph',
      documentation: 'Paragraph heading'
    },
    {
      label: 'title',
      kind: kinds.Function,
      insertText: '\\title{${1:title}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\title',
      documentation: 'Document title'
    },
    {
      label: 'author',
      kind: kinds.Function,
      insertText: '\\author{${1:author name}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\author',
      documentation: 'Document author'
    },
    {
      label: 'date',
      kind: kinds.Function,
      insertText: '\\date{${1:\\today}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\date',
      documentation: 'Document date'
    },
    {
      label: 'maketitle',
      kind: kinds.Function,
      insertText: '\\maketitle',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\maketitle',
      documentation: 'Generate title block'
    },
    {
      label: 'tableofcontents',
      kind: kinds.Function,
      insertText: '\\tableofcontents',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\tableofcontents',
      documentation: 'Generate table of contents'
    },
    {
      label: 'newpage',
      kind: kinds.Function,
      insertText: '\\newpage',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\newpage',
      documentation: 'Insert page break'
    },
    {
      label: 'clearpage',
      kind: kinds.Function,
      insertText: '\\clearpage',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\clearpage',
      documentation: 'Clear page and float debris'
    },
    {
      label: 'bibliography',
      kind: kinds.Function,
      insertText: '\\bibliography{${1:references}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\bibliography',
      documentation: 'Bibliography file reference'
    },
    {
      label: 'bibliographystyle',
      kind: kinds.Function,
      insertText: '\\bibliographystyle{${1:plain}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\bibliographystyle',
      documentation: 'Bibliography style (plain, alpha, abbrv, etc.)'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // FIGURE ENVIRONMENT (multiple triggers)
    // ═══════════════════════════════════════════════════════════════════════
    {
      label: 'figure',
      kind: kinds.Snippet,
      insertText: '\\begin{figure}[htbp]\n\t\\centering\n\t\\includegraphics[width=${1:0.8}\\textwidth]{${2:filename}}\n\t\\caption{${3:caption text}}\n\t\\label{fig:${4:label}}\n\\end{figure}',
      insertTextRules: 4,
      documentation: 'Figure environment with image, caption, and label',
      filterText: '\\figure\\fig',
      range: commandRange
    },
    {
      label: 'figure*',
      kind: kinds.Snippet,
      insertText: '\\begin{figure*}[htbp]\n\t\\centering\n\t\\includegraphics[width=${1:\\textwidth}]{${2:filename}}\n\t\\caption{${3:caption text}}\n\t\\label{fig:${4:label}}\n\\end{figure*}',
      insertTextRules: 4,
      documentation: 'Double-width figure (two-column layout)',
      filterText: '\\figure*',
      range: commandRange
    },
    {
      label: 'subfigure',
      kind: kinds.Snippet,
      insertText: '\\begin{figure}[htbp]\n\t\\centering\n\t\\begin{subfigure}{${1:0.45}\\textwidth}\n\t\t\\centering\n\t\t\\includegraphics[width=\\textwidth]{${2:image1}}\n\t\t\\caption{${3:subcaption 1}}\n\t\t\\label{fig:${4:sub1}}\n\t\\end{subfigure}\n\t\\hfill\n\t\\begin{subfigure}{${5:0.45}\\textwidth}\n\t\t\\centering\n\t\t\\includegraphics[width=\\textwidth]{${6:image2}}\n\t\t\\caption{${7:subcaption 2}}\n\t\t\\label{fig:${8:sub2}}\n\t\\end{subfigure}\n\t\\caption{${9:main caption}}\n\t\\label{fig:${10:label}}\n\\end{figure}',
      insertTextRules: 4,
      documentation: 'Figure with two subfigures side by side',
      filterText: '\\subfigure',
      range: commandRange
    },

    // ═══════════════════════════════════════════════════════════════════════
    // TABLE ENVIRONMENTS (multiple triggers)
    // ═══════════════════════════════════════════════════════════════════════
    {
      label: 'table',
      kind: kinds.Snippet,
      insertText: '\\begin{table}[htbp]\n\t\\centering\n\t\\caption{${1:caption}}\n\t\\label{tab:${2:label}}\n\t\\begin{tabular}{${3:|l|c|r|}}\n\t\\hline\n\t${4:Header 1} & ${5:Header 2} & ${6:Header 3} \\\\\n\t\\hline\n\t${7:Data 1} & ${8:Data 2} & ${9:Data 3} \\\\\n\t\\hline\n\t\\end{tabular}\n\\end{table}',
      insertTextRules: 4,
      documentation: 'Table environment with tabular, caption, and label',
      filterText: '\\table\\tbl',
      range: commandRange
    },
    {
      label: 'table*',
      kind: kinds.Snippet,
      insertText: '\\begin{table*}[htbp]\n\t\\centering\n\t\\caption{${1:caption}}\n\t\\label{tab:${2:label}}\n\t\\begin{tabular}{${3:|l|c|r|}}\n\t\\hline\n\t${4:Header 1} & ${5:Header 2} & ${6:Header 3} \\\\\n\t\\hline\n\t${7:Data 1} & ${8:Data 2} & ${9:Data 3} \\\\\n\t\\hline\n\t\\end{tabular}\n\\end{table*}',
      insertTextRules: 4,
      documentation: 'Double-width table (two-column layout)',
      filterText: '\\table*',
      range: commandRange
    },
    {
      label: 'tabular',
      kind: kinds.Snippet,
      insertText: '\\begin{tabular}{${1:|l|c|r|}}\n\t\\hline\n\t${2:Header 1} & ${3:Header 2} & ${4:Header 3} \\\\\n\t\\hline\n\t${5:Data 1} & ${6:Data 2} & ${7:Data 3} \\\\\n\t\\hline\n\\end{tabular}',
      insertTextRules: 4,
      documentation: 'Standalone tabular environment',
      filterText: '\\tabular',
      range: commandRange
    },
    {
      label: 'tabularx',
      kind: kinds.Snippet,
      insertText: '\\begin{tabularx}{${1:\\textwidth}}{${2:|X|X|X|}}\n\t\\hline\n\t${3:Header 1} & ${4:Header 2} & ${5:Header 3} \\\\\n\t\\hline\n\t${6:Data 1} & ${7:Data 2} & ${8:Data 3} \\\\\n\t\\hline\n\\end{tabularx}',
      insertTextRules: 4,
      documentation: 'Auto-width tabular (requires tabularx package)',
      filterText: '\\tabularx',
      range: commandRange
    },
    {
      label: 'longtable',
      kind: kinds.Snippet,
      insertText: '\\begin{longtable}{${1:|l|c|r|}}\n\t\\caption{${2:caption}}\\\\\n\t\\hline\n\t${3:Header 1} & ${4:Header 2} & ${5:Header 3} \\\\\n\t\\hline\n\t\\endfirsthead\n\t\\hline\n\t${3:Header 1} & ${4:Header 2} & ${5:Header 3} \\\\\n\t\\hline\n\t\\endhead\n\t\\hline\n\t\\endfoot\n\t${6:Data 1} & ${7:Data 2} & ${8:Data 3} \\\\\n\\end{longtable}',
      insertTextRules: 4,
      documentation: 'Multi-page table (requires longtable package)',
      filterText: '\\longtable',
      range: commandRange
    },

    // ═══════════════════════════════════════════════════════════════════════
    // MATH ENVIRONMENTS
    // ═══════════════════════════════════════════════════════════════════════
    {
      label: 'abstract',
      kind: kinds.Snippet,
      insertText: '\\begin{abstract}\n\t${1:This research explores...}\n\\end{abstract}',
      insertTextRules: 4,
      documentation: 'Academic abstract block',
      filterText: '\\abstract',
      range: commandRange
    },
    {
      label: 'equation',
      kind: kinds.Snippet,
      insertText: '\\begin{equation}\n\t${1:E = mc^2}\n\t\\label{eq:${2:label}}\n\\end{equation}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\equation',
      documentation: 'Numbered equation block'
    },
    {
      label: 'equation*',
      kind: kinds.Snippet,
      insertText: '\\begin{equation*}\n\t${1:E = mc^2}\n\\end{equation*}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\equation*',
      documentation: 'Unnumbered equation block'
    },
    {
      label: 'align',
      kind: kinds.Snippet,
      insertText: '\\begin{align}\n\t${1:a} &= ${2:b} \\\\\n\t${3:c} &= ${4:d}\n\\end{align}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\align',
      documentation: 'Aligned numbered equations (ams)'
    },
    {
      label: 'align*',
      kind: kinds.Snippet,
      insertText: '\\begin{align*}\n\t${1:a} &= ${2:b} \\\\\n\t${3:c} &= ${4:d}\n\\end{align*}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\align*',
      documentation: 'Aligned unnumbered equations (ams)'
    },
    {
      label: 'gather',
      kind: kinds.Snippet,
      insertText: '\\begin{gather}\n\t${1:equation 1} \\\\\n\t${2:equation 2}\n\\end{gather}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\gather',
      documentation: 'Centered numbered equations (ams)'
    },
    {
      label: 'cases',
      kind: kinds.Snippet,
      insertText: '\\begin{cases}\n\t${1:f(x)} & \\text{if } ${2:condition 1} \\\\\n\t${3:g(x)} & \\text{if } ${4:condition 2}\n\\end{cases}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\cases',
      documentation: 'Piecewise function / cases environment'
    },
    {
      label: 'matrix',
      kind: kinds.Snippet,
      insertText: '\\begin{${1:pmatrix}}\n\t${2:a} & ${3:b} \\\\\n\t${4:c} & ${5:d}\n\\end{$1}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\matrix\\pmatrix\\bmatrix\\vmatrix\\Vmatrix',
      documentation: 'Matrix (pmatrix, bmatrix, vmatrix, Vmatrix)'
    },
    {
      label: 'bmatrix',
      kind: kinds.Snippet,
      insertText: '\\begin{bmatrix}\n\t${1:a} & ${2:b} \\\\\n\t${3:c} & ${4:d}\n\\end{bmatrix}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\bmatrix',
      documentation: 'Bracket matrix'
    },
    {
      label: 'pmatrix',
      kind: kinds.Snippet,
      insertText: '\\begin{pmatrix}\n\t${1:a} & ${2:b} \\\\\n\t${3:c} & ${4:d}\n\\end{pmatrix}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\pmatrix',
      documentation: 'Parenthesis matrix'
    },
    {
      label: 'array',
      kind: kinds.Snippet,
      insertText: '\\begin{array}{${1}{l}}\n\t${2:a} & ${3:b} \\\\\n\t${4:c} & ${5:d}\n\\end{array}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\array',
      documentation: 'Array environment for math'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // LIST ENVIRONMENTS
    // ═══════════════════════════════════════════════════════════════════════
    {
      label: 'itemize',
      kind: kinds.Snippet,
      insertText: '\\begin{itemize}\n\t\\item ${1:item}\n\\end{itemize}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\itemize',
      documentation: 'Unordered bullet list'
    },
    {
      label: 'enumerate',
      kind: kinds.Snippet,
      insertText: '\\begin{enumerate}\n\t\\item ${1:item}\n\\end{enumerate}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\enumerate',
      documentation: 'Numbered list'
    },
    {
      label: 'description',
      kind: kinds.Snippet,
      insertText: '\\begin{description}\n\t\\item[${1:term}] ${2:description}\n\\end{description}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\description',
      documentation: 'Description list with custom labels'
    },
    {
      label: 'compactitem',
      kind: kinds.Snippet,
      insertText: '\\begin{compactitem}\n\t\\item ${1:item}\n\\end{compactitem}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\compactitem',
      documentation: 'Compact bullet list (paralist package)'
    },
    {
      label: 'compactenum',
      kind: kinds.Snippet,
      insertText: '\\begin{compactenum}\n\t\\item ${1:item}\n\\end{compactenum}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\compactenum',
      documentation: 'Compact numbered list (paralist package)'
    },
    {
      label: 'item',
      kind: kinds.Function,
      insertText: '\\item ${1:content}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\item',
      documentation: 'List item'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // THEOREM & PROOF ENVIRONMENTS
    // ═══════════════════════════════════════════════════════════════════════
    {
      label: 'theorem',
      kind: kinds.Snippet,
      insertText: '\\begin{theorem}[${1:name}]\n\t${2:statement}\n\\label{thm:${3:label}}\n\\end{theorem}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\theorem',
      documentation: 'Theorem environment'
    },
    {
      label: 'lemma',
      kind: kinds.Snippet,
      insertText: '\\begin{lemma}[${1:name}]\n\t${2:statement}\n\\label{lem:${3:label}}\n\\end{lemma}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\lemma',
      documentation: 'Lemma environment'
    },
    {
      label: 'proposition',
      kind: kinds.Snippet,
      insertText: '\\begin{proposition}[${1:name}]\n\t${2:statement}\n\\label{prop:${3:label}}\n\\end{proposition}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\proposition',
      documentation: 'Proposition environment'
    },
    {
      label: 'corollary',
      kind: kinds.Snippet,
      insertText: '\\begin{corollary}[${1:name}]\n\t${2:statement}\n\\label{cor:${3:label}}\n\\end{corollary}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\corollary',
      documentation: 'Corollary environment'
    },
    {
      label: 'definition',
      kind: kinds.Snippet,
      insertText: '\\begin{definition}[${1:name}]\n\t${2:statement}\n\\label{def:${3:label}}\n\\end{definition}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\definition',
      documentation: 'Definition environment'
    },
    {
      label: 'example',
      kind: kinds.Snippet,
      insertText: '\\begin{example}\n\t${1:example content}\n\\end{example}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\example',
      documentation: 'Example environment'
    },
    {
      label: 'remark',
      kind: kinds.Snippet,
      insertText: '\\begin{remark}\n\t${1:remark content}\n\\end{remark}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\remark',
      documentation: 'Remark environment'
    },
    {
      label: 'proof',
      kind: kinds.Snippet,
      insertText: '\\begin{proof}\n\t${1:proof content}\n\\end{proof}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\proof',
      documentation: 'Proof environment'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CODE LISTINGS & VERBATIM
    // ═══════════════════════════════════════════════════════════════════════
    {
      label: 'verbatim',
      kind: kinds.Snippet,
      insertText: '\\begin{verbatim}\n\t${1:verbatim text}\n\\end{verbatim}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\verbatim',
      documentation: 'Verbatim text (no formatting)'
    },
    {
      label: 'lstlisting',
      kind: kinds.Snippet,
      insertText: '\\begin{lstlisting}[language=${1:Python}, caption={${2:caption}}, label={lst:${3:label}}]\n\t${4:code}\n\\end{lstlisting}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\lstlisting\\lst',
      documentation: 'Code listing (lstlisting package)'
    },
    {
      label: 'lstinputlisting',
      kind: kinds.Function,
      insertText: '\\lstinputlisting[language=${1:Python}, caption={${2:caption}}]{${3:file.ext}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\lstinputlisting',
      documentation: 'Import code from file'
    },
    {
      label: 'minted',
      kind: kinds.Snippet,
      insertText: '\\begin{minted}[linenos, caption={${1:caption}}]{${2:python}}\n\t${3:code}\n\\end{minted}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\minted',
      documentation: 'Syntax-highlighted code (minted package)'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // QUOTES & BLOCKS
    // ═══════════════════════════════════════════════════════════════════════
    {
      label: 'quote',
      kind: kinds.Snippet,
      insertText: '\\begin{quote}\n\t${1:quoted text}\n\\end{quote}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\quote',
      documentation: 'Block quote'
    },
    {
      label: 'quotation',
      kind: kinds.Snippet,
      insertText: '\\begin{quotation}\n\t${1:quoted text}\n\\end{quotation}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\quotation',
      documentation: 'Indented quotation block'
    },
    {
      label: 'center',
      kind: kinds.Snippet,
      insertText: '\\begin{center}\n\t${1:centered text}\n\\end{center}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\center',
      documentation: 'Centered text block'
    },
    {
      label: 'minipage',
      kind: kinds.Snippet,
      insertText: '\\begin{minipage}{${1:0.45}\\textwidth}\n\t${2:content}\n\\end{minipage}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\minipage',
      documentation: 'Inline mini page'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ALGORITHM & PSEUDOCODE
    // ═══════════════════════════════════════════════════════════════════════
    {
      label: 'algorithm',
      kind: kinds.Snippet,
      insertText: '\\begin{algorithm}[htbp]\n\t\\caption{${1:Algorithm Name}}\n\t\\label{alg:${2:label}}\n\t\\begin{algorithmic}[1]\n\t\\State ${3:Initialize variables}\n\\For{${4:i = 1 to n}}\n\t\\State ${5:do something}\n\\EndFor\n\t\\State \\Return ${6:result}\n\t\\end{algorithmic}\n\\end{algorithm}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\algorithm',
      documentation: 'Algorithm pseudocode (algorithmicx/algpseudocode)'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // FILESYSTEM AWARE SUGGESTIONS
    // ═══════════════════════════════════════════════════════════════════════
    ...files.map(f => {
      const isImage = ['png', 'jpg', 'jpeg', 'pdf', 'svg'].some(ext => f.path.toLowerCase().endsWith(ext));
      const isTex = f.path.toLowerCase().endsWith('.tex');
      const isBib = f.path.toLowerCase().endsWith('.bib');
      return {
        label: f.path,
        kind: isImage ? kinds.File : (isTex ? kinds.Reference : (isBib ? kinds.Module : kinds.Text)),
        insertText: f.path,
        documentation: `Project asset: ${f.path}`,
        range: normalRange,
        sortText: '001'
      };
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // PACKAGES
    // ═══════════════════════════════════════════════════════════════════════
    { label: 'amsmath', kind: kinds.Module, documentation: 'Advanced mathematical formulas (AMS)', range: normalRange, sortText: '010' },
    { label: 'amssymb', kind: kinds.Module, documentation: 'Mathematical symbols (AMS)', range: normalRange, sortText: '010' },
    { label: 'amsthm', kind: kinds.Module, documentation: 'Theorem environments (AMS)', range: normalRange, sortText: '010' },
    { label: 'amsfonts', kind: kinds.Module, documentation: 'AMS mathematical fonts', range: normalRange, sortText: '010' },
    { label: 'graphicx', kind: kinds.Module, documentation: 'Image inclusion (\\includegraphics)', range: normalRange, sortText: '010' },
    { label: 'hyperref', kind: kinds.Module, documentation: 'Hyperlinks and cross-references', range: normalRange, sortText: '010' },
    { label: 'booktabs', kind: kinds.Module, documentation: 'Professional table rules (\\toprule, \\midrule, \\bottomrule)', range: normalRange, sortText: '010' },
    { label: 'tabularx', kind: kinds.Module, documentation: 'Auto-width tabular columns', range: normalRange, sortText: '010' },
    { label: 'longtable', kind: kinds.Module, documentation: 'Multi-page tables', range: normalRange, sortText: '010' },
    { label: 'multirow', kind: kinds.Module, documentation: 'Multi-row table cells', range: normalRange, sortText: '010' },
    { label: 'multicol', kind: kinds.Module, documentation: 'Multi-column layout', range: normalRange, sortText: '010' },
    { label: 'geometry', kind: kinds.Module, documentation: 'Page layout and margins', range: normalRange, sortText: '010' },
    { label: 'fancyhdr', kind: kinds.Module, documentation: 'Custom headers and footers', range: normalRange, sortText: '010' },
    { label: 'titlesec', kind: kinds.Module, documentation: 'Custom section title formatting', range: normalRange, sortText: '010' },
    { label: 'enumitem', kind: kinds.Module, documentation: 'Custom list formatting', range: normalRange, sortText: '010' },
    { label: 'xcolor', kind: kinds.Module, documentation: 'Color support', range: normalRange, sortText: '010' },
    { label: 'tikz', kind: kinds.Module, documentation: 'TikZ graphics', range: normalRange, sortText: '010' },
    { label: 'pgfplots', kind: kinds.Module, documentation: 'PGF Plots for data visualization', range: normalRange, sortText: '010' },
    { label: 'listings', kind: kinds.Module, documentation: 'Code listings with syntax highlighting', range: normalRange, sortText: '010' },
    { label: 'minted', kind: kinds.Module, documentation: 'Syntax-highlighted code (requires pygmentize)', range: normalRange, sortText: '010' },
    { label: 'algorithm2e', kind: kinds.Module, documentation: 'Algorithm typesetting', range: normalRange, sortText: '010' },
    { label: 'algorithmic', kind: kinds.Module, documentation: 'Algorithm pseudocode', range: normalRange, sortText: '010' },
    { label: 'natbib', kind: kinds.Module, documentation: 'Natural-sciences bibliography citations', range: normalRange, sortText: '010' },
    { label: 'biblatex', kind: kinds.Module, documentation: 'Modern bibliography processing', range: normalRange, sortText: '010' },
    { label: 'siunitx', kind: kinds.Module, documentation: 'SI units and numbers formatting', range: normalRange, sortText: '010' },
    { label: 'subcaption', kind: kinds.Module, documentation: 'Subfigure and subtable support', range: normalRange, sortText: '010' },
    { label: 'subfig', kind: kinds.Module, documentation: 'Subfigure support (legacy)', range: normalRange, sortText: '010' },
    { label: 'float', kind: kinds.Module, documentation: 'Fine-grained float control', range: normalRange, sortText: '010' },
    { label: 'caption', kind: kinds.Module, documentation: 'Custom caption formatting', range: normalRange, sortText: '010' },
    { label: 'lipsum', kind: kinds.Module, documentation: 'Lorem ipsum placeholder text', range: normalRange, sortText: '010' },

    // ═══════════════════════════════════════════════════════════════════════
    // COMMON COMMANDS
    // ═══════════════════════════════════════════════════════════════════════
    {
      label: 'includegraphics',
      kind: kinds.Function,
      insertText: '\\includegraphics[width=${1:0.8}\\textwidth]{${2:filename}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\includegraphics',
      documentation: 'Include an image file'
    },
    {
      label: 'input',
      kind: kinds.Function,
      insertText: '\\input{${1:filename}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\input',
      documentation: 'Input another .tex file'
    },
    {
      label: 'include',
      kind: kinds.Function,
      insertText: '\\include{${1:filename}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\include',
      documentation: 'Include file (starts new page)'
    },
    {
      label: 'textbf',
      kind: kinds.Function,
      insertText: '\\textbf{${1:bold text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\textbf',
      documentation: 'Bold text'
    },
    {
      label: 'textit',
      kind: kinds.Function,
      insertText: '\\textit{${1:italic text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\textit',
      documentation: 'Italic text'
    },
    {
      label: 'texttt',
      kind: kinds.Function,
      insertText: '\\texttt{${1:monospace text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\texttt',
      documentation: 'Monospace / typewriter text'
    },
    {
      label: 'emph',
      kind: kinds.Function,
      insertText: '\\emph{${1:emphasized text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\emph',
      documentation: 'Emphasized text'
    },
    {
      label: 'footnote',
      kind: kinds.Function,
      insertText: '\\footnote{${1:footnote text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\footnote',
      documentation: 'Insert footnote'
    },
    {
      label: 'textcolor',
      kind: kinds.Function,
      insertText: '\\textcolor{${1:red}}{${2:colored text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\textcolor',
      documentation: 'Colored text (xcolor package)'
    },
    {
      label: 'hrulefill',
      kind: kinds.Function,
      insertText: '\\hrulefill',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\hrulefill',
      documentation: 'Horizontal rule fill'
    },
    {
      label: 'hline',
      kind: kinds.Function,
      insertText: '\\hline',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\hline',
      documentation: 'Horizontal line in tables'
    },
    {
      label: 'noindent',
      kind: kinds.Function,
      insertText: '\\noindent',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\noindent',
      documentation: 'Suppress paragraph indentation'
    },
    {
      label: 'indent',
      kind: kinds.Function,
      insertText: '\\indent',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\indent',
      documentation: 'Force paragraph indentation'
    },
    {
      label: 'linebreak',
      kind: kinds.Function,
      insertText: '\\linebreak[${1:4}]',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\linebreak',
      documentation: 'Force line break'
    },
    {
      label: 'newline',
      kind: kinds.Function,
      insertText: '\\newline',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\newline',
      documentation: 'New line'
    },
    {
      label: 'centering',
      kind: kinds.Function,
      insertText: '\\centering',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\centering',
      documentation: 'Center content horizontally'
    },
    {
      label: 'raggedright',
      kind: kinds.Function,
      insertText: '\\raggedright',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\raggedright',
      documentation: 'Left-aligned text'
    },
    {
      label: 'raggedleft',
      kind: kinds.Function,
      insertText: '\\raggedleft',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\raggedleft',
      documentation: 'Right-aligned text'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // MATH COMMANDS
    // ═══════════════════════════════════════════════════════════════════════
    {
      label: 'frac',
      kind: kinds.Operator,
      insertText: '\\frac{${1:numerator}}{${2:denominator}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\frac',
      documentation: 'Fraction'
    },
    {
      label: 'dfrac',
      kind: kinds.Operator,
      insertText: '\\dfrac{${1:numerator}}{${2:denominator}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\dfrac',
      documentation: 'Display-size fraction'
    },
    {
      label: 'tfrac',
      kind: kinds.Operator,
      insertText: '\\tfrac{${1:numerator}}{${2:denominator}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\tfrac',
      documentation: 'Text-size fraction'
    },
    {
      label: 'sqrt',
      kind: kinds.Operator,
      insertText: '\\sqrt{${1:value}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\sqrt',
      documentation: 'Square root'
    },
    {
      label: 'sqrt[n]',
      kind: kinds.Operator,
      insertText: '\\sqrt[${1:n}]{${2:value}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\sqrt[',
      documentation: 'Nth root'
    },
    {
      label: 'sum',
      kind: kinds.Operator,
      insertText: '\\sum_{${1:i=0}}^{${2:n}} ${3:expression}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\sum',
      documentation: 'Summation'
    },
    {
      label: 'prod',
      kind: kinds.Operator,
      insertText: '\\prod_{${1:i=1}}^{${2:n}} ${3:expression}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\prod',
      documentation: 'Product'
    },
    {
      label: 'int',
      kind: kinds.Operator,
      insertText: '\\int_{${1:a}}^{${2:b}} ${3:f(x)} \\, ${4:dx}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\int',
      documentation: 'Definite integral'
    },
    {
      label: 'lim',
      kind: kinds.Operator,
      insertText: '\\lim_{${1:x \\to \\infty}} ${2:expression}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\lim',
      documentation: 'Limit'
    },
    {
      label: 'mathrm',
      kind: kinds.Operator,
      insertText: '\\mathrm{${1:text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\mathrm',
      documentation: 'Roman text in math mode'
    },
    {
      label: 'mathbf',
      kind: kinds.Operator,
      insertText: '\\mathbf{${1:text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\mathbf',
      documentation: 'Bold math text'
    },
    {
      label: 'mathcal',
      kind: kinds.Operator,
      insertText: '\\mathcal{${1:text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\mathcal',
      documentation: 'Calligraphic math font'
    },
    {
      label: 'mathbb',
      kind: kinds.Operator,
      insertText: '\\mathbb{${1:text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\mathbb',
      documentation: 'Blackboard bold (ℝ, ℕ, etc.)'
    },
    {
      label: 'overline',
      kind: kinds.Operator,
      insertText: '\\overline{${1:text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\overline',
      documentation: 'Overline decoration'
    },
    {
      label: 'underline',
      kind: kinds.Operator,
      insertText: '\\underline{${1:text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\underline',
      documentation: 'Underline decoration'
    },
    {
      label: 'hat',
      kind: kinds.Operator,
      insertText: '\\hat{${1:x}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\hat',
      documentation: 'Hat accent'
    },
    {
      label: 'bar',
      kind: kinds.Operator,
      insertText: '\\bar{${1:x}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\bar',
      documentation: 'Bar accent'
    },
    {
      label: 'dot',
      kind: kinds.Operator,
      insertText: '\\dot{${1:x}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\dot',
      documentation: 'Dot accent'
    },
    {
      label: 'vec',
      kind: kinds.Operator,
      insertText: '\\vec{${1:x}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\vec',
      documentation: 'Vector arrow accent'
    },
    {
      label: 'text',
      kind: kinds.Operator,
      insertText: '\\text{${1:text}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\text',
      documentation: 'Text in math mode'
    },
    {
      label: 'boldsymbol',
      kind: kinds.Operator,
      insertText: '\\boldsymbol{${1:symbol}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\boldsymbol',
      documentation: 'Bold math symbol'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // GREEK LETTERS
    // ═══════════════════════════════════════════════════════════════════════
    { label: 'alpha', kind: kinds.Variable, insertText: '\\alpha', range: commandRange, filterText: '\\alpha', documentation: 'Greek alpha (α)' },
    { label: 'beta', kind: kinds.Variable, insertText: '\\beta', range: commandRange, filterText: '\\beta', documentation: 'Greek beta (β)' },
    { label: 'gamma', kind: kinds.Variable, insertText: '\\gamma', range: commandRange, filterText: '\\gamma', documentation: 'Greek gamma (γ)' },
    { label: 'delta', kind: kinds.Variable, insertText: '\\delta', range: commandRange, filterText: '\\delta', documentation: 'Greek delta (δ)' },
    { label: 'epsilon', kind: kinds.Variable, insertText: '\\epsilon', range: commandRange, filterText: '\\epsilon', documentation: 'Greek epsilon (ε)' },
    { label: 'theta', kind: kinds.Variable, insertText: '\\theta', range: commandRange, filterText: '\\theta', documentation: 'Greek theta (θ)' },
    { label: 'lambda', kind: kinds.Variable, insertText: '\\lambda', range: commandRange, filterText: '\\lambda', documentation: 'Greek lambda (λ)' },
    { label: 'mu', kind: kinds.Variable, insertText: '\\mu', range: commandRange, filterText: '\\mu', documentation: 'Greek mu (μ)' },
    { label: 'pi', kind: kinds.Variable, insertText: '\\pi', range: commandRange, filterText: '\\pi', documentation: 'Greek pi (π)' },
    { label: 'sigma', kind: kinds.Variable, insertText: '\\sigma', range: commandRange, filterText: '\\sigma', documentation: 'Greek sigma (σ)' },
    { label: 'phi', kind: kinds.Variable, insertText: '\\phi', range: commandRange, filterText: '\\phi', documentation: 'Greek phi (φ)' },
    { label: 'psi', kind: kinds.Variable, insertText: '\\psi', range: commandRange, filterText: '\\psi', documentation: 'Greek psi (ψ)' },
    { label: 'omega', kind: kinds.Variable, insertText: '\\omega', range: commandRange, filterText: '\\omega', documentation: 'Greek omega (ω)' },
    { label: 'Gamma', kind: kinds.Variable, insertText: '\\Gamma', range: commandRange, filterText: '\\Gamma', documentation: 'Greek Gamma (Γ)' },
    { label: 'Delta', kind: kinds.Variable, insertText: '\\Delta', range: commandRange, filterText: '\\Delta', documentation: 'Greek Delta (Δ)' },
    { label: 'Theta', kind: kinds.Variable, insertText: '\\Theta', range: commandRange, filterText: '\\Theta', documentation: 'Greek Theta (Θ)' },
    { label: 'Lambda', kind: kinds.Variable, insertText: '\\Lambda', range: commandRange, filterText: '\\Lambda', documentation: 'Greek Lambda (Λ)' },
    { label: 'Sigma', kind: kinds.Variable, insertText: '\\Sigma', range: commandRange, filterText: '\\Sigma', documentation: 'Greek Sigma (Σ)' },
    { label: 'Phi', kind: kinds.Variable, insertText: '\\Phi', range: commandRange, filterText: '\\Phi', documentation: 'Greek Phi (Φ)' },
    { label: 'Omega', kind: kinds.Variable, insertText: '\\Omega', range: commandRange, filterText: '\\Omega', documentation: 'Greek Omega (Ω)' },

    // ═══════════════════════════════════════════════════════════════════════
    // MATH SYMBOLS
    // ═══════════════════════════════════════════════════════════════════════
    { label: 'infty', kind: kinds.Variable, insertText: '\\infty', range: commandRange, filterText: '\\infty', documentation: 'Infinity (∞)' },
    { label: 'partial', kind: kinds.Variable, insertText: '\\partial', range: commandRange, filterText: '\\partial', documentation: 'Partial derivative (∂)' },
    { label: 'nabla', kind: kinds.Variable, insertText: '\\nabla', range: commandRange, filterText: '\\nabla', documentation: 'Nabla / del (∇)' },
    { label: 'forall', kind: kinds.Variable, insertText: '\\forall', range: commandRange, filterText: '\\forall', documentation: 'For all (∀)' },
    { label: 'exists', kind: kinds.Variable, insertText: '\\exists', range: commandRange, filterText: '\\exists', documentation: 'Exists (∃)' },
    { label: 'in', kind: kinds.Variable, insertText: '\\in', range: commandRange, filterText: '\\in ', documentation: 'Element of (∈)' },
    { label: 'notin', kind: kinds.Variable, insertText: '\\notin', range: commandRange, filterText: '\\notin', documentation: 'Not element of (∉)' },
    { label: 'subset', kind: kinds.Variable, insertText: '\\subset', range: commandRange, filterText: '\\subset', documentation: 'Subset (⊂)' },
    { label: 'supset', kind: kinds.Variable, insertText: '\\supset', range: commandRange, filterText: '\\supset', documentation: 'Superset (⊃)' },
    { label: 'cup', kind: kinds.Variable, insertText: '\\cup', range: commandRange, filterText: '\\cup', documentation: 'Union (∪)' },
    { label: 'cap', kind: kinds.Variable, insertText: '\\cap', range: commandRange, filterText: '\\cap', documentation: 'Intersection (∩)' },
    { label: 'emptyset', kind: kinds.Variable, insertText: '\\emptyset', range: commandRange, filterText: '\\emptyset', documentation: 'Empty set (∅)' },
    { label: 'pm', kind: kinds.Variable, insertText: '\\pm', range: commandRange, filterText: '\\pm', documentation: 'Plus-minus (±)' },
    { label: 'mp', kind: kinds.Variable, insertText: '\\mp', range: commandRange, filterText: '\\mp', documentation: 'Minus-plus (∓)' },
    { label: 'times', kind: kinds.Variable, insertText: '\\times', range: commandRange, filterText: '\\times', documentation: 'Multiplication (×)' },
    { label: 'div', kind: kinds.Variable, insertText: '\\div', range: commandRange, filterText: '\\div', documentation: 'Division (÷)' },
    { label: 'cdot', kind: kinds.Variable, insertText: '\\cdot', range: commandRange, filterText: '\\cdot', documentation: 'Center dot (·)' },
    { label: 'leq', kind: kinds.Variable, insertText: '\\leq', range: commandRange, filterText: '\\leq', documentation: 'Less than or equal (≤)' },
    { label: 'geq', kind: kinds.Variable, insertText: '\\geq', range: commandRange, filterText: '\\geq', documentation: 'Greater than or equal (≥)' },
    { label: 'neq', kind: kinds.Variable, insertText: '\\neq', range: commandRange, filterText: '\\neq', documentation: 'Not equal (≠)' },
    { label: 'approx', kind: kinds.Variable, insertText: '\\approx', range: commandRange, filterText: '\\approx', documentation: 'Approximately (≈)' },
    { label: 'equiv', kind: kinds.Variable, insertText: '\\equiv', range: commandRange, filterText: '\\equiv', documentation: 'Equivalent (≡)' },
    { label: 'sim', kind: kinds.Variable, insertText: '\\sim', range: commandRange, filterText: '\\sim', documentation: 'Similar to (∼)' },
    { label: 'rightarrow', kind: kinds.Variable, insertText: '\\rightarrow', range: commandRange, filterText: '\\rightarrow', documentation: 'Right arrow (→)' },
    { label: 'leftarrow', kind: kinds.Variable, insertText: '\\leftarrow', range: commandRange, filterText: '\\leftarrow', documentation: 'Left arrow (←)' },
    { label: 'Rightarrow', kind: kinds.Variable, insertText: '\\Rightarrow', range: commandRange, filterText: '\\Rightarrow', documentation: 'Double right arrow (⇒)' },
    { label: 'Leftarrow', kind: kinds.Variable, insertText: '\\Leftarrow', range: commandRange, filterText: '\\Leftarrow', documentation: 'Double left arrow (⇐)' },
    { label: 'leftrightarrow', kind: kinds.Variable, insertText: '\\leftrightarrow', range: commandRange, filterText: '\\leftrightarrow', documentation: 'Double arrow (↔)' },
    { label: 'ldots', kind: kinds.Variable, insertText: '\\ldots', range: commandRange, filterText: '\\ldots', documentation: 'Low dots (…)' },
    { label: 'cdots', kind: kinds.Variable, insertText: '\\cdots', range: commandRange, filterText: '\\cdots', documentation: 'Center dots (⋯)' },
    { label: 'vdots', kind: kinds.Variable, insertText: '\\vdots', range: commandRange, filterText: '\\vdots', documentation: 'Vertical dots (⋮)' },
    { label: 'ddots', kind: kinds.Variable, insertText: '\\ddots', range: commandRange, filterText: '\\ddots', documentation: 'Diagonal dots (⋱)' },
    { label: 'prime', kind: kinds.Variable, insertText: '\\prime', range: commandRange, filterText: '\\prime', documentation: 'Prime symbol (′)' },
    { label: 'star', kind: kinds.Variable, insertText: '\\star', range: commandRange, filterText: '\\star', documentation: 'Star (⋆)' },
    { label: 'circ', kind: kinds.Variable, insertText: '\\circ', range: commandRange, filterText: '\\circ', documentation: 'Circle (∘)' },
    { label: 'diamond', kind: kinds.Variable, insertText: '\\diamond', range: commandRange, filterText: '\\diamond', documentation: 'Diamond (⋄)' },

    // ═══════════════════════════════════════════════════════════════════════
    // CITATIONS & REFERENCES
    // ═══════════════════════════════════════════════════════════════════════
    { label: 'cite', kind: kinds.Reference, insertText: '\\cite{${1:key}}', insertTextRules: 4, range: commandRange, filterText: '\\cite', documentation: 'Citation reference' },
    { label: 'citep', kind: kinds.Reference, insertText: '\\citep{${1:key}}', insertTextRules: 4, range: commandRange, filterText: '\\citep', documentation: 'Parenthetical citation (natbib)' },
    { label: 'citet', kind: kinds.Reference, insertText: '\\citet{${1:key}}', insertTextRules: 4, range: commandRange, filterText: '\\citet', documentation: 'Textual citation (natbib)' },
    { label: 'citeauthor', kind: kinds.Reference, insertText: '\\citeauthor{${1:key}}', insertTextRules: 4, range: commandRange, filterText: '\\citeauthor', documentation: 'Cite author name only' },
    { label: 'citeyear', kind: kinds.Reference, insertText: '\\citeyear{${1:key}}', insertTextRules: 4, range: commandRange, filterText: '\\citeyear', documentation: 'Cite year only' },
    { label: 'ref', kind: kinds.Reference, insertText: '\\ref{${1:key}}', insertTextRules: 4, range: commandRange, filterText: '\\ref', documentation: 'Cross-reference' },
    { label: 'pageref', kind: kinds.Reference, insertText: '\\pageref{${1:key}}', insertTextRules: 4, range: commandRange, filterText: '\\pageref', documentation: 'Page number reference' },
    { label: 'eqref', kind: kinds.Reference, insertText: '\\eqref{${1:key}}', insertTextRules: 4, range: commandRange, filterText: '\\eqref', documentation: 'Equation reference (AMS)' },
    { label: 'label', kind: kinds.Reference, insertText: '\\label{${1:key}}', insertTextRules: 4, range: commandRange, filterText: '\\label', documentation: 'Define reference label' },
    { label: 'href', kind: kinds.Reference, insertText: '\\href{${1:url}}{${2:text}}', insertTextRules: 4, range: commandRange, filterText: '\\href', documentation: 'Hyperlink' },
    { label: 'url', kind: kinds.Reference, insertText: '\\url{${1:url}}', insertTextRules: 4, range: commandRange, filterText: '\\url', documentation: 'Display URL' },

    // ═══════════════════════════════════════════════════════════════════════
    // ENVIRONMENT CLOSING
    // ═══════════════════════════════════════════════════════════════════════
    {
      label: 'end',
      kind: kinds.Function,
      insertText: '\\end{${1:environment}}',
      insertTextRules: 4,
      range: commandRange,
      filterText: '\\end',
      documentation: 'Close an environment'
    },
  ];

  return suggestions;
};
