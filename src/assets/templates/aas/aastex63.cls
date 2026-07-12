% aastex63.cls - Minimal stub for AAS
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{aastex63}[2026/04/30 AAS stub]
\LoadClass[12pt]{article}
\RequirePackage{geometry}
\geometry{margin=1in}
\renewcommand{\maketitle}{%
  \begin{center}
    {\huge \bfseries \@title \par}
    \vspace{1em}
    {\large \@author \par}
  \end{center}
}
