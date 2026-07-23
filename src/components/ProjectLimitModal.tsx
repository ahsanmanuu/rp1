"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, LayoutDashboard, ArrowRight, Zap, Shield, GraduationCap,
  Star, Loader2, X, CheckCircle2, Sparkles
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
const PLAN_COLORS = [
  "var(--accent-primary, #00a395)",
  "var(--accent-secondary, #6366f1)",
  "#ec4899",
  "#f59e0b"
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
  currentCount = 7,
  max = 7,
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
            { planId: "premium_1m", name: "Premium Monthly", description: "1 Month Premium — Full AI review, advanced LaTeX, priority support.", priceINR: 250, durationMonths: 1, pointsExchange: 250 },
            { planId: "premium_3m", name: "Premium Quarterly", description: "3 Months Premium — Best value for semester projects.", priceINR: 600, durationMonths: 3, pointsExchange: 500 },
            { planId: "premium_6m", name: "Premium Biannual", description: "6 Months Premium — Save 17% vs monthly plan.", priceINR: 1000, durationMonths: 6, pointsExchange: 1000 },
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

  const percentUsed = Math.min(100, Math.round((currentCount / max) * 100));

  return (
    <AnimatePresence>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) onClose();
        }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.25rem",
          background: "rgba(5, 7, 15, 0.82)",
          backdropFilter: "blur(20px) saturate(160%)",
          fontFamily: "var(--font-headline, system-ui, sans-serif)",
          overflowY: "auto",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: "spring", stiffness: 320, damping: 25 }}
          style={{
            background: "var(--bg-primary, #0c101d)",
            border: "1px solid var(--border, rgba(255, 255, 255, 0.12))",
            borderRadius: "28px",
            maxWidth: "960px",
            width: "100%",
            boxShadow: "0 30px 70px -15px rgba(0, 0, 0, 0.7), 0 0 40px var(--accent-glow, rgba(0, 163, 149, 0.15))",
            padding: "2.25rem",
            position: "relative",
            color: "var(--text-primary, #f9fafb)",
            overflow: "hidden",
          }}
        >
          {/* Top Ambient Glow */}
          <div
            style={{
              position: "absolute",
              top: "-80px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "420px",
              height: "180px",
              background: "radial-gradient(circle, var(--accent-glow, rgba(0, 163, 149, 0.25)), transparent 70%)",
              filter: "blur(30px)",
              pointerEvents: "none",
            }}
          />

          {/* Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                position: "absolute",
                top: "1.25rem",
                right: "1.25rem",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "var(--bg-tertiary, rgba(255,255,255,0.06))",
                border: "1px solid var(--border, rgba(255,255,255,0.1))",
                color: "var(--text-secondary, #9ca3af)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
                zIndex: 10,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary, #ffffff)";
                e.currentTarget.style.background = "rgba(255,255,255,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-secondary, #9ca3af)";
                e.currentTarget.style.background = "var(--bg-tertiary, rgba(255,255,255,0.06))";
              }}
            >
              <X size={18} />
            </button>
          )}

          {/* Header Section */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: "2rem", zIndex: 2, position: "relative" }}>
            
            {/* Warning Icon Badge */}
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "18px",
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(245, 158, 11, 0.15))",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ef4444",
              marginBottom: "1rem",
              boxShadow: "0 0 25px rgba(239, 68, 68, 0.2)",
            }}>
              <AlertCircle size={28} />
            </div>

            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.25rem 0.75rem",
              borderRadius: "99px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#f87171",
              fontSize: "0.68rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "0.6rem",
            }}>
              <Sparkles size={12} />
              <span>Project Storage Capped</span>
            </div>

            <h2 style={{
              fontSize: "1.85rem",
              fontWeight: 800,
              margin: "0 0 0.5rem",
              letterSpacing: "-0.03em",
              color: "var(--text-primary, #ffffff)",
              fontFamily: "var(--font-headline, system-ui)",
            }}>
              Project Limit Reached
            </h2>

            <p style={{
              color: "var(--text-secondary, #9ca3af)",
              fontSize: "0.92rem",
              margin: "0 0 1.25rem",
              maxWidth: "580px",
              lineHeight: 1.55,
              fontFamily: "var(--font-body, system-ui)",
            }}>
              Free membership is restricted to {max} projects across all studio tools.
              Upgrade to Premium for unlimited project storage, priority compilations, and full AI access.
            </p>

            {/* Quota Progress Pill */}
            <div style={{
              width: "100%",
              maxWidth: "360px",
              background: "var(--bg-secondary, rgba(255,255,255,0.03))",
              border: "1px solid var(--border, rgba(255,255,255,0.08))",
              borderRadius: "14px",
              padding: "0.75rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary, #9ca3af)" }}>
                <span>Storage Quota</span>
                <span style={{ color: "#ef4444", fontWeight: 800 }}>{currentCount} / {max} Projects Used</span>
              </div>
              <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{ width: `${percentUsed}%`, height: "100%", background: "linear-gradient(90deg, #f59e0b, #ef4444)", borderRadius: "6px" }} />
              </div>
            </div>
          </div>

          {/* Membership Plans Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.25rem",
            marginBottom: "2.25rem",
            position: "relative",
            zIndex: 2,
          }}>
            {loadingPlans ? (
              <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", color: "var(--text-secondary, #6b7280)", padding: "3rem" }}>
                <Loader2 size={22} style={{ animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Loading membership options...</span>
              </div>
            ) : (
              plans.slice(0, 3).map((plan, idx) => {
                const Icon = PLAN_ICONS[idx % PLAN_ICONS.length];
                const color = PLAN_COLORS[idx % PLAN_COLORS.length];
                const isRecommended = idx === 1; // Highlight middle quarterly plan as popular

                return (
                  <motion.div
                    key={plan.planId}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    style={{
                      background: isRecommended
                        ? "linear-gradient(165deg, var(--bg-secondary, rgba(255,255,255,0.06)), rgba(0, 163, 149, 0.08))"
                        : "var(--bg-secondary, rgba(255,255,255,0.03))",
                      border: isRecommended
                        ? "1px solid var(--accent-primary, #00a395)"
                        : "1px solid var(--border, rgba(255,255,255,0.08))",
                      borderRadius: "20px",
                      padding: "1.5rem",
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                      boxShadow: isRecommended
                        ? "0 10px 30px -10px var(--accent-glow, rgba(0,163,149,0.3))"
                        : "none",
                    }}
                  >
                    {/* Highlight Badge */}
                    {isRecommended && (
                      <div style={{
                        position: "absolute",
                        top: "-12px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "var(--accent-primary, #00a395)",
                        color: "#ffffff",
                        fontSize: "0.62rem",
                        fontWeight: 900,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        padding: "0.2rem 0.75rem",
                        borderRadius: "99px",
                        boxShadow: "0 4px 12px var(--accent-glow, rgba(0,163,149,0.4))",
                      }}>
                        BEST VALUE
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                      <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "10px",
                        background: `color-mix(in srgb, ${color} 15%, transparent)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: color,
                      }}>
                        <Icon size={18} />
                      </div>
                      <h4 style={{ fontWeight: 800, fontSize: "0.95rem", margin: 0, color: "var(--text-primary, #ffffff)" }}>
                        {plan.name}
                      </h4>
                    </div>

                    <p style={{
                      fontSize: "0.78rem",
                      color: "var(--text-secondary, #9ca3af)",
                      margin: "0 0 1.25rem",
                      flex: 1,
                      lineHeight: 1.45,
                    }}>
                      {plan.description || `${plan.durationMonths}-month premium access with unlimited projects.`}
                    </p>

                    <div style={{ marginBottom: "1.25rem" }}>
                      <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--text-primary, #ffffff)", letterSpacing: "-0.02em" }}>
                        ₹{plan.priceINR.toLocaleString("en-IN")}
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary, #9ca3af)", marginLeft: "4px" }}>
                          {formatDuration(plan.durationMonths)}
                        </span>
                      </div>
                      {plan.pointsExchange > 0 && (
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-primary, #00a395)", fontWeight: 700, marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle2 size={12} />
                          Includes {plan.pointsExchange} AI Credit Points
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleUpgrade(plan.planId)}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        borderRadius: "12px",
                        background: isRecommended
                          ? "var(--accent-primary, #00a395)"
                          : "var(--bg-tertiary, rgba(255,255,255,0.06))",
                        color: "#ffffff",
                        border: isRecommended
                          ? "none"
                          : "1px solid var(--border, rgba(255,255,255,0.1))",
                        fontWeight: 800,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.4rem",
                        transition: "all 0.2s ease",
                        boxShadow: isRecommended
                          ? "0 4px 15px var(--accent-glow, rgba(0,163,149,0.3))"
                          : "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        if (!isRecommended) {
                          e.currentTarget.style.borderColor = "var(--accent-primary, #00a395)";
                          e.currentTarget.style.color = "var(--accent-primary, #00a395)";
                        } else {
                          e.currentTarget.style.opacity = "0.92";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        if (!isRecommended) {
                          e.currentTarget.style.borderColor = "var(--border, rgba(255,255,255,0.1))";
                          e.currentTarget.style.color = "#ffffff";
                        } else {
                          e.currentTarget.style.opacity = "1";
                        }
                      }}
                    >
                      <span>Upgrade Plan</span>
                      <ArrowRight size={14} />
                    </button>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Footer Navigation */}
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", zIndex: 2, position: "relative" }}>
            <button
              onClick={handleGoToDashboard}
              style={{
                padding: "0.7rem 1.75rem",
                borderRadius: "12px",
                background: "var(--bg-secondary, rgba(255,255,255,0.04))",
                border: "1px solid var(--border, rgba(255,255,255,0.1))",
                color: "var(--text-primary, #ffffff)",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--bg-secondary, rgba(255,255,255,0.04))";
                e.currentTarget.style.borderColor = "var(--border, rgba(255,255,255,0.1))";
              }}
            >
              <LayoutDashboard size={16} />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
