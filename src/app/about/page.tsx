'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/pb-auth-react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, CheckCircle2, Zap, Shield, Globe, Users, Brain, BookOpen, Target, Heart, Quote, Share2, Code2, MessageSquare } from 'lucide-react';
import LatexifyLogo from '@/components/LatexifyLogo';
import LoginPromptModal from '@/components/LoginPromptModal';

const STATS = [
  { value: 50000, suffix: '+', label: 'Researchers' },
  { value: 55, suffix: '+', label: 'Journal Templates' },
  { value: 1200000, suffix: '+', label: 'Pages Compiled' },
  { value: 99.9, suffix: '%', label: 'Uptime', decimals: 1 },
];

const VALUES = [
  { title: 'Open Science', desc: 'We believe research should be accessible. Our platform removes technical barriers so scholars can focus on discovery.', icon: BookOpen, color: '#00685f' },
  { title: 'Innovation First', desc: 'We merge AI with academic workflows to create tools that anticipate needs, not just react to them.', icon: Zap, color: '#6b38d4' },
  { title: 'Researcher Privacy', desc: 'Your intellectual property stays yours. We design every feature with data sovereignty and security at its core.', icon: Shield, color: '#0891b2' },
  { title: 'Community Driven', desc: 'Built by researchers, for researchers. Every feature is shaped by real academic workflows and feedback.', icon: Heart, color: '#dc2626' },
];

const TEAM = [
  { name: 'Dr. Arjun Mehta', role: 'Founder & CEO', desc: 'Former Postdoc at MIT. PhD in Computational Linguistics. Built Latexify to solve the collaboration gap he experienced firsthand.', color: '#00685f' },
  { name: 'Priya Sharma', role: 'CTO', desc: 'Ex-Google engineer, open-source contributor. Architect of the real-time compilation engine powering Latexify.', color: '#6b38d4' },
  { name: 'Prof. Rajesh Kumar', role: 'Advisor', desc: 'Dean of Research, IIT Kanpur. Guides platform strategy to align with institutional research needs.', color: '#0891b2' },
  { name: 'Dr. Sneha Patel', role: 'Head of AI', desc: 'PhD in NLP from Oxford. Leads development of the AI Peer Review and citation intelligence systems.', color: '#f59e0b' },
];

const MILESTONES = [
  { year: '2023', event: 'Platform launched with core LaTeX editor and compiler' },
  { year: '2023', event: 'Doc2LaTeX conversion engine released — 10K users in first month' },
  { year: '2024', event: 'AI Peer Reviewer beta — 50K researchers onboarded globally' },
  { year: '2024', event: 'Citation Studio & Template Migrator launched' },
  { year: '2025', event: 'Enterprise partnerships with 12 top-tier universities' },
  { year: '2026', event: '100K+ active researchers, 55+ journal templates, AI Diagram Studio' },
];

function useCountUp(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || started.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const animate = (now: number) => {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.round(eased * target));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);

  return { count, ref };
}

function StatItem({ value, suffix, label, decimals = 0 }: { value: number; suffix: string; label: string; decimals?: number }) {
  const { count, ref } = useCountUp(value);
  const formatted = decimals > 0 ? count.toFixed(decimals) : count.toLocaleString();
  return (
    <div className="flex flex-col items-center gap-1">
      <span ref={ref} className="text-4xl md:text-5xl font-black tabular-nums" style={{ color: 'var(--accent-primary)' }}>
        {formatted}{suffix}
      </span>
      <span className="text-xs md:text-sm font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setRevealed(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, revealed };
}

function RevealSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, revealed } = useReveal();
  return (
    <div ref={ref}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={revealed ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}

const FOOTER_PRODUCTS = [
  { label: 'Latexify Studio', href: '/latex-studio' },
  { label: 'Doc2LateX', href: '/upload' },
  { label: 'Diagram Studio', href: '/diagrams' },
  { label: 'Template Migrator', href: '/template-migrator' },
];
const FOOTER_RESOURCES = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Templates Gallery', href: '/templates' },
  { label: 'Citation Studio', href: '/citations' },
  { label: 'AI Reviewer', href: '/reviewer' },
  { label: 'Help Center', href: '#' },
];
const FOOTER_COMPANY = [
  { label: 'About Us', href: '/about' },
  { label: 'Careers', href: '#' },
  { label: 'Blog', href: '#' },
  { label: 'Contact', href: '/contact-us' },
];
const FOOTER_LEGAL = [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Service', href: '#' },
  { label: 'Cookie Policy', href: '#' },
  { label: 'GDPR', href: '#' },
];

const SOCIAL_ICONS = [Share2, Code2, MessageSquare];

export default function AboutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showLoginModal, setShowLoginModal] = useState(false);
  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-inter)', overflowX: 'hidden' }}>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[5%] left-[10%] w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 10%, transparent), transparent 70%)', filter: 'blur(70px)' }} />
          <div className="absolute bottom-[15%] right-[8%] w-[350px] h-[350px] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, #6b38d4 8%, transparent), transparent 70%)', filter: 'blur(50px)' }} />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6" style={{ background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)', color: 'var(--accent-primary)' }}>
              <Sparkles size={14} />
              Our Story
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="font-black tracking-tight mb-6" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', color: 'var(--text-primary)' }}>
            Empowering Research Writing <br />
            <span className="gradient-text-animated">Worldwide</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="text-lg md:text-xl max-w-3xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Latexify was born from a simple observation: researchers spend too much time fighting with formatting 
            and not enough time on discovery. We built a platform that eliminates technical friction so scholars 
            can focus on what matters — advancing human knowledge.
          </motion.p>
        </div>
      </section>

      {/* Stats */}
      <RevealSection>
        <section className="pb-20 px-6">
          <div className="max-w-5xl mx-auto p-8 md:p-12 rounded-3xl relative overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 5%, transparent), transparent 70%)', filter: 'blur(60px)' }} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 relative z-10">
              {STATS.map((s, i) => <StatItem key={i} {...s} />)}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Mission */}
      <RevealSection>
        <section className="pb-20 px-6">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
                Our <span className="gradient-text-animated">Mission</span>
              </h2>
              <div className="space-y-4">
                <p className="text-base leading-relaxed text-justify" style={{ color: 'var(--text-secondary)' }}>
                  To democratize academic publishing by providing every researcher — regardless of institution, 
                  funding, or technical background — with world-class writing and collaboration tools.
                </p>
                <p className="text-base leading-relaxed text-justify" style={{ color: 'var(--text-secondary)' }}>
                  We believe the best research comes from removing barriers. Our AI-powered suite handles 
                  the mechanics of formatting, citations, and language review so you can focus on ideas.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-8">
                {['LaTeX', 'AI', 'Collaboration', 'Open Access'].map((tag, i) => (
                  <span key={i} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', color: 'var(--accent-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-8 rounded-3xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent), color-mix(in srgb, #6b38d4 5%, transparent))', border: '1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)' }}>
              <Target size={40} style={{ color: 'var(--accent-primary)' }} className="mb-4" />
              <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Our Vision</h3>
              <p className="text-sm leading-relaxed text-justify" style={{ color: 'var(--text-secondary)' }}>
                A world where every researcher has access to the same powerful tools, regardless of their 
                institution's budget. Where language and formatting barriers no longer slow scientific progress.
              </p>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Values */}
      <RevealSection>
        <section className="pb-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4" style={{ color: 'var(--text-primary)' }}>
                What We <span className="gradient-text-animated">Believe</span>
              </h2>
              <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Four principles guide every decision we make and every feature we build.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {VALUES.map((v, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  whileHover={{ y: -4 }}
                  className="p-6 rounded-3xl transition-all duration-300"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: v.color + '18' }}>
                    <v.icon size={24} style={{ color: v.color }} />
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{v.title}</h3>
                  <p className="text-sm leading-relaxed text-justify" style={{ color: 'var(--text-secondary)' }}>{v.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Team */}
      <RevealSection>
        <section className="pb-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4" style={{ color: 'var(--text-primary)' }}>
                Meet the <span className="gradient-text-animated">Team</span>
              </h2>
              <p className="text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Built by researchers and engineers who understand the academic workflow from the inside.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {TEAM.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="p-6 rounded-3xl text-center transition-all duration-300"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-black text-white" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}88)` }}>
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t.name}</h3>
                  <p className="text-xs font-bold mb-3" style={{ color: t.color }}>{t.role}</p>
                  <p className="text-sm leading-relaxed text-justify" style={{ color: 'var(--text-secondary)' }}>{t.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Milestones */}
      <RevealSection>
        <section className="pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-12" style={{ color: 'var(--text-primary)' }}>
              Our <span className="gradient-text-animated">Journey</span>
            </h2>
            <div className="relative">
              <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px" style={{ background: 'var(--border)' }} />
              <div className="space-y-8">
                {MILESTONES.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className={`relative flex items-start gap-6 md:gap-0 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
                  >
                    <div className={`hidden md:flex w-1/2 ${i % 2 === 0 ? 'justify-end pr-10' : 'pl-10'}`}>
                      <div className="text-right" style={i % 2 !== 0 ? { textAlign: 'left' } : {}}>
                        <span className="text-sm font-black" style={{ color: 'var(--accent-primary)' }}>{m.year}</span>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{m.event}</p>
                      </div>
                    </div>
                    <div className="absolute left-6 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 z-10" style={{ background: 'var(--bg-primary)', borderColor: 'var(--accent-primary)' }} />
                    <div className="pl-14 md:hidden">
                      <span className="text-sm font-black" style={{ color: 'var(--accent-primary)' }}>{m.year}</span>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{m.event}</p>
                    </div>
                    <div className="hidden md:flex w-1/2" />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Testimonials */}
      <RevealSection>
        <section className="pb-20 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-12" style={{ color: 'var(--text-primary)' }}>
              Trusted by <span className="gradient-text-animated">Researchers</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { name: 'Dr. Elena Rostova', role: 'Postdoc, MIT', quote: "Latexify's template migrator saved me weeks of reformatting when my paper was transferred between journals. The UI is incredibly clean.", color: '#00685f' },
                { name: 'James Chen', role: 'PhD, Stanford', quote: 'The AI Peer Reviewer caught several logical gaps in my methodology section before submission. An absolute game-changer for solo researchers.', color: '#6b38d4' },
                { name: 'Prof. Sarah Jenkins', role: 'PI, Oxford', quote: "I've moved my entire lab to Latexify. Collaborative writing is finally seamless, and the Doc2Latex feature means my undergrads can contribute easily.", color: '#0891b2' },
              ].map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="p-6 rounded-3xl relative"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <Quote size={24} className="mb-3" style={{ color: t.color, opacity: 0.3 }} />
                  <p className="text-sm leading-relaxed mb-4 italic text-justify" style={{ color: 'var(--text-secondary)' }}>"{t.quote}"</p>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.role}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* CTA */}
      <RevealSection>
        <section className="pb-20 px-6">
          <div className="w-full px-8 md:px-16 py-12 md:py-16 rounded-3xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent), color-mix(in srgb, #6b38d4 5%, transparent))', border: '1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)' }}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 12%, transparent), transparent)', filter: 'blur(50px)' }} />
              <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, #6b38d4 8%, transparent), transparent)', filter: 'blur(40px)' }} />
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
              <div className="text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
                  Ready to Transform Your Research?
                </h2>
                <p className="text-base leading-relaxed w-full" style={{ color: 'var(--text-secondary)', textAlign: 'justify', textAlignLast: 'justify', textJustify: 'inter-word' }}>
                  Join 50,000+ researchers who have made Latexify their academic home. No credit card required.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
                <Link href="/register" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold text-white transition-all whitespace-nowrap" style={{ background: 'linear-gradient(135deg, var(--accent-primary), #6b38d4)' }}>
                  Create Free Account <ArrowRight size={16} />
                </Link>
                <Link href="/pricing" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  View Plans
                </Link>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* Footer */}
      <footer style={{ background: '#020b09', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10 md:py-14">
          <div className="flex flex-col lg:flex-row gap-16 mb-16">
            <div className="w-full lg:w-80 space-y-6 flex-shrink-0">
              <LatexifyLogo size={72} className="text-white" />
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                The modern, intelligent platform for the entire research writing lifecycle. Write, compile, cite, collaborate — all in one place.
              </p>
              <div className="flex gap-3">
                {SOCIAL_ICONS.map((Icon, i) => (
                  <button key={i} className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Icon size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-10">
              {[
                { title: 'Products', links: FOOTER_PRODUCTS },
                { title: 'Resources', links: FOOTER_RESOURCES },
                { title: 'Company', links: FOOTER_COMPANY },
                { title: 'Legal', links: FOOTER_LEGAL },
              ].map((col, i) => (
                <div key={i} className="space-y-5">
                  <h4 className="text-sm font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.9)' }}>{col.title}</h4>
                  <div className="space-y-3">
                    {col.links.map((link, j) => {
                      if (link.label === 'Templates Gallery') {
                        return (
                          <button
                            key={j}
                            onClick={() => {
                              if (status === 'authenticated') {
                                router.push(link.href);
                              } else {
                                setShowLoginModal(true);
                              }
                            }}
                            className="block text-sm text-left w-full transition-colors hover:text-white"
                            style={{ color: 'rgba(255,255,255,0.5)' }}
                          >
                            {link.label}
                          </button>
                        );
                      }
                      return (
                        <Link key={j} href={link.href} className="block text-sm transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              &copy; {new Date().getFullYear()} Latexify. All rights reserved.
            </p>
            <div className="flex gap-6 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              <Link href="#">Privacy</Link>
              <Link href="#">Terms</Link>
              <Link href="/contact-us">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
