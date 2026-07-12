% aa.cls - Minimal stub for Astronomy & Astrophysics
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{aa}[2026/04/30 EDP stub]
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
