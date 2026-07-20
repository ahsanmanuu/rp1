% oup.cls - Minimal stub for Oxford University Press
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{oup}[2026/04/30 OUP stub]
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
