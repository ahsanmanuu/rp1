import { Inter, Newsreader, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NextAuthProvider } from "@/components/Auth/NextAuthProvider";
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
      </head>
      <body className="antialiased font-body" suppressHydrationWarning>
        <Script id="chunk-retry" strategy="afterInteractive">
          {`(function(){
var MAX_RETRIES=3;
function isChunkError(e){
  var m=(e&&(e.message||e.name))||'';
  return m.indexOf('Loading chunk')!==-1||m.indexOf('Loading CSS')!==-1||m.indexOf('ChunkLoadError')!==-1||m.indexOf('Failed to fetch dynamically imported module')!==-1||m.indexOf('ImportModuleError')!==-1;
}
function forceReload(){setTimeout(function(){window.location.reload()},500)}

var origCreateElement=document.createElement.bind(document);
document.createElement=function(tagName,options){
  var el=origCreateElement(tagName,options);
  if(tagName&&tagName.toLowerCase()==='script'&&el.src&&el.src.indexOf('/_next/static/chunks/')!==-1){
    var origSrc=el.src,retries=0;
    el.addEventListener('error',function errorHandler(){
      if(retries<MAX_RETRIES){retries++;var d=new Date();var sep=origSrc.indexOf('?')!==-1?'&':'?';
        var newEl=origCreateElement('script',{src:origSrc+sep+'_r='+retries+'&_t='+d.getTime()});
        newEl.onerror=errorHandler;
        el.parentNode&&el.parentNode.insertBefore(newEl,el.nextSibling);
      }else{forceReload()}
    });
  }
  return el;
};

if(typeof __webpack_chunk_load__!=='undefined'){
  var origChunkLoad=__webpack_chunk_load__;
  __webpack_chunk_load__=function(chunkId){
    var retries=0;
    function load(){return origChunkLoad(chunkId).catch(function(e){
      if(retries<MAX_RETRIES&&isChunkError(e)){retries++;return new Promise(function(r){setTimeout(r,1500*retries)}).then(load)}
      throw e;
    })}
    return load();
  };
}

window.addEventListener('error',function(e){
  var t=e.target||{};
  if(t.tagName==='SCRIPT'&&t.src&&t.src.indexOf('/_next/static/chunks/')!==-1){
    e.preventDefault&&e.preventDefault();
  }
},true);

window.addEventListener('unhandledrejection',function(e){
  if(isChunkError(e.reason)){e.preventDefault();forceReload()}
});
})()`}
        </Script>
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
