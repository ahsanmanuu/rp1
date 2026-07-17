import { Inter, Newsreader, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NextAuthProvider } from "@/components/Auth/NextAuthProvider";
import { ConditionalNavbar } from "@/components/ConditionalNavbar";
import { Toaster } from "react-hot-toast";
import InternetMonitor from "@/components/InternetMonitor";
import BroadcastBanner from "@/components/BroadcastBanner";
import SecurityBlockOverlay from "@/components/SecurityBlockOverlay";
import AiCapWarning from "@/components/AiCapWarning";
import { Heartbeat } from "@/components/Heartbeat";

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
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var MAX_RETRIES = 3;
            function isChunkError(e){
              var m = (e && (e.message || e.name || (e.reason && e.reason.message))) || '';
              return m.indexOf('Loading chunk') !== -1 || m.indexOf('Loading CSS') !== -1 || m.indexOf('ChunkLoadError') !== -1 || m.indexOf('Failed to fetch dynamically imported module') !== -1 || m.indexOf('ImportModuleError') !== -1;
            }
            function forceReload(){setTimeout(function(){window.location.reload()}, 500)}

            function handleElementError(el, url, isScript) {
              var retries = 0;
              el.addEventListener('error', function errorHandler(e) {
                if (retries < MAX_RETRIES) {
                  retries++;
                  console.warn('[ChunkRetry] Failed to load:', url, 'Retry attempt:', retries);
                  var d = new Date();
                  var sep = url.indexOf('?') !== -1 ? '&' : '?';
                  var retryUrl = url + sep + '_r=' + retries + '&_t=' + d.getTime();
                  
                  var newEl;
                  if (isScript) {
                    newEl = document.createElement('script');
                    newEl.src = retryUrl;
                    newEl.crossOrigin = el.crossOrigin || 'anonymous';
                  } else {
                    newEl = document.createElement('link');
                    newEl.rel = 'stylesheet';
                    newEl.href = retryUrl;
                    newEl.crossOrigin = el.crossOrigin || 'anonymous';
                  }
                  newEl.__is_retry__ = true;
                  newEl.onerror = errorHandler;
                  
                  var parent = el.parentNode || document.head || document.body;
                  if (el.parentNode) {
                    parent.insertBefore(newEl, el.nextSibling);
                  } else {
                    parent.appendChild(newEl);
                  }
                } else {
                  console.error('[ChunkRetry] Max retries reached for:', url);
                  forceReload();
                }
              });
            }

            var origAppendChild = Node.prototype.appendChild;
            Node.prototype.appendChild = function(child) {
              if (child && !child.__is_retry__) {
                if (child.tagName === 'SCRIPT' && child.src && child.src.indexOf('/_next/static/chunks/') !== -1) {
                  handleElementError(child, child.src, true);
                } else if (child.tagName === 'LINK' && child.rel === 'stylesheet' && child.href && child.href.indexOf('/_next/static/') !== -1) {
                  handleElementError(child, child.href, false);
                }
              }
              return origAppendChild.call(this, child);
            };

            var origInsertBefore = Node.prototype.insertBefore;
            Node.prototype.insertBefore = function(child, reference) {
              if (child && !child.__is_retry__) {
                if (child.tagName === 'SCRIPT' && child.src && child.src.indexOf('/_next/static/chunks/') !== -1) {
                  handleElementError(child, child.src, true);
                } else if (child.tagName === 'LINK' && child.rel === 'stylesheet' && child.href && child.href.indexOf('/_next/static/') !== -1) {
                  handleElementError(child, child.href, false);
                }
              }
              return origInsertBefore.call(this, child, reference);
            };

            window.addEventListener('error', function(e) {
              var t = e.target || {};
              if ((t.tagName === 'SCRIPT' && t.src && t.src.indexOf('/_next/static/chunks/') !== -1) || 
                  (t.tagName === 'LINK' && t.rel === 'stylesheet' && t.href && t.href.indexOf('/_next/static/') !== -1)) {
                e.preventDefault && e.preventDefault();
              }
            }, true);

            window.addEventListener('unhandledrejection', function(e) {
              if (isChunkError(e.reason)) {
                e.preventDefault();
                forceReload();
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
          <main>
            {children}
          </main>
        </NextAuthProvider>
      </body>
    </html>
  );
}
