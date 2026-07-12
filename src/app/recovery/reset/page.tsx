"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Loader2, CheckCircle2, AlertCircle, GraduationCap } from "lucide-react";

function ResetContent() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  
  const searchParams = useSearchParams();
  
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    if (!token || !email) {
      setError("Invalid or expired recovery link. Please request a new one.");
    }
  }, [token, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Access keys do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/recovery", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          token,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update access key");
      }
      
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
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
        <div className="flex flex-col items-center mb-5 text-center">
          <div 
            className="w-12 h-12 rounded-[16px] flex items-center justify-center mb-3 shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-default"
            style={{ 
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              boxShadow: '0 12px 32px -8px var(--accent-primary)'
            }}
          >
            <Lock className="text-white" size={24} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--accent-primary)] mb-1.5">Reset Access</h1>
          <p className="text-xs md:text-sm font-bold !text-slate-600 dark:!text-slate-300">
            {submitted ? "Access key updated successfully" : `Establishing new credentials for ${email}`}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold text-center flex items-center justify-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4 w-full">
            <div className="space-y-2 w-full">
              <label className="block text-[11px] font-black uppercase tracking-[0.15em] px-1 text-[var(--accent-primary)]">New Access Key</label>
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
                  className="w-full pl-14 pr-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold text-base outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-2 w-full">
              <label className="block text-[11px] font-black uppercase tracking-[0.15em] px-1 text-[var(--accent-primary)]">Confirm Key</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-[var(--accent-primary)] text-slate-400 dark:text-slate-500">
                  <Lock size={20} />
                </div>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-14 pr-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold text-base outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading || !!error}
              className="w-full py-3.5 font-black text-base rounded-2xl transition-all flex items-center justify-center gap-3 mt-1 cursor-pointer disabled:opacity-50 text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0"
              style={{ 
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              }}
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : <span>Update Access Key</span>}
            </button>
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
              Your credentials have been successfully updated. You can now access the studio with your new key.
            </p>
            <Link 
              href="/login" 
              className="w-full py-3.5 font-black text-center rounded-2xl bg-[var(--accent-primary)] text-white hover:opacity-90 transition-all uppercase tracking-widest text-xs"
            >
              Access Studio
            </Link>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-[var(--accent-primary)]" size={48} /></div>}>
      <ResetContent />
    </Suspense>
  );
}
