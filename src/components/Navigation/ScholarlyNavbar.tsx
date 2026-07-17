"use client";
 
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeSwitcher from "@/components/scholarly-editor/ThemeSwitcher";
import LatexifyLogo from "@/components/LatexifyLogo";
 
export const ScholarlyNavbar = () => {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
 
  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
 
  if (!mounted) return null;
 
  return (
    <nav
      className={`fixed top-0 w-full z-[100] transition-all duration-300 ${
        scrolled 
          ? "bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 shadow-md" 
          : "bg-transparent"
      }`}
      style={{
        height: '72px',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-full w-full flex items-center justify-between">
 
        {/* ── Brand ── */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group transition-transform duration-300 active:scale-95">
          <LatexifyLogo size={36} className="text-primary" />
        </Link>
 
        {/* ── Actions ── */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <ThemeSwitcher />
          <Link href="/dashboard"
            className="glow-btn px-6 py-2.5 rounded-full text-xs font-bold text-white transition-all duration-300 hover:scale-105 active:scale-95 uppercase tracking-widest shadow-lg flex items-center justify-center"
            style={{ 
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', 
              boxShadow: '0 4px 20px color-mix(in srgb, var(--accent-primary) 35%, transparent)' 
            }}>
            Return to Dashboard
          </Link>
        </div>
 
      </div>
    </nav>
  );
};
 
export default ScholarlyNavbar;
