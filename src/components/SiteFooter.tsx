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

interface SiteFooterProps {
  onProductClick?: (linkKey: string) => void;
  onLoginRequired?: () => void;
}

export default function SiteFooter({ onProductClick, onLoginRequired }: SiteFooterProps) {
  const [links, setLinks] = useState<FooterLink[]>([]);
  const { data: session } = useSession();

  useEffect(() => {
    fetch("/api/content/footer_links?activeOnly=true&sort=sortOrder")
      .then(r => r.json())
      .then(d => { if (d.success) setLinks(d.data); })
      .catch(() => {});
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
              <img src="https://s01.flagcounter.com/count2/g3uU/bg_FFFFFF/txt_000000/border_CCCCCC/columns_2/maxflags_10/viewers_0/labels_0/pageviews_0/flags_0/percent_0/" alt="Flag Counter" border="0" style={{ maxWidth: '100%' }} />
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
                  {groupLinks.map((link) => {
                    if (link.label === "Templates Gallery") {
                      return (
                        <button key={link.id}
                          onClick={() => {
                            if (session?.user) {
                              window.location.href = link.href || '/templates';
                            } else if (onLoginRequired) {
                              onLoginRequired();
                            }
                          }}
                          className="block text-sm text-left w-full transition-colors hover:text-white"
                          style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {link.label}
                        </button>
                      );
                    }
                    if (title === "Products" && link.linkKey && onProductClick) {
                      return (
                        <button key={link.id}
                          onClick={() => onProductClick(link.linkKey!)}
                          className="block text-sm text-left w-full transition-colors hover:text-white"
                          style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {link.label}
                        </button>
                      );
                    }
                    return (
                      <Link key={link.id} href={link.href || '#'}
                        className="block text-sm transition-colors hover:text-white"
                        style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {link.label}
                      </Link>
                    );
                  })}
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
            {[{ label: 'Privacy', href: '#' }, { label: 'Terms', href: '#' }, { label: 'Contact', href: '/contact-us' }].map((item, i) => (
              <Link key={i} href={item.href} className="text-sm transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
