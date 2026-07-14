'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Brain, BookOpen, Shield, CheckCircle2, Search, FileText, Zap, Eye, Layers, MessageSquare, ArrowRight, Star, Globe } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

const FEATURES = [
  { title: 'Grammar & Style Analysis', desc: 'Identify awkward phrasing, passive voice misuse, and inconsistent tone. Get line-level suggestions to improve clarity and readability.', icon: BookOpen, color: '#00685f' },
  { title: 'Logical Gap Detection', desc: 'Our AI flags missing arguments, leaps in reasoning, and unsupported claims. Strengthen your paper\'s argumentative flow before submission.', icon: Brain, color: '#6b38d4' },
  { title: 'Methodology Assessment', desc: 'Evaluate the rigor of your experimental design, sample size justification, and statistical methods against field-specific best practices.', icon: Search, color: '#0891b2' },
  { title: 'Citation & Reference Check', desc: 'Detect missing citations, suspicious references, and formatting inconsistencies across APA, MLA, IEEE, and Chicago styles.', icon: FileText, color: '#f59e0b' },
  { title: 'Structural Outline Review', desc: 'Review your paper\'s organization at a glance. Flag missing sections, imbalanced paragraphs, and weak transitions between ideas.', icon: Layers, color: '#dc2626' },
  { title: 'Actionable Recommendations', desc: 'Every issue comes with a suggested fix. Accept, dismiss, or modify each recommendation — you stay in full control of your manuscript.', icon: MessageSquare, color: '#059669' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Submit Your Manuscript', desc: 'Paste your paper or upload a .docx/.pdf file. AI Peer Reviewer accepts drafts of any length, from conference papers to full dissertations.' },
  { step: '2', title: 'AI Reads & Analyzes', desc: 'Our engine processes your manuscript against academic best practices — grammar, logic, methodology, structure, and citation integrity.' },
  { step: '3', title: 'Review & Revise', desc: 'Browse flagged issues grouped by category. Apply suggested changes directly or export the annotated report for your co-authors.' },
];

const TESTIMONIALS = [
  { quote: 'Caught three logical gaps in my discussion section that two human reviewers missed. This tool has become an essential step in my writing workflow.', author: 'Dr. Priya Nair', role: 'Assistant Professor, IIT Bombay' },
  { quote: 'The methodology assessment is incredibly thorough. It flagged our sample size justification and suggested relevant power analysis references.', author: 'Prof. David Chen', role: 'Research Scientist, Stanford University' },
  { quote: 'I ran 20 student papers through it before final submission. The consistency of feedback and the clarity of recommendations saved me dozens of hours of manual review.', author: 'Dr. Sarah Mitchell', role: 'Department Chair, University of Cambridge' },
];

export default function ReviewerPage() {
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
            <Zap size={14} /> AI-Powered Academic Review
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
            AI Peer <span className="gradient-text-animated">Reviewer</span>
          </h1>
            <p className="text-lg opacity-70 max-w-2xl mx-auto mb-10 text-justify">
            Get instant, intelligent feedback on your academic manuscripts — from grammar and style 
            to logical reasoning and methodological rigor. Strengthen every paper before peer review.
          </p>
          
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-10 px-6 border-y" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-8 md:gap-16 text-xs font-bold uppercase tracking-widest opacity-40">
          <span className="flex items-center gap-2"><Star size={14} /> 25,000+ Papers Reviewed</span>
          <span className="flex items-center gap-2"><Shield size={14} /> End-to-End Encrypted</span>
          <span className="flex items-center gap-2"><Globe size={14} /> 80+ Countries</span>
          <span className="flex items-center gap-2"><CheckCircle2 size={14} /> 94% Satisfaction</span>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Comprehensive Review Dimensions</h2>
            <p className="text-base opacity-60 max-w-2xl mx-auto text-justify">
              Six lenses through which every manuscript is evaluated — no detail goes unnoticed.
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

      <SiteFooter onLoginRequired={() => setShowLoginModal(true)} />
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
