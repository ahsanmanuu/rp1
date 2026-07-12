"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@/lib/pb-auth-react";
import { createPb } from '@/lib/pb';
import { useRouter } from "next/navigation";
import LatexifyLogo from "@/components/LatexifyLogo";
import ProLoader from "@/components/ProLoader";
import LoginPromptModal from "@/components/LoginPromptModal";
import {
  ArrowRight, FileEdit, Wand2, PenTool, Layout,
  Library, Star, School, Building2, BookOpen, Atom,
  Share2, MessageSquare, Code2, ChevronRight,
  Check, Zap, Shield, Globe, Users, Trophy, Rocket, GraduationCap,
  Sparkles, PlayCircle, Brain, X
} from "lucide-react";

/* ─── Animated Stats Counter ──────────────────────────────── */
function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    started.current = false; // Reset when target changes (e.g. after API response)
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const elapsed = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - elapsed, 4);
            // Keep one decimal of precision so Uptime can show 100.0
            setCount(Math.round(ease * target * 10) / 10);
            if (elapsed < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}

/* ─── Scroll Reveal Hook ──────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add("visible"); },
      { threshold: 0.12 }
    );
    el.classList.add("reveal-card");
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ─── Individual Stat Item ────────────────────────────────── */
function StatItem({ value, suffix, label, decimals = 0 }: { value: number; suffix: string; label: string; decimals?: number }) {
  const { count, ref } = useCountUp(value);
  const formattedCount = decimals > 0
    ? count.toFixed(decimals)
    : Math.round(count).toLocaleString();
  return (
    <div className="flex flex-col items-center gap-1">
      <span ref={ref} className="text-5xl font-black tabular-nums" style={{ color: 'var(--accent-primary)' }}>
        {formattedCount}{suffix}
      </span>
      <span className="text-sm font-semibold tracking-widest uppercase opacity-60">{label}</span>
    </div>
  );
}

/* ─── Feature Card ────────────────────────────────────────── */
function FeatureCard({ feature, delay }: { feature: typeof FEATURES[0]; delay: number }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="feature-card rounded-3xl overflow-hidden"
      style={{ transitionDelay: `${delay}ms`, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <div className="p-8 h-full flex flex-col relative">
        {/* Soft glow orb */}
        <div className="absolute -right-16 -bottom-16 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: feature.glow }} />
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg flex-shrink-0"
          style={{ background: feature.iconBg }}>
          <feature.icon size={26} color="#fff" />
        </div>
        <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{feature.title}</h3>
        <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>{feature.desc}</p>
        {feature.tags && (
          <div className="flex flex-wrap gap-2 mt-6">
            {feature.tags.map(tag => (
              <span key={tag} className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', color: 'var(--accent-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <Link href={feature.href} className="mt-6 inline-flex items-center gap-2 text-sm font-bold group"
          style={{ color: 'var(--accent-primary)' }}>
          Explore <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */
export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [banners, setBanners] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [realStats, setRealStats] = useState<any>({
    totalUsers: 0,
    totalProjects: 0,
    totalTemplates: 0,
    uptimePercent: 99.9,
    totalReviews: 0,
  });
  const [bannerIndex, setBannerIndex] = useState(0);
  const [activeProduct, setActiveProduct] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  const [proloaderTimeout, setProloaderTimeout] = useState(false);

  const [stats, setStats] = useState({
    systemsOperational: true,
    scholarsActive: 18450,
    initials: ['E', 'J', 'S', 'A', 'R'],
    totalResearchers: 50000,
    pagesCompiled: 1200000,
    journalTemplates: 55,
    uptime: 100.0
  });

  useEffect(() => {
    const t = setTimeout(() => setProloaderTimeout(true), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setMounted(true);
    if (status === "authenticated") router.replace("/dashboard");
  }, [status]);

  // Fetch real-time platform statistics from database
  useEffect(() => {
    const fetchPlatformStats = () => {
      fetch('/api/platform-stats')
        .then(res => res.json())
        .then(data => {
          if (data && data.success !== false) {
            setStats({
              systemsOperational: data.systemsOperational ?? true,
              scholarsActive: data.scholarsActive ?? 18492,
              initials: data.initials ?? ['E', 'J', 'S', 'A', 'R'],
              totalResearchers: data.totalResearchers ?? 50000,
              pagesCompiled: data.pagesCompiled ?? 1200000,
              journalTemplates: data.journalTemplates ?? 55,
              uptime: data.uptime ?? 100.0
            });
          }
        })
        .catch(err => console.info("Platform statistics are currently using cached offline fallbacks."));
    };

    // Initial fetch
    fetchPlatformStats();

    // Refresh every 30 seconds for live feel
    const refreshInterval = setInterval(fetchPlatformStats, 30000);
    return () => clearInterval(refreshInterval);
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const len = testimonials.length > 0 ? testimonials.length : TESTIMONIALS.length;
    const t = setInterval(() => setActiveTestimonial(p => (p + 1) % len), 5000);
    return () => clearInterval(t);
  }, [testimonials.length]);

  // Fetch banners, testimonials, and real stats from PB
  useEffect(() => {
    async function fetchHomeData() {
      try {
        const pb = createPb();
        const [bannerRecords, testimonialRecords] = await Promise.all([
          pb.collection('banners').getFullList({ sort: 'sortOrder', filter: 'isActive=true' }),
          pb.collection('testimonials').getFullList({ sort: 'sortOrder', filter: 'isActive=true' }),
        ]);
        setBanners(bannerRecords);
        setTestimonials(testimonialRecords);
        
        // Fetch real stats
        try {
          const statsRes = await fetch('/api/platform-stats');
          const statsData = await statsRes.json();
          if (statsData?.stats) {
            setRealStats(prev => ({ ...prev, ...statsData.stats }));
          }
        } catch {}
      } catch (e) {
        console.warn('Failed to fetch home data from PB', e);
      }
    }
    fetchHomeData();
    
    // PB realtime subscription
    let unsubBanners: (() => void) | undefined;
    let unsubTestimonials: (() => void) | undefined;
    
    async function setupRealtime() {
      try {
        const pb = createPb();
        unsubBanners = await pb.collection('banners').subscribe('*', (e) => {
          if (e.action === 'create' && e.record.isActive) {
            setBanners(prev => [...prev, e.record]);
          } else if (e.action === 'update') {
            setBanners(prev => prev.map(b => b.id === e.record.id ? e.record : b));
          } else if (e.action === 'delete') {
            setBanners(prev => prev.filter(b => b.id !== e.record.id));
          }
        }, { filter: 'isActive=true' });
        
        unsubTestimonials = await pb.collection('testimonials').subscribe('*', (e) => {
          if (e.action === 'create' && e.record.isActive) {
            setTestimonials(prev => [...prev, e.record]);
          } else if (e.action === 'update') {
            setTestimonials(prev => prev.map(t => t.id === e.record.id ? e.record : t));
          } else if (e.action === 'delete') {
            setTestimonials(prev => prev.filter(t => t.id !== e.record.id));
          }
        }, { filter: 'isActive=true' });
      } catch (e) {
        console.warn('Failed to setup PB realtime for home page', e);
      }
    }
    setupRealtime();
    
    return () => {
      unsubBanners?.();
      unsubTestimonials?.();
    };
  }, []);

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => setBannerIndex(i => (i + 1) % banners.length), 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if ((!mounted || status === "authenticated") && !proloaderTimeout) {
    return <ProLoader />;
  }

  return (
    <>
    <style>{`@keyframes scaleIn{from{opacity:0;transform:scale(0.85) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-inter)', overflowX: 'hidden' }}>

      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <section className="relative w-full min-h-screen flex flex-col justify-center overflow-hidden"
        style={{ paddingTop: '80px' }}>

        {/* Background: dot grid */}
        <div className="hero-grid absolute inset-0 pointer-events-none" />

        {/* Background orbs */}
        <div className="animate-float-slow absolute top-[15%] right-[8%] w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,104,95,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="animate-float-medium absolute bottom-[20%] left-[5%] w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(107,56,212,0.10) 0%, transparent 70%)', filter: 'blur(60px)' }} />

        <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-16 w-full py-12 md:py-16 lg:py-20">

          {/* Banner Carousel */}
          {banners.length > 0 && (
            <div className="relative w-full overflow-hidden rounded-2xl mb-8">
              <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${bannerIndex * 100}%)` }}>
                {banners.map(banner => (
                  <div key={banner.id} className="w-full flex-shrink-0 relative">
                    {banner.linkUrl ? (
                      <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer">
                        <Image src={banner.imageUrl} alt={banner.title} width={1200} height={400} className="w-full h-[300px] md:h-[400px] object-cover rounded-2xl" />
                      </a>
                    ) : (
                      <Image src={banner.imageUrl} alt={banner.title} width={1200} height={400} className="w-full h-[300px] md:h-[400px] object-cover rounded-2xl" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-2xl" />
                    <div className="absolute bottom-6 left-6 text-white">
                      <h3 className="text-2xl md:text-3xl font-bold">{banner.title}</h3>
                      {banner.subtitle && <p className="text-white/80 mt-1">{banner.subtitle}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {/* Dots indicator */}
              {banners.length > 1 && (
                <div className="absolute bottom-4 right-4 flex gap-2">
                  {banners.map((_, i) => (
                    <button key={i} onClick={() => setBannerIndex(i)} className={`w-2.5 h-2.5 rounded-full transition-all ${i === bannerIndex ? 'bg-white w-6' : 'bg-white/50'}`} />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">

            {/* ── Left: Hero Text ── */}
            <div className="w-full lg:w-[56%] space-y-8">

              {/* Badge */}
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full text-sm font-semibold"
                style={{ background: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)', color: 'var(--accent-primary)' }}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-badge-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ background: 'var(--accent-primary)' }} />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: 'var(--accent-primary)' }} />
                </span>
                <Sparkles size={14} />
                Now with AI-Powered Peer Review
              </div>

              {/* Headline */}
              <div>
                <h1 className="font-black tracking-tight leading-[1.08]"
                  style={{ fontSize: 'clamp(2.6rem, 5vw, 4.2rem)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>Academic Publishing,</span>
                  <br />
                  <span className="gradient-text-animated">Reimagined.</span>
                </h1>
              </div>

              {/* Subline */}
              <p className="text-base md:text-lg leading-relaxed text-justify max-w-2xl w-full block" 
                style={{ 
                  color: 'var(--text-secondary)', 
                  textAlign: 'justify', 
                  textJustify: 'inter-word',
                  wordBreak: 'normal',
                  overflowWrap: 'break-word',
                  whiteSpace: 'normal'
                }}>
                Ditch archaic editors. Latexify brings intelligent collaboration, modern design,
                and delightful simplicity to your entire research writing lifecycle.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link href="/register"
                  className="glow-btn inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all duration-300"
                  style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', boxShadow: '0 4px 24px color-mix(in srgb, var(--accent-primary) 35%, transparent)' }}>
                  Start Writing Free
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <button className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold transition-all duration-300"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <PlayCircle size={22} style={{ color: 'var(--accent-primary)' }} />
                  See How It Works
                </button>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-6 pt-2">
                <div className="flex -space-x-3">
                  {stats.initials.map((l, i) => (
                    <div key={i} className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2"
                      style={{ background: ['var(--accent-primary)','var(--accent-secondary)','#00a395','#f59e0b','#ef4444'][i % 5], outline: '2px solid var(--bg-primary)', outlineOffset: '-1px' }}>
                      {l}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_,i) => <Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />)}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Trusted by <strong style={{ color: 'var(--text-primary)' }}>{stats.totalResearchers.toLocaleString()}+</strong> researchers worldwide
                  </p>
                </div>
              </div>
            </div>

            {/* ── Right: Gallery Slider ── */}
            <div className="w-full lg:w-[44%] relative">
              {/* Frame */}
              <div className="relative rounded-3xl overflow-hidden"
                style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)', boxShadow: '0 32px 80px rgba(0,0,0,0.12)' }}>

                {/* Corner glow */}
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(0,104,95,0.25), transparent 70%)', filter: 'blur(30px)' }} />

                {/* Header bar */}
                <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full" style={{ background: 'var(--accent-primary)' }} />
                  <span className="ml-3 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>latexify.studio</span>
                </div>

                {/* Marquee gallery */}
                <div className="overflow-hidden" style={{ height: '280px' }}>
                  <div className="animate-marquee h-full items-stretch gap-4 p-4">
                    {[...GALLERY_ITEMS, ...GALLERY_ITEMS].map((item, i) => (
                      <div key={i} className="flex-shrink-0 w-56 h-full rounded-2xl overflow-hidden relative group"
                        style={{ border: '1px solid var(--border)' }}>
                        <Image src={item.image} alt={item.title} loading="lazy" width={0} height={0} sizes="100%"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--accent-primary)' }}>
                            <item.icon size={15} color="#fff" />
                          </div>
                          <span className="text-sm font-bold text-white leading-tight">{item.title}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-5 -left-5 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
                  <Zap size={20} color="#fff" />
                </div>
                <div>
                  <div className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>AI-Powered</div>
                  <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Compilation Engine</div>
                </div>
              </div>

              {/* Accuracy badge */}
              <div className="absolute -top-5 -right-5 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl"
                style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: '#fff' }}>
                <Trophy size={16} />
                <span className="text-sm font-black">99.9% Accuracy</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-50">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Scroll</span>
          <div className="w-0.5 h-8 rounded-full" style={{ background: 'var(--border)' }} />
        </div>
      </section>

      {/* ═══════════════ STATS SECTION ═══════════════ */}
      <section style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10 md:py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
            <StatItem value={realStats.totalUsers || stats.totalResearchers} suffix="+" label="Researchers" />
            <StatItem value={realStats.totalProjects || stats.pagesCompiled} suffix="+" label="Pages Compiled" />
            <StatItem value={realStats.totalTemplates || stats.journalTemplates} suffix="+" label="Journal Templates" />
            <StatItem value={realStats.uptimePercent || stats.uptime} suffix="%" label="Uptime" decimals={1} />
          </div>
        </div>
      </section>

      {/* ═══════════════ TRUST LOGOS ═══════════════ */}
      <section className="w-full py-10 md:py-12" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <p className="text-center text-xs font-black uppercase tracking-[0.4em] mb-8 opacity-50"
            style={{ color: 'var(--text-secondary)' }}>
            Trusted by researchers at world-leading institutions
          </p>
          <div className="trust-logos-row flex flex-wrap justify-center items-center gap-12 lg:gap-20">
            {TRUST_LOGOS.map((logo, i) => (
              <div key={i} className="trust-logo flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ background: 'var(--accent-primary)' }}>
                  <logo.icon size={20} />
                </div>
                <span className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{logo.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES SECTION ═══════════════ */}
      <section className="w-full py-14 md:py-18" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          {/* Section header */}
          <div className="text-center mb-12 md:mb-16 space-y-5">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest"
              style={{ background: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)', color: 'var(--accent-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)' }}>
              <Rocket size={12} /> Complete Research Studio
            </div>
            <h2 className="font-black tracking-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: 'var(--text-primary)' }}>
              Everything your research workflow needs,<br />
              <span className="gradient-text-animated">elegantly unified.</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Six powerful tools. One seamless platform. From writing to publishing.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => <FeatureCard key={i} feature={f} delay={i * 80} />)}
          </div>
        </div>
      </section>

      {/* ═══════════════ WHY LATEXIFY ═══════════════ */}
      <section className="w-full py-14 md:py-18" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">

            {/* Left visual card */}
            <div className="w-full lg:w-1/2 relative">
              <div className="rounded-3xl p-8 space-y-4"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}>
                {/* Fake editor header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent-primary)' }} />
                  </div>
                  <div className="text-xs font-mono px-3 py-1 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>main.tex</div>
                </div>

                {/* Fake code lines */}
                <div className="font-mono text-sm space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
                  {[
                    { c: 'var(--accent-secondary)', t: '\\documentclass' },
                    { c: 'var(--accent-primary)', t: '\\usepackage{algorithm}' },
                    { c: 'var(--accent-primary)', t: '\\usepackage{graphicx}' },
                    { c: 'var(--text-secondary)', t: '' },
                    { c: '#f59e0b', t: '\\begin{document}' },
                    { c: 'var(--text-primary)', t: '  \\title{Deep Learning for Medical Imaging}' },
                    { c: 'var(--text-primary)', t: '  \\maketitle' },
                    { c: 'var(--accent-secondary)', t: '  \\begin{abstract}' },
                  ].map((line, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="w-6 text-right text-xs opacity-30">{i + 1}</span>
                      <span style={{ color: line.c }}>{line.t || '\u00A0'}</span>
                    </div>
                  ))}
                </div>

                {/* Compile btn */}
                <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--accent-primary)' }} />
                      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--accent-primary)' }} />
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ready to compile</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold"
                    style={{ background: 'var(--accent-primary)' }}>
                    <Zap size={12} /> Compile PDF
                  </div>
                </div>
              </div>

              {/* Floating success toast */}
              <div className="absolute -bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
                style={{ background: 'var(--bg-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
                  <Check size={16} color="#fff" />
                </div>
                <div>
                  <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>PDF Compiled!</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>in 1.4s — 8 pages</div>
                </div>
              </div>
            </div>

            {/* Right: Benefits */}
            <div className="w-full lg:w-1/2 space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest"
                style={{ background: 'color-mix(in srgb, var(--accent-secondary) 8%, transparent)', color: 'var(--accent-secondary)', border: '1px solid color-mix(in srgb, var(--accent-secondary) 20%, transparent)' }}>
                <Shield size={12} /> Why Latexify?
              </div>
              <h2 className="font-black tracking-tight" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: 'var(--text-primary)' }}>
                Built for the modern researcher.
                <span className="gradient-text-animated"> Not the 1980s.</span>
              </h2>
              <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Traditional LaTeX editors were built for a different era. Latexify brings the power of modern web technology
                — real-time collaboration, AI assistance, and beautiful design — to academic publishing.
              </p>
              <div className="space-y-5">
                {BENEFITS.map((b, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 hover:shadow-md"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: b.color + '18' }}>
                      <b.icon size={18} style={{ color: b.color }} />
                    </div>
                    <div>
                      <div className="font-bold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{b.title}</div>
                      <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ TESTIMONIALS ═══════════════ */}
      <section className="w-full py-14 md:py-18" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12 md:mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest"
              style={{ background: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)', color: 'var(--accent-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)' }}>
              <Users size={12} /> From The Community
            </div>
            <h2 className="font-black tracking-tight" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: 'var(--text-primary)' }}>
              Loved by the Academic Community
            </h2>
          </div>

          {/* Testimonials grid */}
          {testimonials.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <div key={t.id} className="testimonial-card p-8 rounded-3xl"
                  style={{
                    background: i === activeTestimonial ? 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 6%, transparent), color-mix(in srgb, var(--accent-secondary) 6%, transparent))' : 'var(--bg-primary)',
                    border: i === activeTestimonial ? '1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)' : '1px solid var(--border)',
                    transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)'
                  }}>
                  <div className="flex items-center gap-3 mb-4">
                    {t.avatarUrl ? (
                      <Image src={t.avatarUrl} alt={t.name} width={48} height={48} className="rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black text-white"
                        style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
                        {t.name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                      {t.role && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.role}</p>}
                    </div>
                  </div>
                  <p className="text-base leading-relaxed mb-6 italic" style={{ color: 'var(--text-primary)', opacity: 0.85 }}>
                    "{t.content}"
                  </p>
                  {t.rating && (
                    <div className="flex gap-1 mb-5">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <span key={i} className="text-yellow-400 text-lg">★</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Fallback to hardcoded testimonials */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="testimonial-card p-8 rounded-3xl"
                  style={{
                    background: i === activeTestimonial ? 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 6%, transparent), color-mix(in srgb, var(--accent-secondary) 6%, transparent))' : 'var(--bg-primary)',
                    border: i === activeTestimonial ? '1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)' : '1px solid var(--border)',
                    transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)'
                  }}>
                  {/* Stars */}
                  <div className="flex gap-1 mb-5">
                    {[...Array(5)].map((_, j) => <Star key={j} size={15} fill="#f59e0b" color="#f59e0b" />)}
                  </div>
                  <p className="text-base leading-relaxed mb-6 italic" style={{ color: 'var(--text-primary)', opacity: 0.85 }}>
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black text-white"
                      style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
                      {t.name[0]}
                    </div>
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {(testimonials.length > 0 ? testimonials : TESTIMONIALS).map((_, i) => (
              <button key={i} onClick={() => setActiveTestimonial(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === activeTestimonial ? '24px' : '8px',
                  height: '8px',
                  background: i === activeTestimonial ? 'var(--accent-primary)' : 'var(--border)'
                }} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA SECTION ═══════════════ */}
      <section className="w-full py-14 md:py-18 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 30%, black) 0%, color-mix(in srgb, var(--accent-primary) 15%, black) 60%, #0f0a2e 100%)' }}>
        {/* Orb */}
        <div className="animate-float-slow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-secondary) 15%, transparent) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        {/* Beam */}
        <div className="animate-beam absolute top-0 left-0 w-40 h-full pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)', transform: 'skewX(-20deg)' }} />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <Rocket size={12} /> Get Started Today — It's Free
          </div>
          <h2 className="font-black tracking-tight text-white" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', lineHeight: 1.1 }}>
            Ready to transform your<br />research workflow?
          </h2>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Join 50,000+ researchers who have already made the switch. No credit card required.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link href="/register"
              className="glow-btn inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-base font-bold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', boxShadow: '0 8px 32px color-mix(in srgb, var(--accent-primary) 50%, transparent)' }}>
              Create Free Account <ArrowRight size={20} />
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-base font-bold transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
              Sign In
            </Link>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            ✓ Free forever plan &nbsp;&nbsp; ✓ No credit card &nbsp;&nbsp; ✓ Cancel anytime
          </p>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer style={{ background: '#020b09', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10 md:py-14">
          <div className="flex flex-col lg:flex-row gap-16 mb-16">

            {/* Brand */}
            <div className="w-full lg:w-80 space-y-6 flex-shrink-0">
              <LatexifyLogo size={72} className="text-white" />
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                The modern, intelligent platform for the entire research writing lifecycle.
                Write, compile, cite, collaborate — all in one place.
              </p>
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

            {/* Nav columns */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-10">
              {FOOTER_LINKS.map((col, i) => (
                <div key={i} className="space-y-5">
                  <h4 className="text-sm font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {col.title}
                  </h4>
                  <div className="space-y-3">
                    {col.links.map((link: any, j: number) => {
                      if (link.label === "Templates Gallery") {
                        return (
                          <button
                            key={j}
                            onClick={() => {
                              setShowLoginModal(true);
                            }}
                            className="footer-link text-sm block text-left w-full"
                            style={{ color: 'rgba(255,255,255,0.5)' }}
                          >
                            {link.label}
                          </button>
                        );
                      }
                      return col.title === "Products" ? (
                        <button key={j} onClick={() => setActiveProduct(link.key)}
                          className="footer-link text-sm block text-left w-full"
                          style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {link.label}
                        </button>
                      ) : (
                        <Link key={j} href={link.href} className="footer-link text-sm block"
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

          {/* ── Product Modal ── */}
          {activeProduct && (() => {
            const p = PRODUCT_DETAILS[activeProduct];
            if (!p) return null;
            const Icon = p.icon;
            return (
              <div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
                onClick={() => setActiveProduct(null)}>
                <div className="relative w-[90vw] max-w-2xl rounded-3xl overflow-hidden animate-[scaleIn_0.3s_ease-out]"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color, rgba(255,255,255,0.1))', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
                  onClick={e => e.stopPropagation()}>
                  {/* Top accent bar */}
                  <div className="h-1.5 w-full" style={{ background: p.color }} />
                  <div className="p-8">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                          style={{ background: `${p.color}20` }}>
                          <Icon size={28} style={{ color: p.color }} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{p.title}</h3>
                          <span className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: p.color }}>Featured Tool</span>
                        </div>
                      </div>
                      <button onClick={() => setActiveProduct(null)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform hover:scale-110"
                        style={{ background: 'var(--bg-tertiary, rgba(255,255,255,0.06))' }}>
                        <X size={18} style={{ color: 'var(--text-secondary)' }} />
                      </button>
                    </div>
                    {/* Description */}
                    <p className="text-base leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
                      {p.desc}
                    </p>
                    {/* Features */}
                    <div className="space-y-2.5 mb-8">
                      {p.features.slice(0, 4).map((f: string, k: number) => (
                        <div key={k} className="flex items-center gap-3 text-sm px-4 py-2.5 rounded-xl"
                          style={{ background: 'var(--bg-tertiary, rgba(255,255,255,0.04))' }}>
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span style={{ color: 'var(--text-primary)' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    {/* Action */}
                    <Link href="/login" onClick={() => setActiveProduct(null)}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all hover:gap-3"
                      style={{ background: p.color, color: '#fff' }}>
                      Open {p.title} <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Bottom bar */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-8"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              © 2025 Latexify Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" 
                  style={{ background: stats.systemsOperational ? '#10b981' : '#f59e0b' }} />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full" 
                  style={{ background: stats.systemsOperational ? '#10b981' : '#f59e0b', boxShadow: stats.systemsOperational ? '0 0 10px rgba(16,185,129,0.8)' : '0 0 10px rgba(245,158,11,0.8)' }} />
              </span>
              <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {stats.systemsOperational ? 'All systems operational' : 'System experiencing delays'}
              </span>
              <span className="text-xs font-black" style={{ color: '#10b981' }}>
                {stats.scholarsActive.toLocaleString()} Scholars Active
              </span>
            </div>
            <div className="flex gap-5">
              {['Privacy', 'Terms', 'Contact'].map((item, i) => (
                <Link key={i} href={item === 'Contact' ? '/contact-us' : '#'} className="text-sm transition-colors hover:text-white"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>{item}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
    </>
  );
}

/* ─── DATA ─────────────────────────────────────────────────── */
const GALLERY_ITEMS = [
  { title: "Latexify Dashboard", image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAfrx0rEK6VFLoe2g-XBz3W3v-F9ySny3wIO0GvOU4er61lUuTBVHvwYLUuqIs0AJoAKS007oi-Eol9Htta-GTRBF4xxAzzuqQgAhgqDtjr8p6Z7Q6hg2CSB3wQNqCGWWMQXkcp8v6Lso_Le622A3nyeH7Lev3cMioXKpnxZKCMHLPVS0ExSKUiPxYmzKIWcN6Coo758Jx_tmEY5RDPLzN1a48mBPKfpqaAgI6i5xGtO4pQLyEzyTTvYn2VnmuYr49zlqcD5RuJ2VLq", icon: FileEdit },
  { title: "Doc2Latex Dashboard", image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDFtYyOpkpxGhljL4YEO1ZBLJZMbOn9gPHP8fXetmJnFR08eYC253o5M68i_jcmYGp_5iIjQ-JcBvvPO2alyZtkmAQ9nUYWjTd93LI_3N2A-FX8hLaCsZj-SLMSfhLToozbAF84ghM2FjYb4cnBUrA3DL-8YbTm4JPkf2ykIRWS461AjyRuzsmLCfQRunK5eOGjPJt5kFsqPzc3IF5aWizqmst_t4ttOirs6mspuA6M1RDIUXBrfirHyzXDyIaZJ5vtvRC3UkZz_A_o", icon: Wand2 },
  { title: "Diagram Studio", image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCOfpdp7avfxHVymJ06UtjZny3PXYwWBlHy4rpi8PV7-YGXFfygei_YZV65NdCKAQfE4DuhwJVAdCrE4-JoRKmljz10dSgkNXgv5F3blSGIPbm-6vQRe0_OrtZzV49Mxi7nwF-XXZzkzf8YjZrLYr2o4KLZflRtfrY3WY0NNTblCY-q7F0rLGOfjwoHMxC6LNP6KqqBj_jnRgs7NOX4Me-ldmMJtt38-V4YCjxpmuUxTRgfP3TncR6coVeklb0q5ABJYPH4zCIbqmoe", icon: PenTool },
  { title: "Template Migrator", image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAvQz491UjMaxItAqkAnkLEZDgbYQ9z3q4zdYq38xoFSNUtLSnoZEOYC584Bvw7070Yl5ia_mk8-wXycVUgmpjy6ZlOR6rh7vzwgjoolh01S0287jDHSpx6jQRhXuoo6B5SD7y4-MHAERQDO1wARSXJLiGs6dkIMw3gnQHs8Jlvr5c888M_d6SJ3VZIJVy69OKgQ2F7064lqQ1EtLt8PJIq-QQNF-enp8jKqJpjS1A9yNc61ktBXG8LfIZV7x6MET473uxu1fQKjpDl", icon: Layout },
  { title: "Citation Studio", image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDXqWg4r7vKDSzOnA0vncm3Wcm8hiUnA9ngYcljj07eIpRK1_hbIL48t5ZMclJE_UHSwtLaKqtgC2X-457idjJlXGAtQnmbg9Kb0q5B4XzhowAyZXfRN4mFH_7aHmOOky0uti0CXVHCteoBw8TiLZVjkqa-acr8ayfGU3zI-lFqdMZaib4Gc5ZzR7Pad7NVXJpW8hokDNJvZYX30qVrX5sR6Uc9OE8nJHJOHkRH-9uIoq6HLMBZxEmozks34yZZRKMtb_IkwqULnDop", icon: Library },
  { title: "AI Peer Reviewer", image: "/ai_peer_reviewer_dashboard_1777058436599.png", icon: Brain },
];

const TRUST_LOGOS = [
  { name: "MIT", icon: School },
  { name: "Stanford", icon: Building2 },
  { name: "Oxford", icon: BookOpen },
  { name: "CERN", icon: Atom },
  { name: "Harvard", icon: GraduationCap },
];

const FEATURES = [
  { title: "Latexify Dashboard", desc: "A modern, powerful, collaborative LaTeX editor designed for the web. Write with joy, compile with speed, share with ease.", icon: FileEdit, iconBg: 'var(--accent-primary)', glow: 'var(--accent-primary)', tags: ["Real-time Collab", "Cloud Sync"], href: "/latex-studio" },
  { title: "Doc2Latex", desc: "Instantly convert Word documents into clean, well-structured LaTeX code. Bridge the gap with co-authors seamlessly.", icon: Wand2, iconBg: 'var(--accent-secondary)', glow: 'var(--accent-secondary)', tags: ["DOCX → LaTeX", "Smart Parsing"], href: "/upload" },
  { title: "Diagram Studio", desc: "Create beautiful TikZ diagrams with an intuitive visual canvas. No more wrestling with coordinates and syntax.", icon: PenTool, iconBg: '#f59e0b', glow: '#f59e0b', tags: ["Visual Editor", "TikZ Export"], href: "/diagrams" },
  { title: "Template Migrator", desc: "Switch journals effortlessly. One click updates your document styling, margins, and bibliography formats instantly.", icon: Layout, iconBg: '#0891b2', glow: '#0891b2', tags: ["55+ Templates", "IEEE, Nature, ACM"], href: "/template-migrator" },
  { title: "Citation Studio", desc: "Manage your bibliography seamlessly. Auto-fetch metadata via DOI, organize references with tags and export BibTeX.", icon: Library, iconBg: '#059669', glow: '#059669', tags: ["DOI Auto-fetch", "BibTeX Export"], href: "/citations" },
  { title: "AI Peer Reviewer", desc: "Get instant, scholarly feedback on clarity, argumentation, and methodology. Like having a senior researcher on speed dial.", icon: Brain, iconBg: '#dc2626', glow: '#dc2626', tags: ["Logic Check", "Grammar AI"], href: "/reviewer" },
];

const BENEFITS = [
  { title: "Lightning-Fast Compilation", desc: "Cloud-powered LaTeX cluster compiles your manuscript in under 3 seconds. No local installation needed.", icon: Zap, color: '#f59e0b' },
  { title: "Enterprise-Grade Security", desc: "AES-256 encrypted storage with isolated project namespaces. Your research stays private.", icon: Shield, color: '#0891b2' },
  { title: "Works Everywhere", desc: "Browser-based IDE works on any device. Start on your laptop, continue on your tablet.", icon: Globe, color: '#6b38d4' },
  { title: "Real-time Collaboration", desc: "Invite co-authors, share links, and review changes together in real time.", icon: Users, color: 'var(--accent-primary)' },
];

const TESTIMONIALS = [
  { name: "Dr. Elena Rostova", role: "Postdoctoral Fellow, MIT", quote: "Latexify's template migrator saved me weeks of reformatting when my paper was transferred between journals. The UI is incredibly clean." },
  { name: "James Chen", role: "PhD Candidate, Stanford University", quote: "The AI Peer Reviewer caught several logical gaps in my methodology section before submission. An absolute game-changer for solo researchers." },
  { name: "Prof. Sarah Jenkins", role: "Principal Investigator, University of Oxford", quote: "I've moved my entire lab to Latexify. Collaborative writing is finally seamless, and the Doc2Latex feature means my undergrads can contribute easily." },
];

const PRODUCT_DETAILS: Record<string, { title: string; desc: string; icon: any; color: string; features: string[]; href: string }> = {
  'Latexify Studio': { title: 'Latexify Studio', desc: 'A modern, powerful, collaborative LaTeX editor designed for the web. Write with joy, compile with speed, share with ease.', icon: FileEdit, color: '#00685f', href: '/latex-studio', features: ['Real-time collaboration with co-authors', 'Cloud-sync across all devices', 'pdfLaTeX, LuaLaTeX, XeLaTeX support', 'Live PDF preview with split view', 'Syntax highlighting & auto-complete', 'Version history & restore'] },
  'Doc2Latex': { title: 'Doc2LateX', desc: 'Instantly convert Word documents into clean, well-structured LaTeX code. Bridge the gap with co-authors seamlessly.', icon: Wand2, color: '#545f73', href: '/upload', features: ['DOCX to LaTeX in one click', 'Smart formatting preservation', 'Table & image handling', 'Bibliography conversion', 'Math equation parsing', 'Batch document processing'] },
  'Diagram Studio': { title: 'AI Diagram Studio', desc: 'Create beautiful TikZ diagrams with an intuitive visual canvas. No more wrestling with coordinates and syntax.', icon: PenTool, color: '#f59e0b', href: '/diagrams', features: ['Visual drag-and-drop canvas', 'AI-powered diagram generation', 'Export to TikZ code', 'Pre-built template library', 'Real-time preview', 'Import from Visio & Draw.io'] },
  'Template Migrator': { title: 'Template Migrator', desc: 'Switch journals effortlessly. One click updates your document styling, margins, and bibliography formats instantly.', icon: Layout, color: '#0891b2', href: '/template-migrator', features: ['55+ journal templates', 'One-click format switching', 'Automatic margin & spacing', 'Bibliography style conversion', 'IEEE, Nature, ACM, Elsevier support', 'Custom template import'] },
  'Citation Studio': { title: 'AI Citation Studio', desc: 'Manage your bibliography seamlessly. Auto-fetch metadata via DOI, organize references with tags and export BibTeX.', icon: Library, color: '#059669', href: '/citations', features: ['DOI auto-fetch metadata', 'BibTeX & BibLaTeX export', 'Tag-based organization', 'Duplicate detection', 'Multi-style formatting', 'Zotero & Mendeley import'] },
  'AI Peer Reviewer': { title: 'AI Peer Reviewer', desc: 'Get instant, scholarly feedback on clarity, argumentation, and methodology. Like having a senior researcher on speed dial.', icon: Brain, color: '#dc2626', href: '/reviewer', features: ['Grammar & style analysis', 'Logical gap detection', 'Methodology assessment', 'Citation quality check', 'Readability scoring', 'Revision suggestions'] },
};

const FOOTER_PRODUCTS_LINKS = Object.keys(PRODUCT_DETAILS).map(label => ({ label, key: label }));

const FOOTER_LINKS = [
  { title: "Products", links: [
    { label: "Latexify Studio", key: "Latexify Studio" },
    { label: "Doc2Latex", key: "Doc2Latex" },
    { label: "Diagram Studio", key: "Diagram Studio" },
    { label: "Template Migrator", key: "Template Migrator" },
    { label: "Citation Studio", key: "Citation Studio" },
    { label: "AI Peer Reviewer", key: "AI Peer Reviewer" },
  ]},
  { title: "Resources", links: [
    { label: "Pricing", href: "/pricing" },
    { label: "Templates Gallery", href: "/templates" },
    { label: "Help Center", href: "#" },
  ]},
  { title: "Company", links: [
    { label: "About Us", href: "/about" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "/contact-us" },
  ]},
  { title: "Legal", links: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Cookie Policy", href: "#" },
    { label: "GDPR", href: "#" },
  ]},
];
