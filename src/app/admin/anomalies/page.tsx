"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { createPb } from "@/lib/pb";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#6366f1",
  low: "#94a3b8",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "rgba(239,68,68,0.12)",
  high: "rgba(245,158,11,0.12)",
  medium: "rgba(99,102,241,0.12)",
  low: "rgba(148,163,184,0.12)",
};

const TYPE_LABELS: Record<string, string> = {
  ip_hopping: "IP Hopping",
  usage_spike: "Usage Spike",
  api_rate: "API Rate Abuse",
  user_status_change: "Status Change",
  mass_operation: "Mass Operation",
  suspicious_admin: "Suspicious Admin",
  payment_failure: "Payment Failure",
  large_transaction: "Large Transaction",
  rapid_transaction: "Rapid Transaction",
  cap_abuse: "Cap Abuse",
  plan_hopping: "Plan Hopping",
  promo_abuse: "Promo Abuse",
};

const TYPE_ICONS: Record<string, string> = {
  ip_hopping: "travel_explore",
  usage_spike: "trending_up",
  api_rate: "speed",
  user_status_change: "manage_accounts",
  mass_operation: "dataset",
  suspicious_admin: "admin_panel_settings",
  payment_failure: "credit_card_off",
  large_transaction: "account_balance",
  rapid_transaction: "rocket_launch",
  cap_abuse: "block",
  plan_hopping: "swap_horiz",
  promo_abuse: "redeem",
};

export default function AdminAnomaliesPage() {
  const [currentTheme, setCurrentTheme] = useState<"indigo" | "emerald" | "rose">("indigo");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState("Admin Root");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityCounts, setSeverityCounts] = useState<Record<string, number>>({});
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [detectorResults, setDetectorResults] = useState<any[] | null>(null);
  const limit = 30;

  const fetchAlerts = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (typeFilter) params.set("type", typeFilter);
      if (severityFilter) params.set("severity", severityFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/anomalies?${params}`);
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts);
        setTotal(data.total);
        setSeverityCounts(data.severityCounts || {});
        setTypeCounts(data.typeCounts || {});
        setError(null);
      } else {
        setError(data.error || "Failed to load");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, severityFilter, statusFilter]);

  const runDetectors = async () => {
    setDetecting(true);
    setDetectorResults(null);
    try {
      const res = await fetch("/api/admin/anomalies/detect", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setDetectorResults(data.results);
        await fetchAlerts(true);
      }
    } catch {}
    setDetecting(false);
  };

  const dismissAlert = async (id: string) => {
    try {
      await fetch("/api/admin/anomalies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "dismissed" }),
      });
      await fetchAlerts(true);
      if (selectedAlert?.id === id) setSelectedAlert(null);
    } catch {}
  };

  const resolveAlert = async (id: string) => {
    try {
      await fetch("/api/admin/anomalies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "resolved" }),
      });
      await fetchAlerts(true);
      if (selectedAlert?.id === id) setSelectedAlert(null);
    } catch {}
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("latexify-admin-theme") as "indigo" | "emerald" | "rose" | null;
    const savedMode = localStorage.getItem("latexify-admin-mode");
    if (savedTheme) setCurrentTheme(savedTheme);
    if (savedMode) setIsDarkMode(savedMode === "dark");
    const storedName = localStorage.getItem("latexify-admin-name");
    if (storedName) setAdminName(storedName);
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    localStorage.setItem("latexify-admin-theme", currentTheme);
    localStorage.setItem("latexify-admin-mode", isDarkMode ? "dark" : "light");
  }, [currentTheme, isDarkMode]);

  useEffect(() => {
    const pb = createPb();
    const unsubFns: (() => void)[] = [];
    const setup = async () => {
      try {
        const unsub = await pb.collection("anomaly_alerts").subscribe("*", () => fetchAlerts(true));
        unsubFns.push(unsub);
      } catch {}
      try {
        const unsub2 = await pb.collection("audit_log").subscribe("*", () => fetchAlerts(true));
        unsubFns.push(unsub2);
      } catch {}
    };
    setup();
    return () => { for (const fn of unsubFns) { try { fn(); } catch {} } };
  }, [fetchAlerts]);

  useEffect(() => {
    const timer = setInterval(() => fetchAlerts(true), 20000);
    return () => clearInterval(timer);
  }, [fetchAlerts]);

  const totalOpen = Object.values(severityCounts).reduce((s, v) => s + v, 0);

  const chartTextColor = isDarkMode ? "#94a3b8" : "#475569";
  const chartGridColor = isDarkMode ? "#1e293b" : "#e2e8f0";

  return (
    <div className="transition-colors duration-500" style={{ backgroundColor: "var(--color-admin-background)", color: "var(--color-admin-on-background)" }}>
      <style jsx global>{`
        :root {
          ${isDarkMode ? `
            --color-admin-primary: ${currentTheme === "rose" ? "#fda4af" : currentTheme === "emerald" ? "#6ee7b7" : "#c3c0ff"};
            --color-admin-primary-container: ${currentTheme === "rose" ? "#e11d48" : currentTheme === "emerald" ? "#059669" : "#4f46e5"};
            --color-admin-on-primary-container: ${currentTheme === "rose" ? "#ffe4e6" : currentTheme === "emerald" ? "#d1fae5" : "#dad7ff"};
            --color-admin-secondary: ${currentTheme === "rose" ? "#fecdd3" : currentTheme === "emerald" ? "#a7f3d0" : "#c0c1ff"};
            --color-admin-secondary-container: ${currentTheme === "rose" ? "#be123c" : currentTheme === "emerald" ? "#047857" : "#3131c0"};
            --color-admin-on-secondary-container: ${currentTheme === "rose" ? "#fff1f2" : currentTheme === "emerald" ? "#ecfdf5" : "#b0b2ff"};
            --color-admin-background: #0b1326;
            --color-admin-surface: #0b1326;
            --color-admin-surface-container: #171f33;
            --color-admin-surface-container-low: #131b2e;
            --color-admin-surface-container-high: #222a3d;
            --color-admin-surface-container-highest: #2d3449;
            --color-admin-on-surface: #dae2fd;
            --color-admin-on-surface-variant: #c7c4d8;
            --color-admin-outline: #918fa1;
            --color-admin-outline-variant: #464555;
            --color-admin-error: #ffb4ab;
            --color-admin-error-container: #93000a;
            --color-admin-on-error: #690005;
          ` : `
            --color-admin-primary: ${currentTheme === "rose" ? "#e11d48" : currentTheme === "emerald" ? "#059669" : "#4f46e5"};
            --color-admin-primary-container: ${currentTheme === "rose" ? "#ffe4e6" : currentTheme === "emerald" ? "#d1fae5" : "#e0e7ff"};
            --color-admin-on-primary-container: ${currentTheme === "rose" ? "#4c0519" : currentTheme === "emerald" ? "#022c22" : "#1e1b4b"};
            --color-admin-secondary: ${currentTheme === "rose" ? "#f43f5e" : currentTheme === "emerald" ? "#10b981" : "#6366f1"};
            --color-admin-secondary-container: ${currentTheme === "rose" ? "#ffe4e6" : currentTheme === "emerald" ? "#d1fae5" : "#e0e7ff"};
            --color-admin-on-secondary-container: ${currentTheme === "rose" ? "#4c0519" : currentTheme === "emerald" ? "#022c22" : "#1e1b4b"};
            --color-admin-background: #f8fafc;
            --color-admin-surface: #ffffff;
            --color-admin-surface-container: #f1f5f9;
            --color-admin-surface-container-low: #f8fafc;
            --color-admin-surface-container-high: #e2e8f0;
            --color-admin-surface-container-highest: #cbd5e1;
            --color-admin-on-surface: #0f172a;
            --color-admin-on-surface-variant: #475569;
            --color-admin-outline: #94a3b8;
            --color-admin-outline-variant: #cbd5e1;
            --color-admin-error: #ba1a1a;
            --color-admin-error-container: #ffdad6;
            --color-admin-on-error: #ffffff;
          `}
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-admin-outline-variant); border-radius: 4px; }
      `}</style>

      <aside className="flex flex-col p-4 gap-2 fixed h-screen w-64 left-0 top-0 border-r z-50" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
        <div className="flex flex-col items-center gap-1 px-2 mb-6 mt-2 text-center">
          <Image src="/logo.png" alt="Latexify Logo" width={0} height={0} sizes="100%" className="w-48 h-12 object-contain" style={{ filter: isDarkMode ? "brightness(0) invert(1)" : "none" }} />
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-85 mt-1" style={{ color: "var(--color-admin-primary)" }}>Admin Console</p>
        </div>
        <nav className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            <span className="material-symbols-outlined">dashboard</span>Dashboard
          </Link>
          <Link href="/admin/billings" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            <span className="material-symbols-outlined">payments</span>Bill and Payments
          </Link>
          <Link href="/admin/users" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            <span className="material-symbols-outlined">group</span>Users
          </Link>
          <Link href="/admin/profile" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            <span className="material-symbols-outlined">settings</span>Profile and Plan Setting
          </Link>
          <Link href="/admin/ai-caps" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            <span className="material-symbols-outlined">speed</span>AI Usage & Caps Rules
          </Link>
          <Link href="/admin/ai-analysis" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            <span className="material-symbols-outlined">psychology</span>AI Analysis
          </Link>
          <a className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all translate-x-1 duration-200 shadow-sm" style={{ backgroundColor: "var(--color-admin-secondary-container)", color: "var(--color-admin-on-secondary-container)" }}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>Anomaly Center
          </a>
          <Link href="/admin/help" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            <span className="material-symbols-outlined">help</span>Help and Support
          </Link>
          <Link href="/admin/offers" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            <span className="material-symbols-outlined">local_offer</span>Offers
          </Link>
          <Link href="/admin/emails" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            <span className="material-symbols-outlined">mail</span>Email History
          </Link>
          <Link href="/admin/social-media" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            <span className="material-symbols-outlined">share</span>Social Media
          </Link>
          <Link href="/admin/tax-calculation" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: "var(--color-admin-on-surface-variant)" }}>
            <span className="material-symbols-outlined">calculate</span>Tax Calculation
          </Link>
          <div className="border-t my-2" style={{ borderColor: "var(--color-admin-outline-variant)" }}></div>
          <a href="/pb/_/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg" style={{ color: "var(--color-admin-primary)" }}>
            <span className="material-symbols-outlined">database</span>PB Dashboard
          </a>
        </nav>
        <div className="mt-auto p-4 rounded-xl border text-sm" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--color-admin-primary)" }}></div>
            <span style={{ color: "var(--color-admin-primary)" }}>System Online</span>
          </div>
          <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>Version 4.2.0-stable</p>
        </div>
      </aside>

      <main className="ml-0 lg:ml-64 flex flex-col min-h-screen">
        <header className="flex justify-between items-center w-full px-8 py-4 border-b z-40 sticky top-0" style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)" }}>
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-xl font-bold" style={{ color: "var(--color-admin-primary)" }}>Anomaly Detection Center</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-full border hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface-variant)" }}>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--color-admin-primary)" }}></span>
                <span className="text-xs font-medium">Theme</span>
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </button>
              {isThemeMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border shadow-xl overflow-hidden z-50" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                  <div className="p-2 flex flex-col gap-1">
                    <div className="px-3 py-2 text-xs font-semibold tracking-wider uppercase opacity-70" style={{ color: "var(--color-admin-on-surface-variant)" }}>Accent Color</div>
                    {(["indigo", "emerald", "rose"] as const).map((t) => (
                      <button key={t} onClick={() => { setCurrentTheme(t); setIsThemeMenuOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: "var(--color-admin-on-surface)" }}>
                        <div className={`w-4 h-4 rounded-full ${t === "indigo" ? "bg-indigo-500" : t === "emerald" ? "bg-emerald-500" : "bg-rose-500"}`}></div>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                        {currentTheme === t && <span className="material-symbols-outlined ml-auto text-[18px]">check</span>}
                      </button>
                    ))}
                    <div className="h-px w-full my-1" style={{ backgroundColor: "var(--color-admin-outline-variant)" }}></div>
                    <div className="px-3 py-2 text-xs font-semibold tracking-wider uppercase opacity-70" style={{ color: "var(--color-admin-on-surface-variant)" }}>Mode</div>
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: "var(--color-admin-on-surface)" }}>
                      <span className="material-symbols-outlined text-[18px]">{isDarkMode ? "light_mode" : "dark_mode"}</span>
                      {isDarkMode ? "Light Mode" : "Dark Mode"}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <Link href="/admin/profile" className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors" style={{ color: "var(--color-admin-on-surface-variant)" }}>
              <span className="material-symbols-outlined">settings</span>
            </Link>
            <div className="h-8 w-px mx-2" style={{ backgroundColor: "var(--color-admin-outline-variant)" }}></div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-black/10 flex items-center justify-center font-bold" style={{ color: "var(--color-admin-primary)" }}>
                {adminName.split(/\s+/).map(n => n[0]).join("").slice(0,2).toUpperCase() || "AR"}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 max-w-[1440px] mx-auto w-full">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Total Open</p>
              <p className="text-2xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>{totalOpen}</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ backgroundColor: SEVERITY_BG.critical, borderColor: `${SEVERITY_COLORS.critical}40` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: SEVERITY_COLORS.critical }}>Critical</p>
              <p className="text-2xl font-bold" style={{ color: SEVERITY_COLORS.critical }}>{severityCounts.critical || 0}</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ backgroundColor: SEVERITY_BG.high, borderColor: `${SEVERITY_COLORS.high}40` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: SEVERITY_COLORS.high }}>High</p>
              <p className="text-2xl font-bold" style={{ color: SEVERITY_COLORS.high }}>{severityCounts.high || 0}</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ backgroundColor: SEVERITY_BG.medium, borderColor: `${SEVERITY_COLORS.medium}40` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: SEVERITY_COLORS.medium }}>Medium</p>
              <p className="text-2xl font-bold" style={{ color: SEVERITY_COLORS.medium }}>{severityCounts.medium || 0}</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ backgroundColor: SEVERITY_BG.low, borderColor: `${SEVERITY_COLORS.low}40` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: SEVERITY_COLORS.low }}>Low</p>
              <p className="text-2xl font-bold" style={{ color: SEVERITY_COLORS.low }}>{severityCounts.low || 0}</p>
            </div>
          </div>

          {detectorResults && (
            <div className="mb-6 p-4 rounded-xl border" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
              <p className="text-sm font-semibold mb-2" style={{ color: "var(--color-admin-on-surface)" }}>
                Detection Complete — {detectorResults.filter(r => r.status === "ok").length}/{detectorResults.length} OK, {detectorResults.filter(r => r.status === "error").length} errors
              </p>
              <div className="flex flex-wrap gap-2">
                {detectorResults.map((r) => (
                  <span key={r.detector} className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${r.status === "ok" ? "text-green-500" : "text-red-500"}`} style={{ backgroundColor: r.status === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)" }}>
                    {r.name}: {r.status === "ok" ? "✓" : "✗"}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <button onClick={runDetectors} disabled={detecting} className="px-4 py-2 border rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-semibold flex items-center gap-2 disabled:opacity-50 text-sm" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
              <span className={`material-symbols-outlined text-lg ${detecting ? "animate-spin" : ""}`}>{detecting ? "sync" : "radar"}</span>
              {detecting ? "Scanning..." : "Run Full Scan"}
            </button>

            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm" style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
              <option value="">All Types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v} ({typeCounts[k] || 0})</option>
              ))}
            </select>

            <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm" style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
              <option value="">All Severities</option>
              {["critical", "high", "medium", "low"].map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)} ({severityCounts[s] || 0})</option>
              ))}
            </select>

            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm" style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="">All Statuses</option>
            </select>

            <button onClick={() => fetchAlerts()} className="px-3 py-2 border rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
              <span className="material-symbols-outlined text-lg align-middle">refresh</span>
            </button>
          </div>

          {/* Alert List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500/10 border-t-indigo-500 animate-spin" style={{ borderTopColor: "var(--color-admin-primary)" }}></div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-red-500 gap-2">
              <span className="material-symbols-outlined text-3xl">error</span>
              <span className="text-sm">{error}</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: "var(--color-admin-on-surface-variant)" }}>
              <span className="material-symbols-outlined text-4xl">check_circle</span>
              <p className="text-sm font-semibold">No anomalies detected</p>
              <p className="text-xs">Run a scan to check all systems</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
                  className="border rounded-xl p-4 transition-all hover:scale-[1.002] cursor-pointer"
                  style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: selectedAlert?.id === alert.id ? SEVERITY_COLORS[alert.severity] || "var(--color-admin-outline-variant)" : "var(--color-admin-outline-variant)" }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: SEVERITY_BG[alert.severity] || SEVERITY_BG.low, color: SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.low }}>
                      <span className="material-symbols-outlined text-lg">{TYPE_ICONS[alert.type] || "warning"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate" style={{ color: "var(--color-admin-on-surface)" }}>{alert.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase`} style={{ backgroundColor: SEVERITY_BG[alert.severity] || SEVERITY_BG.low, color: SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.low }}>
                          {alert.severity}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ backgroundColor: "var(--color-admin-surface-container-high)", color: "var(--color-admin-on-surface-variant)" }}>
                          {TYPE_LABELS[alert.type] || alert.type}
                        </span>
                      </div>
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--color-admin-on-surface-variant)" }}>{alert.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] font-mono" style={{ color: "var(--color-admin-outline)" }}>
                        <span>{new Date(alert.createdAt).toLocaleString()}</span>
                        {alert.entityLabel && <span>• {alert.entityLabel}</span>}
                        <span>• {alert.status}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); resolveAlert(alert.id); }} className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors" title="Resolve" style={{ color: "#10b981" }}>
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); dismissAlert(alert.id); }} className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors" title="Dismiss" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                        <span className="material-symbols-outlined text-lg">not_interested</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {selectedAlert?.id === alert.id && alert.metadata && (
                    <div className="mt-4 pt-4 border-t text-xs font-mono" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                      <p className="font-semibold mb-2" style={{ color: "var(--color-admin-on-surface-variant)" }}>Metadata</p>
                      <pre className="p-3 rounded-lg overflow-x-auto" style={{ backgroundColor: "var(--color-admin-surface-container-high)", color: "var(--color-admin-on-surface)" }}>
                        {JSON.stringify((() => { try { return typeof alert.metadata === "string" ? JSON.parse(alert.metadata) : alert.metadata; } catch { return alert.metadata || {}; } })(), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination */}
              {total > limit && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 border rounded-lg text-xs disabled:opacity-30" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                    Previous
                  </button>
                  <span className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                    Page {page} of {Math.ceil(total / limit)}
                  </span>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / limit)} className="px-3 py-1.5 border rounded-lg text-xs disabled:opacity-30" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="p-6 border-t flex justify-between items-center" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface-variant)" }}>
          <p className="text-xs font-mono">© 2026 Latexify Engine. Anomaly Detection Center — Real-time monitoring active</p>
        </footer>
      </main>
    </div>
  );
}
