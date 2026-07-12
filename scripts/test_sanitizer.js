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
\\title{Technology Scaling Impact}
\\begin{document}
\\sloppy
\\ifdefined\\setkeys\\setkeys{Gin}{max width=\\linewidth,keepaspectratio}\\fi
\\begin{abstract}Abstract here\\end{abstract}
\\maketitle
\\section{Introduction}
Hello world.
\\end{document}`;

const docClass = content.match(/\\documentclass(?:\[.*?\])?\{(.*?)\}/)?.[1] || 'article';

function sanitize(c, dc) {
  return c.split('\n').map(line => {
    const t = line.trim();
    if (t.match(/\\usepackage\[.*?\]\{breakurl\}/) || t.match(/\\usepackage\{breakurl\}/)) {
      return '\\usepackage[hyphens]{url} % breakurl replaced';
    }
    if (dc.includes('wlscirep') && t.match(/\\usepackage\[export\]\{adjustbox\}/)) {
      return '\\usepackage{adjustbox} % [export] removed';
    }
    if (dc.includes('wlscirep') && (t.startsWith('\\setkeys{Gin}') || t.match(/\\ifdefined\\setkeys\\setkeys\{Gin\}/))) {
      return '% setkeys{Gin} removed';
    }
    return line;
  }).join('\n');
}

const result = sanitize(content, docClass);
console.log('DocClass:', docClass);
console.log('\n=== SANITIZED (showing changed lines only) ===');
const orig = content.split('\n');
const san = result.split('\n');
orig.forEach((l, i) => {
  if (l !== san[i]) console.log(`Line ${i+1}: "${l}" → "${san[i]}"`);
});
console.log('\nbreakurl removed?', !result.includes('breakurl'));
console.log('adjustbox[export] removed?', !result.includes('[export]{adjustbox}'));
console.log('setkeys{Gin} removed?', !result.split('\n').some(l => l.trim().startsWith('\\setkeys{Gin}') && !l.includes('%')));
