const fs = require('fs');

async function test() {
  const userContent = `\\nonstopmode
\\documentclass[10pt]{wlscirep}
\\sloppy
\\emergencystretch=3em
\\hbadness=10000
\\vfuzz=2pt
\\hfuzz=2pt
\\let\\Bbbk\\relax
\\providecommand{\\keywords}[1]{\\par\\vspace{0.5em}\\noindent\\textbf{Keywords---} #1}
\\ifdefined\\DeclareUnicodeCharacter\\else\\long\\def\\DeclareUnicodeCharacter#1#2{}\\fi
\\DeclareUnicodeCharacter{202F}{ }
\\DeclareUnicodeCharacter{00A0}{ }
\\usepackage[hyphenbreaks]{breakurl}

\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\ifdefined\\DeclareUnicodeCharacter\\DeclareUnicodeCharacter{200B}{}\\fi
\\usepackage{graphicx}
\\usepackage{amsmath,amsfonts,amssymb}
\\usepackage{booktabs,multirow,array,tabularx}
\\usepackage[export]{adjustbox}
\\usepackage{float,caption}
\\usepackage{url}
\\usepackage{algorithm,algpseudocode}
\\usepackage{iftex,microtype}
\\graphicspath{{./}}
\\DeclareGraphicsExtensions{.pdf,.eps,.png,.PNG,.jpg,.JPG,.jpeg,.JPEG,.tif,.tiff,.bmp,.gif,.webp,.avif,.svg,.ico}
\\setkeys{Gin}{max width=\\linewidth,keepaspectratio}
\\title{Technology Scaling Impact }

\\affil[1]{Dept}
\\date{}

\\begin{document}
\\sloppy
\\emergencystretch=5em
\\ifdefined\\urlstyle\\urlstyle{same}\\fi
\\ifdefined\\Urlmuskip\\Urlmuskip=0mu plus 1mu\\fi
\\ifdefined\\setkeys\\setkeys{Gin}{max width=\\linewidth,keepaspectratio}\\fi

\\begin{abstract}
Test abstract
\\end{abstract}
\\keywords{CNT, CNTFET, OTA, IoT, DC gain, Slew rate, and Technology Node}
\\maketitle

\\section{ntroduction}
The most crucial
\\end{document}`;

  const payload = {
    engine: 'pdflatex',
    files: [
      { path: 'main.tex', content: userContent } // Let's use the explicit payload
    ],
    mainFile: 'main.tex',
    projectId: 'cmo0aawbb00001kg4fzyqbijv'
  };

  const r = await fetch('http://localhost:3000/api/latex-studio/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (r.ok) {
     const data = await r.json();
     console.log('SUCCESS API!', !!data.pdfBase64, data.log?.substring(0, 100));
     if(data.errors) console.log(data.errors);
  } else {
     console.error('FAILED API!', r.status, await r.text());
  }
}
test().catch(console.error);
