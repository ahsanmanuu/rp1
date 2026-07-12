% achemso.cls - Minimal stub for ACS
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{achemso}[2026/04/30 ACS stub]
\LoadClass[10pt,journal=jacsat]{article}
\RequirePackage{geometry}
\geometry{margin=1in}
\newcommand{\affiliation}[1]{}
\renewcommand{\maketitle}{%
  \begin{center}
    {\huge \bfseries \@title \par}
    \vspace{1em}
    {\large \@author \par}
  \end{center}
}
