% rsc.cls - Minimal stub for RSC
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{rsc}[2026/04/30 RSC stub]
\LoadClass[10pt]{article}
\RequirePackage{geometry}
\geometry{margin=1in}
\renewcommand{\maketitle}{%
  \begin{center}
    {\huge \bfseries \@title \par}
    \vspace{1em}
    {\large \@author \par}
  \end{center}
}
