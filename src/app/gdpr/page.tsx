'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldAlert, UserCheck, Trash2, ArrowRight } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

export default function GDPRCompliancePage() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-inter)', overflowX: 'hidden' }}>
      
      {/* Header Section */}
      <section className="relative pt-32 pb-12 px-6 overflow-hidden border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none hero-grid" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            GDPR <span className="gradient-text-animated">Compliance</span>
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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626' }}>
              <UserCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold mb-1">Our GDPR Commitment</h2>
              <p className="text-sm opacity-70 leading-relaxed text-justify">
                We are committed to full compliance with the General Data Protection Regulation (GDPR) for all users worldwide. We implement privacy by design, giving you absolute control over your academic data, documents, and personal details.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">1. Your Core Rights Under GDPR</h2>
            <ul className="space-y-3 pl-4 list-disc text-sm opacity-70 text-justify">
              <li><strong>Right of Access:</strong> You can download copies of all your project source directories, figures, and manuscripts directly from the Latexify dashboard at any time.</li>
              <li><strong>Right to Rectification:</strong> You can update your profile information, academic email address, and institutional affiliations instantly in your profile dashboard.</li>
              <li><strong>Right to Erasure (To Be Forgotten):</strong> You can permanently delete any project folder or close your entire Latexify account. Deletion immediately removes all LaTeX files from our active database and compile storage disks.</li>
              <li><strong>Right to Data Portability:</strong> You can export your full project workspace as a structured ZIP file containing all your LaTeX source files and compiled PDFs.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">2. Secure Data Processing</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              All project files, figures, and manuscripts are stored in secure, isolated server directories. We compile files inside ephemeral, sandboxed Docker containers to prevent cross-contamination of intellectual property.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">3. Data Retention and Erasure</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              We retain your projects and manuscripts only as long as your account is active. When you delete a document, it is removed from our storage disks immediately. Log files are automatically purged within 30 days.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">4. Contact Data Protection Officer</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              If you wish to execute any of your data rights or have questions about how we process data globally, please contact our Data Protection Officer at <Link href="/contact-us" className="underline hover:text-white" style={{ color: 'var(--accent-primary)' }}>dpo@latexify.studio</Link>.
            </p>
          </div>

        </div>
      </section>

      <SiteFooter onLoginRequired={() => setShowLoginModal(true)} />
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
