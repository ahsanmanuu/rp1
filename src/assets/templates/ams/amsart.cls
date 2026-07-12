% amsart.cls - Minimal stub for AMS
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{amsart}[2026/04/30 AMS stub]
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
