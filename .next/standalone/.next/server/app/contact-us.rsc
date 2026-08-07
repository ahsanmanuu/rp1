1:"$Sreact.fragment"
2:I[42593,["8500","static/chunks/8500-9b2f2e83408c75b0.js","5430","static/chunks/5430-4ff8cc0fe4d45064.js","5772","static/chunks/5772-14b50655e8775f58.js","5216","static/chunks/5216-6aee90211755a34f.js","8403","static/chunks/8403-2ef5052f4ca20ae3.js","7860","static/chunks/7860-159a5701f5672208.js","5480","static/chunks/5480-7956bbaef084f719.js","7814","static/chunks/7814-b917408d5f2699c3.js","2181","static/chunks/2181-d4617be5ade94fb3.js","7177","static/chunks/app/layout-253e2be2cc1b5357.js"],""]
8:I[27123,[],"default",1]
:HL["/_next/static/css/985b0c3c5c22f5de.css","style"]
:HL["/_next/static/css/13ae791db19d7f63.css","style"]
:HL["/fonts/material-symbols-outlined.woff2","font",{"crossOrigin":"anonymous","type":"font/woff2"}]
3:Tccd,
          (function(){
            var lastReload = 0;
            function isChunkError(e){
              var m = (e && (e.message || e.name || (e.reason && e.reason.message))) || '';
              return m.indexOf('Loading chunk') !== -1 || m.indexOf('Loading CSS') !== -1 || m.indexOf('ChunkLoadError') !== -1 || m.indexOf('Failed to fetch dynamically imported module') !== -1 || m.indexOf('ImportModuleError') !== -1;
            }
            function forceReload(){
              var now = Date.now();
              if (now - lastReload < 20000) return;
              lastReload = now;
              setTimeout(function(){ window.location.reload() }, 1500);
            }
            function extractChunkUrl(msg){
              if (!msg) return null;
              var m = msg.match(/\(timeout:\s*([^)\s]+)\)/);
              if (m && m[1]) return m[1];
              m = msg.match(/https?:\/\/[^\s"'<>]+(?:\.js|\.css)\b/);
              if (m) return m[0];
              m = msg.match(/_next\/static\/[^\s"'<>]+(?:\.js|\.css)\b/);
              if (m) return m[0];
              m = msg.match(/(?:chunk|asset)[:\s]+([^\s"'<>]+(?:\.js|\.css)\b)/i);
              if (m) return m[1];
              return null;
            }
            function retryResource(url, tagName, attempt){
              attempt = attempt || 0;
              if (attempt > 2) { forceReload(); return; }
              var ts = Date.now();
              var retryUrl = url + (url.indexOf('?') === -1 ? '?' : '&') + '_rt=' + ts;
              fetch(retryUrl, { cache: 'no-store' }).then(function(r){
                if (!r.ok) { setTimeout(function(){ retryResource(url, tagName, attempt + 1); }, 1200); return; }
                r.text().then(function(code){
                  if (tagName === 'SCRIPT') {
                    var s = document.createElement('script');
                    s.textContent = code;
                    document.head.appendChild(s);
                    setTimeout(function(){ window.location.reload(); }, 500);
                  }
                });
              }).catch(function(){ setTimeout(function(){ retryResource(url, tagName, attempt + 1); }, 1200); });
            }

            window.addEventListener('error', function(e) {
              var t = e.target || {};
              if ((t.tagName === 'SCRIPT' && t.src && t.src.indexOf('/_next/static/chunks/') !== -1) ||
                  (t.tagName === 'LINK' && t.rel === 'stylesheet' && t.href && t.href.indexOf('/_next/static/') !== -1)) {
                e.preventDefault && e.preventDefault();
                retryResource(t.src || t.href, t.tagName, 0);
              }
            }, true);

            window.addEventListener('unhandledrejection', function(e) {
              if (isChunkError(e.reason)) {
                e.preventDefault();
                var msg = (e.reason && e.reason.message) || '';
                var url = extractChunkUrl(msg);
                if (url) { retryResource(url, 'SCRIPT', 0); return; }
                forceReload();
              }
              if (typeof ErrorEvent !== 'undefined' && e.reason instanceof ErrorEvent) {
                e.preventDefault();
                e.stopImmediatePropagation();
              }
            });
          })();
        0:{"P":null,"c":["","contact-us"],"q":"","i":false,"f":[[["",{"children":["contact-us",{"children":["__PAGE__",{}]}]},"$undefined","$undefined",16],[["$","$1","c",{"children":[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/985b0c3c5c22f5de.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}],["$","link","1",{"rel":"stylesheet","href":"/_next/static/css/13ae791db19d7f63.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}]],["$","html",null,{"lang":"en","className":"__variable_f367f3 __variable_237716 __variable_3c557b __variable_a9b5c5","suppressHydrationWarning":true,"children":[["$","head",null,{"children":[["$","link",null,{"rel":"preload","href":"/fonts/material-symbols-outlined.woff2","as":"font","type":"font/woff2","crossOrigin":"anonymous"}],["$","$L2",null,{"id":"chunk-retry","strategy":"beforeInteractive","dangerouslySetInnerHTML":{"__html":"$3"}}]]}],"$L4"]}]]}],{"children":["$L5",{"children":["$L6",{},null,false,null]},null,false,null]},null,false,null],"$L7",false]],"m":"$undefined","G":["$8",[]],"S":true,"h":null,"s":"$undefined","l":"$undefined","p":"$undefined","d":"$undefined","b":"fCLp9fMqwPreZaKnPxRUv"}
9:I[73829,["8500","static/chunks/8500-9b2f2e83408c75b0.js","5430","static/chunks/5430-4ff8cc0fe4d45064.js","5772","static/chunks/5772-14b50655e8775f58.js","5216","static/chunks/5216-6aee90211755a34f.js","8403","static/chunks/8403-2ef5052f4ca20ae3.js","7860","static/chunks/7860-159a5701f5672208.js","5480","static/chunks/5480-7956bbaef084f719.js","7814","static/chunks/7814-b917408d5f2699c3.js","2181","static/chunks/2181-d4617be5ade94fb3.js","7177","static/chunks/app/layout-253e2be2cc1b5357.js"],"NextAuthProvider"]
a:I[58933,["8500","static/chunks/8500-9b2f2e83408c75b0.js","5430","static/chunks/5430-4ff8cc0fe4d45064.js","5772","static/chunks/5772-14b50655e8775f58.js","5216","static/chunks/5216-6aee90211755a34f.js","8403","static/chunks/8403-2ef5052f4ca20ae3.js","7860","static/chunks/7860-159a5701f5672208.js","5480","static/chunks/5480-7956bbaef084f719.js","7814","static/chunks/7814-b917408d5f2699c3.js","2181","static/chunks/2181-d4617be5ade94fb3.js","7177","static/chunks/app/layout-253e2be2cc1b5357.js"],"default"]
b:I[6281,["8500","static/chunks/8500-9b2f2e83408c75b0.js","5430","static/chunks/5430-4ff8cc0fe4d45064.js","5772","static/chunks/5772-14b50655e8775f58.js","5216","static/chunks/5216-6aee90211755a34f.js","8403","static/chunks/8403-2ef5052f4ca20ae3.js","7860","static/chunks/7860-159a5701f5672208.js","5480","static/chunks/5480-7956bbaef084f719.js","7814","static/chunks/7814-b917408d5f2699c3.js","2181","static/chunks/2181-d4617be5ade94fb3.js","7177","static/chunks/app/layout-253e2be2cc1b5357.js"],"default"]
c:I[36218,["8500","static/chunks/8500-9b2f2e83408c75b0.js","5430","static/chunks/5430-4ff8cc0fe4d45064.js","5772","static/chunks/5772-14b50655e8775f58.js","5216","static/chunks/5216-6aee90211755a34f.js","8403","static/chunks/8403-2ef5052f4ca20ae3.js","7860","static/chunks/7860-159a5701f5672208.js","5480","static/chunks/5480-7956bbaef084f719.js","7814","static/chunks/7814-b917408d5f2699c3.js","2181","static/chunks/2181-d4617be5ade94fb3.js","7177","static/chunks/app/layout-253e2be2cc1b5357.js"],"default"]
d:I[15530,["8500","static/chunks/8500-9b2f2e83408c75b0.js","5430","static/chunks/5430-4ff8cc0fe4d45064.js","5772","static/chunks/5772-14b50655e8775f58.js","5216","static/chunks/5216-6aee90211755a34f.js","8403","static/chunks/8403-2ef5052f4ca20ae3.js","7860","static/chunks/7860-159a5701f5672208.js","5480","static/chunks/5480-7956bbaef084f719.js","7814","static/chunks/7814-b917408d5f2699c3.js","2181","static/chunks/2181-d4617be5ade94fb3.js","7177","static/chunks/app/layout-253e2be2cc1b5357.js"],"Toaster"]
e:I[70868,["8500","static/chunks/8500-9b2f2e83408c75b0.js","5430","static/chunks/5430-4ff8cc0fe4d45064.js","5772","static/chunks/5772-14b50655e8775f58.js","5216","static/chunks/5216-6aee90211755a34f.js","8403","static/chunks/8403-2ef5052f4ca20ae3.js","7860","static/chunks/7860-159a5701f5672208.js","5480","static/chunks/5480-7956bbaef084f719.js","7814","static/chunks/7814-b917408d5f2699c3.js","2181","static/chunks/2181-d4617be5ade94fb3.js","7177","static/chunks/app/layout-253e2be2cc1b5357.js"],"ConditionalNavbar"]
f:I[48724,["8500","static/chunks/8500-9b2f2e83408c75b0.js","5430","static/chunks/5430-4ff8cc0fe4d45064.js","5772","static/chunks/5772-14b50655e8775f58.js","5216","static/chunks/5216-6aee90211755a34f.js","8403","static/chunks/8403-2ef5052f4ca20ae3.js","7860","static/chunks/7860-159a5701f5672208.js","5480","static/chunks/5480-7956bbaef084f719.js","7814","static/chunks/7814-b917408d5f2699c3.js","2181","static/chunks/2181-d4617be5ade94fb3.js","7177","static/chunks/app/layout-253e2be2cc1b5357.js"],"default"]
10:I[40814,["8500","static/chunks/8500-9b2f2e83408c75b0.js","5430","static/chunks/5430-4ff8cc0fe4d45064.js","5772","static/chunks/5772-14b50655e8775f58.js","5216","static/chunks/5216-6aee90211755a34f.js","8403","static/chunks/8403-2ef5052f4ca20ae3.js","7860","static/chunks/7860-159a5701f5672208.js","5480","static/chunks/5480-7956bbaef084f719.js","7814","static/chunks/7814-b917408d5f2699c3.js","2181","static/chunks/2181-d4617be5ade94fb3.js","7177","static/chunks/app/layout-253e2be2cc1b5357.js"],"Heartbeat"]
11:I[19930,["8500","static/chunks/8500-9b2f2e83408c75b0.js","5430","static/chunks/5430-4ff8cc0fe4d45064.js","5772","static/chunks/5772-14b50655e8775f58.js","5216","static/chunks/5216-6aee90211755a34f.js","8403","static/chunks/8403-2ef5052f4ca20ae3.js","7860","static/chunks/7860-159a5701f5672208.js","5480","static/chunks/5480-7956bbaef084f719.js","7814","static/chunks/7814-b917408d5f2699c3.js","2181","static/chunks/2181-d4617be5ade94fb3.js","7177","static/chunks/app/layout-253e2be2cc1b5357.js"],"default"]
12:I[57121,[],""]
13:I[78249,["8500","static/chunks/8500-9b2f2e83408c75b0.js","5430","static/chunks/5430-4ff8cc0fe4d45064.js","8039","static/chunks/app/error-695f5b975064c12d.js"],"default"]
14:I[74581,[],""]
15:I[61304,[],"ClientPageRoot"]
16:I[8996,["8500","static/chunks/8500-9b2f2e83408c75b0.js","2920","static/chunks/app/contact-us/page-a6d8888d4ca1b9a3.js"],"default"]
19:I[90484,[],"OutletBoundary"]
1a:"$Sreact.suspense"
1c:I[90484,[],"ViewportBoundary"]
1e:I[90484,[],"MetadataBoundary"]
4:["$","body",null,{"className":"antialiased font-body","suppressHydrationWarning":true,"children":["$","$L9",null,{"children":[["$","$La",null,{}],["$","$Lb",null,{}],["$","$Lc",null,{}],["$","$Ld",null,{"position":"bottom-right","toastOptions":{"style":{"background":"#ffffff","color":"#121c2a","border":"1px solid #c4c6cf","borderRadius":"12px","padding":"12px 24px"}}}],["$","$Le",null,{}],["$","$Lf",null,{}],["$","$L10",null,{}],["$","$L11",null,{}],["$","main",null,{"children":["$","$L12",null,{"parallelRouterKey":"children","error":"$13","errorStyles":[],"errorScripts":[],"template":["$","$L14",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],[]],"forbidden":"$undefined","unauthorized":"$undefined"}]}]]}]}]
5:["$","$1","c",{"children":[null,["$","$L12",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L14",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]]}]
6:["$","$1","c",{"children":[["$","$L15",null,{"Component":"$16","serverProvidedParams":{"searchParams":{},"params":{},"promises":["$@17","$@18"]}}],null,["$","$L19",null,{"children":["$","$1a",null,{"name":"Next.MetadataOutlet","children":"$@1b"}]}]]}]
7:["$","$1","h",{"children":[null,["$","$L1c",null,{"children":"$L1d"}],["$","div",null,{"hidden":true,"children":["$","$L1e",null,{"children":["$","$1a",null,{"name":"Next.Metadata","children":"$L1f"}]}]}],null]}]
17:{}
18:"$6:props:children:0:props:serverProvidedParams:params"
1d:[["$","meta","0",{"charSet":"utf-8"}],["$","meta","1",{"name":"viewport","content":"width=device-width, initial-scale=1"}]]
20:I[86869,[],"IconMark"]
1b:null
1f:[["$","title","0",{"children":"Contact Us | Latexify"}],["$","meta","1",{"name":"description","content":"Get in touch with Latexify. We'd love to hear from you."}],["$","link","2",{"rel":"shortcut icon","href":"/logo.png"}],["$","link","3",{"rel":"icon","href":"/logo.png"}],["$","link","4",{"rel":"apple-touch-icon","href":"/logo.png"}],["$","$L20","5",{}]]
