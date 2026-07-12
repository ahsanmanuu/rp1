% cv.cls - Minimal stub for CV/Resume
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{cv}[2026/04/30 CV stub]
\LoadClass[11pt]{article}
\RequirePackage{geometry}
\geometry{margin=0.75in}
\RequirePackage{hyperref}

\newcommand{\contact}[4]{
  \begin{center}
    {\huge \bfseries \@author \par}
    \vspace{0.5em}
    #1 | #2 | #3 | #4
  \end{center}
}

\newenvironment{cvsection}[1]{
  \vspace{1em}
  {\Large \bfseries #1 \par}
  \hrule
  \vspace{0.5em}
}{ \vspace{0.5em} }

\newcommand{\cventry}[4]{
  \textbf{#1} \hfill #2 \\
  \textit{#3} \hfill \textit{#4} \par
}
