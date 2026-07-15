"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { LogIn, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import LatexifyLogo from "@/components/LatexifyLogo";
import { useSession } from "@/lib/pb-auth-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [machineId, setMachineId] = useState("");
  const [showDupModal, setShowDupModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [dupSessionDetails, setDupSessionDetails] = useState<any[]>([]);
  const router = useRouter();
  const { status, update } = useSession();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }

      let mId = localStorage.getItem('machine_id');
      if (!mId) {
        mId = 'mch_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('machine_id', mId);
      }
      setMachineId(mId);
    }
  }, []);

  const handleForceLogin = async () => {
    setModalLoading(true);
    try {
      const logoutRes = await fetch("/api/auth/logout-all-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, machineId }),
      });

      if (!logoutRes.ok) {
        throw new Error("Failed to clear other sessions.");
      }

      const res = await fetch("/api/auth/pb-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, machineId }),
      });

      if (!res.ok) {
        throw new Error("Login failed after clearing sessions.");
      }

      await update();
      setShowDupModal(false);
      setModalLoading(false);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "An error occurred during force login.");
      setShowDupModal(false);
      setModalLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (typeof window !== 'undefined') {
      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
      } else {
        localStorage.removeItem('remembered_email');
      }
    }

    const res = await fetch("/api/auth/pb-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, machineId }),
    });

    if (!res.ok) {
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setDupSessionDetails(data.sessionDetails || []);
        setShowDupModal(true);
        setLoading(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Invalid credentials. Ensure data accuracy.");
      setLoading(false);
    } else {
      await update();
      router.push("/dashboard");
    }
  };

  // No useEffect redirect needed — handleSubmit already navigates to /dashboard on success.
  // A useEffect redirect here would fire AFTER handleSubmit's router.push, causing double navigation.

  return (
    <div 
      className="bg-background relative flex items-center justify-center px-4 overflow-hidden py-8 md:py-12" 
      style={{ minHeight: '100vh', width: '100%' }}
    >
      {/* High-fidelity ambient blurs - Enhanced for depth */}
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
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--accent-primary)] mb-1.5">Welcome Back</h1>
          <p className="text-xs md:text-sm font-bold !text-slate-600 dark:!text-slate-300">Enter your credentials to access the studio</p>
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
            <label className="block text-[11px] font-black uppercase tracking-[0.15em] px-1 text-[var(--accent-primary)] dark:text-[var(--accent-primary)]">Email Identity</label>
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
                tabIndex={1}
                className="w-full pl-14 pr-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold text-base outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-2 w-full">
            <div className="flex justify-between items-center px-1">
              <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-[var(--accent-primary)]">Access Key</label>
              <Link href="/recovery" tabIndex={-1} className="text-[11px] font-black hover:opacity-100 opacity-70 transition-opacity text-[var(--accent-primary)] underline decoration-2 underline-offset-4">Recovery?</Link>
            </div>
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
                tabIndex={2}
                className="w-full pl-14 pr-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-semibold text-base outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center px-1 py-1">
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <div className="relative flex items-center justify-center">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer appearance-none w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-700 checked:bg-[var(--accent-primary)] checked:border-[var(--accent-primary)] transition-all cursor-pointer"
                />
                <div className="absolute text-white scale-0 peer-checked:scale-100 transition-transform pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                </div>
              </div>
              <span className="text-[11px] font-black tracking-widest uppercase text-slate-500 dark:text-slate-400 group-hover:text-[var(--accent-primary)] transition-colors">Persistent Session</span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            tabIndex={3}
            className="w-full py-3.5 font-black text-base rounded-2xl transition-all flex items-center justify-center gap-3 mt-1 cursor-pointer disabled:opacity-50 text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0"
            style={{ 
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            }}
          >
            {loading ? <Loader2 size={24} className="animate-spin" /> : <><span>Enter Studio</span><LogIn size={20} /></>}
          </button>
        </form>

        <div className="text-center text-[11px] font-black mt-5 pt-4 border-t border-slate-200 dark:border-white/10 uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          <span className="opacity-90">New Explorer?</span>{" "}
          <Link href="/register" className="ml-2 font-black text-[var(--accent-primary)] hover:underline decoration-2 underline-offset-4">Establish Identity</Link>
        </div>
      </motion.div>

      {/* Duplicate Login Detection Modal */}
      {showDupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fadeIn">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-[420px] p-6 rounded-[28px] border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-center gap-3 mb-4 text-amber-500">
              <AlertCircle size={28} />
              <h3 className="text-lg font-black tracking-tight dark:text-white text-slate-900">Active Session Detected</h3>
            </div>
            
            <p className="text-sm font-semibold mb-4 leading-relaxed text-slate-600 dark:text-slate-300">
              You are currently logged in on another device. Would you like to terminate all other active sessions and log in on this machine?
            </p>

            {dupSessionDetails.length > 0 && (
              <div className="mb-5 p-4 rounded-2xl border text-xs bg-slate-50 dark:bg-slate-950/40 border-slate-100 dark:border-white/5 space-y-2">
                <div className="font-black text-[var(--accent-primary)] uppercase tracking-wider mb-2">Conflicting Device Info</div>
                {dupSessionDetails.map((session, idx) => (
                  <div key={idx} className="space-y-1 text-slate-600 dark:text-slate-400 font-semibold">
                    <div><span className="font-bold opacity-60">IP Address:</span> <span className="font-mono">{session.ipAddress}</span></div>
                    <div><span className="font-bold opacity-60">Location:</span> {session.location}</div>
                    <div><span className="font-bold opacity-60">Machine ID:</span> <span className="font-mono">{session.machineId}</span></div>
                    <div><span className="font-bold opacity-60">Session Started:</span> {new Date(session.createdAt).toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={modalLoading}
                onClick={() => setShowDupModal(false)}
                className="px-5 py-2.5 rounded-full text-xs font-bold transition-all border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalLoading}
                onClick={handleForceLogin}
                className="px-5 py-2.5 rounded-full text-xs font-bold transition-all text-white flex items-center gap-2 active:scale-95 shadow-md hover:shadow-lg disabled:opacity-50"
                style={{ 
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                }}
              >
                {modalLoading ? <Loader2 size={16} className="animate-spin" /> : "Logout & Login"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
