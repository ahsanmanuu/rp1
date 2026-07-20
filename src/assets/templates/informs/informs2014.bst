% informs2014.bst - Functional numeric bibliography style for INFORMS templates.
% Emits \bibitem{<key>} entries (wrapped in a `thebibliography` environment)
% so \cite{<key>} resolves to a [n] label. It is intentionally written with
% direct `write$` calls (no output-state machine) for robustness across the
% tectonic BibTeX engine.

ENTRY
  { address author booktitle chapter edition editor howpublished institution
    journal key month note number organization pages publisher school series
    title type volume year }
  {}
  { label }

STRINGS { s t }

FUNCTION {bibitem}
{ newline$
  "\bibitem{" write$
  cite$ write$
  "}" write$
  newline$
}

FUNCTION {fmt.names}
{ 's := s }

FUNCTION {fmt.authors}
{ author empty$
    { "" }
    { author fmt.names }
  if$
}

FUNCTION {fmt.editors}
{ editor empty$
    { "" }
    { editor fmt.names ", editors" * }
  if$
}

FUNCTION {article}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  journal empty$
    { "no journal" }
    { journal }
  if$
  write$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {book}
{ bibitem
  author empty$ { editor fmt.editors } { author fmt.names } if$ write$
  newline$
  title write$
  newline$
  publisher empty$ 'skip$ { publisher write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {incollection}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  "In " editor fmt.editors write$
  booktitle empty$ 'skip$ { " " booktitle write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {inproceedings}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  "In " editor fmt.editors write$
  booktitle empty$ 'skip$ { " " booktitle write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {techreport}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  institution empty$ 'skip$ { institution write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {misc}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  howpublished empty$ 'skip$ { howpublished write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {phdthesis}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  "PhD thesis" write$
  school empty$ 'skip$ { ", " school * write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {mastersthesis}
{ bibitem
  author fmt.names write$
  newline$
  title write$
  newline$
  "Master's thesis" write$
  school empty$ 'skip$ { ", " school * write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {proceedings}
{ bibitem
  editor empty$
    { title }
    { editor fmt.editors ", " title * }
  if$
  write$
  newline$
  publisher empty$ 'skip$ { publisher write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {manual}
{ bibitem
  author empty$ { organization } { author fmt.names } if$ write$
  newline$
  title write$
  newline$
  organization empty$ 'skip$ { organization write$ } if$
  year empty$ 'skip$ { " " year * write$ } if$
  newline$
}

FUNCTION {default.type} { misc }

MACRO {jan} {"January"}
MACRO {feb} {"February"}
MACRO {mar} {"March"}
MACRO {apr} {"April"}
MACRO {may} {"May"}
MACRO {jun} {"June"}
MACRO {jul} {"July"}
MACRO {aug} {"August"}
MACRO {sep} {"September"}
MACRO {oct} {"October"}
MACRO {nov} {"November"}
MACRO {dec} {"December"}

READ

FUNCTION {begin.bib}
{ "\begin{thebibliography}{99}" write$ newline$ }

EXECUTE {begin.bib}

ITERATE { call.type$ }

REVERSE { newline$ }

FUNCTION {end.bib}
{ newline$
  "\end{thebibliography}" write$ newline$ }

EXECUTE {end.bib}
