import Script from "next/script";
import "./globals.css";
import { NextAuthProvider } from "@/components/Auth/NextAuthProvider";
import { ConditionalNavbar } from "@/components/ConditionalNavbar";
import { Toaster } from "react-hot-toast";
import InternetMonitor from "@/components/InternetMonitor";
import BroadcastBanner from "@/components/BroadcastBanner";
import SecurityBlockOverlay from "@/components/SecurityBlockOverlay";
import AiCapWarning from "@/components/AiCapWarning";
import { Heartbeat } from "@/components/Heartbeat";
import ConditionalMonacoSetup from "@/components/ConditionalMonacoSetup";

export async function generateMetadata() {
  const logoUrl = '/logo.png';
  return {
    title: "Latexify | Professional LaTeX Editorial for Researchers",
    description: "AI-powered LaTeX Studio: browser-based IDE with pdfLaTeX/LuaLaTeX/XeLaTeX, template gallery, PDF preview, and Word-to-LaTeX conversion. 100% free.",
    icons: {
      icon: logoUrl,
      shortcut: logoUrl,
      apple: logoUrl,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,700;1,6..72,400;1,6..72,700&family=Outfit:wght@400;500;600;700;800&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var lastReload = 0;
            function isExtensionError(e){
              if (!e) return false;
              var msg = '';
              try {
                if (typeof e === 'string') {
                  msg = e;
                } else {
                  msg = (e.message || '') + ' ' +
                        (e.filename || '') + ' ' +
                        (e.name || '') + ' ' +
                        (e.stack || '') + ' ' +
                        (e.error ? (e.error.message || '') + ' ' + (e.error.stack || '') : '') + ' ' +
                        (e.reason ? (typeof e.reason === 'string' ? e.reason : (e.reason.message || '') + ' ' + (e.reason.stack || '')) : '') + ' ' +
                        (e.target ? (e.target.src || e.target.href || e.target.outerHTML || '') : '') + ' ' +
                        (typeof e.toString === 'function' ? e.toString() : '');
                  if (typeof e === 'object') {
                    try { msg += ' ' + JSON.stringify(e); } catch(_) {}
                  }
                }
              } catch(err) { msg = ''; }
              var str = String(msg || '').toLowerCase();
              return str.indexOf('chrome-extension://') !== -1 ||
                     str.indexOf('moz-extension://') !== -1 ||
                     str.indexOf('safari-extension://') !== -1 ||
                     str.indexOf('ojplmecpdpgccookcobabopnaifgidhf') !== -1 ||
                     str.indexOf('couponcollection') !== -1 ||
                     str.indexOf('autocoupon') !== -1 ||
                     str.indexOf('affiliatecashback') !== -1 ||
                     str.indexOf('invalid/') !== -1 ||
                     str.indexOf('script.js') !== -1 ||
                     str.indexOf('content.ts') !== -1 ||
                     str.indexOf('bhk') !== -1 ||
                     str.indexOf('buyhatke') !== -1 ||
                     str.indexOf('unpaywall') !== -1 ||
                     str.indexOf('showoacolor') !== -1 ||
                     str.indexOf('widget sdk') !== -1 ||
                     str.indexOf('merchantid') !== -1 ||
                     str.indexOf('denying load of') !== -1 ||
                     str.indexOf('mutationobserver') !== -1 ||
                     str.indexOf('parameter 1 is not of type') !== -1 ||
                     str.indexOf("not of type 'node'") !== -1 ||
                     str.indexOf('disconnected port object') !== -1 ||
                     str.indexOf('err_network_io_suspended') !== -1 ||
                     str.indexOf('err_network_changed') !== -1 ||
                     str.indexOf('err_internet_disconnected') !== -1 ||
                     str.indexOf('your computer went to sleep') !== -1 ||
                     str.indexOf('your connection was interrupted') !== -1 ||
                     str.indexOf('editorworkerservice') !== -1 ||
                     str.indexOf('editorworkermain') !== -1 ||
                     str.indexOf('failed to load worker script') !== -1 ||
                     str.indexOf('failed to fetch dynamically imported module') !== -1 ||
                     str.indexOf('web_accessible_resources') !== -1 ||
                     str.indexOf('net::err_failed') !== -1 ||
                     str.indexOf('result: false') !== -1 ||
                     str.indexOf('result:false') !== -1;
            }
            if (typeof window !== 'undefined') {
              if (window.MutationObserver && window.MutationObserver.prototype) {
                var _origObserve = window.MutationObserver.prototype.observe;
                window.MutationObserver.prototype.observe = function(target, options) {
                  if (!target) return;
                  var isNode = false;
                  try {
                    isNode = (typeof Node !== 'undefined' && target instanceof Node) ||
                             (target && typeof target.nodeType === 'number' && typeof target.nodeName === 'string');
                  } catch(_) {}
                  if (!isNode) return;
                  try {
                    return _origObserve.apply(this, arguments);
                  } catch (err) {
                    return;
                  }
                };
              }

              // Block unwanted third-party extension scripts from injecting broken resources
              if (typeof Node !== 'undefined' && Node.prototype) {
                var _origAppendChild = Node.prototype.appendChild;
                var _origInsertBefore = Node.prototype.insertBefore;

                function isBlockedExtNode(node) {
                  if (!node) return false;
                  try {
                    var tag = (node.nodeName || node.tagName || '').toUpperCase();
                    if (tag === 'SCRIPT' || tag === 'LINK' || tag === 'IFRAME') {
                      var src = (node.src || node.href || '') + '';
                      var lower = src.toLowerCase();
                      if (lower.indexOf('ojplmecpdpgccookcobabopnaifgidhf') !== -1 ||
                          lower.indexOf('couponcollection') !== -1 ||
                          lower.indexOf('affiliatecashback') !== -1 ||
                          lower.indexOf('invalid/') !== -1 ||
                          (lower.indexOf('chrome-extension://') === 0 && lower.indexOf('/assets/coupon') !== -1)) {
                        return true;
                      }
                    }
                  } catch(_) {}
                  return false;
                }

                Node.prototype.appendChild = function(node) {
                  if (isBlockedExtNode(node)) return node;
                  return _origAppendChild.apply(this, arguments);
                };

                Node.prototype.insertBefore = function(node, ref) {
                  if (isBlockedExtNode(node)) return node;
                  return _origInsertBefore.apply(this, arguments);
                };
              }

              if (typeof HTMLScriptElement !== 'undefined' && HTMLScriptElement.prototype) {
                var srcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
                if (srcDesc && srcDesc.set) {
                  var _origScriptSrcSet = srcDesc.set;
                  Object.defineProperty(HTMLScriptElement.prototype, 'src', {
                    set: function(val) {
                      var lower = String(val || '').toLowerCase();
                      if (lower.indexOf('ojplmecpdpgccookcobabopnaifgidhf') !== -1 ||
                          lower.indexOf('couponcollection') !== -1 ||
                          lower.indexOf('affiliatecashback') !== -1 ||
                          lower.indexOf('invalid/') !== -1) {
                        return;
                      }
                      return _origScriptSrcSet.call(this, val);
                    },
                    get: srcDesc.get,
                    configurable: true,
                    enumerable: true
                  });
                }
              }

              if (typeof console !== 'undefined') {
                var methods = ['error', 'warn', 'log', 'info', 'debug'];
                for (var m = 0; m < methods.length; m++) {
                  (function(method) {
                    var orig = console[method];
                    if (!orig) return;
                    console[method] = function() {
                      var callStack = '';
                      try { callStack = (new Error().stack || '').toLowerCase(); } catch(_) {}
                      if (callStack && isExtensionError(callStack)) return;

                      var args = Array.prototype.slice.call(arguments);
                      for (var i = 0; i < args.length; i++) {
                        if (isExtensionError(args[i])) return;
                      }
                      return orig.apply(console, arguments);
                    };
                  })(methods[m]);
                }
              }

              if (window.fetch) {
                var _origFetch = window.fetch;
                window.fetch = function(input, init) {
                  var url = typeof input === 'string' ? input : (input && input.url) ? input.url : '';
                  var strUrl = String(url || '').toLowerCase();
                  if (strUrl.indexOf('chrome-extension://') === 0 || strUrl.indexOf('moz-extension://') === 0 || strUrl.indexOf('safari-extension://') === 0 || strUrl.indexOf('couponcollection') !== -1 || strUrl.indexOf('affiliatecashback') !== -1 || strUrl.indexOf('invalid/') !== -1) {
                    return Promise.resolve(new Response(JSON.stringify({ blocked: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
                  }
                  return _origFetch.apply(this, arguments);
                };
              }
            }
            function isChunkError(e){
              if (isExtensionError(e)) return false;
              var m = (e && (e.message || e.name || (e.reason && (e.reason.message || e.reason)))) || '';
              if (typeof m !== 'string') m = String(m);
              var lower = m.toLowerCase();
              if (lower.indexOf('chrome-extension') !== -1 || lower.indexOf('moz-extension') !== -1) return false;
              var isNextChunk = lower.indexOf('_next/static') !== -1 || lower.indexOf('loading chunk') !== -1 || lower.indexOf('chunkloaderror') !== -1;
              return isNextChunk;
            }
            function forceReload(){
              var now = Date.now();
              if (now - lastReload < 30000) return;
              lastReload = now;
              setTimeout(function(){ window.location.reload() }, 2000);
            }
            function extractChunkUrl(msg){
              if (!msg || typeof msg !== 'string') return null;
              var idx = msg.indexOf('_next/static/');
              if (idx === -1) return null;
              var sub = msg.substring(idx);
              var endIdx = sub.search(/[\\s"'<>()]/);
              return endIdx === -1 ? sub : sub.substring(0, endIdx);
            }
            function retryResource(url, tagName, attempt){
              if (!url || isExtensionError(url) || url.indexOf('extension') !== -1) return;
              attempt = attempt || 0;
              if (attempt > 2) { forceReload(); return; }
              var ts = Date.now();
              var retryUrl = url + (url.indexOf('?') === -1 ? '?' : '&') + '_rt=' + ts;
              fetch(retryUrl, { cache: 'no-store' }).then(function(r){
                if (!r.ok) { setTimeout(function(){ retryResource(url, tagName, attempt + 1); }, 1500); return; }
                r.text().then(function(code){
                  if (tagName === 'SCRIPT') {
                    var s = document.createElement('script');
                    s.textContent = code;
                    document.head.appendChild(s);
                    setTimeout(function(){ window.location.reload(); }, 500);
                  }
                });
              }).catch(function(){ setTimeout(function(){ retryResource(url, tagName, attempt + 1); }, 1500); });
            }

            window.onerror = function(msg, url, line, col, err) {
              var combo = (msg || '') + ' ' + (url || '') + ' ' + (err ? (err.message || '') + ' ' + (err.stack || '') : '');
              if (isExtensionError(combo) || isExtensionError(err) || isExtensionError(msg) || isExtensionError(url)) return true;
            };

            window.addEventListener('error', function(e) {
              if (isExtensionError(e) || isExtensionError(e.message) || isExtensionError(e.filename) || isExtensionError(e.error) || isExtensionError(e.target && (e.target.src || e.target.href))) {
                if (e.preventDefault) e.preventDefault();
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                return true;
              }
              var t = e.target || {};
              if ((t.tagName === 'SCRIPT' && t.src && t.src.indexOf('/_next/static/chunks/') !== -1) ||
                  (t.tagName === 'LINK' && t.rel === 'stylesheet' && t.href && t.href.indexOf('/_next/static/') !== -1)) {
                if (e.preventDefault) e.preventDefault();
                retryResource(t.src || t.href, t.tagName, 0);
              }
            }, true);

            window.addEventListener('unhandledrejection', function(e) {
              if (isExtensionError(e.reason) || isExtensionError(e)) {
                if (e.preventDefault) e.preventDefault();
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                return;
              }
              if (isChunkError(e.reason)) {
                if (e.preventDefault) e.preventDefault();
                var msg = (e.reason && (e.reason.message || e.reason)) || '';
                var url = extractChunkUrl(typeof msg === 'string' ? msg : '');
                if (url) { retryResource(url, 'SCRIPT', 0); return; }
              }
              if (typeof ErrorEvent !== 'undefined' && e.reason instanceof ErrorEvent) {
                if (e.preventDefault) e.preventDefault();
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();
              }
            }, true);
          })();
        `}} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased font-body" suppressHydrationWarning>
        <NextAuthProvider>
          <SecurityBlockOverlay />
          <BroadcastBanner />
          <InternetMonitor />
          <Toaster 
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#ffffff',
                color: '#121c2a',
                border: '1px solid #c4c6cf',
                borderRadius: '12px',
                padding: '12px 24px',
              },
            }}
          />
          <ConditionalNavbar />
          <AiCapWarning />
          <Heartbeat />
          <ConditionalMonacoSetup />
          <main>
            {children}
          </main>
        </NextAuthProvider>
      </body>
    </html>
  );
}
