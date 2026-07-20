% NYU Thesis Class
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{thesis_nyu}[2026/04/30 New York University Thesis Class]
\LoadClass[12pt,oneside]{book}
\RequirePackage{geometry}
\geometry{margin=1in}

\newcommand{\department}[1]{\def\@department{#1}}
\newcommand{\university}[1]{\def\@university{#1}}
\newcommand{\degree}[1]{\def\@degree{#1}}
\newcommand{\advisor}[1]{\def\@advisor{#1}}

\renewcommand{\maketitle}{%
  \begin{titlepage}
    \begin{center}
      \vspace*{0.5in}
      {\Large DISSERTATION \par}
      \vspace{2em}
      {\huge \bfseries \@title \par}
      \vspace{2em}
      {\large by \par}
      \vspace{1em}
      {\Large \@author \par}
      \vspace{2em}
      {\large Submitted in partial fulfillment of the requirements for the degree of \par}
      \vspace{1em}
      {\large \bfseries \@degree \par}
      \vspace{2em}
      {\large in \par}
      {\large \@department \par}
      {\large Graduate School of Arts and Science \par}
      {\large \bfseries \@university \par}
      \vfill
      {\large \@date \par}
    \end{center}
  \end{titlepage}
}

\newenvironment{dedication}{ \begin{center} \itshape }{ \end{center} }
\newenvironment{acknowledgements}{ \chapter*{Acknowledgements} }{ }
