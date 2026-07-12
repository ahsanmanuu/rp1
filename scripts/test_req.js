const fs = require('fs');

async function test() {
  const content = `\\nonstopmode
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

  const docClass = content.match(/\\documentclass(?:\[.*?\])?\{(.*?)\}/)?.[1] || 'article';
  const sanitized = content.split('\n').map(line => {
    const t = line.trim();
    if (t.match(/\\usepackage\[.*?\]\{breakurl\}/) || t.match(/\\usepackage\{breakurl\}/)) return '\\usepackage[hyphens]{url}';
    if (docClass.includes('wlscirep') && t.match(/\\usepackage\[export\]\{adjustbox\}/)) return '\\usepackage{adjustbox}';
    if (docClass.includes('wlscirep') && (t.startsWith('\\setkeys{Gin}') || t.match(/\\ifdefined\\setkeys\\setkeys\{Gin\}/))) return '% setkeys removed';
    return line;
  }).join('\n');

  console.log('Testing against YtoTech...');
  const payload = JSON.stringify({
    compiler: 'pdflatex',
    resources: [
      { path: 'main.tex', content: sanitized, main: true },
      { path: 'wlscirep.cls', content: fs.readFileSync('public/uploads/projects/cmo0aawbb00001kg4fzyqbijv/wlscirep.cls', 'utf8') }
    ]
  });

  const r = await fetch('https://latex.ytotech.com/builds/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/pdf,application/json' },
    body: payload,
    signal: AbortSignal.timeout(30000)
  });
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('pdf')) {
    console.log('SUCCESS! PDF generated.');
  } else {
    const text = await r.text();
    let err = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed.log_files && parsed.log_files['main.log']) {
        err = parsed.log_files['main.log'].substring(0, 1000);
      } else {
        err = JSON.stringify(parsed, null, 2);
      }
    } catch(e) {}
    console.error('FAILED!', err);
  }
}
test().catch(console.error);
