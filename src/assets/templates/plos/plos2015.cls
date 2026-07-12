% plos2015.cls - Minimal stub for PLOS
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{plos2015}[2026/04/30 PLOS stub]
\LoadClass[10pt]{article}
\RequirePackage{geometry}
\geometry{left=2in, right=0.75in, top=0.75in, bottom=0.75in}
\renewcommand{\maketitle}{%
  \begin{flushleft}
    {\huge \bfseries \@title \par}
    \vspace{1.5em}
    {\large \@author \par}
  \end{flushleft}
}
\newenvironment{abstract}{ \bfseries Abstract \normalfont }{}
