"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { UserPlus, Mail, Lock, User, AlertCircle, Loader2 } from "lucide-react";
import LatexifyLogo from "@/components/LatexifyLogo";
import { useSession } from "@/lib/pb-auth-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTermsPopup, setShowTermsPopup] = useState(false);
  const [termsScrolledToBottom, setTermsScrolledToBottom] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [machineId, setMachineId] = useState("");
  const router = useRouter();
  const { update } = useSession();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let mId = localStorage.getItem('machine_id');
      if (!mId) {
        mId = 'mch_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('machine_id', mId);
      }
      setMachineId(mId);
    }
  }, []);

  const performSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      // Save terms acceptance
      const userId = data.user?.id || data.userId;
      if (userId) {
        try {
          await fetch("/api/terms-accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
        } catch (_) {
          // non-blocking
        }
      }

      const loginRes = await fetch("/api/auth/pb-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, machineId }),
      });

      if (!loginRes.ok) {
        router.push("/login?registered=true");
      } else {
        await update();
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAcceptTerms = () => {
    setTermsAccepted(true);
    setShowTermsPopup(false);
    setTermsScrolledToBottom(false);
    // Do NOT auto-submit — user must click submit manually after accepting
  };

  const handleTermsCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Open the terms popup when user checks the box
      setShowTermsPopup(true);
      setTermsScrolledToBottom(false);
    } else {
      // Unchecking — only allowed if not already accepted
      if (!termsAccepted) {
        // If the popup is open and they uncheck, just close
        // This handles the case where they check then uncheck before accepting
      }
    }
  };

  const handleClosePopup = () => {
    setShowTermsPopup(false);
    setTermsScrolledToBottom(false);
    // If they closed without accepting, uncheck the checkbox
    if (!termsAccepted) {
      // The checkbox will remain unchecked naturally since termsAccepted is still false
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setShowTermsPopup(true);
      setTermsScrolledToBottom(false);
      return;
    }
    performSubmit();
  };

  return (
    <div 
      className="bg-background relative flex items-center justify-center px-4 overflow-hidden py-8 md:py-12" 
      style={{ minHeight: '100vh', width: '100%' }}
    >
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ background: 'rgba(0, 104, 95, 0.2)' }} />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '2s', background: 'rgba(0, 104, 95, 0.2)' }} />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[440px] z-10 p-6 md:p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)]"
        style={{ borderRadius: '32px' }}
      >
        <div className="flex flex-col items-center mb-5 text-center">
          <LatexifyLogo size={54} className="mb-3" />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--accent-primary)] mb-1.5">Create Account</h1>
          <p className="text-xs md:text-sm font-bold !text-slate-600 dark:!text-slate-300">Join our scholarly network today</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-3 p-3 mb-5 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs font-bold overflow-hidden"
          >
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4 w-full" autoComplete="off">
          <div className="space-y-2 w-full">
            <label className="block text-[11px] font-black uppercase tracking-[0.15em] px-1 text-[var(--accent-primary)]">Scholar Name</label>
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-[var(--accent-primary)] text-slate-400 dark:text-slate-500">
                <User size={20} />
              </div>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Professor Smith"
                required
                className="w-full pl-14 pr-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold text-base outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-2 w-full">
            <label className="block text-[11px] font-black uppercase tracking-[0.15em] px-1 text-[var(--accent-primary)]">Institutional Email</label>
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-[var(--accent-primary)] text-slate-400 dark:text-slate-500">
                <Mail size={20} />
              </div>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="scholar@university.edu"
                required
                className="w-full pl-14 pr-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold text-base outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-2 w-full">
            <label className="block text-[11px] font-black uppercase tracking-[0.15em] px-1 text-[var(--accent-primary)]">Access Key</label>
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-[var(--accent-primary)] text-slate-400 dark:text-slate-500">
                <Lock size={20} />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-14 pr-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold text-base outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
              />
            </div>
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start gap-3 pt-1">
            <input
              type="checkbox"
              id="termsCheck"
              checked={termsAccepted}
              onChange={handleTermsCheckbox}
              className="w-4 h-4 mt-0.5 rounded flex-shrink-0 cursor-pointer"
              style={{ accentColor: '#00685f' }}
            />
            <label htmlFor="termsCheck" className="text-xs leading-relaxed cursor-pointer" style={{ color: '#475569' }}>
              I have read and accept the{" "}
              <span className="font-bold underline decoration-1 underline-offset-2" style={{ color: 'var(--accent-primary)' }}>
                Terms & Conditions
              </span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={loading || !termsAccepted}
            className="w-full py-3.5 font-black text-base rounded-2xl transition-all flex items-center justify-center gap-3 mt-1 cursor-pointer disabled:opacity-50 text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0"
            style={{ 
              background: !termsAccepted ? '#94a3b8' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            }}
          >
            {loading ? <Loader2 size={24} className="animate-spin" /> : <><span>Establish Account</span><UserPlus size={20} /></>}
          </button>
        </form>

        <div className="text-center text-[11px] font-black mt-5 pt-4 border-t border-slate-200 dark:border-white/10 uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          <span className="opacity-90">Already Established?</span>{" "}
          <Link href="/login" className="ml-2 font-black text-[var(--accent-primary)] hover:underline decoration-2 underline-offset-4">Identify via Login</Link>
        </div>
      </motion.div>

      {/* Terms Popup */}
      {showTermsPopup && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl p-6 rounded-2xl border shadow-2xl my-auto" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: '#1e293b' }}>Terms & Conditions</h3>
              <button onClick={handleClosePopup} className="p-1 rounded-full hover:bg-gray-100">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div
              className="space-y-4 text-sm leading-relaxed max-h-[50vh] overflow-y-auto p-4 rounded-lg"
              style={{ backgroundColor: '#f8fafc', color: '#334155' }}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
                  setTermsScrolledToBottom(true);
                }
              }}
            >
              <h4 className="font-bold text-base">1. Platform Responsibility & Disclaimer</h4>
              <p>Latexify provides an online platform for writing, compiling, and managing LaTeX documents. We are not responsible for any data theft, hacking, or unauthorized access to your account. You acknowledge that no online platform can guarantee absolute security.</p>

              <h4 className="font-bold text-base">2. No Collection of Personal Information</h4>
              <p>We do not collect, store, or process your personal information beyond what is minimally necessary for account creation and platform functionality. Your documents, research data, and intellectual property remain yours. We do not sell, share, or monetize your personal data.</p>

              <h4 className="font-bold text-base">3. Data Loss</h4>
              <p>While we take reasonable measures to protect your data, we are not liable for any data loss, corruption, or damage that may occur. You are strongly advised to maintain regular backups of your work outside the platform. We recommend exporting your projects periodically.</p>

              <h4 className="font-bold text-base">4. AI-Generated Content</h4>
              <p>Our platform includes AI-powered features for code generation, peer review assistance, and writing suggestions. AI-generated code, text, or suggestions may contain errors, inaccuracies, or bugs. You are solely responsible for reviewing, testing, and validating any AI-generated output before use. We make no warranties regarding the accuracy, completeness, or reliability of AI-generated content.</p>

              <h4 className="font-bold text-base">5. User Responsibility</h4>
              <p>You bear full and sole responsibility for all content you create, upload, compile, publish, or share through our platform. This includes ensuring compliance with applicable laws, institutional policies, and ethical guidelines. You indemnify Latexify against any claims arising from your use of the platform or your content.</p>

              <h4 className="font-bold text-base">6. Platform Role — No Publication Services</h4>
              <p>Latexify is strictly a writing and compilation platform. We are a technology provider, not a publisher. We do not publish, distribute, or disseminate articles, theses, research papers, or any academic works. We do not provide peer review services, editorial services, or journal submission services. Any references to "AI Peer Review" refer to automated writing assistance tools, not formal academic peer review.</p>

              <h4 className="font-bold text-base">7. No Endorsement or Verification</h4>
              <p>We do not verify, endorse, or validate the accuracy, originality, or legality of any content created on our platform. Users are responsible for ensuring their work does not infringe upon the intellectual property rights of others.</p>

              <h4 className="font-bold text-base">8. Governing Law & Jurisdiction</h4>
              <p>These Terms & Conditions shall be governed by and construed in accordance with the laws of India. All disputes, claims, or controversies arising out of or relating to these terms or your use of the platform shall be resolved exclusively by the courts in Lucknow, Uttar Pradesh, India. By using this platform, you submit to the personal jurisdiction of such courts.</p>

              <h4 className="font-bold text-base">9. Limitation of Liability</h4>
              <p>To the maximum extent permitted by Indian law, Latexify shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, or goodwill, arising from your use of the platform.</p>

              <h4 className="font-bold text-base">10. Modification of Terms</h4>
              <p>We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms. You will be notified of material changes via email or platform notice.</p>

              <p className="text-xs italic mt-4" style={{ color: '#94a3b8' }}>Please scroll to the bottom to enable the Accept button.</p>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsScrolledToBottom}
                  onChange={() => {}}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#00685f' }}
                />
                <span className="text-xs" style={{ color: '#475569' }}>I have read and understood the Terms & Conditions</span>
              </label>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleClosePopup}
                className="flex-1 py-2.5 rounded-lg border text-sm font-bold"
                style={{ borderColor: '#e2e8f0', color: '#64748b' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptTerms}
                disabled={!termsScrolledToBottom}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: termsScrolledToBottom ? '#00685f' : '#94a3b8' }}
              >
                I Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
