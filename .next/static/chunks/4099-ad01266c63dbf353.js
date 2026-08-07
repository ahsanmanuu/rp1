"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[4099,6063],{46063:(e,t,a)=>{a.r(t),a.d(t,{StudioFS:()=>u,TEMPLATE_CONTENT:()=>r,dataUrlToBlob:()=>f});let i="projects",n="files",r={blank:`\\documentclass{article}
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
`};function s(e,t,a){return new Promise((i,n)=>{let r=e.transaction(t,"readonly").objectStore(t).get(a);r.onsuccess=()=>i(r.result),r.onerror=()=>n(r.error)})}function l(e,t,a){return new Promise((i,n)=>{let r=e.transaction(t,"readwrite");r.objectStore(t).put(a),r.oncomplete=()=>i(),r.onerror=()=>n(r.error)})}function o(e,t,a){return new Promise((i,n)=>{let r=e.transaction(t,"readwrite");r.objectStore(t).delete(a),r.oncomplete=()=>i(),r.onerror=()=>n(r.error)})}function c(e,t,a,i){return new Promise((n,r)=>{let s=e.transaction(t,"readonly").objectStore(t).index(a).getAll(i);s.onsuccess=()=>n(s.result),s.onerror=()=>r(s.error)})}function d(e){return({tex:"text/x-latex",bib:"text/x-bibtex",cls:"text/x-latex",sty:"text/x-latex",bst:"text/x-bibtex",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",pdf:"application/pdf",txt:"text/plain"})[e.split(".").pop()?.toLowerCase()||""]||"text/plain"}class u{constructor(e){this.db=null,this.userKey=btoa(e).replace(/[^a-z0-9]/gi,"").substring(0,16)}async getDb(){return this.db||(this.db=await new Promise((e,t)=>{let a=indexedDB.open("latex-studio-db",2);a.onupgradeneeded=e=>{let t=e.target.result;t.objectStoreNames.contains(i)||t.createObjectStore(i,{keyPath:"id"}).createIndex("updatedAt","updatedAt"),t.objectStoreNames.contains(n)||t.createObjectStore(n,{keyPath:"id"}).createIndex("projectId","projectId")},a.onsuccess=()=>e(a.result),a.onerror=()=>t(a.error)})),this.db}async listProjects(){let e=await this.getDb();return(await new Promise((t,a)=>{let n=e.transaction(i,"readonly").objectStore(i).getAll();n.onsuccess=()=>t(n.result),n.onerror=()=>a(n.error)})).filter(e=>e.id.startsWith(this.userKey+"_")).sort((e,t)=>t.updatedAt-e.updatedAt)}async getProject(e){return s(await this.getDb(),i,e)}async renameProject(e,t){let a=await this.getDb(),n=await s(a,i,e);n&&await l(a,i,{...n,title:t,updatedAt:Date.now()})}async updateProject(e,t){let a=await this.getDb(),n=await s(a,i,e);n&&await l(a,i,{...n,...t,updatedAt:Date.now()})}async injectProject(e,t,a){let n=arguments.length>3&&void 0!==arguments[3]?arguments[3]:"main.tex",r=await this.getDb(),s=Date.now();await l(r,i,{id:e,title:t,engine:"pdflatex",mainFile:n,templateId:a,fileCount:0,createdAt:s,updatedAt:s})}async createProject(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"blank",a=await this.getDb(),s=`${this.userKey}_${Math.random().toString(36).substring(2)+Date.now().toString(36)}`,o=Date.now(),c={id:s,title:e,engine:"pdflatex",mainFile:"main.tex",templateId:t,fileCount:0,createdAt:o,updatedAt:o};await l(a,i,c);try{let e=await fetch(`/api/templates/${t}/bundle`);if(!e.ok)throw Error("Bundle not found");let{bundle:r}=await e.json(),u=0,f="main.tex",p=Object.keys(r).filter(e=>e.endsWith(".tex"));for(let[e,t]of(p.length>0&&(f=p.find(e=>"main.tex"===e.toLowerCase())||p.find(e=>e.toLowerCase().includes("main"))||p.find(e=>e.toLowerCase().includes("template"))||p[0]),c.mainFile=f,Object.entries(r))){let i={id:`${s}:${e}`,projectId:s,path:e,name:e,content:t,mimeType:d(e),isDirectory:!1,updatedAt:o};await l(a,n,i),u++}c.fileCount=u,await l(a,i,c)}catch(d){console.warn(`[StudioFS] Failed to fetch bundle for ${t}, falling back to blank.`,d);let e={id:`${s}:main.tex`,projectId:s,path:"main.tex",name:"main.tex",content:r.blank,mimeType:"text/x-latex",isDirectory:!1,updatedAt:o};await l(a,n,e),c.fileCount=1,await l(a,i,c)}return s}async deleteProject(e){let t=await this.getDb();for(let a of(await c(t,n,"projectId",e)))await o(t,n,a.id);await o(t,i,e)}async listFiles(e){let t=await this.getDb();return(await c(t,n,"projectId",e)).sort((e,t)=>e.path.localeCompare(t.path))}async listFilesMeta(e){let t=await this.getDb();return new Promise((a,i)=>{let r=t.transaction(n,"readonly").objectStore(n).index("projectId").openCursor(IDBKeyRange.only(e)),s=[];r.onsuccess=e=>{let t=e.target.result;if(t){let{content:e,...a}=t.value;s.push(a),t.continue()}else a(s.sort((e,t)=>e.path.localeCompare(t.path)))},r.onerror=()=>i(r.error)})}async readFile(e,t){return s(await this.getDb(),n,`${e}:${t}`)}async writeFile(e,t,a){let r=await this.getDb(),o=Date.now(),u=t.split("/").pop()||t,f={...await s(r,n,`${e}:${t}`)||{},id:`${e}:${t}`,projectId:e,path:t,name:u,content:a,mimeType:d(u),isDirectory:!1,updatedAt:o};await l(r,n,f);let p=await s(r,i,e);if(p){let t=await c(r,n,"projectId",e);await l(r,i,{...p,updatedAt:o,fileCount:t.length})}}async renameFile(e,t,a){let i=await this.readFile(e,t);i&&(await this.writeFile(e,a,i.content),await this.deleteFile(e,t))}async deleteFile(e,t){let a=await this.getDb(),r=Date.now();await o(a,n,`${e}:${t}`);let d=await s(a,i,e);if(d){let t=await c(a,n,"projectId",e);await l(a,i,{...d,updatedAt:r,fileCount:t.length})}}async createDirectory(e,t){let a=await this.getDb(),i=Date.now(),r={id:`${e}:${t}/`,projectId:e,path:t+"/",name:t.split("/").pop()||t,content:"",mimeType:"application/x-directory",isDirectory:!0,updatedAt:i};await l(a,n,r)}async exportZip(e){let t=new(await Promise.all([a.e(9304),a.e(6834)]).then(a.t.bind(a,54453,23))).default,i=await this.listFiles(e),n=e=>{let t=atob(e.split(",")[1]),a=t.length,i=new Uint8Array(a);for(let e=0;e<a;e++)i[e]=t.charCodeAt(e);return i};for(let e of i)if(!e.isDirectory)if(e.content.startsWith("data:"))try{let a=n(e.content);t.file(e.path,a)}catch(a){console.error(`Export failed for ${e.path}:`,a),t.file(e.path,e.content)}else t.file(e.path,e.content);return t.generateAsync({type:"blob",compression:"DEFLATE"})}async importZip(e){let t=(await Promise.all([a.e(9304),a.e(6834)]).then(a.t.bind(a,54453,23))).default,n=await t.loadAsync(e),r=e.name.replace(/\.zip$/i,"")||"Imported Project",o=await this.createProject(r,"blank"),c=Object.keys(n.files),u=c.filter(e=>e.endsWith(".tex")&&!n.files[e].dir);for(let e of c){let t=n.files[e];if(!t.dir)if(["tex","bib","cls","sty","txt","md","csv","bst","cfg","clo","def","fd","ldf","tikz"].includes(e.split(".").pop()?.toLowerCase()||"")){let a=await t.async("string");await this.writeFile(o,e,a)}else{let a=await t.async("base64"),i=d(e),n=`data:${i};base64,${a}`;await this.writeFile(o,e,n)}}let f=await this.getDb(),p=await s(f,i,o);if(p&&u.length>0){let e=u.find(e=>e.toLowerCase().includes("main"))||u[0];await l(f,i,{...p,mainFile:e})}return o}async updateProjectEngine(e,t){let a=await this.getDb(),n=await s(a,i,e);n&&await l(a,i,{...n,engine:t,updatedAt:Date.now()})}async updateMainFile(e,t){let a=await this.getDb(),n=await s(a,i,e);n&&await l(a,i,{...n,mainFile:t,updatedAt:Date.now()})}}function f(e){let t=e.split(","),a=t[0].match(/:(.*?);/),i=a?a[1]:"application/octet-stream",n=atob(t[1]||""),r=n.length,s=new Uint8Array(r);for(let e=0;e<r;e++)s[e]=n.charCodeAt(e);return new Blob([s],{type:i})}},82661:(e,t,a)=>{a.d(t,{i:()=>s,kT:()=>c,kl:()=>l,oM:()=>n});let i={α:"\\alpha ",β:"\\beta ",γ:"\\gamma ",δ:"\\delta ",ε:"\\epsilon ",ζ:"\\zeta ",η:"\\eta ",θ:"\\theta ",ι:"\\iota ",κ:"\\kappa ",λ:"\\lambda ",μ:"\\mu ",ν:"\\nu ",ξ:"\\xi ",ο:"o ",π:"\\pi ",ρ:"\\rho ",σ:"\\sigma ",τ:"\\tau ",υ:"\\upsilon ",φ:"\\phi ",χ:"\\chi ",ψ:"\\psi ",ω:"\\omega ",Α:"A ",Ｂ:"B ",Γ:"\\Gamma ",Δ:"\\Delta ",Ｅ:"E ",Ｚ:"Z ",Ｈ:"H ",Θ:"\\Theta ",Ｉ:"I ",Ｋ:"K ",Λ:"\\Lambda ",Ｍ:"M ",Ｎ:"N ",Ξ:"\\Xi ",Ｏ:"O ",Π:"\\Pi ",Ρ:"P ",Σ:"\\Sigma ",Ｔ:"T ",Ｙ:"\\Upsilon ",Φ:"\\Phi ",Ｘ:"X ",Ψ:"\\Psi ",Ω:"\\Omega ","\xb1":"\\pm ","\xd7":"\\times ","\xf7":"\\div ","≈":"\\approx ","≠":"\\neq ","≤":"\\leq ","≥":"\\geq ","∞":"\\infty ","∫":"\\int ","∂":"\\partial ","√":"\\sqrt ","∈":"\\in ","∉":"\\notin ","∑":"\\sum ","∏":"\\prod ","∇":"\\nabla ","∠":"\\angle ","\xb0":"^{\\circ}","…":"\\dots ","→":"\\ensuremath{\\rightarrow} ","←":"\\ensuremath{\\leftarrow} ","↔":"\\ensuremath{\\leftrightarrow} ","⇒":"\\ensuremath{\\Rightarrow} ","∘":"\\ensuremath{^{\\circ}}",ǁ:"\\ensuremath{\\parallel} ","◦":"\\ensuremath{^{\\circ}}","⋅":"\\ensuremath{\\cdot}","\xb7":"\\ensuremath{\\cdot}","−":"\\ensuremath{-}","∗":"*","⁻":"\\ensuremath{^{-}}",ɛ:"\\epsilon ",Ω:"\\Omega ","–":"--","—":"---","’":"'","‘":"`","“":"``","”":"''","∕":"/","‐":"-"};function n(e){if(!e)return"";let t=function(e){if(!e)return"";let t="",a=0,i=e.length,n=new Set(["label","ref","cite","includegraphics","begin","end","usepackage","documentclass","url","href","geometry","bibliographystyle","bibliography","addbibresource","newcommand","renewcommand","providecommand","def","hypersetup","lstset","lstlisting","input","include","import","subfile","subimport","includeonly","pageref","cref","Cref","autoref","zimg"]),r=!1,s=!1,l=0,o="",c=[],d="",u=()=>{if(d.length>25&&!c.some(e=>n.has(e.cmd))&&!r&&!s){let e="";for(let t=0;t<d.length;t+=10)t>0&&(e+="\\-"),e+=d.slice(t,t+10);d=e}t+=d,d=""};for(;a<i;){let n=e[a];if("%"===n&&!s){u(),r=!0,t+=n,a++;continue}if(r&&("\n"===n||"\r"===n)){r=!1,t+=n,a++;continue}if(r){t+=n,a++;continue}if("$"===n){u(),"$"===e[a+1]?(s=!s,t+="$$",a+=2):(s=!s,t+="$",a++);continue}if(s){t+=n,a++;continue}if("\\"===n){u(),t+=n,a++;let r="";for(;a<i&&/[a-zA-Z]/.test(e[a]);)r+=e[a],a++;t+=r,o=r;continue}if("{"===n){u(),l++,o&&(c.push({cmd:o,depth:l}),o=""),t+=n,a++;continue}if("}"===n){u(),c=c.filter(e=>e.depth<l),l=Math.max(0,l-1),t+=n,a++;continue}/[a-zA-Z0-9._\-]/.test(n)?d+=n:(u(),t+=n),a++}return u(),t}(e);for(let[e,a]of Object.entries(i))t=t.split(e).join(a);t=(t=t.replace(/\\texttimes\b/g,"\\ensuremath{\\times}")).replace(/\\textellipsis\b/g,"\\dots"),["equation","align","gather","multline","eqnarray","displaymath"].forEach(e=>{let a=RegExp(`(\\\\begin\\s*\\{\\s*${e}\\*?\\s*\\})([\\s\\S]*?)(\\\\end\\s*\\{\\s*${e}\\*?\\s*\\})`,"g");t=t.replace(a,(e,t,a,i)=>t+a.replace(/\$/g,"")+i)});let a=(t=(t=(t=(t=(t=(t=(t=(t=(t=(t=(t=(t=(t=(t=t.replace(/(\\\[)([\s\S]*?)(\\\])/g,(e,t,a,i)=>t+a.replace(/\$/g,"")+i)).replace(/color\s+color/gi,"")).replace(/color\s+color\s+bstract/gi,"")).replace(/\bbstract\b/gi,"abstract")).replace(/\\color\s*\{color\}/gi,"")).replace(/\\defaultfontfeatures\s*\{[^}]*Scale=MatchLowercase[^}]*\}/gi,"")).replace(/Scale=MatchLowercase/g,"")).replace(/\\ifPDFTeX[\s\S]*?\\else[\s\S]*?\\fi/gi,e=>e.includes("Scale=MatchLowercase")&&!e.includes("fontspec")?"% Removed phantom font feature block\n":e)).replace(/\\Beta(?![a-zA-Z])/g,"\\beta")).replace(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{epstopdf(?:,svg)?\}\s*\n?/g,"")).replace(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{svg\}\s*\n?/g,"")).replace(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{(?:[^}]*,)?epstopdf(?:,[^}]*)?\}\s*\n?/g,"")).replace(/\\(?:usepackage|RequirePackage|input)\s*\{packages\}\s*/gi,"% Removed missing local dependency\n")).replace(/\\(?:usepackage|input)\s*\{siamart190516.sty\}\s*/gi,"\\usepackage{siamart190516}\n")).match(/\\begin\s*\{\s*document\s*\}/),n=a?a.index:-1;if(-1!==n){let e=t.substring(0,n),a=t.substring(n),i=new Set;e=e.split("\n").filter(e=>{if(e.match(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/)){let t=e.trim().replace(/\s+/g," ");if(i.has(t))return!1;i.add(t)}return!0}).join("\n");let r=0;e=e.replace(/\\allowdisplaybreaks\s*\n?/g,e=>1==++r?e:"");let s=a.replace(/\\\\\s*(\\end\{|\\section|\\subsection|\\item|\\begin\{list|\\begin\{description|\\begin\{enumerate|\\begin\{itemize})/g,"$1"),l=e.match(/\\documentclass[^{]*\{([^}]+)\}/),o=l?l[1].toLowerCase():"",c=o.includes("ieee")||o.includes("acm");for(let[t,a]of[["adjustbox","\\usepackage[export]{adjustbox}"],["booktabs","\\usepackage{booktabs}"],["placeins","\\usepackage{placeins}"],["float","\\usepackage{float}"],["caption","\\usepackage[labelfont=bf,labelsep=period]{caption}"],["xurl","\\usepackage{xurl}"],["microtype","\\usepackage{microtype}"]])("caption"!==t||!c)&&(e.includes(`{${t}}`)||(e=e.trimEnd()+"\n"+a+"\n"));if(!(o.includes("ieee")||o.includes("elsarticle")||o.includes("acm")||o.includes("sn-jnl")||o.includes("wlscirep")||o.includes("llncs"))&&(s.includes("\\affil")||e.includes("\\affil")||s.includes("\\author["))&&!e.includes("{authblk}")&&(e=e.trimEnd()+"\n\\usepackage{authblk}\n"),!e.includes("UNIVERSAL SUBFIGURE FALLBACK")){let t=`
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
`;e=e.trimEnd()+"\n"+t+"\n"}let d=[];if(e=e.replace(/(?:\\(?:renewcommand|newcommand|providecommand)\s*(?:\\Authfont|\\Affilfont|\\AuthCmd|\\AffilCmd|\{\\Authfont\}|\{\\Affilfont\}|\{\\AuthCmd\}|\{\\AffilCmd\})\s*(?:\[[^\]]*\])?\s*\{([\s\S]*?)\}|\\setlength\s*\{\s*\\affilsep\s*\}\s*\{[^{}]*\}|\\setlength\s*\\affilsep\s*\{[^{}]*\})/g,e=>(d.push(e),`% Extracted for safe AtBeginDocument ordering
`)),d.length>0){let t=d.map(e=>e.includes("\\affilsep")?`\\ifdefined\\affilsep
${e}
\\fi`:e.includes("\\Authfont")||e.includes("\\Affilfont")?`\\ifdefined\\Authfont
${e}
\\fi`:e);e=e.trimEnd()+`

% --- Safe authblk Overrides ---
\\AtBeginDocument{
${t.join("\n")}
}
`}t=e+(s=(s=s.replace(/\\\\(\s*\\hline)/g,"$1")).replace(/(\\hline\s*){2,}/g,"\\hline\n"))}return t}function r(e,t){let a=0,i=!1;for(let n=t;n<e.length;n++)if("{"===e[n])a++,i=!0;else if("}"===e[n]&&(a--,i&&0===a))return n;return -1}function s(e,t){let a,i=e,n=[],s=RegExp(`(?<!%)\\\\${t}\\*?\\s*(?:\\s*\\[[^\\]]*\\])?\\s*\\{`,"g");for(;null!==(a=s.exec(i));){let e=a.index,t=i.indexOf("{",e);if(-1===t)break;let l=r(i,t);if(-1!==l){let t=l+1;for(;t<i.length;){let e=i.slice(t).trimStart(),a=i.slice(t).length-e.length;if(e.startsWith("{")){let e=r(i,t+a);if(-1===e)break;t=e+1}else if(e.startsWith("[")){let e=t+a,n=i.indexOf("]",e);if(-1===n)break;t=n+1}else break}n.push(i.substring(e,t)),i=i.substring(0,e)+i.substring(t),s.lastIndex=0}else s.lastIndex=e+1}return{body:i,extracted:n}}function l(e){let t={title:"",authors:[],affiliations:[],abstract:"",keywords:""},a=e.match(/\\titlerunning\s*\{([^}]*)\}/i);a&&(t.runningTitle=a[1].trim());let i=e.match(/\\authorrunning\s*\{([^}]*)\}/i);i&&(t.runningAuthor=i[1].trim());let n=e.match(/\\title\s*(?:\[[^\]]*\])?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/i);n&&(t.title=n[1].trim());let s=e.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/i);if(s)t.abstract=s[1].trim();else{let a=e.match(/\\abstract\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/i);a&&(t.abstract=a[1].trim())}let l=e.match(/\\keywords\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/i)||e.match(/\\begin\{IEEEkeywords\}([\s\S]*?)\\end\{IEEEkeywords\}/i)||e.match(/\\begin\{keyword\}([\s\S]*?)\\end\{keyword\}/i);if(l&&(t.keywords=l[1].trim()),e.includes("\\fnm")||e.includes("\\sur")||e.includes("\\affil")||e.includes("\\affiliation")){let a,i,n=/\\author\*?\s*(?:\[([^\]]*)\])?\s*\{/gi;for(;null!==(a=n.exec(e));){let i=Array.from(new Set(a[1]?a[1].split(",").map(e=>e.trim()):[])),n=e.indexOf("{",a.index),s=r(e,n);if(-1===s)continue;let l=e.substring(n+1,s),o="",c=e.substring(s).match(/^\s*\\email\s*\{([^}]*)\}/i);c&&(o=c[1]);let d=l.match(/\\fnm\{([^}]*)\}/)?.[1]||"",u=l.match(/\\sur\{([^}]*)\}/)?.[1]||"",f=`${d} ${u}`.trim()||l.replace(/\\(fnm|sur)\{[^}]*\}/g,"").trim();if(f.includes("\\\\")){let e=f.split("\\\\").map(e=>e.trim());if(f=e[0],e.length>1){let a=`aff_auto_${t.authors.length+1}`;t.affiliations.push({id:a,organization:e.slice(1).join(", ")}),i.push(a)}}t.authors.push({name:f,email:o,affiliationIds:i,isCorresponding:a[0].includes("*")})}let s=/\\affi(?:l|liation)\*?\s*(?:\[([^\]]*)\])?\s*\{/gi;for(;null!==(i=s.exec(e));){let a=i[1]||"",n=e.indexOf("{",i.index),s=r(e,n);if(-1===s)continue;let l=e.substring(n+1,s),o=l.match(/\\orgname\{([^}]*)\}/)?.[1]||l.match(/\\institution\{([^}]*)\}/)?.[1]||"",c=l.match(/\\orgdiv\{([^}]*)\}/)?.[1]||l.match(/\\department\{([^}]*)\}/)?.[1]||"",d=l.match(/\\city\{([^}]*)\}/)?.[1]||"",u=l.match(/\\state\{([^}]*)\}/)?.[1]||"",f=l.match(/\\postcode\{([^}]*)\}/)?.[1]||"",p=l.match(/\\country\{([^}]*)\}/)?.[1]||"",m=l.match(/\\street\{([^}]*)\}/)?.[1]||l.match(/\\orgaddress\{[\s\S]*?\\street\{([^}]*)\}/)?.[1]||"";o||c||d||p||(o=l.replace(/[\n\r]+/g," ").replace(/\s+/g," ").trim()),t.affiliations.push({id:a,organization:o,department:c,street:m,city:d,postcode:f,state:u,country:p})}}else if(e.includes("\\IEEEauthorblock")){let a=[...e.matchAll(/\\IEEEauthorblockN\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gi)],i=[...e.matchAll(/\\IEEEauthorblockA\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gi)];a.forEach((e,a)=>{let n=i[a]?.[1].match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);t.authors.push({name:e[1].replace(/\\and/g,"").trim(),email:n?.[0]||"",affiliationIds:[String(a)]}),i[a]&&t.affiliations.push({id:String(a),organization:i[a][1].replace(/\\textit\{([^}]*)\}/g,"$1").trim()})})}else{let a,i,n=/\\author\s*(?:\[([^\]]*)\])?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gi;for(;null!==(a=n.exec(e));)t.authors.push({name:a[2].trim(),affiliationIds:a[1]?a[1].split(","):[]});let r=/\\email\s*\{([^}]*)\}/gi;for(;null!==(i=r.exec(e));)t.authors.length>0&&(t.authors[t.authors.length-1].email=i[1])}return t}function o(e,t){let a="";if("article_acm"===e)a+=`\\title{${t.title||"Untitled"}}

`,t.authors.forEach(e=>{a+=`\\author{${e.name}}
`,e.email&&(a+=`\\email{${e.email}}
`),e.affiliationIds.forEach(e=>{let i=t.affiliations.find(t=>t.id===e);i&&(a+=`\\affiliation{
`,i.organization&&(a+=`  \\institution{${i.organization}}
`),i.department&&(a+=`  \\department{${i.department}}
`),i.street&&(a+=`  \\streetaddress{${i.street}}
`),i.city&&(a+=`  \\city{${i.city}}
`),i.state&&(a+=`  \\state{${i.state}}
`),i.postcode&&(a+=`  \\postcode{${i.postcode}}
`),i.country&&(a+=`  \\country{${i.country}}
`),a+=`}
`)})}),a+=`
\\date{\\today}

\\begin{abstract}
${t.abstract||"Abstract text goes here."}
\\end{abstract}

`,t.keywords&&(a+=`\\keywords{${t.keywords}}
`),a+=`\\maketitle

`;else if("article_ieee"===e)a+=`\\title{${t.title||"Untitled"}}

\\author{
`,t.authors.forEach((e,i)=>{a+=`  \\IEEEauthorblockN{${e.name}}
  \\IEEEauthorblockA{`,e.affiliationIds.forEach(i=>{let n=t.affiliations.find(e=>e.id===i);n&&(a+=`\\textit{${n.organization||""}}${n.department?`\\\\ ${n.department}`:""} \\\\ ${n.city||""}, ${n.country||""} \\\\ ${e.email||""}`)}),a+=`}${i<t.authors.length-1?" \\and\n":""}
`}),a+=`}

\\date{\\today}

\\maketitle

\\begin{abstract}
${t.abstract||"Abstract goes here."}
\\end{abstract}

`,t.keywords&&(a+=`\\begin{IEEEkeywords}
${t.keywords}
\\end{IEEEkeywords}
`);else if("article_elsevier"===e)a+=`\\begin{frontmatter}

\\title{${t.title||"Untitled"}}

`,t.authors.forEach(e=>{a+=`\\author[${e.affiliationIds.join(",")||"inst1"}]{${e.name}}
`}),t.affiliations.forEach(e=>{a+=`\\affiliation[${e.id||"inst1"}]{organization={${e.organization||""}}, department={${e.department||""}}, city={${e.city||""}}, country={${e.country||""}}}
`}),a+=`
\\date{\\today}

\\begin{abstract}
${t.abstract||"Abstract goes here."}
\\end{abstract}

`,t.keywords&&(a+=`\\begin{keyword}
${t.keywords}
\\end{keyword}
`),a+=`
\\end{frontmatter}
`;else if("article_springer_lncs"===e)a+=`\\title{${t.title||"Untitled"}}
`,t.runningTitle&&(a+=`\\titlerunning{${t.runningTitle}}
`),a+=`\\author{${t.authors.map((e,t)=>`${e.name}\\inst{${e.affiliationIds.join(",")||t+1}}`).join(" \\and ")||"Author Name"}}
`,t.runningAuthor&&(a+=`\\authorrunning{${t.runningAuthor}}
`),a+="\\institute{",t.affiliations.forEach((e,i)=>{a+=`${e.organization||""}, ${e.city||""}, ${e.country||""}${i<t.affiliations.length-1?" \\and\n":""}`}),a+=`}

\\date{\\today}

\\maketitle

\\begin{abstract}
${t.abstract||"Abstract goes here."}

\\keywords{${t.keywords||""}}
\\end{abstract}
`;else if("article_scirep"===e){a+=`\\title{${t.title||"Untitled"}}

`,t.authors.forEach((e,t)=>{let i=e.affiliationIds.join(",")||"1";a+=`\\author[${i}${e.isCorresponding?",*":""}]{${e.name}}
`}),t.affiliations.forEach(e=>{a+=`\\affil[${e.id||"1"}]{${e.organization||""}, ${e.city||""}, ${e.country||""}}
`});let e=t.authors.find(e=>e.isCorresponding);e?.email&&(a+=`\\affil[*]{${e.email}}
`),t.keywords&&(a+=`\\keywords{${t.keywords}}

`),a+=`\\begin{abstract}
${t.abstract||"Abstract text goes here."}
\\end{abstract}

\\date{\\today}

\\maketitle

`}else a+=`\\title{${t.title||"Untitled"}}
`,t.affiliations&&t.affiliations.length>0?(t.authors.forEach(e=>{let t=e.affiliationIds.join(",")||"1";a+=`\\author[${t}]{${e.name}}
`}),t.affiliations.forEach(e=>{a+=`\\affil[${e.id||"1"}]{${e.organization||""}${e.department?`, ${e.department}`:""}${e.city?`, ${e.city}`:""}${e.country?`, ${e.country}`:""}}
`})):a+=`\\author{${t.authors.map(e=>e.name).join(", ")||"Author Name"}}
`,a+=`\\date{\\today}

\\maketitle

`,t.abstract&&(a+=`\\begin{abstract}
${t.abstract}
\\end{abstract}

`),t.keywords&&(a+=`\\providecommand{\\keywords}[1]{\\textbf{\\textit{Keywords:}} #1}
\\keywords{${t.keywords}}

`);return a}function c(e,t,a){let i="";if(t.includes("acm")||/\\documentclass\s*(?:\[[^\]]*\])?\s*\{acmart\}/.test(e))i=o("article_acm",a);else if(t.includes("ieee")||/\\documentclass\s*(?:\[[^\]]*\])?\s*\{IEEEtran\}/.test(e))i=o("article_ieee",a);else if(t.includes("elsevier")||/\\documentclass\s*(?:\[[^\]]*\])?\s*\{elsarticle\}/.test(e))i=o("article_elsevier",a);else if(t.includes("scirep")||/\\documentclass\s*(?:\[[^\]]*\])?\s*\{wlscirep\}/.test(e))i=o("article_scirep",a);else if(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{llncs\}/.test(e))i=o("article_springer_lncs",a);else if(e.includes("\\begin{frontmatter}"))i=o("article_elsevier",a);else if(e.includes("\\institute{"))i=o("article_springer_lncs",a);else if(e.includes("\\affil["))i=o("article_scirep",a);else if(e.includes("\\abstract{")){let e=`\\title{${a.title||"Untitled"}}
`;e+=`\\author{${a.authors.map(e=>e.name).join(", ")||"Author"}}
\\abstract{${a.abstract||"Abstract text"}}
`,a.keywords&&(e+=`\\keyword{${a.keywords}}
`),e+=`\\date{\\today}

\\maketitle
`,i=e}else i=o("standard",a);return i.includes("\\maketitle")||i.includes("\\begin{frontmatter}")||(i+="\n\\maketitle\n"),i}}}]);