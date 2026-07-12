% siamart190516.cls - Minimal stub for SIAM
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{siamart190516}[2026/04/30 SIAM stub]
\LoadClass[10pt,onecolumn]{article}
\RequirePackage{geometry}
\geometry{margin=1in}
\newcommand{\shorttitle}[1]{}
\newcommand{\shortauthor}[1]{}
\renewcommand{\maketitle}{%
  \begin{center}
    {\huge \bfseries \@title \par}
    \vspace{1em}
    {\large \@author \par}
  \end{center}
}
\newenvironment{abstract}{ \bfseries Abstract. \normalfont }{}
\newenvironment{keywords}{ \bfseries Keywords. \normalfont }{}
\newenvironment{AMS}{ \bfseries AMS subject classifications. \normalfont }{}
