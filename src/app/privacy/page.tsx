'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye, CheckCircle2 } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

export default function PrivacyPolicyPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-inter)', overflowX: 'hidden' }}>
      
      {/* Header Section */}
      <section className="relative pt-32 pb-12 px-6 overflow-hidden border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none hero-grid" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            Privacy <span className="gradient-text-animated">Policy</span>
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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0,104,95,0.15)', color: '#00685f' }}>
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold mb-1">Our Privacy Pledge</h2>
              <p className="text-sm opacity-70 leading-relaxed text-justify">
                We believe your research papers, mathematical formulas, and academic findings represent your intellectual property. We design our platform to ensure your datasets and text files remain entirely private, secure, and under your control.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">1. Information We Collect</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              To operate the Latexify Studio, we collect necessary user profile information (such as your name, academic email address, and institutional affiliations) when you register. Additionally, we store the LaTeX source code, figure files, bibliographies, and documents you upload or write inside our IDE.
            </p>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              For billing purposes, transactional data is securely processed through Cashfree Payments. All currency amounts are converted and mapped from base INR prices in compliance with Reserve Bank of India (RBI) regulations. We do not store full credit card details on our servers.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">2. How We Use Your Data</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              We process your content exclusively to compile your LaTeX code, generate real-time PDF previews, render TikZ diagrams, and allow co-authors to write collaboratively. We do NOT sell, license, or rent your research manuscripts to any third parties. 
            </p>
            <p className="text-sm opacity-70 leading-relaxed text-justify font-semibold" style={{ color: 'var(--accent-primary)' }}>
              Crucially, we do NOT use your private research code or documents to train public, generative AI models.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">3. Data Sovereignty and Security</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              All files are transmitted securely using industry-standard TLS encryption. Our databases and file repositories are isolated on secure server environments with daily backups. In compliance with data regulations, you have full ownership to export your project directory or permanently delete your account at any time.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">4. AI Cap Rules & Monitoring</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              In order to prevent abuse and protect our server capacities, we enforce AI usage limits. AI queries are monitored by email, IP address, and geographic region. This data is processed locally inside our orchestrator and is cached temporarily.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">5. Contact Information</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              For any questions regarding this Privacy Policy or your personal data rights, please contact our Data Protection Officer at <Link href="/contact-us" className="underline hover:text-white" style={{ color: 'var(--accent-primary)' }}>support@latexify.studio</Link>.
            </p>
          </div>

        </div>
      </section>

      <SiteFooter onLoginRequired={() => setShowLoginModal(true)} />
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
