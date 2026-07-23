'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Layout, RefreshCw, FileText, Zap, CheckCircle2, ArrowRight, Star, Shield, Globe, Palette, GitBranch, BookOpen } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

const FEATURES = [
  { title: 'Multi-Journal Templates', desc: 'Access hundreds of pre-configured templates for IEEE, Elsevier, Nature, ACM, Springer, PLOS, and more. One-click instant setup.', icon: Layout, color: 'var(--accent-primary)' },
  { title: 'Smart Content Migration', desc: 'Migrate your existing manuscript between templates while preserving figures, citations, cross-references, and section structure.', icon: RefreshCw, color: 'var(--accent-secondary)' },
  { title: 'IEEE & ACM Ready', desc: 'Perfectly formatted templates for IEEE conference papers, journal articles, and ACM proceedings. Includes all required style files.', icon: FileText, color: '#0891b2' },
  { title: 'Nature & Elsevier Support', desc: 'Comprehensive support for Nature family journals and Elsevier template suites, including CAS, ESC, and structured formats.', icon: BookOpen, color: '#f59e0b' },
  { title: 'Custom Style Engineering', desc: 'Extend or modify any template with custom LaTeX packages, fonts, color schemes, and branding without breaking compatibility.', icon: Palette, color: 'var(--accent-primary)' },
  { title: 'Version-Controlled Workflows', desc: 'Track changes across template versions, compare outputs side-by-side, and roll back to previous layouts at any time.', icon: GitBranch, color: '#059669' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Choose Your Target Template', desc: 'Browse our template library by journal, conference, or publisher. Preview formatting rules, style guides, and page constraints before selecting.' },
  { step: '2', title: 'Migrate with One Click', desc: 'Point to your existing LaTeX project or upload a document. Our engine remaps all content — title, authors, sections, equations, and bibliography — to the new template.' },
  { step: '3', title: 'Review & Polish in Studio', desc: 'Fine-tune layout, adjust spacing, and compile directly in Template Migrator Studio. Export ready-to-submit source files for your target journal.' },
];

const TESTIMONIALS = [
  { quote: 'Resubmitting to a different journal used to take me a week of reformatting. Template Migrator did it in five minutes — IEEE to Nature template with zero content loss.', author: 'Dr. Elena Voss', role: 'Computational Biologist, Max Planck Institute' },
  { quote: 'Our lab maintains ten active preprints across ACM, Springer, and arXiv formats. Template Migrator keeps them all in sync without duplicating effort.', author: 'Prof. Marcus Chen', role: 'Associate Professor, Stanford University' },
  { quote: 'The Elsevier CAS template support is flawless. It handled our multi-column layout, author affiliations, and supplementary material perfectly.', author: 'Dr. Priya Sharma', role: 'Lead Researcher, IIT Bombay' },
];

export default function TemplateMigratorPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', overflowX: 'hidden' }}>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none hero-grid" />
        <div className="absolute top-[5%] right-[10%] w-[500px] h-[500px] rounded-full pointer-events-none opacity-15"
          style={{ background: 'radial-gradient(circle, var(--accent-secondary) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-[10%] left-[5%] w-[300px] h-[300px] rounded-full pointer-events-none opacity-10"
          style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', filter: 'blur(50px)' }} />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mx-auto"
            style={{ background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)', color: 'var(--accent-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)' }}>
            <Zap size={14} /> Switch Templates in Seconds
          </div>
          
          <h1 className="font-black tracking-tight leading-tight" style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', color: 'var(--text-primary)' }}>
            Template <span className="gradient-text-animated">Migrator</span>
          </h1>
          
          <p className="text-lg opacity-70 max-w-2xl mx-auto mb-10 text-center leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Instantly migrate your LaTeX projects between journal templates — IEEE, Nature, ACM, Elsevier, and more.
            Preserve every equation, citation, figure, and section while switching formats with zero manual rework.
          </p>
          
          <div className="flex justify-center mt-8">
             <Link href="/template-migrator/studio"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 shadow-lg shadow-black/20"
                style={{ background: 'var(--accent-primary)' }}>
                Open Migrator Studio
                <ArrowRight size={18} />
             </Link>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-10 px-6 border-y" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-8 md:gap-16 text-xs font-bold uppercase tracking-widest opacity-60">
          <span className="flex items-center gap-2"><Star size={14} /> 25,000+ Researchers</span>
          <span className="flex items-center gap-2"><Shield size={14} /> Template Integrity Guaranteed</span>
          <span className="flex items-center gap-2"><Globe size={14} /> 120+ Journal Templates</span>
          <span className="flex items-center gap-2"><CheckCircle2 size={14} /> 99.7% Format Accuracy</span>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <h2 className="font-black tracking-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: 'var(--text-primary)' }}>Why Template Migrator</h2>
            <p className="text-lg opacity-60 max-w-2xl mx-auto text-center" style={{ color: 'var(--text-secondary)' }}>
              Seamlessly move between journal formats without touching a single line of LaTeX.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div key={i}
                className="relative p-6 rounded-3xl overflow-hidden group transition-all duration-500 hover:-translate-y-1"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.05)'
                }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(circle at center, color-mix(in srgb, ${feature.color} 10%, transparent) 0%, transparent 70%)` }} />
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `color-mix(in srgb, ${feature.color} 15%, transparent)`, color: feature.color }}>
                    <feature.icon size={22} />
                  </div>
                  <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{feature.title}</h3>
                  <p className="text-sm opacity-70 leading-relaxed text-justify" style={{ color: 'var(--text-secondary)' }}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 border-y" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14 space-y-3">
             <h2 className="font-black tracking-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: 'var(--text-primary)' }}>How It Works</h2>
          </div>
          <div className="space-y-6">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={i} className="flex flex-col sm:flex-row items-start gap-6 p-8 rounded-3xl border transition-all duration-300 hover:scale-[1.02] shadow-sm"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-xl font-black text-white"
                  style={{ background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))', boxShadow: '0 8px 24px color-mix(in srgb, var(--accent-primary) 30%, transparent)' }}>
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>
                  <p className="text-base opacity-70 leading-relaxed text-justify" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <h2 className="font-black tracking-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: 'var(--text-primary)' }}>Trusted by Researchers Worldwide</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i}
                className="p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-1 shadow-sm"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={16} fill="#f59e0b" color="#f59e0b" />
                  ))}
                </div>
                <p className="text-base italic opacity-80 leading-relaxed mb-6 text-justify" style={{ color: 'var(--text-primary)' }}>&ldquo;{t.quote}&rdquo;</p>
                <div className="border-t border-dashed pt-5" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t.author}</p>
                  <p className="text-xs opacity-60 mt-1" style={{ color: 'var(--text-secondary)' }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter onLoginRequired={() => setShowLoginModal(true)} />
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
