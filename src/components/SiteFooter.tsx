"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LatexifyLogo from "./LatexifyLogo";
import { Share2, Code2, MessageSquare, ArrowUpRight } from "lucide-react";

interface FooterLink {
  id: string;
  groupTitle: string;
  label: string;
  href?: string;
  linkKey?: string;
  isActive: boolean;
  sortOrder: number;
}

const LINK_KEY_TO_HREF: Record<string, string> = {
  'Latexify Studio': '/latex-studio',
  'Doc2Latex': '/upload',
  'Diagram Studio': '/diagrams/editor',
  'Template Migrator': '/template-migrator/studio',
  'Citation Studio': '/citations/studio',
  'AI Peer Reviewer': '/reviewer/studio',
};

const LABEL_TO_HREF: Record<string, string> = {
  'Latexify Studio': '/latex-studio',
  'Doc2Latex': '/upload',
  'Diagram Studio': '/diagrams/editor',
  'Template Migrator': '/template-migrator/studio',
  'Citation Studio': '/citations/studio',
  'AI Peer Reviewer': '/reviewer/studio',
  'Pricing': '/pricing',
  'Templates Gallery': '/templates',
  'Help Center': '/help',
  'About Us': '/about',
  'Blog': '/blog',
  'Careers': '/careers',
  'Contact': '/contact',
  'Privacy Policy': '/privacy',
  'Terms of Service': '/terms',
  'Cookie Policy': '/cookies',
  'GDPR': '/gdpr',
  'Dashboard': '/dashboard',
  'Home': '/',
};

function resolveHref(link: FooterLink): string {
  if (link.href && link.href !== '#') return link.href;
  if (link.linkKey && LINK_KEY_TO_HREF[link.linkKey]) return LINK_KEY_TO_HREF[link.linkKey];
  if (LABEL_TO_HREF[link.label]) return LABEL_TO_HREF[link.label];
  return '#';
}

interface SiteFooterProps {
  onProductClick?: (linkKey: string) => void;
  onLoginRequired?: () => void;
  footerLinks?: any[];
}

const STUDIO_FALLBACK_LINKS: FooterLink[] = [
  { id: 'fb-1', groupTitle: 'Products', label: 'Latexify Studio', href: '/latex-studio', linkKey: 'Latexify Studio', isActive: true, sortOrder: 1 },
  { id: 'fb-2', groupTitle: 'Products', label: 'Doc2Latex', href: '/upload', linkKey: 'Doc2Latex', isActive: true, sortOrder: 2 },
  { id: 'fb-3', groupTitle: 'Products', label: 'Diagram Studio', href: '/diagrams/editor', linkKey: 'Diagram Studio', isActive: true, sortOrder: 3 },
  { id: 'fb-4', groupTitle: 'Products', label: 'Template Migrator', href: '/template-migrator/studio', linkKey: 'Template Migrator', isActive: true, sortOrder: 4 },
  { id: 'fb-5', groupTitle: 'Products', label: 'Citation Studio', href: '/citations/studio', linkKey: 'Citation Studio', isActive: true, sortOrder: 5 },
  { id: 'fb-6', groupTitle: 'Products', label: 'AI Peer Reviewer', href: '/reviewer/studio', linkKey: 'AI Peer Reviewer', isActive: true, sortOrder: 6 },
  { id: 'fb-7', groupTitle: 'Navigation', label: 'Dashboard', href: '/dashboard', isActive: true, sortOrder: 1 },
  { id: 'fb-8', groupTitle: 'Navigation', label: 'Home', href: '/', isActive: true, sortOrder: 2 },
];

const MAIN_FALLBACK_LINKS: FooterLink[] = [
  { id: 'fb-1', groupTitle: 'Products', label: 'Latexify Studio', href: '/latex-studio', linkKey: 'Latexify Studio', isActive: true, sortOrder: 1 },
  { id: 'fb-2', groupTitle: 'Products', label: 'Doc2Latex', href: '/upload', linkKey: 'Doc2Latex', isActive: true, sortOrder: 2 },
  { id: 'fb-3', groupTitle: 'Products', label: 'Diagram Studio', href: '/diagrams/editor', linkKey: 'Diagram Studio', isActive: true, sortOrder: 3 },
  { id: 'fb-4', groupTitle: 'Products', label: 'Template Migrator', href: '/template-migrator/studio', linkKey: 'Template Migrator', isActive: true, sortOrder: 4 },
  { id: 'fb-5', groupTitle: 'Products', label: 'Citation Studio', href: '/citations/studio', linkKey: 'Citation Studio', isActive: true, sortOrder: 5 },
  { id: 'fb-6', groupTitle: 'Products', label: 'AI Peer Reviewer', href: '/reviewer/studio', linkKey: 'AI Peer Reviewer', isActive: true, sortOrder: 6 },
  { id: 'fb-7', groupTitle: 'Resources', label: 'Pricing', href: '/pricing', isActive: true, sortOrder: 1 },
  { id: 'fb-8', groupTitle: 'Resources', label: 'Templates Gallery', href: '/templates', isActive: true, sortOrder: 2 },
  { id: 'fb-9', groupTitle: 'Resources', label: 'Help Center', href: '/help', isActive: true, sortOrder: 3 },
  { id: 'fb-10', groupTitle: 'Company', label: 'About Us', href: '/about', isActive: true, sortOrder: 1 },
  { id: 'fb-11', groupTitle: 'Company', label: 'Careers', href: '/careers', isActive: true, sortOrder: 2 },
  { id: 'fb-12', groupTitle: 'Company', label: 'Blog', href: '/blog', isActive: true, sortOrder: 3 },
  { id: 'fb-13', groupTitle: 'Company', label: 'Contact', href: '/contact', isActive: true, sortOrder: 4 },
  { id: 'fb-14', groupTitle: 'Legal', label: 'Privacy Policy', href: '/privacy', isActive: true, sortOrder: 1 },
  { id: 'fb-15', groupTitle: 'Legal', label: 'Terms of Service', href: '/terms', isActive: true, sortOrder: 2 },
  { id: 'fb-16', groupTitle: 'Legal', label: 'Cookie Policy', href: '/cookies', isActive: true, sortOrder: 3 },
  { id: 'fb-17', groupTitle: 'Legal', label: 'GDPR', href: '/gdpr', isActive: true, sortOrder: 4 },
];

function filterStudioLinks(linksList: FooterLink[]): FooterLink[] {
  return linksList.filter(link => {
    const resolved = resolveHref(link);
    return resolved === '/' || resolved === '/dashboard' || resolved.startsWith('/latex-studio') || resolved === '/upload' || resolved.startsWith('/diagrams') || resolved.startsWith('/template-migrator') || resolved.startsWith('/citations') || resolved.startsWith('/reviewer');
  }).map(link => {
    if (link.label === 'Home' || link.label === 'Dashboard') {
      return { ...link, groupTitle: 'Navigation' };
    }
    return link;
  });
}

export default function SiteFooter({ onProductClick, onLoginRequired, footerLinks }: SiteFooterProps) {
  const [links, setLinks] = useState<FooterLink[]>([]);
  const pathname = usePathname();
  const isStudio = pathname.startsWith("/latex-studio");

  useEffect(() => {
    if (footerLinks !== undefined) {
      const baseLinks = footerLinks.length > 0 ? footerLinks : (isStudio ? STUDIO_FALLBACK_LINKS : MAIN_FALLBACK_LINKS);
      setLinks(isStudio ? filterStudioLinks(baseLinks) : baseLinks);
      return;
    }
    fetch("/api/content/footer_links?activeOnly=true&sort=sortOrder")
      .then(r => r.json())
      .then(d => { 
        if (d.success && d.data.length > 0) {
          const filtered = d.data.filter((l: any) => {
            const resolved = resolveHref(l);
            return resolved !== '#';
          });
          setLinks(isStudio ? filterStudioLinks(filtered) : filtered);
        } else {
          setLinks(isStudio ? STUDIO_FALLBACK_LINKS : MAIN_FALLBACK_LINKS);
        }
      })
      .catch(() => setLinks(isStudio ? STUDIO_FALLBACK_LINKS : MAIN_FALLBACK_LINKS));
  }, [footerLinks, isStudio]);

  const groups = links.reduce<Record<string, FooterLink[]>>((acc, link) => {
    if (!acc[link.groupTitle]) acc[link.groupTitle] = [];
    acc[link.groupTitle].push(link);
    return acc;
  }, {});

  return (
    <footer className="relative overflow-hidden w-full border-t border-slate-200/10 dark:border-slate-800/50"
      style={{ 
        background: 'linear-gradient(180deg, #090d16 0%, #03050a 100%)', 
        color: 'rgba(255,255,255,0.7)' 
      }}>
      
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[300px] rounded-full pointer-events-none opacity-20 blur-[100px]"
        style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 80%)' }} />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[250px] rounded-full pointer-events-none opacity-10 blur-[80px]"
        style={{ background: 'radial-gradient(circle, var(--accent-secondary) 0%, transparent 80%)' }} />

      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 md:py-16 relative z-10">
        <div className="flex flex-col lg:flex-row gap-16 mb-12">
          
          {/* Brand */}
          <div className="w-full lg:w-80 space-y-6 flex-shrink-0">
            <LatexifyLogo size={42} className="text-white" />
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              The modern, intelligent platform for the entire research writing lifecycle.
              Write, compile, cite, collaborate — all in one place.
            </p>
            
            {/* Flag Counter only on main page */}
            {!isStudio && (
              <div className="pt-2">
                <a href="https://info.flagcounter.com/g3uU" target="_blank" rel="noopener noreferrer" className="inline-block opacity-70 hover:opacity-100 transition-opacity">
                  <img src="https://s01.flagcounter.com/count2/g3uU/bg_FFFFFF/txt_000000/border_CCCCCC/columns_2/maxflags_10/viewers_0/labels_0/pageviews_0/flags_0/percent_0/" alt="Flag Counter" style={{ maxWidth: '100%', border: 0 }} />
                </a>
              </div>
            )}

            {/* Socials */}
            <div className="flex gap-3 pt-2">
              {[Share2, Code2, MessageSquare].map((Icon, i) => (
                <button key={i}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-slate-800/80 active:scale-95 border border-slate-700/30"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <Icon size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Columns */}
          <div className="flex-grow grid grid-cols-2 md:grid-cols-4 gap-10 lg:pl-12">
            {Object.entries(groups).map(([title, groupLinks]) => (
              <div key={title} className="space-y-5">
                <h4 className="text-xs font-black uppercase tracking-widest text-white/90 border-b border-slate-700/20 pb-2">
                  {title}
                </h4>
                <div className="space-y-3">
                  {groupLinks.map((link) => (
                    <Link key={link.id} href={resolveHref(link)}
                      className="group/link flex items-center gap-1 text-sm transition-all duration-200 hover:text-white hover:translate-x-1"
                      style={{ color: 'rgba(255,255,255,0.45)' }}>
                      <span>{link.label}</span>
                      <ArrowUpRight size={12} className="opacity-0 group-hover/link:opacity-100 transition-all duration-200" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
        </div>

        {/* Bottom */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-8 border-t border-slate-800/60">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            &copy; {new Date().getFullYear()} Latexify Inc. All rights reserved.
          </p>
          <div className="flex gap-6">
            {isStudio ? (
              <>
                <Link href="/" className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.35)' }}>Home</Link>
                <Link href="/dashboard" className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.35)' }}>Dashboard</Link>
              </>
            ) : (
              <>
                <Link href="/privacy" className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.35)' }}>Privacy</Link>
                <Link href="/terms" className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.35)' }}>Terms</Link>
                <Link href="/contact" className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.35)' }}>Contact</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
