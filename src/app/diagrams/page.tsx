'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PenTool, Network, Layout, GitBranch, Workflow, Grip, Zap, ArrowRight, Star, Shield, Globe, CheckCircle2 } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

const FEATURES = [
  { title: 'Intelligent Diagramming', desc: 'Create professional flowcharts, mind maps, and system architecture diagrams with AI-assisted node placement and smart routing.', icon: PenTool, color: '#6b38d4' },
  { title: 'Real-time Collaboration', desc: 'Work with your team simultaneously. See cursors, edits, and comments in real time — perfect for remote design sessions.', icon: Network, color: '#0891b2' },
  { title: 'Drag & Drop Canvas', desc: 'An infinite canvas with intuitive drag-and-drop controls. Arrange, resize, and connect elements without fighting the tool.', icon: Layout, color: '#059669' },
  { title: 'Version History', desc: 'Every change is saved automatically. Branch, diff, and restore any previous version of your diagram with a single click.', icon: GitBranch, color: '#f59e0b' },
  { title: 'Auto Layout Engine', desc: 'Let the engine arrange your diagram into clean, readable layouts — tree, flow, force-directed, or orthogonal in one click.', icon: Workflow, color: '#dc2626' },
  { title: 'Export Anywhere', desc: 'Export to SVG, PNG, PDF, or embed as an interactive iframe. Diagrams stay crisp at any resolution and integrate with your docs.', icon: Grip, color: '#00685f' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Start with a Blank Canvas or Template', desc: 'Choose from a library of diagram templates — flowcharts, UML, wireframes, mind maps — or begin with a blank canvas.' },
  { step: '2', title: 'Drag, Connect & Style', desc: 'Add shapes and connectors with drag-and-drop. Style with themes, colours, and typography that match your brand.' },
  { step: '3', title: 'Share, Export & Embed', desc: 'Share a live link, export as an image or PDF, or embed your diagram directly into Notion, Confluence, or your docs.' },
];

const TESTIMONIALS = [
  { quote: 'Diagram Studio replaced Lucidchart and Draw.io for our entire engineering org. The auto-layout alone saved us hours of manual alignment work.', author: 'Rahul Mehta', role: 'Engineering Manager, Razorpay' },
  { quote: 'We use it for everything — system architecture reviews, sprint planning, and client presentations. The collaboration features are best in class.', author: 'Priya Sharma', role: 'Product Designer, CRED' },
  { quote: 'The AI node placement is uncanny. It reads my mind. I went from idea to polished architecture diagram in under five minutes.', author: 'Arun Nair', role: 'Staff Engineer, Swiggy' },
];

export default function DiagramsPage() {
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
            <Zap size={14} /> Visual Thinking, Supercharged
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
            Diagram <span className="gradient-text-animated">Studio</span>
          </h1>
            <p className="text-lg opacity-70 max-w-2xl mx-auto mb-10 text-justify">
            Design beautiful diagrams, flowcharts, and system architectures in seconds.
            AI-powered layout, real-time collaboration, and export-ready output —
            all in a single, stunning canvas.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/diagrams/editor?new=true"
              className="px-8 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 text-white shadow-xl hover:scale-105 transition-all"
              style={{ background: 'linear-gradient(135deg, #6b38d4 0%, #8b5cf6 100%)', boxShadow: '0 10px 30px rgba(107,56,212,0.3)' }}
            >
              <PenTool size={18} />
              Create New Diagram
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/diagrams/editor"
              className="px-8 py-4 rounded-2xl text-sm font-bold flex items-center gap-3 border hover:bg-white/5 transition-all"
              style={{ borderColor: 'var(--border)' }}
            >
              Open Diagram Editor
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-10 px-6 border-y" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-8 md:gap-16 text-xs font-bold uppercase tracking-widest opacity-40">
          <span className="flex items-center gap-2"><Star size={14} /> 25,000+ Teams</span>
          <span className="flex items-center gap-2"><Shield size={14} /> Enterprise Security</span>
          <span className="flex items-center gap-2"><Globe size={14} /> 120+ Countries</span>
          <span className="flex items-center gap-2"><CheckCircle2 size={14} /> 99.9% Uptime</span>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Everything You Need to Diagram</h2>
            <p className="text-base opacity-60 max-w-2xl mx-auto text-justify">
              From quick sketches to production-grade architecture diagrams — built for speed, teamwork, and precision.
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
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-14">Loved by Engineers & Designers</h2>
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
