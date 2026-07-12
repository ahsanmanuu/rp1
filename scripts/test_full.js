const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function test() {
  const dir = 'public/uploads/projects/cmo0aawbb00001kg4fzyqbijv';
  const diskFiles = fs.readdirSync(dir);
  const resources = [];
  const PROXY = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

  for (const filename of diskFiles) {
    const filePath = path.join(dir, filename);
    const ext = filename.split('.').pop().toLowerCase();
    const isImg = /^(png|jpg|jpeg|webp|gif|tif|tiff|bmp|svg|avif|ico)$/.test(ext);
    
    if (filename === 'main.tex') continue;

    if (isImg) {
      try {
        let buf = fs.readFileSync(filePath);
        if (buf.length > 150*1024) buf = fs.readFileSync(filePath); // dummy sharp bypass
        resources.push({ path: filename, file: buf.toString('base64') });
      } catch { resources.push({ path: filename, file: PROXY }); }
    } else if (ext !== 'pdf') {
       resources.push({ path: filename, content: fs.readFileSync(filePath,'utf8') });
    }
  }

  // user's exact input
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

  const docClass = userContent.match(/\\documentclass(?:\[.*?\])?\{(.*?)\}/)?.[1] || 'article';
  const sanitized = userContent.split('\n').map(line => {
    const t = line.trim();
    if (t.match(/\\usepackage\[.*?\]\{breakurl\}/) || t.match(/\\usepackage\{breakurl\}/)) return '\\usepackage[hyphens]{url}';
    if (docClass.includes('wlscirep') && t.match(/\\usepackage\[export\]\{adjustbox\}/)) return '\\usepackage{adjustbox}';
    if (docClass.includes('wlscirep') && (t.startsWith('\\setkeys{Gin}') || t.match(/\\ifdefined\\setkeys\\setkeys\{Gin\}/))) return '% setkeys';
    return line;
  }).join('\n');
  
  resources.push({ path: 'main.tex', content: sanitized, main: true });

  const payload = JSON.stringify({ compiler:'pdflatex', resources });
  const r = await fetch('https://latex.ytotech.com/builds/sync',{method:'POST',body:payload,headers:{'content-type':'application/json'}});
  if(r.ok) console.log('SUCCESS! 201 OK');
  else {
    const t = await r.text();
    fs.writeFileSync('test_out_full.json', t);
    console.error('FAILED!', t.substring(0, 50));
  }
}
test().catch(console.error);
