'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/pb-auth-react';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Loader2, Sparkles, Star, Zap, Shield, Infinity, Brain, Share2, Code2, MessageSquare } from 'lucide-react';
import { createPb } from '@/lib/pb';
import LatexifyLogo from '@/components/LatexifyLogo';
import LoginPromptModal from '@/components/LoginPromptModal';

const FEATURES = [
  'Full LaTeX Compilation',
  'AI-Powered Peer Review',
  'Citation Studio',
  'Collaboration Tools',
  'Priority Support',
  'Advanced Templates',
  'Unlimited Projects',
  'Real-time Collaboration',
];

const PLAN_FEATURES: Record<string, string[]> = {
  free: ['Basic LaTeX Compilation', '5 Projects', 'Community Support', 'Standard Templates'],
  premium_1m: ['Full LaTeX Compilation', 'AI Peer Review (100K tokens/day)', 'Citation Studio', 'Unlimited Projects', 'Priority Support', 'Advanced Templates'],
  premium_3m: [...FEATURES, 'Team Collaboration', '50GB Storage'],
  premium_6m: [...FEATURES, 'Team Collaboration', '100GB Storage', 'API Access'],
  premium_12m: [...FEATURES, 'Team Collaboration', 'Unlimited Storage', 'API Access', 'Dedicated Manager', 'Custom Integrations'],
};

const PLAN_ICONS: Record<string, any> = {
  free: Zap,
  premium_1m: Star,
  premium_3m: Brain,
  premium_6m: Shield,
  premium_12m: Infinity,
};

const PLAN_COLORS: Record<string, string> = {
  free: '#64748b',
  premium_1m: '#00685f',
  premium_3m: '#6b38d4',
  premium_6m: '#0891b2',
  premium_12m: '#f59e0b',
};

const FOOTER_RESOURCES = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Templates Gallery', href: '/templates' },
  { label: 'Citation Studio', href: '/citations' },
  { label: 'AI Reviewer', href: '/reviewer' },
  { label: 'Help Center', href: '#' },
];

const FOOTER_COMPANY = [
  { label: 'About Us', href: '#' },
  { label: 'Blog', href: '#' },
  { label: 'Careers', href: '#' },
  { label: 'Contact', href: '/contact-us' },
];

const FOOTER_LEGAL = [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Service', href: '#' },
  { label: 'Cookie Policy', href: '#' },
  { label: 'GDPR', href: '#' },
];

const FOOTER_PRODUCTS = [
  { label: 'Latexify Studio', href: '/latex-studio' },
  { label: 'Doc2LateX', href: '/upload' },
  { label: 'Diagram Studio', href: '/diagrams' },
  { label: 'Template Migrator', href: '/template-migrator' },
];

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

const comparisonFeatures = [
  { name: 'LaTeX Compilation', free: true, premium: true },
  { name: 'AI Peer Review', free: '100 tokens/day', premium: '100K tokens/day' },
  { name: 'Citation Studio', free: false, premium: true },
  { name: 'Unlimited Projects', free: '5 max', premium: true },
  { name: 'Advanced Templates', free: false, premium: true },
  { name: 'Team Collaboration', free: false, premium: true },
  { name: 'Priority Support', free: false, premium: true },
  { name: 'API Access', free: false, premium: '100K tokens/day' },
];

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    let unsub: (() => void) | undefined;
    async function fetchAndSubscribe() {
      try {
        const res = await fetch('/api/plans');
        const data = await res.json();
        if (data.success && data.plans) {
          const sorted = [...data.plans].sort((a, b) => a.priceINR - b.priceINR);
          setPlans([{ planId: 'free', name: 'Free', priceINR: 0, durationMonths: 0, description: 'Get started with basic features', pointsExchange: 0 }, ...sorted]);
        }
      } catch (e) { console.warn('Failed to fetch plans', e); }
      try {
        const pb = createPb();
        unsub = await pb.collection('membership_plans').subscribe('*', () => {
          fetch('/api/plans').then(r => r.json()).then(data => {
            if (data.success && data.plans) {
              const sorted = [...data.plans].sort((a, b) => a.priceINR - b.priceINR);
              setPlans([{ planId: 'free', name: 'Free', priceINR: 0, durationMonths: 0, description: 'Get started with basic features', pointsExchange: 0 }, ...sorted]);
            }
          }).catch(() => {});
        });
      } catch (e) { console.warn('Failed to subscribe to plans', e); }
      setLoading(false);
    }
    fetchAndSubscribe();
    return () => { unsub?.(); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-inter)', overflowX: 'hidden' }}>

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[10%] left-[5%] w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 10%, transparent), transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute bottom-[10%] right-[5%] w-[300px] h-[300px] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, #6b38d4 8%, transparent), transparent 70%)', filter: 'blur(50px)' }} />
        </div>
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6" style={{ background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)', color: 'var(--accent-primary)' }}>
              <Sparkles size={14} />
              Simple, transparent pricing
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="font-black tracking-tight mb-4" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', color: 'var(--text-primary)' }}>
            Choose Your Plan
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Start for free. Upgrade when you need more power. All plans include core LaTeX compilation.
          </motion.p>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan: any, idx: number) => {
              const isFree = plan.planId === 'free';
              const isPopular = plan.planId === 'premium_3m';
              const features = PLAN_FEATURES[plan.planId] || FEATURES;
              const accent = PLAN_COLORS[plan.planId] || 'var(--accent-primary)';
              const Icon = PLAN_ICONS[plan.planId] || Zap;

              return (
                <motion.div
                  key={plan.planId}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -6, transition: { duration: 0.3 } }}
                  className="relative rounded-3xl p-[1px] transition-all duration-300"
                  style={{
                    background: isPopular
                      ? 'linear-gradient(135deg, var(--accent-primary), #6b38d4, var(--accent-primary))'
                      : 'transparent',
                    boxShadow: isPopular ? '0 0 40px color-mix(in srgb, var(--accent-primary) 25%, transparent)' : 'none',
                  }}
                >
                  <div
                    className="relative rounded-3xl p-6 flex flex-col h-full transition-all duration-300"
                    style={{
                      background: isPopular
                        ? 'linear-gradient(145deg, var(--bg-secondary), var(--bg-primary))'
                        : 'var(--bg-secondary)',
                      border: `1px solid ${isPopular ? 'transparent' : 'var(--border)'}`,
                    }}
                  >
                    {isPopular && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, delay: 0.3 }}
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap"
                        style={{ background: 'linear-gradient(135deg, var(--accent-primary), #6b38d4)' }}
                      >
                        <Sparkles size={12} className="inline mr-1" />
                        Most Popular
                      </motion.div>
                    )}

                    {/* Icon */}
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: accent + '18' }}>
                      <Icon size={24} style={{ color: accent }} />
                    </div>

                    <div className="mb-5">
                      <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{plan.name}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{plan.description}</p>
                    </div>

                    <div className="mb-6 p-4 rounded-2xl" style={{ background: 'color-mix(in srgb, var(--accent-primary) 5%, transparent)' }}>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black" style={{ color: accent }}>₹{plan.priceINR}</span>
                        {!isFree && <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>/{plan.durationMonths}mo</span>}
                      </div>
                      {!isFree && plan.pointsExchange > 0 && (
                        <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
                          Or {plan.pointsExchange.toLocaleString('en-IN')} points
                        </p>
                      )}
                    </div>

                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Link href={isFree ? '/register' : '/register?plan=' + plan.planId}
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition-all mb-6"
                        style={{
                          background: isPopular
                            ? 'linear-gradient(135deg, var(--accent-primary), #6b38d4)'
                            : 'var(--bg-primary)',
                          border: `1px solid ${isPopular ? 'transparent' : 'var(--border)'}`,
                          color: isPopular ? '#fff' : 'var(--text-primary)',
                          boxShadow: isPopular ? '0 4px 20px color-mix(in srgb, var(--accent-primary) 30%, transparent)' : 'none',
                        }}
                        onMouseEnter={e => { if (!isPopular) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; } }}
                        onMouseLeave={e => { if (!isPopular) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; } }}>
                        {isFree ? 'Get Started Free' : 'Choose Plan'}
                        <ArrowRight size={16} />
                      </Link>
                    </motion.div>

                    <div className="space-y-3 mt-auto">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Includes</p>
                      {features.slice(0, isFree ? 4 : 6).map((feature, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 + i * 0.05 }}
                          className="flex items-start gap-2.5"
                        >
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: accent + '18' }}>
                            <CheckCircle2 size={12} style={{ color: accent }} />
                          </div>
                          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{feature}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <RevealSection>
        <section className="pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8" style={{ color: 'var(--text-primary)' }}>
              Free vs Premium
            </h2>
            <div className="rounded-3xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
              <div className="grid grid-cols-3 text-sm font-bold px-6 py-4" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                <span>Feature</span>
                <span className="text-center">Free</span>
                <span className="text-center">Premium</span>
              </div>
              {comparisonFeatures.map((f, i) => (
                <div key={i} className="grid grid-cols-3 text-sm px-6 py-4 items-center" style={{ borderBottom: i < comparisonFeatures.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{f.name}</span>
                  <span className="text-center" style={{ color: f.free === true ? 'var(--accent-primary)' : f.free === false ? 'var(--text-secondary)' : 'var(--text-secondary)' }}>
                    {f.free === true ? <CheckCircle2 size={16} className="inline" style={{ color: 'var(--accent-primary)' }} /> : f.free === false ? <span className="opacity-40">—</span> : f.free}
                  </span>
                  <span className="text-center" style={{ color: f.premium === true ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                    {f.premium === true ? <CheckCircle2 size={16} className="inline" style={{ color: 'var(--accent-primary)' }} /> : f.premium}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* CTA */}
      <RevealSection>
        <section className="pb-20 px-6">
          <div className="max-w-2xl mx-auto text-center p-10 rounded-3xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent), color-mix(in srgb, #6b38d4 5%, transparent))', border: '1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)' }}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 15%, transparent), transparent)', filter: 'blur(30px)' }} />
            </div>
            <h2 className="text-2xl font-bold mb-3 relative z-10" style={{ color: 'var(--text-primary)' }}>Need a custom plan?</h2>
            <p className="text-sm mb-6 relative z-10" style={{ color: 'var(--text-secondary)' }}>
              Contact us for enterprise pricing, academic institution discounts, or custom requirements.
            </p>
            <Link href="/contact-us"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all relative z-10"
              style={{ background: 'linear-gradient(135deg, var(--accent-primary), #6b38d4)' }}>
              Contact Us <ArrowRight size={16} />
            </Link>
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
                The modern, intelligent platform for the entire research writing lifecycle.
                Write, compile, cite, collaborate — all in one place.
              </p>
              <div className="flex gap-3">
                {[Share2, Code2, MessageSquare].map((Icon, i) => (
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
