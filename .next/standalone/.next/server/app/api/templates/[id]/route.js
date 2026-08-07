(()=>{var a={};a.id=1099,a.ids=[1099,1480,9099],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},14985:a=>{"use strict";a.exports=require("dns")},21820:a=>{"use strict";a.exports=require("os")},27910:a=>{"use strict";a.exports=require("stream")},28354:a=>{"use strict";a.exports=require("util")},29021:a=>{"use strict";a.exports=require("fs")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{"use strict";a.exports=require("path")},41480:(a,b,c)=>{"use strict";c.r(b),c.d(b,{PB_URL:()=>f,authFromToken:()=>j,clearAdminCache:()=>m,createPb:()=>g,isPocketBaseReachable:()=>o,mapList:()=>t,mapRecord:()=>s,pbAdmin:()=>p,refreshAdminAuth:()=>n});var d=c(31204);let e=process.env.POCKETBASE_URL||"http://127.0.0.1:8090",f=e.includes("localhost")?e.replace("localhost","127.0.0.1"):e;function g(){return new d.Ay(f)}let h=new Map,i=new Map;async function j(a){let b=Date.now();if(h.size>1e3)for(let[a,c]of h.entries())c.expiry<b&&h.delete(a);let e=new d.Ay(f),g=h.get(a);if(g&&g.expiry>b&&g.record)return Object.defineProperty(e.authStore,"isTokenExpired",{get:()=>!1,configurable:!0}),Object.defineProperty(e.authStore,"isValid",{get:()=>!!e.authStore.token,configurable:!0}),e.authStore.save(a,g.record),e;try{let{prisma:d}=await c.e(3061).then(c.bind(c,93061)),f=await d.userSession.findUnique({where:{sessionToken:a},include:{user:!0}}).catch(()=>null);if(f&&f.user&&new Date(f.expiresAt).getTime()>b){let c=f.user,d={id:c.id,email:c.email,name:c.name||c.email.split("@")[0]||"",avatar:c.avatar,theme:c.theme||"dark",points:c.points??50,membership:c.membership||"free",role:c.role||"user"};return h.set(a,{record:d,expiry:b+6e4}),Object.defineProperty(e.authStore,"isTokenExpired",{get:()=>!1,configurable:!0}),Object.defineProperty(e.authStore,"isValid",{get:()=>!!e.authStore.token,configurable:!0}),e.authStore.save(a,d),e}}catch(a){console.warn("[PB System] authFromToken database lookup failed, falling back to PB:",a)}let j=i.get(a);if(!j){let b=new d.Ay(f);Object.defineProperty(b.authStore,"isTokenExpired",{get:()=>!1,configurable:!0}),Object.defineProperty(b.authStore,"isValid",{get:()=>!!b.authStore.token,configurable:!0}),b.authStore.save(a,null),j=(async()=>{try{let c=(await b.collection("users").authRefresh({requestKey:null,fetch:(a,b)=>fetch(a,{...b,signal:AbortSignal.timeout(5e3)})})).record;return h.set(a,{record:c,expiry:Date.now()+6e4}),c}catch(a){throw a?.status===401?console.log("[PB System] Token is invalid or expired (401)"):console.warn("[PB System] authRefresh failed for token:",a?.name==="TimeoutError"||a?.name==="AbortError"?"Request timed out":a?.message||String(a)),a}finally{i.delete(a)}})(),i.set(a,j)}try{let b=await j;Object.defineProperty(e.authStore,"isTokenExpired",{get:()=>!1,configurable:!0}),Object.defineProperty(e.authStore,"isValid",{get:()=>!!e.authStore.token,configurable:!0}),e.authStore.save(a,b)}catch(c){let b=c?.status;400===b||401===b?e.authStore.clear():(console.warn("[PB System] authRefresh failed with transient/network error. Keeping token.",c?.message||c),Object.defineProperty(e.authStore,"isTokenExpired",{get:()=>!1,configurable:!0}),Object.defineProperty(e.authStore,"isValid",{get:()=>!!e.authStore.token,configurable:!0}),e.authStore.save(a,null))}return e}let k=null,l=null;function m(){k=null,l=null}async function n(){return m(),p()}async function o(){try{return(await fetch(f+"/api/health",{method:"GET",signal:AbortSignal.timeout(3e3)})).ok}catch{return!1}}async function p(){if(k)if(k.authStore.isValid)try{return await k.collection("_superusers").authRefresh(),k}catch{k.authStore.clear(),k=null,l=null}else k=null,l=null;let a=await o();if(!a)try{let{ensureAndStartPocketBase:b}=await c.e(8113).then(c.bind(c,18113));await b(),a=await o()}catch{}if(a);else throw Date.now(),Error("PocketBase is unreachable");if(l)return l;let b=new d.Ay(f),{email:e,password:g}=function(){let a="admin@latexify.io",b="Sczone@123";try{{let d=c(29021),e=c(33873),f=process.env.PB_DATA_DIR||e.join(process.cwd(),"pb_data");for(let c of[e.join(f,"admin_creds.json"),e.join(process.cwd(),"admin_creds.json")])if(d.existsSync(c)){let e=JSON.parse(d.readFileSync(c,"utf8"));return e.email&&(a=e.email),e.password&&(b=e.password),{email:a,password:b}}}}catch(a){}let d=process.env.POCKETBASE_ADMIN_EMAIL,e=process.env.POCKETBASE_ADMIN_PASSWORD;return d&&(a=d),e&&("admin123456"===e&&(e=void 0),e&&(b=e)),{email:a,password:b}}();try{let a=c(29021),d=c(33873),f=process.env.PB_DATA_DIR||d.join(process.cwd(),"pb_data"),g=d.join(f,"admin_token.json");if(a.existsSync(g)){let c=JSON.parse(a.readFileSync(g,"utf8"));if(c.token&&c.model&&c.email===e){let d=JSON.parse(function(a){let b=a.replace(/-/g,"+").replace(/_/g,"/");for(;b.length%4;)b+="=";return atob(b)}(c.token.split(".")[1])),e=Date.now();if(d.exp&&1e3*d.exp>e){b.authStore.save(c.token,c.model);try{return await b.collection("_superusers").authRefresh(),k=b,b}catch{b.authStore.clear();try{a.unlinkSync(g)}catch{}}}}}}catch{}return l=(async()=>{await b.collection("_superusers").authWithPassword(e,g);try{let a=c(21820),d=c(33873),f=c(29021),g=d.join(a.tmpdir(),"rp1_admin_token.json");f.mkdirSync(d.dirname(g),{recursive:!0}),f.writeFileSync(g,JSON.stringify({token:b.authStore.token,model:b.authStore.record,email:e},null,2))}catch{}return k=b,l=null,b})().catch(a=>{throw l=null,Date.now(),a})}let q={userId:"user",aiCapPlanId:"aiCapPlan"};function r(a){if("string"==typeof a&&a.length>=10&&(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(a)||/^\d{4}-\d{2}-\d{2}$/.test(a))){let b=new Date(a.replace(" ","T"));if(!isNaN(b.getTime()))return b}return a}function s(a){if(!a)return null;let b={id:a.id};for(let c of(b.createdAt=a.created?r(a.created):a.updated?r(a.updated):new Date,b.updatedAt=a.updated?r(a.updated):b.createdAt,Object.keys(a)))if(!["id","collectionId","collectionName","created","updated","expand"].includes(c)){let d=a[c];null===d||"object"!=typeof d||Array.isArray(d)||d instanceof Date?b[c]=r(d):b[c]=JSON.stringify(d)}if(a.expand&&"object"==typeof a.expand)for(let[c,d]of Object.entries(a.expand))b[q[c]||c]=Array.isArray(d)?d.map(s):s(d);return void 0===b.collaborators&&(b.collaborators=[]),void 0===b.files&&(b.files=[]),b}function t(a){return a.map(a=>s(a))}},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},74650:a=>{"use strict";a.exports=require("adm-zip")},78335:()=>{},79428:a=>{"use strict";a.exports=require("buffer")},79646:a=>{"use strict";a.exports=require("child_process")},79658:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>L,patchFetch:()=>K,routeModule:()=>G,serverHooks:()=>J,workAsyncStorage:()=>H,workUnitAsyncStorage:()=>I});var d={};c.r(d),c.d(d,{GET:()=>F});var e=c(19225),f=c(84006),g=c(8317),h=c(99373),i=c(34775),j=c(24235),k=c(261),l=c(54365),m=c(90771),n=c(73461),o=c(67798),p=c(92280),q=c(62018),r=c(45696),s=c(47929),t=c(86439),u=c(37527),v=c(23211),w=c(93061);let x={blank:`\\documentclass{article}
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
`};var y=c(1982),z=c(29021),A=c.n(z),B=c(33873),C=c.n(B);let D=`
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\usepackage{booktabs,multirow,array,tabularx}
\\usepackage[export]{adjustbox}
\\usepackage{caption,float}
\\usepackage{url}
\\usepackage{hyperref}
\\graphicspath{{./}{MIGRATION FILES/}}
`,E={article_ieee:`\\documentclass[journal]{IEEEtran}
${D}
\\usepackage{cite}

\\begin{document}
\\title{Manuscript Title}
\\author{Author Name}

\\IEEEtitleabstractindextext{
\\begin{abstract}
Your migrated abstract will appear here.
\\end{abstract}
\\begin{IEEEkeywords}
Keywords
\\end{IEEEkeywords}
}

\\maketitle

\\section{Introduction}
Introduction placeholder.

\\bibliographystyle{IEEEtran}
\\bibliography{references}
\\end{document}`,article_acm:`\\documentclass[sigconf]{acmart}
${D}

\\begin{document}
\\title{Manuscript Title}
\\author{Author Name}
\\affiliation{\\institution{Institution}}

\\begin{abstract}
Your migrated abstract will appear here.
\\end{abstract}

\\keywords{keywords}

\\maketitle

\\section{Introduction}
Introduction placeholder.

\\bibliographystyle{ACM-Reference-Format}
\\bibliography{references}
\\end{document}`,article_elsevier:`\\documentclass[preprint,12pt]{elsarticle}
${D}

\\begin{document}
\\begin{frontmatter}
\\title{Manuscript Title}
\\author{Author Name}
\\address{Institution}

\\begin{abstract}
Your migrated abstract will appear here.
\\end{abstract}

\\begin{keyword}
keywords
\\end{keyword}
\\end{frontmatter}

\\section{Introduction}
Introduction placeholder.

\\bibliographystyle{elsarticle-num}
\\bibliography{references}
\\end{document}`,article_lncs:`\\documentclass{llncs}
${D}

\\begin{document}
\\title{Manuscript Title}
\\author{Author Name}
\\institute{Institution}
\\maketitle

\\begin{abstract}
Your migrated abstract will appear here.
\\end{abstract}

\\section{Introduction}
Introduction placeholder.

\\bibliographystyle{splncs04}
\\bibliography{references}
\\end{document}`,article_scirep:`\\documentclass[fleqn,10pt]{wlscirep}
${D}

\\begin{document}
\\title{Manuscript Title}
\\author[1,*]{Author Name}
\\affil[1]{Institution}
\\maketitle

\\begin{abstract}
Your migrated abstract will appear here.
\\end{abstract}

\\section{Introduction}
Introduction placeholder.

\\bibliographystyle{naturemag}
\\bibliography{references}
\\end{document}`,article_mdpi:`\\documentclass[journal,article,submit,moreauthors,pdftex]{mdpi}
${D}

\\begin{document}
\\title{Manuscript Title}
\\author{Author Name}
\\abstract{Your migrated abstract will appear here.}
\\keyword{keywords}
\\maketitle

\\section{Introduction}
Introduction placeholder.

\\end{document}`,article_arxiv:`\\documentclass{article}
${D}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}

\\begin{document}
\\title{Manuscript Title}
\\author{Author Name}
\\date{\\today}
\\maketitle

\\begin{abstract}
Your migrated abstract will appear here.
\\end{abstract}

\\section{Introduction}
Introduction placeholder.

\\bibliographystyle{plain}
\\bibliography{references}
\\end{document}`};async function F(a,{params:b}){try{let a=(await b).id,c=(0,y.mapLegacyTemplateId)(a),d=await w.prisma.template.findUnique({where:{id:c}});if(d)return v.NextResponse.json({id:c,content:d.templateContent,clsContent:d.clsContent,bstContent:d.bstContent,assetsJson:d.assetsJson});let e=y.TEMPLATE_REGISTRY.find(a=>a.id===c);if(e?.assetFolder){let a=C().join(process.cwd(),"src","assets","templates",e.assetFolder);if(A().existsSync(a)){let b=A().readdirSync(a),d="",e="",f="",g="",h=[];for(let c of b){let b=C().join(a,c);if(A().statSync(b).isDirectory())continue;let i=C().extname(c).toLowerCase();if(/^\.(png|jpg|jpeg|gif|pdf|eps|otf|ttf|woff|woff2)$/i.test(i)){let a=A().readFileSync(b),d=`data:application/octet-stream;base64,${a.toString("base64")}`;h.push({path:c,content:d})}else{let a=A().readFileSync(b,"utf8");h.push({path:c,content:a}),".tex"===i&&(c.includes("main")||c.includes("template")||!d)?d=a:".cls"===i?e=a:".bst"===i?f=a:".bib"===i&&(g=a)}}if(d||h.length>0)return v.NextResponse.json({id:c,content:d,clsContent:e,bstContent:f,bibContent:g,assets:h})}}let f=E[c];if(f)return v.NextResponse.json({id:c,content:f});let g=x[c];if(!g){if(c.startsWith("article_"))return v.NextResponse.json({id:c,content:E.article_arxiv});return v.NextResponse.json({error:"Template not found"},{status:404})}return v.NextResponse.json({id:c,content:g})}catch(a){return console.error("Failed to get template:",a),v.NextResponse.json({error:"Failed to load template"},{status:500})}}let G=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/templates/[id]/route",pathname:"/api/templates/[id]",filename:"route",bundlePath:"app/api/templates/[id]/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\Users\\MANUU\\OneDrive\\Desktop\\rp\\src\\app\\api\\templates\\[id]\\route.ts",nextConfigOutput:"standalone",userland:d,...{}}),{workAsyncStorage:H,workUnitAsyncStorage:I,serverHooks:J}=G;function K(){return(0,g.patchFetch)({workAsyncStorage:H,workUnitAsyncStorage:I})}async function L(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),G.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/templates/[id]/route";"/index"===d&&(d="/");let e=await G.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,params:v,nextConfig:w,parsedUrl:x,isDraftMode:y,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D,clientReferenceManifest:E,serverActionsManifest:F}=e,H=(0,k.normalizeAppPath)(d),I=!!(z.dynamicRoutes[H]||z.routes[D]),J=async()=>((null==A?void 0:A.render404)?await A.render404(a,b,x,!1):b.end("This page could not be found"),null);if(I&&!y){let a=!!z.routes[D],b=z.dynamicRoutes[H];if(b&&!1===b.fallback&&!a){if(w.adapterPath)return await J();throw new t.NoFallbackError}}let K=null;!I||G.isDev||y||(K="/index"===(K=D)?"/":K);let L=!0===G.isDev||!I,M=I&&!L;F&&E&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:E,serverActionsManifest:F});let N=a.method||"GET",O=(0,i.getTracer)(),P=O.getActiveScopeSpan(),Q=!!(null==A?void 0:A.isWrappedByNextServer),R=!!(0,h.getRequestMeta)(a,"minimalMode"),S=(0,h.getRequestMeta)(a,"incrementalCache")||await G.getIncrementalCache(a,w,z,R);null==S||S.resetRequestCache(),globalThis.__incrementalCache=S;let T={params:v,previewProps:z.preview,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:L,incrementalCache:S,cacheLifeProfiles:w.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>G.onRequestError(a,b,d,e,A)},sharedContext:{buildId:g}},U=new l.NodeNextRequest(a),V=new l.NodeNextResponse(b),W=m.NextRequestAdapter.fromNodeNextRequest(U,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>G.handle(W,T).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=O.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${N} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${N} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!R&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=T.renderOpts.fetchMetrics;let h=T.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=T.renderOpts.collectedTags;if(!I)return await (0,p.I)(U,V,d,T.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==T.renderOpts.collectedRevalidate&&!(T.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&T.renderOpts.collectedRevalidate,e=void 0===T.renderOpts.collectedExpire||T.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:T.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await G.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:B})},!1,A),b}},k=await G.handleResponse({req:a,nextConfig:w,cacheKey:K,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:R});if(!I)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});R||b.setHeader("x-nextjs-cache",B?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return R&&I||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(U,V,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};Q&&P?await h(P):(e=O.getActiveScopeSpan(),await O.withPropagatedContext(a.headers,()=>O.trace(n.BaseServerSpan.handleRequest,{spanName:`${N} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":N,"http.target":a.url}},h),void 0,!Q))}catch(b){if(b instanceof t.NoFallbackError||await G.onRequestError(a,b,{routerKind:"App Router",routePath:H,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:B})},!1,A),I)throw b;return await (0,p.I)(U,V,new Response(null,{status:500})),null}}},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},94735:a=>{"use strict";a.exports=require("events")},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[3445,1813,1204,3061,1982],()=>b(b.s=79658));module.exports=c})();