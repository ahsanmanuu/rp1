"use strict";exports.id=4545,exports.ids=[2553,4545],exports.modules={12447:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(30716).A)("info",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]])},70319:(a,b,c)=>{c.d(b,{i:()=>g,kT:()=>j,kl:()=>h,oM:()=>e});let d={α:"\\alpha ",β:"\\beta ",γ:"\\gamma ",δ:"\\delta ",ε:"\\epsilon ",ζ:"\\zeta ",η:"\\eta ",θ:"\\theta ",ι:"\\iota ",κ:"\\kappa ",λ:"\\lambda ",μ:"\\mu ",ν:"\\nu ",ξ:"\\xi ",ο:"o ",π:"\\pi ",ρ:"\\rho ",σ:"\\sigma ",τ:"\\tau ",υ:"\\upsilon ",φ:"\\phi ",χ:"\\chi ",ψ:"\\psi ",ω:"\\omega ",Α:"A ",Ｂ:"B ",Γ:"\\Gamma ",Δ:"\\Delta ",Ｅ:"E ",Ｚ:"Z ",Ｈ:"H ",Θ:"\\Theta ",Ｉ:"I ",Ｋ:"K ",Λ:"\\Lambda ",Ｍ:"M ",Ｎ:"N ",Ξ:"\\Xi ",Ｏ:"O ",Π:"\\Pi ",Ρ:"P ",Σ:"\\Sigma ",Ｔ:"T ",Ｙ:"\\Upsilon ",Φ:"\\Phi ",Ｘ:"X ",Ψ:"\\Psi ",Ω:"\\Omega ","\xb1":"\\pm ","\xd7":"\\times ","\xf7":"\\div ","≈":"\\approx ","≠":"\\neq ","≤":"\\leq ","≥":"\\geq ","∞":"\\infty ","∫":"\\int ","∂":"\\partial ","√":"\\sqrt ","∈":"\\in ","∉":"\\notin ","∑":"\\sum ","∏":"\\prod ","∇":"\\nabla ","∠":"\\angle ","\xb0":"^{\\circ}","…":"\\dots ","→":"\\ensuremath{\\rightarrow} ","←":"\\ensuremath{\\leftarrow} ","↔":"\\ensuremath{\\leftrightarrow} ","⇒":"\\ensuremath{\\Rightarrow} ","∘":"\\ensuremath{^{\\circ}}",ǁ:"\\ensuremath{\\parallel} ","◦":"\\ensuremath{^{\\circ}}","⋅":"\\ensuremath{\\cdot}","\xb7":"\\ensuremath{\\cdot}","−":"\\ensuremath{-}","∗":"*","⁻":"\\ensuremath{^{-}}",ɛ:"\\epsilon ",Ω:"\\Omega ","–":"--","—":"---","’":"'","‘":"`","“":"``","”":"''","∕":"/","‐":"-"};function e(a){if(!a)return"";let b=function(a){if(!a)return"";let b="",c=0,d=a.length,e=new Set(["label","ref","cite","includegraphics","begin","end","usepackage","documentclass","url","href","geometry","bibliographystyle","bibliography","addbibresource","newcommand","renewcommand","providecommand","def","hypersetup","lstset","lstlisting","input","include","import","subfile","subimport","includeonly","pageref","cref","Cref","autoref","zimg"]),f=!1,g=!1,h=0,i="",j=[],k="",l=()=>{if(k.length>25&&!j.some(a=>e.has(a.cmd))&&!f&&!g){let a="";for(let b=0;b<k.length;b+=10)b>0&&(a+="\\-"),a+=k.slice(b,b+10);k=a}b+=k,k=""};for(;c<d;){let e=a[c];if("%"===e&&!g){l(),f=!0,b+=e,c++;continue}if(f&&("\n"===e||"\r"===e)){f=!1,b+=e,c++;continue}if(f){b+=e,c++;continue}if("$"===e){l(),"$"===a[c+1]?(g=!g,b+="$$",c+=2):(g=!g,b+="$",c++);continue}if(g){b+=e,c++;continue}if("\\"===e){l(),b+=e,c++;let f="";for(;c<d&&/[a-zA-Z]/.test(a[c]);)f+=a[c],c++;b+=f,i=f;continue}if("{"===e){l(),h++,i&&(j.push({cmd:i,depth:h}),i=""),b+=e,c++;continue}if("}"===e){l(),j=j.filter(a=>a.depth<h),h=Math.max(0,h-1),b+=e,c++;continue}/[a-zA-Z0-9._\-]/.test(e)?k+=e:(l(),b+=e),c++}return l(),b}(a);for(let[a,c]of Object.entries(d))b=b.split(a).join(c);b=(b=b.replace(/\\texttimes\b/g,"\\ensuremath{\\times}")).replace(/\\textellipsis\b/g,"\\dots"),["equation","align","gather","multline","eqnarray","displaymath"].forEach(a=>{let c=RegExp(`(\\\\begin\\s*\\{\\s*${a}\\*?\\s*\\})([\\s\\S]*?)(\\\\end\\s*\\{\\s*${a}\\*?\\s*\\})`,"g");b=b.replace(c,(a,b,c,d)=>b+c.replace(/\$/g,"")+d)});let c=(b=(b=(b=(b=(b=(b=(b=(b=(b=(b=(b=(b=(b=(b=b.replace(/(\\\[)([\s\S]*?)(\\\])/g,(a,b,c,d)=>b+c.replace(/\$/g,"")+d)).replace(/color\s+color/gi,"")).replace(/color\s+color\s+bstract/gi,"")).replace(/\bbstract\b/gi,"abstract")).replace(/\\color\s*\{color\}/gi,"")).replace(/\\defaultfontfeatures\s*\{[^}]*Scale=MatchLowercase[^}]*\}/gi,"")).replace(/Scale=MatchLowercase/g,"")).replace(/\\ifPDFTeX[\s\S]*?\\else[\s\S]*?\\fi/gi,a=>a.includes("Scale=MatchLowercase")&&!a.includes("fontspec")?"% Removed phantom font feature block\n":a)).replace(/\\Beta(?![a-zA-Z])/g,"\\beta")).replace(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{epstopdf(?:,svg)?\}\s*\n?/g,"")).replace(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{svg\}\s*\n?/g,"")).replace(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{(?:[^}]*,)?epstopdf(?:,[^}]*)?\}\s*\n?/g,"")).replace(/\\(?:usepackage|RequirePackage|input)\s*\{packages\}\s*/gi,"% Removed missing local dependency\n")).replace(/\\(?:usepackage|input)\s*\{siamart190516.sty\}\s*/gi,"\\usepackage{siamart190516}\n")).match(/\\begin\s*\{\s*document\s*\}/),e=c?c.index:-1;if(-1!==e){let a=b.substring(0,e),c=b.substring(e),d=new Set;a=a.split("\n").filter(a=>{if(a.match(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/)){let b=a.trim().replace(/\s+/g," ");if(d.has(b))return!1;d.add(b)}return!0}).join("\n");let f=0;a=a.replace(/\\allowdisplaybreaks\s*\n?/g,a=>1==++f?a:"");let g=c.replace(/\\\\\s*(\\end\{|\\section|\\subsection|\\item|\\begin\{list|\\begin\{description|\\begin\{enumerate|\\begin\{itemize})/g,"$1"),h=a.match(/\\documentclass[^{]*\{([^}]+)\}/),i=h?h[1].toLowerCase():"",j=i.includes("ieee")||i.includes("acm");for(let[b,c]of[["adjustbox","\\usepackage[export]{adjustbox}"],["booktabs","\\usepackage{booktabs}"],["placeins","\\usepackage{placeins}"],["float","\\usepackage{float}"],["caption","\\usepackage[labelfont=bf,labelsep=period]{caption}"],["xurl","\\usepackage{xurl}"],["microtype","\\usepackage{microtype}"]])("caption"!==b||!j)&&(a.includes(`{${b}}`)||(a=a.trimEnd()+"\n"+c+"\n"));if(!(i.includes("ieee")||i.includes("elsarticle")||i.includes("acm")||i.includes("sn-jnl")||i.includes("wlscirep")||i.includes("llncs"))&&(g.includes("\\affil")||a.includes("\\affil")||g.includes("\\author["))&&!a.includes("{authblk}")&&(a=a.trimEnd()+"\n\\usepackage{authblk}\n"),!a.includes("UNIVERSAL SUBFIGURE FALLBACK")){let b=`
% --- UNIVERSAL SUBFIGURE FALLBACK ---
\\catcode\`\\@=11
\\@ifundefined{subfigure}{
  \\newcounter{localsubfig}[figure]
  \\newenvironment{subfigure}[2][]{%
    \\begin{minipage}{#2}%
      \\refstepcounter{localsubfig}%
      \\def\\caption##1{%
        \\par\\vspace{5pt}{\\centering\\small(\\alph{localsubfig})~##1\\par}%
      }%
  }{%
    \\end{minipage}%
  }
}{}
\\catcode\`\\@=12
`;a=a.trimEnd()+"\n"+b+"\n"}let k=[];if(a=a.replace(/(?:\\(?:renewcommand|newcommand|providecommand)\s*(?:\\Authfont|\\Affilfont|\\AuthCmd|\\AffilCmd|\{\\Authfont\}|\{\\Affilfont\}|\{\\AuthCmd\}|\{\\AffilCmd\})\s*(?:\[[^\]]*\])?\s*\{([\s\S]*?)\}|\\setlength\s*\{\s*\\affilsep\s*\}\s*\{[^{}]*\}|\\setlength\s*\\affilsep\s*\{[^{}]*\})/g,a=>(k.push(a),`% Extracted for safe AtBeginDocument ordering
`)),k.length>0){let b=k.map(a=>a.includes("\\affilsep")?`\\ifdefined\\affilsep
${a}
\\fi`:a.includes("\\Authfont")||a.includes("\\Affilfont")?`\\ifdefined\\Authfont
${a}
\\fi`:a);a=a.trimEnd()+`

% --- Safe authblk Overrides ---
\\AtBeginDocument{
${b.join("\n")}
}
`}b=a+(g=(g=g.replace(/\\\\(\s*\\hline)/g,"$1")).replace(/(\\hline\s*){2,}/g,"\\hline\n"))}return b}function f(a,b){let c=0,d=!1;for(let e=b;e<a.length;e++)if("{"===a[e])c++,d=!0;else if("}"===a[e]&&(c--,d&&0===c))return e;return -1}function g(a,b){let c,d=a,e=[],g=RegExp(`(?<!%)\\\\${b}\\*?\\s*(?:\\s*\\[[^\\]]*\\])?\\s*\\{`,"g");for(;null!==(c=g.exec(d));){let a=c.index,b=d.indexOf("{",a);if(-1===b)break;let h=f(d,b);if(-1!==h){let b=h+1;for(;b<d.length;){let a=d.slice(b).trimStart(),c=d.slice(b).length-a.length;if(a.startsWith("{")){let a=f(d,b+c);if(-1===a)break;b=a+1}else if(a.startsWith("[")){let a=b+c,e=d.indexOf("]",a);if(-1===e)break;b=e+1}else break}e.push(d.substring(a,b)),d=d.substring(0,a)+d.substring(b),g.lastIndex=0}else g.lastIndex=a+1}return{body:d,extracted:e}}function h(a){let b={title:"",authors:[],affiliations:[],abstract:"",keywords:""},c=a.match(/\\titlerunning\s*\{([^}]*)\}/i);c&&(b.runningTitle=c[1].trim());let d=a.match(/\\authorrunning\s*\{([^}]*)\}/i);d&&(b.runningAuthor=d[1].trim());let e=a.match(/\\title\s*(?:\[[^\]]*\])?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/i);e&&(b.title=e[1].trim());let g=a.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/i);if(g)b.abstract=g[1].trim();else{let c=a.match(/\\abstract\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/i);c&&(b.abstract=c[1].trim())}let h=a.match(/\\keywords\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/i)||a.match(/\\begin\{IEEEkeywords\}([\s\S]*?)\\end\{IEEEkeywords\}/i)||a.match(/\\begin\{keyword\}([\s\S]*?)\\end\{keyword\}/i);if(h&&(b.keywords=h[1].trim()),a.includes("\\fnm")||a.includes("\\sur")||a.includes("\\affil")||a.includes("\\affiliation")){let c,d,e=/\\author\*?\s*(?:\[([^\]]*)\])?\s*\{/gi;for(;null!==(c=e.exec(a));){let d=Array.from(new Set(c[1]?c[1].split(",").map(a=>a.trim()):[])),e=a.indexOf("{",c.index),g=f(a,e);if(-1===g)continue;let h=a.substring(e+1,g),i="",j=a.substring(g).match(/^\s*\\email\s*\{([^}]*)\}/i);j&&(i=j[1]);let k=h.match(/\\fnm\{([^}]*)\}/)?.[1]||"",l=h.match(/\\sur\{([^}]*)\}/)?.[1]||"",m=`${k} ${l}`.trim()||h.replace(/\\(fnm|sur)\{[^}]*\}/g,"").trim();if(m.includes("\\\\")){let a=m.split("\\\\").map(a=>a.trim());if(m=a[0],a.length>1){let c=`aff_auto_${b.authors.length+1}`;b.affiliations.push({id:c,organization:a.slice(1).join(", ")}),d.push(c)}}b.authors.push({name:m,email:i,affiliationIds:d,isCorresponding:c[0].includes("*")})}let g=/\\affi(?:l|liation)\*?\s*(?:\[([^\]]*)\])?\s*\{/gi;for(;null!==(d=g.exec(a));){let c=d[1]||"",e=a.indexOf("{",d.index),g=f(a,e);if(-1===g)continue;let h=a.substring(e+1,g),i=h.match(/\\orgname\{([^}]*)\}/)?.[1]||h.match(/\\institution\{([^}]*)\}/)?.[1]||"",j=h.match(/\\orgdiv\{([^}]*)\}/)?.[1]||h.match(/\\department\{([^}]*)\}/)?.[1]||"",k=h.match(/\\city\{([^}]*)\}/)?.[1]||"",l=h.match(/\\state\{([^}]*)\}/)?.[1]||"",m=h.match(/\\postcode\{([^}]*)\}/)?.[1]||"",n=h.match(/\\country\{([^}]*)\}/)?.[1]||"",o=h.match(/\\street\{([^}]*)\}/)?.[1]||h.match(/\\orgaddress\{[\s\S]*?\\street\{([^}]*)\}/)?.[1]||"";i||j||k||n||(i=h.replace(/[\n\r]+/g," ").replace(/\s+/g," ").trim()),b.affiliations.push({id:c,organization:i,department:j,street:o,city:k,postcode:m,state:l,country:n})}}else if(a.includes("\\IEEEauthorblock")){let c=[...a.matchAll(/\\IEEEauthorblockN\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gi)],d=[...a.matchAll(/\\IEEEauthorblockA\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gi)];c.forEach((a,c)=>{let e=d[c]?.[1].match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);b.authors.push({name:a[1].replace(/\\and/g,"").trim(),email:e?.[0]||"",affiliationIds:[String(c)]}),d[c]&&b.affiliations.push({id:String(c),organization:d[c][1].replace(/\\textit\{([^}]*)\}/g,"$1").trim()})})}else{let c,d,e=/\\author\s*(?:\[([^\]]*)\])?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gi;for(;null!==(c=e.exec(a));)b.authors.push({name:c[2].trim(),affiliationIds:c[1]?c[1].split(","):[]});let f=/\\email\s*\{([^}]*)\}/gi;for(;null!==(d=f.exec(a));)b.authors.length>0&&(b.authors[b.authors.length-1].email=d[1])}return b}function i(a,b){let c="";if("article_acm"===a)c+=`\\title{${b.title||"Untitled"}}

`,b.authors.forEach(a=>{c+=`\\author{${a.name}}
`,a.email&&(c+=`\\email{${a.email}}
`),a.affiliationIds.forEach(a=>{let d=b.affiliations.find(b=>b.id===a);d&&(c+=`\\affiliation{
`,d.organization&&(c+=`  \\institution{${d.organization}}
`),d.department&&(c+=`  \\department{${d.department}}
`),d.street&&(c+=`  \\streetaddress{${d.street}}
`),d.city&&(c+=`  \\city{${d.city}}
`),d.state&&(c+=`  \\state{${d.state}}
`),d.postcode&&(c+=`  \\postcode{${d.postcode}}
`),d.country&&(c+=`  \\country{${d.country}}
`),c+=`}
`)})}),c+=`
\\date{\\today}

\\begin{abstract}
${b.abstract||"Abstract text goes here."}
\\end{abstract}

`,b.keywords&&(c+=`\\keywords{${b.keywords}}
`),c+=`\\maketitle

`;else if("article_ieee"===a)c+=`\\title{${b.title||"Untitled"}}

\\author{
`,b.authors.forEach((a,d)=>{c+=`  \\IEEEauthorblockN{${a.name}}
  \\IEEEauthorblockA{`,a.affiliationIds.forEach(d=>{let e=b.affiliations.find(a=>a.id===d);e&&(c+=`\\textit{${e.organization||""}}${e.department?`\\\\ ${e.department}`:""} \\\\ ${e.city||""}, ${e.country||""} \\\\ ${a.email||""}`)}),c+=`}${d<b.authors.length-1?" \\and\n":""}
`}),c+=`}

\\date{\\today}

\\maketitle

\\begin{abstract}
${b.abstract||"Abstract goes here."}
\\end{abstract}

`,b.keywords&&(c+=`\\begin{IEEEkeywords}
${b.keywords}
\\end{IEEEkeywords}
`);else if("article_elsevier"===a)c+=`\\begin{frontmatter}

\\title{${b.title||"Untitled"}}

`,b.authors.forEach(a=>{c+=`\\author[${a.affiliationIds.join(",")||"inst1"}]{${a.name}}
`}),b.affiliations.forEach(a=>{c+=`\\affiliation[${a.id||"inst1"}]{organization={${a.organization||""}}, department={${a.department||""}}, city={${a.city||""}}, country={${a.country||""}}}
`}),c+=`
\\date{\\today}

\\begin{abstract}
${b.abstract||"Abstract goes here."}
\\end{abstract}

`,b.keywords&&(c+=`\\begin{keyword}
${b.keywords}
\\end{keyword}
`),c+=`
\\end{frontmatter}
`;else if("article_springer_lncs"===a)c+=`\\title{${b.title||"Untitled"}}
`,b.runningTitle&&(c+=`\\titlerunning{${b.runningTitle}}
`),c+=`\\author{${b.authors.map((a,b)=>`${a.name}\\inst{${a.affiliationIds.join(",")||b+1}}`).join(" \\and ")||"Author Name"}}
`,b.runningAuthor&&(c+=`\\authorrunning{${b.runningAuthor}}
`),c+="\\institute{",b.affiliations.forEach((a,d)=>{c+=`${a.organization||""}, ${a.city||""}, ${a.country||""}${d<b.affiliations.length-1?" \\and\n":""}`}),c+=`}

\\date{\\today}

\\maketitle

\\begin{abstract}
${b.abstract||"Abstract goes here."}

\\keywords{${b.keywords||""}}
\\end{abstract}
`;else if("article_scirep"===a){c+=`\\title{${b.title||"Untitled"}}

`,b.authors.forEach((a,b)=>{let d=a.affiliationIds.join(",")||"1";c+=`\\author[${d}${a.isCorresponding?",*":""}]{${a.name}}
`}),b.affiliations.forEach(a=>{c+=`\\affil[${a.id||"1"}]{${a.organization||""}, ${a.city||""}, ${a.country||""}}
`});let a=b.authors.find(a=>a.isCorresponding);a?.email&&(c+=`\\affil[*]{${a.email}}
`),b.keywords&&(c+=`\\keywords{${b.keywords}}

`),c+=`\\begin{abstract}
${b.abstract||"Abstract text goes here."}
\\end{abstract}

\\date{\\today}

\\maketitle

`}else c+=`\\title{${b.title||"Untitled"}}
`,b.affiliations&&b.affiliations.length>0?(b.authors.forEach(a=>{let b=a.affiliationIds.join(",")||"1";c+=`\\author[${b}]{${a.name}}
`}),b.affiliations.forEach(a=>{c+=`\\affil[${a.id||"1"}]{${a.organization||""}${a.department?`, ${a.department}`:""}${a.city?`, ${a.city}`:""}${a.country?`, ${a.country}`:""}}
`})):c+=`\\author{${b.authors.map(a=>a.name).join(", ")||"Author Name"}}
`,c+=`\\date{\\today}

\\maketitle

`,b.abstract&&(c+=`\\begin{abstract}
${b.abstract}
\\end{abstract}

`),b.keywords&&(c+=`\\providecommand{\\keywords}[1]{\\textbf{\\textit{Keywords:}} #1}
\\keywords{${b.keywords}}

`);return c}function j(a,b,c){let d="";if(b.includes("acm")||/\\documentclass\s*(?:\[[^\]]*\])?\s*\{acmart\}/.test(a))d=i("article_acm",c);else if(b.includes("ieee")||/\\documentclass\s*(?:\[[^\]]*\])?\s*\{IEEEtran\}/.test(a))d=i("article_ieee",c);else if(b.includes("elsevier")||/\\documentclass\s*(?:\[[^\]]*\])?\s*\{elsarticle\}/.test(a))d=i("article_elsevier",c);else if(b.includes("scirep")||/\\documentclass\s*(?:\[[^\]]*\])?\s*\{wlscirep\}/.test(a))d=i("article_scirep",c);else if(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{llncs\}/.test(a))d=i("article_springer_lncs",c);else if(a.includes("\\begin{frontmatter}"))d=i("article_elsevier",c);else if(a.includes("\\institute{"))d=i("article_springer_lncs",c);else if(a.includes("\\affil["))d=i("article_scirep",c);else if(a.includes("\\abstract{")){let a=`\\title{${c.title||"Untitled"}}
`;a+=`\\author{${c.authors.map(a=>a.name).join(", ")||"Author"}}
\\abstract{${c.abstract||"Abstract text"}}
`,c.keywords&&(a+=`\\keyword{${c.keywords}}
`),a+=`\\date{\\today}

\\maketitle
`,d=a}else d=i("standard",c);return d.includes("\\maketitle")||d.includes("\\begin{frontmatter}")||(d+="\n\\maketitle\n"),d}},81741:(a,b,c)=>{c.d(b,{A:()=>d});let d=(0,c(30716).A)("chevron-right",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]])},82553:(a,b,c)=>{c.r(b),c.d(b,{StudioFS:()=>l,TEMPLATE_CONTENT:()=>f,dataUrlToBlob:()=>m});let d="projects",e="files",f={blank:`\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amsfonts,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{Untitled Document}
\\author{Author Name}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
Start writing your content here.

\\end{document}
`};function g(a,b,c){return new Promise((d,e)=>{let f=a.transaction(b,"readonly").objectStore(b).get(c);f.onsuccess=()=>d(f.result),f.onerror=()=>e(f.error)})}function h(a,b,c){return new Promise((d,e)=>{let f=a.transaction(b,"readwrite");f.objectStore(b).put(c),f.oncomplete=()=>d(),f.onerror=()=>e(f.error)})}function i(a,b,c){return new Promise((d,e)=>{let f=a.transaction(b,"readwrite");f.objectStore(b).delete(c),f.oncomplete=()=>d(),f.onerror=()=>e(f.error)})}function j(a,b,c,d){return new Promise((e,f)=>{let g=a.transaction(b,"readonly").objectStore(b).index(c).getAll(d);g.onsuccess=()=>e(g.result),g.onerror=()=>f(g.error)})}function k(a){return({tex:"text/x-latex",bib:"text/x-bibtex",cls:"text/x-latex",sty:"text/x-latex",bst:"text/x-bibtex",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",pdf:"application/pdf",txt:"text/plain"})[a.split(".").pop()?.toLowerCase()||""]||"text/plain"}class l{constructor(a){this.db=null,this.userKey=btoa(a).replace(/[^a-z0-9]/gi,"").substring(0,16)}async getDb(){return this.db||(this.db=await new Promise((a,b)=>{let c=indexedDB.open("latex-studio-db",2);c.onupgradeneeded=a=>{let b=a.target.result;b.objectStoreNames.contains(d)||b.createObjectStore(d,{keyPath:"id"}).createIndex("updatedAt","updatedAt"),b.objectStoreNames.contains(e)||b.createObjectStore(e,{keyPath:"id"}).createIndex("projectId","projectId")},c.onsuccess=()=>a(c.result),c.onerror=()=>b(c.error)})),this.db}async listProjects(){let a=await this.getDb();return(await new Promise((b,c)=>{let e=a.transaction(d,"readonly").objectStore(d).getAll();e.onsuccess=()=>b(e.result),e.onerror=()=>c(e.error)})).filter(a=>a.id.startsWith(this.userKey+"_")).sort((a,b)=>b.updatedAt-a.updatedAt)}async getProject(a){return g(await this.getDb(),d,a)}async renameProject(a,b){let c=await this.getDb(),e=await g(c,d,a);e&&await h(c,d,{...e,title:b,updatedAt:Date.now()})}async updateProject(a,b){let c=await this.getDb(),e=await g(c,d,a);e&&await h(c,d,{...e,...b,updatedAt:Date.now()})}async injectProject(a,b,c,e="main.tex"){let f=await this.getDb(),g=Date.now();await h(f,d,{id:a,title:b,engine:"pdflatex",mainFile:e,templateId:c,fileCount:0,createdAt:g,updatedAt:g})}async createProject(a,b="blank"){let c=await this.getDb(),g=`${this.userKey}_${Math.random().toString(36).substring(2)+Date.now().toString(36)}`,i=Date.now(),j={id:g,title:a,engine:"pdflatex",mainFile:"main.tex",templateId:b,fileCount:0,createdAt:i,updatedAt:i};await h(c,d,j);try{let a=await fetch(`/api/templates/${b}/bundle`);if(!a.ok)throw Error("Bundle not found");let{bundle:f}=await a.json(),l=0,m="main.tex",n=Object.keys(f).filter(a=>a.endsWith(".tex"));for(let[a,b]of(n.length>0&&(m=n.find(a=>"main.tex"===a.toLowerCase())||n.find(a=>a.toLowerCase().includes("main"))||n.find(a=>a.toLowerCase().includes("template"))||n[0]),j.mainFile=m,Object.entries(f))){let d={id:`${g}:${a}`,projectId:g,path:a,name:a,content:b,mimeType:k(a),isDirectory:!1,updatedAt:i};await h(c,e,d),l++}j.fileCount=l,await h(c,d,j)}catch(k){console.warn(`[StudioFS] Failed to fetch bundle for ${b}, falling back to blank.`,k);let a={id:`${g}:main.tex`,projectId:g,path:"main.tex",name:"main.tex",content:f.blank,mimeType:"text/x-latex",isDirectory:!1,updatedAt:i};await h(c,e,a),j.fileCount=1,await h(c,d,j)}return g}async deleteProject(a){let b=await this.getDb();for(let c of(await j(b,e,"projectId",a)))await i(b,e,c.id);await i(b,d,a)}async listFiles(a){let b=await this.getDb();return(await j(b,e,"projectId",a)).sort((a,b)=>a.path.localeCompare(b.path))}async listFilesMeta(a){let b=await this.getDb();return new Promise((c,d)=>{let f=b.transaction(e,"readonly").objectStore(e).index("projectId").openCursor(IDBKeyRange.only(a)),g=[];f.onsuccess=a=>{let b=a.target.result;if(b){let{content:a,...c}=b.value;g.push(c),b.continue()}else c(g.sort((a,b)=>a.path.localeCompare(b.path)))},f.onerror=()=>d(f.error)})}async readFile(a,b){return g(await this.getDb(),e,`${a}:${b}`)}async writeFile(a,b,c){let f=await this.getDb(),i=Date.now(),l=b.split("/").pop()||b,m={...await g(f,e,`${a}:${b}`)||{},id:`${a}:${b}`,projectId:a,path:b,name:l,content:c,mimeType:k(l),isDirectory:!1,updatedAt:i};await h(f,e,m);let n=await g(f,d,a);if(n){let b=await j(f,e,"projectId",a);await h(f,d,{...n,updatedAt:i,fileCount:b.length})}}async renameFile(a,b,c){let d=await this.readFile(a,b);d&&(await this.writeFile(a,c,d.content),await this.deleteFile(a,b))}async deleteFile(a,b){let c=await this.getDb(),f=Date.now();await i(c,e,`${a}:${b}`);let k=await g(c,d,a);if(k){let b=await j(c,e,"projectId",a);await h(c,d,{...k,updatedAt:f,fileCount:b.length})}}async createDirectory(a,b){let c=await this.getDb(),d=Date.now(),f={id:`${a}:${b}/`,projectId:a,path:b+"/",name:b.split("/").pop()||b,content:"",mimeType:"application/x-directory",isDirectory:!0,updatedAt:d};await h(c,e,f)}async exportZip(a){let b=new(await c.e(7890).then(c.t.bind(c,77890,23))).default,d=await this.listFiles(a),e=a=>{let b=atob(a.split(",")[1]),c=b.length,d=new Uint8Array(c);for(let a=0;a<c;a++)d[a]=b.charCodeAt(a);return d};for(let a of d)if(!a.isDirectory)if(a.content.startsWith("data:"))try{let c=e(a.content);b.file(a.path,c)}catch(c){console.error(`Export failed for ${a.path}:`,c),b.file(a.path,a.content)}else b.file(a.path,a.content);return b.generateAsync({type:"blob",compression:"DEFLATE"})}async importZip(a){let b=(await c.e(7890).then(c.t.bind(c,77890,23))).default,e=await b.loadAsync(a),f=a.name.replace(/\.zip$/i,"")||"Imported Project",i=await this.createProject(f,"blank"),j=Object.keys(e.files),l=j.filter(a=>a.endsWith(".tex")&&!e.files[a].dir);for(let a of j){let b=e.files[a];if(!b.dir)if(["tex","bib","cls","sty","txt","md","csv","bst","cfg","clo","def","fd","ldf","tikz"].includes(a.split(".").pop()?.toLowerCase()||"")){let c=await b.async("string");await this.writeFile(i,a,c)}else{let c=await b.async("base64"),d=k(a),e=`data:${d};base64,${c}`;await this.writeFile(i,a,e)}}let m=await this.getDb(),n=await g(m,d,i);if(n&&l.length>0){let a=l.find(a=>a.toLowerCase().includes("main"))||l[0];await h(m,d,{...n,mainFile:a})}return i}async updateProjectEngine(a,b){let c=await this.getDb(),e=await g(c,d,a);e&&await h(c,d,{...e,engine:b,updatedAt:Date.now()})}async updateMainFile(a,b){let c=await this.getDb(),e=await g(c,d,a);e&&await h(c,d,{...e,mainFile:b,updatedAt:Date.now()})}}function m(a){let b=a.split(","),c=b[0].match(/:(.*?);/),d=c?c[1]:"application/octet-stream",e=atob(b[1]||""),f=e.length,g=new Uint8Array(f);for(let a=0;a<f;a++)g[a]=e.charCodeAt(a);return new Blob([g],{type:d})}}};