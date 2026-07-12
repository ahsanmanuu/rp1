% acmart.cls - ACM Conference class (Two-Column)
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{acmart}[2026/05/26 ACM Conference]
\LoadClass[9pt,twocolumn]{article}
\RequirePackage{geometry}
\geometry{margin=0.75in}

% --- Author/Affiliation/Email storage ---
\newcounter{acm@authorcnt}
\renewcommand{\author}[1]{%
  \stepcounter{acm@authorcnt}%
  \global\expandafter\def\csname acm@author\theacm@authorcnt\endcsname{#1}%
  \global\expandafter\def\csname acm@inst\theacm@authorcnt\endcsname{}%
  \global\expandafter\def\csname acm@city\theacm@authorcnt\endcsname{}%
  \global\expandafter\def\csname acm@email\theacm@authorcnt\endcsname{}%
}
\newcommand{\email}[1]{%
  \global\expandafter\def\csname acm@email\theacm@authorcnt\endcsname{#1}%
}
\newcommand{\affiliation}[1]{%
  \def\institution##1{\global\expandafter\def\csname acm@inst\theacm@authorcnt\endcsname{##1}}%
  \def\city##1{\global\expandafter\def\csname acm@city\theacm@authorcnt\endcsname{##1}}%
  \def\country##1{}%
  #1%
}

% --- Other ACM command stubs (no-ops) ---
\def\state#1{}
\def\postcode#1{}
\def\setcopyright#1{}
\def\acmDOI#1{}
\def\acmISBN#1{}
\def\acmPrice#1{}
\def\acmBadgeR#1{}
\def\acmBadgeL#1{}
\def\acmYear#1{}
\def\received#1{}
\def\teaser#1{}
\def\acmBooktitle#1{}
\def\acmEdition#1{}
\def\acmSeries#1{}
\def\acmNumPages#1{}
\def\copyrightyear#1{}
\def\acmArticle#1{}
\def\acmArticleSeq#1{}
\def\startPage#1{}
\def\terms#1{}
\def\keywords#1{}
\def\abbreviations#1{}
\def\acmFormat#1{}
\def\acmCHINESE#1{}
\DeclareRobustCommand{\acmConference}[4][]{}
\def\@acm@empty{}
\long\def\acks#1{#1}
\def\acmPermission#1{}

% --- \maketitle with author, affiliation, email display ---
\newcount\@acm@i
\renewcommand{\maketitle}{%
  \twocolumn[{%
    \begin{center}
      {\huge \bfseries \@title \par}
      \vspace{1em}
      {\large
        \begin{tabular}[t]{c}%
          \@acm@i=0
          \loop
            \advance\@acm@i by 1
            \csname acm@author\the\@acm@i\endcsname
            \ifx\csname acm@email\the\@acm@i\endcsname\@acm@empty\else
              \ (\csname acm@email\the\@acm@i\endcsname)%
            \fi
            \ifx\csname acm@inst\the\@acm@i\endcsname\@acm@empty\else
              \\\small\csname acm@inst\the\@acm@i\endcsname
              \ifx\csname acm@city\the\@acm@i\endcsname\@acm@empty\else
                , \csname acm@city\the\@acm@i\endcsname
              \fi
            \fi
            \ifnum\@acm@i<\c@acm@authorcnt\par\vspace{0.3em}\fi
          \ifnum\@acm@i<\c@acm@authorcnt\repeat
        \end{tabular}%
      \par}
    \end{center}
  }]%
}
\endinput
