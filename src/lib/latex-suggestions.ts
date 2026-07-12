import { type StudioFile } from './studio-fs';

export const getLatexSuggestions = (monaco: any, range: any, files: StudioFile[] = []) => {
  const kinds = monaco.languages.CompletionItemKind;
  const rules = monaco.languages.CompletionItemInsertValueRule;

  const suggestions = [
    // --- BASIC STRUCTURE ---
    { label: 'documentclass', kind: kinds.Function, insertText: '\\documentclass[${1:options}]{${2:article}}', insertTextRules: rules.InsertAsSnippet, range, documentation: 'Structural start of the document' },
    { label: 'usepackage', kind: kinds.Function, insertText: '\\usepackage{${1:package}}', insertTextRules: rules.InsertAsSnippet, range, documentation: 'Import LaTeX packages' },
    { label: 'begin', kind: kinds.Function, insertText: '\\begin{${1:environment}}\n\t$0\n\\end{$1}', insertTextRules: rules.InsertAsSnippet, range, documentation: 'Generic environment block' },
    { label: 'section', kind: kinds.Function, insertText: '\\section{${1:title}}', insertTextRules: rules.InsertAsSnippet, range, documentation: 'Primary section heading' },
    { label: 'subsection', kind: kinds.Function, insertText: '\\subsection{${1:title}}', insertTextRules: rules.InsertAsSnippet, range, documentation: 'Secondary section heading' },
    { label: 'subsubsection', kind: kinds.Function, insertText: '\\subsubsection{${1:title}}', insertTextRules: rules.InsertAsSnippet, range, documentation: 'Tertiary section heading' },
    
    // --- FILESYSTEM AWARE SUGGESTIONS ---
    ...files.map(f => {
      const isImage = ['png', 'jpg', 'jpeg', 'pdf', 'svg'].some(ext => f.path.toLowerCase().endsWith(ext));
      const isTex = f.path.toLowerCase().endsWith('.tex');
      
      return {
        label: f.path,
        kind: isImage ? kinds.File : (isTex ? kinds.Reference : kinds.Text),
        insertText: f.path,
        documentation: `Project asset: ${f.path}`,
        range,
        sortText: '001' // Prioritize project files
      };
    }),

    // --- COMPLEX CODE SEGMENTS ---
    {
      label: 'figure',
      kind: kinds.Snippet,
      insertText: '\\begin{figure}[h!]\n\t\\centering\n\t\\includegraphics[width=${1:0.8}\\textwidth]{${2:image_path}}\n\t\\caption{${3:caption}}\n\t\\label{fig:${4:label}}\n\\end{figure}',
      insertTextRules: rules.InsertAsSnippet,
      documentation: 'Complete High-Fidelity Figure Block',
      range
    },
    {
      label: 'table',
      kind: kinds.Snippet,
      insertText: '\\begin{table}[h!]\n\t\\centering\n\t\\caption{${1:caption}}\n\t\\label{tab:${2:label}}\n\t\\begin{tabular}{${3:|l|c|r|}}\n\t\\hline\n\t${4:Header 1} & ${5:Header 2} & ${6:Header 3} \\\\ \\hline\n\t${7:Data 1} & ${8:Data 2} & ${9:Data 3} \\\\ \\hline\n\t\\end{tabular}\n\\end{table}',
      insertTextRules: rules.InsertAsSnippet,
      documentation: 'Complete High-Fidelity Table Block',
      range
    },
    {
      label: 'abstract',
      kind: kinds.Snippet,
      insertText: '\\begin{abstract}\n\t${1:This research explores...}\n\\end{abstract}',
      insertTextRules: rules.InsertAsSnippet,
      documentation: 'Academic Abstract Block',
      range
    },

    // --- PACKAGES & MATH ---
    { label: 'amsmath', kind: kinds.Module, documentation: 'Mathematical formulas (AMS)', range },
    { label: 'amssymb', kind: kinds.Module, documentation: 'Mathematical symbols (AMS)', range },
    { label: 'equation', kind: kinds.Snippet, insertText: '\\begin{equation}\n\t${1:math}\n\t\\label{eq:${2:label}}\n\\end{equation}', insertTextRules: rules.InsertAsSnippet, range },
    { label: 'itemize', kind: kinds.Snippet, insertText: '\\begin{itemize}\n\t\\item $0\n\\end{itemize}', insertTextRules: rules.InsertAsSnippet, range },
    { label: 'enumerate', kind: kinds.Snippet, insertText: '\\begin{enumerate}\n\t\\item $0\n\\end{enumerate}', insertTextRules: rules.InsertAsSnippet, range },

    // --- MATH SYMBOLS ---
    { label: 'alpha', kind: kinds.Variable, insertText: '\\alpha', range },
    { label: 'beta', kind: kinds.Variable, insertText: '\\beta', range },
    { label: 'frac', kind: kinds.Operator, insertText: '\\frac{${1:numerator}}{${2:denominator}}', insertTextRules: rules.InsertAsSnippet, range },
    { label: 'sqrt', kind: kinds.Operator, insertText: '\\sqrt{${1:value}}', insertTextRules: rules.InsertAsSnippet, range },

    // --- CITATIONS & REFS ---
    { label: 'cite', kind: kinds.Reference, insertText: '\\cite{${1:key}}', insertTextRules: rules.InsertAsSnippet, range, documentation: 'Insert Citation' },
    { label: 'ref', kind: kinds.Reference, insertText: '\\ref{${1:key}}', insertTextRules: rules.InsertAsSnippet, range, documentation: 'Internal Cross-Reference' },
    { label: 'label', kind: kinds.Reference, insertText: '\\label{${1:key}}', insertTextRules: rules.InsertAsSnippet, range, documentation: 'Define Reference Key' },
    { label: 'href', kind: kinds.Reference, insertText: '\\href{${1:url}}{${2:text}}', insertTextRules: rules.InsertAsSnippet, range, documentation: 'Hyperlink with custom text' },
  ];

  return suggestions;
};
