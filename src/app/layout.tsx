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
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
  weight: ["300", "400", "700"],
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
        <link rel="preload" href="/fonts/material-symbols-outlined.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <Script id="chunk-retry" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `
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
            function retryResource(url, tagName){
              var ts = Date.now();
              var retryUrl = url + (url.indexOf('?') === -1 ? '?' : '&') + '_rt=' + ts;
              fetch(retryUrl, { cache: 'no-store' }).then(function(r){
                if (!r.ok) { forceReload(); return; }
                r.text().then(function(code){
                  if (tagName === 'SCRIPT') {
                    var s = document.createElement('script');
                    s.textContent = code;
                    document.head.appendChild(s);
                    setTimeout(function(){ window.location.reload(); }, 500);
                  }
                });
              }).catch(function(){ forceReload(); });
            }

            window.addEventListener('error', function(e) {
              var t = e.target || {};
              if ((t.tagName === 'SCRIPT' && t.src && t.src.indexOf('/_next/static/chunks/') !== -1) || 
                  (t.tagName === 'LINK' && t.rel === 'stylesheet' && t.href && t.href.indexOf('/_next/static/') !== -1)) {
                e.preventDefault && e.preventDefault();
                retryResource(t.src || t.href, t.tagName);
              }
            }, true);

            window.addEventListener('unhandledrejection', function(e) {
              if (isChunkError(e.reason)) {
                e.preventDefault();
                // Extract chunk URL from error message for targeted retry
                var msg = (e.reason && e.reason.message) || '';
                var m = msg.match(/\\(timeout:\\s*([^)]+)\\)/);
                if (m && m[1]) { retryResource(m[1], 'SCRIPT'); return; }
                forceReload();
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
