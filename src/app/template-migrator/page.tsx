'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Layout, RefreshCw, FileText, Zap, CheckCircle2, ArrowRight, Star, Shield, Globe, Palette, GitBranch, BookOpen } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

const FEATURES = [
  { title: 'Multi-Journal Templates', desc: 'Access hundreds of pre-configured templates for IEEE, Elsevier, Nature, ACM, Springer, PLOS, and more. One-click instant setup.', icon: Layout, color: '#00685f' },
  { title: 'Smart Content Migration', desc: 'Migrate your existing manuscript between templates while preserving figures, citations, cross-references, and section structure.', icon: RefreshCw, color: '#6b38d4' },
  { title: 'IEEE & ACM Ready', desc: 'Perfectly formatted templates for IEEE conference papers, journal articles, and ACM proceedings. Includes all required style files.', icon: FileText, color: '#0891b2' },
  { title: 'Nature & Elsevier Support', desc: 'Comprehensive support for Nature family journals and Elsevier template suites, including CAS, ESC, and structured formats.', icon: BookOpen, color: '#f59e0b' },
  { title: 'Custom Style Engineering', desc: 'Extend or modify any template with custom LaTeX packages, fonts, color schemes, and branding without breaking compatibility.', icon: Palette, color: '#dc2626' },
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
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-inter)', overflowX: 'hidden' }}>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none hero-grid" />
        <div className="absolute top-[5%] right-[10%] w-[500px] h-[500px] rounded-full pointer-events-none opacity-15"
          style={{ background: 'radial-gradient(circle, #6b38d4 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-[10%] left-[5%] w-[300px] h-[300px] rounded-full pointer-events-none opacity-10"
          style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', filter: 'blur(50px)' }} />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-6"
            style={{ background: 'color-mix(in srgb, #6b38d4 15%, transparent)', color: '#6b38d4', border: '1px solid color-mix(in srgb, #6b38d4 25%, transparent)' }}>
            <Zap size={14} /> Switch Templates in Seconds
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
            Template <span className="gradient-text-animated">Migrator</span>
          </h1>
          <p className="text-lg opacity-70 max-w-2xl mx-auto mb-10 text-justify md:text-center">
            Instantly migrate your LaTeX projects between journal templates — IEEE, Nature, ACM, Elsevier, and more.
            Preserve every equation, citation, figure, and section while switching formats with zero manual rework.
          </p>
          
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-10 px-6 border-y" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-8 md:gap-16 text-xs font-bold uppercase tracking-widest opacity-40">
          <span className="flex items-center gap-2"><Star size={14} /> 25,000+ Researchers</span>
          <span className="flex items-center gap-2"><Shield size={14} /> Template Integrity Guaranteed</span>
          <span className="flex items-center gap-2"><Globe size={14} /> 120+ Journal Templates</span>
          <span className="flex items-center gap-2"><CheckCircle2 size={14} /> 99.7% Format Accuracy</span>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Why Template Migrator</h2>
            <p className="text-base opacity-60 max-w-2xl mx-auto">
              Seamlessly move between journal formats without touching a single line of LaTeX.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div key={i}
                className="p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: `color-mix(in srgb, ${feature.color} 15%, transparent)`, color: feature.color }}>
                  <feature.icon size={22} />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm opacity-60 leading-relaxed text-justify">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 border-y" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-14">How It Works</h2>
          <div className="space-y-8">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={i} className="flex items-start gap-6 p-6 rounded-3xl border"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #6b38d4, var(--accent-primary))' }}>
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-sm opacity-60 leading-relaxed text-justify">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-14">Trusted by Researchers Worldwide</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i}
                className="p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.02]"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={14} fill="#f59e0b" color="#f59e0b" />
                  ))}
                </div>
                <p className="text-sm opacity-70 leading-relaxed mb-6 text-justify">&ldquo;{t.quote}&rdquo;</p>
                <div className="border-t border-dashed pt-4" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-sm font-bold">{t.author}</p>
                  <p className="text-xs opacity-50">{t.role}</p>
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
