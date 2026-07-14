"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@/lib/pb-auth-react";
import { useRouter } from "next/navigation";
import ProLoader from "@/components/ProLoader";
import LoginPromptModal from "@/components/LoginPromptModal";
import FloatingBanner from "@/components/FloatingBanner";
import SiteFooter from "@/components/SiteFooter";
import { useHomeRealtime } from '@/lib/useHomeRealtime';
import dynamic from 'next/dynamic';
const VideoPlayer = dynamic(() => import('@/components/VideoPlayer'), { ssr: false });
import {
  ArrowRight, FileEdit, Wand2, PenTool, Layout,
  Library, Star, School, Building2, BookOpen, Atom,
  ChevronRight,
  Check, Zap, Shield, Globe, Users, Trophy, Rocket, GraduationCap,
  Sparkles, PlayCircle, Brain, X, BarChart3, Search, Cpu,
  RefreshCw, Video, Play, Award
} from "lucide-react";

const FALLBACK_FEATURES = [
  { title: 'Latexify Dashboard', description: 'A modern, powerful, collaborative LaTeX editor designed for the web. Write with joy, compile with speed, share with ease.', icon: 'FileEdit', iconBg: 'var(--accent-primary)', glow: 'var(--accent-primary)', tags: ['Real-time Collab', 'Cloud Sync'], href: '/latex-studio/projects' },
  { title: 'Doc2Latex', description: 'Instantly convert Word documents into clean, well-structured LaTeX code. Bridge the gap with co-authors seamlessly.', icon: 'Wand2', iconBg: 'var(--accent-secondary)', glow: 'var(--accent-secondary)', tags: ['DOCX → LaTeX', 'Smart Parsing'], href: '/upload' },
  { title: 'Diagram Studio', description: 'Create beautiful TikZ diagrams with an intuitive visual canvas. No more wrestling with coordinates and syntax.', icon: 'PenTool', iconBg: '#f59e0b', glow: '#f59e0b', tags: ['Visual Editor', 'TikZ Export'], href: '/diagrams/editor' },
  { title: 'Template Migrator', description: 'Switch journals effortlessly. One click updates your document styling, margins, and bibliography formats instantly.', icon: 'Layout', iconBg: '#0891b2', glow: '#0891b2', tags: ['55+ Templates', 'IEEE, Nature, ACM'], href: '/template-migrator/studio' },
  { title: 'Citation Studio', description: 'Manage your bibliography seamlessly. Auto-fetch metadata via DOI, organize references with tags and export BibTeX.', icon: 'Library', iconBg: '#059669', glow: '#059669', tags: ['DOI Auto-fetch', 'BibTeX Export'], href: '/citations/studio' },
  { title: 'AI Peer Reviewer', description: 'Get instant, scholarly feedback on clarity, argumentation, and methodology. Like having a senior researcher on speed dial.', icon: 'Brain', iconBg: '#dc2626', glow: '#dc2626', tags: ['Logic Check', 'Grammar AI'], href: '/reviewer/studio' },
];

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  ArrowRight, FileEdit, Wand2, PenTool, Layout,
  Library, Star, School, Building2, BookOpen, Atom,
  ChevronRight,
  Check, Zap, Shield, Globe, Users, Trophy, Rocket, GraduationCap,
  Sparkles, PlayCircle, Brain, X, BarChart3, Search, Cpu,
  RefreshCw, Video, Play, Award,
};

function DynamicIcon({ name, size, color, className, style }: { name: string; size?: number; color?: string; className?: string; style?: React.CSSProperties }) {
  const Icon = ICON_MAP[name] || FileEdit;
  return <Icon size={size} color={color} className={className} style={style} />;
}

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
function FeatureCard({ feature, delay }: { feature: any; delay: number }) {
  const ref = useReveal();
  const { status } = useSession();
  const href = status === "authenticated" ? feature.href : "/login";
  return (
    <div ref={ref} className="feature-card rounded-3xl overflow-hidden"
      style={{ transitionDelay: `${delay}ms`, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <div className="p-8 h-full flex flex-col relative">
        {/* Soft glow orb */}
        <div className="absolute -right-16 -bottom-16 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: feature.glow }} />
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg flex-shrink-0"
          style={{ background: feature.iconBg }}>
          <DynamicIcon name={feature.icon} size={26} color="#fff" />
        </div>
        <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{feature.title}</h3>
        <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>{feature.desc}</p>
        {feature.tags && (
          <div className="flex flex-wrap gap-2 mt-6">
            {feature.tags.map((tag: string) => (
              <span key={tag} className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', color: 'var(--accent-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <Link href={href} className="mt-6 inline-flex items-center gap-2 text-sm font-bold group"
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
  const { data: homeData } = useHomeRealtime(status === "authenticated" || status === "loading");
  const [mounted, setMounted] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [activeProduct, setActiveProduct] = useState<string | null>(null);
  const [activeHowItWorks, setActiveHowItWorks] = useState<number>(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [videos, setVideos] = useState<any[]>([]);

  const banners = homeData.banners;
  const testimonials = homeData.testimonials;
  const galleryItems = homeData.galleryItems;
  const institutionLogos = homeData.institutionLogos;
  const features = homeData.features.length > 0 ? homeData.features : FALLBACK_FEATURES;
  const benefits = homeData.benefits;
  const productDetails = homeData.productDetails;

  const howItWorks = homeData.howItWorks;
  const tasarStats = homeData.tasarStats;
  const platformStats = homeData.platformStats;

  const statResearchers = platformStats.find((s: any) => s.key === 'totalResearchers')?.value || 50000;
  const statPagesCompiled = platformStats.find((s: any) => s.key === 'pagesCompiled')?.value || 1200000;
  const statTemplates = platformStats.find((s: any) => s.key === 'journalTemplates')?.value || 55;
  const statUptime = platformStats.find((s: any) => s.key === 'uptime')?.value || 99.9;
  const statScholarsActive = platformStats.find((s: any) => s.key === 'scholarsActive')?.value || 18450;
  const statSystemsOperational = platformStats.find((s: any) => s.key === 'systemsOperational')?.value !== 0;

  let initialsArr: string[] = (institutionLogos.slice(0, 5) as any[]).map((l: any) => l.name?.charAt(0) || '?');
  if (initialsArr.length === 0) initialsArr = ['E', 'J', 'S', 'A', 'R'];

  useEffect(() => {
    setMounted(true);
    if (status === "authenticated") router.replace("/dashboard");
  }, [status]);

  useEffect(() => {
    fetch('/api/content/videos')
      .then(r => r.json())
      .then(d => { if (d.success) setVideos(d.data.filter((v: any) => v.isActive).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const len = testimonials.length || 1;
    const t = setInterval(() => setActiveTestimonial(p => (p + 1) % len), 5000);
    return () => clearInterval(t);
  }, [testimonials.length]);

  const effectiveBannerCount = banners.length;
  useEffect(() => {
    if (effectiveBannerCount <= 1) return;
    const timer = setInterval(() => setBannerIndex(i => (i + 1) % effectiveBannerCount), 5000);
    return () => clearInterval(timer);
  }, [effectiveBannerCount]);

  if (!mounted) return <ProLoader />;

  const mainContent = status === "authenticated" ? null : (
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

        <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-16 w-full py-8 md:py-12 lg:py-16">

          {/* Banner Carousel — loaded from PB with real-time sync */}
          {banners.length > 0 && (
            <div className="relative w-full overflow-hidden rounded-2xl mb-8">
              <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${bannerIndex * 100}%)` }}>
                {banners.map((banner, idx) => (
                  <div key={banner.id || `fb-${idx}`} className="w-full flex-shrink-0 relative">
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
                <button onClick={() => { if (videos.length > 0 || howItWorks.length > 0) { setActiveHowItWorks(0); setShowHowItWorksModal(true); } }}
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold transition-all duration-300"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <PlayCircle size={22} style={{ color: 'var(--accent-primary)' }} />
                  See How It Works
                </button>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-6 pt-2">
                <div className="flex -space-x-3">
                  {initialsArr.map((l, i) => (
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
                    Trusted by <strong style={{ color: 'var(--text-primary)' }}>{statResearchers.toLocaleString()}+</strong> researchers worldwide
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
                    {[...galleryItems, ...galleryItems].filter(Boolean).map((item, i) => (
                      <div key={`${item.id}-${i}`} className="flex-shrink-0 w-56 h-full rounded-2xl overflow-hidden relative group"
                        style={{ border: '1px solid var(--border)' }}>
                        <Image src={item.imageUrl || '/placeholder.png'} alt={item.title} loading="lazy" fill
                          className="object-cover transition-transform duration-700 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--accent-primary)' }}>
                            <FileEdit size={15} color="#fff" />
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

      {/* ═══════════════ SEE HOW IT WORKS ═══════════════ */}
      {howItWorks.length > 0 && (
        <section className="w-full py-8 md:py-12" style={{ background: 'var(--bg-primary)' }}>
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="text-center mb-8 md:mb-10 space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest"
                style={{ background: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)', color: 'var(--accent-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)' }}>
                <Play size={12} /> See How It Works
              </div>
              <h2 className="font-black tracking-tight" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: 'var(--text-primary)' }}>
                Get started in <span className="gradient-text-animated">3 simple steps</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {howItWorks.sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((step: any, i: number) => (
                <div key={step.id} className="relative group">
                  <div className="absolute -top-3 -left-3 w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black"
                    style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
                    {step.stepNumber || i + 1}
                  </div>
                  <div className="p-8 pt-10 rounded-3xl transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    {step.imageUrl && (
                      <div className="mb-5 rounded-2xl overflow-hidden">
                        <Image src={step.imageUrl} alt={step.title} width={400} height={250} className="w-full h-48 object-cover" />
                      </div>
                    )}
                    {step.videoUrl && (
                      <button onClick={() => { setActiveHowItWorks(i); setShowHowItWorksModal(true); }}
                        className="mb-5 relative w-full h-48 rounded-2xl overflow-hidden group/vid">
                        <Image src={step.imageUrl || '/placeholder.png'} alt={step.title} width={400} height={250} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover/vid:bg-black/40 transition-all">
                          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl group-hover/vid:scale-110 transition-transform">
                            <Play size={28} fill="var(--accent-primary)" style={{ color: 'var(--accent-primary)', marginLeft: 2 }} />
                          </div>
                        </div>
                      </button>
                    )}
                    <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{step.title}</h3>
                    {step.description && <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{step.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How It Works Video Modal */}
      {showHowItWorksModal && (videos[activeHowItWorks]?.videoUrl || howItWorks[activeHowItWorks]?.videoUrl) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setShowHowItWorksModal(false)}>
          <div className="relative w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl animate-[scaleIn_0.3s_ease-out]"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowHowItWorksModal(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-all">
              <X size={20} />
            </button>
            {(() => {
              const video = videos[activeHowItWorks];
              const url = video?.videoUrl || howItWorks[activeHowItWorks]?.videoUrl;
              if (!url) return null;
              const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
              if (isYouTube) {
                return (
                  <div className="relative" style={{ paddingBottom: '56.25%' }}>
                    <iframe src={url.replace('watch?v=', 'embed/')}
                      className="absolute inset-0 w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
                  </div>
                );
              }
              return <VideoPlayer src={url} poster={video?.posterUrl} autoPlay />;
            })()}
          </div>
        </div>
      )}

      {/* ═══════════════ STATS SECTION ═══════════════ */}
      <section style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-6 md:py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <StatItem value={statResearchers} suffix="+" label="Researchers" />
            <StatItem value={statPagesCompiled} suffix="+" label="Pages Compiled" />
            <StatItem value={statTemplates} suffix="+" label="Journal Templates" />
            <StatItem value={statUptime} suffix="%" label="Uptime" decimals={1} />
          </div>
        </div>
      </section>

      {/* ═══════════════ TASAR STATS ═══════════════ */}
      {tasarStats.length > 0 && (
        <section className="w-full py-8 md:py-10" style={{ background: 'var(--bg-primary)' }}>
          <div className="max-w-7xl mx-auto px-6 lg:px-12">
            <div className="text-center mb-6 space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest"
                style={{ background: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)', color: 'var(--accent-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)' }}>
                <BarChart3 size={12} /> T.A.S.A.R
              </div>
              <h2 className="font-black tracking-tight" style={{ fontSize: 'clamp(1.6rem, 2.5vw, 2.2rem)', color: 'var(--text-primary)' }}>
                Tools · Academic · Statistical · Analytics · Research
              </h2>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {tasarStats.sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((stat: any) => {
                const catColors: Record<string, string> = {
                  tools: '#4f46e5', academic: '#059669', statistical: '#f59e0b',
                  analytics: '#0891b2', research: '#dc2626',
                };
                const color = stat.color || catColors[stat.category] || 'var(--accent-primary)';
                return (
                  <div key={stat.id} className="relative group w-[calc(50%-0.5rem)] md:w-[calc(20%-1rem)] min-w-[140px] max-w-[220px]">
                    <div className="p-6 rounded-2xl text-center transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                        style={{ background: `${color}18` }}>
                        <BarChart3 size={22} style={{ color }} />
                      </div>
                      <div className="text-3xl font-black mb-1 tabular-nums" style={{ color }}>
                        {stat.value}{stat.suffix || ''}
                      </div>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{stat.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ TRUST LOGOS ═══════════════ */}
      <section className="w-full py-6 md:py-8" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <p className="text-center text-xs font-black uppercase tracking-[0.4em] mb-6 opacity-50"
            style={{ color: 'var(--text-secondary)' }}>
            Trusted by researchers at world-leading institutions
          </p>
          <div className="trust-logos-row flex flex-wrap justify-center items-center gap-12 lg:gap-20">
            {institutionLogos.map((logo, i) => (
              <div key={logo.id || i} className="trust-logo flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ background: 'var(--accent-primary)' }}>
                  <School size={20} />
                </div>
                <span className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{logo.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES SECTION ═══════════════ */}
      <section className="w-full py-8 md:py-12" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          {/* Section header */}
          <div className="text-center mb-8 md:mb-10 space-y-3">
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
            {features.map((f, i) => <FeatureCard key={f.id || i} feature={f} delay={i * 80} />)}
          </div>
        </div>
      </section>

      {/* ═══════════════ WHY LATEXIFY ═══════════════ */}
      <section className="w-full py-8 md:py-12" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">

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
                {benefits.map((b, i) => (
                  <div key={b.id || i} className="flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 hover:shadow-md"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: b.color + '18' }}>
                      <DynamicIcon name={b.icon} size={18} style={{ color: b.color }} />
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
      <section className="w-full py-8 md:py-12" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-8 md:mb-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest"
              style={{ background: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)', color: 'var(--accent-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)' }}>
              <Users size={12} /> From The Community
            </div>
            <h2 className="font-black tracking-tight" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', color: 'var(--text-primary)' }}>
              Loved by the Academic Community
            </h2>
          </div>

          {/* Testimonials carousel */}
          {testimonials.length > 0 && (
            <div className="relative overflow-hidden" style={{ minHeight: '280px' }}>
              <div className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${activeTestimonial * 100}%)` }}>
                {testimonials.map((t, i) => (
                  <div key={t.id} className="w-full flex-shrink-0 px-4">
                    <div className="p-8 md:p-10 rounded-3xl text-center max-w-2xl mx-auto"
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                      <p className="text-base md:text-lg leading-relaxed mb-6 italic" style={{ color: 'var(--text-primary)', opacity: 0.9 }}>
                        &ldquo;{t.content}&rdquo;
                      </p>
                      {t.rating && (
                        <div className="flex justify-center gap-1 mb-5">
                          {Array.from({ length: t.rating }).map((_, j) => (
                            <span key={j} className="text-yellow-400 text-xl">★</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-3">
                        {t.avatarUrl ? (
                          <Image src={t.avatarUrl} alt={t.name} width={52} height={52} className="rounded-full object-cover w-13 h-13" />
                        ) : (
                          <div className="w-13 h-13 rounded-full flex items-center justify-center text-xl font-black text-white shrink-0"
                            style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
                            {t.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="text-left">
                          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                          {t.role && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.role}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dots */}
          {testimonials.length > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, i) => (
                <button key={i} onClick={() => setActiveTestimonial(i)}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === activeTestimonial ? '24px' : '8px',
                    height: '8px',
                    background: i === activeTestimonial ? 'var(--accent-primary)' : 'var(--border)'
                  }} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════ CTA SECTION ═══════════════ */}
      <section className="w-full py-8 md:py-12 relative overflow-hidden"
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
      <SiteFooter onProductClick={(key) => setActiveProduct(key)} onLoginRequired={() => setShowLoginModal(true)} />

      {/* ── Product Modal ── */}
      {activeProduct && (() => {
        const p = productDetails.find((pd: any) => pd.key === activeProduct);
        if (!p) return null;
        const iconMap: Record<string, any> = { FileEdit, Wand2, PenTool, Layout, Library, Brain };
        const Icon = iconMap[p.icon] || FileEdit;
        return (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setActiveProduct(null)}>
            <div className="relative w-[90vw] max-w-2xl rounded-3xl overflow-hidden animate-[scaleIn_0.3s_ease-out]"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color, rgba(255,255,255,0.1))', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
              onClick={e => e.stopPropagation()}>
              <div className="h-1.5 w-full" style={{ background: p.color }} />
              <div className="p-8">
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
                <p className="text-base leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
                  {p.desc}
                </p>
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
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
    </>
  );

  return (
    <>
      {mainContent}
      <FloatingBanner userEmail={session?.user?.email} />
    </>
  );
}

// All data now loaded from PocketBase via useHomeRealtime hook
