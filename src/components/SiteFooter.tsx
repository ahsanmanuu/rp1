"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "@/lib/pb-auth-react";
import LatexifyLogo from "./LatexifyLogo";
import { Share2, Code2, MessageSquare } from "lucide-react";

interface FooterLink {
  id: string;
  groupTitle: string;
  label: string;
  href?: string;
  linkKey?: string;
  isTargetBlank?: boolean;
  isActive: boolean;
  sortOrder: number;
}

const LINK_KEY_TO_HREF: Record<string, string> = {
  'Latexify Studio': '/latex-studio',
  'Doc2Latex': '/doc2latex',
  'Diagram Studio': '/diagrams',
  'Template Migrator': '/template-migrator',
  'Citation Studio': '/citations',
  'AI Peer Reviewer': '/reviewer',
};

const LABEL_TO_HREF: Record<string, string> = {
  'Latexify Studio': '/latex-studio',
  'Doc2Latex': '/doc2latex',
  'Diagram Studio': '/diagrams',
  'Template Migrator': '/template-migrator',
  'Citation Studio': '/citations',
  'AI Peer Reviewer': '/reviewer',
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
}

const FALLBACK_LINKS: FooterLink[] = [
  { id: 'fb-1', groupTitle: 'Platform', label: 'Latexify', href: '/', isActive: true, sortOrder: 1 },
  { id: 'fb-2', groupTitle: 'Platform', label: 'Pricing', href: '/pricing', isActive: true, sortOrder: 2 },
  { id: 'fb-3', groupTitle: 'Platform', label: 'About Us', href: '/about', isActive: true, sortOrder: 3 },
  { id: 'fb-4', groupTitle: 'Features', label: 'Latex Studio', href: '/latex-studio', isActive: true, sortOrder: 4 },
  { id: 'fb-5', groupTitle: 'Features', label: 'Templates', href: '/templates', isActive: true, sortOrder: 5 },
  { id: 'fb-6', groupTitle: 'Features', label: 'AI Review', href: '/reviewer', isActive: true, sortOrder: 6 },
  { id: 'fb-7', groupTitle: 'Support', label: 'Help Center', href: '/help', isActive: true, sortOrder: 7 },
  { id: 'fb-8', groupTitle: 'Support', label: 'Documentation', href: '/docs', isActive: true, sortOrder: 8 },
  { id: 'fb-9', groupTitle: 'Legal', label: 'Terms of Service', href: '/terms', isActive: true, sortOrder: 9 },
  { id: 'fb-10', groupTitle: 'Legal', label: 'Privacy Policy', href: '/privacy', isActive: true, sortOrder: 10 },
];

export default function SiteFooter({ onProductClick, onLoginRequired }: SiteFooterProps) {
  const [links, setLinks] = useState<FooterLink[]>([]);
  const { data: session } = useSession();

  useEffect(() => {
    fetch("/api/content/footer_links?activeOnly=true&sort=sortOrder")
      .then(r => r.json())
      .then(d => { if (d.success && d.data.length > 0) setLinks(d.data); else setLinks(FALLBACK_LINKS); })
      .catch(() => setLinks(FALLBACK_LINKS));
  }, []);

  const groups = links.reduce<Record<string, FooterLink[]>>((acc, link) => {
    if (!acc[link.groupTitle]) acc[link.groupTitle] = [];
    acc[link.groupTitle].push(link);
    return acc;
  }, {});

  return (
    <footer style={{ background: '#020b09', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10 md:py-14">
        <div className="flex flex-col lg:flex-row gap-16 mb-16">
          <div className="w-full lg:w-80 space-y-6 flex-shrink-0">
            <LatexifyLogo size={72} className="text-white" />
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              The modern, intelligent platform for the entire research writing lifecycle.
              Write, compile, cite, collaborate — all in one place.
            </p>
            <a href="https://info.flagcounter.com/g3uU" target="_blank" rel="noopener noreferrer">
              <img src="https://s01.flagcounter.com/count2/g3uU/bg_FFFFFF/txt_000000/border_CCCCCC/columns_2/maxflags_10/viewers_0/labels_0/pageviews_0/flags_0/percent_0/" alt="Flag Counter" style={{ maxWidth: '100%', border: 0 }} />
            </a>
            <div className="flex gap-3">
              {[Share2, Code2, MessageSquare].map((Icon, i) => (
                <button key={i}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Icon size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-10">
            {Object.entries(groups).map(([title, groupLinks]) => (
              <div key={title} className="space-y-5">
                <h4 className="text-sm font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.9)' }}>{title}</h4>
                <div className="space-y-3">
                  {groupLinks.map((link) => (
                    <Link key={link.id} href={resolveHref(link)}
                      className="block text-sm transition-colors hover:text-white"
                      style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            &copy; {new Date().getFullYear()} Latexify Inc. All rights reserved.
          </p>
          <div className="flex gap-5">
            {[{ label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }, { label: 'Contact', href: '/contact' }].map((item, i) => (
              <Link key={i} href={item.href} className="text-sm transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
