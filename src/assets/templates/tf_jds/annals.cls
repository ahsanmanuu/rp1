% annals.cls - Minimal stub for Annals of Mathematics
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{annals}[2026/04/30 Annals stub]
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
