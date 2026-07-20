% wiley-nj.cls - Minimal stub for Wiley
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{wiley-nj}[2026/04/30 Wiley stub]
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
