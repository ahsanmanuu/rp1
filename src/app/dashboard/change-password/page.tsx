"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Lock, Eye, EyeOff, ShieldCheck, Loader2,
  CheckCircle2, AlertCircle, ArrowLeft, KeyRound,
} from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const strength = (() => {
    if (!newPassword) return 0;
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Strong", "Very Strong"][strength];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#22c55e", "#4f46e5"][strength];

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full mx-4 p-8 rounded-2xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] text-center"
        >
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--color-primary)" }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-on-surface)" }}>Password Updated</h2>
          <p className="text-sm mb-6" style={{ color: "var(--color-on-surface-variant)" }}>
            Your password has been changed successfully. Redirecting to dashboard...
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-colors"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <ArrowLeft className="w-4 h-4" /> Go to Dashboard
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full mx-auto"
      >
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm mb-6 transition-colors hover:opacity-80"
          style={{ color: "var(--color-primary)" }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="rounded-2xl p-8 bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl" style={{ backgroundColor: "var(--color-primary-container)" }}>
              <KeyRound className="w-6 h-6" style={{ color: "var(--color-primary)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--color-on-surface)" }}>Change Password</h1>
              <p className="text-xs" style={{ color: "var(--color-on-surface-variant)" }}>Update your account password</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-on-surface)" }}>
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-on-surface-variant)" }} />
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderColor: "var(--color-outline-variant)",
                    color: "var(--color-on-surface)",
                  }}
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--color-on-surface-variant)" }}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-colors"
                        style={{ backgroundColor: i <= strength ? strengthColor : "var(--color-outline-variant)" }}
                      />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: strengthColor }}>{strengthLabel}</span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-on-surface)" }}>
                Confirm Password
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-on-surface-variant)" }} />
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    borderColor: confirmPassword && confirmPassword === newPassword ? "#22c55e" : "var(--color-outline-variant)",
                    color: "var(--color-on-surface)",
                  }}
                  placeholder="Confirm new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--color-on-surface-variant)" }}
                >
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
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
              ) : (
                <><Lock className="w-4 h-4" /> Update Password</>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
