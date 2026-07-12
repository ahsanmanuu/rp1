"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Lock, Eye, EyeOff, ShieldCheck, Loader2,
  CheckCircle2, AlertCircle, ArrowLeft, KeyRound,
} from "lucide-react";

function AdminResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [mounted, setMounted] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token || !email) {
      setError("Invalid recovery link. Please request a new one.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/recovery/confirm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      setSuccess(true);
      setTimeout(() => router.push("/admin/login"), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  if (!token || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-admin-surface)]">
        <div className="max-w-md w-full mx-4 p-8 rounded-2xl bg-[var(--color-admin-surface-container)] border border-[var(--color-admin-outline-variant)] text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-admin-on-surface)" }}>Invalid Link</h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            This recovery link is invalid or expired. Please request a new one.
          </p>
          <Link
            href="/admin/recovery"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-colors"
            style={{ backgroundColor: "var(--color-admin-primary)" }}
          >
            <ArrowLeft className="w-4 h-4" /> Request New Link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-admin-surface)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full mx-4 p-8 rounded-2xl bg-[var(--color-admin-surface-container)] border border-[var(--color-admin-outline-variant)] text-center"
        >
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--color-admin-primary)" }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-admin-on-surface)" }}>Password Reset</h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            Your admin password has been updated. Redirecting to login...
          </p>
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-colors"
            style={{ backgroundColor: "var(--color-admin-primary)" }}
          >
            <ArrowLeft className="w-4 h-4" /> Go to Admin Login
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
              <h1 className="text-xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Reset Admin Password</h1>
              <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>For: {email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-admin-on-surface)" }}>New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-admin-on-surface-variant)" }} />
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border text-sm outline-none transition-colors"
                  style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                  placeholder="Enter new password"
                  required
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-admin-on-surface)" }}>Confirm Password</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-admin-on-surface-variant)" }} />
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border text-sm outline-none transition-colors"
                  style={{ backgroundColor: "var(--color-admin-surface)", borderColor: confirmPassword && confirmPassword === newPassword ? "#22c55e" : "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                  placeholder="Confirm new password"
                  required
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && confirmPassword === newPassword && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#22c55e" }}>
                  <CheckCircle2 className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !newPassword || newPassword !== confirmPassword}
              className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "var(--color-admin-primary)" }}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting...</> : <><Lock className="w-4 h-4" /> Reset Password</>}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-[var(--color-admin-primary)]" size={48} />
      </div>
    }>
      <AdminResetPasswordContent />
    </Suspense>
  );
}
