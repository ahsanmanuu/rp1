"use strict";exports.id=9491,exports.ids=[9491],exports.modules={20267:(a,b,c)=>{c.r(b),c.d(b,{ALLOWED_EXTENSIONS:()=>e,calculatePayloadSize:()=>k,detectBestEngine:()=>n,flattenProject:()=>l,getProjectStatusInfo:()=>o,isBinaryFile:()=>f,parseLog:()=>m,prepareStructuredPayload:()=>h,robustPreambleInjector:()=>j,sanitizeFiles:()=>g});var d=c(15029);let e=new Set([".tex",".bib",".cls",".sty",".bst",".cfg",".clo",".def",".fd",".ldf",".tikz",".txt",".otf",".ttf",".woff",".woff2",".tfm",".pfb",".afm",".lua",".lbx",".bbx",".cbx",".png",".jpg",".jpeg",".pdf",".eps",".svg",".webp",".avif",".gif",".tif",".tiff",".bmp",".heic",".heif"]);function f(a){if(!a)return!1;let b=a.substring(a.lastIndexOf(".")).toLowerCase();return/^\.(png|jpg|jpeg|webp|avif|gif|tif|tiff|bmp|pdf|eps|heic|heif|otf|ttf|woff|woff2|tfm|pfb|afm)$/i.test(b)}function g(a){return(a||[]).filter(a=>{if(!a.path)return!1;let b=a.path.substring(a.path.lastIndexOf(".")).toLowerCase(),c=a.path.includes("__MACOSX")||a.path.includes(".DS_Store")||a.path.includes(".bak");return e.has(b)&&!c})}function h(a,b){return{files:(a||[]).map(a=>({...a,path:(a.path||"").replace(/\\/g,"/").replace(/^\.\//,"")})),mainFile:(b||"main.tex").replace(/\\/g,"/").replace(/^\.\//,"")}}let i=new Set(["article","report","book","letter","proc","minimal","memoir","scrartcl","scrreprt","scrbook","amsart","smplart","beamer"]);function j(a){if(!a)return a;let b=(0,d.Hu)(a);if(!/\\documentclass\b/.test(b))return b;b.includes("RequirePackage{graphicx}")||(b="\\RequirePackage{graphicx}\n\\PassOptionsToPackage{export}{adjustbox}\n"+b);let c=b.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);if(!(c&&!i.has(c[1].toLowerCase()))){if(!b.includes("NuclearTrackerV30")){let a=`
% --- NUCLEAR 30.0 CORE DEFINITIONS (NuclearTrackerV30) ---
\u005cPassOptionsToPackage{export}{graphicx}
\u005cPassOptionsToPackage{export}{adjustbox}
\u005cifdefined\u005cNuclearTrackerV30\u005celse
  \u005cdef\u005cNuclearTrackerV30{1}
  \u005cusepackage{iftex} % MANDATORY Engine Guard
  \u005cifdefined\u005cpdfsavepos\u005celse\u005clet\u005cpdfsavepos\u005csavepos\u005cfi
  \u005cifdefined\u005cpdflastxpos\u005celse\u005clet\u005cpdflastxpos\u005clastxpos\u005cfi
  \u005cifdefined\u005cpdflastypos\u005celse\u005clet\u005cpdflastypos\u005clastypos\u005cfi
  \u005cmaxdeadcycles=2000
  \u005cusepackage{graphicx}
  \u005cgraphicspath{{./}{./assets/}{./images/}{./figures/}{../}{../assets/}{../images/}{./figures/}}
  \u005cnewwrite\u005cghostwriter
  \u005cimmediate\u005copenout\u005cghostwriter=ghost.trc
  \u005cifdefined\u005czimgRender\u005celse
    \u005cnewcommand{\u005czimgRender}[3]{%
      \u005cpdfsavepos
      \u005cimmediate\u005cwrite\u005cghostwriter{@PI@L:\u005cdetokenize{#3}:\u005cthe\u005cpdflastxpos:\u005cthe\u005cpdflastypos}%
      \u005ccsname includegraphics\u005cendcsname[#2]{#1}%
      \u005cpdfsavepos
      \u005cimmediate\u005cwrite\u005cghostwriter{@PI@R:\u005cdetokenize{#3}:\u005cthe\u005cpdflastxpos:\u005cthepage:EOF@PI}%
    }
  \u005cfi
  \u005cifdefined\u005czimg\u005celse
    \u005cnewcommand{\u005czimg}[4]{%
      \u005cleavevmode
      \u005cIfFileExists{\u005cdetokenize{#1}}{%
        \u005czimgRender{\u005cdetokenize{#1}}{#2}{#3}%
      }{%
        \u005cIfFileExists{\u005cdetokenize{#1.png}}{%
          \u005czimgRender{\u005cdetokenize{#1.png}}{#2}{#3}%
        }{%
          \u005cIfFileExists{\u005cdetokenize{#1.jpg}}{%
            \u005czimgRender{\u005cdetokenize{#1.jpg}}{#2}{#3}%
          }{%
            \u005cIfFileExists{../\u005cdetokenize{#1}}{%
              \u005czimgRender{../\u005cdetokenize{#1}}{#2}{#3}%
            }{%
              \u005cIfFileExists{../\u005cdetokenize{#1.png}}{%
                \u005czimgRender{../\u005cdetokenize{#1.png}}{#2}{#3}%
              }{%
                \u005cIfFileExists{../\u005cdetokenize{#1.jpg}}{%
                  \u005czimgRender{../\u005cdetokenize{#1.jpg}}{#2}{#3}%
                }{%
                  \u005cIfFileExists{assets/\u005cdetokenize{#1}}{%
                    \u005czimgRender{assets/\u005cdetokenize{#1}}{#2}{#3}%
                  }{%
                    \u005cwrite16{NUCLEAR WARNING: Image \u005cdetokenize{#1} not found, skipping safely.}%
                    \u005cframebox(100,100){Image Missing: \u005cdetokenize{#1}}%
                  }%
                }%
              }%
            }%
          }%
        }%
      }%
    }
  \u005cfi

  % --- TABLE & LINENO HARMONIZATION ---
  \u005cmakeatletter
  \u005cAtBeginDocument{
    \u005cifdefined\u005cnolinenumbers
      \u005cifdefined\u005ctabular
        \u005clet\u005coldtabular\u005ctabular
        \u005clet\u005coldendtabular\u005cendtabular
        \u005crenewenvironment{tabular}[2][]{%
          \u005cnolinenumbers\u005coldtabular[#1]{#2}%
        }{%
          \u005coldendtabular%
        }
      \u005cfi
    \u005cfi
    % --- UNIVERSAL BIBLIOGRAPHY HEADING FALLBACK ---
    \u005cprovidecommand{\u005crefname}{References}%
    \u005cifdefined\u005cbibsection
      \u005cifx\u005cbibsection\u005cempty
        \u005crenewcommand{\u005cbibsection}{\u005csection*{\u005crefname}}%
      \u005celse
        \u005cifx\u005cbibsection\u005c@empty
          \u005crenewcommand{\u005cbibsection}{\u005csection*{\u005crefname}}%
        \u005cfi
      \u005cfi
    \u005cfi
  }
  \u005cmakeatother
\u005cfi
% --- END NUCLEAR DEFINITIONS ---
`,c=/\\documentclass\s*(?:\[[\s\S]*?\])?\s*\{[\s\S]*?\}/;b=c.test(b)?b.replace(c,b=>`${b}
${a}`):a+"\n"+b}let a=b.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);if(a){let c=a=>RegExp(`\\\\usepackage\\s*(?:\\[[^\\]]*\\])?\\s*\\{[^}]*\\b${a}\\b[^}]*\\}`).test(b),d=!["article","report","book","letter"].includes(a[1].toLowerCase()),e=b.match(/\\begin\s*\{\s*document\s*\}/);if(e&&void 0!==e.index){let a=e.index,f=[];c("fontenc")||f.push("\\ifPDFTeX\\usepackage[T1]{fontenc}\\fi"),c("xurl")||c("url")?!c("xurl")&&c("url")&&f.push("\\usepackage{xurl}"):f.push("\\usepackage{xurl}"),c("microtype")||f.push("\\usepackage{microtype}"),d||c("geometry")||f.push("\\usepackage[margin=1in]{geometry}"),c("listings")||f.push("\\usepackage{listings}"),/\\spacing\b/.test(b)&&!c("setspace")&&f.push("\\usepackage{setspace}"),f.length>0&&(b=b.slice(0,a)+f.join("\n")+"\n"+b.slice(a))}}}let e=(b=(0,d.oM)(b)).match(/\\begin\s*\{\s*document\s*\}/);return e&&!b.includes("% StudioOverflowGuards")&&(b=b.replace(/\\begin\s*\{\s*document\s*\}/,`${e[0]}
% StudioOverflowGuards — injected by Latexify compiler for proper line breaking
\\emergencystretch=8em
\\hbadness=10000
\\tolerance=2000
\\hyphenpenalty=10
\\exhyphenpenalty=10
\\binoppenalty=100
\\relpenalty=100
\\makeatletter
\\ifx\\urlstyle\\@undefined\\else\\urlstyle{same}\\fi
\\ifx\\Urlmuskip\\@undefined\\else\\Urlmuskip=0mu plus 1mu\\fi
\\ifx\\UrlBreaks\\@undefined\\else
  \\g@addto@macro{\\UrlBreaks}{\\do\\/\\do\\-\\do\\.\\do\\a\\do\\b\\do\\c\\do\\d\\do\\e\\do\\f\\do\\g\\do\\h\\do\\i\\do\\j\\do\\k\\do\\l\\do\\m\\do\\n\\do\\o\\do\\p\\do\\q\\do\\r\\do\\s\\do\\t\\do\\u\\do\\v\\do\\w\\do\\x\\do\\y\\do\\z\\do\\A\\do\\B\\do\\C\\do\\D\\do\\E\\do\\F\\do\\G\\do\\H\\do\\I\\do\\J\\do\\K\\do\\L\\do\\M\\do\\N\\do\\O\\do\\P\\do\\Q\\do\\R\\do\\S\\do\\T\\do\\U\\do\\V\\do\\W\\do\\X\\do\\Y\\do\\Z\\do\\0\\do\\1\\do\\2\\do\\3\\do\\4\\do\\5\\do\\6\\do\\7\\do\\8\\do\\9}
\\fi
\\ifx\\setkeys\\@undefined\\else\\setkeys{Gin}{max width=\\linewidth,max height=0.7\\textheight,keepaspectratio}\\fi
\\ifx\\lstset\\@undefined\\else
  \\lstset{breaklines=true,breakatwhitespace=false,basicstyle=\\small\\ttfamily,
    columns=flexible,keepspaces=true,breakindent=0pt}%
\\fi
\\makeatother`)),b}function k(a){return(a||[]).reduce((a,b)=>b.content.startsWith("data:")?a+(b.content.length-b.content.indexOf(",")-1)*.75:a+Buffer.byteLength(b.content,"utf8"),0)}function l(a,b){let c=new Map((a||[]).map(a=>[a.path.replace(/\\/g,"/").replace(/^\.\//,"").toLowerCase(),a.content])),d=new Set;return function a(b,e=0){if(e>20)return"";let f=b.replace(/\\/g,"/").replace(/^\.\//,"").toLowerCase();if(d.has(f))return"";d.add(f);let g=c.get(f)||"";if(!g){for(let[a,b]of Array.from(c.entries()))if(a.endsWith("/"+f)||f.endsWith("/"+a)||a.split("/").pop()===f.split("/").pop()){g=b;break}}if(!g)return"";if(e>0){let a=g.indexOf("\\begin{document}"),b=g.lastIndexOf("\\end{document}");g=-1!==a&&-1!==b&&b>a?g.substring(a+16,b):g.replace(/\\documentclass[\s\S]*?\{[^}]*\}/gi,"").replace(/\\begin\s*\{\s*document\s*\}/gi,"").replace(/\\end\s*\{\s*document\s*\}/gi,"")}return g.replace(/\\(?:input|include|subfile|import|subimport)\s*(?:\{([^}]*)\}\s*\{([^}]*)\}|\{([^}]*)\}|([^\s\\%{}]+))/gi,(b,d,g,h,i)=>{let j=(h||g||i||"").trim();if(d&&g&&(j=(d.trim()+"/"+g.trim()).replace(/\/\//g,"/")),!j)return b;(j=j.replace(/\\/g,"/").replace(/^\.\//,"")).toLowerCase().endsWith(".tex")||j.includes(".")||(j+=".tex");let k=[j,(f.includes("/")?f.substring(0,f.lastIndexOf("/")+1):"")+j,`chapters/${j}`,`sections/${j}`].find(a=>c.has(a.toLowerCase())||Array.from(c.keys()).some(b=>b.endsWith("/"+a.toLowerCase())||b.split("/").pop()===a.toLowerCase().split("/").pop()));return k?a(k,e+1):b})}(b,0)}function m(a){let b=[],c=new Set,d=(a||"").split("\n");return d.forEach((a,e)=>{let f=a.trim();if(!f)return;if(f.startsWith("!")){let a=0,g=f.substring(1).trim();for(let b=e+1;b<Math.min(e+10,d.length);b++){let c=d[b].trim().match(/^l\.(\d+)/);if(c){a=parseInt(c[1]);break}}let h=`err:${a}:${g}`;c.has(h)||(c.add(h),b.push({line:a,type:"error",message:g,raw:f}));return}let g=f.match(/^warning:\s+(.*)/i),h=f.match(/^error:\s+(.*)/i);if(g){let a=g[1],d=a.match(/^(.*?):(\d+):\s*(.*)/),e=d?parseInt(d[2]):0,h=d?d[3].trim():a.trim(),i=`warn:${e}:${h}`;c.has(i)||(c.add(i),b.push({file:d?d[1].replace(/^\.\//,""):void 0,line:e,type:"warning",message:h,raw:f}));return}if(h){let a=h[1],d=a.match(/^(.*?):(\d+):\s*(.*)/),e=d?parseInt(d[2]):0,g=d?d[3].trim():a.trim(),i=`err:${e}:${g}`;c.has(i)||(c.add(i),b.push({file:d?d[1].replace(/^\.\//,""):void 0,line:e,type:"error",message:g,raw:f}));return}let i=f.match(/^(.*?):(\d+):\s*(.*)/);if(i){let a=parseInt(i[2]),d=i[3].trim(),e=`err:${a}:${d}`;c.has(e)||(c.add(e),b.push({file:i[1].replace(/^\.\//,""),line:a,type:"error",message:d,raw:f}));return}if(f.includes("LaTeX Warning:")||f.includes("Package")&&f.includes("Warning:")){let d=f.match(/line\s+(\d+)/i),e=a.match(/\((.*?)\)/),g=d?parseInt(d[1]):0,h=f.split(":").pop()?.trim()||f,i=`warn:${g}:${h}`;c.has(i)||(c.add(i),b.push({file:e?e[1].split("/").pop():void 0,line:g,type:"warning",message:h,raw:f}))}if(f.includes("color color")||f.includes("Scale=MatchLowercase")||f.includes("bstract")){let a="warn:0:phantom";c.has(a)||(c.add(a),b.push({line:0,type:"warning",message:`Detected phantom artifact in output: ${f.substring(0,50)}...`,raw:f}))}}),b}function n(a){let b="string"==typeof a?a:Object.values(a||{})[0]||"";return b?b.includes("\\usepackage{luacode}")||b.includes("\\directlua")||b.includes("luacode*")?"lualatex":b.includes("\\usepackage{fontspec}")||b.includes("\\usepackage{unicode-math}")||b.includes("\\usepackage{polyglossia}")?"xelatex":(b.includes("\\usepackage[T1]{fontenc}")&&!b.includes("\\usepackage{fontspec}"),"pdflatex"):"pdflatex"}function o(a){switch(a){case"processing":return{color:"#f59e0b",label:"Processing"};case"ready":return{color:"#10b981",label:"Ready"};case"failed":return{color:"#ef4444",label:"Failed"};default:return{color:"#6366f1",label:"Idle"}}}},29486:(a,b,c)=>{c.d(b,{f:()=>h});var d=c(29021),e=c.n(d),f=c(33873),g=c.n(f);class h{static{this.INTERMEDIATE_EXTS=[".aux",".log",".out",".synctex.gz",".fls",".fdb_latexmk",".toc",".lof",".lot",".blg",".bbl",".bcf",".run.xml",".idx",".ilg",".ind",".nav",".snm",".vrb",".thm"]}static async flushResidue(a){let b=g().join(process.cwd(),"public","uploads","projects",a),c=[],d=0;if(!e().existsSync(b))return{purged:0,errors:[`Directory not found: ${b}`]};try{for(let a of(await e().promises.readdir(b))){let f=g().extname(a).toLowerCase();if(this.INTERMEDIATE_EXTS.includes(f)){let f=g().join(b,a);try{await e().promises.unlink(f),d++}catch(b){c.push(`Failed to delete ${a}: ${b.message}`)}}}}catch(a){c.push(`Directory read failed: ${a.message}`)}return console.log(`[PIPELINE_GC] Project ${a}: Purged ${d} residue files.`),{purged:d,errors:c}}static async purgeTemplateStubs(){let a=g().join(process.cwd(),"src","assets","templates"),b=[];if(!e().existsSync(a))return{deleted:[]};let c=async a=>{for(let d of(await e().promises.readdir(a,{withFileTypes:!0}))){let f=g().join(a,d.name);if(d.isDirectory())await c(f);else if(d.isFile()){let a=g().extname(d.name).toLowerCase();if((".cls"===a||".sty"===a)&&(await e().promises.stat(f)).size<1024){let a=await e().promises.readFile(f,"utf8");(a.toLowerCase().includes("stub")||a.toLowerCase().includes("minimal"))&&(await e().promises.unlink(f),b.push(f))}}}};return await c(a),console.log(`[PIPELINE_GC] Purged ${b.length} template stubs.`),{deleted:b}}static sanitizeBuffers(a){for(let b=0;b<a.length;b++)if(a[b]){if(Array.isArray(a[b]))a[b].length=0;else if("object"==typeof a[b])for(let c in a[b])Object.prototype.hasOwnProperty.call(a[b],c)&&delete a[b][c];a[b]=null}}}},89491:(a,b,c)=>{c.r(b),c.d(b,{compileInSafeMode:()=>O,compileWithLatexOnline:()=>N,compileWithTexLive:()=>M,compileWithYtoTech:()=>L,hardenedDiscovery:()=>Q,inkGhostPdf:()=>P,nuclearCompile:()=>S,persistPdf:()=>R,runDoc2LatexCompiler:()=>K,runHardenedPipeline:()=>H,runLatexifyCompiler:()=>I,runMigratorCompiler:()=>J});var d=c(20267),e=c(78199),f=c(29021),g=c(33873),h=c(9288),i=c.n(h),j=c(29486),k=c(15029);function l(a){return(a||"").replace(/^\.\//,"").replace(/\\/g,"/").toLowerCase()}function m(a,b){let c=l(b);return a.some(a=>l(a.path)===c)}let n=/\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\b(amsmath|amssymb|amsfonts|mathtools)\b[^}]*\}/i,o=/\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bgraphicx\b[^}]*\}/i,p=/\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bhyperref\b[^}]*\}/i,q=/\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bcleveref\b[^}]*\}/i,r=/\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\badjustbox\b[^}]*\}/i,s=/\\allowdisplaybreaks\s*/,t=/\\graphicspath\s*\{([^{}]*|\{[^{}]*\})*\}/,u=/\\DeclareGraphicsExtensions\s*\{([^{}]*|\{[^{}]*\})*\}/,v=/\\includegraphics\s*(?:\[[^\]]*\b(max\s*(?:width|height))\b[^\]]*\])?\s*\{/i,w=/\\(usepackage|RequirePackage|input)\s*(?:\[[^\]]*\])?\s*\{packages\}\s*/gi;function x(a,b,c,d){let e,f=[],g=a,h=RegExp(b.source,"g"+(b.flags.includes("i")?"i":"")),i=g.match(c);if(!i||void 0===i.index)return{content:g,fixes:f};let j=i.index+i[0].length,k=[];for(h.lastIndex=0;null!==(e=h.exec(g));)k.push({full:e[0],index:e.index});if(0===k.length)return{content:g,fixes:f};let l=k.filter(a=>a.index<j);if(0===l.length)return{content:g,fixes:f};for(let a=l.length-1;a>=0;a--){let b=l[a];g=g.substring(0,b.index)+g.substring(b.index+b.full.length)}let m=j-l.reduce((a,b)=>a+b.full.length,0),n=g.substring(0,m),o=g.substring(m);return g=n+"\n"+l.map(a=>a.full).join("\n")+o,f.push(`Moved ${l.length} ${d} after its required package`),{content:g,fixes:f}}function y(a){return(a||"").replace(/^\.\//,"").replace(/\\/g,"/").toLowerCase()}let z=`
ENTRY
  { address author booktitle chapter edition editor howpublished institution
    journal key month note number organization pages publisher school series
    title type volume year }
  {}
  { label }

STRINGS { s }

FUNCTION {bibitem}
{ newline$
  "\\bibitem{" write$
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
`;function A(a){return`% Latexify Studio universal numeric bibliography style (auto-injected)
${z}
READ
${a?'FUNCTION {begin.bib} { "\\begin{thebibliography}{99}" write$ newline$ }\nEXECUTE {begin.bib}\n':""}ITERATE { call.type$ }
REVERSE { newline$ }
${a?'FUNCTION {end.bib} { newline$ "\\end{thebibliography}" write$ newline$ }\nEXECUTE {end.bib}\n':""}`}let B=new Set(["elsarticle","nature","ieee","ieeetran","acmart","sigconf","sigplan","sigchi","llncs","svproc","springer","siamart","siam","amsart","amscls","revtex","apa","apa6","apa7","bjnp","bjnpp","rnc","chemmacros","chemacs","gloss","glossaries","memoir","scrartcl","scrreprt","scrbook","achemso","rsc","frontiers","mdpi","oup","oxford","wiley"]),C=["https://latex.asls.dev","https://texonline.cc"],D=["https://texlive.net/cgi-bin/latexcgi","https://learnlatex.org/cgi-bin/latexcgi"];async function E(a,b,c=""){let d;for(let e of a)try{let a=e.endsWith("/")?e.slice(0,-1):e,d=c?`${a}${c.startsWith("/")?c:"/"+c}`:a,f=await fetch(d,b);if(f.ok)return f;continue}catch(a){d=a}throw d||Error("All mirrors exhausted")}let F="%%SCHOLARLY_BIB_HEADING%%";async function G(a){try{let b=Buffer.from(a,"base64"),d=await c.e(7944).then(c.bind(c,57944)),e=d.PDFParse??d.default?.PDFParse;if(!e)return!0;let f=new e({data:b}),g=await f.getText(),h="string"==typeof g?g:g&&g.text?g.text:"";if(!h)return!0;let i=h.slice(-3e3);return/\b(references|bibliography|reference|works cited|references cited)\b/i.test(i)}catch{return!0}}async function H(a,b,e,h,z={profile:"generic",ghostMode:!0}){try{var C;let D,E=(C=await Q(h,b,e),D=[],l(e),{files:C.map(a=>{if("tex"!==(a.path.split(".").pop()?.toLowerCase()||"")||"string"!=typeof a.content)return a;let b=function(a,b){let c=a,d=[],e=/\\(usepackage|RequirePackage)\s*(\[[^\]]*\])?\s*\{([^}]*)\bgraphics\b([^}]*)\}/g;e.test(c)&&(c=c.replace(e,(a,b,c,e,f)=>(d.push("Upgraded legacy graphics package to graphicx"),`\\${b}${c||""}{${e}graphicx${f}}`))),(c.includes("usepackage[export]{graphicx}")||c.includes("RequirePackage[export]{graphicx}"))&&(c=c.replace(/\\(usepackage|RequirePackage)\s*\[export\]\s*\{graphicx\}/g,(a,b)=>(d.push("Moved [export] option from graphicx to adjustbox"),`\\${b}{graphicx}
\\PassOptionsToPackage{export}{adjustbox}
\\${b}{adjustbox}`))),c=c.replace(/\\(input|include|import|subfile|subimport)(?:\*|\[.*?\])?\s*\{([^}]+)\}/gi,(a,b,c)=>c.includes("\\-")?(d.push(`Healed hyphenated path in \\${b}{${c}}`),`\\${b}{${c.replace(/\\-/g,"")}}`):a);let f=m(b,"packages.sty"),g=m(b,"packages.tex");if(f||g||(c=c.replace(w,a=>(d.push("Commented out missing packages.sty reference"),`% ${a.trim()} -- REMOVED (not found in project)`))),s.test(c)&&!n.test(c)){let a=c.match(s);if(a){let b=a.index;c=c.substring(0,b)+"\\usepackage{amsmath}\n"+c.substring(b),d.push("Injected amsmath before \\allowdisplaybreaks")}}else if(n.test(c)&&s.test(c)){let a=x(c,/\\allowdisplaybreaks\s*/g,n,"\\allowdisplaybreaks");c=a.content,d.push(...a.fixes)}if(t.test(c)&&!o.test(c)){let a=c.match(t);if(a){let b=a.index;c=c.substring(0,b)+"\\usepackage{graphicx}\n"+c.substring(b),d.push("Injected graphicx before \\graphicspath")}}else if(o.test(c)&&t.test(c)){let a=x(c,t,o,"\\graphicspath");c=a.content,d.push(...a.fixes)}if(u.test(c)&&!o.test(c)){let a=c.match(u);if(a){let b=a.index;c=c.substring(0,b)+"\\usepackage{graphicx}\n"+c.substring(b),d.push("Injected graphicx before \\DeclareGraphicsExtensions")}}else if(o.test(c)&&u.test(c)){let a=x(c,u,o,"\\DeclareGraphicsExtensions");c=a.content,d.push(...a.fixes)}if(q.test(c)&&p.test(c)){let a=x(c,q,p,"cleveref");c=a.content,d.push(...a.fixes)}if(q.test(c)&&n.test(c)){let a=x(c,q,n,"cleveref");c=a.content,d.push(...a.fixes)}return v.test(c)&&!r.test(c)&&(c=c.replace(/(\\documentclass\s*(?:\[[^\]]*\])?\s*\{[^}]*\})/,"$1\n\\PassOptionsToPackage{export}{adjustbox}\n\\usepackage{adjustbox}"),d.push("Injected adjustbox[export] for \\includegraphics max width/height support")),{content:c=c.replace(/\\DeclareGraphicsExtensions\s*\{\s*\}/g,"% Removed empty \\DeclareGraphicsExtensions"),fixes:d}}(a.content,C);return b.fixes.length>0&&D.push(`[${a.path}] ${b.fixes.join("; ")}`),{...a,content:b.content}}),fixes:D});E.fixes.length>0&&console.log(`[PREPROCESSOR] Applied ${E.fixes.length} fixes:
  ${E.fixes.join("\n  ")}`);let H=E.files.map(a=>a),I=[],J=new Set(H.filter(a=>!a.path.includes("/")&&!a.path.includes("\\")).map(a=>a.path.toLowerCase()));for(let a of H)if(a.path.includes("/")||a.path.includes("\\")){let b=g.basename(a.path),c=b.split(".").pop()?.toLowerCase()||"";/^(cls|sty|bst|bib|clo|def|cfg|ldf|fd|bbx|cbx)$/i.test(c)&&!J.has(b.toLowerCase())&&(I.push({path:b,content:a.content}),J.add(b.toLowerCase()),console.log(`[PIPELINE] Auto-linked support file to root: ${a.path} -> ${b}`))}let K=[...H,...I],O=K.find(a=>a.path.toLowerCase()===e.toLowerCase())?.path||e;K.forEach(a=>{"string"!=typeof a.content&&(a.content=String(a.content||""))});let R=[],S=K.find(a=>y(a.path)===y(O)),T=!!(S&&"string"==typeof S.content&&S.content.includes("\\documentclass"));if(S&&"string"==typeof S.content){let a=new Set(K.map(a=>y(a.path))),b=S.content.match(/\\(?:include|input)\s*\{([^}]+)\}/gi);if(b)for(let d of b){let b=d.match(/\\(?:include|input)\s*\{([^}]+)\}/);if(!b)continue;let f=b[1].trim();for(let b of f.endsWith(".tex")?[f]:[f+".tex"]){let f=y(b);if(!a.has(f)){let g=!1;if(h&&!T)try{let{prisma:d}=c(93061),e=await d.projectFile.findFirst({where:{projectId:h,filename:b}});e?.content&&(K.push({path:b,content:e.content}),a.add(f),g=!0,console.log(`[PIPELINE] Recovered missing file from ProjectFile: ${b} (${e.content.length}b)`))}catch(a){console.warn("[PIPELINE] ProjectFile recovery error:",a)}if(!g){S.content=S.content.replace(d,`\\iffalse % DISABLED (file not found: ${b})
${d}
\\fi`);let a=`Missing file: ${b} (referenced by ${e}) — disabled during compile; its content is NOT in the PDF. Re-upload the source document to restore it.`;R.push(a),console.warn(`[PIPELINE] Disabled missing file reference (no recovery): ${b}`)}}}}}if(K.some(a=>"string"==typeof a.content&&a.content.includes("\\begin{thebibliography}"))){let a=/\\section\*?\{References\}[^\S\r\n]*(?=(?:\s*(?:\\section|\\subsection|\\subsubsection|\\chapter|\\input|\\include|\\end\{document\})|\s*$))/gi,b=0;for(let c of K){if("string"!=typeof c.content||!/\\section\*?\{References\}/i.test(c.content))continue;let d=c.content.replace(a,"");d!==c.content&&(c.content=d,b++)}b>0&&console.log(`[PIPELINE] Stripped ${b} duplicate empty "References" section heading(s) (inline bibliography owns the heading).`)}let U=(0,d.calculatePayloadSize)(K),V=K.filter(a=>a.content.startsWith("data:image")).length,W={},X=z.ghostMode,Y=async a=>await Promise.all(a.map(async a=>{if((0,d.isBinaryFile)(a.path)&&a.content.startsWith("data:image")){if(!X){let b=a.path.split(".").pop()?.toLowerCase()||"";if(["webp","avif","gif","tiff","tif","bmp","svg","heic","heif"].includes(b))try{let c=a.content.split(",")[1]||a.content,d=Buffer.from(c,"base64"),e=i()(d);"svg"===b&&(e=i()(d,{density:300}));let f=await e.png().toBuffer(),g=a.path.replace(/\.[^.]+$/,".png");return g!==a.path&&(W[a.path]=g,console.log(`[OMEGA] Non-Ghost Asset Transformed: ${a.path} -> ${g}`)),{...a,path:g,content:`data:image/png;base64,${f.toString("base64")}`}}catch(b){console.error("[OMEGA] Non-Ghost normalization fail:",a.path,b)}let c=a.content.split(";")[0].split(":")[1]||"",d="image/jpg"===c||"image/JPG"===c||"image/JPEG"===c?"image/jpeg":"image/PNG"===c?"image/png":c;if(d&&d!==c){let b=a.content.indexOf(",");return{...a,content:`data:${d};base64,${a.content.slice(b+1)}`}}return a}let b=a.content.split(",")[1]||a.content,c=Buffer.from(b,"base64"),d=a.path.split(".").pop()?.toLowerCase()||"";try{if(["pdf","eps"].includes(d))return a;let b=await i()(c).metadata(),e=i()(c),f=d,g=`image/${"pdf"===d?"pdf":"jpg"===d||"jpeg"===d?"jpeg":d}`;if(b.width&&b.height&&b.width<=600&&b.height<=600&&!b.hasAlpha&&("jpg"===d||"jpeg"===d)&&c.length<102400)return a;let h=["webp","avif","gif","tiff","tif","bmp","svg","heic","heif"].includes(d);"png"===d||b.hasAlpha||"svg"===d?(e=e.flatten({background:"#ffffff"}).jpeg({quality:40,mozjpeg:!0}),f="jpg",g="image/jpeg"):(h||"jpg"===d||"jpeg"===d)&&(e=e.jpeg({quality:40,mozjpeg:!0}),f="jpg",g="image/jpeg"),e=e.resize(600,600,{fit:"inside",withoutEnlargement:!0});let j=await e.toBuffer(),k=a.path.replace(/\.[^.]+$/,`.${f}`);return k!==a.path&&(W[a.path]=k,console.log(`[OMEGA] Asset Transformed: ${a.path} -> ${k}`)),{...a,path:k,content:`data:${g};base64,${j.toString("base64")}`}}catch(c){console.error("[OMEGA] Normalization fail, dropping corrupt asset:",a.path,c);let b=a.path.replace(/\.[^.]+$/,".png");return b!==a.path&&(W[a.path]=b),{...a,path:b,content:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="}}}return a}));console.log(`[PIPELINE] Omega Strategy. Size: ${(U/1048576).toFixed(2)} MB, Images: ${V}, Mode: ${X?"GHOST":"FULL"}`),X&&H.forEach(a=>{y(a.path)===y(O)&&(a.content=(0,d.robustPreambleInjector)(a.content))}),H.forEach(a=>{if(y(a.path)===y(O)){let b=a.content.includes("\\documentclass"),c=a.content.includes("\\begin{document}"),d=a.content.includes("\\end{document}");b&&(c?d||(a.content=`${a.content}
\\end{document}`):a.content=`${a.content}
\\begin{document}
\\end{document}`)}});let Z=await Y(K);Z.forEach(a=>{"string"!=typeof a.content&&(a.content=String(a.content||""))}),Object.keys(W).length>0&&Z.forEach(a=>{let b=a.path.split(".").pop()?.toLowerCase()||"";if(/^(tex|cls|sty|bib)$/i.test(b))for(let[b,c]of Object.entries(W)){let d=b.split("/").pop()||"",e=c.split("/").pop()||"";d&&e&&(a.content=a.content.split(d).join(e),a.content=a.content.split(`{${d.replace(/\.[^.]+$/,"")}}`).join(`{${e.replace(/\.[^.]+$/,"")}}`))}}),Z.forEach(a=>{let b=a.path.split(".").pop()?.toLowerCase()||"";/^(tex)$/i.test(b)&&(a.content=(0,k.oM)(a.content),a.content=a.content.replace(/\\(usepackage|RequirePackage)\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/g,(a,b,c,d)=>{let e=d.split(",").map(a=>{let b=a.trim();if(b.includes("/")){let a=b.split("/").pop()||b;return console.log(`[OMEGA] Rewriting package inclusion: ${b} -> ${a}`),a}return b}).join(", ");return`\\${b}${c?`[${c}]`:""}{${e}}`}))});let $=new Set(["elsarticle","nature","ieee","ieeetran","acmart","sigconf","sigplan","sigchi","llncs","svproc","springer","siamart","siam","amsart","amscls","revtex","apa","apa6","apa7","bjnp","bjnpp","rnc","chemmacros","chemacs","gloss","glossaries","memoir","scrartcl","scrreprt","scrbook"]);Z.forEach(a=>{let b=a.path.split(".").pop()?.toLowerCase()||"";if("tex"!==b||y(a.path)!==y(O))return;let c=a.content.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);if(!c)return;let d=c[1].trim().toLowerCase(),e=$.has(d)||/ieee|nature|elsarticle|acmart|llncs|svproc|siam|revtex|apa/.test(d),f=/\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bnatbib\b[^}]*\}/i.test(a.content);if(e||f){let b=a.content.length;a.content=a.content.replace(/\\(usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/gi,(a,b,c)=>{let d=c.split(",").map(a=>a.trim()).filter(a=>"cite"!==a.toLowerCase());return 0===d.length?"":`\\${b}{${d.join(", ")}}`}),a.content.length!==b&&console.log(`[PIPELINE] Stripped \\usepackage{cite} — document class "${d}" has built-in citation support.`)}});let _={};Z=Z.map(a=>{if(a.path.toLowerCase().endsWith(".tex")){let b=(0,d.robustPreambleInjector)(a.content);return b.includes("\\nonstopmode")||(b.includes("\\documentclass")?b=b.replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/,a=>`${a}
\\nonstopmode
`):y(a.path)===y(O)&&(b=`\\nonstopmode
${b}`)),b.includes("\\begin{document}")&&!b.includes("\\end{document}")&&(b+="\n\\end{document}\n"),{...a,content:b}}return a}),X&&Z.forEach(a=>{let b=a.path.split(".").pop()?.toLowerCase()||"";if("tex"===b){a.content=a.content.replace(/\\(newcommand|renewcommand|providecommand)\s*\\?zimg\b[\s\S]*?\{([\s\S]*?)\}/g,a=>a.includes("\\includegraphics")?a.replace(/\\includegraphics/g,"\\csname includegraphics\\endcsname"):a);let b=0;a.content=a.content.replace(/\\includegraphics\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/g,(c,d,e)=>{let f=e.trim(),g=f,h=f.toLowerCase().replace(/^\.\//,"").replace(/\\/g,"/"),i=Object.entries(_).find(([a,b])=>a===h||a.endsWith("/"+h)||h.endsWith("/"+a)||a.replace(/\.[^.]+$/,"")===h||a.replace(/\.[^.]+$/,"").endsWith("/"+h));if(i&&(g=i[1]),f.startsWith("data:image")){let c=f.split(";")[0].split("/")[1]||"png",d=`vasset${b}${a.path.replace(/[^a-z0-9]/gi,"")}.${c}`;Z.push({path:d,content:f}),g=d}let j=Object.entries(_).find(([a,b])=>b===g)?.[0]||g,k=`tr${a.path.replace(/[^a-z0-9]/gi,"")}${b++}`;return`\u005czimg{${g}}{${(d||"").replace(/\n/g," ")}}{${k}}{${j}}`})}});let aa={};Z.forEach(a=>{(0,d.isBinaryFile)(a.path)&&(aa[y(a.path)]=a.content)});let ab=Z.map(a=>{let b=(0,d.isBinaryFile)(a.path);return{path:a.path,content:b&&aa[y(a.path)]||a.content}});if(X){let a=y(O);Z=Z.map(b=>{let c=b.path.split(".").pop()?.toLowerCase()||"",e=(0,d.isBinaryFile)(b.path);return y(b.path)===a||/^(cls|sty|bib|bst|cfg|clo|def|fd|ldf|tex)$/i.test(c)?b:e?"pdf"===c?{...b,content:"data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqIDIgMCBvYmo8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PmVuZG9iaiAzIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0vUmVzb3VyY2VzPDw+Pi9Db250ZW50cyA0IDAgUj4+ZW5kb2JqIDQgMCBvYmo8PC9MZW5ndGggMjM+PnN0cmVhbQpCVC9GMSAxMiBUcyAoSGVsbG8pIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAgbiAKMDAwMDAwMDExMSAwMDAwMCBuIAowMDAwMDAwMjEyIDAwMDAwIG4gCnRyYWlsZXI8PC9TaXplIDUvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoyODYKJSVFT0YK"}:"jpg"===c||"jpeg"===c?{...b,content:"data:image/jpeg;base64,/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpAB//Z"}:{...b,content:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="}:b})}let ac={"lettersp.sty":"% lettersp.sty stub – Latexify Studio TeX Live 2026 compatibility shim\n\\NeedsTeXFormat{LaTeX2e}\n\\ProvidesPackage{lettersp}[2024/01/01 v0.1 letterspacing stub]\n\\endinput","NJDnatbib.sty":"% NJDnatbib.sty stub – Latexify Studio shim for Wiley USG.cls\n\\NeedsTeXFormat{LaTeX2e}\n\\ProvidesPackage{NJDnatbib}[2024/01/01 v1.0 Wiley NJDnatbib stub]\n\\RequirePackage{natbib}\n\\setcitestyle{numbers,sort&compress}\n\\endinput","wileyNJD.sty":"% wileyNJD.sty stub – Latexify Studio shim for Wiley journal classes\n\\NeedsTeXFormat{LaTeX2e}\n\\ProvidesPackage{wileyNJD}[2024/01/01 v1.0 Wiley NJD stub]\n\\endinput","sn-mathbf-bold.sty":"% sn-mathbf-bold.sty stub – Latexify Studio shim for Springer sn-jnl\n\\NeedsTeXFormat{LaTeX2e}\n\\ProvidesPackage{sn-mathbf-bold}[2024/01/01 v1.0 stub]\n\\endinput","lastpage.sty":"% lastpage.sty stub\n\\NeedsTeXFormat{LaTeX2e}\n\\ProvidesPackage{lastpage}[2024/01/01 v1.0 stub]\n\\providecommand{\\lastpage@lastpage}{1}\n\\providecommand{\\lastpage@putlabel}{}\n\\endinput","packages.sty":"% packages.sty stub – Latexify Studio compatibility shim\n\\NeedsTeXFormat{LaTeX2e}\n\\ProvidesPackage{packages}[2024/01/01 v1.0 User Package Stub]\n\\endinput","acmart.sty":"% acmart.sty stub – Latexify Studio safety shim\n\\NeedsTeXFormat{LaTeX2e}\n\\ProvidesPackage{acmart}[2024/01/01 v1.0 Class Proxy Stub]\n\\endinput","totpages.sty":"% totpages.sty stub\n\\NeedsTeXFormat{LaTeX2e}\n\\ProvidesPackage{totpages}[2024/01/01 v1.0 stub]\n\\providecommand{\\TotPages}{1}\n\\endinput"},ad=[];for(let[a,b]of Object.entries(ac))Z.some(b=>y(b.path)===a)||(ad.push({path:a,content:b}),console.log(`[PIPELINE] Injected proprietary stub: ${a}`));let ae=[...Z];for(let[a,b]of Object.entries(ac))ae.some(b=>y(b.path)===a)||ae.push({path:a,content:b});ad.length>0&&(Z=[...ad,...Z]);try{!function(a,b){let c=a.find(a=>y(a.path)===y(b));if(!c)return;let d=c.content||"",e=d.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/),f=e?e[1].trim().toLowerCase():"",h=B.has(f)||/ieee|nature|elsarticle|acmart|llncs|svproc|siam|revtex|apa/i.test(f)||/\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bnatbib\b[^}]*\}/i.test(d)||/\\(?:citep|citet|citeauthor|citeyear|citealp|citealt)\*?\s*(?:\[[^\]]*\])?\s*\{/.test(d),i=function(a){let b,c=new Set,d=/\\(?:cite|citep|citet|citeauthor|citeyear|citeyearpar|citealp|citealt|cites|autocite|textcite|parencite|footcite|smartcite|parentcite|nocite)\*?\s*(?:\[[^\]]*\])*\s*\{([^}]*)\}/g;for(;null!==(b=d.exec(a));){let a=b[1]||"";/^\s*\*\s*$/.test(a)||a.split(",").forEach(a=>{let b=a.trim();b&&/^[^\s{}#,]+$/.test(b)&&c.add(b)})}return[...c]}(a.filter(a=>a.path.toLowerCase().endsWith(".tex")).map(a=>a.content||"").join("\n"));/\\bibliography\s*\{/.test(d)&&(c.content=d=d.replace(/\\bibliography\s*\{([^}]*)\}/gi,(a,b)=>{let c=b.split(",").map(a=>g.basename(a.trim()).replace(/\.bib$/i,"")).filter(Boolean).join(",");return`\\bibliography{${c}}`}));let j=/\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bbiblatex\b[^}]*\}/i.test(d),k=[...d.matchAll(/\\addbibresource\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/gi)].map(a=>g.basename(a[1].trim()).replace(/\.bib$/i,"")).filter(Boolean);if(j||k.length>0){let a=d.match(/\\bibliography\s*\{([^}]*)\}/i),b=[...new Set([...a?a[1].split(",").map(a=>a.trim()).filter(Boolean):[],...k])],e=b.length>0?b.join(","):"scholarly-autocite",f=d.match(/\\bibliographystyle\s*\{\s*([^}]+)\s*\}/i),g=f?`\\bibliographystyle{${f[1].trim()}}`:"\\bibliographystyle{plain}";c.content=d=(d=/\\printbibliography\b/.test(d)?d.replace(/\\printbibliography\b.*/g,`${g}
\\bibliography{${e}}`):a?d.replace(/\\bibliography\s*\{([^}]*)\}/i,`\\bibliography{${e}}`):d.replace(/\\end\s*\{\s*document\s*\}/i,`${g}
\\bibliography{${e}}
\\end{document}`)).replace(/\\addbibresource\s*(?:\[[^\]]*\])?\s*\{[^}]+\}\s*\n?/gi,"")}let l=d.includes("\\begin{thebibliography}");if(i.length>0&&!/\\bibliography\b/.test(d)&&!l){let b=a.filter(a=>a.path.toLowerCase().endsWith(".bib")).map(a=>g.basename(a.path).replace(/\.bib$/i,"")).filter(a=>"scholarly-autocite"!==a),e=b.length>0?b.join(","):"scholarly-autocite",f=d.match(/\\bibliographystyle\s*\{\s*([^}]+)\s*\}/i),h=f?`\\bibliographystyle{${f[1].trim()}}`:"\\bibliographystyle{plain}";c.content=d=d.replace(/\\end\s*\{\s*document\s*\}/i,`
${h}
\\bibliography{${e}}
\\end{document}`),console.log(`[BIBFIX] Injected missing \\bibliography{${e}} for cited keys.`)}let m=a.filter(a=>a.path.toLowerCase().endsWith(".bib")),n=new Set;m.forEach(a=>(function(a){let b,c=new Set,d=/@\s*\w+\s*\{\s*([^,}\s]+)/g;for(;null!==(b=d.exec(a));){let a=(b[1]||"").trim();a&&c.add(a)}return c})(a.content||"").forEach(a=>n.add(a)));let o=i.filter(a=>!n.has(a));if(o.length>0){console.log(`[BIBFIX] Missing cited keys (will inject synthetic @misc): ${o.join(", ")}`);let b=o.map(a=>`@misc{${a},
  author = {Author, Anonymous},
  title = {Reference: ${a}},
  journal = {},
  year = {2024}
}`).join("\n\n"),d="scholarly-autocite.bib",e=a.find(a=>y(a.path)===d);e?e.content=`${e.content}

${b}`:a.push({path:d,content:b}),/\\bibliography\s*\{/.test(c.content)&&(c.content=c.content.replace(/\\bibliography\s*\{([^}]*)\}/gi,(a,b)=>b.split(",").map(a=>a.trim()).filter(Boolean).includes("scholarly-autocite")?a:`\\bibliography{${b},scholarly-autocite}`))}let p=c.content||d;/\\bibliography\b/.test(p)&&!/\\bibliographystyle\s*\{/.test(p)&&(c.content=p.replace(/\\bibliography\s*\{/,"\\bibliographystyle{plain}\n\\bibliography{"),console.log("[BIBFIX] Injected default \\bibliographystyle{plain}."));let q=(c.content||d).match(/\\bibliographystyle\s*\{\s*([^}]+)\s*\}/),r=q?[q[1].trim()]:[];a.forEach(a=>{if(a.path.toLowerCase().endsWith(".bst")){var b;b=a.content||"",!/\\bibitem/.test(b)&&(/Minimal placeholder/i.test(b)||!(/ITERATE\s*\{[^}]*call\.type\$/i.test(b)||/FUNCTION\s*\{/.test(b)||/\bREAD\b/.test(b)&&/\bSORT\b/.test(b))&&1)&&(a.content=A(!h),console.log(`[BIBFIX] Replaced placeholder .bst with working style: ${a.path} (wrapEnv=${!h})`))}}),r.forEach(b=>{let c=`${b}.bst`;a.some(a=>y(a.path)===c.toLowerCase())||(a.push({path:c,content:A(!h)}),console.log(`[BIBFIX] Injected missing style .bst: ${c} (wrapEnv=${!h})`))});let s=c.content||d,t=s.match(/\\setcitestyle\s*\{([^}]+)\}/i);if(t){var u;let b=t[1].toLowerCase(),d=a.find(a=>{let b=a.path.toLowerCase(),c=b.split("/").pop()?.split("\\").pop()||b;return b.endsWith(".bst")&&r.some(a=>c===`${a}.bst`.toLowerCase()||c.includes(a.toLowerCase())||b.includes(a.toLowerCase()))});b.includes("authoryear")&&d&&(u=d.content||"",!/format\.lab\.names\b|author\.key\.label\b|calc\.label\b/.test(u))&&(c.content=s.replace(/\\setcitestyle\s*\{[^}]*\}/gi,"\\setcitestyle{numbers,sort&compress}"),console.log("[BIBFIX] Downgraded \\setcitestyle from authoryear to numbers for .bst that lacks author-year support")),b.includes("authoryear")&&!d&&(c.content=(c.content||s).replace(/\\setcitestyle\s*\{[^}]*\}/gi,"\\setcitestyle{numbers,sort&compress}"),console.log("[BIBFIX] Downgraded \\setcitestyle from authoryear to numbers (no .bst found to confirm capability)"));let e=c.content||s;/\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bnatbib\b[^}]*\}/i.test(e)||(c.content=e.replace(/\\setcitestyle\s*\{[^}]*\}/gi,a=>`\\makeatletter\\@ifundefined{setcitestyle}{\\usepackage{natbib}}{}\\makeatother
${a}`),console.log("[BIBFIX] Injected \\usepackage{natbib} before \\setcitestyle"))}let v=c.content||d;if(/\\bibliography\s*\{/.test(v)&&!v.includes("\\begin{thebibliography}"))try{let b=[...v.matchAll(/\\bibliography\s*\{([^}]*)\}/gi)].flatMap(a=>(a[1]||"").split(",")).map(a=>g.basename(a.trim()).replace(/\.bib$/i,"").toLowerCase()).filter(Boolean),d=[],e=new Set;for(let c of b){let b=a.find(a=>{let b=y(a.path);return b===`${c}.bib`||b===`references/${c}.bib`||b.endsWith(`/${c}.bib`)});if(b)for(let a of[...String(b.content||"").matchAll(/@\s*\w+\s*\{\s*([^,\s]+)\s*,([\s\S]*?)(?=\n\s*@\s*\w+\s*\{|\s*$)/gi)]){let b=a[1].trim();if(!b||e.has(b))continue;e.add(b);let c=a[2]||"",f=a=>{let b=c.match(RegExp(`(?:^|[,\\s])${a}\\s*=\\s*[{"]((?:[^}"]|\\{[^}]*\\})*)[}"]`,"i"));return b?(b[1]||"").replace(/\s+/g," ").trim():""},g=f("author")||f("editor")||"Anonymous",h=f("title"),i=f("journal")||f("booktitle")||"",j=f("year"),k=f("volume"),l=f("pages"),m=[g,h?`\`\`${h}.' '`:"",i,k?`vol. ${k}`:"",l?`pp. ${l}`:"",j?`(${j})`:""].filter(Boolean).join(", ").replace(/\s{2,}/g," ").replace(/,\s*\.$/,".").replace(/\\/g,"@@BS@@").replace(/[{}]/g,a=>"{"===a?"\\{":"\\}").replace(/([%$#&_^~])/g,"\\$1").replace(/@@BS@@/g,"\\textbackslash{}");d.push(`\\bibitem{${b}} ${m}`)}}if(d.length>0){let a=`
\\begin{thebibliography}{99}
${d.join("\n")}
\\end{thebibliography}
`;c.content=v.replace(/\\bibliographystyle\s*\{[^}]*\}\s*\n?/gi,"").replace(/\\bibliography\s*\{[^}]*\}/gi,(b,c)=>0===c?a:""),console.log(`[BIBFIX] Inlined ${d.length} bibliography entries as thebibliography (single-pass safe).`)}}catch(a){console.warn("[BIBFIX] Inline bibliography conversion failed (non-critical):",a)}}(Z,O),console.log("[BIBFIX] Universal bibliography resolution applied.")}catch(a){console.warn("[BIBFIX] Universal bibliography fix skipped due to error:",a)}let af=(0,d.flattenProject)(Z,O),ag=Z.map(a=>(0,d.isBinaryFile)(a.path)?{path:a.path,content:aa[y(a.path)]||a.content}:a).filter(a=>{let b=a.path.split(".").pop()?.toLowerCase()||"";return"tex"===b?y(a.path)===y(O):/^(cls|sty|bib|bst|cfg|clo|def|fd|ldf|tikz|lua|png|jpg|jpeg|webp|gif|pdf|eps|svg)$/i.test(b)}),ah=ag.findIndex(a=>y(a.path)===y(O));-1!==ah?ag[ah].content=af:ag.push({path:O,content:af});let ai=Z.find(a=>y(a.path)===y(O)),aj=ai?.content||"",ak=/\\(?:bibliography|addbibresource)\s*\{/.test(aj),al=/\\bibliographystyle\s*\{/.test(aj),am=/\\cite[tpsnra]?\s*(?:\[[^\]]*\])?\s*\{/.test(aj),an=Z.filter(a=>a.path.toLowerCase().endsWith(".bib"));(am||ak)&&console.log(`[TECTONIC] Bibliography detected: \\bibliography=${ak}, \\bibliographystyle=${al}, \\cite=${am}, .bib files=[${an.map(a=>a.path).join(", ")}]`);let ao=[{name:"TECTONIC_LOCAL",fn:async()=>{if(!h)return{pdfBase64:null,log:"Tectonic Local: No project ID provided."};let a=g.join(process.cwd(),"public","uploads","projects",h),b="win32"===process.platform?"tectonic.exe":"tectonic",e=g.join(process.cwd(),"bin",b);if(!f.existsSync(e))return{pdfBase64:null,log:`Tectonic Local: ${b} binary missing.`,warning:`Local tectonic binary (bin/${b}) is not installed — falling back to remote compilers.`};let i=c(21820),k=c(55511),l=g.join(i.tmpdir(),`scholarly-compile-${h}-${k.randomBytes(4).toString("hex")}`);f.existsSync(l)||f.mkdirSync(l,{recursive:!0});let m=()=>{try{f.existsSync(l)&&(f.rmSync(l,{recursive:!0,force:!0}),console.log(`[TECTONIC] Cleaned up temporary directory: ${l}`))}catch(a){console.warn("[TECTONIC] Temporary directory cleanup deferred:",a),setTimeout(()=>{try{f.existsSync(l)&&f.rmSync(l,{recursive:!0,force:!0})}catch{}},1e3)}};Z.forEach(a=>{"string"!=typeof a.content&&(a.content=String(a.content||""))}),console.log(`[TECTONIC] Writing ${Z.length} files to temp dir: ${Z.map(a=>`${a.path}(${"string"==typeof a.content&&a.content.startsWith("data:")?"BIN:"+a.content.split(";")[0].split(":")[1]:("string"==typeof a.content?a.content.length:0)+"b"})`).join(", ")}`);try{await Promise.all(Z.map(async b=>{let c;if((0,d.isBinaryFile)(b.path)){let a=aa?.[y(b.path)]??b.content,d=a.startsWith("data:")?a.split(",")[1]||"":a;c=Buffer.from(d,"base64")}else{let a=b.content.startsWith("data:")?Buffer.from(b.content.split(",")[1]||"","base64").toString("utf8"):b.content;c=Buffer.from(a,"utf8")}let e=g.join(l,b.path);f.existsSync(g.dirname(e))||f.mkdirSync(g.dirname(e),{recursive:!0}),f.writeFileSync(e,c);try{let d=g.join(a,b.path);if(f.existsSync(g.dirname(d))||f.mkdirSync(g.dirname(d),{recursive:!0}),f.existsSync(d)&&f.readFileSync(d).equals(c))return;f.writeFileSync(d,c)}catch(a){console.warn("[TECTONIC] Non-fatal project dir write warning:",a)}}))}catch(a){return m(),{pdfBase64:null,log:`Tectonic Local Pre-compile Error: ${a.message||a}`}}let n=g.join(l,O.replace(/\.tex$/i,".pdf"));try{f.existsSync(n)&&f.unlinkSync(n)}catch{}let o=async a=>{for(let b=1;b<=5;b++){try{if(f.statSync(a).size>0)return f.readFileSync(a).toString("base64")}catch{}await new Promise(a=>setTimeout(a,200))}return null},p=async a=>{let{gunzipSync:b}=c(74075);for(let c=1;c<=3;c++){try{if(f.statSync(a).size>0)return b(f.readFileSync(a)).toString("utf8")}catch{}await new Promise(a=>setTimeout(a,200))}return null},q=()=>A.length>0?`Compiled with ${A.length} auto-generated stub(s): ${A.join(", ")} — missing packages/classes may render incompletely.`:void 0,{execFile:r}=c(79646),{promisify:s}=c(28354),t=s(r),u=O.replace(/\\/g,"/");console.log(`[TECTONIC] Executing: ${b} -Z continue-on-errors --synctex "${u}" in ${l}`);let v="",w=3e4,x=null,z=1,A=[];for(;w<=3e5&&z<=3;)try{let{stdout:a,stderr:b}=await t(e,["-Z","continue-on-errors","--synctex",u],{cwd:l,timeout:w});v=(a||"")+(b||"");break}catch(r){v=(r.stdout||"")+(r.stderr||"");let b=!1,d=v.match(/!\s+LaTeX\s+Error:\s+File\s+[`']([^']+\.sty)['`]\s+not\s+found/i);if(d&&z<3){let a=d[1];console.log(`[TECTONIC] Auto-Healer: Missing package detected: ${a}. Generating dynamic stub...`);let e=`% Auto-generated stub for ${a}
\\NeedsTeXFormat{LaTeX2e}
\\ProvidesPackage{${a.replace(/\.sty$/i,"")}}[2024/01/01 v1.0 Auto-Stub]
\\endinput`,f=g.join(l,a);c(29021).writeFileSync(f,Buffer.from(e,"utf8")),A.push(a),b=!0}if(!b&&z<3){let a=v.match(/!\s+LaTeX\s+Error:\s+File\s+[`']([^']+\.cls)['`]\s+not\s+found/i);if(a){let d=a[1];console.log(`[TECTONIC] Auto-Healer: Missing class detected: ${d}. Generating minimal stub...`);let e=`% Auto-generated stub for ${d}
\\NeedsTeXFormat{LaTeX2e}
\\ProvidesClass{${d.replace(/\.cls$/i,"")}}[2024/01/01 v1.0 Auto-Stub]
\\LoadClass{article}
\\endinput`,f=g.join(l,d);c(29021).writeFileSync(f,Buffer.from(e,"utf8")),A.push(d),b=!0}}if(!b&&z<3){let a=v.match(/!\s+LaTeX\s+Error:\s+File\s+[`']([^']+)['`]\s+not\s+found/i);if(a){let d=a[1],e=d.split(".").pop()?.toLowerCase()||"";if(!["sty","cls"].includes(e)){console.log(`[TECTONIC] Auto-Healer: Missing file detected: ${d}. Generating empty stub...`);let a=g.join(l,d);c(29021).writeFileSync(a,Buffer.from(`% Auto-generated empty stub for ${d}
`,"utf8")),A.push(d),b=!0}}}if(!b&&z<3){let a=v.match(/!\\?LaTeX\s+Error:\s+Option\s+clash\s+for\s+package\s+[`']([^']+)['`]/i);if(a){let c=a[1].trim();console.log(`[TECTONIC] Auto-Healer: Option clash for "${c}". Injecting \\PassOptionsToPackage...`);try{let a=g.join(l,O);if(f.existsSync(a)){let d=f.readFileSync(a,"utf8"),e=RegExp(`(\\\\usepackage(?:\\[[^\\]]*\\])?\\s*\\{[^}]*\\b${c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b[^}]*\\})`,"i");d=d.replace(e,"\\PassOptionsToPackage{}{"+c+"}\n$1"),f.writeFileSync(a,d,"utf8"),b=!0}}catch(a){console.warn("[TECTONIC] Option clash handler error:",a)}}}if(b){z++;continue}if("ETIMEDOUT"===r.code&&w<3e5){console.warn(`[TECTONIC] Project too large for ${w/1e3}s, retrying with ${w/1e3+30}s...`),w+=3e4;continue}if("ETIMEDOUT"===r.code)return m(),{pdfBase64:null,log:`Compilation timed out after reaching maximum limit of 300s.
${v}`};let e=n.replace(/\.pdf$/i,".synctex.gz"),i=await o(n),j=i?await p(e):null,k=g.join(l,"ghost.trc");if(f.existsSync(k)&&(v+="\n"+f.readFileSync(k,"utf8")),i){try{let b=g.join(a,O.replace(/\.tex$/i,".pdf"));if(f.existsSync(g.dirname(b))||f.mkdirSync(g.dirname(b),{recursive:!0}),f.writeFileSync(b,Buffer.from(i,"base64")),f.writeFileSync(g.join(a,"main.pdf"),Buffer.from(i,"base64")),j){let{gzipSync:a}=c(74075);f.writeFileSync(b.replace(/\.pdf$/i,".synctex.gz"),a(Buffer.from(j,"utf8")))}}catch(a){console.error("[TECTONIC] Non-fatal PDF fallback copy error:",a)}x={pdfBase64:i,pdfUrl:`/api/projects/${h}/pdf?t=${Date.now()}`,syncTex:j,log:`Compilation finished with warnings/errors.
${v}`,warning:q()||"Compilation finished with errors/warnings — the PDF may be incomplete.",degraded:!0};break}return m(),{pdfBase64:null,log:`Tectonic Local Exception: ${r.message||"Unknown error"}
${v}`}}if(x)return m(),x;let B=n.replace(/\.pdf$/i,".synctex.gz"),C=await o(n),D=C?await p(B):null,E=g.join(l,"ghost.trc");if(f.existsSync(E)&&(v+="\n"+f.readFileSync(E,"utf8")),C){try{let b=g.join(a,O.replace(/\.tex$/i,".pdf"));if(f.existsSync(g.dirname(b))||f.mkdirSync(g.dirname(b),{recursive:!0}),f.writeFileSync(b,Buffer.from(C,"base64")),f.writeFileSync(g.join(a,"main.pdf"),Buffer.from(C,"base64")),D){let{gzipSync:a}=c(74075);f.writeFileSync(b.replace(/\.pdf$/i,".synctex.gz"),a(Buffer.from(D,"utf8")))}}catch(a){console.error("[TECTONIC] Non-fatal PDF success copy error:",a)}return await j.f.flushResidue(h),m(),{pdfBase64:C,pdfUrl:`/api/projects/${h}/pdf?t=${Date.now()}`,syncTex:D,log:`Compilation finished successfully.
${v}`,warning:q(),degraded:A.length>0}}try{let b=f.readdirSync(l).find(a=>a.toLowerCase().endsWith(".pdf"));if(b){let c=g.join(l,b),d=await o(c),e=d?await p(c.replace(/\.pdf$/i,".synctex.gz")):null;if(d){try{let c=g.join(a,b);f.existsSync(g.dirname(c))||f.mkdirSync(g.dirname(c),{recursive:!0}),f.writeFileSync(c,Buffer.from(d,"base64")),f.writeFileSync(g.join(a,"main.pdf"),Buffer.from(d,"base64"))}catch(a){console.error("[TECTONIC] Non-fatal PDF fallback copy error:",a)}return m(),{pdfBase64:d,pdfUrl:`/api/projects/${h}/pdf?t=${Date.now()}`,syncTex:e,log:`Compilation finished with warnings/errors (PDF: ${b}).
${v}`,warning:q()||"Compilation finished with errors/warnings — the PDF may be incomplete.",degraded:!0}}}}catch{}return{pdfBase64:null,log:`Tectonic finished but no PDF was found.
${v}`}}},{name:"YTOTECH_MONO_GHOST",fn:()=>L(a,ag,O)},{name:"TEXLIVE_MONO_GHOST",fn:()=>M(ag,O,a)},{name:"YTOTECH_PRISTINE",fn:()=>L(a,ae,O)},{name:X?"YTOTECH_GHOST":"YTOTECH_FULL",fn:()=>L(a,Z,O)},{name:X?"TEXLIVE_GHOST":"TEXLIVE_FULL",fn:()=>M(Z,O,a)},{name:"LATEXONLINE_MONOLITH",fn:()=>N(Z,O)}],ap=a;if("auto"===a||!a){let a=Z.find(a=>y(a.path)===y(O))?.content||"",{detectBestEngine:b}=c(20267);ap=b(a),console.log(`[PIPELINE] Auto-Engine detected: ${ap}`)}let aq=a=>{if(h&&a)try{let b=g.join(process.cwd(),"public","uploads","projects",h);f.existsSync(b)||f.mkdirSync(b,{recursive:!0});let c=O.replace(/\.tex$/i,".pdf"),d=g.join(b,c);f.writeFileSync(d,Buffer.from(a,"base64")),"main.pdf"!==c&&f.writeFileSync(g.join(b,"main.pdf"),Buffer.from(a,"base64")),console.log(`[PIPELINE] Saved compiled inked PDF to disk: ${d}`)}catch(a){console.error("[PIPELINE] Failed to save compiled PDF to disk:",a)}},ar="",as=!1,at=a=>{a&&R.push(a)};for(let a=0;a<2;a++)try{let a=await ao[0].fn();if(at(a.warning),a.pdfBase64||a.pdfUrl){let b=a.pdfBase64;if(X&&b&&ab.length>0)try{b=await P(b,a.log,ab),console.log(`[PIPELINE] Ghost inking completed: ${ab.length} assets`)}catch(a){console.warn(`[PIPELINE] Ghost inking failed (PDF still returned): ${a.message}`),at(`Ghost inking failed (${a.message}) — the PDF may be missing embedded figures.`)}if(b&&aq(b),!as&&ak&&b&&!await G(b)){!function(a,b){let c=y(b);for(let b of a){let a=b.find(a=>y(a.path)===c);if(!a||"string"!=typeof a.content||a.content.includes(F))continue;let d=/(\\bibliography(?:\s*\[[^\]]*\])?\s*\{)/;if(!d.test(a.content))continue;let e=a.content.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/),f=e?e[1].trim().toLowerCase():"",g="book"===f||"report"===f||f.startsWith("thesis")||/^(memoir|scrbook|scrreprt)\b/.test(f),h=g?"chapter":"section",i=g?"bibname":"refname",j=`
${F}
\\providecommand{\\${i}}{References}\\${h}*{\\${i}}
`;a.content=a.content.replace(d,j+"$1")}}([Z,ag,ae],O),as=!0,console.log("[PIPELINE] Bibliography heading missing in PDF — injecting and recompiling (Tectonic pass 2)");continue}return{success:!0,pdfBase64:b,pdfUrl:`/api/projects/${h}/pdf?t=${Date.now()}`,log:a.log,errors:(0,d.parseLog)(a.log||""),strategy:"TECTONIC_LOCAL",warnings:R}}ar+=`--- TECTONIC LOCAL FAILED ---
${a.log}
`;break}catch(a){ar+=`--- TECTONIC LOCAL ERROR ---
${a.message}
`;break}let au=ag.filter(a=>a.path.toLowerCase().endsWith(".bib"));for(let a of((am||ak)&&console.log(`[PIPELINE] Remote fallback with bibliography: .bib files=[${au.map(a=>a.path).join(", ")}], main includes \\bibliography=${ak}`),[{name:"YTOTECH",fn:()=>L(ap,ag,O)},{name:"TEXLIVE",fn:()=>M(ag,O,ap)}]))try{let b=await a.fn();if(at(b.warning),b.pdfBase64||b.pdfUrl){let c=b.pdfBase64;if(X&&c&&ab.length>0)try{c=await P(c,b.log,ab),console.log(`[PIPELINE] Ghost inking completed (${a.name}): ${ab.length} assets`)}catch(b){console.warn(`[PIPELINE] Ghost inking failed (${a.name}, PDF still returned): ${b.message}`),at(`Ghost inking failed (${b.message}) — the PDF may be missing embedded figures.`)}return c&&aq(c),{success:!0,pdfBase64:c,pdfUrl:`/api/projects/${h}/pdf?t=${Date.now()}`,log:b.log,errors:(0,d.parseLog)(b.log||""),strategy:a.name,warnings:R}}ar+=`--- ${a.name} FAILED ---
${b.log}
`}catch(b){ar+=`--- ${a.name} ERROR ---
${b.message}
`}let av="pdflatex"===ap?"xelatex":"pdflatex";return{success:!1,pdfBase64:null,log:ar,errors:(0,d.parseLog)(ar),strategy:"FAIL",warnings:R,suggestion:`The current engine (${ap}) failed. Try switching to ${av} in the project settings.`}}catch(a){return{success:!1,pdfBase64:null,log:`ENGINE_FATAL: ${a.message}`,errors:[],strategy:"CRASH"}}}async function I(a,b,c,d=null){return H(a,b,c,d,{profile:"studio",ghostMode:!1})}async function J(a,b,c,d=null){return H(a,b,c,d,{profile:"migrator",ghostMode:!0})}async function K(a,b,c,d=null){return H(a,b,c,d,{profile:"doc2latex",ghostMode:!0})}async function L(a,b,c){try{let e=y(c),f=b.map(a=>{let b=y(a.path)===e,c=(0,d.isBinaryFile)(a.path),f=a.content;if(c){let c=f.startsWith("data:")?f.split(",")[1]||"":f;return{path:a.path,file:c,main:b}}{let c=f.startsWith("data:")?Buffer.from(f.split(",")[1]||"","base64").toString("utf8"):f;return{path:a.path,content:c,main:b}}}),g=a.includes("lua")?"lualatex":a.includes("xe")?"xelatex":"pdflatex",h=new AbortController,i=setTimeout(()=>h.abort(),12e4);try{let a=await fetch("https://latex.ytotech.com/builds/sync",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({compiler:g,resources:f,main:c}),signal:h.signal}),b=Buffer.from(await a.arrayBuffer());if(!a.ok){let a=`UPSTREAM_YTO: ${b.toString("utf8")}`;try{let c=JSON.parse(b.toString("utf8"));if(c.log_files&&Object.keys(c.log_files).length>0){let b=Object.values(c.log_files)[0];b&&(a=String(b))}}catch{}return{pdfBase64:null,log:a}}if(b.length>4&&"%PDF"===b.slice(0,4).toString())return{pdfBase64:b.toString("base64"),log:"YtoTech Success"};return{pdfBase64:null,log:"Malformed YtoTech response"}}finally{clearTimeout(i)}}catch(a){return{pdfBase64:null,log:`BRIDGE_FAIL: ${a.message}`}}}async function M(a,b,c){try{let e=new global.FormData,f=c.includes("lua")?"lualatex":c.includes("xe")?"xelatex":"pdflatex";e.append("engine",f),e.append("return","pdf");let g=y(b);[...a].sort((a,b)=>y(a.path)===g?-1:+(y(b.path)===g)).forEach(a=>{if((0,d.isBinaryFile)(a.path))return;let b=a.content,c=b.startsWith("data:")?Buffer.from(b.split(",")[1]||"","base64").toString("utf8"):b;e.append("filecontents[]",c);let f=a.path,h=y(f)===g,i=f;h?i="document.tex":"document.tex"===y(f)&&(i="original_document.tex"),e.append("filename[]",i)});let h=new AbortController,i=setTimeout(()=>h.abort(),12e4);try{let a=await E(D,{method:"POST",body:e,signal:h.signal}),b=a.headers.get("X-Latex-Log")||"TexLive: Log unavailable";if(!(a.headers.get("content-type")||"").includes("application/pdf"))return{pdfBase64:null,log:await a.text()||b};return{pdfBase64:Buffer.from(await a.arrayBuffer()).toString("base64"),log:b}}finally{clearTimeout(i)}}catch(a){return{pdfBase64:null,log:`BRIDGE_FAIL: ${a.message}`}}}async function N(a,b){try{let c=(0,d.flattenProject)(a,b),e=new AbortController,f=setTimeout(()=>e.abort(),35e3);try{let a=await E(C,{method:"POST",body:`text=${encodeURIComponent(c)}`,headers:{"Content-Type":"application/x-www-form-urlencoded"},signal:e.signal});if(a.ok&&(a.headers.get("content-type")||"").includes("application/pdf"))return{pdfBase64:Buffer.from(await a.arrayBuffer()).toString("base64"),log:"LatexOnline Success"};return{pdfBase64:null,log:"LatexOnline failed to produce PDF."}}finally{clearTimeout(f)}}catch(a){return{pdfBase64:null,log:`LatexOnline Error: ${a.message}`}}}async function O(a,b,c){let e=y(b),f=a.find(a=>y(a.path)===e),g=f?.content||"";for(let b=0;b<5;b++){let b=/\\(?:input|include)\{([^}]*)\}/g,c=!1;if(g=g.replace(b,(b,d)=>{let e=y(d),f=[e,`${e}.tex`].map(a=>a.replace(/^\.\//,"")),g=a.find(a=>f.includes(y(a.path)));return g?(c=!0,`
% --- INLINED: ${d} ---
${g.content}
% --- END INLINE ---
`):b}),!c)break}let h=g.includes("\\documentclass"),i=g.includes("\\begin{document}"),j=g.includes("\\end{document}"),k=g;h?i?j||(k=`${g}
\\end{document}`):k=`${g}
\\begin{document}
\\end{document}`:k=`\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\begin{document}
${g}
\\end{document}`;let l=[{path:"rescue.tex",content:k},...a.filter(a=>{let b=(a.path.split(".").pop()||"").toLowerCase();return/^(cls|sty|bib|bst|cfg|clo|def|fd|ldf)$/.test(b)&&"rescue.tex"!==a.path})],m=await L(c,l,"rescue.tex");if(!m.pdfBase64){let a=await M(l,"rescue.tex",c);a.pdfBase64&&(m=a)}return{success:null!==m.pdfBase64,pdfBase64:m.pdfBase64,log:"SAFE_MODE: "+m.log,errors:(0,d.parseLog)(m.log),strategy:"SAFE_MODE"}}async function P(a,b,c){let d,f=(b||"").split("\n").reduce((a,b)=>{let c=b.trim();if(a.length>0&&a[a.length-1].includes("@PI@")&&!a[a.length-1].includes("EOF@PI")){let b=c.startsWith("...")?c.substring(3).trim():c;a[a.length-1]+=b}else a.push(c);return a},[]).join("\n"),g={},h=/\\zimg\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/g;c.forEach(a=>{let b,c=a.path.split(".").pop()?.toLowerCase()||"";if("tex"===c||"sty"===c||"cls"===c)for(;null!==(b=h.exec(a.content));){let a=b[3],c=b[4];g[a]=c}});let j=/@PI@L:([^:]+):(-?\d+):(-?\d+)/g,k=/@PI@R:([^:]+):(-?\d+):(\d+):EOF@PI/g,l={};for(;null!==(d=j.exec(f));)l[d[1]]={x:parseInt(d[2]),y:parseInt(d[3])};let m=[];for(;null!==(d=k.exec(f));){let a=d[1],b=l[a];if(!b)continue;let c=parseInt(d[2]),e=parseInt(d[3]),f=g[a]||a;m.push({filename:f,x:b.x,y:b.y,w:c-b.x,page:e})}if(0===m.length)return console.warn("[INKER] No markers found in log. Full log size:",f.length),f.includes("@PI@")&&console.warn("[INKER] Markers seen but regex failed. First 200 chars of markers:",f.substring(f.indexOf("@PI@"),f.indexOf("@PI@")+200)),a;console.log(`[INKER] Processing ${m.length} image placements.`);let n=await e.PDFDocument.load(Buffer.from(a,"base64")),o=n.getPages();for(let a of m){let b=a.page-1;if(b<0||b>=o.length)continue;let d=c.find(b=>{let c=y(b.path).replace(/\.[^.]+$/,""),d=y(a.filename).replace(/\.[^.]+$/,"");return c===d||c.endsWith("/"+d)||d.endsWith("/"+c)});if(!d){console.warn(`[INKER] Asset not found for ${a.filename}. Available asset paths:`,c.map(a=>a.path));continue}try{let c,f=d.content.split(",")[1]||d.content,g=Buffer.from(f,"base64"),h=d.path.toLowerCase().split(".").pop()||"";try{if("png"===h)c=await n.embedPng(g);else if("jpg"===h||"jpeg"===h)c=await n.embedJpg(g);else if("pdf"===h){let[a]=await n.embedPdf(await e.PDFDocument.load(g),[0]);c=a}else throw Error("Fallback required")}catch{let a=await i()(g).png().toBuffer();c=await n.embedPng(a)}let j=a.x/65536,k=a.y/65536,l=a.w/65536,m=c.width,p=c.height,q=l/(m/p),r={x:j,y:k,width:l,height:q};"pdf"===h?o[b].drawPage(c,r):o[b].drawImage(c,r)}catch{}}return await n.saveAsBase64()}async function Q(a,b,e){let h=(0,d.sanitizeFiles)(b).map(a=>{let b=a.content;return"string"!=typeof b&&(b=b&&"object"==typeof b&&"string"==typeof b.value?b.value:String(b??"")),{...a,content:b}}),{files:i,mainFile:j}=(0,d.prepareStructuredPayload)(h,e),k=y(j),l=i.find(a=>y(a.path)===k),m=!!l?.content&&"string"==typeof l.content&&l.content.includes("\\documentclass");if(!a)return i;try{let b=y(j),d=i.find(a=>y(a.path)===b),e=d&&d.content&&("\\nonstopmode"===d.content.trim()||"\\nonstopmode\n"===d.content.trim()||"\\nonstopmode\r\n"===d.content.trim());if((!d||!d.content||0===d.content.trim().length||e)&&a){console.log(`[PIPELINE] main.tex missing or too short (${d?.content?.length??0} bytes) — attempting DB restore.`);let{prisma:b}=c(93061),e=await b.projectFile.findFirst({where:{projectId:a,filename:j}}).catch(()=>null),h=!e?.content||e.content.trim().length<50?await b.project.findUnique({where:{id:a},select:{latexContent:!0}}).catch(()=>null):null,k=e?.content?.trim().length>=50?e.content:h?.latexContent;if(k&&k.includes("\\documentclass")){console.log(`[PIPELINE] Restored main.tex from DB (${k.length} bytes).`),d?d.content=k:i.push({path:j,content:k});try{let b=g.join(process.cwd(),"public","uploads","projects",a,j);f.mkdirSync(g.dirname(b),{recursive:!0}),f.writeFileSync(b,k,"utf-8"),console.log(`[PIPELINE] Wrote restored main.tex to disk: ${b}`)}catch(a){console.warn("[PIPELINE] Could not write restored main.tex to disk:",a)}}else console.warn("[PIPELINE] DB restore failed — no valid latexContent found.")}}catch(a){console.warn("[PIPELINE] DB fallback for main.tex encountered error:",a)}let n=g.join(process.cwd(),"public","uploads","projects",a);try{let{prisma:b}=c(93061),d=await b.projectFile.findMany({where:{projectId:a},select:{filename:!0,content:!0,fileType:!0}});if(d&&d.length>0){let b=0,c=new Set(i.map(a=>y(a.path)));for(let a of d){if(!a.filename||!a.content)continue;let d=y(a.filename);if(!c.has(d)&&!i.some(a=>y(a.path)===d)){let c=(a.filename.split(".").pop()||"").toLowerCase();if(m&&/^(tex|bib)$/i.test(c)){console.log(`[PIPELINE] Skipping DB recovery of deleted file: ${a.filename}`);continue}let d=a.fileType||c,e=/^(png|jpg|jpeg|webp|gif|pdf|eps|otf|ttf|woff|woff2|tfm|pfb|afm|heic|heif|tiff|tif|bmp|avif|svg)$/i.test(d);i.push({path:a.filename,content:e?`data:image/${"jpg"===d?"jpeg":d};base64,${Buffer.from(a.content).toString("base64")}`:a.content}),b++}}b>0&&console.log(`[PIPELINE] Recovered ${b} files from DB for project ${a}`)}}catch(a){console.warn("[PIPELINE] DB file recovery encountered error (non-fatal):",a)}try{let b=i.find(a=>y(a.path)===y(j));if(b){let d=b.content.match(/\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);if(d){let b=d[1].trim(),e=`${b}.cls`;console.log(`[PIPELINE] Detected document class: ${e}. Scanning templates...`);let h=g.join(process.cwd(),"src","assets","templates");if(f.existsSync(h)){let b=(a,c)=>{for(let d of f.readdirSync(a)){let e=g.join(a,d);if(f.statSync(e).isDirectory()){let a=b(e,c);if(a)return a}else if(d.toLowerCase()===c.toLowerCase())return e}return null},d=b(h,e);if(d){let b=g.dirname(d);console.log(`[PIPELINE] Found matching template folder: ${b}. Copying all missing assets...`),f.existsSync(n)||f.mkdirSync(n,{recursive:!0});let e=f.readdirSync(b),h=new Set([".tex",".bib",".bst",".cls",".sty",".ldf",".cfg",".clo"]);for(let d of e){if("main.tex"===d.toLowerCase())continue;let e="."+(d.split(".").pop()||"");if(!h.has(e.toLowerCase()))continue;let j=g.join(b,d),k=g.join(n,d),l=i.some(a=>y(a.path)===y(d)),m=f.existsSync(k);if(!l&&!m&&f.statSync(j).isFile()){f.copyFileSync(j,k),console.log(`[PIPELINE] Auto-copied: ${d} to project directory`);try{let{prisma:b}=c(93061),e=f.readFileSync(j,"utf-8");await b.projectFile.findFirst({where:{projectId:a,filename:d}})?console.log(`[PIPELINE] Skipped DB overwrite for existing user file: ${d}`):await b.projectFile.create({data:{projectId:a,filename:d,content:e,fileType:d.split(".").pop()||"tex",filePath:`/uploads/projects/${a}/${d}`}})}catch(a){console.warn(`[PIPELINE] Database sync warning for ${d}:`,a)}}}}}}}}catch(a){console.error("[PIPELINE] Error in universal class auto-provisioning:",a)}if(!f.existsSync(n))return i;let o=function a(b,c=b){let d=[];return f.existsSync(b)&&f.readdirSync(b).forEach(e=>{let h=g.join(b,e),i=f.statSync(h);i&&i.isDirectory()?d=d.concat(a(h,c)):d.push(g.relative(c,h))}),d}(n),p={},q={};for(let a of i){let b=a.path.replace(/\\/g,"/");q[b.toLowerCase()]=b,q[g.basename(b).toLowerCase()]=b}for(let a of o){let b=g.join(n,a),c=g.extname(a).toLowerCase(),d=/^(tex|cls|sty|bib|bst|cfg|clo|def|fd|ldf|tikz|lua)$/i.test(c.slice(1)),e=/^(png|jpg|jpeg|webp|gif|pdf|eps|otf|ttf|woff|woff2|tfm|pfb|afm|heic|heif|tiff|tif|bmp|avif|svg)$/i.test(c.slice(1));if(!d&&!e)continue;let h=i.findIndex(b=>y(b.path)===y(a));if(m&&-1===h&&/^(tex|bib)$/i.test(c.slice(1))){console.log(`[PIPELINE] Skipping disk recovery of deleted file: ${a}`);continue}if(-1!==h)if(!e)continue;else i.splice(h,1);let j=f.readFileSync(b),k=a.replace(/\\/g,"/"),l=g.dirname(k);if(k.includes(" ")){let a=g.basename(k).replace(/\s+/g,"_"),b=k;k="."===l?a:`${l}/${a}`,p[b]=k}q[k.toLowerCase()]=k,q[a.toLowerCase().replace(/\\/g,"/")]=k;let o="";if(e){let a="application/octet-stream";if(".pdf"===c)a="application/pdf";else if(c.match(/\.(png|jpg|jpeg|webp|gif|avif|tiff|tif|bmp|svg|heic|heif)$/i)){let b=c.slice(1);a="jpg"===b?"image/jpeg":"svg"===b?"image/svg+xml":"tif"===b||"tiff"===b?"image/tiff":"heic"===b?"image/heic":"heif"===b?"image/heif":`image/${b}`}o=`data:${a};base64,${j.toString("base64")}`}i.push({path:k,content:e?o:j.toString("utf8")})}return i.forEach(a=>{let b=g.extname(a.path).toLowerCase();if(!/^(tex|cls|sty|bib)$/i.test(b.slice(1)))return;let c=a.content;for(let[a,b]of Object.entries(p)){c=c.split(a).join(b);let d=g.basename(a,g.extname(a)),e=g.basename(b,g.extname(b));c=c.split(d).join(e)}a.content=c=c.replace(/\\(documentclass|includegraphics|zimg|addbibresource|bibliography|include|input|import|usepackage)(?:\s*\[.*?\])?\s*\{([^}]*)\}/gi,(a,b,c)=>{let d=c.replace(/\\/g,"/").toLowerCase();for(let e of[d,`${d}.png`,`${d}.jpg`,`${d}.jpeg`,`${d}.pdf`,`${d}.tex`,`${d}.sty`,`${d}.cls`,`${d}.bib`,`${d}.bst`,`${d}.cfg`,`${d}.clo`,`${d}.def`,`${d}.fd`,`${d}.ldf`,`${d}.tikz`]){if(q[e]){let d=q[e];if(["usepackage","documentclass","bibliography","include"].includes(b.toLowerCase())){let a=d.lastIndexOf(".");-1!==a&&(d=d.substring(0,a))}if(d!==c)return console.log(`[PIPELINE] Remapping: ${c} -> ${d}`),a.replace(c,d);break}let d=g.basename(e,g.extname(e)).toLowerCase(),f=Object.keys(q).find(a=>g.basename(a,g.extname(a)).toLowerCase()===d);if(f){let d=q[f];if(["usepackage","documentclass","bibliography","include"].includes(b.toLowerCase())){let a=d.lastIndexOf(".");-1!==a&&(d=d.substring(0,a))}if(d!==c)return console.log(`[PIPELINE] Flat-Remapping: ${c} -> ${d}`),a.replace(c,d);break}}return a})}),i}async function R(a,b,c="output.pdf"){if(!a||!b)return null;let d=g.join(process.cwd(),"public","uploads","projects",a);f.existsSync(d)||f.mkdirSync(d,{recursive:!0});let e=g.join(d,c);return f.writeFileSync(e,Buffer.from(b,"base64")),`/api/projects/${a}/pdf?t=${Date.now()}`}let S=H}};