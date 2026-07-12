% revtex4-2.cls - Minimal stub for APS
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{revtex4-2}[2026/04/30 APS stub]
\LoadClass[10pt,aps,prl,twocolumn]{article}
\RequirePackage{geometry}
\geometry{margin=0.7in}
\renewcommand{\maketitle}{%
  \twocolumn[
    \begin{center}
      {\huge \bfseries \@title \par}
      \vspace{1em}
      {\large \@author \par}
    \end{center}
  ]
}
