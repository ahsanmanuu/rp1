const content = `\\begin{figure}[H]
\\centering
\\zimg{rf_fig_0.png}{width=0.9\\linewidth,keepaspectratio}{fig_0}{rf_fig_0.png}
\\caption{caption}
\\label{label}
\\end{figure}`;
const zimgRegex = /\\zimg\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/g;
let m;
while ((m = zimgRegex.exec(content)) !== null) {
  console.log('Match:', m[1], m[2], m[3], m[4]);
}
