% aip-cp.cls - Minimal stub for AIP
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{aip-cp}[2026/04/30 AIP stub]
\LoadClass[11pt]{article}
\RequirePackage{geometry}
\geometry{margin=1in}
\renewcommand{\maketitle}{%
  \begin{center}
    {\huge \bfseries \@title \par}
    \vspace{1em}
    {\large \@author \par}
  \end{center}
}
