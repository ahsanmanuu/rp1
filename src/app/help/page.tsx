'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, HelpCircle, BookOpen, MessageSquare, Zap, Shield, FileText, ChevronDown, ArrowRight } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

const CATEGORIES = [
  { id: 'studio', title: 'Latexify Studio', desc: 'Editing, compiling, templates, and compiler configurations.', icon: FileText, color: '#00685f' },
  { id: 'doc2latex', title: 'Doc2Latex Converter', desc: 'Word document to LaTeX conversion and math formula parsing.', icon: Zap, color: '#6b38d4' },
  { id: 'diagrams', title: 'Diagram Studio', desc: 'Visual TikZ diagram creation, canvas tools, and code exports.', icon: HelpCircle, color: '#f59e0b' },
  { id: 'reviewer', title: 'AI Peer Reviewer', desc: 'Scholarly critique, logical checks, and prompt customization.', icon: BookOpen, color: '#dc2626' },
  { id: 'security', title: 'Security & Privacy', desc: 'Data sovereignty, encryption, and institutional compliance.', icon: Shield, color: '#0891b2' },
  { id: 'billing', title: 'Billing & Plans', desc: 'Subscriptions, invoice retrieval, cashfree payments, and credits.', icon: MessageSquare, color: '#059669' },
];

const FAQS = [
  { q: 'Is Latexify really free to use?', a: 'Yes! Latexify offers a robust free tier that includes access to the LaTeX Studio, templates, and basic document compilation. We also offer premium plans for advanced AI capabilities, larger compile clusters, and institutional features.' },
  { q: 'How does the Doc2Latex conversion work?', a: 'Our proprietary parsing engine analyzes the structure, headers, citations, math equations, and tables inside your Word (.docx) document, converting them into clean, compiled LaTeX code instantly.' },
  { q: 'Can I collaborate in real-time with other researchers?', a: 'Absolutely. Much like Google Docs, you can invite co-authors to your project. You can see their cursors, edit simultaneously, and share comments in real-time.' },
  { q: 'Are my research papers secure on the platform?', a: 'Security is our highest priority. All project directories are strictly isolated and encrypted in transit and at rest using AES-256. We do not use your proprietary research papers to train public AI models.' },
  { q: 'How do I cancel my premium subscription?', a: 'You can manage or cancel your subscription at any time directly through your Billing Dashboard page. Your premium benefits will remain active until the end of your billing cycle.' },
];

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const filteredFaqs = FAQS.filter(faq => 
    faq.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
    faq.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-inter)', overflowX: 'hidden' }}>
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none hero-grid" />
        <div className="absolute top-[10%] right-[15%] w-[400px] h-[400px] rounded-full pointer-events-none opacity-20"
          style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', filter: 'blur(50px)' }} />

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            How can we <span className="gradient-text-animated">help you</span>?
          </h1>
          <p className="text-base text-justify md:text-center opacity-70 mb-8 max-w-2xl mx-auto">
            Search our knowledge base for quick setup guides, troubleshooting tips, and documentation for our AI-powered editorial tools.
          </p>

          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-3.5 w-5 h-5 opacity-40" />
            <input
              type="text"
              placeholder="Search articles, guides, and FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-6 py-3.5 rounded-2xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent-primary"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
            />
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Browse Categories</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {CATEGORIES.map((cat, i) => (
              <div
                key={cat.id}
                className="p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 relative overflow-hidden"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: `color-mix(in srgb, ${cat.color} 15%, transparent)`, color: cat.color }}>
                  <cat.icon size={22} />
                </div>
                <h3 className="text-lg font-bold mb-2">{cat.title}</h3>
                <p className="text-sm opacity-60 leading-relaxed text-justify">{cat.desc}</p>
                <Link href="#" className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-all hover:gap-2.5" style={{ color: 'var(--accent-primary)' }}>
                  View Guides <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border overflow-hidden"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left font-semibold text-sm md:text-base transition-colors hover:text-white"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown size={18} className={`transition-transform duration-300 ${openFaq === idx ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === idx && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="p-5 pt-0 text-sm opacity-70 leading-relaxed border-t border-dashed" style={{ borderColor: 'var(--border)' }}>
                          <p className="text-justify">{faq.a}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            ) : (
              <p className="text-center opacity-60 py-8">No results found for "{searchQuery}"</p>
            )}
          </div>
        </div>
      </section>

      {/* Support CTA */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-8 md:p-12 rounded-3xl text-center relative overflow-hidden" 
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent), color-mix(in srgb, #6b38d4 5%, transparent))', border: '1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)' }}>
            <h2 className="text-2xl md:text-3xl font-black mb-3">Still have questions?</h2>
            <p className="text-sm opacity-70 mb-6 max-w-xl mx-auto">
              Our support team is here to assist you with LaTeX template integrations, custom API setup, or billing issues.
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/contact-us" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02]" style={{ background: 'linear-gradient(135deg, var(--accent-primary), #6b38d4)' }}>
                Contact Support <ArrowRight size={16} />
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
