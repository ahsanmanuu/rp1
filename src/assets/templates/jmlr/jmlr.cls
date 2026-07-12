% jmlr.cls - Minimal stub for JMLR
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{jmlr}[2026/04/30 JMLR stub]
\LoadClass[11pt]{article}
\RequirePackage{geometry}
\geometry{margin=1in}
\newcommand{\jmlrheading}[5]{}
\newcommand{\ShortHeadings}[2]{}
\newcommand{\firstpageno}[1]{}
\renewcommand{\maketitle}{%
  \begin{center}
    {\huge \bfseries \@title \par}
    \vspace{1em}
    {\large \@author \par}
  \end{center}
}
\newenvironment{abstract}{ \bfseries Abstract \normalfont }{}
\newenvironment{keywords}{ \bfseries Keywords: \normalfont }{}
