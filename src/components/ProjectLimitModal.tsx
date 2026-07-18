"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, LayoutDashboard, ArrowRight, Zap, Shield, GraduationCap,
  Star, Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";

interface MembershipPlan {
  planId: string;
  name: string;
  description: string | null;
  priceINR: number;
  durationMonths: number;
  pointsExchange: number;
}

interface ProjectLimitModalProps {
  isOpen: boolean;
  onClose?: () => void;
  /** How many projects the user currently has (optional — for display) */
  currentCount?: number;
  /** The configured maximum (optional — for display) */
  max?: number;
}

const PLAN_ICONS = [Zap, Shield, GraduationCap, Star];
const PLAN_COLORS = ["#a855f7", "#3b82f6", "#10b981", "#f59e0b"];
const PLAN_GRADIENTS = [
  "linear-gradient(135deg, #a855f7, #7c3aed)",
  "linear-gradient(135deg, #3b82f6, #2563eb)",
  "linear-gradient(135deg, #10b981, #059669)",
  "linear-gradient(135deg, #f59e0b, #d97706)",
];

/** Format duration into a human-readable string */
function formatDuration(months: number): string {
  if (months === 1) return "/ month";
  if (months === 12) return "/ year";
  return `/ ${months} months`;
}

export default function ProjectLimitModal({
  isOpen,
  onClose,
  currentCount,
  max,
}: ProjectLimitModalProps) {
  const router = useRouter();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Fetch real membership plans from DB when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLoadingPlans(true);
    fetch("/api/plans")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.plans) && data.plans.length > 0) {
          setPlans(data.plans);
        } else {
          // Fallback to defaults if DB returns empty
          setPlans([
            { planId: "premium_1m", name: "Premium Monthly", description: "1 Month Premium Access — Full AI review, advanced LaTeX, priority support.", priceINR: 250, durationMonths: 1, pointsExchange: 250 },
            { planId: "premium_3m", name: "Premium Quarterly", description: "3 Months Premium Access — Best for semester projects.", priceINR: 600, durationMonths: 3, pointsExchange: 500 },
            { planId: "premium_6m", name: "Premium Biannual", description: "6 Months Premium Access — Save 17% vs monthly.", priceINR: 1000, durationMonths: 6, pointsExchange: 1000 },
          ]);
        }
      })
      .catch(() => {
        // Silently fall back to defaults on network error
        setPlans([
          { planId: "premium_1m", name: "Premium Monthly", description: "Unlimited projects + full AI tools.", priceINR: 250, durationMonths: 1, pointsExchange: 250 },
          { planId: "premium_3m", name: "Premium Quarterly", description: "Best for semester projects.", priceINR: 600, durationMonths: 3, pointsExchange: 500 },
          { planId: "premium_6m", name: "Premium Biannual", description: "Save 17% vs monthly.", priceINR: 1000, durationMonths: 6, pointsExchange: 1000 },
        ]);
      })
      .finally(() => setLoadingPlans(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpgrade = (planId: string) => {
    router.push(`/dashboard?upgrade=true&plan=${planId}`);
  };

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <AnimatePresence>
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 99999,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1.5rem",
          background: "rgba(3, 7, 18, 0.85)",
          backdropFilter: "blur(16px)",
          fontFamily: "var(--font-headline, system-ui, sans-serif)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          style={{
            background: "linear-gradient(145deg, #111827, #030712)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "24px",
            maxWidth: "920px",
            width: "100%",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(239, 68, 68, 0.1)",
            padding: "2.5rem",
            position: "relative",
            color: "#f9fafb",
            overflow: "hidden",
          }}
        >
          {/* Decorative glow */}
          <div style={{ position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)", width: "300px", height: "100px", background: "radial-gradient(circle, rgba(239, 68, 68, 0.15), transparent 70%)", filter: "blur(20px)", pointerEvents: "none" }} />

          {/* Header */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", display: "flex", alignItems: "center", color: "#ef4444", marginBottom: "1rem", justifyContent: "center" }}>
              <AlertCircle size={30} />
            </div>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0 0 0.5rem", letterSpacing: "-0.025em", color: "#fff" }}>
              Project Limit Reached
            </h2>
            <p style={{ color: "#9ca3af", fontSize: "0.95rem", margin: 0, maxWidth: "560px", lineHeight: 1.5 }}>
              {currentCount !== undefined && max !== undefined
                ? `You have used ${currentCount} of ${max} free projects. `
                : "Free membership is restricted to a total of 7 projects across all tools. "}
              Upgrade to a Premium plan to unlock unlimited project creation and advanced LaTeX tools.
            </p>
          </div>

          {/* Plan Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
            {loadingPlans ? (
              <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "#6b7280", padding: "2rem" }}>
                <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: "0.9rem" }}>Loading plans…</span>
              </div>
            ) : (
              plans.slice(0, 4).map((plan, idx) => {
                const Icon = PLAN_ICONS[idx % PLAN_ICONS.length];
                const color = PLAN_COLORS[idx % PLAN_COLORS.length];
                const gradient = PLAN_GRADIENTS[idx % PLAN_GRADIENTS.length];
                return (
                  <div
                    key={plan.planId}
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "1.5rem", display: "flex", flexDirection: "column", transition: "all 0.2s", position: "relative" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      <Icon size={18} style={{ color }} />
                      <h4 style={{ fontWeight: 800, fontSize: "0.9rem", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", color }}>
                        {plan.name}
                      </h4>
                    </div>
                    <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: "0 0 1.25rem", flex: 1, lineHeight: 1.4 }}>
                      {plan.description || `${plan.durationMonths}-month premium access with unlimited projects.`}
                    </p>
                    <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#fff", marginBottom: "1rem" }}>
                      ₹{plan.priceINR.toLocaleString("en-IN")}
                      <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "#9ca3af" }}> {formatDuration(plan.durationMonths)}</span>
                    </div>
                    <button
                      onClick={() => handleUpgrade(plan.planId)}
                      style={{ width: "100%", padding: "0.65rem", borderRadius: "10px", background: gradient, color: "#fff", border: "none", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", transition: "opacity 0.2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      <span>Upgrade</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button
              onClick={handleGoToDashboard}
              style={{ padding: "0.65rem 1.5rem", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            >
              <LayoutDashboard size={15} />
              <span>Go to Dashboard</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
