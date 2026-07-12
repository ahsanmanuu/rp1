% imsart.cls - Minimal stub for IMS
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{imsart}[2026/04/30 IMS stub]
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
