% IEEEtran.cls - IEEE Journal class (Two-Column)
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{IEEEtran}[2026/05/26 IEEE Journal]
\LoadClass[10pt,twocolumn]{article}
\RequirePackage{geometry}
\geometry{margin=1in}
\long\def\IEEEtitleabstractindextext#1{\long\gdef\IEEE@saved@abstractindex{#1}}
\def\IEEEdisplaynontitleabstractindextext{} % handled inside maketitle via twocolumn[]
\long\def\IEEEauthorblockN#1{{\bfseries#1}\par}
\long\def\IEEEauthorblockA#1{#1\par}
\newenvironment{IEEEkeywords}{\par\noindent\textbf{Keywords:}}{\par}
\long\def\email#1{#1}
\renewcommand{\maketitle}{%
  \twocolumn[{%
    \begin{center}
      {\huge \bfseries \@title \par}
      \vspace{1em}
      {\large
        \begin{tabular}[t]{c}%
          \@author
        \end{tabular}%
      \par}
    \end{center}
    \vspace{0.5em}
    {\ifdefined\IEEE@saved@abstractindex\IEEE@saved@abstractindex\fi}%
  }]%
}
\endinput
