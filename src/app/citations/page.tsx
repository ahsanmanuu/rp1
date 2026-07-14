'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Library, BookOpen, Quote, Globe, FileText, Search, Download, CheckCircle2, ArrowRight, Star, Shield, Sparkles } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

const FEATURES = [
  { title: 'DOI Auto-Fetch', desc: 'Enter a DOI and instantly retrieve complete citation metadata — authors, title, journal, volume, pages, and more. Zero manual typing.', icon: Search, color: '#00685f' },
  { title: 'Multi-Style Formatting', desc: 'Format citations in APA, MLA, Chicago, IEEE, Harvard, and 9000+ other styles. Switch between styles with a single click.', icon: BookOpen, color: '#6b38d4' },
  { title: 'BibTeX Export', desc: 'Export your entire reference library as clean BibTeX files, ready for LaTeX documents. Supports @article, @book, @inproceedings, and more.', icon: FileText, color: '#0891b2' },
  { title: 'Smart Reference Management', desc: 'Organize citations into projects, folders, and collections. Tag, search, and filter your library with powerful full-text search.', icon: Library, color: '#f59e0b' },
  { title: 'Citation Preview & Editing', desc: 'Preview formatted citations before exporting. Manually edit any field with intelligent auto-completion and validation.', icon: Sparkles, color: '#dc2626' },
  { title: 'Collaborative Libraries', desc: 'Share citation projects with co-authors. Work together on reference lists in real time, perfect for multi-author papers.', icon: Globe, color: '#059669' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Add References', desc: 'Search by DOI, title, or author to auto-populate citation data. You can also import existing BibTeX, RIS, or EndNote files.' },
  { step: '2', title: 'Organize & Format', desc: 'Group references into projects, choose your citation style, and preview how each entry will appear in your bibliography.' },
  { step: '3', title: 'Export & Cite', desc: 'Export your library as BibTeX, formatted bibliography, or use our inline citation generator for Word, LaTeX, or Markdown.' },
];

const TESTIMONIALS = [
  { quote: 'The DOI auto-fetch alone saved me hours of manual data entry. Citation Studio became my single source of truth for all 200+ references in my dissertation.', author: 'Dr. Elena Voss', role: 'PhD Graduate, University of Cambridge' },
  { quote: 'Switching between IEEE and APA format for different journals used to be a nightmare. Now it is two clicks. The BibTeX export is flawless.', author: 'Prof. Ryan Okafor', role: 'Associate Editor, IEEE Transactions' },
  { quote: 'Our lab uses Citation Studio collaboratively for every paper. The shared libraries feature eliminated duplicate reference entry and citation inconsistencies.', author: 'Dr. Mei-Lin Chen', role: 'Research Scientist, Stanford Bioengineering' },
];

export default function CitationsPage() {
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
            <Sparkles size={14} /> Smart Citation Management
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
            Citation <span className="gradient-text-animated">Studio</span>
          </h1>
          <p className="text-lg opacity-70 max-w-2xl mx-auto mb-10 text-justify md:text-center">
            Automatically fetch, format, and manage academic references with ease.
            From DOI auto-retrieval to BibTeX export and multi-style formatting —
            Citation Studio is the all-in-one reference manager for researchers.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/citations/studio"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-white transition-all hover:scale-[1.02] hover:shadow-xl"
              style={{ background: 'linear-gradient(135deg, #6b38d4, var(--accent-primary))' }}>
              <Library size={18} /> Open Citation Studio <ArrowRight size={18} />
            </Link>
            <Link href="#how-it-works"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold transition-all hover:scale-[1.02]"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              See How It Works <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-10 px-6 border-y" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-8 md:gap-16 text-xs font-bold uppercase tracking-widest opacity-40">
          <span className="flex items-center gap-2"><Star size={14} /> 30,000+ Researchers</span>
          <span className="flex items-center gap-2"><Shield size={14} /> Encrypted Storage</span>
          <span className="flex items-center gap-2"><Globe size={14} /> 120+ Countries</span>
          <span className="flex items-center gap-2"><CheckCircle2 size={14} /> 99.9% Uptime</span>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Everything for Reference Management</h2>
            <p className="text-base opacity-60 max-w-2xl mx-auto">
              From discovery to final bibliography — Citation Studio covers every step of your citation workflow.
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
      <section id="how-it-works" className="py-20 px-6 border-y" style={{ borderColor: 'var(--border)' }}>
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
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-14">Trusted by Academics Worldwide</h2>
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

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-8 md:p-14 rounded-3xl text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, #6b38d4 10%, transparent), color-mix(in srgb, var(--accent-primary) 8%, transparent))', border: '1px solid color-mix(in srgb, #6b38d4 20%, transparent)' }}>
            <h2 className="text-2xl md:text-4xl font-black mb-4">Ready to Organize Your References?</h2>
            <p className="text-base opacity-70 mb-8 max-w-xl mx-auto">
              Start building your reference library now. Auto-fetch citations by DOI, format in any style, and export to BibTeX in seconds.
            </p>
            <Link href="/citations/studio"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-white transition-all hover:scale-[1.02] hover:shadow-xl"
              style={{ background: 'linear-gradient(135deg, #6b38d4, var(--accent-primary))' }}>
              <Library size={18} /> Open Citation Studio <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter onLoginRequired={() => setShowLoginModal(true)} />
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
