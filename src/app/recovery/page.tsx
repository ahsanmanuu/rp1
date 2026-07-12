"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import LatexifyLogo from "@/components/LatexifyLogo";

export default function RecoveryPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process request");
      }
      
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
      
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="bg-background relative flex items-center justify-center px-4 overflow-hidden py-8 md:py-12" 
      style={{ minHeight: '100vh', width: '100%' }}
    >
      {/* High-fidelity ambient blurs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ background: 'rgba(0, 104, 95, 0.2)' }} />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '2s', background: 'rgba(0, 104, 95, 0.2)' }} />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[440px] z-10 p-6 md:p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)]"
        style={{ borderRadius: '32px' }}
      >
        {/* Logo/Seal Area */}
        <div className="flex flex-col items-center mb-5 text-center">
          <LatexifyLogo size={54} className="mb-3" />
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--accent-primary)] mb-1.5">Recovery</h1>
          <p className="text-xs md:text-sm font-bold !text-slate-600 dark:!text-slate-300">
            {submitted ? "Check your institutional inbox" : "Restore access to your Latexify Studio"}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold text-center">
            {error}
          </div>
        )}

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4 w-full">
            <div className="space-y-2 w-full">
              <label className="block text-[11px] font-black uppercase tracking-[0.15em] px-1 text-[var(--accent-primary)]">Email Identity</label>
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

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 font-black text-base rounded-2xl transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0"
              style={{ 
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              }}
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : <span>Request Access Link</span>}
            </button>

            <Link 
              href="/login" 
              className="flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 hover:text-[var(--accent-primary)] transition-colors group"
            >
              <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
              Return to Login
            </Link>
          </form>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-4"
          >
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-5 text-emerald-500">
              <CheckCircle2 size={40} />
            </div>
            <p className="text-center text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium mb-6 leading-relaxed">
              We have sent a recovery key to <span className="text-[var(--accent-primary)] font-black">{email}</span>. Please verify your identity to proceed.
            </p>

            {previewUrl && (
              <div className="w-full p-4 mb-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-center">
                <p className="font-black uppercase tracking-widest mb-2 text-[10px]">Development: Email Intercepted</p>
                <a 
                  href={previewUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-[var(--accent-primary)] text-white font-black text-[11px] uppercase tracking-widest hover:opacity-90 transition-all shadow-lg"
                >
                  View Recovery Email
                </a>
                <p className="mt-2 text-[10px] opacity-60 font-medium">In production, this email will be sent directly to your inbox.</p>
              </div>
            )}

            <Link 
              href="/login" 
              className="w-full py-3.5 font-black text-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all uppercase tracking-widest text-xs"
            >
              Return to Login
            </Link>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
