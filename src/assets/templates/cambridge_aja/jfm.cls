% jfm.cls - Minimal stub for Cambridge JFM
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{jfm}[2026/04/30 JFM stub]
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
\newenvironment{abstract}{ \bfseries Abstract \normalfont }{}
