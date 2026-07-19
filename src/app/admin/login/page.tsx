"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  LogIn, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Loader2, 
  ShieldCheck, 
  Binary, 
  Sun,
  Moon
} from "lucide-react";
import Image from "next/image";
import { useAdminTheme } from '@/contexts/AdminThemeContext';
import { themes as adminThemes, type Theme } from '@/components/AdminThemeStyles';

interface LoginColors {
  primary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  glow: string;
}

function getLoginColors(theme: Theme, isDark: boolean): LoginColors {
  const t = adminThemes[theme];
  return {
    primary: isDark ? t.primary : t.lightPrimary,
    primaryContainer: t.lightPrimary,
    onPrimaryContainer: isDark ? t.onPrimaryContainer : t.lightOnPrimaryContainer,
    glow: t.lightPrimary,
  };
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { currentTheme, isDarkMode, setTheme: setCurrentTheme, setDarkMode: setIsDarkMode } = useAdminTheme();
  const router = useRouter();

  const colors = getLoginColors(currentTheme, isDarkMode);

  useEffect(() => {
    setMounted(true);
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Unauthorized access. Verification failed.");
      } else {
        // Store the non-sensitive email and name for display in the dashboard
        localStorage.setItem("latexify-admin-email", email.trim().toLowerCase());
        localStorage.setItem("latexify-admin-name", data.admin?.name || "Admin Root");
        router.push("/admin/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message ? `Network error: ${err.message}` : "Network error. Please try again.");
      console.error("Login catch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const bgPrimary = isDarkMode ? "#0b1326" : "#f8fafc";
  const bgInput = isDarkMode ? "#060e20" : "#f1f5f9";
  const borderPrimary = isDarkMode ? "#334155" : "#e2e8f0";
  const textSecondary = isDarkMode ? "#c7c4d8" : "#64748b";
  const textMuted = isDarkMode ? "#918fa1" : "#94a3b8";

  return (
    <div 
      className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden font-sans transition-all duration-500"
      style={{ backgroundColor: bgPrimary }}
    >
      <style jsx global>{`
        ::selection {
          background: ${colors.primary}4d !important;
          color: ${colors.primary} !important;
        }
      `}</style>

      {/* Background Decorative Elements */}
      <div 
        className="absolute inset-0 opacity-[0.1] pointer-events-none transition-opacity duration-700"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, ${isDarkMode ? '#1e293b' : '#cbd5e1'} 1px, transparent 0)`,
          backgroundSize: '48px 48px'
        }}
      />
      
      {/* Mathematical Formula Overlay (Abstract) */}
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none overflow-hidden">
        {mounted && [...Array(20)].map((_, i) => (
          <div 
            key={i}
            className="absolute font-serif italic text-sm transition-colors duration-700"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              transform: `rotate(${Math.random() * 360}deg)`,
              color: colors.primary
            }}
          >
            {i % 3 === 0 && "\\sum_{i=1}^n x_i"}
            {i % 3 === 1 && "\\int f(x)dx"}
            {i % 3 === 2 && "\\alpha + \\beta = \\gamma"}
          </div>
        ))}
      </div>

      {/* Ambient Orbs */}
      <div 
        className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] opacity-5 blur-[120px] rounded-full transition-colors duration-1000" 
        style={{ backgroundColor: colors.primary }}
      />
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] opacity-10 blur-[120px] rounded-full transition-colors duration-1000" 
        style={{ backgroundColor: colors.primaryContainer }}
      />

      {/* Mathematical Graph Asymmetric (SVG) */}
      <div className="hidden lg:block absolute left-[5%] bottom-[15%] w-80 h-48 opacity-20 pointer-events-none">
        <svg className="w-full h-full fill-none transition-all duration-700" viewBox="0 0 400 200">
          <path d="M0,100 Q100,20 200,100 T400,100" stroke={colors.primary} strokeWidth="2" />
          <path d="M0,120 Q100,40 200,120 T400,120" stroke={colors.primary} opacity="0.5" strokeWidth="1" />
          <line stroke={isDarkMode ? "#464555" : "#cbd5e1"} strokeDasharray="4" x1="200" x2="200" y1="0" y2="200" />
          <line stroke={isDarkMode ? "#464555" : "#cbd5e1"} strokeDasharray="4" x1="0" x2="400" y1="100" y2="100" />
        </svg>
      </div>

      {/* Floating LaTeX Card (Decorative) */}
      <motion.div 
        initial={{ opacity: 0, x: 20, rotate: 10 }}
        animate={{ opacity: 0.4, x: 0, rotate: 6 }}
        className="hidden lg:block absolute right-[10%] top-[20%] w-64 backdrop-blur-xl border p-4 rounded-2xl shadow-2xl pointer-events-none transition-all duration-500"
        style={{ backgroundColor: isDarkMode ? "#1e293b/70" : "#ffffff/70", borderColor: borderPrimary }}
      >
        <div className="flex flex-col gap-2">
          <div className="w-full h-2 rounded-full transition-colors duration-500" style={{ backgroundColor: isDarkMode ? "#334155/30" : "#e2e8f0" }} />
          <div className="w-3/4 h-2 rounded-full transition-colors duration-500" style={{ backgroundColor: isDarkMode ? "#334155/30" : "#e2e8f0" }} />
          <div className="w-full p-3 rounded-lg font-mono text-[10px] leading-relaxed transition-all duration-700" style={{ color: colors.primary, backgroundColor: bgInput }}>
            \documentclass{"{article}"}<br/>
            \begin{"{document}"}<br/>
            Welcome to \textbf{"{Latexify}"}<br/>
            \end{"{document}"}
          </div>
        </div>
      </motion.div>

      {/* Main Login Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[440px] backdrop-blur-2xl border p-6 md:p-8 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] transition-all duration-500"
        style={{ 
          backgroundColor: isDarkMode ? "rgba(30, 41, 59, 0.7)" : "rgba(255, 255, 255, 0.8)",
          borderColor: borderPrimary
        }}
      >
        {/* Header Controls */}
        <div className="absolute top-6 right-6 flex items-center gap-3">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
            style={{ backgroundColor: bgInput, color: textMuted }}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          
          <div className="flex gap-1.5 p-1 rounded-full border transition-all duration-500" style={{ backgroundColor: bgInput, borderColor: borderPrimary }}>
            {(Object.keys(adminThemes) as Theme[]).map((t) => {
              const tc = getLoginColors(t, isDarkMode);
              return (
              <button 
                key={t}
                type="button"
                onClick={() => setCurrentTheme(t)}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${currentTheme === t ? 'scale-125 ring-2 ring-offset-2' : 'opacity-60 hover:opacity-100 hover:scale-110'}`}
                style={{ 
                  backgroundColor: tc.primary,
                  boxShadow: currentTheme === t ? `0 0 10px ${tc.glow}` : 'none',
                  borderColor: currentTheme === t ? (isDarkMode ? 'white' : '#1e293b') : 'transparent',
                  '--tw-ring-offset-color': bgInput
                } as any}
                title={t.charAt(0).toUpperCase() + t.slice(1)}
              />
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center text-center mb-5 mt-4 md:mt-4">
          <Image 
            src="/logo.png" 
            alt="Latexify Logo" 
            width={192}
            height={40}
            className="w-48 h-10 object-contain mb-1.5 transition-all duration-300"
            style={{ filter: isDarkMode ? 'brightness(0) invert(1)' : 'none' }}
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mt-0.5" style={{ color: colors.primary }}>Admin Console Portal</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-3 p-3 mb-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-semibold"
          >
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium px-1 transition-colors duration-500" style={{ color: textSecondary }} htmlFor="email">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: email ? colors.primary : textMuted }} size={18} />
              <input 
                id="email"
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@latexify.io"
                required
                className="w-full pl-11 pr-4 py-2.5 border rounded-2xl outline-none focus:ring-2 transition-all font-medium text-sm"
                style={{ 
                  backgroundColor: bgInput, 
                  borderColor: email ? `${colors.primary}40` : borderPrimary, 
                  color: isDarkMode ? 'white' : '#1e293b',
                  '--tw-ring-color': colors.primary 
                } as React.CSSProperties}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="block text-xs font-medium transition-colors duration-500" style={{ color: textSecondary }} htmlFor="password">Password</label>
              <Link href="#" className="text-[10px] font-bold hover:underline decoration-current transition-colors" style={{ color: colors.primary }}>Forgot password?</Link>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" style={{ color: password ? colors.primary : textMuted }} size={18} />
              <input 
                id="password"
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-11 pr-11 py-2.5 border rounded-2xl outline-none focus:ring-2 transition-all font-medium text-sm"
                style={{ 
                  backgroundColor: bgInput, 
                  borderColor: password ? `${colors.primary}40` : borderPrimary, 
                  color: isDarkMode ? 'white' : '#1e293b',
                  '--tw-ring-color': colors.primary 
                } as React.CSSProperties}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: textMuted }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center gap-3 px-1 py-0.5">
            <div className="relative flex items-center">
              <input 
                id="remember"
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="peer appearance-none w-4 h-4 rounded border transition-all cursor-pointer"
                style={{ backgroundColor: rememberMe ? colors.primary : bgInput, borderColor: rememberMe ? colors.primary : borderPrimary }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-[#0b1326] scale-0 peer-checked:scale-100 transition-transform pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <label htmlFor="remember" className="text-xs font-semibold cursor-pointer select-none transition-colors duration-500" style={{ color: textSecondary }}>Remember this device for 30 days</label>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 rounded-2xl font-bold text-base hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-2 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            style={{ 
              backgroundColor: colors.primaryContainer, 
              color: colors.onPrimaryContainer,
              boxShadow: `0 12px 24px -8px ${colors.glow}60`
            } as React.CSSProperties}
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <>Sign In to Console <LogIn size={18} /></>}
          </button>

          {/* Forgot Password Link */}
          <div className="text-center mt-3">
            <Link
              href="/admin/recovery"
              className="text-xs font-medium transition-colors hover:underline"
              style={{ color: colors.primary }}
            >
              Forgot Password?
            </Link>
          </div>
        </form>

        {/* Security Info */}
        <div className="mt-4 p-3 rounded-2xl border border-dashed transition-all duration-500" style={{ backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}30` }}>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={12} style={{ color: colors.primary }} />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: colors.primary }}>Secured Admin Portal</span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: textMuted }}>
            Access restricted to authorized administrators only. Credentials are verified against the secure database.
          </p>
        </div>


        {/* Footer Info */}
        <div className="mt-5 pt-4 border-t flex flex-col items-center gap-3 transition-colors duration-500" style={{ borderColor: `${isDarkMode ? '#334155' : '#e2e8f0'}50` }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: textMuted }}>Enterprise Security Active</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-[#ffb695]" />
              <span className="text-xs font-semibold" style={{ color: textSecondary }}>2FA Required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Binary size={12} className="text-[#ffb695]" />
              <span className="text-xs font-semibold" style={{ color: textSecondary }}>AES-256</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Footer Links */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-8 hidden sm:flex">
        <Link href="#" className="text-xs font-bold transition-colors" style={{ color: textMuted }}>Terms of Service</Link>
        <Link href="#" className="text-xs font-bold transition-colors" style={{ color: textMuted }}>Privacy Policy</Link>
        <Link href="#" className="text-xs font-bold transition-colors" style={{ color: textMuted }}>Contact Support</Link>
      </div>
    </div>
  );
}
