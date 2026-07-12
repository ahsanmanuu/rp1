"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle, KeyRound,
} from "lucide-react";

export default function AdminRecoveryPage() {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Enter your admin email"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send recovery email");
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send recovery email");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-admin-surface)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full mx-4 p-8 rounded-2xl bg-[var(--color-admin-surface-container)] border border-[var(--color-admin-outline-variant)] text-center"
        >
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--color-admin-primary)" }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-admin-on-surface)" }}>Recovery Email Sent</h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            If an admin account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
          </p>
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-colors"
            style={{ backgroundColor: "var(--color-admin-primary)" }}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Admin Login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-admin-surface)] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full mx-auto"
      >
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-1 text-sm mb-6 transition-colors hover:opacity-80"
          style={{ color: "var(--color-admin-primary)" }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Admin Login
        </Link>

        <div className="rounded-2xl p-8 bg-[var(--color-admin-surface-container)] border border-[var(--color-admin-outline-variant)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl" style={{ backgroundColor: "var(--color-admin-primary-container)" }}>
              <KeyRound className="w-6 h-6" style={{ color: "var(--color-admin-primary)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Admin Recovery</h1>
              <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>Reset your admin password</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-admin-on-surface)" }}>
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-admin-on-surface-variant)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--color-admin-surface)",
                    borderColor: "var(--color-admin-outline-variant)",
                    color: "var(--color-admin-on-surface)",
                  }}
                  placeholder="admin@latexify.io"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "var(--color-admin-primary)" }}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
              ) : (
                <><Mail className="w-4 h-4" /> Send Recovery Email</>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
