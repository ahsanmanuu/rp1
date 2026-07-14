'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, Eye, Settings, HelpCircle } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

export default function CookiePolicyPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-inter)', overflowX: 'hidden' }}>
      
      {/* Header Section */}
      <section className="relative pt-32 pb-12 px-6 overflow-hidden border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="absolute inset-0 pointer-events-none hero-grid" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            Cookie <span className="gradient-text-animated">Policy</span>
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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(8,145,178,0.15)', color: '#0891b2' }}>
              <Eye size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold mb-1">What Are Cookies?</h2>
              <p className="text-sm opacity-70 leading-relaxed text-justify">
                Cookies are small text files stored on your computer or mobile device when you visit our website. They help us recognize your browser, persist your active editing session, and keep you logged in.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">1. Essential Session Cookies</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              These cookies are strictly necessary to provide you with services available through our site and to use features such as secure areas. PocketBase uses session cookies and authentication tokens stored in local storage to keep your session alive during active editing and compilation tasks.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">2. Performance & Analytics Cookies</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              We collect aggregate information about page loading speed, compilation failures, and response latency. This is used solely to improve compile server clusters, diagnose editor performance, and optimize load times.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">3. Managing and Opting Out</h2>
            <p className="text-sm opacity-70 leading-relaxed text-justify">
              Most web browsers allow you to control cookies through their settings. If you choose to block essential cookies, you may not be able to log in, save manuscripts, or use the LaTeX Studio compiler.
            </p>
          </div>

        </div>
      </section>

      <SiteFooter onLoginRequired={() => setShowLoginModal(true)} />
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
