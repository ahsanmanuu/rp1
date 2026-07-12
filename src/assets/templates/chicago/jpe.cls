% jpe.cls - Minimal stub for Chicago JPE
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{jpe}[2026/04/30 Chicago stub]
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
