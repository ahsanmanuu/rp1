\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{mdpi}[2024/01/01 MDPI Article Class]

\LoadClass[a4paper,11pt]{article}

\RequirePackage[letterpaper,top=2.5cm,bottom=2.5cm,left=2cm,right=2cm]{geometry}
\RequirePackage{times}
\RequirePackage{abstract}
\RequirePackage{titlesec}
\RequirePackage{fancyhdr}

\pagestyle{fancy}
\fancyhf{}
\fancyhead[C]{\small\itshape\journaltitle}
\fancyfoot[C]{\thepage}
\renewcommand{\headrulewidth}{0.4pt}

\setlength{\parskip}{0.5em}
\setlength{\parindent}{0em}

\titleformat{\section}{\Large\bfseries}{\thesection}{1em}{}
\titleformat{\subsection}{\large\bfseries}{\thesubsection}{1em}{}
\titleformat{\subsubsection}{\normalsize\bfseries}{\thesubsubsection}{1em}{}

\renewcommand{\abstractnamefont}{\normalfont\bfseries}
\renewcommand{\abstracttextfont}{\normalfont\small}

\newcommand{\journaltitle}{MDPI}

\endinput
