"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface FloatingBannerItem {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  targetType: "global" | "specific";
  targetEmail?: string;
  width: number;
  height: number;
  duration: number;
  isActive: boolean;
  sortOrder: number;
}

export default function FloatingBanner({ userEmail, banners: propBanners }: { userEmail?: string | null; banners?: FloatingBannerItem[] }) {
  const [banner, setBanner] = useState<FloatingBannerItem | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function pickMatched(items: FloatingBannerItem[]) {
      const matched = items.find(b =>
        b.targetType === "global" ||
        (b.targetType === "specific" && b.targetEmail && userEmail && b.targetEmail.toLowerCase() === userEmail.toLowerCase())
      );
      if (matched && !cancelled) {
        setBanner(matched);
        requestAnimationFrame(() => { if (!cancelled) setVisible(true); });
        const ms = (matched.duration || 5) * 1000;
        setTimeout(() => { if (!cancelled) setVisible(false); }, ms + 600);
      }
    }

    if (propBanners && propBanners.length > 0) {
      pickMatched(propBanners);
    } else {
      fetch("/api/content/floating_banners?activeOnly=true&sort=sortOrder")
        .then(r => r.json())
        .then(d => { if (d.success && !cancelled) pickMatched(d.data || []); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [userEmail, propBanners]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => setDismissed(true), 650);
  }, []);

  if (!banner || dismissed) return null;

  const w = Math.min(Math.max(banner.width || 4, 2), 8) * 96;
  const h = Math.min(Math.max(banner.height || 6, 3), 12) * 96;

  return (

    <div
      className="fixed z-[9999]"
      style={{
        bottom: "24px",
        right: "24px",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl border"
        style={{
          width: `${w}px`,
          height: `${h}px`,
          borderColor: "rgba(255,255,255,0.1)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.85) translateY(20px)",
          transition: "opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {banner.linkUrl ? (
          <Link href={banner.linkUrl} className="block w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
          </Link>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
        )}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-black/50 text-white hover:bg-black/70 transition-all hover:rotate-90"
          aria-label="Close banner"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
