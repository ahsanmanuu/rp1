import { Inter, Newsreader, Outfit, JetBrains_Mono } from "next/font/google";
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

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "700"],
});

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
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${jetbrains.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
                     str.indexOf('unpaywall') !== -1 ||
                     str.indexOf('mutationobserver') !== -1 ||
                     str.indexOf('parameter 1 is not of type') !== -1 ||
                     str.indexOf("not of type 'node'") !== -1 ||
                     str.indexOf('disconnected port object') !== -1 ||
                     str.indexOf('err_network_io_suspended') !== -1 ||
                     str.indexOf('err_network_changed') !== -1 ||
                     str.indexOf('editorworkerservice') !== -1 ||
                     str.indexOf('editorworkermain') !== -1 ||
                     str.indexOf('failed to load worker script') !== -1 ||
                     str.indexOf('failed to fetch dynamically imported module') !== -1 ||
                     str.indexOf('web_accessible_resources') !== -1;
            }
            if (typeof window !== 'undefined') {
              if (window.MutationObserver && window.MutationObserver.prototype) {
                var _origObserve = window.MutationObserver.prototype.observe;
                window.MutationObserver.prototype.observe = function(target, options) {
                  if (!target || typeof target !== 'object' || typeof target.nodeType !== 'number') {
                    return;
                  }
                  try {
                    return _origObserve.apply(this, arguments);
                  } catch (err) {
                    return;
                  }
                };
              }
              if (typeof console !== 'undefined') {
                var _origConsoleError = console.error;
                var _origConsoleWarn = console.warn;
                console.error = function() {
                  var args = Array.prototype.slice.call(arguments);
                  for (var i = 0; i < args.length; i++) {
                    if (isExtensionError(args[i])) return;
                  }
                  return _origConsoleError.apply(console, arguments);
                };
                console.warn = function() {
                  var args = Array.prototype.slice.call(arguments);
                  for (var i = 0; i < args.length; i++) {
                    if (isExtensionError(args[i])) return;
                  }
                  return _origConsoleWarn.apply(console, arguments);
                };
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
                e.preventDefault();
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                return;
              }
              if (isChunkError(e.reason)) {
                e.preventDefault();
                var msg = (e.reason && (e.reason.message || e.reason)) || '';
                var url = extractChunkUrl(typeof msg === 'string' ? msg : '');
                if (url) { retryResource(url, 'SCRIPT', 0); return; }
              }
              if (typeof ErrorEvent !== 'undefined' && e.reason instanceof ErrorEvent) {
                e.preventDefault();
                e.stopImmediatePropagation();
              }
            });
          })();
        `}} />
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
