'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Wand2, Upload, FileText, Zap, CheckCircle2, ArrowRight, Star, Shield, Globe, Code2 } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

const FEATURES = [
  { title: 'DOCX to LaTeX', desc: 'Convert Word documents into clean, well-structured LaTeX code with a single click. Preserve formatting, tables, and math equations.', icon: Wand2, color: '#00685f' },
  { title: 'Smart Parsing Engine', desc: 'Our AI-powered parser understands document structure, headers, lists, and cross-references. No manual cleanup needed.', icon: Zap, color: '#6b38d4' },
  { title: 'Math Equation Recovery', desc: 'Complex mathematical expressions, inline formulas, and equation arrays are extracted and translated to perfect LaTeX notation.', icon: Code2, color: '#0891b2' },
  { title: 'Bibliography Conversion', desc: 'Automatically convert Word citations and references to BibTeX format. Supports all major citation styles.', icon: FileText, color: '#f59e0b' },
  { title: 'Table & Figure Handling', desc: 'Tables, figures, and captions from your Word document are intelligently mapped to their LaTeX equivalents.', icon: Upload, color: '#dc2626' },
  { title: 'Batch Processing', desc: 'Convert multiple documents simultaneously. Perfect for migrating entire dissertations, thesis collections, or lab reports.', icon: Globe, color: '#059669' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Upload Your Document', desc: 'Drag and drop your .docx file onto the converter. We support documents of any length, from abstracts to full-length books.' },
  { step: '2', title: 'Review & Customize', desc: 'Our parser highlights sections and equations. Choose output options like document class, font size, and bibliography style.' },
  { step: '3', title: 'Export & Compile', desc: 'Download your LaTeX source or compile it instantly in Latexify Studio. Your document is ready for journal submission.' },
];

const TESTIMONIALS = [
  { quote: 'Converted my 200-page PhD thesis from Word to LaTeX in under a minute. The equation parsing saved me weeks of manual work.', author: 'Dr. Maya Krishnan', role: 'Postdoctoral Fellow, ETH Zurich' },
  { quote: 'Our lab switched entirely to LaTeX after discovering Doc2Latex. The batch conversion feature migrated 30 papers in one afternoon.', author: 'Prof. James Carter', role: 'Research Lead, MIT Media Lab' },
  { quote: 'The bibliography conversion is flawless. It detected all 150 references and formatted them perfectly in BibTeX.', author: 'Dr. Aisha Rahman', role: 'Senior Researcher, Oxford University' },
];

export default function Doc2LatexPage() {
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
            <Zap size={14} /> From Word to LaTeX in Seconds
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
            Doc2<span className="gradient-text-animated">Latex</span>
          </h1>
          <p className="text-lg opacity-70 max-w-2xl mx-auto mb-10 text-justify md:text-center">
            Instantly convert Microsoft Word documents into pristine LaTeX code. 
            Our intelligent parsing engine preserves every equation, table, citation, and formatting rule — 
            bridging the gap between word processors and academic publishing.
          </p>
          
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-10 px-6 border-y" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-8 md:gap-16 text-xs font-bold uppercase tracking-widest opacity-40">
          <span className="flex items-center gap-2"><Star size={14} /> 50,000+ Researchers</span>
          <span className="flex items-center gap-2"><Shield size={14} /> AES-256 Encrypted</span>
          <span className="flex items-center gap-2"><Globe size={14} /> 150+ Countries</span>
          <span className="flex items-center gap-2"><CheckCircle2 size={14} /> 99.9% Accuracy</span>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Powerful Conversion Features</h2>
            <p className="text-base opacity-60 max-w-2xl mx-auto">
              Everything you need to migrate from Word to LaTeX without losing a single piece of content.
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
