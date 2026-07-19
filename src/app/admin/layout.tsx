"use client";

import AdminThemeStyles from "@/components/AdminThemeStyles";
import { AdminThemeProvider } from "@/contexts/AdminThemeContext";
import Script from "next/script";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script id="admin-theme-preboot" strategy="beforeInteractive">
        {`
          (function() {
            try {
              var savedTheme = localStorage.getItem("latexify-admin-theme") || "indigo";
              var savedMode = localStorage.getItem("latexify-admin-mode") !== "light";
              var themes = {
                indigo:   { p:"#c3c0ff",pc:"rgba(195,192,255,.15)",opc:"#dad7ff",s:"#c0c1ff",sc:"rgba(192,193,255,.15)",osc:"#b0b2ff",sk:"#171f33",ov:"#464555",lp:"#4f46e5",lpc:"#e0e7ff",lopc:"#1e1b4b",ls:"#6366f1",lsc:"#e0e7ff",losc:"#1e1b4b" },
                emerald:  { p:"#6ee7b7",pc:"rgba(110,231,183,.15)",opc:"#d1fae5",s:"#a7f3d0",sc:"rgba(167,243,208,.15)",osc:"#ecfdf5",sk:"#0f2c20",ov:"#2d4a3e",lp:"#059669",lpc:"#d1fae5",lopc:"#022c22",ls:"#10b981",lsc:"#d1fae5",losc:"#022c22" },
                rose:     { p:"#fda4af",pc:"rgba(253,164,175,.15)",opc:"#ffe4e6",s:"#fecdd3",sc:"rgba(254,205,211,.15)",osc:"#fff1f2",sk:"#33181b",ov:"#553639",lp:"#e11d48",lpc:"#ffe4e6",lopc:"#4c0519",ls:"#f43f5e",lsc:"#ffe4e6",losc:"#4c0519" },
                violet:   { p:"#d8b4fe",pc:"rgba(216,180,254,.15)",opc:"#f3e8ff",s:"#e9d5ff",sc:"rgba(233,213,255,.15)",osc:"#faf5ff",sk:"#2e1065",ov:"#4c1d95",lp:"#7c3aed",lpc:"#ede9fe",lopc:"#2e1065",ls:"#8b5cf6",lsc:"#ede9fe",losc:"#2e1065" },
                amber:    { p:"#fcd34d",pc:"rgba(252,211,77,.15)",opc:"#fef3c7",s:"#fde68a",sc:"rgba(253,230,138,.15)",osc:"#fffbeb",sk:"#451a03",ov:"#78350f",lp:"#d97706",lpc:"#fef3c7",lopc:"#451a03",ls:"#f59e0b",lsc:"#fef3c7",losc:"#451a03" },
                cyan:     { p:"#67e8f9",pc:"rgba(103,232,249,.15)",opc:"#ecfeff",s:"#a5f3fc",sc:"rgba(165,243,252,.15)",osc:"#f0fdfa",sk:"#083344",ov:"#164e63",lp:"#0891b2",lpc:"#cffafe",lopc:"#164e63",ls:"#06b6d4",lsc:"#cffafe",losc:"#164e63" },
                sky:      { p:"#bae6fd",pc:"rgba(186,230,253,.15)",opc:"#e0f2fe",s:"#7dd3fc",sc:"rgba(125,211,252,.15)",osc:"#f0f9ff",sk:"#0c2d48",ov:"#1e4976",lp:"#0284c7",lpc:"#e0f2fe",lopc:"#0c2d48",ls:"#38bdf8",lsc:"#e0f2fe",losc:"#0c2d48" },
                pink:     { p:"#f9a8d4",pc:"rgba(249,168,212,.15)",opc:"#fce7f3",s:"#f472b6",sc:"rgba(244,114,182,.15)",osc:"#fdf2f8",sk:"#4a0e2a",ov:"#831843",lp:"#db2777",lpc:"#fce7f3",lopc:"#4a0e2a",ls:"#ec4899",lsc:"#fce7f3",losc:"#4a0e2a" },
                orange:   { p:"#fdba74",pc:"rgba(253,186,116,.15)",opc:"#fff7ed",s:"#fb923c",sc:"rgba(251,146,60,.15)",osc:"#fff7ed",sk:"#431407",ov:"#9a3412",lp:"#ea580c",lpc:"#fff7ed",lopc:"#431407",ls:"#f97316",lsc:"#fff7ed",losc:"#431407" },
                lime:     { p:"#bef264",pc:"rgba(190,242,100,.15)",opc:"#f7fee7",s:"#a3e635",sc:"rgba(163,230,53,.15)",osc:"#f7fee7",sk:"#1a2e05",ov:"#3f6212",lp:"#65a30d",lpc:"#f7fee7",lopc:"#1a2e05",ls:"#84cc16",lsc:"#f7fee7",losc:"#1a2e05" },
                teal:     { p:"#99f6e4",pc:"rgba(153,246,228,.15)",opc:"#f0fdfa",s:"#5eead4",sc:"rgba(94,234,212,.15)",osc:"#f0fdfa",sk:"#042f2e",ov:"#115e59",lp:"#0d9488",lpc:"#f0fdfa",lopc:"#042f2e",ls:"#14b8a6",lsc:"#f0fdfa",losc:"#042f2e" },
                fuchsia:  { p:"#f0abfc",pc:"rgba(240,171,252,.15)",opc:"#fdf4ff",s:"#e879f9",sc:"rgba(232,121,249,.15)",osc:"#fdf4ff",sk:"#4a044e",ov:"#86198f",lp:"#c026d3",lpc:"#fdf4ff",lopc:"#4a044e",ls:"#d946ef",lsc:"#fdf4ff",losc:"#4a044e" },
                red:      { p:"#fca5a5",pc:"rgba(252,165,165,.15)",opc:"#fef2f2",s:"#f87171",sc:"rgba(248,113,113,.15)",osc:"#fef2f2",sk:"#450a0a",ov:"#991b1b",lp:"#dc2626",lpc:"#fef2f2",lopc:"#450a0a",ls:"#ef4444",lsc:"#fef2f2",losc:"#450a0a" },
                yellow:   { p:"#fde047",pc:"rgba(253,224,71,.15)",opc:"#fefce8",s:"#facc15",sc:"rgba(250,204,21,.15)",osc:"#fefce8",sk:"#422006",ov:"#a16207",lp:"#ca8a04",lpc:"#fefce8",lopc:"#422006",ls:"#eab308",lsc:"#fefce8",losc:"#422006" },
                stone:    { p:"#d6d3d1",pc:"rgba(214,211,209,.15)",opc:"#f5f5f4",s:"#a8a29e",sc:"rgba(168,162,158,.15)",osc:"#f5f5f4",sk:"#1c1917",ov:"#57534e",lp:"#78716c",lpc:"#f5f5f4",lopc:"#1c1917",ls:"#a8a29e",lsc:"#f5f5f4",losc:"#1c1917" },
                zinc:     { p:"#d4d4d8",pc:"rgba(212,212,216,.15)",opc:"#f4f4f5",s:"#a1a1aa",sc:"rgba(161,161,170,.15)",osc:"#f4f4f5",sk:"#18181b",ov:"#52525b",lp:"#71717a",lpc:"#f4f4f5",lopc:"#18181b",ls:"#a1a1aa",lsc:"#f4f4f5",losc:"#18181b" }
              };
              var c = themes[savedTheme] || themes.indigo;
              var style = document.createElement('style');
              style.id = 'admin-theme-preboot';
              style.innerHTML = ':root{'+(savedMode?'--color-admin-primary:'+c.p+';--color-admin-primary-container:'+c.pc+';--color-admin-on-primary-container:'+c.opc+';--color-admin-secondary:'+c.s+';--color-admin-secondary-container:'+c.sc+';--color-admin-on-secondary-container:'+c.osc+';--color-admin-outline-variant:'+c.ov+';--color-admin-background:#0b1326!important;--color-admin-surface:#0b1326!important;--color-admin-surface-container:'+c.sk+';--color-admin-on-surface:#dae2fd!important;--color-admin-on-surface-variant:#c7c4d8!important;--color-admin-outline:#918fa1!important;--color-admin-tertiary:'+c.p+';--color-admin-tertiary-container:'+c.pc+';--color-admin-on-tertiary-container:'+c.opc+';--color-admin-surface-tint:'+c.p+';':'--color-admin-primary:'+c.lp+'!important;--color-admin-primary-container:'+c.lpc+'!important;--color-admin-on-primary-container:'+c.lopc+'!important;--color-admin-secondary:'+c.ls+'!important;--color-admin-secondary-container:'+c.lsc+'!important;--color-admin-on-secondary-container:'+c.losc+'!important;--color-admin-outline-variant:#cbd5e1!important;--color-admin-background:#f8fafc!important;--color-admin-surface:#ffffff!important;--color-admin-surface-container:#e2e8f0!important;--color-admin-on-surface:#0f172a!important;--color-admin-on-surface-variant:#475569!important;--color-admin-outline:#64748b!important;--color-admin-tertiary:'+c.lp+'!important;--color-admin-tertiary-container:'+c.lpc+'!important;--color-admin-on-tertiary-container:'+c.lopc+'!important;--color-admin-surface-tint:'+c.lp+'!important;')+ '}';
              document.head.appendChild(style);
            } catch (e) {}
          })();
        `}
      </Script>
      <AdminThemeProvider>
        <AdminThemeStyles />
        {children}
      </AdminThemeProvider>
    </>
  );
}
