% scifile.cls - Minimal stub for Science Magazine
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{scifile}[2026/04/30 Science stub]
\LoadClass[12pt]{article}
\RequirePackage{times}
\RequirePackage{geometry}
\geometry{margin=1in}
\renewcommand{\maketitle}{%
  \begin{center}
    {\huge \bfseries \@title \par}
    \vspace{1em}
    {\large \@author \par}
  \end{center}
}
\renewenvironment{abstract}{ \bfseries Abstract: \normalfont }{}
