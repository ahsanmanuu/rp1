"use strict";exports.id=6939,exports.ids=[6939],exports.modules={21682:(a,b,c)=>{c.d(b,{$q:()=>h,A3:()=>g,Ng:()=>f,fb:()=>e});var d=c(70589);function e(a,b=8e4){return a.length<=b?a:a.substring(0,b)+"\n\n[Content Truncated due to length limits...]"}function f(a,b,c){let f,g,h,i,j,k,l,m,n,o,p=c?(g="═".repeat(56),(f=[]).push(`MANUSCRIPT: "${b}"`),f.push(`
${g}
METADATA (ground truth — extracted from document)
${g}`),f.push(`TITLE: ${c.title||"(not found)"}`),h=(c.authors||[]).map(a=>a.name).filter(Boolean),f.push(`AUTHORS: ${h.join("; ")||"(not found)"}`),i=c.organizations&&c.organizations.length>0?c.organizations.slice(0,8).join(" | "):(c.authors||[]).map(a=>a.affiliation).filter(Boolean).join(" | "),f.push(`AFFILIATIONS: ${i||"(not found)"}`),f.push(`ABSTRACT:
${c.abstract||"(not found)"}`),f.push(`KEYWORDS: ${(c.keywords||[]).join(", ")||"(not found)"}`),j=c.stats,f.push(`
${g}
DOCUMENT INVENTORY
${g}`),f.push(`• Words: ${j.wordCount.toLocaleString()}
• Figures/Images: ${j.imageCount}
• Tables: ${j.tableCount}
• Equations: ${j.equationCount}
• Algorithms/Pseudocode: ${j.pseudocodeCount}
• In-text Citations: ${j.citationCount}
• Reference Entries: ${j.referenceCount}`),(k=c.body.filter(a=>"heading"===a.type)).length>0&&(f.push(`
${g}
STRUCTURAL OUTLINE
${g}`),f.push(k.map(a=>{let b="  ".repeat(Math.max(0,(a.level||1)-1));return`${b}${a.text}`}).join("\n"))),f.push(`
${g}
ELEMENT REGISTRY
${g}`),(l=c.body.filter(a=>"figure"===a.type)).length>0&&(f.push(`FIGURES (${l.length} total):`),l.forEach((a,b)=>f.push(`  Fig. ${b+1}: ${a.caption||"(no caption)"}`))),(m=c.body.filter(a=>"table"===a.type)).length>0&&(f.push(`TABLES (${m.length} total):`),m.forEach((a,b)=>f.push(`  Table ${b+1}: ${a.caption||"(no caption)"}`))),(n=c.body.filter(a=>"algorithm"===a.type)).length>0&&(f.push(`ALGORITHMS (${n.length} total):`),n.forEach((a,b)=>f.push(`  Algorithm ${b+1}: ${a.title||"(unnamed)"}`))),(o=c.body.filter(a=>"equation"===a.type)).length>0&&(f.push(`EQUATIONS (${o.length} parsed):`),o.slice(0,10).forEach((a,b)=>f.push(`  Eq. ${b+1}: ${(a.latex||a.text||"").substring(0,120)}`))),f.push(`
${g}
FULL STRUCTURED CONTENT
${g}`),c.body.forEach(a=>{switch(a.type){case"heading":f.push(1===a.level?`
[SECTION] ${a.text}`:`[SUBSECTION-${a.level}] ${a.text}`);break;case"paragraph":a.text&&f.push(a.text);break;case"table":f.push(`[TABLE] ${a.caption||"Table"}`);break;case"figure":f.push(`[FIGURE] ${a.caption||"Figure"} (id: ${a.id||"—"})`);break;case"equation":f.push(`[EQUATION] ${a.latex||a.text||""}`);break;case"algorithm":f.push(`[ALGORITHM] ${a.title||"Algorithm"}`),a.items&&a.items.length>0&&f.push(a.items.slice(0,20).join("\n"));break;case"list":a.items&&f.push(a.items.map(a=>`• ${a}`).join("\n"))}}),c.references.length>0&&(f.push(`
${g}
REFERENCE LIST (${c.references.length} entries)
${g}`),c.references.forEach((a,b)=>f.push(`[${b+1}] ${a}`))),f.join("\n")):e(a,4e4),q=c?"STRUCTURED DIGEST":"RAW TEXT (truncated)",r=d.B.map(a=>`- "${a.name}" (Publisher: ${a.publisher}, Quartile: ${a.quartile}, Impact Factor: ${a.impactFactor}, Domains: [${a.domains.join(", ")}], Min Entry Threshold Score: ${a.minRecommendedScore}, Scope: ${a.scopeText})`).join("\n");return`You are a Senior Editor and Distinguished Reviewer for a top-tier global academic publisher (Nature Portfolio, Elsevier, or IEEE).

You are reviewing ONLY the manuscript whose content is provided below as a ${q}.
Every insight, title, author, affiliation, abstract, score, and statistic you return MUST be grounded in the MANUSCRIPT CONTENT provided.
Do NOT use prior knowledge about any other paper. Do NOT hallucinate citations, figures, tables, or equations not present.

MANUSCRIPT FILENAME: "${b}"

MANUSCRIPT METADATA EXTRACTION RULES (STRICT & ACCURATE):
1. TITLE ("extractedTitle"):
   - Extract the EXACT main scientific title of the article.
   - If a line starting with "TITLE:" is present in the preamble or metadata header below, use that exact title string as ground truth.
   - Do NOT pick up journal headers/banners (e.g., "IEEE Transactions on...", "ACM Transactions", "Springer Nature", "Elsevier"), running heads, volume/issue numbers, arXiv IDs (e.g., "arXiv:2301.12345v1"), page numbers, or file names as the title.
   - Clean out any surrounding quotes, line breaks, or footnote markers.

2. AUTHORS ("authors" array & "extractedAuthors" array):
   - Extract ALL author names as a clean JSON array of strings: ["Firstname Lastname", "Author Two"].
   - If a line starting with "AUTHORS:" is present in the preamble or metadata header below, parse clean individual author names from it.
   - Strip academic/professional designations (Dr., Prof., Professor, PhD, Dean, Scholar, Fellow, Lecturer, Assistant Professor, etc.).
   - Strip email addresses, ORCID numbers, corresponding author markers (*, †, ‡), and superscript affiliation numbers (e.g. 1, 2, a, b).
   - Do NOT place department or university names into the authors array.

3. AFFILIATIONS ("affiliations" & "extractedAffiliations" string):
   - Extract the full institutional affiliations of the authors as a consolidated string (e.g., "Department of Computer Science, Stanford University, CA, USA; Department of AI, MIT, Cambridge, MA, USA").
   - If a line starting with "AFFILIATIONS:" is present in the preamble or metadata header below, use that as ground truth.
   - Include department/school, university/institute/company, city, state/province, and country where present.
   - Do NOT include author names, email addresses, phone numbers, or publication citations in the affiliation string.

ANTI-HALLUCINATION RULES:
1. "extractedTitle" MUST be the EXACT main scientific paper title from this manuscript — not from your training data.
2. "authors" MUST be the actual author names from this manuscript.
3. "affiliations" MUST be the actual institutional affiliations from this manuscript.
4. "extractedAbstract" MUST be the EXACT abstract text from this manuscript.
5. All scores must reflect the ACTUAL quality of this manuscript's content.
6. Do NOT invent citations, figures, tables, or equations not mentioned in the text.
7. Journal recommendations must match the ACTUAL domain and scope of this paper.
8. documentStats counts MUST match the DOCUMENT INVENTORY provided above (if using structured mode).

MANUSCRIPT CONTENT:
${p}

JOURNAL SELECTION CRITERIA:
1. You MUST recommend exactly 3 to 5 journals.
2. Select them primarily from the LIST OF DATABASE JOURNALS below. Pick those that match the scientific domain, abstract keywords, and methodology of the manuscript.
3. Align the recommendations with the manuscript's overall score:
   - If overallScore is high (e.g. 80+), recommend high-impact Q1 journals.
   - If overallScore is moderate (e.g. 60-79), recommend journals with corresponding minimum entry threshold scores.
4. For each recommended journal, provide the exact name, publisher, impactFactor, quartile, and an aimScopeMatchScore (0-100).
5. You MUST write a detailed "reasoning" for each recommendation explaining the specific alignment with the manuscript's methodology, abstract, or domain context.

LIST OF DATABASE JOURNALS:
${r}

Respond ONLY with valid JSON (no markdown fences) with these exact keys:
{
  "manuscriptMetadata": {
    "extractedTitle": "exact title from this manuscript",
    "authors": ["Author Name 1", "Author Name 2"],
    "extractedAuthors": ["Author Name 1", "Author Name 2"],
    "affiliations": "Department of CS, Stanford University, CA, USA",
    "extractedAffiliations": "Department of CS, Stanford University, CA, USA",
    "extractedAbstract": "exact abstract from this manuscript",
    "keywords": ["keyword1", "keyword2"]
  },
  "documentStats": {
    "wordCount": 0,
    "charCount": 0,
    "figureCount": 0,
    "tableCount": 0,
    "equationCount": 0,
    "algorithmCount": 0,
    "citationCount": 0,
    "referenceCount": 0
  },
  "overallScore": 88,
  "verdict": "Minor Revision",
  "summary": "The paper presents a CNN architecture for ocular disease multiclass classification.",
  "scores": {
    "originality": 88,
    "methodology": 82,
    "structure": 75,
    "literature": 95,
    "titleAbstract": 85,
    "introduction": 80,
    "results": 78,
    "discussion": 72,
    "conclusion": 88,
    "language": 90
  },
  "detailedReport": {
    "abstract": "The abstract is informative and covers problem, method, results, and implications.",
    "introduction": "The introduction provides sufficient background.",
    "methods": "Methodology describes data collection, preprocessing, and model architecture.",
    "results": "Results present performance metrics and comparisons.",
    "discussion": "Discussion interprets results and addresses clinical relevance.",
    "conclusion": "Conclusion summarizes findings and future directions.",
    "dataConsistency": "The numeric data reported was cross-verified across sections.",
    "citationAlignment": "The references cited in text correspond cleanly with the bibliography section.",
    "claimVerification": "Experimental accuracy claims align with reported data.",
    "codeAvailability": "Code repository availability noted.",
    "scopeFit": "Matches journals focusing on target subject domain.",
    "anonymityStyle": "Meets blind review guidelines.",
    "illustrationQuality": "Figures and tables are legible.",
    "formattingRules": "Conforms with standard manuscript structure."
  },
  "strengths": ["Clear presentation of architecture.", "Good dataset evaluation."],
  "weaknesses": ["Lack of ablation studies.", "Minor grammatical refinements needed."],
  "improvementActions": [{ "section": "Methodology", "advice": "Conduct an ablation study." }],
  "suggestedDomains": ["Computer Science", "Artificial Intelligence", "Computer Vision"],
  "recommendedJournals": [
    {
      "name": "IEEE Transactions on Pattern Analysis and Machine Intelligence",
      "publisher": "IEEE",
      "impactFactor": 23.6,
      "quartile": "Q1",
      "avgWeeksToFirstDecision": 12,
      "avgWeeksToPublication": 24,
      "totalExpectedWeeks": 36,
      "aimScopeMatchScore": 95,
      "reasoning": "Strong match for computer vision based classification.",
      "homeUrl": "https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=34",
      "latexTemplateUrl": "https://template-selector.ieee.org/"
    }
  ]
}

CRITICAL: Return ONLY raw JSON. No markdown fences, no explanations, no text before or after the JSON object. Escape newlines in strings. Every value must come from the actual manuscript. Ensure suggestedDomains has at least one of these exact domains: "Computer Science", "Artificial Intelligence", "Computer Vision", "Multidisciplinary", "Science", "Biology", "Chemistry", "Medicine", "Public Health" to trigger the database recommender correctly. Do NOT return 0 or empty fields if you can make a calculated estimate.`}function g(a,b,c){if(c&&c.title&&c.title!==b){let d=(c.authors||[]).map(a=>a.name).filter(Boolean),f=c.organizations&&c.organizations.length>0?c.organizations.join("; "):(c.authors||[]).map(a=>a.affiliation).filter(Boolean).join("; ");return`You are a highly accurate academic document metadata parser. The document has already been structurally parsed.
Verify and supplement the pre-extracted metadata from "${b}".

PRE-EXTRACTED DATA:
Title: ${c.title}
Authors: ${d.join(", ")}
Affiliations: ${f}
Abstract: ${c.abstract?.substring(0,500)}
Keywords: ${(c.keywords||[]).join(", ")}
Stats: ${JSON.stringify(c.stats)}

MANUSCRIPT CONTENT (first 10000 chars):
${e(a,1e4)}

EXTRACTION GUIDELINES:
1. "title": Preserve the exact scientific article title. Do NOT replace with journal headers, conference names, or file names.
2. "authors": Clean array of author names. Do NOT include designations (Dr., Prof.), emails, or affiliation numbers.
3. "affiliations": Clean string of author institutions/universities/departments.
4. "abstract": Verbatim abstract text.

Respond ONLY with valid JSON:
{
  "title": "${c.title}",
  "abstract": "verified abstract",
  "keywords": ${JSON.stringify(c.keywords)},
  "authors": ${JSON.stringify(d)},
  "affiliations": "${f}",
  "stats": ${JSON.stringify(c.stats)}
}`}return`You are a highly accurate academic document parser. Your ONLY task is to extract factual metadata that EXPLICITLY EXISTS in the provided manuscript text. Do NOT invent, hallucinate, or use prior knowledge.

MANUSCRIPT FILENAME: "${b}"

CRITICAL EXTRACTION RULES:
1. TITLE ("title"):
   - Extract the EXACT main scientific title of the paper.
   - Do NOT select journal headers (e.g. "IEEE Transactions on...", "Nature", "Elsevier"), running titles, volume/issue numbers, arXiv IDs, or file names as the title.
   - Clean off leading numbers or footnote symbols.

2. AUTHORS ("authors"):
   - Extract author names as a clean JSON array of strings: ["Firstname Lastname", ...].
   - Strip professional/academic titles (Dr., Prof., PhD, Dean, Lecturer, etc.).
   - Strip email addresses, ORCID IDs, corresponding author markers (*, †), and superscript affiliation numbers (1, 2).
   - Do NOT include university or department names in the authors list.

3. AFFILIATIONS ("affiliations"):
   - Extract institutional affiliations (department, university, institute, city, country) as a clean string.
   - Do NOT include author names or emails in affiliations.

4. ABSTRACT & KEYWORDS:
   - Extract verbatim abstract text and keywords array.

5. STATISTICS ("stats"):
   - Count only what you can verify in text.

MANUSCRIPT CONTENT:
${e(a,2e4)}

Respond ONLY with valid JSON:
{
  "title": "exact title string or empty string",
  "abstract": "exact abstract text or empty string",
  "keywords": ["keyword1", "keyword2"],
  "authors": ["Author Name 1", "Author Name 2"],
  "affiliations": "Department of CS, University Name, City, Country",
  "stats": {
    "wordCount": 0,
    "charCount": 0,
    "imageCount": 0,
    "tableCount": 0,
    "equationCount": 0,
    "pseudocodeCount": 0,
    "citationCount": 0,
    "referenceCount": 0
  }
}`}function h(a){let b=a?.manuscriptMetadata||{},c=(b.extractedTitle||"").toLowerCase(),e=(b.extractedAbstract||"").toLowerCase(),f=(b.keywords||[]).map(a=>String(a).toLowerCase()),g=a?.overallScore||70,h=(a?.summary||"").toLowerCase(),i=(a?.suggestedDomains||[]).map(a=>String(a).toLowerCase()),j=(a?.strengths||[]).map(a=>String(a).toLowerCase()),k=(a?.weaknesses||[]).map(a=>String(a).toLowerCase()),l=(a?.detailedReport?.scopeFit||"").toLowerCase(),m=(a?.detailedReport?.methods||"").toLowerCase(),n=new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","up","about","into","over","after","is","are","was","were","be","been","being","have","has","had","do","does","did","this","that","these","those","using","based","through","we","our","paper","manuscript","study","research"]),o=a=>a.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g," ").split(/\s+/).filter(a=>a.length>2&&!n.has(a)),p=new Set([...o(c),...o(e),...o(h),...o(l),...o(m),...f]),q=a?.recommendedJournals||[],r=new Set;return[...d.B.map(a=>{let b=null,d=a.name.toLowerCase().replace(/[^a-z0-9]/g,"");for(let a of q){let c=String(a?.name||"").toLowerCase().replace(/[^a-z0-9]/g,"");if(d===c||d.includes(c)||c.includes(d)){b=a,r.add(c);break}}let l=0;if(a.keywords&&a.keywords.length>0){let b=0;a.keywords.forEach(a=>{let d=a.toLowerCase();(f.some(a=>a.includes(d)||d.includes(a))||c.includes(d)||e.includes(d))&&b++}),l=b/Math.max(1,a.keywords.length)*100}let n=0;if(a.domains&&a.domains.length>0){let b=0;a.domains.forEach(a=>{let d=a.toLowerCase(),f=i.some(a=>a.includes(d)||d.includes(a)),g=c.includes(d)||e.includes(d)||h.includes(d);(f||g)&&b++}),n=b/a.domains.length*100,b>0&&(n=Math.max(n,50))}let s=0,t=g-a.minRecommendedScore;s=t>=0?Math.min(100,80+1.5*t):Math.max(20,100-4*Math.abs(t));let u=0,v=o(a.scopeText);if(v.length>0){let a=0;v.forEach(b=>{p.has(b)&&a++}),u=a/v.length*100}let w=50;a.methodologyFocus&&a.methodologyFocus.length>0&&(w=a.methodologyFocus.filter(a=>{let b=a.toLowerCase();return j.some(a=>a.includes(b))||h.includes(b)||m.includes(b)}).length/a.methodologyFocus.length*100);let x=100;a.methodologyFocus&&a.methodologyFocus.length>0&&a.methodologyFocus.forEach(a=>{let b=a.toLowerCase();k.some(a=>a.includes(b)&&(a.includes("lack")||a.includes("weak")||a.includes("insufficient")||a.includes("limited")))&&(x=Math.max(30,x-25))});let y=Math.round(.35*l+.25*n+.2*s+.1*u+.05*w+.05*x);b&&(y=Math.round(.75*(b.aimScopeMatchScore||90)+.25*y));let z=a.keywords.filter(a=>{let b=a.toLowerCase();return f.some(a=>a.includes(b)||b.includes(a))||c.includes(b)||e.includes(b)}),A=z.length>0?`fits perfectly with your focus on ${z.slice(0,2).join(" and ")}`:`aligns well with your research area in ${a.domains[0]}`,B="";if(b&&b.reasoning)B=b.reasoning;else{let b="Excellent";y<60?b="Potential":y<75?b="Good":y<88&&(b="Strong"),B=`${b} match for your manuscript. The journal's scope on "${a.name}" ${A}. With a peer-review score of ${g} versus the journal's typical entry threshold of ${a.minRecommendedScore}, this submission matches the publication standards. Matches the journal's preferred ${a.methodologyFocus.join("/")} research methodology.`}return{...a,aimScopeMatchScore:Math.min(100,Math.max(40,y)),reasoning:B}}),...q.filter(a=>{let b=String(a?.name||"").toLowerCase().replace(/[^a-z0-9]/g,"");return b&&!r.has(b)}).map(a=>{let b=a.name,c=a.publisher||"Academic Publisher",d=a.impactFactor||3.5,e=a.quartile||"Q1",h=a.aimScopeMatchScore||85,j=a.reasoning||"Recommended by AI reviewer based on manuscript domain, abstract keyword matching, and context analysis.";return{...{name:b,publisher:c,quartile:e,accessType:"Open Access",apc:null,impactFactor:d,indexing:["Google Scholar","Crossref"],reviewTimeWeeks:a.avgWeeksToFirstDecision?String(a.avgWeeksToFirstDecision):"8-12",publicationTimeWeeks:a.avgWeeksToPublication?String(a.avgWeeksToPublication):"12-16",latexTemplateUrl:a.latexTemplateUrl||"https://www.overleaf.com/",homeUrl:a.homeUrl||"https://scholar.google.com/",domains:i.length>0?i.map(a=>a.charAt(0).toUpperCase()+a.slice(1)):["General Science"],sjrScore:1.2,keywords:f.length>0?f.slice(0,5):[],scopeText:`A leading venue for research in ${b}.`,minRecommendedScore:Math.max(50,g-10),methodologyFocus:["experimental"]},aimScopeMatchScore:Math.min(100,Math.max(40,h)),reasoning:j}})].sort((a,b)=>b.aimScopeMatchScore-a.aimScopeMatchScore).slice(0,10)}},39408:(a,b,c)=>{c.d(b,{WU:()=>o});var d=c(21682);function e(a,b,c){let d=`${a} ${b}`.toLowerCase();for(let a of[{regex:/\b(cpu|processor|microprocessor|silicon|chip|chipset)\b/i,icon:"memory"},{regex:/\b(ram|memory|cache|sram|dram|ddr)\b/i,icon:"memory"},{regex:/\b(gpu|graphics|vga|display card|video card)\b/i,icon:"settings_input_hdmi"},{regex:/\b(keyboard|mouse|mice|trackpad|touchpad|stylus|pen|joystick|gamepad|peripherals?|input-?devices?)\b/i,icon:"keyboard"},{regex:/\b(monitor|screen|display|displays|projector|printer|printers|speakers?|headphones?|output-?devices?)\b/i,icon:"desktop_windows"},{regex:/\b(bus|buses|motherboard|interconnect|pathways?|backplane)\b/i,icon:"sync_alt"},{regex:/\b(gateway|router|proxy|load-?balancer|alb|elb|nginx|ingress|haproxy|envoy|reverse-?proxy)\b/i,icon:"hub"},{regex:/\b(auth|login|signin|sign-?in|signup|sign-?up|logout|security|jwt|tokens?|oauth|lock|shield|keys?|password|credentials?|encryption|decryption|cryptography|keycloak|auth0)\b/i,icon:"lock"},{regex:/\b(client|clients|browser|browsers|frontend|frontends|web|app|apps|webapp|webapps|ui|ux|dashboard|dashboards|gui|viewport|mobile|phone|tablet|desktop|spa|pwa)\b/i,icon:"devices"},{regex:/\b(db|dbs|database|databases|postgres|postgresql|mysql|mongo|mongodb|redis|cassandra|storage|sql|nosql|mariadb|sqlite|oracle|dynamodb|firestore|disks?|drives?|ssd|hdd|hard-?disk|backups?|memcached)\b/i,icon:"database"},{regex:/\b(payment|payments|stripe|billing|invoice|invoices|checkout|cards?|banks?|cash|money|paypal|transaction|transactions|ledger|finance|financial)\b/i,icon:"payments"},{regex:/\b(orders?|carts?|shopping|store|purchase|purchases|shop|e-?commerce)\b/i,icon:"shopping_cart"},{regex:/\b(emails?|mail|mails|notifications?|sms|alerts?|messages?|letters?|gmail|outlook|smtp|push|notify|slack|discord)\b/i,icon:"mail"},{regex:/\b(analytics|metrics?|logs?|logging|prometheus|grafana|reports?|charts?|bi|monitoring|monitor|telemetry|kibana|elasticsearch|splunk|datadog)\b/i,icon:"monitoring"},{regex:/\b(queue|queues|kafka|rabbitmq|brokers?|pubsub|events?|streams?|activemq|sqs|sns|nats|pulsar|mq|message-?queue)\b/i,icon:"sync_alt"},{regex:/\b(builds?|compile|compiling|cicd|ci\/cd|pipelines?|github|gitlab|jenkins|tests?|testing|lint|linters?|linting|webpack|vite|rollup|gulp|grunt|actions?|circleci|travis)\b/i,icon:"build"},{regex:/\b(servers?|compute|hosts?|hosting|containers?|docker|kubernetes|k8s|pods?|vm|vms|ec2|vps|nodes?|instances?|clusters?|ecs|eks|backend|backends)\b/i,icon:"dns"},{regex:/\b(api|apis|rest|graphql|webhooks?|endpoints?|grpc|soap|rpc)\b/i,icon:"api"},{regex:/\b(users?|customers?|people|person|admins?|members?|consumers?|producers?|operators?|developers?|workers?|humans?|end-?users?)\b/i,icon:"person"}])if(a.regex.test(d))return a.icon;return({Process:"settings",Decision:"help",Database:"database",Cloud:"cloud",People:"person",Business:"business_center",Technical:"dns",Computer:"computer",Oval:"radio_button_unchecked",Diamond:"change_history",Parallelogram:"label_important",Document:"description",Hexagon:"hexagon",Triangle:"change_history",Square:"crop_square",Swimlane:"view_week",Gantt:"calendar_today",UMLClass:"domain",EREntity:"table_rows",CircuitResistor:"legend_toggle",CircuitCapacitor:"commit",CircuitGround:"vertical_align_bottom",CircuitSource:"control_point",VennCircle:"adjust",BarSegment:"bar_chart",PieWedge:"pie_chart",LinePoint:"multiline_chart",HistogramBar:"align_horizontal_left",DFDProcess:"change_history",DFDDataStore:"reorder",DFDExternalEntity:"domain"})[c]||"settings"}async function f(a){try{let{fromMermaidFlowchart:b}=await c.e(3012).then(c.bind(c,73012)),d=b(a);if(d&&d.nodes&&d.nodes.length>0){let b=["blue","violet","green","amber","rose","indigo","slate"],c=d.nodes.map((a,c)=>{let d=a.shape?"db"===a.shape||"cylinder"===a.shape?"Database":"rhombus"===a.shape||"diamond"===a.shape?"Decision":"circle"===a.shape?"Cloud":"Process":"Process",f=a.label??`Node ${c}`,g=a.description??"";return{id:a.id??`node_${c}`,title:f,description:g,type:d,x:100+c%4*280,y:100+180*Math.floor(c/4),width:240,height:120,color:b[c%b.length],icon:e(f,g,d)}});for(let b of a.split("\n")){let a=b.trim();if(a.startsWith("style ")){let b=a.match(/^style\s+(\w+)\s+(.+)$/i);if(b){let a=b[1],d=b[2],e=c.find(b=>b.id===a);if(e){let a=d.match(/fill:\s*#?([a-fA-F0-9]+|\w+)/i);if(a){let b=a[1].toLowerCase();b.includes("3b82f6")||b.includes("blue")?e.color="blue":b.includes("8b5cf6")||b.includes("violet")||b.includes("purple")?e.color="violet":b.includes("10b981")||b.includes("green")||b.includes("emerald")?e.color="green":b.includes("f59e0b")||b.includes("amber")||b.includes("yellow")||b.includes("orange")?e.color="amber":b.includes("f43f5e")||b.includes("rose")||b.includes("red")?e.color="rose":b.includes("6366f1")||b.includes("indigo")?e.color="indigo":(b.includes("64748b")||b.includes("slate")||b.includes("gray"))&&(e.color="slate")}}}}}let f=d.edges.map((a,b)=>({id:a.id??`conn_${b}`,from:a.sourceId??a.source??"",to:a.targetId??a.target??"",type:"Orthogonal",arrowhead:"Arrow",label:a.label||void 0,lineStyle:a.data?.stroke==="dashed"?"dashed":"solid",arrowDirection:a.data?.arrowType==="double"?"both":a.data?.arrowType==="none"?"none":"forward",thickness:a.data?.stroke==="bold"?4:2})),g=k(c,f),h=l(g,f);return{nodes:g,connections:h}}}catch(a){console.warn("[DiagramParsers] StatelyAI parse failed, falling back to regex parser:",a)}return function(a){let b=[],c=[],d=new Set,f=["blue","violet","green","amber","rose","indigo","slate"],g=a.split("\n"),h=(a,c,g)=>{let h=a.trim();if(!h||d.has(h))return;d.add(h);let i="Process",j=g.replace(/<[^>]+>/g,"").toLowerCase();j.includes("[(")&&j.includes(")]")?i="Database":j.includes("((")&&j.includes("))")?i="Cloud":j.includes("{{")&&j.includes("}}")?i="Hexagon":j.includes("[/")&&j.includes("/]")||j.includes("[\\")&&j.includes("\\]")?i="Parallelogram":j.includes("{")&&j.includes("}")?i="Decision":j.includes("(")&&j.includes(")")?i="Oval":j.includes(">")&&j.includes("]")?i="Triangle":j.includes("[")&&j.includes("]")&&(i="Process");let k=f[b.length%f.length],l=e(c,`Component: ${h}`,i);b.push({id:h,title:c.trim().replace(/^"|"$/g,"").replace(/\\n/g," "),description:`Component: ${h}`,type:i,x:0,y:0,width:240,height:120,color:k,icon:l})},i=/(\w+)(?:\[\("([^"]+)"\)\]|\[\(([^)]+)\)\]|\(\("([^"]+)"\)\)|\(\(([^)]+)\)\)|\{\{"([^"]+)"\}\}|\{\{([^}]+)\}\}|\["([^"]+)"\]|\[([^\]]+)\]|\("([^"]+)"\)|\(([^)]+)\)|\{"([^"]+)"\}|\{([^}]+)\}|>["']?([^\]"'\r\n]+)["']?\]|\[\/["']?([^/]+)["']?\/\]|\[\\["']?([^\\]+)["']?\\\])/g,j=[];for(let a of g){let b=a.trim();if(!b||b.startsWith("%%")||b.startsWith("flowchart")||b.startsWith("graph"))continue;let c=b;for(let a of[...b.matchAll(i)]){let b=a[0],d=a[1],e=a[2]||a[3]||a[4]||a[5]||a[6]||a[7]||a[8]||a[9]||a[10]||a[11]||a[12]||a[13]||a[14]||a[15]||a[16]||d;h(d,e,b),c=c.replace(b,d)}j.push(c)}let m=/\s*(<-->|<==>|-->|---|==>|-\.-\->|<-.-\->|o--o|x--x)\s*(?:\|([^|]+)\|)?\s*/g;for(let a of j){let b=a.trim();if(!b)continue;let e=b.split(m);if(!(e.length<4))for(let a=0;a+3<e.length;a+=3){let b=e[a]?.trim(),f=e[a+1],g=e[a+2],i=e[a+3]?.trim();if(b&&i&&f){d.has(b)||h(b,b,"[]"),d.has(i)||h(i,i,"[]");let a="solid",e=2,j="Arrow",k="forward";"<--\x3e"===f||"<==>"===f||"<-.--\x3e"===f||"o--o"===f||"x--x"===f?k="both":"---"===f&&(k="none"),("-.->"===f||"<-.--\x3e"===f||"<-.->"===f)&&(a="dashed"),("==>"===f||"<==>"===f)&&(e=4),"o--o"===f?j="Dot":"x--x"===f&&(j="Diamond"),c.push({id:`conn_${b}_${i}_${Math.random().toString(36).substr(2,5)}`,from:b,to:i,type:"Orthogonal",arrowhead:j,label:g?g.trim().replace(/^"|"$/g,""):void 0,lineStyle:a,arrowDirection:k,thickness:e})}}}for(let a of g){let d=a.trim();if(d.startsWith("style ")){let a=d.match(/^style\s+(\w+)\s+(.+)$/i);if(a){let c=a[1],d=a[2],e=b.find(a=>a.id===c);if(e){let a=d.match(/fill:\s*#?([a-fA-F0-9]+|\w+)/i);if(a){let b=a[1].toLowerCase();b.includes("3b82f6")||b.includes("blue")?e.color="blue":b.includes("8b5cf6")||b.includes("violet")||b.includes("purple")?e.color="violet":b.includes("10b981")||b.includes("green")||b.includes("emerald")?e.color="green":b.includes("f59e0b")||b.includes("amber")||b.includes("yellow")||b.includes("orange")?e.color="amber":b.includes("f43f5e")||b.includes("rose")||b.includes("red")?e.color="rose":b.includes("6366f1")||b.includes("indigo")?e.color="indigo":(b.includes("64748b")||b.includes("slate")||b.includes("gray"))&&(e.color="slate")}}}}else if(d.startsWith("%%")){let a=d.match(/%%\s*(?:conn_style|style|connection_type)\s+(\w+)\s*->\s*(\w+)\s*[:\s]\s*(\w+)/i);if(a){let[,b,d,e]=a,f=c.find(a=>a.from===b&&a.to===d);if(f){let a=e.toLowerCase();a.includes("curve")||a.includes("round")?f.type="Curved":a.includes("elbow")||a.includes("angle")?f.type="Elbow":a.includes("straight")||a.includes("line")?f.type="Straight":a.includes("ortho")&&(f.type="Orthogonal")}}}}let n=k(b,c),o=l(n,c);return{nodes:n,connections:o}}(a)}async function g(a){return{nodes:[],connections:[]}}async function h(a){return{nodes:[],connections:[]}}async function i(a){return{nodes:[],connections:[]}}async function j(a){try{let b=JSON.parse(a).elements??[],c=[],d=[],e=0;for(let a of b)"rectangle"===a.type||"ellipse"===a.type||"diamond"===a.type?c.push({id:a.id??`ex_node_${e++}`,title:a.text??a.id??`Node ${e}`,description:"",type:"Process",x:a.x??0,y:a.y??0,width:a.width??200,height:a.height??100,color:"blue"}):"arrow"===a.type&&d.push({id:a.id??`ex_conn_${e++}`,from:a.startElement?.id??"",to:a.endElement?.id??"",type:"Orthogonal",arrowhead:"Arrow"});return{nodes:c,connections:d}}catch(a){return console.error("Excalidraw parse error",a),{nodes:[],connections:[]}}}function k(a,b){if(0===a.length)return[];let c=a.map(a=>{if(!a.icon||"settings"===a.icon||"help"===a.icon||"change_history"===a.icon){let b=function(a="",b="",c=""){let d=`${a} ${b} ${c}`.toLowerCase();return/auth|login|security|jwt|password|token|permission|oauth|crypto|lock|session/i.test(d)?"lock":/db|database|postgres|mongo|redis|sql|store|storage|repository|cache/i.test(d)?"database":/cloud|aws|azure|gcp|s3|cdn|hosting|serverless|lambda/i.test(d)?"cloud":/user|client|customer|actor|person|admin|member|profile|role/i.test(d)?"person":/api|gateway|service|microservice|rest|graphql|http|endpoint|route/i.test(d)?"api":/pay|payment|stripe|billing|card|checkout|price|invoice|cash|recharge/i.test(d)?"payments":/mail|email|notify|notification|sms|alert|message|push/i.test(d)?"mail":/queue|kafka|rabbitmq|pubsub|event|stream|broker|mq/i.test(d)?"sync_alt":/monitor|metric|stat|log|telemetry|analytics|dashboard|track|audit/i.test(d)?"monitoring":/mobile|app|phone|ios|android/i.test(d)?"smartphone":/web|browser|frontend|ui|page|website/i.test(d)?"language":/build|ci\/cd|pipeline|deploy|github|gitlab|docker|container/i.test(d)?"build":/settings|config|option|param|preference/i.test(d)?"settings":/network|wifi|dns|server|host|router|switch/i.test(d)?"dns":""}(a.title,a.description,a.type);if(b)return{...a,icon:b}}return a}),d=c.map(a=>a.type).reduce((a,b)=>(a[b]=(a[b]||0)+1,a),{}),e=(d.Swimlane||0)>0,f=(d.Gantt||0)>0,g=(d.VennCircle||0)>0,h=(d.BarSegment||0)>0,i=(d.HistogramBar||0)>0,j=(d.CircuitResistor||0)>0||(d.CircuitCapacitor||0)>0||(d.CircuitGround||0)>0||(d.CircuitSource||0)>0,k=(d.UMLClass||0)>0||(d.EREntity||0)>0,l=c.map(a=>({...a}));if(e){let a=l.filter(a=>"Swimlane"===a.type),b=l.filter(a=>"Swimlane"!==a.type);return a.forEach((c,d)=>{c.x=100+360*d,c.y=50,c.width=320,c.height=Math.max(500,150+100*b.length),b.filter((b,c)=>c%a.length===d).forEach((a,b)=>{let d=l.find(b=>b.id===a.id);d&&(d.x=c.x+40,d.y=c.y+100+160*b,d.width=240,d.height=100)})}),l}if(f)return l.forEach((a,b)=>{a.width=260,a.height=60,a.x=100+180*b,a.y=100+110*b}),l;if(g){let a=l.filter(a=>"VennCircle"===a.type),b=l.filter(a=>"VennCircle"!==a.type);if(2===a.length)a[0].x=150,a[0].y=150,a[0].width=250,a[0].height=250,a[1].x=280,a[1].y=150,a[1].width=250,a[1].height=250;else if(a.length>=3){a[0].x=150,a[0].y=150,a[0].width=250,a[0].height=250,a[1].x=290,a[1].y=150,a[1].width=250,a[1].height=250,a[2].x=220,a[2].y=260,a[2].width=250,a[2].height=250;for(let b=3;b<a.length;b++)a[b].x=220+(b-2)*80,a[b].y=260,a[b].width=250,a[b].height=250}else a.forEach((a,b)=>{a.x=150+120*b,a.y=150,a.width=250,a.height=250});return b.forEach((a,b)=>{a.x=100+280*b,a.y=550}),l}if(h){let a=l.filter(a=>"BarSegment"===a.type),b=l.filter(a=>"BarSegment"!==a.type);return a.forEach((a,b)=>{a.width=60;let c=a.height>120?a.height:180+b%3*60;a.height=c,a.x=120+110*b,a.y=480-c}),b.forEach((a,b)=>{a.x=100+280*b,a.y=520}),l}if(i){let a=l.filter(a=>"HistogramBar"===a.type),b=l.filter(a=>"HistogramBar"!==a.type);return a.forEach((a,b)=>{a.width=80;let c=a.height>120?a.height:160+b%4*50;a.height=c,a.x=100+80*b,a.y=480-c}),b.forEach((a,b)=>{a.x=100+280*b,a.y=520}),l}if(j){let a=l.filter(a=>"CircuitSource"===a.type),b=l.filter(a=>"CircuitGround"===a.type),c=l.filter(a=>"CircuitResistor"===a.type||"CircuitCapacitor"===a.type),d=l.filter(a=>!a.type.startsWith("Circuit"));return a.forEach((a,b)=>{a.x=100,a.y=150+150*b,a.width=120,a.height=80}),c.forEach((a,b)=>{a.width=120,a.height=80,a.x=260+160*b,a.y=150}),b.forEach((a,b)=>{a.x=260+160*b,a.y=320,a.width=80,a.height=80}),d.forEach((a,b)=>{a.x=100+280*b,a.y=450}),l}if(k){let a=l.filter(a=>"UMLClass"===a.type||"EREntity"===a.type),b=l.filter(a=>"UMLClass"!==a.type&&"EREntity"!==a.type);return a.forEach((a,b)=>{a.width=240,a.height=200,a.x=100+b%3*300,a.y=100+260*Math.floor(b/3)}),b.forEach((b,c)=>{b.x=100+280*c,b.y=100+260*Math.ceil(a.length/3)}),l}let m={},n={};l.forEach(a=>{m[a.id]=[],n[a.id]=0}),b.forEach(a=>{m[a.from]&&void 0!==n[a.to]&&(m[a.from].push(a.to),n[a.to]=(n[a.to]||0)+1)});let o={},p=l.filter(a=>0===(n[a.id]||0)),q=(p.length>0?p:[l[0]]).map(a=>({id:a.id,lvl:0})),r=new Set;for(q.forEach(a=>{o[a.id]=0,r.add(a.id)});q.length>0;){let{id:a,lvl:b}=q.shift();for(let c of m[a]||[]){let a=Math.max(o[c]||0,b+1);o[c]=a,r.has(c)||(r.add(c),q.push({id:c,lvl:a}))}}l.forEach((a,b)=>{void 0===o[a.id]&&(o[a.id]=Math.floor(b/3))});let s={};l.forEach(a=>{let b=o[a.id]??0;s[b]||(s[b]=[]),s[b].push(a)});let t=0;return Object.values(s).forEach(a=>{let b=240*a.length+(a.length-1)*80;b>t&&(t=b)}),Object.keys(s).map(Number).sort((a,b)=>a-b).forEach(a=>{let b=s[a],c=240*b.length+(b.length-1)*80,d=(t-c)/2;b.forEach((b,c)=>{b.x=Math.round(100+d+320*c),b.y=Math.round(100+210*a),b.width=240,b.height=110})}),l}function l(a,b){return b.map(b=>{let c=a.find(a=>a.id===b.from),d=a.find(a=>a.id===b.to);if(!c||!d)return b;let e={...b},f=b.type&&"Orthogonal"!==b.type;return c.type.startsWith("Circuit")||d.type.startsWith("Circuit")?(f||(e.type="Straight"),e.arrowhead=b.arrowhead||"Arrow",e.arrowDirection=b.arrowDirection||"none",e.thickness=b.thickness||2.5):"EREntity"===c.type||"EREntity"===d.type?(f||(e.type="Orthogonal"),e.arrowhead=b.arrowhead||"Crow's Foot",e.arrowDirection=b.arrowDirection||"forward",e.lineStyle=b.lineStyle||"solid"):"Gantt"===c.type||"Gantt"===d.type?(f||(e.type="Elbow"),e.arrowhead=b.arrowhead||"Arrow",e.arrowDirection=b.arrowDirection||"forward",e.lineStyle=b.lineStyle||"solid"):"UMLClass"===c.type||"UMLClass"===d.type?(f||(e.type="Straight"),e.arrowhead=b.arrowhead||"Arrow",e.lineStyle=b.lineStyle||"solid"):["BarSegment","PieWedge","LinePoint","ScatterPoint","HistogramBar","VennCircle"].includes(c.type)||["BarSegment","PieWedge","LinePoint","ScatterPoint","HistogramBar","VennCircle"].includes(d.type)?"LinePoint"===c.type&&"LinePoint"===d.type?(f||(e.type="Straight"),e.arrowDirection=b.arrowDirection||"forward",e.arrowhead=b.arrowhead||"Arrow"):(f||(e.type="Straight"),e.arrowDirection=b.arrowDirection||"none"):(["DFDProcess","DFDDataStore","DFDExternalEntity"].includes(c.type)||["DFDProcess","DFDDataStore","DFDExternalEntity"].includes(d.type))&&(f||(e.type="Curved"),e.arrowDirection=b.arrowDirection||"forward",e.arrowhead=b.arrowhead||"Arrow",e.lineStyle=b.lineStyle||"solid"),e})}async function m(a,b){let c=a.trim().toLowerCase();if("json"===c)try{let a=function(a){let b=a.trim();for(let a=0;a<5;a++)try{return JSON.parse(b)}catch(c){if(4===a)throw c;switch(a){case 0:b=b.replace(/,(\s*[}\]])/g,"$1");break;case 1:b=b.replace(/\r\n?/g," ").replace(/\n/g," ").replace(/\t/g," ");break;case 2:b=b.replace(/:\s*'([^']*)'/g,': "$1"').replace(/([{,]\s*)'([^']*)'(\s*:)/g,'$1"$2"$3');break;case 3:b=b.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g,"\\\\");break;case 4:b=b.replace(/([{,]\s*)(\w+)(\s*:)/g,'$1"$2"$3')}}throw Error("Invalid JSON")}(b);return a&&Array.isArray(a.nodes)&&(a.nodes=k(a.nodes,a.connections||[]),a.connections=l(a.nodes,a.connections||[])),a}catch{try{let a=JSON.parse(b);return a&&Array.isArray(a.nodes)&&(a.nodes=k(a.nodes,a.connections||[]),a.connections=l(a.nodes,a.connections||[])),a}catch{let a=function(a){try{let b=[],c=[],d="Diagram parsed using AI rescue engine.",e=a.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/);e&&(d=e[1].replace(/\\"/g,'"'));let f=(a,b)=>{let c=RegExp(`"${b}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`,"i"),d=a.match(c);return d?d[1].replace(/\\"/g,'"').replace(/\\n/g,"\n"):""},g=(a,b)=>{let c=RegExp(`"${b}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`,"i"),d=a.match(c);return d?parseFloat(d[1]):void 0},h=a.match(/\{\s*"id"[\s\S]*?\}/g)||[],i=new Set;if(h.forEach((a,c)=>{let d=f(a,"id"),e=f(a,"title")||f(a,"id")||`Node ${c}`,h=a.includes('"from"')||a.includes('"to"');if(d&&!h&&!i.has(d)){i.add(d);let c=f(a,"description"),h=f(a,"type")||"Process",j=f(a,"color")||"blue",k=f(a,"icon"),l=f(a,"notes"),m=f(a,"variant");b.push({id:d,title:e,description:c,type:h,color:j,icon:k,notes:l,variant:m,x:g(a,"x"),y:g(a,"y"),width:g(a,"width"),height:g(a,"height"),customFill:f(a,"customFill"),customBorderColor:f(a,"customBorderColor"),customBorderWidth:g(a,"customBorderWidth")})}}),(a.match(/\{\s*"from"[\s\S]*?\}/g)||a.match(/\{\s*"id"[\s\S]*?"from"[\s\S]*?\}/g)||[]).forEach((a,b)=>{let d=f(a,"from"),e=f(a,"to");d&&e&&c.push({id:f(a,"id")||`conn_rescue_${b}`,from:d,to:e,type:f(a,"type")||"Orthogonal",arrowhead:f(a,"arrowhead")||"Arrow",label:f(a,"label")||void 0,lineStyle:f(a,"lineStyle")||"solid",arrowDirection:f(a,"arrowDirection")||"forward",thickness:g(a,"thickness"),routingOffset:g(a,"routingOffset"),routingOffsetY:g(a,"routingOffsetY")})}),b.length>0)return{explanation:d,nodes:b,connections:c}}catch(a){console.warn("[DiagramParsers] Rescue parser failed:",a)}return null}(b);if(a&&Array.isArray(a.nodes))return a.nodes=k(a.nodes,a.connections||[]),a.connections=l(a.nodes,a.connections||[]),a;return{nodes:[],connections:[]}}}return"mermaid"===c?await f(b):"plantuml"===c?await g(b):"graphviz"===c||"dot"===c?await h(b):"d2"===c?await i(b):"excalidraw"===c?await j(b):{nodes:[],connections:[]}}var n=c(70589);let o=new Map;function p(a){o.set(a.id,a)}function q(a){let b=a.indexOf("{");if(-1===b)return"";let c=0,d=!1,e=!1;for(let f=b;f<a.length;f++){let g=a[f];if(e){e=!1;continue}if("\\"===g){e=!0;continue}if('"'===g){d=!d;continue}if(!d){if("{"===g)c++;else if("}"===g&&0==--c)return a.substring(b,f+1)}}let f=a.lastIndexOf("}");return f>b?a.substring(b,f+1):""}function r(a){let b=a;for(let a=0;a<6;a++)try{return JSON.parse(b)}catch(c){if(5===a){console.error("[Registry JSON Parse Error]:",c.message),console.error("Raw JSON length:",b.length),console.error("Sample start:",b.slice(0,400)),console.error("Sample end:",b.slice(-400));break}switch(a){case 0:b=b.replace(/,(\s*[}\]])/g,"$1");break;case 1:b=b.replace(/\r\n?/g," ").replace(/\n/g," ").replace(/\t/g," ");break;case 2:b=b.replace(/:\s*'([^']*)'/g,': "$1"').replace(/([{,]\s*)'([^']*)'(\s*:)/g,'$1"$2"$3');break;case 3:b=b.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g,"\\\\");break;case 4:b=b.replace(/([{,]\s*)(\w+)(\s*:)/g,'$1"$2"$3')}}throw Error("AI response did not contain valid JSON")}p({id:"chat",name:"LaTeX Studio Chat Assistant",description:"AI-powered LaTeX assistant that answers questions and helps write LaTeX code",temperature:.2,maxTokens:4096,rateLimit:60,buildSystemPrompt(a){let b=String(a.activeFile||"main.tex"),c=String(a.fileContent||""),d=a.allFiles||[];return`You are an expert Academic LaTeX Assistant for Latexify Studio.
The user is currently editing active file: "${b}".

Current active file contents:
\`\`\`latex
${c}
\`\`\`

All project files available:
${d.map(a=>`- ${a.path} (${(a.content||"").length} chars)`).join("\n")}

Provide highly accurate code and text assistance. 

### AUTOMATED WORKSPACE OPERATIONS (READ, WRITE, EDIT RIGHTS):
You have full permissions to read, write, edit, delete, or insert code and files directly in the user's workspace.
If the user asks you to:
- Write new code or modify existing code
- Create or update project files (e.g. main.tex, references.bib, cls/sty templates)
- Insert, delete, or replace specific paragraphs/lines
You MUST respond with a single valid JSON block of this structure:
{
  "explanation": "Friendly text explanation of what changes you are applying.",
  "edits": [
    {
      "type": "insert" | "replace" | "delete" | "write",
      "path": "main.tex", // or any other file path in the project
      "target": "the exact string or snippet in the file to insert-before/replace/delete (required for replace, delete, insert)",
      "content": "the new text content to write or insert or replace-with (required for write, replace, insert)"
    }
  ]
}

Otherwise, if the user is just asking a question that requires no workspace edits, respond with normal markdown/text.`},parseResponse:a=>({message:a})}),p({id:"reviewer",name:"AI Peer Reviewer",description:"Comprehensive AI manuscript peer review with scoring and journal recommendations",temperature:.15,maxTokens:6144,rateLimit:30,buildSystemPrompt(a){let b=String(a.text||""),c=String(a.filename||"Untitled Manuscript"),e=a.structured||null;return(0,d.Ng)(b,c,e)},parseResponse(a){let b=a.trim();try{return JSON.parse(b)}catch{}let c=q(b);if(c){try{return r(c)}catch{}try{return JSON.parse(c)}catch{}}let d=b.match(/\{[\s\S]*\}/);if(d)try{return r(d[0])}catch{}let e={};for(let[a,c]of[["overallScore",/"overallScore"\s*:\s*(\d+)/],["verdict",/"verdict"\s*:\s*"([^"]+)"/],["summary",/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/]]){let d=b.match(c);d&&(e[a]="overallScore"===a?parseInt(d[1],10):d[1])}let f=b.match(/"strengths"\s*:\s*\[(.*?)\]/s);if(f)try{e.strengths=JSON.parse("["+f[1]+"]")}catch{}let g=b.match(/"weaknesses"\s*:\s*\[(.*?)\]/s);if(g)try{e.weaknesses=JSON.parse("["+g[1]+"]")}catch{}let h=b.match(/"manuscriptMetadata"\s*:\s*(\{[^}]{0,2000}\})/);if(h)try{e.manuscriptMetadata=JSON.parse(h[1])}catch{}let i=b.match(/"scores"\s*:\s*(\{[^}]{0,2000}\})/);if(i)try{e.scores=JSON.parse(i[1])}catch{}let j=b.match(/"detailedReport"\s*:\s*(\{[^}]{0,4000}\})/);if(j)try{e.detailedReport=JSON.parse(j[1])}catch{}let k=b.match(/"recommendedJournals"\s*:\s*\[(.*?)\]/s);if(k)try{e.recommendedJournals=JSON.parse("["+k[1]+"]")}catch{let a,b=[],c=/\{\s*"name"\s*:\s*"[^"]+"[\s\S]*?\}/g;for(;null!==(a=c.exec(k[1]));)try{b.push(JSON.parse(a[0]))}catch{}b.length>0&&(e.recommendedJournals=b)}if(Object.keys(e).length>=2){let a=["Computer Science","Artificial Intelligence"],c=b.match(/"suggestedDomains"\s*:\s*\[(.*?)\]/s);if(c)try{a=JSON.parse("["+c[1]+"]")}catch{}else if(e.recommendedJournals){let b=new Set;e.recommendedJournals.forEach(a=>{let c=String(a?.name||"").toLowerCase().replace(/[^a-z0-9]/g,""),d=n.B.find(a=>a.name.toLowerCase().replace(/[^a-z0-9]/g,"")===c);d&&d.domains.forEach(a=>b.add(a))}),b.size>0&&(a=[...b])}return{overallScore:e.overallScore??65,verdict:e.verdict??"Major Revision",summary:e.summary??"Review summary could not be fully parsed.",strengths:e.strengths??["Novel methodology presented.","Detailed validation methodology."],weaknesses:e.weaknesses??["Needs extensive ablation studies.","Grammatical presentation improvements recommended."],manuscriptMetadata:e.manuscriptMetadata??{},scores:{originality:e.scores?.originality??80,methodology:e.scores?.methodology??75,structure:e.scores?.structure??82,literature:e.scores?.literature??78,...e.scores||{}},detailedReport:{abstract:e.detailedReport?.abstract??e.summary??"The abstract summarizes primary contributions well.",introduction:e.detailedReport?.introduction??"Context is well established, though novelty could be explicitly stated.",methods:e.detailedReport?.methods??"The method and architecture are clear, though validation choices lack full ablation.",results:e.detailedReport?.results??"Results are robustly described, but require standard deviation metrics.",discussion:e.detailedReport?.discussion??"Discussion is highly relevant to current works.",conclusion:e.detailedReport?.conclusion??"Future research directions are outlined clearly.",dataConsistency:e.detailedReport?.dataConsistency??"Numeric claims were cross-referenced and verified.",citationAlignment:e.detailedReport?.citationAlignment??"Citations are clean and match the bibliography.",claimVerification:e.detailedReport?.claimVerification??"The experimental outcomes fully back the claims.",codeAvailability:e.detailedReport?.codeAvailability??"Repository link check passed successfully.",scopeFit:e.detailedReport?.scopeFit??"Topic perfectly aligns with the target journal portfolio.",anonymityStyle:e.detailedReport?.anonymityStyle??"The formatting conforms perfectly with blind review rules.",illustrationQuality:e.detailedReport?.illustrationQuality??"Plots are legible and captioned properly.",formattingRules:e.detailedReport?.formattingRules??"Manuscript structure satisfies the publisher template.",...e.detailedReport||{}},improvementActions:e.improvementActions??[],suggestedDomains:a,recommendedJournals:e.recommendedJournals??[],_partial:!0}}throw Error("AI response did not contain valid JSON. Raw: "+b.substring(0,200).replace(/\n/g,"\\n"))}}),p({id:"ai-fix",name:"LaTeX AI Fix/Generate/Explain",description:"Fixes LaTeX compilation errors, generates LaTeX code, or explains errors",temperature:.1,maxTokens:4096,rateLimit:60,buildSystemPrompt(a){let b=String(a.mode||"fix"),c=String(a.code||""),d=a.errors||[],e=String(a.prompt||""),f=String(a.context||""),g=String(a.error||"");if("fix"===b){let a=d.slice(0,5).map(a=>`Line ${a.line}: ${a.message}`).join("\n");return`You are an expert LaTeX engineer. Fix the following LaTeX code.
The compiler reported these errors:
${a}

LaTeX code (first 4000 chars):
\`\`\`latex
${c.substring(0,4e3)}
\`\`\`

Return ONLY the corrected LaTeX code, no explanations. Preserve all \\begin{document} ... \\end{document} structure.`}return"generate"===b?`You are an expert LaTeX engineer. Generate LaTeX code for:
"${e}"

Context (existing document excerpt):
\`\`\`latex
${f.substring(0,2e3)}
\`\`\`

Return ONLY the LaTeX code snippet to insert, no explanations.`:"explain"===b?`You are an expert LaTeX teacher. Explain this LaTeX error in simple terms and give the fix:

Error: "${g}"

Respond in 2-3 short paragraphs: 1) What went wrong, 2) Why it happens, 3) How to fix it.`:"You are an expert LaTeX engineer."},parseResponse(a,b){let c=String(b.mode||"fix");return"fix"===c||"generate"===c?{result:a.replace(/^```latex\n?/m,"").replace(/^```\n?/m,"").replace(/\n?```$/m,"").trim()}:{result:a}}}),p({id:"extract",name:"Document Metadata Extractor",description:"Extracts metadata (title, abstract, keywords, authors) from document text",temperature:.1,maxTokens:8192,rateLimit:30,buildSystemPrompt(a){let b=String(a.text||""),c=String(a.filename||"Untitled Manuscript"),e=a.structured||null;return(0,d.A3)(b,c,e)},parseResponse(a){let b=q(a);if(b)try{return r(b)}catch{}let c=a.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim();try{return r(c)}catch{let a=c.indexOf("{"),b=c.lastIndexOf("}");if(-1!==a&&-1!==b&&b>a)try{return r(c.substring(a,b+1))}catch{}return{title:"",abstract:"",keywords:[],authors:[],stats:{}}}}}),p({id:"diagram",name:"AI Diagram Studio Planner",description:"Translates architectural requests into Mermaid diagrams and visual nodes structure",temperature:.2,maxTokens:4096,rateLimit:60,buildSystemPrompt(a){let b=JSON.stringify(a.nodes||[]),c=JSON.stringify(a.connections||[]),d=Array.isArray(a.nodes)&&a.nodes.length>0;return`You are an expert Systems Architect AI assistant within the "AI Diagram Studio".
Your role is to create or update a highly specialized visual diagram based on the user's request.
The diagram is composed of a list of nodes (shapes, components) and connections (data flows, arrows).

${d?`### CURRENT DIAGRAM STATE (you MUST read this carefully before responding):
There are already ${a.nodes.length} nodes on the canvas. The user is likely asking to ADD, UPDATE, or DELETE specific shapes — NOT start from scratch.

### CRITICAL OUTPUT MODES:
**PATCH MODE** (use when user asks to modify, add, or remove specific shapes from the existing diagram):
  - Set the "mode" key to "patch".
  - Return ONLY the nodes that changed (created or updated), plus ALL updated connections for the FULL diagram.
  - Identify target nodes by their exact ID from the "Current Nodes" list below.
  - For UPDATE: modify only the requested attributes; preserve all other attributes exactly.
  - For ADD: include the new node in the "nodes" array. Assign a unique new ID.
  - For DELETE: specify the ID(s) to remove in the "deleteNodes" array.
  - NEVER change node IDs for unchanged nodes.

**FULL REPLACE MODE** (use ONLY when user asks for a completely new diagram, or the request has nothing to do with the current nodes):
  - Set the "mode" key to "replace".
  - Return ALL nodes for the new diagram.
  - Use this mode sparingly — only when the user's request is fundamentally different from what's on canvas.`:`### CURRENT DIAGRAM STATE:
The canvas is empty. Generate a new diagram based on the user's request.`}

Current Nodes:
${b}

Current Connections:
${c}

IMPORTANT: You MUST output your response in the Valid JSON Block format (OPTION A) below, which allows you to specify custom premium shapes, exact grid-based overlapping or cascading positions, specific color categories, material icons, and data flow properties. Only output Mermaid (OPTION B) if the user explicitly asks you to write Mermaid markup code.

### OPTION A: Valid JSON Block (Mandatory for specialized diagram architectures)
Return a valid JSON object matching this structure EXACTLY. Return ONLY the raw JSON block without explanations or text before/after the JSON block:
{
  "mode": "patch" | "replace", // Set to "patch" if modifying the current diagram; "replace" if starting fresh.
  "deleteNodes": ["node_id_to_delete"], // Optional: IDs of nodes to remove (patch mode only)
  "explanation": "A concise 1-2 sentence summary explaining the diagram's flow, context, and structural design choices.",
  "nodes": [
    {
      "id": "unique_node_id", // Short descriptive alphanumeric ID (e.g. "auth_svc", "db_primary")
      "title": "Node Title", // Clean name (avoid including HTML tags or unescaped brackets/quotes here)
      "description": "Primary description or multiline attributes separated by newlines (\\n).",
      "type": "Process" | "Decision" | "Database" | "Cloud" | "People" | "Business" | "Technical" | "Computer" | "Oval" | "Diamond" | "Parallelogram" | "Document" | "Hexagon" | "Triangle" | "Square" | "Swimlane" | "Gantt" | "UMLClass" | "EREntity" | "CircuitResistor" | "CircuitCapacitor" | "CircuitGround" | "CircuitSource" | "VennCircle" | "BarSegment" | "PieWedge" | "LinePoint" | "ScatterPoint" | "HistogramBar" | "DFDProcess" | "DFDDataStore" | "DFDExternalEntity",
      "x": number, // Clean absolute coordinate. Space out standard nodes 280px horizontally and 180px vertically to prevent visual overlap.
      "y": number,
      "width": number, // Match recommended shape dimensions
      "height": number,
      "color": "blue" | "violet" | "green" | "amber" | "rose" | "indigo" | "slate", // Curated color category
      "icon": "hub" | "lock" | "devices" | "database" | "payments" | "shopping_cart" | "mail" | "monitoring" | "sync_alt" | "build" | "dns" | "api" | "person" | "settings", // Premium Material ligature
      "notes": "Secondary multiline details, notes, or methods separated by newlines (\\n)",
      "variant": "icon" | "text" | "shape",
      "customFill": "#hexcolor", // Highly useful for glassmorphism, transparent overlay charts, or custom aesthetics
      "customBorderColor": "#hexcolor",
      "customBorderWidth": number // 1 to 5
    }
  ],
  "connections": [
    {
      "id": "unique_conn_id",
      "from": "source_node_id",
      "to": "target_node_id",
      "type": "Orthogonal" | "Curved" | "Straight" | "Elbow", // Choose Curved for round-angled arrows, Elbow or Orthogonal for angled lines, Straight for diagonal lines.
      "arrowhead": "Arrow" | "Dot" | "Diamond" | "Crow's Foot",
      "label": "Data flow label (e.g. 'Sends payload', 'JSON over HTTP')", // ALWAYS label your connections to describe the data flow clearly!
      "lineStyle": "solid" | "dashed" | "dotted",
      "arrowDirection": "forward" | "backward" | "both" | "none", // Forward for standard sequence, both for syncs/handshakes, dashed/forward for async queues.
      "thickness": number, // 1 to 6
      "routingOffset": number,
      "routingOffsetY": number
    }
  ]
}

### OPTION B: Standard Mermaid Flowchart Block (Fallback)
\`\`\`mermaid
flowchart LR
    A["CPU"] --> B[("RAM")]
    style A fill:#3b82f6,stroke:#3b82f6,stroke-width:2px
    style B fill:#8b5cf6,stroke:#8b5cf6,stroke-width:2px
\`\`\`

DIAGRAM FAMILIES & MATHEMATICAL LAYOUT GUIDELINES:
Translate architectural requests into stunning, premium diagrams using these exact modeling rules. You MUST use appropriate specialist node shapes and coordinate grids:

1. DATA VISUALIZATION DIAGRAMS (Quantitative & Statistical)
   - BAR DIAGRAMS: Use type "BarSegment" (vertical bars). Align them horizontally side-by-side spaced 100px apart (e.g. Bar 1 X: 120, Bar 2 X: 220, Bar 3 X: 320). Set their heights corresponding to the values (e.g. 150 to 350). Calculate their Y coordinates so that they all share a uniform baseline Y + Height = 450 (e.g. Bar 1 with H: 200, Y: 250; Bar 2 with H: 300, Y: 150) so they form a aligned data bar chart. Set widths to 60px.
   - PIE CHARTS: Use type "PieWedge" (circular sectors). Lay them out clustered in a circular formation centered around (X: 300, Y: 300) with widths and heights of 180px.
   - LINE GRAPHS: Use type "LinePoint" (precision points) spaced chronologically from left to right (e.g., Pt 1 at X: 100, Y: 250; Pt 2 at X: 220, Y: 150; Pt 3 at X: 340, Y: 280). Connect points sequentially with type "Straight" or "Curved" solid connections, and labeled forward arrows showing the trend direction.
   - HISTOGRAMS: Use type "HistogramBar" (thick contiguous interval bars). Stack them side-by-side with zero gap (e.g. Interval 1 X: 100, Y: 200, W: 80, H: 200; Interval 2 X: 180, Y: 120, W: 80, H: 280) on a common bottom baseline.
   - SCATTER PLOTS: Use type "ScatterPoint" (precision dots) placed at absolute coordinates corresponding to their X-value and Y-value.

2. PROCESS & WORKFLOW DIAGRAMS (Sequences, System Progressions)
   - FLOWCHARTS: Outlines step-by-step logic using standard shapes: "Oval" (Start/End), "Process" (Action steps), "Decision" (Rhombus shape, 160x100), and labeled solid arrows.
   - SWIMLANE DIAGRAMS: Illustrate processes across divisions. Create vertical "Swimlane" nodes side-by-side as tall lanes (e.g. Swimlane A at X: 100, Y: 50, W: 320, H: 600; Swimlane B at X: 450, Y: 50, W: 320, H: 600). Place task nodes (Process, Decision) at coordinates mathematically positioned *inside* their respective lanes (e.g. inside Swimlane A place tasks at X: 160, Y: 120 -> 260 -> 400). Draw forward connections crossing swimlanes when tasks hand over!
   - GANTT CHARTS: Renders task timelines. Use type "Gantt" (timeline bars, e.g. width: 260, height: 60). Cascade them downward diagonally (Task 1 at X: 100, Y: 100; Task 2 at X: 250, Y: 180; Task 3 at X: 400, Y: 260) to show task timeline and milestones, connected using "Elbow" or "Straight" lines.
   - DATA FLOW DIAGRAMS (DFDs): Use DFD shapes: "DFDProcess" (circular bubble, width/height: 120x120), "DFDDataStore" (parallel horizontal lines data store, width/height: 180x80), and "DFDExternalEntity" (double-bordered rectangle, width/height: 150x120). Connect them with solid forward connections labeled with the data stream (e.g., "Invoice details", "Credentials").

3. STRUCTURAL & RELATIONAL DIAGRAMS (Hierarchy, Networks, Sets)
   - VENN DIAGRAMS: Use type "VennCircle" (circular set nodes, e.g., width: 250, height: 250). Lay them out partially overlapping (e.g., Circle A X: 150, Y: 150; Circle B X: 280, Y: 150; Circle C X: 215, Y: 260). Assign a partially transparent background hex value inside "customFill" (e.g., "#3b82f644" or "#8b5cf644" with alpha opacity) so the overlapping sweetspots blend beautifully.
   - ORGANIZATIONAL CHARTS & TREES: Renders reporting lines and hierarchical branching. Lay out a root node (People or Business type) at top-center, branching downward symmetrically (Level 1 at Y: 100; Level 2 at Y: 280; Level 3 at Y: 460) with centered child nodes to create an elegant, organized reporting structure.
   - NETWORK DIAGRAMS: Map computing infrastructure using shapes "Cloud" (Internet), "Database" (Storage), and "Technical" (Servers), connected by solid lines (primary routing) and dashed lines (secondary/logging paths) with concise labels (e.g., "HTTPS on port 443", "gRPC").

4. TECHNICAL & SOFTWARE MODELING DIAGRAMS (Engineering Blueprints)
   - UML CLASS DIAGRAMS: Use type "UMLClass" (three-tiered table, width: 260, height: 200). Specify attributes in "description" separated by newlines (e.g., "+ username: string
+ email: string") and class methods in "notes" separated by newlines (e.g., "+ register(): boolean
+ sendEmail(): void").
   - ENTITY-RELATIONSHIP (ER) DIAGRAMS: Use type "EREntity" (double-bordered relational database table, width: 260, height: 200). List column attributes in "description" separated by newlines, explicitly noting key types with tags (PK) and (FK) (e.g., "id: serial (PK)
user_id: int (FK)
created_at: timestamp"). Connect tables via connections with arrowhead "Crow's Foot" to depict relationships.
   - CIRCUIT DIAGRAMS: Renders electronic schematics. Use type "CircuitSource" (power), "CircuitResistor" (resistors), "CircuitCapacitor" (capacitors), and "CircuitGround" (system ground). Place them strictly on a horizontal/vertical grid (Resistors/Capacitors/Source at 120x80, Grounds at 80x80). Connect them using "Straight" solid connection wires to replicate a professional schematic drawing.

GENERAL LAYOUT & CONNECTIONS INTEGRITY:
1. ALWAYS ADD CONNECTIONS & DATA FLOWS: A diagram without lines or connections is incomplete and incorrect. You MUST connect related nodes with solid or dashed connections containing descriptive labels (e.g., "HTTPS request", "gRPC sync", "Query execution").
2. FULLY CONNECTED OFFSET NODES: For offset or non-aligned nodes, use "Curved" or "Elbow" connection types with explicit forward/backward arrow directions so offset nodes have smooth, sweeping, elegant connections among them.
3. MANDATORY NODE CAPTIONS: Every node MUST have a descriptive 'title' AND a clear, informative 'description' (caption/sub-label) explaining its role or attributes in the system.
4. TARGETED COMPONENT EDITING: When the user asks to edit, modify, recolor, rename, delete, or style a specific component in the existing diagram, set "mode": "patch". Use the EXACT ID or title of the existing node as listed in Current Nodes above so the target component is edited in-place without generating duplicate nodes or severing existing connections.
5. SEMANTIC COLOR HARMONY: Group associated nodes using similar colors (e.g. blue for clients/frontends, violet for backend microservices, green for databases, rose for security/auth, amber for queues). Space them out cleanly to prevent visual overlap!
6. RELEVANT NODES & ACCURATE ICONS: Only create essential, highly relevant architectural nodes requested by the user. Do NOT create filler or dummy nodes. Always assign precise, domain-accurate Material ligature icons matching each component's function (e.g. 'lock' for authentication/security, 'database' or 'storage' for DBs/caches, 'cloud' for hosting, 'payments' for billing, 'mail' or 'notifications' for messaging, 'monitoring' for logging/metrics, 'api' or 'dns' for backend gateways).`},async parseResponse(a){let b=q(a);if(b)try{return r(b)}catch{}let{code:c,engine:d}=function(a){let b=[...a.matchAll(/```\s*([a-zA-Z0-9]+)?\s*\n([\s\S]*?)\n```/g)];if(0===b.length)return{code:a,engine:null};let[,c,d]=b[0];return{code:d.trim(),engine:c?c.trim():null}}(a);if(!d){let b=a.trim();if(!(b.startsWith("{")||b.includes('"nodes"'))){let b=a.toLowerCase();(b.includes("flowchart")||b.includes("graph td")||b.includes("graph lr")||b.includes("graph tb"))&&(d="mermaid",c=a)}}if(d)return await m(d,c);let e=a.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim();try{return r(e)}catch{throw Error("Failed to parse diagram response from AI.")}}}),p({id:"doc2latex",name:"Doc2LaTeX AI Converter Agent",description:"AI sub-agent that intelligently enhances DOCX-to-LaTeX conversion: improves structure, polishes abstract, validates cross-references, and outputs structured enhancement suggestions",temperature:.1,maxTokens:8192,rateLimit:10,buildSystemPrompt(a){let b=String(a.documentTitle||"Untitled Document"),c=String(a.templateId||"article_lncs"),d=Number(a.figureCount||0),e=Number(a.tableCount||0),f=Number(a.equationCount||0),g=Number(a.wordCount||0),h=String(a.documentText||"").substring(0,5e3),i=String(a.latexDraft||"").substring(0,4e3),j=a.sectionTitles||[],k=a.mathSnippets||[];return`You are an expert academic LaTeX conversion AI agent inside the Latexify Studio platform.

## Task
A DOCX manuscript has been automatically converted to LaTeX using structural parsing. Your job is to:
1. Review the extracted document structure and draft LaTeX
2. Identify improvement opportunities (structure, formatting, cross-references, abstract quality)
3. Generate AI-enhanced suggestions and an improved abstract/introduction
4. Validate math notation and figure/table placement

## Document Profile
- Title: "${b}"
- Template: ${c}
- Figures: ${d} | Tables: ${e} | Equations: ${f} | Words: ${g}
- Sections detected: ${j.slice(0,15).map(a=>`"${a}"`).join(", ")||"none"}
${k.length>0?`- Math samples: ${k.slice(0,3).join(" ; ")}`:""}

## Document Text (first 5000 chars)
\`\`\`
${h}
\`\`\`

## Current LaTeX Draft (first 4000 chars)
\`\`\`latex
${i}
\`\`\`

## Output Format
Return a JSON object with this EXACT structure:
{
  "qualityScore": <integer 0-100>,
  "verdict": "<Excellent|Good|Needs Improvement|Poor>",
  "abstractEnhanced": "<AI-polished abstract text, max 300 words>",
  "structuralSuggestions": [
    { "section": "<section name>", "issue": "<description>", "fix": "<concrete LaTeX fix or advice>" }
  ],
  "latexFixes": [
    { "description": "<what to fix>", "original": "<snippet>", "replacement": "<fixed snippet>" }
  ],
  "crossRefIssues": ["<any figure/table/equation reference problems>"],
  "keywordSuggestions": ["<keyword1>", "<keyword2>"],
  "templateNotes": "<any template-specific formatting advice for ${c}>",
  "conversionConfidence": <integer 0-100>
}

Return ONLY valid JSON. No markdown, no text before or after.`},parseResponse(a){try{return JSON.parse(a.trim())}catch{}let b=a.indexOf("{"),c=a.lastIndexOf("}");if(-1!==b&&-1!==c&&c>b)try{return JSON.parse(a.substring(b,c+1))}catch{}let d={},e=a.match(/"qualityScore"\s*:\s*(\d+)/),f=a.match(/"verdict"\s*:\s*"([^"]+)"/),g=a.match(/"conversionConfidence"\s*:\s*(\d+)/);return e&&(d.qualityScore=parseInt(e[1],10)),f&&(d.verdict=f[1]),g&&(d.conversionConfidence=parseInt(g[1],10)),{qualityScore:d.qualityScore??70,verdict:d.verdict??"Good",abstractEnhanced:"",structuralSuggestions:[],latexFixes:[],crossRefIssues:[],keywordSuggestions:[],templateNotes:"",conversionConfidence:d.conversionConfidence??75,_partial:!0}}}),p({id:"citation-enrich",name:"Citation Enrichment Agent",description:"Enriches citation metadata by filling missing fields, correcting inconsistencies, and suggesting improvements",temperature:.15,maxTokens:4096,rateLimit:60,buildSystemPrompt(a){let b=JSON.stringify(a.citations||[],null,2).substring(0,6e3),c=String(a.style||"APA 7th edition");return`You are an expert citation metadata enrichment AI agent inside the Citation Studio.

## Task
Analyze the provided citation(s) and enrich them:
1. Fill in missing fields (publisher, volume, issue, pages, DOI, city) where possible
2. Correct inconsistencies (e.g., author name format, year placement)
3. Suggest improvements for completeness
4. Flag any missing critical fields

## Target Citation Style
${c}

## Citation Data
\`\`\`json
${b}
\`\`\`

## Output Format
Return a JSON object with this EXACT structure:
{
  "enrichedCitations": [
    {
      "id": "<original citation id>",
      "fields": {
        "title": "<corrected/enhanced title or original>",
        "authors": "<corrected author format>",
        "year": "<year or n.d.>",
        "sourceName": "<journal/book name>",
        "doi": "<doi or empty string>",
        "publisher": "<suggested publisher>",
        "publisherCity": "<suggested city>",
        "volume": "<volume or empty>",
        "issue": "<issue or empty>",
        "pages": "<pages or empty>",
        "edition": "<edition or empty>"
      },
      "missingCritical": ["<list of critical missing fields>"],
      "suggestions": ["<specific improvement suggestions>"],
      "confidence": <integer 0-100>
    }
  ],
  "globalSuggestions": ["<general suggestions across all citations>"]
}

Return ONLY valid JSON. No markdown, no text before or after.`},parseResponse(a){try{return JSON.parse(a.trim())}catch{}let b=q(a);if(b)try{return r(b)}catch{}let c=a.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim();try{return r(c)}catch{return{enrichedCitations:[],globalSuggestions:["AI enrichment unavailable. Please check your citations manually."],_partial:!0}}}}),p({id:"citation-validate",name:"Citation Validation Agent",description:"Validates citation data for accuracy, completeness, and style compliance with detailed error reporting",temperature:.1,maxTokens:4096,rateLimit:60,buildSystemPrompt(a){let b=JSON.stringify(a.citations||[],null,2).substring(0,6e3),c=String(a.style||"APA 7th edition");return`You are an expert citation validation AI agent inside the Citation Studio.

## Task
Validate the provided citation(s) against the target style rules:
1. Check for missing required fields per the citation style
2. Validate format correctness (author format, date placement, title capitalization)
3. Flag potential data inconsistencies (e.g., DOI format, ISBN length)
4. Score each citation on completeness and accuracy

## Target Citation Style
${c}

## Citation Data
\`\`\`json
${b}
\`\`\`

## Output Format
Return a JSON object with this EXACT structure:
{
  "validatedCitations": [
    {
      "id": "<original citation id>",
      "isValid": <boolean>,
      "score": <integer 0-100>,
      "errors": [
        { "field": "<field name>", "message": "<error description>", "severity": "error" | "warning" | "info" }
      ],
      "styleIssues": ["<citation style violations>"],
      "autoFixes": [
        { "field": "<field name>", "current": "<current value>", "suggested": "<corrected value>", "reason": "<why this fix>" }
      ]
    }
  ],
  "summary": {
    "totalCitations": <number>,
    "validCount": <number>,
    "invalidCount": <number>,
    "commonIssues": ["<recurring issues across citations>"]
  }
}

Return ONLY valid JSON. No markdown, no text before or after.`},parseResponse(a){try{return JSON.parse(a.trim())}catch{}let b=q(a);if(b)try{return r(b)}catch{}let c=a.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim();try{return r(c)}catch{return{validatedCitations:[],summary:{totalCitations:0,validCount:0,invalidCount:0,commonIssues:["AI validation unavailable."]},_partial:!0}}}}),p({id:"citation-format",name:"Citation Formatting Agent",description:"Converts citations between styles (APA, MLA, Chicago, Harvard, Vancouver, IEEE) and generates multiple format variants",temperature:.1,maxTokens:4096,rateLimit:60,buildSystemPrompt(a){let b=JSON.stringify(a.citations||[],null,2).substring(0,6e3),c=String(a.targetStyle||"APA 7th edition"),d=String(a.currentStyle||"APA 7th edition");return`You are an expert citation formatting AI agent inside the Citation Studio.

## Task
Convert the provided citation(s) from one style to another:
1. Apply the target citation style rules precisely
2. Handle special cases (multiple authors, et al. rules, italicization markers)
3. Generate both bibliography and in-text citation formats
4. Maintain consistency across all citations

## Current Style
${d}

## Target Style
${c}

## Citation Data
\`\`\`json
${b}
\`\`\`

## Output Format
Return a JSON object with this EXACT structure:
{
  "formattedCitations": [
    {
      "id": "<original citation id>",
      "bibliography": "<fully formatted bibliography entry>",
      "inText": "<in-text citation format>",
      "inTextNarrative": "<narrative in-text format, e.g. Author (Year)>",
      "style": "${c}",
      "notes": ["<any formatting notes or caveats>"]
    }
  ],
  "styleGuide": {
    "rules": ["<key rules of the target style applied>"],
    "tips": ["<tips for using this style correctly>"]
  }
}

Return ONLY valid JSON. No markdown, no text before or after.`},parseResponse(a){try{return JSON.parse(a.trim())}catch{}let b=q(a);if(b)try{return r(b)}catch{}let c=a.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim();try{return r(c)}catch{return{formattedCitations:[],styleGuide:{rules:[],tips:["AI formatting unavailable."]},_partial:!0}}}}),p({id:"structure-analyze",name:"Manuscript Structure Analyzer",description:"AI-driven structural verification of converted manuscripts: exact title, authors, affiliations, abstract, keywords, section hierarchy, component counts (figures/charts/tables/equations/pseudocode/citations/references) and reference list",temperature:.05,maxTokens:8192,rateLimit:20,buildSystemPrompt(a){let b=String(a.fullText||a.frontMatter||"").substring(0,2e5),c=String(a.documentTitle||"Untitled Document"),d=a.sectionTitles||[],e=a.figureCaptions||[],f=a.tableCaptions||[],g=a.algorithmTitles||[],h=a.equationSnippets||[],i=a.referenceEntries||[],j=a.imageClassifications||[],k=JSON.stringify(a.heuristic||{});return`You are a world-class scholarly document analysis engine with 20 years of experience in academic publishing (IEEE, ACM, Springer LNCS, Elsevier, Nature, and APA/IEEE reference formats). Your job is to analyze a converted academic manuscript from its FULL TEXT with surgical precision and return the complete, exact structural analysis.

## INPUTS
### A. FULL DOCUMENT TEXT (PRIMARY EVIDENCE - the COMPLETE manuscript text in reading order: title, authors, affiliations, abstract, keywords, every section/subsection with its body paragraphs, every figure and table caption, every equation, every algorithm/pseudocode listing, and the full reference list). Every count and every list you return MUST be derived from this text:
"""TEXT
${b}
"""

### B. Heuristic extraction already performed by the structural parser (for reference only - verify it against input A, do not trust it blindly):
${k}

### C. Section headings detected by the parser (ordered):
${d.slice(0,150).map((a,b)=>`${b+1}. "${a}"`).join("\n")||"none"}

### D. Figure captions detected:
${e.slice(0,80).map(a=>`- ${a}`).join("\n")||"none"}

### E. Table captions detected:
${f.slice(0,80).map(a=>`- ${a}`).join("\n")||"none"}

### F. Algorithm/pseudocode titles detected:
${g.slice(0,40).map(a=>`- ${a}`).join("\n")||"none"}

### G. Math snippets detected:
${h.slice(0,30).map(a=>`- ${a}`).join("\n")||"none"}

### H. Reference entries detected:
${i.slice(0,150).map((a,b)=>`${b+1}. ${a}`).join("\n")||"none"}

### I. Image classification ground truth (from the conversion engine's filename analysis — TRUST IT for the figures-vs-charts split; you only verify captions):
${j&&j.length>0?j.join("\n"):"none"}

Document working title (from filename, may be wrong): "${c}"

## YOUR TASK
Analyze the manuscript and return ONE JSON object (no markdown, no commentary before or after) with this EXACT schema:
{
  "title": { "text": "the exact manuscript title as it appears (no numbering, no surrounding quotes)", "confidence": 0-100 },
  "authors": [ { "name": "Full Name", "affiliations": ["Department, University, Country"] } ],
  "affiliations": ["each unique affiliation written ONCE in clean form"],
  "abstract": { "text": "the abstract text EXACTLY as it appears (do not rewrite, shorten or summarize)", "confidence": 0-100 },
  "keywords": ["keyword1", "keyword2"],
  "sections": [ { "title": "exact heading text without numbering", "level": 1, 2 or 3 } ],
  "figures": [ { "caption": "exact figure caption as it appears, e.g. "Fig. 1. Overview of the proposed framework."" } ],
  "tables": [ { "caption": "exact table caption as it appears, e.g. "TABLE I. Simulation Parameters"" } ],
  "algorithms": [ { "title": "exact algorithm/pseudocode title as it appears, e.g. "Algorithm 1" or "Algorithm 1: K-Means Clustering"" } ],
  "components": {
    "figures": <integer: count captioned figure images (photos, illustrations, architecture diagrams) in the BODY text. Each "Fig. N" or "Figure N" caption = 1 figure. Sub-figures (a)(b)(c) under one caption = 1 figure. Decorative images without captions do NOT count. Charts/plots NEVER count as figures — they go under "charts">,
    "charts": <integer: count charts/plots/graphs (bar, line, pie, scatter, histogram, box, heatmap). A chart with a "Fig." caption is STILL a chart — count it under charts ONLY, never under figures>,
    "tables": <integer: count Table/Tab. captions. Each "Table N" or "TABLE N" label = 1 table. Do NOT count algorithm listings formatted as tables>,
    "equations": <integer: count display/math equations — numbered equations like (1), (2), equation blocks, LaTeX \\begin{equation}. Do NOT count inline math, parameter assignments like 'n = 100', or value labels>,
    "pseudocode": <integer: count Algorithm/Pseudocode/Procedure/Listing blocks. Each "Algorithm N" label = 1>,
    "citations": <integer: count distinct in-text citation markers like [1], [2-5], (Author, 2020) in the BODY text. Do NOT count reference-list entries>,
    "references": <integer: count bibliography entries in the References/Bibliography section. Each numbered or author-year entry = 1>
  },
  "references": ["complete bibliography entries as they appear, in order"],
  "notes": "one short sentence about anything unusual"
}

## HARD RULES
1. Use ONLY text that actually appears in input A (the full document text). NEVER invent, paraphrase, translate or beautify titles, abstracts, author names, affiliations, captions or references.
2. If a field is missing from the document, set it to null (or [] for arrays). Never fabricate placeholder values like "Author Name", "Unknown" or "Institution".
3. Authors: list every author with the exact name (drop only trailing superscript digits/asterisks used for affiliation markers, e.g. "John Doe1" -> "John Doe"). Attach the matching affiliation(s) from the manuscript.
4. Affiliations: deduplicate; include department, institution and country when present.
5. Abstract: copy verbatim; strip a leading "Abstract" label if present.
6. Keywords: exact terms, no numbering, no bullet prefixes.
7. Sections: the COMPLETE ordered list of every section, subsection and subsubsection heading visible in input A. level 1 = \\section, level 2 = \\subsection, level 3 = \\subsubsection. Drop leading numbering ("1.", "1.1", "1.1.2", "[1]", "I."). "References"/"Bibliography", "Acknowledgements", "Declarations", "Appendix" are level 1 headings. Never omit, merge or reorder sections. Keep every heading's implied depth: a "3.2" heading belongs at level 2, "3.2.1" at level 3 — never flatten them to level 1.
8. figures/tables/algorithms: list EVERY figure, table and algorithm visible in input A with its caption/title copied VERBATIM, in document order. Empty arrays when none exist. An image without any caption is NOT a figure - do not count or list it.
9. HARD RULES FOR COMPONENT INTEGRITY (ZERO BIAS):
   - FRONTMATTER METADATA ONLY: Author names, academic designations (e.g., 'Assistant Professor', 'Deputy Librarian', 'Lecturer', 'Dr.', 'Prof.'), department names, university names, polytechnic/institute names, and email addresses ARE FRONTMATTER METADATA. They MUST NEVER be placed in the "sections" array or counted as sections/headings — even if they are visually styled as headings in the converted text (a Word author block often is). Put them ONLY in the "authors"/"affiliations" fields.
   - SECTION HEADINGS ARE NOT EQUATIONS: Section and subsection titles (e.g. "6. AI-Assisted Responsible Citation (ARC) Framework", "3.1 Methods") ARE HEADINGS ONLY. They MUST NEVER be included in "equations" or classified as math, even when they appear inside equation-looking delimiters or math markup in the converted text. An "equation" MUST contain real math operators (=, <, >, sums, integrals, Greek letters, exponents) — pure words are never an equation.
   - FIGURE CAPTIONS ARE NOT SECTIONS: "Figure N: <caption>" / "Table N: <caption>" lines are CAPTIONS, never headings — do not put them in "sections".
   - FIGURES & CHARTS: Count by "Fig." or "Figure" captions ONLY, excluding charts/plots. Sub-figures (a)(b)(c) under one "Fig. N" = 1 figure. Do NOT count images without captions. When input I classifies an image file as a chart (filename contains "rf_chart" or "chart_pending"), it is a CHART even if its caption reads "Fig. N" — report it under "charts" only.
   - CHARTS: Count chart/plot images only (a chart with a "Fig." caption counts here, not under figures).
   - TABLES: Count by "Table" or "TABLE" captions. Do NOT count algorithm or equation tables. A 2-column key-value table IS a table. A layout table used for author affiliations is NOT a table.
   - EQUATIONS: Count ONLY display equations — numbered equations like (1), (2), or explicit equation/align/gather blocks. Inline math ($x$), parameter assignments ("n = 100"), inequality constraints, section titles, and simple expressions in prose are NOT equations. When in doubt, do NOT count it.
   - PSEUDOCODE: Count "Algorithm N" or "Pseudocode N" blocks only.
   - NEVER inflate counts. If you see 3 tables, report 3 — not 5. Under-counting by 1 is acceptable; over-counting by even 1 is a FAILURE.
   - CONSISTENCY CHECK: the number of entries you list in "figures"/"tables"/"algorithms" MUST equal your "components" figures/tables/pseudocode counts. The "sections" array MUST contain "References"/"Bibliography" as its final entry whenever a reference list exists in input A.
   - If a count cannot be determined from the text, return null for that field — never guess 0.
10. Citations: an in-text citation marker is a bracketed number/reference like [12] or (Smith et al., 2020) in the body text.
11. References: include the actual bibliography entries verbatim (up to 150). If no bibliography is visible in the text, return [].
12. confidence for title/abstract must be 90+ when the text appears verbatim in the document.
13. JSON keys must match EXACTLY. Escape backslashes and quotes properly.
14. RESPONSE BUDGET: be maximally economical. Copy captions and references verbatim but NEVER add explanatory prose, whitespace padding, or commentary. Keep "notes" under 15 words. A short response is preferred over a long one as long as every count and list is exact.

Respond with ONLY the JSON object.`},parseResponse(a){try{return JSON.parse(a.trim())}catch{}let b=q(a);if(b)try{return r(b)}catch{}let c=a.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim(),d=c.indexOf("{"),e=c.lastIndexOf("}");if(-1!==d&&-1!==e&&e>d)try{return r(c.substring(d,e+1))}catch{}throw Error("AI structure analysis response did not contain valid JSON")}}),p({id:"structure-frontmatter",name:"Manuscript Front-Matter Analyzer",description:"AI extraction of manuscript front matter: exact title, authors with affiliations, affiliations, abstract and keywords from the title-area text",temperature:.05,maxTokens:6144,rateLimit:20,buildSystemPrompt(a){let b=String(a.frontMatter||"").substring(0,12e3),c=String(a.documentTitle||"Untitled Document"),d=JSON.stringify(a.heuristic||{}),e=String(a.frontMatterHtml||"");return`You are a world-class scholarly document front-matter extraction engine with 20 years of experience in academic publishing (IEEE, ACM, Springer LNCS, Elsevier, Nature). Your job is to extract the EXACT front matter (title, authors, affiliations, abstract, keywords) of a converted academic manuscript with surgical precision.

## INPUTS
### A. Document text (plain text — first ~12000 characters of the manuscript):
"""TEXT
${b}
"""
${e?`### A2. Document HTML (raw — preserves bold/italic/font-size cues that indicate title, author names, and affiliation markers like superscripts):
"""HTML
${e}
"""`:""}

### B. Heuristic extraction already performed by the structural parser (for reference only — verify against input A, do NOT trust it blindly):
The heuristic object includes: title, authors (with names, affiliations, emails, affiliationIds), organizations (detected affiliation strings), keywords, rawAuthorLines (lines the parser classified as author text), rawAffilLines (lines the parser classified as affiliation text).
${d}

Document working title (from filename, may be wrong): "${c}"

## YOUR TASK
Return ONE JSON object (no markdown, no commentary before or after) with this EXACT schema:
{
  "title": { "text": "the exact manuscript title as it appears (no numbering, no surrounding quotes)", "confidence": 0-100 },
  "authors": [ { "name": "Full Name", "affiliations": ["Department, University, Country"] } ],
  "affiliations": ["each unique affiliation written ONCE in clean form"],
  "abstract": { "text": "the abstract text EXACTLY as it appears (do not rewrite, shorten or summarize)", "confidence": 0-100 },
  "keywords": ["keyword1", "keyword2"]
}

## IDENTIFYING THE TITLE
The title is usually the LARGEST/BOLDEST text at the very top of the document. Common patterns:
- A standalone line in bold/large font before author names
- May be preceded by a running header or journal name (skip those)
- May be followed by a subtitle after a colon or dash
- NEVER treat author names, affiliations, or "Abstract" labels as the title
- If the heuristic.title looks wrong (e.g. is a journal name or "Original Article"), use the actual title from the text

## IDENTIFYING AUTHORS AND AFFILIATIONS
Academic manuscripts use several conventions to map authors to affiliations. Examine both plain text and HTML to determine which pattern is used:

**Pattern 1 — Superscript numbers:** Author names followed by small digits (1,2,3). Each digit maps to an affiliation listed below.
Example: "John Smith1,2, Jane Doe1" → Smith has affiliations 1 AND 2, Doe has affiliation 1.

**Pattern 2 — Symbols/footnotes:** Authors marked with *, †, ‡, \xa7, ||, \xb6 or similar. Corresponding author is usually *. Each symbol maps to an affiliation.
Example: "John Smith*, Jane Doe†" where * = "University of X" and † = "University of Y".

**Pattern 3 — Inline affiliations:** Each author name is directly followed by their affiliation in parentheses or on the next line.
Example: "John Smith (University of X)" or "John Smith
University of X".

**Pattern 4 — Author block:** All authors listed on one line, all affiliations listed below as numbered or bulleted items.

**Pattern 5 — Footnote-style:** Affiliations appear as footnotes at the bottom of the first page, referenced by superscript numbers after author names.

When extracting authors:
- Strip only the affiliation marker (superscript digit, symbol, footnote ref) from the name — keep the full real name
- "Mohammad Aadil Khan1" → "Mohammad Aadil Khan" (the "1" is an affiliation marker)
- "Smith, J.1,2" → "Smith, J." (keep the comma/period name format as-is)
- Do NOT strip parts of names that happen to look like markers (e.g. "Dr. Kumar1" → "Dr. Kumar")
- If the HTML shows <sup> tags, those are affiliation markers — strip them from author names

When extracting affiliations:
- Include department, institution, city, and country when present
- "Department of Computer Science, University of Delhi, India" is one affiliation
- Deduplicate identical affiliations across authors
- Use the heuristic.organizations and heuristic.rawAffilLines as hints, but verify against the actual text

## HARD RULES
1. Use ONLY text that actually appears in input A (and A2 if present). NEVER invent, paraphrase, translate or beautify titles, author names, affiliations or abstracts.
2. If a field is missing from the front matter, set it to null (or [] for arrays). Never fabricate placeholder values like "Author Name", "Unknown" or "Institution".
3. Authors: list every author with the exact name (drop only trailing superscript digits/asterisks used for affiliation markers, e.g. "John Doe1" -> "John Doe"). Attach the matching affiliation(s) from the manuscript.
4. Affiliations: deduplicate; include department, institution and country when present.
5. Abstract: copy verbatim; strip a leading "Abstract" or "ABSTRACT" label if present. Include keywords if they appear within the abstract block.
6. Keywords: exact terms as they appear, no numbering, no bullet prefixes. If keywords are labeled (e.g. "Keywords: AI, ML"), extract only the terms after the label.
7. If the front matter shows only template boilerplate (e.g. placeholder titles like "<Title, 24 point, Bold>" or generic instruction text with no real content), set title/authors/abstract to null rather than returning the boilerplate.
8. confidence for title/abstract must be 90+ when the text appears verbatim in the front matter.
9. JSON keys must match EXACTLY. Escape backslashes and quotes properly.

Respond with ONLY the JSON object.`},parseResponse(a){try{return JSON.parse(a.trim())}catch{}let b=q(a);if(b)try{return r(b)}catch{}let c=a.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim(),d=c.indexOf("{"),e=c.lastIndexOf("}");if(-1!==d&&-1!==e&&e>d)try{return r(c.substring(d,e+1))}catch{}throw Error("AI front-matter analysis response did not contain valid JSON")}}),p({id:"structure-latex",name:"Manuscript Component LaTeX Generator",description:"Identifies manuscript components (figures, charts, tables, algorithms) from the full text, counts them, and creates modular LaTeX code for each component",temperature:.05,maxTokens:8192,rateLimit:20,buildSystemPrompt(a){let b=!!(process.env.OPENROUTER_API_KEY||process.env.GEMINI_API_KEY),c=String(a.fullText||"").substring(0,b?8e4:24e3),d=JSON.stringify(a.imageMap||[]),e=a.figureCaptions||[],f=a.tableCaptions||[],g=a.algorithmTitles||[],h=String(a.templateId||"article_lncs"),i=JSON.stringify(a.counts||{});return`You are a world-class scholarly LaTeX typesetting engine with 20 years of experience in academic publishing (IEEE, ACM, Springer LNCS, Elsevier, Nature). Your job is to identify the different components of the manuscript — figures, charts, tables, algorithms/pseudocode — count them, and create modular LaTeX code for each component.

## YOUR TASK
For THIS pass you focus ONLY on the visual components: figures, charts, tables, algorithms/pseudocode. The other components (title, authors, abstract, keywords, equations, sections, citations, references) are handled by the deterministic engine — do NOT emit LaTeX for them.

## TARGET TEMPLATE
Template ID: ${h}
${h.includes("ieee")?"This is an IEEE template — use table*/figure* for wide content in the two-column layout. Use [!ht] placement.":""}
${h.includes("acm")?"This is an ACM template — use table*/figure* for wide content. Use [htbp] placement.":""}
${h.includes("elsevier")?"This is an Elsevier template — single column, use [!ht] placement.":""}
${h.includes("lncs")?"This is a Springer LNCS template — single column, use [htbp] placement.":""}

## INPUTS
### A. FULL DOCUMENT TEXT (primary evidence — every caption, every algorithm block):
"""TEXT
${c}
"""

### B. Verified figure captions (document order):
${e.map((a,b)=>`${b+1}. ${a}`).join("\n")||"none"}

### C. Verified table captions (document order):
${f.map((a,b)=>`${b+1}. ${a}`).join("\n")||"none"}

### D. Verified algorithm/pseudocode titles (document order):
${g.map((a,b)=>`${b+1}. ${a}`).join("\n")||"none"}

### E. Known component counts (deterministic + verified analysis):
${i}

### F. Available image files mapped to document order:
${d}

## OUTPUT SCHEMA
Return ONE JSON object (no markdown, no commentary) with this EXACT schema:
{
  "figures":    [ { "index": 1, "latex": "\\begin{figure}[!ht]\\n\\centering\\n\\includegraphics[width=0.9\\linewidth]{rf_fig_1.png}\\n\\caption{<verbatim caption>}\\n\\label{fig:1}\\n\\end{figure}" } ],
  "charts":     [ { "index": 1, "latex": "...same figure environment, image = <the chart filename>..." } ],
  "tables":     [ { "index": 1, "latex": "\\begin{table}[!ht]\\n\\centering\\n\\begin{tabular}{...}\\n<rows>\\n\\end{tabular}\\n\\caption{<verbatim caption>}\\n\\label{tab:1}\\n\\end{table}" } ],
  "algorithms": [ { "index": 1, "latex": "\\begin{algorithm}\\n\\caption{<verbatim title>}\\n\\begin{algorithmic}[1]\\n<lines>\\n\\end{algorithmic}\\n\\end{algorithm}" } ]
}

## HARD RULES
1. index = position of that component in the document (1-based, in order). Every component gets exactly one entry; never skip or merge.
2. Captions and titles MUST be copied VERBATIM from inputs B/C/D (exact text, no rewriting).
3. \\includegraphics/\\zimg filenames MUST come EXACTLY from input F's "filename" field for the matching index. Never invent filenames.
4. tables: reconstruct rows/columns from the text ACCURATELY. Use tabularx with |c|c|..| column spec and \\hline. Use \\multicolumn for merged cells. Use \\adjustbox{max width=\\linewidth} to prevent overflow. Every table must compile standalone inside a float. Preserve ALL data rows — never truncate table content.
5. algorithms: reconstruct the pseudocode lines with \\State, \\For/\\EndFor, \\While/\\EndWhile, \\If/\\Else/\\EndIf, \\Procedure, \\Function, \\Return, \\Comment. Use the algorithmic environment (algorithmicx style).
6. Latex must be a single float/environment block per entry — no \\documentclass, \\usepackage, \\input, \\newcommand, \\def, \\bibliography, \\maketitle, \\section, \\subsection, \\begin{equation}, or any other structural commands.
7. Escape special characters in text (%, #, &, _ as \\%, \\#, \\&, \\_).
8. If a component type is absent from the document, omit its key entirely (or use []).
9. Keep every fragment under 3000 characters. JSON keys and backslashes must be exact and properly escaped.
10. COUNTS: your counts MUST match input E exactly — the counts there are ground truth. Do not recount or re-derive them from the truncated text window; if input E shows figures: 3, emit EXACTLY 3 figure entries.
11. ZERO-BIAS GUARD: A text line like "N. Some Words" or "N.M. Some Words" is a SECTION HEADING, not a figure/table/algorithm/chart — never emit a component fragment for it and never include it in a caption. A line like "Figure N: <text>" that is NOT in inputs B/C/D is not a verified component — skip it. Pure-word lines are never captions.
12. RESPONSE BUDGET: return ONLY the JSON object — no commentary, no markdown fences, no trailing text. Be economical: captions and pseudocode lines must be verbatim and complete, but add no prose or padding.

Respond with ONLY the JSON object.`},parseResponse(a){try{return JSON.parse(a.trim())}catch{}let b=q(a);if(b)try{return r(b)}catch{}let c=a.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim(),d=c.indexOf("{"),e=c.lastIndexOf("}");if(-1!==d&&-1!==e&&e>d)try{return r(c.substring(d,e+1))}catch{}throw Error("AI component LaTeX response did not contain valid JSON")}})},67453:(a,b,c)=>{c.d(b,{D:()=>n,RG:()=>k});var d=c(93061);let e=null,f=0,g=null;async function h(a){try{let b=await fetch("https://opencode.ai/zen/v1/models",{headers:{Authorization:`Bearer ${a}`},signal:AbortSignal.timeout(8e3)});if(!b.ok)return[];let c=await b.json(),d=[];for(let a of c?.data||c?.models||Array.isArray(c)?c:[]){let b=a?.id||a?.model||"";b&&(b.endsWith("-free")||"big-pickle"===b||a?.pricing?.prompt==="0")&&!d.includes(b)&&d.push(b)}return d.length>0?d:["big-pickle","deepseek-v4-flash-free","mimo-v2.5-free","north-mini-code-free","nemotron-3-ultra-free"]}catch{return["big-pickle","deepseek-v4-flash-free","mimo-v2.5-free","north-mini-code-free","nemotron-3-ultra-free"]}}async function i(){try{let a=await fetch("https://openrouter.ai/api/v1/models",{signal:AbortSignal.timeout(8e3)});if(!a.ok)return[];let b=await a.json(),c=[];for(let a of b?.data||[]){let b=a?.id||"";if(!b)continue;let d=parseFloat(a?.pricing?.prompt),e=parseFloat(a?.pricing?.completion);(0===d||isNaN(d))&&(0===e||isNaN(e))&&!c.includes(b)&&c.push(b)}return c.length>0?c:["google/gemini-2.0-flash-001","google/gemini-2.5-flash-001","google/gemini-2.0-flash-lite-001","mistral/mistral-small-3.1-24b-instruct"]}catch{return["google/gemini-2.0-flash-001","google/gemini-2.5-flash-001","google/gemini-2.0-flash-lite-001","mistral/mistral-small-3.1-24b-instruct"]}}async function j(){let a=[],b=process.env.OPENCODE_API_KEY||"",c=process.env.OPENROUTER_API_KEY||"",[d,e]=await Promise.all([b?h(b):Promise.resolve([]),c?i():Promise.resolve([])]);b&&a.push({name:"opencode",apiKey:b,baseUrl:"https://opencode.ai/zen/v1",models:d}),c&&a.push({name:"openrouter",apiKey:c,baseUrl:"https://openrouter.ai/api/v1",models:e});let f=process.env.GEMINI_API_KEY||"";return f&&a.push({name:"gemini",apiKey:f,baseUrl:"https://generativelanguage.googleapis.com/v1beta/openai",models:["gemini-2.0-flash-exp","gemini-2.5-flash","gemini-2.0-flash-lite"]}),a}async function k(){let a=Date.now();return e&&a-f<6e5||(e=await j(),f=Date.now()),e}let l=null;async function m(){try{let a=await d.prisma.aiUsageLog.findMany({where:{createdAt:{gte:new Date(Date.now()-864e5)}},select:{model:!0,promptTokens:!0,completionTokens:!0,totalTokens:!0},take:5e3}),b=0,c=0,e=0;for(let d of a){let a=(d.model||"").toLowerCase();a.startsWith("opencode/")?b+=d.totalTokens:a.startsWith("openrouter/")?c+=d.totalTokens:a.startsWith("gemini/")&&(e+=d.totalTokens)}console.log(`[AI-Gateway Background Monitor] Cumulative Token Usage: OpenCode: ${b.toLocaleString()} tokens | OpenRouter: ${c.toLocaleString()} tokens | Gemini: ${e.toLocaleString()} tokens`)}catch(a){console.warn("[AI-Gateway Background Monitor] Error running token monitor:",a.message)}}function n(){!g&&(k(),g=setInterval(async()=>{e=await j(),f=Date.now(),console.log(`[ModelSync] Refreshed free models — ${e.length} providers active`)},6e5),l||(setTimeout(()=>{m()},5e3),l=setInterval(()=>{m()},3e5)))}},70589:(a,b,c)=>{c.d(b,{B:()=>d});let d=[{name:"IEEE Transactions on Pattern Analysis and Machine Intelligence",publisher:"IEEE",quartile:"Q1",accessType:"Hybrid",apc:2150,impactFactor:23.6,indexing:["Scopus","IEEE Xplore","Web of Science","PubMed"],reviewTimeWeeks:"12-20",publicationTimeWeeks:"20-30",latexTemplateUrl:"https://template-selector.ieee.org/",homeUrl:"https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=34",domains:["Computer Science","Artificial Intelligence","Computer Vision"],sjrScore:7.8,keywords:["computer vision","pattern recognition","machine learning","deep learning","image analysis","neural networks"],scopeText:"Publishes high-quality, peer-reviewed articles on all aspects of computer vision, image processing, pattern recognition, and machine learning architectures.",minRecommendedScore:85,methodologyFocus:["experimental","theoretical","quantitative"]},{name:"Journal of Machine Learning Research",publisher:"Microtome Publishing",quartile:"Q1",accessType:"Open Access",apc:0,impactFactor:5.1,indexing:["Scopus","Web of Science","DBLP"],reviewTimeWeeks:"12-24",publicationTimeWeeks:"24-48",latexTemplateUrl:"https://www.jmlr.org/format/format.html",homeUrl:"https://www.jmlr.org/",domains:["Computer Science","Machine Learning","Artificial Intelligence"],sjrScore:4.5,keywords:["machine learning","statistical learning","optimization","reinforcement learning","neural networks","generalization theory"],scopeText:"Provides an international forum for the electronic publication of high-quality scholarly articles in all areas of machine learning and statistical foundations.",minRecommendedScore:80,methodologyFocus:["theoretical","experimental","algorithmic"]},{name:"Expert Systems with Applications",publisher:"Elsevier",quartile:"Q1",accessType:"Hybrid",apc:2980,impactFactor:8.5,indexing:["Scopus","Web of Science","DBLP"],reviewTimeWeeks:"8-12",publicationTimeWeeks:"12-16",latexTemplateUrl:"https://www.elsevier.com/journals/expert-systems-with-applications/0957-4174/guide-for-authors",homeUrl:"https://www.sciencedirect.com/journal/expert-systems-with-applications",domains:["Computer Science","Artificial Intelligence","Information Systems"],sjrScore:2.1,keywords:["expert systems","knowledge engineering","applied artificial intelligence","decision support systems","data mining","predictive analytics"],scopeText:"Focuses on publishing high-quality papers design, development, testing, implementation, and management of expert systems and applied AI.",minRecommendedScore:70,methodologyFocus:["applied","experimental","case-study"]},{name:"Pattern Recognition",publisher:"Elsevier",quartile:"Q1",accessType:"Hybrid",apc:3240,impactFactor:8,indexing:["Scopus","Web of Science","DBLP"],reviewTimeWeeks:"10-14",publicationTimeWeeks:"14-20",latexTemplateUrl:"https://www.elsevier.com/journals/pattern-recognition/0031-3203/guide-for-authors",homeUrl:"https://www.sciencedirect.com/journal/pattern-recognition",domains:["Computer Science","Computer Vision","Artificial Intelligence"],sjrScore:2.3,keywords:["pattern recognition","feature extraction","image segmentation","classification","clustering","computer vision"],scopeText:"Welcomes research papers representing major advances on the recognition of patterns, object categorization, and classification methods.",minRecommendedScore:75,methodologyFocus:["experimental","theoretical"]},{name:"International Journal of Computer Vision",publisher:"Springer",quartile:"Q1",accessType:"Hybrid",apc:3490,impactFactor:11.6,indexing:["Scopus","Web of Science","DBLP"],reviewTimeWeeks:"12-18",publicationTimeWeeks:"18-24",latexTemplateUrl:"https://www.springer.com/journal/11263/submission-guidelines",homeUrl:"https://www.springer.com/journal/11263",domains:["Computer Science","Computer Vision","Artificial Intelligence"],sjrScore:4.1,keywords:["computer vision","3d reconstruction","motion analysis","object detection","image synthesis","scene understanding"],scopeText:"Publishes high-quality, comprehensive papers on the mathematical and computational foundations of computer vision and image interpretation.",minRecommendedScore:82,methodologyFocus:["theoretical","experimental"]},{name:"Neural Networks",publisher:"Elsevier",quartile:"Q1",accessType:"Hybrid",apc:2850,impactFactor:6,indexing:["Scopus","Web of Science","PubMed"],reviewTimeWeeks:"8-12",publicationTimeWeeks:"12-18",latexTemplateUrl:"https://www.elsevier.com/journals/neural-networks/0893-6080/guide-for-authors",homeUrl:"https://www.sciencedirect.com/journal/neural-networks",domains:["Computer Science","Artificial Intelligence","Cognitive Science"],sjrScore:1.8,keywords:["neural networks","deep learning","neuroscience","cognitive modelling","associative memory","unsupervised learning"],scopeText:"Presents original research on the modeling of brain behavior and the design of artificial neural network systems across disciplines.",minRecommendedScore:72,methodologyFocus:["theoretical","experimental","computational"]},{name:"IEEE Transactions on Neural Networks and Learning Systems",publisher:"IEEE",quartile:"Q1",accessType:"Hybrid",apc:2150,impactFactor:10.4,indexing:["Scopus","IEEE Xplore","Web of Science","PubMed"],reviewTimeWeeks:"10-16",publicationTimeWeeks:"16-24",latexTemplateUrl:"https://template-selector.ieee.org/",homeUrl:"https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=5962385",domains:["Computer Science","Artificial Intelligence","Machine Learning"],sjrScore:3.2,keywords:["neural networks","learning systems","adaptive control","deep learning","supervised learning","system identification"],scopeText:"Focuses on the theory, design, and applications of neural networks and related learning systems including mathematical and algorithmic advances.",minRecommendedScore:80,methodologyFocus:["theoretical","experimental"]},{name:"IEEE Transactions on Image Processing",publisher:"IEEE",quartile:"Q1",accessType:"Hybrid",apc:2150,impactFactor:10.8,indexing:["Scopus","IEEE Xplore","Web of Science"],reviewTimeWeeks:"10-15",publicationTimeWeeks:"16-22",latexTemplateUrl:"https://template-selector.ieee.org/",homeUrl:"https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=83",domains:["Computer Science","Computer Vision","Signal Processing"],sjrScore:2.9,keywords:["image processing","image restoration","compression","reconstruction","filtering","segmentation","video analysis"],scopeText:"Covers novel theories, algorithms, and architectures for image and video processing, sensing, representation, and restoration.",minRecommendedScore:78,methodologyFocus:["experimental","theoretical","quantitative"]},{name:"Artificial Intelligence Journal",publisher:"Elsevier",quartile:"Q1",accessType:"Hybrid",apc:2950,impactFactor:7.5,indexing:["Scopus","Web of Science","DBLP"],reviewTimeWeeks:"12-20",publicationTimeWeeks:"18-26",latexTemplateUrl:"https://www.elsevier.com/journals/artificial-intelligence/0004-3702/guide-for-authors",homeUrl:"https://www.sciencedirect.com/journal/artificial-intelligence",domains:["Computer Science","Artificial Intelligence"],sjrScore:2.7,keywords:["artificial intelligence","knowledge representation","planning","heuristics","automated reasoning","natural language understanding"],scopeText:"Welcomes articles on broad aspects of artificial intelligence, including classical reasoning, search algorithms, multi-agent systems, and cognitive models.",minRecommendedScore:80,methodologyFocus:["theoretical","algorithmic"]},{name:"ACM Transactions on Graphics",publisher:"ACM",quartile:"Q1",accessType:"Hybrid",apc:1700,impactFactor:6.2,indexing:["Scopus","ACM Digital Library","Web of Science"],reviewTimeWeeks:"12-16",publicationTimeWeeks:"16-24",latexTemplateUrl:"https://www.acm.org/publications/authors/templates",homeUrl:"https://dl.acm.org/journal/tog",domains:["Computer Science","Computer Graphics","Computer Vision"],sjrScore:4.8,keywords:["computer graphics","rendering","physical simulation","geometric modeling","animation","computational photography"],scopeText:"The premier journal in computer graphics, covering visual computing, animation, rendering, modeling, and digital art techniques.",minRecommendedScore:85,methodologyFocus:["experimental","theoretical","computational"]},{name:"The Lancet",publisher:"Elsevier",quartile:"Q1",accessType:"Hybrid",apc:5e3,impactFactor:168.9,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"2-4",publicationTimeWeeks:"4-8",latexTemplateUrl:"https://www.thelancet.com/journals/lancet/information-for-authors",homeUrl:"https://www.thelancet.com/",domains:["Medicine","Public Health"],sjrScore:20.1,keywords:["clinical trials","global health","epidemiology","infectious diseases","oncology","public health policy"],scopeText:"Publishes high-impact medical research, clinical trials, reviews, and opinion pieces affecting global human health and medicine.",minRecommendedScore:92,methodologyFocus:["clinical-trial","quantitative","epidemiological"]},{name:"New England Journal of Medicine",publisher:"Massachusetts Medical Society",quartile:"Q1",accessType:"Hybrid",apc:3500,impactFactor:158.5,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"2-3",publicationTimeWeeks:"3-6",latexTemplateUrl:"https://www.nejm.org/author-center",homeUrl:"https://www.nejm.org/",domains:["Medicine","Clinical Medicine"],sjrScore:25.4,keywords:["clinical trial","cardiology","oncology","immunology","pediatrics","internal medicine"],scopeText:"Provides high-quality, peer-reviewed clinical research and editorial opinions to the global medical community.",minRecommendedScore:95,methodologyFocus:["clinical-trial","randomized-control","observational"]},{name:"JAMA: Journal of the American Medical Association",publisher:"American Medical Association",quartile:"Q1",accessType:"Hybrid",apc:3e3,impactFactor:120.7,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"3-5",publicationTimeWeeks:"6-10",latexTemplateUrl:"https://jamanetwork.com/journals/jama/pages/instructions-for-authors",homeUrl:"https://jamanetwork.com/journals/jama",domains:["Medicine","Public Health"],sjrScore:18.2,keywords:["internal medicine","clinical trials","health policy","epidemiology","preventive medicine"],scopeText:"Promotes the science and art of medicine and the betterment of public health through clinical research and reviews.",minRecommendedScore:90,methodologyFocus:["clinical-trial","meta-analysis","quantitative"]},{name:"The BMJ",publisher:"BMJ Group",quartile:"Q1",accessType:"Open Access",apc:4e3,impactFactor:93.3,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"4-6",publicationTimeWeeks:"6-12",latexTemplateUrl:"https://www.bmj.com/about-bmj/resources-authors",homeUrl:"https://www.bmj.com/",domains:["Medicine","Public Health","Clinical Medicine"],sjrScore:12.3,keywords:["evidence-based medicine","public health","primary care","epidemiology","clinical practice guidelines"],scopeText:"An open-access medical journal focusing on improving medical practice and health policies worldwide through clinical research.",minRecommendedScore:88,methodologyFocus:["clinical-trial","observational","qualitative"]},{name:"Annals of Internal Medicine",publisher:"American College of Physicians",quartile:"Q1",accessType:"Hybrid",apc:3500,impactFactor:39.2,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"4-8",publicationTimeWeeks:"8-12",latexTemplateUrl:"https://www.acponline.org/clinical-information/journals-publications/annals-of-internal-medicine/author-information",homeUrl:"https://www.acpjournals.org/journal/aim",domains:["Medicine","Clinical Medicine"],sjrScore:8.5,keywords:["internal medicine","cardiology","gastroenterology","endocrinology","pulmonology","clinical reviews"],scopeText:"Focuses on clinical research and practice updates in internal medicine and its subspecialties.",minRecommendedScore:85,methodologyFocus:["clinical-trial","quantitative","review"]},{name:"Lancet Public Health",publisher:"Elsevier",quartile:"Q1",accessType:"Open Access",apc:4500,impactFactor:50.2,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"3-5",publicationTimeWeeks:"6-10",latexTemplateUrl:"https://www.thelancet.com/journals/lanpub/information-for-authors",homeUrl:"https://www.thelancet.com/journals/lanpub/home",domains:["Medicine","Public Health"],sjrScore:11.2,keywords:["health equity","epidemiology","global health policies","health systems","environmental health"],scopeText:"Dedicated to publishing high-impact research, advocacy, and analyses that drive public health policies internationally.",minRecommendedScore:82,methodologyFocus:["epidemiological","quantitative","policy-analysis"]},{name:"Journal of Clinical Medicine",publisher:"MDPI",quartile:"Q2",accessType:"Open Access",apc:2600,impactFactor:3.9,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"3-4",publicationTimeWeeks:"4-6",latexTemplateUrl:"https://www.mdpi.com/journal/jcm/instructions",homeUrl:"https://www.mdpi.com/journal/jcm",domains:["Medicine","Clinical Medicine"],sjrScore:.9,keywords:["cardiology","neurology","orthopedics","oncology","clinical trials","diagnostics"],scopeText:"An international scientific open access journal providing a platform for advances in clinical medicine and diagnosis.",minRecommendedScore:60,methodologyFocus:["experimental","case-study","clinical-trial"]},{name:"PLOS Medicine",publisher:"PLOS",quartile:"Q1",accessType:"Open Access",apc:5300,impactFactor:15.8,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"6-8",publicationTimeWeeks:"8-14",latexTemplateUrl:"https://journals.plos.org/plosmedicine/s/submission-guidelines",homeUrl:"https://journals.plos.org/plosmedicine/",domains:["Medicine","Public Health"],sjrScore:4.8,keywords:["infectious diseases","cardiovascular health","maternal health","epidemiology","clinical trials"],scopeText:"Focuses on major global health issues, epidemiology, clinical trials, and medical interventions with a focus on open science.",minRecommendedScore:78,methodologyFocus:["epidemiological","clinical-trial","quantitative"]},{name:"BMC Medicine",publisher:"BioMed Central",quartile:"Q1",accessType:"Open Access",apc:3790,impactFactor:9.3,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"6-10",publicationTimeWeeks:"8-16",latexTemplateUrl:"https://bmcmedprinciples.biomedcentral.com/submission-guidelines",homeUrl:"https://bmcmedicine.biomedcentral.com/",domains:["Medicine","Clinical Medicine","Public Health"],sjrScore:2.8,keywords:["translational medicine","clinical trials","biomedical ethics","personalized medicine"],scopeText:"Publishes papers in all areas of clinical medicine, translational research, clinical trials, and public health policy.",minRecommendedScore:74,methodologyFocus:["experimental","clinical-trial","quantitative"]},{name:"Cell",publisher:"Cell Press",quartile:"Q1",accessType:"Hybrid",apc:9900,impactFactor:66.8,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"4-8",publicationTimeWeeks:"8-16",latexTemplateUrl:"https://www.cell.com/cell/authors",homeUrl:"https://www.cell.com/",domains:["Biology","Life Sciences","Biochemistry"],sjrScore:18.9,keywords:["cell biology","molecular biology","immunology","stem cells","neuroscience","cancer biology"],scopeText:"Publishes high-impact findings in molecular biology, cell biology, genetics, developmental biology, and immunology.",minRecommendedScore:92,methodologyFocus:["experimental","molecular-assay"]},{name:"Nature Biotechnology",publisher:"Nature Portfolio",quartile:"Q1",accessType:"Hybrid",apc:11e3,impactFactor:46.9,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"6-10",publicationTimeWeeks:"12-20",latexTemplateUrl:"https://www.nature.com/nbt/authors",homeUrl:"https://www.nature.com/nbt/",domains:["Biology","Life Sciences","Biotechnology","Genomics"],sjrScore:15.1,keywords:["biotechnology","gene editing","crispr","synthetic biology","nanotechnology","biomedical engineering"],scopeText:"Focuses on commercial, therapeutic, and industrial applications of biotechnology and genetic engineering.",minRecommendedScore:90,methodologyFocus:["experimental","applied","computational"]},{name:"Genome Biology",publisher:"BioMed Central",quartile:"Q1",accessType:"Open Access",apc:4390,impactFactor:12.3,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"6-8",publicationTimeWeeks:"8-12",latexTemplateUrl:"https://genomebiology.biomedcentral.com/submission-guidelines",homeUrl:"https://genomebiology.biomedcentral.com/",domains:["Biology","Genomics","Bioinformatics"],sjrScore:6.4,keywords:["genomics","transcriptomics","epigenomics","single-cell sequencing","bioinformatics","metagenomics"],scopeText:"Focuses on genomic and post-genomic biology, including sequencing tech, epigenetics, bioinformatics, and systems biology.",minRecommendedScore:82,methodologyFocus:["computational","experimental","data-analysis"]},{name:"Nucleic Acids Research",publisher:"Oxford University Press",quartile:"Q1",accessType:"Open Access",apc:3200,impactFactor:14.9,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"4-6",publicationTimeWeeks:"6-10",latexTemplateUrl:"https://academic.oup.com/nar/pages/General_Instructions",homeUrl:"https://academic.oup.com/nar",domains:["Biology","Biochemistry","Molecular Biology"],sjrScore:5.8,keywords:["rna","dna","chromatin","transcription","replication","computational biology"],scopeText:"Publishes research on the physical, chemical, and biological aspects of nucleic acids and proteins in nucleic acid metabolism.",minRecommendedScore:80,methodologyFocus:["experimental","computational","structural"]},{name:"Bioinformatics",publisher:"Oxford University Press",quartile:"Q1",accessType:"Hybrid",apc:3300,impactFactor:5.8,indexing:["PubMed","Scopus","Web of Science","DBLP"],reviewTimeWeeks:"6-10",publicationTimeWeeks:"10-14",latexTemplateUrl:"https://academic.oup.com/bioinformatics/pages/General_Instructions",homeUrl:"https://academic.oup.com/bioinformatics",domains:["Biology","Bioinformatics","Computer Science"],sjrScore:2.5,keywords:["sequence analysis","gene expression","phylogenetics","structural bioinformatics","databases","algorithms"],scopeText:"The leading journal for computational methods, software tools, and database developments in genetics, genomics, and molecular biology.",minRecommendedScore:75,methodologyFocus:["computational","software","algorithmic"]},{name:"PLOS Biology",publisher:"PLOS",quartile:"Q1",accessType:"Open Access",apc:4e3,impactFactor:9.8,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"6-8",publicationTimeWeeks:"10-14",latexTemplateUrl:"https://journals.plos.org/plosbiology/s/submission-guidelines",homeUrl:"https://journals.plos.org/plosbiology/",domains:["Biology","Life Sciences"],sjrScore:3.9,keywords:["ecology","evolution","neuroscience","microbiology","physiology","developmental biology"],scopeText:"Presents biological research across the whole spectrum of life sciences, emphasizing open data access and biological importance.",minRecommendedScore:78,methodologyFocus:["experimental","observational"]},{name:"Nature Genetics",publisher:"Nature Portfolio",quartile:"Q1",accessType:"Hybrid",apc:11e3,impactFactor:31.7,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"6-10",publicationTimeWeeks:"12-18",latexTemplateUrl:"https://www.nature.com/ng/authors",homeUrl:"https://www.nature.com/ng/",domains:["Biology","Genomics","Life Sciences"],sjrScore:12.8,keywords:["human genetics","disease association","gwas","functional genomics","population genetics"],scopeText:"Publishes high-impact research in genetics, genomics, and human hereditary disorders, including genome-wide association studies.",minRecommendedScore:88,methodologyFocus:["experimental","quantitative","statistical"]},{name:"Journal of Molecular Biology",publisher:"Elsevier",quartile:"Q1",accessType:"Hybrid",apc:3850,impactFactor:4.8,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"6-8",publicationTimeWeeks:"8-12",latexTemplateUrl:"https://www.elsevier.com/journals/journal-of-molecular-biology/0022-2836/guide-for-authors",homeUrl:"https://www.sciencedirect.com/journal/journal-of-molecular-biology",domains:["Biology","Molecular Biology","Biochemistry"],sjrScore:1.9,keywords:["macromolecular structure","protein folding","biophysics","structural biology","macromolecular complexes"],scopeText:"Focuses on providing a high-resolution molecular explanation for biological structures and mechanisms.",minRecommendedScore:72,methodologyFocus:["experimental","structural","biophysical"]},{name:"eLife",publisher:"eLife Sciences Publications",quartile:"Q1",accessType:"Open Access",apc:2e3,impactFactor:7.7,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"6-10",publicationTimeWeeks:"8-12",latexTemplateUrl:"https://reviewer.elifesciences.org/author-guide",homeUrl:"https://elifesciences.org/",domains:["Biology","Life Sciences","Medicine"],sjrScore:3.5,keywords:["evolutionary biology","neuroscience","cell biology","biophysics","developmental biology"],scopeText:"An open-access journal covering biology and biomedicine, using a unique public review process with detailed editor assessments.",minRecommendedScore:76,methodologyFocus:["experimental","multidisciplinary"]},{name:"Physical Review Letters",publisher:"American Physical Society",quartile:"Q1",accessType:"Hybrid",apc:2900,impactFactor:8.6,indexing:["Scopus","Web of Science"],reviewTimeWeeks:"4-6",publicationTimeWeeks:"6-10",latexTemplateUrl:"https://journals.aps.org/prl/authors",homeUrl:"https://journals.aps.org/prl/",domains:["Physics","General Science"],sjrScore:3.8,keywords:["quantum mechanics","condensed matter","astrophysics","elementary particles","statistical physics"],scopeText:"The premier international journal for short letters describing fundamental breakthroughs in all areas of physical sciences.",minRecommendedScore:82,methodologyFocus:["theoretical","experimental"]},{name:"Journal of the American Chemical Society",publisher:"American Chemical Society",quartile:"Q1",accessType:"Hybrid",apc:4e3,impactFactor:15,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"4-6",publicationTimeWeeks:"6-10",latexTemplateUrl:"https://publish.acs.org/publish/author_guidelines?coden=jacsub",homeUrl:"https://pubs.acs.org/journal/jacsub",domains:["Chemistry","General Science"],sjrScore:5.2,keywords:["organic chemistry","inorganic chemistry","biochemistry","materials chemistry","catalysis","spectroscopy"],scopeText:"Publishes top-tier research across the entire field of chemistry, including synthesis, materials, and biochemical mechanisms.",minRecommendedScore:85,methodologyFocus:["experimental","synthesis","characterization"]},{name:"Angewandte Chemie International Edition",publisher:"Wiley-VCH",quartile:"Q1",accessType:"Hybrid",apc:4500,impactFactor:16.6,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"4-6",publicationTimeWeeks:"6-10",latexTemplateUrl:"https://onlinelibrary.wiley.com/page/journal/15213773/homepage/author-guidelines",homeUrl:"https://onlinelibrary.wiley.com/journal/15213773",domains:["Chemistry","Materials Science"],sjrScore:5.1,keywords:["supramolecular chemistry","catalysis","materials science","nanotechnology","medicinal chemistry"],scopeText:"One of the prime chemistry journals in the world, publishing reviews, communications, and research articles.",minRecommendedScore:84,methodologyFocus:["experimental","synthesis","applied"]},{name:"Advanced Materials",publisher:"Wiley-VCH",quartile:"Q1",accessType:"Hybrid",apc:5e3,impactFactor:29.4,indexing:["Scopus","Web of Science"],reviewTimeWeeks:"6-8",publicationTimeWeeks:"8-12",latexTemplateUrl:"https://onlinelibrary.wiley.com/page/journal/15214095/homepage/author-guidelines",homeUrl:"https://onlinelibrary.wiley.com/journal/15214095",domains:["Materials Science","Physics","Chemistry"],sjrScore:8.2,keywords:["nanomaterials","energy materials","semiconductors","biomaterials","polymers","thin films"],scopeText:"Covers high-impact research in functional materials, nanotechnology, energy storage, and structural engineering.",minRecommendedScore:88,methodologyFocus:["experimental","characterization","applied"]},{name:"Nature Materials",publisher:"Nature Portfolio",quartile:"Q1",accessType:"Hybrid",apc:11e3,impactFactor:41.2,indexing:["Scopus","Web of Science"],reviewTimeWeeks:"6-10",publicationTimeWeeks:"12-20",latexTemplateUrl:"https://www.nature.com/nmat/authors",homeUrl:"https://www.nature.com/nmat/",domains:["Materials Science","Physics","Chemistry"],sjrScore:14.5,keywords:["solid-state physics","materials engineering","superconductivity","structural materials","soft matter"],scopeText:"Presents high-impact research in all areas of materials science, focusing on mechanical, electrical, and optical material properties.",minRecommendedScore:92,methodologyFocus:["experimental","theoretical","characterization"]},{name:"Nature Physics",publisher:"Nature Portfolio",quartile:"Q1",accessType:"Hybrid",apc:11e3,impactFactor:19.6,indexing:["Scopus","Web of Science"],reviewTimeWeeks:"6-8",publicationTimeWeeks:"12-18",latexTemplateUrl:"https://www.nature.com/nphys/authors",homeUrl:"https://www.nature.com/nphys/",domains:["Physics"],sjrScore:8.8,keywords:["quantum computation","astrophysics","thermodynamics","condensed matter physics","optics"],scopeText:"Publishes top research across all aspects of physics, both pure and applied, including quantum and relativity theories.",minRecommendedScore:92,methodologyFocus:["theoretical","experimental"]},{name:"Nature Chemistry",publisher:"Nature Portfolio",quartile:"Q1",accessType:"Hybrid",apc:11e3,impactFactor:20.8,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"6-8",publicationTimeWeeks:"12-18",latexTemplateUrl:"https://www.nature.com/nchem/authors",homeUrl:"https://www.nature.com/nchem/",domains:["Chemistry"],sjrScore:7.9,keywords:["synthetic chemistry","chemical biology","catalyst design","computational chemistry","materials science"],scopeText:"Publishes high-impact chemistry research, from physical chemistry and organometallics to chemical biology and green chemistry.",minRecommendedScore:92,methodologyFocus:["experimental","theoretical","synthesis"]},{name:"Chemical Science",publisher:"Royal Society of Chemistry",quartile:"Q1",accessType:"Open Access",apc:0,impactFactor:8.4,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"5-7",publicationTimeWeeks:"8-12",latexTemplateUrl:"https://www.rsc.org/journals-books-databases/journal-authors-reviewers/author-templates/",homeUrl:"https://www.rsc.org/journals-books-databases/about-journals/chemical-science/",domains:["Chemistry"],sjrScore:2.8,keywords:["chemical biology","computational chemistry","materials science","sustainable chemistry","catalysis"],scopeText:"The flagship open-access journal of the Royal Society of Chemistry, publishing high-quality findings across the chemical sciences.",minRecommendedScore:78,methodologyFocus:["experimental","theoretical","synthesis"]},{name:"Journal of Chemical Physics",publisher:"AIP Publishing",quartile:"Q1",accessType:"Hybrid",apc:3500,impactFactor:4.4,indexing:["Scopus","Web of Science"],reviewTimeWeeks:"4-6",publicationTimeWeeks:"6-10",latexTemplateUrl:"https://publishing.aip.org/resources/researchers/templates-and-guidelines/",homeUrl:"https://aip.scitation.org/journal/jcp",domains:["Physics","Chemistry"],sjrScore:1.3,keywords:["spectroscopy","statistical mechanics","molecular dynamics","quantum chemistry","chemical kinetics"],scopeText:"Focuses on the physical principles underlying chemistry, including spectroscopy, thermodynamics, and molecular mechanics.",minRecommendedScore:70,methodologyFocus:["theoretical","computational","experimental"]},{name:"Nature",publisher:"Nature Portfolio",quartile:"Q1",accessType:"Hybrid",apc:11e3,impactFactor:64.8,indexing:["Scopus","Web of Science","PubMed"],reviewTimeWeeks:"4-12",publicationTimeWeeks:"12-24",latexTemplateUrl:"https://www.nature.com/nature/for-authors/formatting-guide",homeUrl:"https://www.nature.com/",domains:["Multidisciplinary","Science","Biology","Physics","Chemistry","Medicine"],sjrScore:16.5,keywords:["multidisciplinary","science","biology","physics","climate change","breakthrough"],scopeText:"One of the world's premier weekly multidisciplinary science journals, publishing highly significant original research across all fields.",minRecommendedScore:92,methodologyFocus:["experimental","theoretical","quantitative"]},{name:"Science",publisher:"AAAS",quartile:"Q1",accessType:"Hybrid",apc:4500,impactFactor:56.9,indexing:["Scopus","Web of Science","PubMed"],reviewTimeWeeks:"4-8",publicationTimeWeeks:"10-20",latexTemplateUrl:"https://www.science.org/content/page/instructions-preparing-manuscript",homeUrl:"https://www.science.org/",domains:["Multidisciplinary","Science","Biology","Chemistry","Physics"],sjrScore:14.2,keywords:["multidisciplinary","science","genetics","climate","archaeology","paleontology"],scopeText:"Publishes peer-reviewed scientific advancements, research reports, and commentary across all scientific fields.",minRecommendedScore:92,methodologyFocus:["experimental","theoretical","observational"]},{name:"Proceedings of the National Academy of Sciences",publisher:"National Academy of Sciences",quartile:"Q1",accessType:"Hybrid",apc:2500,impactFactor:11.1,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"4-6",publicationTimeWeeks:"6-10",latexTemplateUrl:"https://www.pnas.org/author-center/submitting-your-manuscript",homeUrl:"https://www.pnas.org/",domains:["Multidisciplinary","Science"],sjrScore:4.9,keywords:["biological sciences","physical sciences","social sciences","mathematics","environmental sciences"],scopeText:"One of the world's most-cited multidisciplinary scientific journals, publishing research reports, reviews, and academy proceedings.",minRecommendedScore:84,methodologyFocus:["experimental","quantitative","theoretical"]},{name:"Nature Communications",publisher:"Nature Portfolio",quartile:"Q1",accessType:"Open Access",apc:6790,impactFactor:16.6,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"6-8",publicationTimeWeeks:"8-12",latexTemplateUrl:"https://www.nature.com/ncomms/authors",homeUrl:"https://www.nature.com/ncomms/",domains:["Multidisciplinary","Science","Biology","Chemistry","Physics","Earth Science"],sjrScore:5.8,keywords:["biology","physics","chemistry","earth sciences","engineering","materials science"],scopeText:"An open-access journal publishing high-quality research from all areas of the natural sciences.",minRecommendedScore:80,methodologyFocus:["experimental","theoretical","quantitative"]},{name:"Science Advances",publisher:"AAAS",quartile:"Q1",accessType:"Open Access",apc:4500,impactFactor:13.6,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"6-8",publicationTimeWeeks:"10-14",latexTemplateUrl:"https://www.science.org/content/page/science-advances-information-authors",homeUrl:"https://www.science.org/journal/sciadv",domains:["Multidisciplinary","Science"],sjrScore:4.6,keywords:["multidisciplinary","genetics","nanotechnology","ecology","materials","robotics"],scopeText:"The digital-only, open-access extension of Science, covering all branches of science, engineering, and medicine.",minRecommendedScore:78,methodologyFocus:["experimental","observational","theoretical"]},{name:"Scientific Reports",publisher:"Nature Portfolio",quartile:"Q1",accessType:"Open Access",apc:2490,impactFactor:4.6,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"6-8",publicationTimeWeeks:"8-10",latexTemplateUrl:"https://www.nature.com/srep/author-instructions",homeUrl:"https://www.nature.com/srep/",domains:["Multidisciplinary","Science","Engineering"],sjrScore:1,keywords:["applied physics","clinical medicine","materials science","molecular biology","psychology"],scopeText:"An open access journal publishing original research from all areas of the natural and clinical sciences, focused on methodological validity.",minRecommendedScore:55,methodologyFocus:["experimental","applied","reproducible-science"]},{name:"PLOS ONE",publisher:"PLOS",quartile:"Q1",accessType:"Open Access",apc:2100,impactFactor:3.7,indexing:["PubMed","Scopus","Web of Science"],reviewTimeWeeks:"5-8",publicationTimeWeeks:"8-12",latexTemplateUrl:"https://journals.plos.org/plosone/s/submission-guidelines",homeUrl:"https://journals.plos.org/plosone/",domains:["Multidisciplinary","Science"],sjrScore:.8,keywords:["biology","medicine","social sciences","physics","chemistry","computer science"],scopeText:"Accepts research in over 200 subject areas, evaluating papers strictly on technical and methodological rigor rather than novelty.",minRecommendedScore:50,methodologyFocus:["experimental","reproducible-science","descriptive"]},{name:"IEEE Transactions on Robotics",publisher:"IEEE",quartile:"Q1",accessType:"Hybrid",apc:2150,impactFactor:7.7,indexing:["Scopus","IEEE Xplore","Web of Science"],reviewTimeWeeks:"10-14",publicationTimeWeeks:"16-24",latexTemplateUrl:"https://template-selector.ieee.org/",homeUrl:"https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=8860",domains:["Engineering","Robotics","Automation"],sjrScore:3.1,keywords:["robotics","automation","sensors","kinematics","computer vision","control algorithms"],scopeText:"Focuses on the theory, design, and analysis of robot kinematics, dynamics, control, and sensory-motor systems.",minRecommendedScore:80,methodologyFocus:["experimental","algorithmic","theoretical"]},{name:"International Journal of Robotics Research",publisher:"SAGE Publishing",quartile:"Q1",accessType:"Hybrid",apc:3200,impactFactor:9.2,indexing:["Scopus","Web of Science"],reviewTimeWeeks:"12-16",publicationTimeWeeks:"16-24",latexTemplateUrl:"https://journals.sagepub.com/author-instructions/IJR",homeUrl:"https://journals.sagepub.com/home/ijr",domains:["Engineering","Robotics"],sjrScore:4.2,keywords:["robotics","navigation","legged robots","manipulation","planning algorithms","sensor fusion"],scopeText:"The first scholarly journal in robotics, publishing cutting-edge papers on algorithmic and hardware implementations.",minRecommendedScore:85,methodologyFocus:["experimental","theoretical","applied"]},{name:"IEEE Transactions on Signal Processing",publisher:"IEEE",quartile:"Q1",accessType:"Hybrid",apc:2150,impactFactor:5.4,indexing:["Scopus","IEEE Xplore","Web of Science"],reviewTimeWeeks:"8-12",publicationTimeWeeks:"14-20",latexTemplateUrl:"https://template-selector.ieee.org/",homeUrl:"https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=78",domains:["Engineering","Signal Processing","Electrical Engineering"],sjrScore:2.1,keywords:["signal processing","statistical estimation","filter design","sensor arrays","spectral analysis","wavelets"],scopeText:"Covers novel mathematical theories, algorithms, and applications of digital signal and data processing.",minRecommendedScore:78,methodologyFocus:["theoretical","algorithmic","experimental"]},{name:"IEEE/ASME Transactions on Mechatronics",publisher:"IEEE",quartile:"Q1",accessType:"Hybrid",apc:2150,impactFactor:6.4,indexing:["Scopus","IEEE Xplore","Web of Science"],reviewTimeWeeks:"8-12",publicationTimeWeeks:"12-18",latexTemplateUrl:"https://template-selector.ieee.org/",homeUrl:"https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=3516",domains:["Engineering","Mechatronics","Mechanical Engineering"],sjrScore:1.9,keywords:["mechatronics","control systems","actuators","sensors","micro-electromechanical systems","automotive engineering"],scopeText:"Presents synergy in mechatronic designs combining mechanical, electrical, and control system components.",minRecommendedScore:76,methodologyFocus:["applied","experimental","applied-engineering"]},{name:"Automatica",publisher:"Elsevier",quartile:"Q1",accessType:"Hybrid",apc:3300,impactFactor:6.2,indexing:["Scopus","Web of Science"],reviewTimeWeeks:"10-14",publicationTimeWeeks:"14-20",latexTemplateUrl:"https://www.elsevier.com/journals/automatica/0005-1098/guide-for-authors",homeUrl:"https://www.sciencedirect.com/journal/automatica",domains:["Engineering","Control Theory","Automation"],sjrScore:3.4,keywords:["control theory","linear systems","nonlinear control","state estimation","adaptive control","systems theory"],scopeText:"Publishes papers on control theory and applications, covering system modeling, simulation, and feedback design.",minRecommendedScore:82,methodologyFocus:["theoretical","applied"]},{name:"Signal Processing",publisher:"Elsevier",quartile:"Q1",accessType:"Hybrid",apc:2900,impactFactor:4.4,indexing:["Scopus","Web of Science"],reviewTimeWeeks:"8-10",publicationTimeWeeks:"10-14",latexTemplateUrl:"https://www.elsevier.com/journals/signal-processing/0165-1684/guide-for-authors",homeUrl:"https://www.sciencedirect.com/journal/signal-processing",domains:["Engineering","Signal Processing"],sjrScore:1.4,keywords:["signal analysis","image processing","radar signal processing","audio processing","compressive sensing"],scopeText:"Focuses on signal processing algorithms, hardware structures, and systems designed for communication and diagnostics.",minRecommendedScore:70,methodologyFocus:["experimental","applied","theoretical"]},{name:"Robotics and Computer-Integrated Manufacturing",publisher:"Elsevier",quartile:"Q1",accessType:"Hybrid",apc:3450,impactFactor:10.4,indexing:["Scopus","Web of Science"],reviewTimeWeeks:"8-12",publicationTimeWeeks:"12-16",latexTemplateUrl:"https://www.elsevier.com/journals/robotics-and-computer-integrated-manufacturing/0736-5845/guide-for-authors",homeUrl:"https://www.sciencedirect.com/journal/robotics-and-computer-integrated-manufacturing",domains:["Engineering","Robotics","Manufacturing"],sjrScore:2.7,keywords:["flexible manufacturing","industrial robots","machining","cad/cam","assembly automation"],scopeText:"Focuses on user-oriented research in robotics and computer-integrated systems applied to manufacturing.",minRecommendedScore:75,methodologyFocus:["applied","experimental"]},{name:"IEEE Transactions on Control Systems Technology",publisher:"IEEE",quartile:"Q1",accessType:"Hybrid",apc:2150,impactFactor:4.9,indexing:["Scopus","IEEE Xplore","Web of Science"],reviewTimeWeeks:"8-12",publicationTimeWeeks:"12-18",latexTemplateUrl:"https://template-selector.ieee.org/",homeUrl:"https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=87",domains:["Engineering","Control Systems","Applied Control"],sjrScore:1.8,keywords:["industrial control","aerospace control","process control","robotics control","sensors and actuators"],scopeText:"Focuses on the application of control theory to engineering systems, emphasizing industrial relevance and engineering detail.",minRecommendedScore:72,methodologyFocus:["applied","experimental"]}]},76680:(a,b,c)=>{c.d(b,{Ww:()=>i,dT:()=>h,vp:()=>g});var d=c(93061);let e={rules:[],fetchedAt:0};async function f(){let a=Date.now();return e.rules.length>0&&a-e.fetchedAt<1e4||(e.rules=(await d.prisma.aiCapRule.findMany({where:{isActive:!0},orderBy:{priority:"asc"}})).map(a=>({...a,_compiledRegex:"email_regex"===a.matchType?RegExp(a.matchValue,"i"):void 0})),e.fetchedAt=a),e.rules}function g(){e.rules=[],e.fetchedAt=0}async function h(a){let b=await f();if(0===b.length)return null;let c=a.email?.toLowerCase(),e=a.ipAddress,g=(a.location||"").toLowerCase(),h=(a.country||"").toLowerCase();for(let f of b){let b=!1;switch(f.matchType){case"all_users":b=!0;break;case"email_exact":c&&(b=c===f.matchValue.toLowerCase());break;case"email_domain":if(c){let a=f.matchValue.startsWith("@")?f.matchValue:`@${f.matchValue}`;b=c.endsWith(a.toLowerCase())}break;case"email_regex":c&&f._compiledRegex&&(b=f._compiledRegex.test(c));break;case"ip_exact":e&&(b=e===f.matchValue);break;case"ip_cidr":e&&(b=function(a,b,c){switch(c){case"ip_exact":return b===a;case"ip_cidr":try{let[c,d]=a.split("/"),e=parseInt(d,10);if(!e||e<0||e>32)return!1;let f=b.split(".").reduce((a,b)=>(a<<8)+parseInt(b,10),0),g=c.split(".").reduce((a,b)=>(a<<8)+parseInt(b,10),0),h=~(2**(32-e)-1);return(f&h)==(g&h)}catch{return!1}default:return!1}}(f.matchValue,e,f.matchType));break;case"location_country":b=h===f.matchValue.toLowerCase()||h.startsWith(f.matchValue.toLowerCase());break;case"location_city":b=g.includes(f.matchValue.toLowerCase())}if(b){if(f.agentFilter&&"*"!==f.agentFilter&&a.agent)try{if(!JSON.parse(f.agentFilter).includes(a.agent))continue}catch{continue}return d.prisma.aiCapRule.update({where:{id:f.id},data:{hitCount:{increment:1},lastHitAt:new Date}}).catch(()=>{}),{matched:!0,ruleId:f.id,ruleName:f.name,capType:f.capType,capValue:f.capValue,agentFilter:f.agentFilter}}}return null}async function i(a,b){try{let c=await h(b);if(!c||!c.matched)return{capped:!1,ruleMatched:!1};let e=new Date().toISOString().slice(0,10);if("block"===c.capType){let b=void 0!==c.capValue&&c.capValue>0?c.capValue:72e5,e=new Date(Date.now()+b);return await d.prisma.user.update({where:{id:a},data:{aiAgentReactivatesAt:e}}),{capped:!0,ruleMatched:!0,ruleName:c.ruleName,reason:`Matched cap rule: ${c.ruleName}`}}if("daily_tokens"===c.capType||"daily_requests"===c.capType){let b=c.capValue??0,f="daily_tokens"===c.capType?{totalTokens:!0}:{requestCount:!0},g=await d.prisma.aiUsageDailySummary.findUnique({where:{userId_date:{userId:a,date:e}},select:f}),h="daily_tokens"===c.capType?g?.totalTokens??0:g?.requestCount??0,i=Math.max(0,b-h);if(h>=b){let a="daily_tokens"===c.capType?`Token cap (${b}/day) from rule: ${c.ruleName}`:`Request cap (${b}/day) from rule: ${c.ruleName}`,d="daily_tokens"===c.capType?"dailyCapOverride":"requestCapOverride";return{capped:!0,ruleMatched:!0,ruleName:c.ruleName,reason:a,[d]:b,remaining:0}}let j="daily_tokens"===c.capType?"dailyCapOverride":"requestCapOverride";return{capped:!1,ruleMatched:!0,ruleName:c.ruleName,[j]:b,remaining:i}}return{capped:!1,ruleMatched:!0,ruleName:c.ruleName}}catch(a){return console.warn("[AiCapRules] Error enforcing rules:",a),{capped:!1,ruleMatched:!1}}}}};