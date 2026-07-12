import { Inter, Newsreader, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NextAuthProvider } from "@/components/Auth/NextAuthProvider";
import { PocketBaseProvider } from "@/components/Auth/PocketBaseProvider";
import { ConditionalNavbar } from "@/components/ConditionalNavbar";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
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

export const metadata = {
  title: "Latexify | Professional LaTeX Editorial for Researchers",
  description: "AI-powered LaTeX Studio: browser-based IDE with pdfLaTeX/LuaLaTeX/XeLaTeX, template gallery, PDF preview, and Word-to-LaTeX conversion. 100% free.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${jetbrains.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/material-symbols-outlined.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <Script id="chunk-retry" strategy="afterInteractive">
          {`(function(){var origCreateElement=document.createElement.bind(document);var retryMap={};document.createElement=function(tagName,options){var el=origCreateElement(tagName,options);if(tagName&&tagName.toLowerCase()==='script'&&el.src&&el.src.includes('/_next/static/chunks/')){var origSrc=el.src;(function(el2,src){var retries=0;el2.addEventListener('error',function errorHandler(){if(retries<3){retries++;retryMap[src]=retries;var newEl=origCreateElement('script',options);newEl.src=src+(src.includes('?')?'&':'?')+'retry='+retries;newEl.onload=function(){el2.onerror=null;el2.parentNode&&el2.parentNode.replaceChild(newEl,el2);};newEl.onerror=errorHandler;el2.parentNode&&el2.parentNode.insertBefore(newEl,el2.nextSibling);}else{el2.onerror=null;delete retryMap[src];}});})(el,origSrc);}return el;};if(typeof __webpack_chunk_load__!=='undefined'){var origChunkLoad=__webpack_chunk_load__;__webpack_chunk_load__=function(chunkId){var retries=0;function load(){return origChunkLoad(chunkId)['catch'](function(e){if(retries<3&&e&&(e.message&&e.message.includes('Loading chunk')||e.name==='ChunkLoadError')){retries++;return new Promise(function(r){setTimeout(r,1000*retries)})['then'](load);}throw e;});}return load();};}window.addEventListener('unhandledrejection',function(e){var msg=e.reason&&(e.reason.message||e.reason+'')||'';if(msg.includes('Loading chunk')||msg.includes('ChunkLoadError')||e.reason&&e.reason.name==='ChunkLoadError'){e.preventDefault();}});})()`}
        </Script>
      </head>
      <body className="antialiased font-body" suppressHydrationWarning>
        <PocketBaseProvider>
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
        </PocketBaseProvider>
      </body>
    </html>
  );
}
