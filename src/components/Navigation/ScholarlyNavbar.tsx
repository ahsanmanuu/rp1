"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "@/lib/pb-auth-react";
import { usePathname } from "next/navigation";
import { 
  ChevronDown, Menu, X, FileEdit, Wand2, 
  PenTool, Layout, Library, Brain, ArrowRight
} from "lucide-react";
import ThemeSwitcher from "@/components/scholarly-editor/ThemeSwitcher";
import LatexifyLogo from "@/components/LatexifyLogo";

const TOOLS = [
  { label: "Latexify Studio", desc: "LaTeX editor & compiler", href: "/latex-studio/projects", icon: FileEdit, color: "var(--accent-primary)" },
  { label: "Doc2LateX Studio", desc: "Word → LaTeX conversion", href: "/upload", icon: Wand2, color: "#6b38d4" },
  { label: "AI Diagram Studio", desc: "Visual TikZ diagrams", href: "/diagrams/editor", icon: PenTool, color: "#f59e0b" },
  { label: "Template Migrator", desc: "Switch journal templates", href: "/template-migrator/studio", icon: Layout, color: "#0891b2" },
  { label: "AI Citation Studio", desc: "BibTeX & DOI manager", href: "/citations/studio", icon: Library, color: "#059669" },
  { label: "AI Peer Reviewer", desc: "Latexify AI feedback", href: "/reviewer/studio", icon: Brain, color: "#dc2626" },
];

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
];

export const ScholarlyNavbar = () => {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close tools dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); setToolsOpen(false); }, [pathname]);

  if (!mounted) return null;


  const isHome = pathname === "/";

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-[100] transition-all duration-300 ${scrolled ? "navbar-scrolled" : ""}`}
        style={{
          height: '68px',
          background: scrolled
            ? 'var(--bg-primary)'
            : isHome ? 'transparent' : 'var(--bg-primary)',
          borderBottom: scrolled || !isHome ? '1px solid var(--border)' : 'none',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-full flex items-center justify-between gap-8">

          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <LatexifyLogo size={60} className="text-primary" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">

            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href}
                className="nav-link-animated px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ 
                  color: pathname === link.href ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  backgroundColor: pathname === link.href ? 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' : 'transparent'
                }}
                onMouseEnter={e => {
                  if (pathname !== link.href) {
                    e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--accent-primary) 5%, transparent)';
                  }
                }}
                onMouseLeave={e => {
                  if (pathname !== link.href) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {link.label}
              </Link>
            ))}

            {/* Tools dropdown */}
            <div className="relative" ref={toolsRef}>
              <button
                onClick={() => setToolsOpen(o => !o)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--accent-primary) 5%, transparent)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                Tools
                <ChevronDown size={15} className={`transition-transform duration-200 ${toolsOpen ? 'rotate-180' : ''}`} />
              </button>

              {toolsOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[600px] rounded-3xl overflow-hidden shadow-2xl z-50"
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  {/* Header */}
                  <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                    <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                      Latexify Tools Suite
                    </p>
                  </div>
                  {/* Grid */}
                  <div className="grid grid-cols-2 gap-1 p-3">
                    {TOOLS.map(tool => (
                      <Link key={tool.href} href={tool.href}
                        className="flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 group"
                        style={{ color: 'var(--text-primary)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                          style={{ background: tool.color + '18' }}>
                          <tool.icon size={18} style={{ color: tool.color }} />
                        </div>
                        <div>
                          <div className="text-sm font-bold">{tool.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{tool.desc}</div>
                        </div>
                        <ArrowRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0"
                          style={{ color: tool.color }} />
                      </Link>
                    ))}
                  </div>
                  {/* Footer */}
                  <div className="px-6 py-4 flex items-center justify-between"
                    style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      6 powerful tools for academic researchers
                    </span>
                     <Link href="/login" className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                      Login to Access Free <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <ThemeSwitcher />
            {session ? (
              <>
                <Link href="/dashboard"
                  className="glow-btn px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: 'var(--accent-primary)' }}>
                  Dashboard
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.borderColor = '#ef4444'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login"
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                  Login
                </Link>
                <Link href="/register"
                  className="glow-btn px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', boxShadow: '0 4px 16px color-mix(in srgb, var(--accent-primary) 30%, transparent)' }}>
                  Get Started Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl transition-all"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X size={20} style={{ color: 'var(--text-primary)' }} /> : <Menu size={20} style={{ color: 'var(--text-primary)' }} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="mobile-menu-open fixed top-[68px] left-0 right-0 z-[99] max-h-[calc(100vh-68px)] overflow-y-auto"
          style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
          <div className="max-w-7xl mx-auto px-6 py-6 space-y-2">

            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all"
                style={{ color: 'var(--text-primary)', background: pathname === link.href ? 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' : 'transparent' }}>
                {link.label}
              </Link>
            ))}

            <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-xs font-black uppercase tracking-widest px-4 py-2" style={{ color: 'var(--text-secondary)' }}>Tools</p>
              {TOOLS.map(tool => (
                <Link key={tool.href} href={tool.href}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl transition-all"
                  style={{ color: 'var(--text-primary)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: tool.color + '18' }}>
                    <tool.icon size={16} style={{ color: tool.color }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{tool.label}</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{tool.desc}</div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex flex-col gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              {session ? (
                <>
                  <Link href="/dashboard" className="text-center py-3 rounded-2xl text-sm font-bold text-white"
                    style={{ background: 'var(--accent-primary)' }}>Dashboard</Link>
                  <button onClick={() => signOut({ callbackUrl: "/" })}
                    className="py-3 rounded-2xl text-sm font-bold text-red-500"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/register" className="text-center py-3 rounded-2xl text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>Get Started Free</Link>
                  <Link href="/login" className="text-center py-3 rounded-2xl text-sm font-bold"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                    Login
                  </Link>
                </>
              )}
              <div className="flex justify-center">
                <ThemeSwitcher />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScholarlyNavbar;
