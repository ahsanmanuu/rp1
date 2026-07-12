"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  KeyRound,
} from "lucide-react";

export default function AdminChangePasswordPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Password strength
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to update password.");
      } else {
        setSuccess(true);
        // API already clears the admin_session cookie; redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/admin/login");
        }, 3000);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans" style={{ backgroundColor: "#0b1326" }}>
      {/* Ambient orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] opacity-5 blur-[120px] rounded-full" style={{ backgroundColor: "#4f46e5" }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] opacity-10 blur-[120px] rounded-full" style={{ backgroundColor: "#c3c0ff" }} />

      {/* Back link */}
      <Link
        href="/admin/dashboard"
        className="absolute top-8 left-8 flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70"
        style={{ color: "#c3c0ff" }}
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      <AnimatePresence mode="wait">
        {success ? (
          /* Success State */
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full backdrop-blur-2xl border p-6 md:p-8 rounded-2xl shadow-2xl text-center"
            style={{
              backgroundColor: "rgba(30, 41, 59, 0.8)",
              borderColor: "#334155",
              width: "480px",
              maxWidth: "95%",
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: "#22c55e20", border: "2px solid #22c55e40" }}
            >
              <CheckCircle2 size={32} className="text-green-400" />
            </div>
            <h2 className="text-xl font-bold mb-1.5" style={{ color: "#c3c0ff" }}>Password Updated!</h2>
            <p className="text-sm mb-4" style={{ color: "#918fa1" }}>
              Your password has been changed successfully. You&apos;ll be redirected to login in a moment.
            </p>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#334155" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: "#22c55e" }}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, ease: "linear" }}
              />
            </div>
          </motion.div>
        ) : (
          /* Change Password Form */
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full backdrop-blur-2xl border p-6 md:p-8 rounded-2xl shadow-2xl"
            style={{
              backgroundColor: "rgba(30, 41, 59, 0.75)",
              borderColor: "#334155",
              width: "480px",
              maxWidth: "95%",
            }}
          >
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-5">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                style={{ backgroundColor: "#4f46e5", boxShadow: "0 0 30px -8px #4f46e5" }}
              >
                <KeyRound size={24} className="text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight mb-1" style={{ color: "#c3c0ff" }}>
                Change Password
              </h1>
              <p className="text-sm" style={{ color: "#918fa1" }}>
                Update your admin console password
              </p>
            </div>

            {/* Error Banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm font-medium"
                >
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium px-1" style={{ color: "#c7c4d8" }} htmlFor="current-password">
                  Current Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    style={{ color: currentPassword ? "#c3c0ff" : "#918fa1" }}
                    size={18}
                  />
                  <input
                    id="current-password"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className="w-full pl-11 pr-12 py-2.5 border rounded-xl outline-none focus:ring-2 transition-all font-medium text-sm"
                    style={{
                      backgroundColor: "#060e20",
                      borderColor: currentPassword ? "#c3c0ff40" : "#334155",
                      color: "white",
                      ["--tw-ring-color" as any]: "#c3c0ff",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    style={{ color: "#918fa1" }}
                  >
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium px-1" style={{ color: "#c7c4d8" }} htmlFor="new-password">
                  New Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    style={{ color: newPassword ? "#c3c0ff" : "#918fa1" }}
                    size={18}
                  />
                  <input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    className="w-full pl-11 pr-12 py-2.5 border rounded-xl outline-none focus:ring-2 transition-all font-medium text-sm"
                    style={{
                      backgroundColor: "#060e20",
                      borderColor: newPassword ? "#c3c0ff40" : "#334155",
                      color: "white",
                      ["--tw-ring-color" as any]: "#c3c0ff",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    style={{ color: "#918fa1" }}
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Strength meter */}
                {newPassword && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-1">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="flex-1 h-1 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: i <= strength ? strengthColor : "#334155",
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] font-semibold" style={{ color: strengthColor }}>
                      {strengthLabel}
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium px-1" style={{ color: "#c7c4d8" }} htmlFor="confirm-password">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    style={{
                      color: confirmPassword
                        ? confirmPassword === newPassword
                          ? "#22c55e"
                          : "#ef4444"
                        : "#918fa1",
                    }}
                    size={18}
                  />
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    className="w-full pl-11 pr-12 py-2.5 border rounded-xl outline-none focus:ring-2 transition-all font-medium text-sm"
                    style={{
                      backgroundColor: "#060e20",
                      borderColor: confirmPassword
                        ? confirmPassword === newPassword
                          ? "#22c55e40"
                          : "#ef444440"
                        : "#334155",
                      color: "white",
                      ["--tw-ring-color" as any]: "#c3c0ff",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    style={{ color: "#918fa1" }}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-[11px] px-1 text-red-400">Passwords do not match</p>
                )}
                {confirmPassword && confirmPassword === newPassword && (
                  <p className="text-[11px] px-1 text-green-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Passwords match
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || (confirmPassword !== newPassword && confirmPassword.length > 0)}
                className="w-full py-2.5 rounded-xl font-bold text-base hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-3 shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "#4f46e5",
                  color: "#dad7ff",
                  boxShadow: "0 10px 20px -8px #4f46e550",
                }}
              >
                {loading ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <>
                    <ShieldCheck size={20} />
                    Update Password
                  </>
                )}
              </button>
            </form>

            {/* Requirements */}
            <div className="mt-4 p-3.5 rounded-xl border border-dashed text-[11px]" style={{ backgroundColor: "#c3c0ff08", borderColor: "#c3c0ff30" }}>
              <p className="font-bold uppercase tracking-widest mb-2" style={{ color: "#c3c0ff" }}>
                Password Requirements
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
                {[
                  ["At least 8 characters", newPassword.length >= 8],
                  ["Contains uppercase letter", /[A-Z]/.test(newPassword)],
                  ["Contains number", /[0-9]/.test(newPassword)],
                  ["Contains special character", /[^A-Za-z0-9]/.test(newPassword)],
                ].map(([label, met]) => (
                  <li
                    key={label as string}
                    className="flex items-center gap-2"
                    style={{ color: met ? "#22c55e" : "#918fa1" }}
                  >
                    <span className="w-3 h-3 rounded-full border flex items-center justify-center flex-shrink-0" style={{ borderColor: met ? "#22c55e" : "#464555", backgroundColor: met ? "#22c55e20" : "transparent" }}>
                      {met && <span className="w-1.5 h-1.5 rounded-full bg-green-400 block" />}
                    </span>
                    {label as string}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
