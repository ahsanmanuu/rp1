'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, Clock, Brain, ArrowRight, Star, Heart, Coffee, Shield } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

const POSITIONS = [
  {
    title: 'Senior Frontend Engineer - React & Wasm',
    department: 'Engineering',
    location: 'Remote (IST/CET)',
    type: 'Full-time',
    desc: 'Help build our browser-based LaTeX IDE. Work with Monaco Editor, WebAssembly compilers, and real-time collaboration engines.',
  },
  {
    title: 'AI Research Engineer - LLMs & Scholarly Review',
    department: 'AI & Data',
    location: 'Bengaluru / Hybrid',
    type: 'Full-time',
    desc: 'Develop domain-specific retrieval, citation validation, and manuscript review agents using state-of-the-art transformer models.',
  },
  {
    title: 'LaTeX Compiler Engineer - Rust & TeX',
    department: 'Engineering',
    location: 'Remote (Global)',
    type: 'Full-time',
    desc: 'Optimize our backend TeX engines (pdfLaTeX, XeLaTeX, LuaLaTeX). Architect sandboxed compiler clusters on Kubernetes.',
  },
  {
    title: 'Developer Advocate - Academic Community',
    department: 'Marketing & Community',
    location: 'Remote',
    type: 'Full-time',
    desc: 'Bridge the gap between Latexify and the academic community. Create templates, tutorials, and partner with university research deans.',
  },
];

const BENEFITS = [
  { title: 'Remote-First Culture', desc: 'Work from anywhere in the world. We offer flexible hours and home office stipends.', icon: Heart, color: '#00685f' },
  { title: 'State-of-the-art Setup', desc: 'Get a brand new MacBook Pro or desktop of choice, along with high-end monitors and ergonomic chairs.', icon: Coffee, color: '#6b38d4' },
  { title: 'Academic Allowance', desc: 'We support continuous learning. Get a budget for research journals, books, and international conferences.', icon: Brain, color: '#0891b2' },
  { title: 'Comprehensive Care', desc: 'Premium health insurance, mental health support, and generous family/parental leave.', icon: Shield, color: '#f59e0b' },
];

export default function CareersPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-inter)', overflowX: 'hidden' }}>
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none hero-grid" />
        <div className="absolute top-[10%] right-[10%] w-[350px] h-[350px] rounded-full pointer-events-none opacity-20"
          style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', filter: 'blur(50px)' }} />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            Build the Future of <span className="gradient-text-animated">Scholarly Writing</span>
          </h1>
          <p className="text-base opacity-75 max-w-2xl mx-auto text-justify md:text-center">
            At Latexify, we are democratizing research. Join a passionate team of engineers, researchers, and designers building the ultimate platform for scientific communication.
          </p>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Why Join Latexify?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {BENEFITS.map((benefit, i) => (
              <div
                key={i}
                className="p-6 rounded-3xl border"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: `color-mix(in srgb, ${benefit.color} 15%, transparent)`, color: benefit.color }}>
                  <benefit.icon size={22} />
                </div>
                <h3 className="text-lg font-bold mb-2">{benefit.title}</h3>
                <p className="text-sm opacity-60 leading-relaxed text-justify">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Open Positions</h2>
          <div className="space-y-6">
            {POSITIONS.map((pos, idx) => (
              <div
                key={idx}
                className="p-6 md:p-8 rounded-3xl border transition-all duration-300 hover:scale-[1.01]"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-50 mb-1.5 block">{pos.department}</span>
                    <h3 className="text-lg md:text-xl font-bold">{pos.title}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                      <MapPin size={12} /> {pos.location}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                      <Clock size={12} /> {pos.type}
                    </span>
                  </div>
                </div>
                <p className="text-sm opacity-70 leading-relaxed mb-5 text-justify">{pos.desc}</p>
                <Link href="/contact-us" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-all hover:gap-2.5" style={{ color: 'var(--accent-primary)' }}>
                  Apply Now <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Careers Support */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-8 md:p-12 rounded-3xl text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent), color-mix(in srgb, #6b38d4 5%, transparent))', border: '1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)' }}>
            <h2 className="text-2xl md:text-3xl font-black mb-3">Don't see the right role?</h2>
             <p className="text-sm opacity-70 mb-6 max-w-4xl mx-auto text-justify" style={{ textAlignLast: 'justify' }}>
               We are always looking for talented LaTeX developers, AI specialists, and UI enthusiasts. Drop us your resume, and we will contact you when a fit arises.
             </p>
            <div className="flex justify-center">
              <Link href="/contact-us" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02]" style={{ background: 'linear-gradient(135deg, var(--accent-primary), #6b38d4)' }}>
                Send Open Application <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter onLoginRequired={() => setShowLoginModal(true)} />
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
