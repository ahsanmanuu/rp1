'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, Award, Scale, HelpCircle } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

export default function TermsOfServicePage() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-inter)', overflowX: 'hidden' }}>
      
      {/* Header Section */}
      <section className="relative pt-32 pb-12 px-6 overflow-hidden border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none hero-grid" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            Terms of <span className="gradient-text-animated">Service</span>
          </h1>
          <p className="text-sm opacity-60">
            Last Updated: July 14, 2026
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-10">
          
          <div className="p-6 rounded-3xl border flex items-start gap-4" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(107,56,212,0.15)', color: '#6b38d4' }}>
              <Scale size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold mb-1">Agreement of Terms</h2>
              <p className="text-sm opacity-70 leading-relaxed text-justify">
                By accessing Latexify Studio, Doc2Latex, or any related services, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">1. Services and Account Registration</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              Latexify provides a cloud-based editor for LaTeX, PDF compilation, TikZ visualization tools, and automated document conversion. To use our tools, you must register a secure account. You are responsible for safeguarding your password and account credentials, and for any activities or actions conducted under your profile.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">2. User Content & Intellectual Property</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              You retain all patent, copyright, and other intellectual property rights to any manuscript, mathematical model, and text file you upload or compile using our services. Latexify does not claim any ownership of your content. By compiling documents, you grant us a temporary, non-exclusive license solely to process and output your files as requested.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">3. Subscriptions & Payment Mapping</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              Our payment systems are anchored in **Indian Rupees (INR)**. Any transactions, checkout processes, and recurring subscriptions are billed from base INR rates. Conversion rates for international customers are determined dynamically at checkout. Cancelled premium plans remain valid until the end of the current billing cycle.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">4. Prohibited Uses & Resource Limits</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              You agree not to use the LaTeX compiler clusters for high-frequency automated scraping, cryptocurrency mining, or distribution of malware. We actively monitor server usage and enforce AI request capping rules based on IP address and registration details. Accounts that violate these server policies may be suspended.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">5. Limitation of Liability</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              Latexify is provided "as is" without warranty of any kind. We do not guarantee that compilation will be error-free or that documents will compile continuously under extreme server loads. Under no circumstances shall Latexify be liable for any lost research findings, data corruption, or compilation delays.
            </p>
          </div>

        </div>
      </section>

      <SiteFooter onLoginRequired={() => setShowLoginModal(true)} />
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
