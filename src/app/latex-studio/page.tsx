'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Code2, FileText, Sparkles, Eye, PanelRightOpen, Share2, ArrowRight, Star, Shield, Globe, CheckCircle2, Zap, Play, Layout } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

const FEATURES = [
  { title: 'Rich LaTeX Editor', desc: 'Write and edit LaTeX documents in a feature-rich editor with syntax highlighting, auto-completion, and multi-cursor support for blazing-fast productivity.', icon: Code2, color: '#6b38d4' },
  { title: 'Live PDF Preview', desc: 'See your compiled PDF update in real-time as you type. No more context-switching between editor and viewer — iterate instantly.', icon: Eye, color: '#0891b2' },
  { title: 'Project Dashboard', desc: 'Organize your work with folders, templates, and version history. Manage multi-file projects like theses, preprints, and lab reports.', icon: Layout, color: '#00685f' },
  { title: 'Smart Templates', desc: 'Start from curated templates for journal articles, dissertations, CVs, and presentations. Pre-configured document classes and packages included.', icon: FileText, color: '#f59e0b' },
  { title: 'Collaboration Tools', desc: 'Share projects with co-authors via a shareable link. Track changes, add comments, and compile together in real time.', icon: Share2, color: '#dc2626' },
  { title: 'AI-Powered Assistance', desc: 'Get LaTeX suggestions, fix syntax errors, and rephrase content with built-in AI. Write complex math and tables faster than ever.', icon: Sparkles, color: '#059669' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Create or Import', desc: 'Start a new project from a template or import your existing .tex files. Our dashboard organises everything in one place.' },
  { step: '2', title: 'Edit & Preview', desc: 'Write freely with syntax highlighting and auto-completion. The live side-by-side PDF preview updates with every keystroke.' },
  { step: '3', title: 'Export & Share', desc: 'Download compiled PDFs, share projects with collaborators, or submit directly to arXiv, Overleaf, or your institution\'s repository.' },
];

const TESTIMONIALS = [
  { quote: 'Latexify Studio replaced my entire Overleaf subscription. The live preview is instantaneous and the AI assistant catches errors before I compile.', author: 'Prof. Elena Voss', role: 'Professor of Mathematics, TU Munich' },
  { quote: 'Managing a 300-page PhD thesis across multiple .tex files was a nightmare until Latexify. The project dashboard and version history saved my dissertation.', author: 'Rohan Mehta', role: 'PhD Candidate, Stanford University' },
  { quote: 'The collaboration feature is seamless. My co-authors and I can edit simultaneously and the real-time sync works flawlessly across continents.', author: 'Dr. Sophie Laurent', role: 'Research Scientist, CERN' },
];

export default function LatexStudioPage() {
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
            <Zap size={14} /> The Ultimate LaTeX Workspace
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
            Latexify <span className="gradient-text-animated">Studio</span>
          </h1>
          <p className="text-lg opacity-70 max-w-2xl mx-auto mb-10 text-justify md:text-center">
            A modern, browser-based LaTeX editor with live PDF preview, AI-powered suggestions, 
            and seamless collaboration. Write beautiful academic documents without installing a single package.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/latex-studio/projects"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-white transition-all hover:scale-[1.02] hover:shadow-xl"
              style={{ background: 'linear-gradient(135deg, #6b38d4, var(--accent-primary))' }}>
              <Play size={18} /> Launch Studio <ArrowRight size={18} />
            </Link>
            <Link href="/doc2latex"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold transition-all hover:scale-[1.02]"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              Convert from Word <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-10 px-6 border-y" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-8 md:gap-16 text-xs font-bold uppercase tracking-widest opacity-40">
          <span className="flex items-center gap-2"><Star size={14} /> 25,000+ Active Users</span>
          <span className="flex items-center gap-2"><Shield size={14} /> End-to-End Encrypted</span>
          <span className="flex items-center gap-2"><Globe size={14} /> 120+ Countries</span>
          <span className="flex items-center gap-2"><CheckCircle2 size={14} /> 99.9% Uptime</span>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Everything a LaTeX Author Needs</h2>
            <p className="text-base opacity-60 max-w-2xl mx-auto">
              From first draft to final submission — Latexify Studio equips you with professional tools for every stage of academic writing.
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
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-14">Loved by Academics Everywhere</h2>
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
            <h2 className="text-2xl md:text-4xl font-black mb-4">Start Writing in Latexify Studio</h2>
            <p className="text-base opacity-70 mb-8 max-w-xl mx-auto">
              No installation, no configuration, no hassle. Open your browser and start writing beautiful LaTeX documents immediately.
            </p>
            <Link href="/latex-studio/projects"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold text-white transition-all hover:scale-[1.02] hover:shadow-xl"
              style={{ background: 'linear-gradient(135deg, #6b38d4, var(--accent-primary))' }}>
              <Play size={18} /> Launch Studio <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter onLoginRequired={() => setShowLoginModal(true)} />
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
