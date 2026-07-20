% Caltech Thesis Class
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{thesis_caltech}[2026/04/30 Caltech Thesis Class]
\LoadClass[11pt,oneside]{book}
\RequirePackage{geometry}
\geometry{margin=1in}

\newcommand{\department}[1]{\def\@department{#1}}
\newcommand{\university}[1]{\def\@university{#1}}
\newcommand{\degree}[1]{\def\@degree{#1}}
\newcommand{\advisor}[1]{\def\@advisor{#1}}

\renewcommand{\maketitle}{%
  \begin{titlepage}
    \begin{center}
      \vspace*{1.5in}
      {\huge \bfseries \@title \par}
      \vspace{2em}
      {\large by \par}
      \vspace{1em}
      {\Large \@author \par}
      \vspace{2em}
      {\large A thesis submitted to \par}
      {\large \bfseries \@university \par}
      \vspace{2em}
      {\large for the degree of \par}
      {\large \bfseries \@degree \par}
      \vspace{1em}
      {\large \@department \par}
      \vfill
      {\large \@date \par}
    \end{center}
  \end{titlepage}
}

\newenvironment{dedication}{ \begin{center} \itshape }{ \end{center} }
\newenvironment{acknowledgements}{ \chapter*{Acknowledgements} }{ }
