"use client";

import { useEffect, useState, useRef } from "react";
import { useLayoutSync } from "@/hooks/useLayoutSync";
import Link from "next/link";
import Image from "next/image";
import { createPb } from "@/lib/pb";
import { motion, AnimatePresence } from "framer-motion";

type Theme = "indigo" | "emerald" | "rose" | "violet" | "amber" | "cyan";

interface ThemeColors {
  primary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  glow: string;
}

const themes: Record<Theme, ThemeColors> = {
  indigo: {
    primary: "#c3c0ff",
    primaryContainer: "#4f46e5",
    onPrimaryContainer: "#dad7ff",
    glow: "#4f46e5",
  },
  emerald: {
    primary: "#6ee7b7",
    primaryContainer: "#059669",
    onPrimaryContainer: "#ecfdf5",
    glow: "#059669",
  },
  rose: {
    primary: "#fda4af",
    primaryContainer: "#e11d48",
    onPrimaryContainer: "#fff1f2",
    glow: "#e11d48",
  },
  violet: {
    primary: "#d8b4fe",
    primaryContainer: "#6b21a8",
    onPrimaryContainer: "#faf5ff",
    glow: "#6b21a8",
  },
  amber: {
    primary: "#fcd34d",
    primaryContainer: "#b45309",
    onPrimaryContainer: "#fffbeb",
    glow: "#b45309",
  },
  cyan: {
    primary: "#67e8f9",
    primaryContainer: "#0e7490",
    onPrimaryContainer: "#f0fdfa",
    glow: "#0e7490",
  }
};

const CURRENCIES: Record<string, { symbol: string; rate: number }> = {
  INR: { symbol: '₹',   rate: 1       },
  USD: { symbol: '$',   rate: 0.012   },
  EUR: { symbol: '€',   rate: 0.011   },
  GBP: { symbol: '£',   rate: 0.0094  },
  AED: { symbol: 'د.إ',  rate: 0.044   },
  SAR: { symbol: '﷼',   rate: 0.045   },
  SGD: { symbol: 'S$',  rate: 0.016   },
  AUD: { symbol: 'A$',  rate: 0.018   },
  CAD: { symbol: 'C$',  rate: 0.016   },
  JPY: { symbol: '¥',   rate: 1.93    },
};

function detectCurrency(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const locale = (navigator.language || '').toLowerCase();
    if (tz.startsWith('Asia/Kolkata') || tz.startsWith('Asia/Calcutta') || locale.includes('-in') || locale === 'hi') return 'INR';
    if (tz.startsWith('Europe/London')) return 'GBP';
    if (tz.startsWith('Europe/')) return 'EUR';
    if (tz.startsWith('Asia/Dubai') || tz.startsWith('Asia/Muscat') || tz.startsWith('Asia/Abu_Dhabi')) return 'AED';
    if (tz.startsWith('Asia/Riyadh') || tz.startsWith('Asia/Bahrain') || tz.startsWith('Asia/Kuwait')) return 'SAR';
    if (tz.startsWith('Asia/Singapore')) return 'SGD';
    if (tz.startsWith('Asia/Tokyo') || locale.startsWith('ja')) return 'JPY';
    if (tz.startsWith('Australia/')) return 'AUD';
    if (tz.startsWith('America/Toronto') || tz.startsWith('America/Vancouver') || tz.startsWith('America/Winnipeg')) return 'CAD';
  } catch {}
  return 'INR';
}

export default function AdminDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const { settings, updatePanels } = useLayoutSync(true);
  const [currentTheme, setCurrentTheme] = useState<Theme>("indigo");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>("admin@latexify.io");
  const [adminName, setAdminName] = useState<string>("Admin Root");
  const [loggingOut, setLoggingOut] = useState(false);

  // Real ticket notifications
  const [ticketNotifications, setTicketNotifications] = useState<any[]>([]);
  const [ticketUnreadCount, setTicketUnreadCount] = useState(0);
  const [isTicketNotifOpen, setIsTicketNotifOpen] = useState(false);
  const ticketNotifRef = useRef<HTMLDivElement>(null);
  
  const profileRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // ── Currency display conversion state ──
  const [activeCurrency, setActiveCurrency] = useState<string>('INR');
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({});

  // Dynamic aggregates states
  const [metrics, setMetrics] = useState<any>({
    totalUsers: 0,
    totalRevenue: 0,
    aiUsage: 0,
    activeNow: 0,
    premium: 0,
    freeTier: 0,
    blacklisted: 0,
    abnormal: 0,
    totalTickets: 0,
    ticketsPending: 0,
    ticketsInProgress: 0,
    ticketsResolved: 0,
    ticketsArchived: 0,
    trends: {
      totalUsers: [],
      totalRevenue: [],
      aiUsage: [],
      activeNow: [],
      premium: [],
      freeTier: [],
      blacklisted: [],
      abnormal: [],
      totalTickets: []
    }
  });

  const fmtRevenue = (inrAmount: number): string => {
    const cur = CURRENCIES[activeCurrency] ?? CURRENCIES['INR'];
    const rate = currencyRates[activeCurrency] ?? cur.rate;
    const converted = inrAmount * rate;
    const decimals = ['JPY', 'INR'].includes(activeCurrency) ? 0 : 2;
    return `${cur.symbol}${converted.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const renderMetricValue = (value: string | number, colorVar: string) => {
    if (loading) {
      return (
        <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-md mt-1"></div>
      );
    }
    return (
      <h3 className="text-xl font-bold truncate" style={{ color: `var(${colorVar})` }}>
        {value}
      </h3>
    );
  };

  const renderMiniBarChart = (data: number[], colorVar: string) => {
    if (loading) {
      return (
        <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-md"></div>
      );
    }
    const safeData = data && data.length > 0 ? data : [0, 0, 0, 0];
    const max = Math.max(...safeData, 1);
    return (
      <div className="h-8 w-20 flex items-end gap-[3px]">
        {safeData.map((val, idx) => {
          const heightPct = Math.max(10, Math.round((val / max) * 100));
          const opacity = 0.25 + (idx / (safeData.length - 1)) * 0.75;
          return (
            <div
              key={idx}
              className="w-1.5 rounded-t-sm transition-all duration-300"
              style={{
                height: `${heightPct}%`,
                backgroundColor: `var(${colorVar})`,
                opacity,
              }}
              title={`Value: ${val}`}
            />
          );
        })}
      </div>
    );
  };

  const getCardClassName = (type: string) => {
    const base = "border p-4 rounded-xl transition-all duration-300 relative overflow-hidden hover:scale-[1.02] ";
    const glowColors: Record<string, string> = {
      totalUsers: "hover:shadow-[0_8px_30px_rgba(99,102,241,0.2)]",
      totalRevenue: "hover:shadow-[0_8px_30px_rgba(16,185,129,0.2)]",
      aiUsage: "hover:shadow-[0_8px_30px_rgba(6,182,212,0.2)]",
      activeNow: "hover:shadow-[0_8px_30px_rgba(245,158,11,0.2)]",
      premium: "hover:shadow-[0_8px_30px_rgba(244,63,94,0.2)]",
      freeTier: "hover:shadow-[0_8px_30px_rgba(148,163,184,0.15)]",
      blacklisted: "hover:shadow-[0_8px_30px_rgba(239,68,68,0.2)]",
      abnormal: "hover:shadow-[0_8px_30px_rgba(249,115,22,0.2)]",
      totalTickets: "hover:shadow-[0_8px_30px_rgba(217,70,239,0.2)] cursor-pointer active:scale-95",
      ticketsPending: "hover:shadow-[0_8px_30px_rgba(239,68,68,0.15)] cursor-pointer active:scale-95",
      ticketsInProgress: "hover:shadow-[0_8px_30px_rgba(245,158,11,0.15)] cursor-pointer active:scale-95",
      ticketsResolved: "hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)] cursor-pointer active:scale-95",
      ticketsArchived: "hover:shadow-[0_8px_30px_rgba(148,163,184,0.15)] cursor-pointer active:scale-95",
    };
    return base + (glowColors[type] || "hover:shadow-lg");
  };

  const getCardStyle = (type: string) => {
    const bgMap: Record<string, { bgDark: string; bgLight: string; borderDark: string; borderLight: string }> = {
      totalUsers: {
        bgDark: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.03) 100%)",
        bgLight: "linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(168, 85, 247, 0.01) 100%)",
        borderDark: "rgba(99, 102, 241, 0.25)",
        borderLight: "rgba(99, 102, 241, 0.15)"
      },
      totalRevenue: {
        bgDark: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.03) 100%)",
        bgLight: "linear-gradient(135deg, rgba(16, 185, 129, 0.03) 0%, rgba(5, 150, 105, 0.01) 100%)",
        borderDark: "rgba(16, 185, 129, 0.25)",
        borderLight: "rgba(16, 185, 129, 0.15)"
      },
      aiUsage: {
        bgDark: "linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(14, 116, 144, 0.03) 100%)",
        bgLight: "linear-gradient(135deg, rgba(6, 182, 212, 0.03) 0%, rgba(14, 116, 144, 0.01) 100%)",
        borderDark: "rgba(6, 182, 212, 0.25)",
        borderLight: "rgba(6, 182, 212, 0.15)"
      },
      activeNow: {
        bgDark: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.03) 100%)",
        bgLight: "linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, rgba(217, 119, 6, 0.01) 100%)",
        borderDark: "rgba(245, 158, 11, 0.25)",
        borderLight: "rgba(245, 158, 11, 0.15)"
      },
      premium: {
        bgDark: "linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(225, 29, 72, 0.03) 100%)",
        bgLight: "linear-gradient(135deg, rgba(244, 63, 94, 0.03) 0%, rgba(225, 29, 72, 0.01) 100%)",
        borderDark: "rgba(244, 63, 94, 0.25)",
        borderLight: "rgba(244, 63, 94, 0.15)"
      },
      freeTier: {
        bgDark: "linear-gradient(135deg, rgba(148, 163, 184, 0.08) 0%, rgba(71, 85, 105, 0.03) 100%)",
        bgLight: "linear-gradient(135deg, rgba(148, 163, 184, 0.03) 0%, rgba(71, 85, 105, 0.01) 100%)",
        borderDark: "rgba(148, 163, 184, 0.25)",
        borderLight: "rgba(148, 163, 184, 0.15)"
      },
      blacklisted: {
        bgDark: "linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(185, 28, 28, 0.04) 100%)",
        bgLight: "linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, rgba(185, 28, 28, 0.01) 100%)",
        borderDark: "rgba(239, 68, 68, 0.3)",
        borderLight: "rgba(239, 68, 68, 0.18)"
      },
      abnormal: {
        bgDark: "linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(194, 65, 12, 0.04) 100%)",
        bgLight: "linear-gradient(135deg, rgba(249, 115, 22, 0.04) 0%, rgba(194, 65, 12, 0.01) 100%)",
        borderDark: "rgba(249, 115, 22, 0.3)",
        borderLight: "rgba(249, 115, 22, 0.18)"
      },
      totalTickets: {
        bgDark: "linear-gradient(135deg, rgba(217, 70, 239, 0.08) 0%, rgba(162, 28, 175, 0.03) 100%)",
        bgLight: "linear-gradient(135deg, rgba(217, 70, 239, 0.03) 0%, rgba(162, 28, 175, 0.01) 100%)",
        borderDark: "rgba(217, 70, 239, 0.25)",
        borderLight: "rgba(217, 70, 239, 0.15)"
      },
      ticketsPending: {
        bgDark: "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(185, 28, 28, 0.02) 100%)",
        bgLight: "linear-gradient(135deg, rgba(239, 68, 68, 0.03) 0%, rgba(185, 28, 28, 0.01) 100%)",
        borderDark: "rgba(239, 68, 68, 0.25)",
        borderLight: "rgba(239, 68, 68, 0.15)"
      },
      ticketsInProgress: {
        bgDark: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.02) 100%)",
        bgLight: "linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, rgba(217, 119, 6, 0.01) 100%)",
        borderDark: "rgba(245, 158, 11, 0.25)",
        borderLight: "rgba(245, 158, 11, 0.15)"
      },
      ticketsResolved: {
        bgDark: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.02) 100%)",
        bgLight: "linear-gradient(135deg, rgba(16, 185, 129, 0.03) 0%, rgba(5, 150, 105, 0.01) 100%)",
        borderDark: "rgba(16, 185, 129, 0.25)",
        borderLight: "rgba(16, 185, 129, 0.15)"
      },
      ticketsArchived: {
        bgDark: "linear-gradient(135deg, rgba(148, 163, 184, 0.08) 0%, rgba(71, 85, 105, 0.02) 100%)",
        bgLight: "linear-gradient(135deg, rgba(148, 163, 184, 0.03) 0%, rgba(71, 85, 105, 0.01) 100%)",
        borderDark: "rgba(148, 163, 184, 0.25)",
        borderLight: "rgba(148, 163, 184, 0.15)"
      }
    };
    const colors = bgMap[type];
    if (!colors) return {};
    return {
      background: isDarkMode ? colors.bgDark : colors.bgLight,
      borderColor: isDarkMode ? colors.borderDark : colors.borderLight,
    };
  };

  const [feed, setFeed] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [charts, setCharts] = useState<any>({
    "7D": [],
    "30D": [],
    "ALL": []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<"7D" | "30D" | "ALL">("30D");

  // Admin tasks & Traffic density
  const [tasks, setTasks] = useState<{ id: string; label: string; completed: boolean }[]>([]);
  const [trafficDensity, setTrafficDensity] = useState<number[]>([]);
  const [newTaskLabel, setNewTaskLabel] = useState("");

  // Alert Broadcast form
  const [alertTitle, setAlertTitle] = useState("");
  const [alertContent, setAlertContent] = useState("");
  const [alertPriority, setAlertPriority] = useState<"info" | "warning" | "critical">("info");
  const [postingAlert, setPostingAlert] = useState(false);

  // Support Tickets state
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketResolutionNote, setTicketResolutionNote] = useState("");
  const [ticketListFilter, setTicketListFilter] = useState<string | null>(null);
  const [ticketUpdating, setTicketUpdating] = useState(false);

  const [systemStatus, setSystemStatus] = useState({
    dbStatus: "healthy",
    latexStatus: "online"
  });

  // Active Sessions States & Handlers
  const [showActiveSessionsModal, setShowActiveSessionsModal] = useState(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [terminatingSessionId, setTerminatingSessionId] = useState<string | null>(null);

  // Insight Modal States
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [insightType, setInsightType] = useState<string | null>(null);
  const [insightTitle, setInsightTitle] = useState("");
  const [insightData, setInsightData] = useState<any[]>([]);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const fetchInsightData = async (type: string, title: string) => {
    setInsightType(type);
    setInsightTitle(title);
    setShowInsightModal(true);
    setLoadingInsight(true);
    setInsightError(null);
    try {
      const res = await fetch(`/api/admin/dashboard/insight?type=${type}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setInsightData(data.data || []);
      } else {
        setInsightError(data.error || "Failed to load detailed insight");
        setInsightData([]);
      }
    } catch (err: any) {
      setInsightError(err.message || "Failed to fetch detailed insight");
      setInsightData([]);
    } finally {
      setLoadingInsight(false);
    }
  };

  const fetchActiveSessions = async () => {
    setLoadingSessions(true);
    setSessionsError(null);
    try {
      const res = await fetch("/api/admin/active-sessions", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setActiveSessions(data.sessions);
      } else {
        setSessionsError(data.error || 'Failed to load active sessions');
        setActiveSessions([]);
      }
    } catch (err: any) {
      setSessionsError(err.message || 'Failed to fetch active sessions');
      console.error("Failed to fetch active sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleActiveSessionsClick = () => {
    setShowActiveSessionsModal(true);
    fetchActiveSessions();
  };

  const handleTerminateSession = async (sessionId: string) => {
    setTerminatingSessionId(sessionId);
    try {
      const res = await fetch(`/api/admin/active-sessions?sessionId=${sessionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
        fetchStats(false);
      }
    } catch (err) {
      console.error("Failed to terminate session:", err);
    } finally {
      setTerminatingSessionId(null);
    }
  };

  // Safe JSON parser — guards against HTML error pages from server crashes
  const safeJson = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error("[Admin] Non-JSON response:", text.substring(0, 200));
      return { success: false, error: `Server error (HTTP ${res.status})` };
    }
  };

  const fetchStats = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      const data = await safeJson(res);
      if (data.success) {
        setMetrics(data.metrics);
        setFeed(data.feed);
        setAnnouncements(data.announcements);
        setCharts(data.charts);
        setTrafficDensity(data.trafficDensity || []);
        setTasks(data.tasks || []);
        if (data.systemStatus) {
          setSystemStatus(data.systemStatus);
        }
        setError(null);
      } else {
        setError(data.error || "Failed to load admin stats");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load admin stats");
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await fetch("/api/admin/help/tickets");
      if (!res.ok) {
        console.warn("[AdminDashboard] Fetch tickets response not OK:", res.status);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setAllTickets(data.tickets);
        setRecentTickets(data.tickets.slice(0, 4));
      }
    } catch (err: any) {
      console.warn("[AdminDashboard] Failed to fetch tickets:", err.message || err);
    }
  };

  const fetchTicketNotifications = async () => {
    try {
      const res = await fetch("/api/admin/notifications?unreadOnly=true");
      const data = await res.json();
      setTicketNotifications(data.notifications || []);
      setTicketUnreadCount(data.unreadCount || 0);
    } catch {}
  };

  const markAllTicketNotifRead = async () => {
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setTicketNotifications([]);
      setTicketUnreadCount(0);
    } catch {}
  };

  const markTicketNotifRead = async (id: string) => {
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      setTicketNotifications(prev => prev.filter(n => n.id !== id));
      setTicketUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error("Failed to dismiss ticket notification:", err);
    }
  };

  const handleTicketUpdate = async (id: string, status: string, priority: string, reason?: string) => {
    setTicketUpdating(true);
    try {
      const res = await fetch("/api/admin/help/tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, priority, reason: reason || ticketResolutionNote })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTicket(null);
        setTicketResolutionNote("");
        fetchTickets();
        fetchStats(false);
      }
    } catch (err) {
      console.error("Failed to update ticket", err);
    } finally {
      setTicketUpdating(false);
    }
  };

  const filteredTickets = ticketListFilter === "all" ? allTickets
    : ticketListFilter === "pending" ? allTickets.filter((t: any) => t.status === "open")
    : ticketListFilter === "in_progress" ? allTickets.filter((t: any) => t.status === "in_progress")
    : ticketListFilter === "resolved" ? allTickets.filter((t: any) => t.status === "resolved")
    : ticketListFilter === "archived" ? allTickets.filter((t: any) => t.archivedAt !== null)
    : [];

  // Load layout from PocketBase when available
  useEffect(() => {
    if (settings.panels?.theme) {
      setCurrentTheme(settings.panels.theme as Theme);
    }
    if (settings.panels?.mode) {
      setIsDarkMode(settings.panels.mode === "dark");
    }
    if (settings.panels?.currency) {
      setActiveCurrency(settings.panels.currency);
    }
  }, [settings.panels?.theme, settings.panels?.mode, settings.panels?.currency]);

  useEffect(() => {
    setMounted(true);
    // Load theme setting
    const savedTheme = settings.panels?.theme || (localStorage.getItem("latexify-admin-theme") as Theme | null);
    const savedMode = settings.panels?.mode || localStorage.getItem("latexify-admin-mode");
    const savedCurrency = settings.panels?.currency || localStorage.getItem("latexify-admin-currency");
    
    if (savedTheme) setCurrentTheme(savedTheme);
    if (savedMode) setIsDarkMode(savedMode === "dark");
    setActiveCurrency(savedCurrency || detectCurrency());

    // Load admin info from server session
    fetch("/api/admin/session")
      .then(r => r.json())
      .then(data => {
        if (data.success && data.admin) {
          setAdminEmail(data.admin.email);
          setAdminName(data.admin.name || "Admin Root");
          localStorage.setItem("latexify-admin-email", data.admin.email);
          localStorage.setItem("latexify-admin-name", data.admin.name || "Admin Root");
          if (data.token) {
            localStorage.setItem("latexify-admin-token", data.token);
          }
        }
      })
      .catch(() => {
        // Fallback to localStorage display values
        const storedEmail = localStorage.getItem("latexify-admin-email");
        const storedName = localStorage.getItem("latexify-admin-name");
        if (storedEmail) setAdminEmail(storedEmail);
        if (storedName) setAdminName(storedName);
      });

    // Fetch live market currency conversion rates relative to INR
    const fetchRates = async () => {
      try {
        const res = await fetch("/api/currency/rates");
        if (res.ok) {
          const data = await res.json();
          if (data && data.rates) {
            setCurrencyRates(data.rates);
          }
        }
      } catch (err) {
        console.error("Failed to fetch exchange rates on dashboard:", err);
      }
    };
    fetchRates();

    // Initial statistics load
    fetchStats(true);
    fetchTickets();
    fetchTicketNotifications();

    // Refresh platform statistics and tickets every 10 seconds
    const interval = setInterval(() => { fetchStats(false); fetchTickets(); fetchTicketNotifications(); }, 10000);

    // PocketBase real-time subscription for instant stats refreshes
    let unsubscribeAll: (() => void) | null = null;
    try {
      const pb = createPb();
      const token = typeof window !== 'undefined' ? localStorage.getItem('latexify-admin-token') : null;
      if (token) {
        pb.authStore.save(token, null);
      }
      const triggerRefresh = () => {
        fetchStats(false);
        fetchTickets();
        fetchTicketNotifications();
      };

      Promise.all([
        pb.collection('users').subscribe('*', triggerRefresh),
        pb.collection('projects').subscribe('*', triggerRefresh),
        pb.collection('support_tickets').subscribe('*', triggerRefresh),
        pb.collection('ai_usage_logs').subscribe('*', triggerRefresh),
        pb.collection('admin_tasks').subscribe('*', triggerRefresh),
        pb.collection('announcements').subscribe('*', triggerRefresh)
      ]).then(unsubs => {
        unsubscribeAll = () => {
          unsubs.forEach(unsub => {
            try { unsub(); } catch {}
          });
        };
      }).catch(err => {
        console.warn("[AdminDashboard Realtime] Subscription failed:", err);
      });
    } catch (err) {
      console.warn("[AdminDashboard Realtime] Initialisation failed:", err);
    }

    return () => {
      clearInterval(interval);
      if (unsubscribeAll) {
        unsubscribeAll();
      }
    };
  }, []);

  // Save theme selection changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("latexify-admin-theme", currentTheme);
      localStorage.setItem("latexify-admin-mode", isDarkMode ? "dark" : "light");
      localStorage.setItem("latexify-admin-currency", activeCurrency);

      updatePanels({
        theme: currentTheme,
        mode: isDarkMode ? "dark" : "light",
        currency: activeCurrency,
      });
    }
  }, [currentTheme, isDarkMode, activeCurrency, mounted, updatePanels]);

  // Handle click outside for profile, theme, and notifications dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setIsThemeOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (ticketNotifRef.current && !ticketNotifRef.current.contains(event.target as Node)) {
        setIsTicketNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const nextCompleted = !task.completed;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: nextCompleted } : t));
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, completed: nextCompleted })
      });
      const data = await safeJson(res);
      if (!data.success) {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !nextCompleted } : t));
      }
    } catch (err) {
      console.error("Failed to toggle task:", err);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !nextCompleted } : t));
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskLabel.trim()) return;
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newTaskLabel })
      });
      const data = await safeJson(res);
      if (data.success) {
        setTasks(prev => [...prev, data.task]);
        setNewTaskLabel("");
      }
    } catch (err) {
      console.error("Failed to add task:", err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/tasks?id=${id}`, {
        method: "DELETE"
      });
      const data = await safeJson(res);
      if (data.success) {
        setTasks(prev => prev.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const handlePostAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertTitle.trim() || !alertContent.trim()) return;
    setPostingAlert(true);
    try {
      const res = await fetch("/api/admin/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: alertTitle,
          content: alertContent,
          priority: alertPriority
        })
      });
      const data = await safeJson(res);
      if (data.success) {
        setAlertTitle("");
        setAlertContent("");
        setAlertPriority("info");
        await fetchStats(false);
      }
    } catch (err) {
      console.error("Failed to post alert:", err);
    } finally {
      setPostingAlert(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      localStorage.removeItem("latexify-admin-email");
      localStorage.removeItem("latexify-admin-name");
    } catch {
      // Ignore errors — cookie will expire anyway
    }
    window.location.href = "/admin/login";
  };

  const handleDismissAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/stats?id=${id}`, {
        method: "DELETE"
      });
      const data = await safeJson(res);
      if (data.success) {
        setAnnouncements(prev => prev.filter(a => a.id !== id));
      }
    } catch (err) {
      console.error("Failed to dismiss alert:", err);
    }
  };

  const handleDismissAll = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/stats?id=all", {
        method: "DELETE"
      });
      const data = await safeJson(res);
      if (data.success) {
        setAnnouncements([]);
      }
    } catch (err) {
      console.error("Failed to dismiss all alerts:", err);
    }
  };

  if (!mounted || loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white relative overflow-hidden select-none">
        {/* Background ambient glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />

        <div className="z-10 flex flex-col items-center max-w-sm w-full px-6 text-center">
          <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
            {/* Spinning colorful gradient ring */}
            <motion.div 
              className="absolute inset-0 rounded-3xl border-2 border-transparent border-t-indigo-500 border-r-purple-500"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
            {/* Pulsing glow backplate */}
            <motion.div 
              className="absolute inset-2 rounded-2xl bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 blur-sm"
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            />
            {/* Actual logo */}
            <div className="relative w-14 h-14 bg-slate-900 shadow-md rounded-2xl flex items-center justify-center p-2 border border-white/5">
              <Image 
                src="/logo.png" 
                alt="Latexify Logo" 
                width={40} 
                height={40} 
                className="object-contain"
                priority
              />
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-widest text-white font-[family-name:var(--font-outfit)] mb-2 uppercase">
            Latexify Admin
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-6">
            Loading system metrics
          </p>

          {/* Modern micro-progress bar */}
          <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full absolute top-0"
              initial={{ width: "30%", left: "-30%" }}
              animate={{ 
                left: ["-30%", "100%"]
              }}
              transition={{ 
                repeat: Infinity,
                duration: 2, 
                ease: "easeInOut"
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Chart data formatting helper
  const currentChartData = charts[selectedInterval] || [];
  
  const generatePathD = (data: { value: number }[]) => {
    if (!data || data.length === 0) return "";
    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;
    
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      // Map value to Y coordinates from 15 to 85 inside viewport box
      const y = 85 - ((d.value - minVal) / valRange) * 70;
      return { x, y };
    });

    return points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
  };

  const generateAreaD = (data: { value: number }[]) => {
    const pathD = generatePathD(data);
    if (!pathD) return "";
    return `${pathD} L100,100 L0,100 Z`;
  };

  // Human friendly time formats
  const formatTimeAgo = (dateInput: string | Date) => {
    const d = new Date(dateInput);
    const diffMs = new Date().getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return d.toLocaleDateString();
  };

  const totalDistributionUsers = metrics.freeTier + metrics.premium;
  const freePct = totalDistributionUsers > 0 ? Math.round((metrics.freeTier / totalDistributionUsers) * 100) : 75;
  const premiumPct = totalDistributionUsers > 0 ? 100 - freePct : 25;

  return (
    <div className="font-sans overflow-x-hidden transition-colors duration-500" style={{ backgroundColor: "var(--color-admin-background)", color: "var(--color-admin-on-background)" }}>
      <style jsx global>{`
        :root {
          ${!isDarkMode ? `
            --color-admin-primary: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5'} !important;
            --color-admin-primary-container: ${currentTheme === 'rose' ? '#ffe4e6' : currentTheme === 'emerald' ? '#d1fae5' : '#e0e7ff'} !important;
            --color-admin-on-primary-container: ${currentTheme === 'rose' ? '#4c0519' : currentTheme === 'emerald' ? '#022c22' : '#1e1b4b'} !important;
            --color-admin-secondary: ${currentTheme === 'rose' ? '#f43f5e' : currentTheme === 'emerald' ? '#10b981' : '#6366f1'} !important;
            --color-admin-secondary-container: ${currentTheme === 'rose' ? '#ffe4e6' : currentTheme === 'emerald' ? '#d1fae5' : '#e0e7ff'} !important;
            --color-admin-on-secondary-container: ${currentTheme === 'rose' ? '#4c0519' : currentTheme === 'emerald' ? '#022c22' : '#1e1b4b'} !important;
            --color-admin-tertiary: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5'} !important;
            --color-admin-outline-variant: #cbd5e1 !important;
            --color-admin-background: #f8fafc !important;
            --color-admin-surface: #ffffff !important;
            --color-admin-surface-dim: #f1f5f9 !important;
            --color-admin-surface-bright: #ffffff !important;
            --color-admin-surface-container-lowest: #ffffff !important;
            --color-admin-surface-container-low: #f1f5f9 !important;
            --color-admin-surface-container: #e2e8f0 !important;
            --color-admin-surface-container-high: #cbd5e1 !important;
            --color-admin-surface-container-highest: #94a3b8 !important;
            --color-admin-on-surface: #0f172a !important;
            --color-admin-on-surface-variant: #475569 !important;
            --color-admin-on-background: #0f172a !important;
            --color-admin-outline: #64748b !important;
            --color-admin-error: #ba1a1a !important;
            --color-admin-on-error: #ffffff !important;
            --color-admin-error-container: #ffdad6 !important;
            --color-admin-on-error-container: #410002 !important;
            --color-admin-inverse-surface: #1e293b !important;
            --color-admin-inverse-on-surface: #f1f5f9 !important;
            --color-admin-inverse-primary: ${themes[currentTheme].primary} !important;
            --color-admin-surface-tint: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5'} !important;
            --color-admin-surface-variant: #e2e8f0 !important;
          ` : `
            --color-admin-primary: ${themes[currentTheme].primary} !important;
            --color-admin-primary-container: ${themes[currentTheme].primaryContainer} !important;
            --color-admin-on-primary-container: ${themes[currentTheme].onPrimaryContainer} !important;
            --color-admin-secondary: ${currentTheme === 'rose' ? '#fecdd3' : currentTheme === 'emerald' ? '#a7f3d0' : '#c0c1ff'} !important;
            --color-admin-secondary-container: ${currentTheme === 'rose' ? '#be123c' : currentTheme === 'emerald' ? '#047857' : '#3131c0'} !important;
            --color-admin-on-secondary-container: ${currentTheme === 'rose' ? '#fff1f2' : currentTheme === 'emerald' ? '#ecfdf5' : '#b0b2ff'} !important;
            --color-admin-tertiary: ${themes[currentTheme].primary} !important;
            --color-admin-outline-variant: #464555 !important;
            --color-admin-background: #0b1326 !important;
            --color-admin-surface: #0b1326 !important;
            --color-admin-surface-dim: #0b1326 !important;
            --color-admin-surface-bright: #31394d !important;
            --color-admin-surface-container-lowest: #060e20 !important;
            --color-admin-surface-container-low: #131b2e !important;
            --color-admin-surface-container: #171f33 !important;
            --color-admin-surface-container-high: #222a3d !important;
            --color-admin-surface-container-highest: #2d3449 !important;
            --color-admin-on-surface: #dae2fd !important;
            --color-admin-on-surface-variant: #c7c4d8 !important;
            --color-admin-on-background: #dae2fd !important;
            --color-admin-outline: #918fa1 !important;
            --color-admin-error: #ffb4ab !important;
            --color-admin-on-error: #690005 !important;
            --color-admin-error-container: #93000a !important;
            --color-admin-on-error-container: #ffdad6 !important;
            --color-admin-inverse-surface: #dae2fd !important;
            --color-admin-inverse-on-surface: #283044 !important;
            --color-admin-inverse-primary: ${themes[currentTheme].primary} !important;
            --color-admin-surface-tint: ${themes[currentTheme].primary} !important;
            --color-admin-surface-variant: #2d3449 !important;
          `}
        }
      `}</style>
      
      {/* Sidebar */}
      <aside className="flex flex-col h-full p-4 gap-2 fixed h-screen w-64 left-0 top-0 border-r z-50 transition-colors duration-500"
        style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
        <div className="flex flex-col items-center gap-1 px-2 mb-6 mt-2 text-center">
          <Image src="/logo.png" alt="Latexify Logo" width={0} height={0} sizes="100%" className="w-48 h-12 object-contain"
            style={{ filter: isDarkMode ? 'brightness(0) invert(1)' : 'none' }} />
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-85 mt-1"
            style={{ color: 'var(--color-admin-primary)' }}>Admin Console</p>
        </div>
        <nav className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
          <a className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all translate-x-1 duration-200 shadow-sm"
            style={{ backgroundColor: 'var(--color-admin-secondary-container)', color: 'var(--color-admin-on-secondary-container)' }} href="#">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>Dashboard
          </a>
          <Link href="/admin/billings" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">payments</span>Bill and Payments
          </Link>
          <Link href="/admin/users" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">group</span>Users
          </Link>
          <Link href="/admin/profile" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">settings</span>Profile and Plan Setting
          </Link>
          <Link href="/admin/ai-caps" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">speed</span>AI Usage &amp; Caps Rules
          </Link>
          <Link href="/admin/ai-analysis" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">psychology</span>AI Analysis
          </Link>
          <Link href="/admin/anomalies" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">warning</span>Anomaly Center
          </Link>
          <Link href="/admin/help" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">help</span>Help and Support
          </Link>
          <Link href="/admin/offers" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">local_offer</span>Offers
          </Link>
          <Link href="/admin/emails" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">mail</span>Email History
          </Link>
          <Link href="/admin/tax-calculation" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">calculate</span>Tax Calculation
          </Link>
          <div className="border-t my-2" style={{ borderColor: 'var(--color-admin-outline-variant)' }}></div>
          <a href="/pb/_/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-primary)' }}>
            <span className="material-symbols-outlined">database</span>PB Dashboard
          </a>
        </nav>
        <div className="mt-auto p-4 rounded-xl border text-sm"
          style={{ backgroundColor: 'var(--color-admin-surface-container-low)', borderColor: 'var(--color-admin-outline-variant)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-admin-primary)' }}></div>
            <span style={{ color: 'var(--color-admin-primary)' }}>System Online</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Version 4.2.0-stable</p>
        </div>
      </aside>

      {/* Top App Bar */}
      <header className="flex justify-between items-center fixed top-0 left-64 right-0 2xl:right-80 px-6 py-4 border-b z-40 transition-colors duration-500" style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)" }}>
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-full max-w-3xl">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-admin-on-surface-variant)" }}>search</span>
            <input className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-container focus:border-primary outline-none transition-all" style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }} placeholder="Search parameters..." type="text" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative" ref={themeRef}>
            <button onClick={() => setIsThemeOpen(!isThemeOpen)} className="material-symbols-outlined transition-colors p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-500" style={{ color: "var(--color-admin-on-surface-variant)" }} title="Theme Settings">
              palette
            </button>
            <div className={`absolute right-0 mt-2 w-56 border rounded-xl shadow-xl z-50 overflow-hidden ${isThemeOpen ? "block" : "hidden"}`} style={{ backgroundColor: "var(--color-admin-surface-container-highest)", borderColor: "var(--color-admin-outline-variant)" }}>
              <div className="p-3 border-b" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-admin-on-surface)" }}>Accent Color</p>
              </div>
              <div className="p-1">
                {(Object.keys(themes) as Theme[]).map((t) => (
                  <button 
                    key={t}
                    onClick={() => {
                      setCurrentTheme(t);
                      setIsThemeOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all group/item hover:bg-opacity-20 hover:bg-gray-500"
                  >
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: themes[t].primary }}></span>
                    <span className="text-sm font-medium capitalize" style={{ color: "var(--color-admin-on-surface)" }}>{t} {t === "indigo" ? "(Default)" : ""}</span>
                    {currentTheme === t && <span className="material-symbols-outlined text-[16px] ml-auto" style={{ color: "var(--color-admin-primary)" }}>check</span>}
                  </button>
                ))}
              </div>
              <div className="p-3 border-t" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Dark Mode</span>
                  <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-5 rounded-full relative transition-colors" style={{ backgroundColor: "var(--color-admin-primary)" }}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow-sm transition-all ${isDarkMode ? "right-0.5" : "left-0.5"}`} style={{ backgroundColor: "var(--color-admin-on-primary)" }}></div>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} 
              className="material-symbols-outlined transition-colors p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-500 relative flex items-center justify-center" 
              style={{ color: "var(--color-admin-on-surface-variant)" }}
              title="Notifications"
            >
              notifications
              {announcements.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              )}
            </button>
            {isNotificationsOpen && (
              <div 
                className="absolute right-0 mt-2 w-80 border rounded-2xl shadow-2xl z-50 overflow-hidden" 
                style={{ backgroundColor: "var(--color-admin-surface-container-highest)", borderColor: "var(--color-admin-outline-variant)" }}
              >
                <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: "var(--color-admin-outline-variant)", backgroundColor: "var(--color-admin-surface-container-high)" }}>
                  <p className="text-sm font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Notifications</p>
                  {announcements.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-400">
                      {announcements.length} Alert{announcements.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="p-2 max-h-[320px] overflow-y-auto divide-y divide-white/5">
                  {announcements.length === 0 ? (
                    <div className="text-center text-xs py-8 text-opacity-65" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                      No new notifications.
                    </div>
                  ) : (
                    announcements.map((item) => (
                      <div key={item.id} className="p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative group text-left">
                        <button 
                          onClick={() => handleDismissAlert(item.id)}
                          className="absolute right-2 top-2 hidden group-hover:block hover:bg-black/5 dark:hover:bg-white/5 rounded p-0.5"
                          title="Dismiss"
                        >
                          <span className="material-symbols-outlined text-[14px] block" style={{ color: "var(--color-admin-on-surface-variant)" }}>close</span>
                        </button>
                        <p className="text-xs font-bold" style={{ color: item.priority === "critical" || item.priority === "warning" ? "var(--color-admin-primary)" : "var(--color-admin-on-surface)" }}>
                          {item.title}
                        </p>
                        <p className="text-xs mt-1 leading-normal break-words" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                          {item.content}
                        </p>
                        <span className="text-[10px] mt-1.5 block opacity-50" style={{ color: "var(--color-admin-outline)" }}>
                          {formatTimeAgo(item.startsAt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {announcements.length > 0 && (
                  <button 
                    onClick={handleDismissAll} 
                    className="block w-full text-center py-2.5 text-xs font-bold border-t transition-colors hover:bg-black/5 dark:hover:bg-white/5" 
                    style={{ color: "var(--color-admin-on-surface-variant)", borderColor: "var(--color-admin-outline-variant)" }}
                  >
                    DISMISS ALL
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Ticket Notifications Bell */}
          <div className="relative" ref={ticketNotifRef}>
            <button
              onClick={() => setIsTicketNotifOpen(!isTicketNotifOpen)}
              className="material-symbols-outlined transition-colors p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-500 relative flex items-center justify-center"
              style={{ color: "var(--color-admin-on-surface-variant)" }}
              title="Ticket Notifications"
            >
              support_agent
              {ticketUnreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black px-1">
                  {ticketUnreadCount > 99 ? "99+" : ticketUnreadCount}
                </span>
              )}
            </button>
            {isTicketNotifOpen && (
              <div
                className="absolute right-0 mt-2 w-80 border rounded-2xl shadow-2xl z-50 overflow-hidden"
                style={{ backgroundColor: "var(--color-admin-surface-container-highest)", borderColor: "var(--color-admin-outline-variant)" }}
              >
                <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: "var(--color-admin-outline-variant)", backgroundColor: "var(--color-admin-surface-container-high)" }}>
                  <p className="text-sm font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Ticket Notifications</p>
                  {ticketUnreadCount > 0 && (
                    <button onClick={markAllTicketNotifRead} className="text-[10px] font-bold hover:underline flex items-center gap-1" style={{ color: "var(--color-admin-primary)" }}>
                      <span className="material-symbols-outlined text-[12px]">done_all</span> Mark all read
                    </button>
                  )}
                </div>
                <div className="p-2 max-h-[320px] overflow-y-auto divide-y divide-white/5">
                  {ticketNotifications.length === 0 ? (
                    <div className="text-center text-xs py-8 text-opacity-65" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                      No ticket notifications.
                    </div>
                  ) : (
                    ticketNotifications.map((n) => (
                      <div key={n.id} className={`p-3 transition-colors relative group ${n.isRead ? "opacity-50" : ""}`} style={{ backgroundColor: n.isRead ? "transparent" : "var(--color-admin-primary-container)" }}>
                        <button 
                          onClick={() => markTicketNotifRead(n.id)}
                          className="absolute right-2 top-2 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Dismiss"
                        >
                          <span className="material-symbols-outlined text-[14px] block" style={{ color: "var(--color-admin-on-surface-variant)" }}>close</span>
                        </button>
                        <div className="pr-6">
                          <p className="text-xs font-bold" style={{ color: "var(--color-admin-on-surface)" }}>{n.title}</p>
                          <p className="text-xs mt-1 leading-normal break-words" style={{ color: "var(--color-admin-on-surface-variant)" }}>{n.body}</p>
                          <span className="text-[10px] mt-1.5 block opacity-50" style={{ color: "var(--color-admin-outline)" }}>
                            {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div ref={profileRef} className="relative pl-4 border-l" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
            <button
              id="admin-profile-btn"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
              style={{ backgroundColor: "var(--color-admin-surface-container-high)" }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)" }}>
                {adminName.split(/\s+/).map(n => n[0]).join("").slice(0,2).toUpperCase() || "AR"}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold" style={{ color: "var(--color-admin-on-surface)" }}>{adminName}</p>
                <p className="text-[10px] truncate max-w-[120px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>{adminEmail}</p>
              </div>
              <span className="material-symbols-outlined text-[16px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                {isProfileOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
              </span>
            </button>

            {/* Dropdown Menu */}
            {isProfileOpen && (
              <div
                className="absolute right-0 mt-2 w-64 border rounded-2xl shadow-2xl z-50 overflow-hidden"
                style={{ backgroundColor: "var(--color-admin-surface-container-highest)", borderColor: "var(--color-admin-outline-variant)" }}
              >
                {/* Header */}
                <div className="p-4 border-b" style={{ borderColor: "var(--color-admin-outline-variant)", backgroundColor: "var(--color-admin-surface-container-high)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base" style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)" }}>
                      {adminName.split(/\s+/).map(n => n[0]).join("").slice(0,2).toUpperCase() || "AR"}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--color-admin-on-surface)" }}>{adminName}</p>
                      <p className="text-xs truncate max-w-[160px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>{adminEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-2">
                  <Link
                    href="/admin/change-password"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                    style={{ color: "var(--color-admin-on-surface)" }}
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ color: "var(--color-admin-primary)" }}>lock_reset</span>
                    Change Password
                  </Link>
                  <button
                    id="admin-logout-btn"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 mt-1 disabled:opacity-60"
                    style={{ color: "#ef4444" }}
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    {loggingOut ? "Signing Out…" : "Sign Out"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="ml-64 2xl:mr-80 pt-24 pb-12 px-8 min-h-screen transition-colors duration-500">
        {error && (
          <div className="mb-6 p-4 rounded-xl border text-sm font-medium flex items-center gap-3 bg-red-500/10 text-red-500" style={{ borderColor: "rgba(255, 180, 171, 0.2)" }}>
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
            <button onClick={() => fetchStats(true)} className="ml-auto underline">Retry</button>
          </div>
        )}

        {/* Metrics Bento Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Total Users */}
          <div 
            className={`${getCardClassName("totalUsers")} cursor-pointer active:scale-95`} 
            style={getCardStyle("totalUsers")}
            onClick={() => fetchInsightData("totalUsers", "Total Users Detailed Insight")}
          >
            <p className="text-xs mb-1 font-bold opacity-80">Total Users</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(metrics.totalUsers.toLocaleString(), "--color-admin-primary")}
              {renderMiniBarChart(metrics.trends?.totalUsers, "--color-admin-primary")}
            </div>
          </div>
          {/* Card 2: Total Revenue */}
          <div 
            className={`${getCardClassName("totalRevenue")} cursor-pointer active:scale-95`} 
            style={getCardStyle("totalRevenue")}
            onClick={() => fetchInsightData("totalRevenue", "Financial Transactions & Revenue Detailed Insight")}
          >
            <p className="text-xs mb-1 font-bold opacity-80">Total Revenue</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(fmtRevenue(metrics.totalRevenue || 0), "--color-admin-primary")}
              {renderMiniBarChart(metrics.trends?.totalRevenue, "--color-admin-primary")}
            </div>
          </div>
          {/* Card 3: AI Usage */}
          <div 
            className={`${getCardClassName("aiUsage")} cursor-pointer active:scale-95`} 
            style={getCardStyle("aiUsage")}
            onClick={() => fetchInsightData("aiUsage", "AI Token Consumption Detailed Logs")}
          >
            <p className="text-xs mb-1 font-bold opacity-80">AI Usage</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(metrics.aiUsage >= 1000 ? `${(metrics.aiUsage / 1000).toFixed(0)}k` : metrics.aiUsage, "--color-admin-primary")}
              {renderMiniBarChart(metrics.trends?.aiUsage, "--color-admin-primary")}
            </div>
          </div>
          {/* Card 4: Active Now */}
          <div 
            className={`${getCardClassName("activeNow")} cursor-pointer active:scale-95`} 
            style={getCardStyle("activeNow")}
            onClick={handleActiveSessionsClick}
          >
            <p className="text-xs mb-1 font-bold opacity-80">Active Now</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(metrics.activeNow.toLocaleString(), "--color-admin-tertiary")}
              {renderMiniBarChart(metrics.trends?.activeNow, "--color-admin-tertiary")}
            </div>
          </div>
          {/* Card 5: Premium */}
          <div 
            className={`${getCardClassName("premium")} cursor-pointer active:scale-95`} 
            style={getCardStyle("premium")}
            onClick={() => fetchInsightData("premium", "Premium Upgrade Tier Scholars Insight")}
          >
            <p className="text-xs mb-1 font-bold opacity-80">Premium Upgrade</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(metrics.premium.toLocaleString(), "--color-admin-secondary")}
              {renderMiniBarChart(metrics.trends?.premium, "--color-admin-secondary")}
            </div>
          </div>
          {/* Card 6: Free Tier */}
          <div 
            className={`${getCardClassName("freeTier")} cursor-pointer active:scale-95`} 
            style={getCardStyle("freeTier")}
            onClick={() => fetchInsightData("freeTier", "Free Tier Scholars Detailed Insight")}
          >
            <p className="text-xs mb-1 font-bold opacity-80">Free Tier</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(metrics.freeTier.toLocaleString(), "--color-admin-on-surface")}
              {renderMiniBarChart(metrics.trends?.freeTier, "--color-admin-outline")}
            </div>
          </div>
          {/* Card 7: Blacklisted */}
          <div 
            className={`${getCardClassName("blacklisted")} cursor-pointer active:scale-95`} 
            style={getCardStyle("blacklisted")}
            onClick={() => fetchInsightData("blacklisted", "Blacklisted Accounts & Security Logs")}
          >
            <p className="text-xs mb-1 font-bold opacity-80">Blacklisted</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(metrics.blacklisted.toLocaleString(), "--color-admin-error")}
              {renderMiniBarChart(metrics.trends?.blacklisted, "--color-admin-error")}
            </div>
          </div>
          {/* Card 8: Abnormal */}
          <div 
            className={`${getCardClassName("abnormal")} cursor-pointer active:scale-95`} 
            style={getCardStyle("abnormal")}
            onClick={() => fetchInsightData("abnormal", "Flagged Abnormal Behavior Insight")}
          >
            <p className="text-xs mb-1 font-bold opacity-80">Abnormal Activity</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(metrics.abnormal.toLocaleString(), "--color-admin-error")}
              {renderMiniBarChart(metrics.trends?.abnormal, "--color-admin-error")}
            </div>
          </div>
          {/* Card 9: Total Tickets */}
          <div 
            onClick={() => { setTicketListFilter("all"); fetchInsightData("tickets", "Total Helpdesk Tickets Insight"); }} 
            className={`${getCardClassName("totalTickets")} cursor-pointer active:scale-95`} 
            style={getCardStyle("totalTickets")}
          >
            <p className="text-xs mb-1 font-bold opacity-80">Total Tickets</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(metrics.totalTickets?.toLocaleString() || "0", "--color-admin-primary")}
              {renderMiniBarChart(metrics.trends?.totalTickets || [metrics.ticketsPending, metrics.ticketsInProgress, metrics.ticketsResolved], "--color-admin-primary")}
            </div>
          </div>
          {/* Card 10: Tickets Pending */}
          <div 
            onClick={() => { setTicketListFilter("pending"); fetchInsightData("tickets_pending", "Pending Helpdesk Tickets Insight"); }} 
            className={`${getCardClassName("ticketsPending")} cursor-pointer active:scale-95`} 
            style={getCardStyle("ticketsPending")}
          >
            <p className="text-xs mb-1 font-bold opacity-80">Tickets Pending</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(metrics.ticketsPending?.toLocaleString() || "0", "--color-admin-error")}
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-lg" style={{ color: "var(--color-admin-error)" }}>pending_actions</span>
              </div>
            </div>
          </div>
          {/* Card 10b: Tickets In Progress */}
          <div 
            onClick={() => { setTicketListFilter("in_progress"); fetchInsightData("tickets_in_progress", "In-Progress Helpdesk Tickets Insight"); }} 
            className={`${getCardClassName("ticketsInProgress")} cursor-pointer active:scale-95`} 
            style={getCardStyle("ticketsInProgress")}
          >
            <p className="text-xs mb-1 font-bold opacity-80">Tickets In Progress</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(metrics.ticketsInProgress?.toLocaleString() || "0", "--color-admin-tertiary")}
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-lg" style={{ color: "var(--color-admin-tertiary)" }}>autorenew</span>
              </div>
            </div>
          </div>
          {/* Card 11: Tickets Resolved */}
          <div 
            onClick={() => { setTicketListFilter("resolved"); fetchInsightData("tickets_resolved", "Resolved Helpdesk Tickets Insight"); }} 
            className={`${getCardClassName("ticketsResolved")} cursor-pointer active:scale-95`} 
            style={getCardStyle("ticketsResolved")}
          >
            <p className="text-xs mb-1 font-bold opacity-80">Tickets Resolved</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(metrics.ticketsResolved?.toLocaleString() || "0", "--color-admin-secondary")}
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-lg" style={{ color: "var(--color-admin-secondary)" }}>check_circle</span>
              </div>
            </div>
          </div>
          {/* Card 12: Tickets Archived */}
          <div 
            onClick={() => { setTicketListFilter("archived"); fetchInsightData("tickets_archived", "Archived Helpdesk Tickets Insight"); }} 
            className={`${getCardClassName("ticketsArchived")} cursor-pointer active:scale-95`} 
            style={getCardStyle("ticketsArchived")}
          >
            <p className="text-xs mb-1 font-bold opacity-80">Tickets Archived</p>
            <div className="flex items-end justify-between gap-2">
              {renderMetricValue(metrics.ticketsArchived?.toLocaleString() || "0", "--color-admin-outline")}
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-lg" style={{ color: "var(--color-admin-outline)" }}>archive</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Visualizations */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* AI Usage Chart */}
            <div className="border rounded-xl p-6" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: "var(--color-admin-primary)" }}>AI Usage Over Time</h2>
                  <p className="text-sm" style={{ color: "var(--color-admin-on-surface-variant)" }}>Token consumption across all model endpoints</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedInterval("7D")}
                    className="px-3 py-1 text-xs rounded transition-all font-semibold" 
                    style={selectedInterval === "7D" ? { backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary)" } : { backgroundColor: "var(--color-admin-surface-container-highest)", color: "var(--color-admin-on-surface)", border: "1px solid var(--color-admin-outline-variant)" }}
                  >
                    7D
                  </button>
                  <button 
                    onClick={() => setSelectedInterval("30D")}
                    className="px-3 py-1 text-xs rounded transition-all font-semibold" 
                    style={selectedInterval === "30D" ? { backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary)" } : { backgroundColor: "var(--color-admin-surface-container-highest)", color: "var(--color-admin-on-surface)", border: "1px solid var(--color-admin-outline-variant)" }}
                  >
                    30D
                  </button>
                  <button 
                    onClick={() => setSelectedInterval("ALL")}
                    className="px-3 py-1 text-xs rounded transition-all font-semibold" 
                    style={selectedInterval === "ALL" ? { backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary)" } : { backgroundColor: "var(--color-admin-surface-container-highest)", color: "var(--color-admin-on-surface)", border: "1px solid var(--color-admin-outline-variant)" }}
                  >
                    ALL
                  </button>
                </div>
              </div>
              
              {/* Dynamic SVG Chart Area */}
              <div className="relative h-64 w-full flex items-end pb-8 border-b transition-all duration-300" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                {loading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 dark:bg-white/5 rounded-lg gap-2">
                    <div className="w-8 h-8 rounded-full border-2 border-indigo-500/10 border-t-indigo-500 animate-spin" style={{ borderTopColor: "var(--color-admin-primary)" }}></div>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-60" style={{ color: "var(--color-admin-on-surface-variant)" }}>Loading Chart...</span>
                  </div>
                ) : currentChartData.length > 0 ? (
                  <>
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
                      <div className="border-t" style={{ borderColor: "var(--color-admin-on-surface)" }}></div>
                      <div className="border-t" style={{ borderColor: "var(--color-admin-on-surface)" }}></div>
                      <div className="border-t" style={{ borderColor: "var(--color-admin-on-surface)" }}></div>
                      <div className="border-t" style={{ borderColor: "var(--color-admin-on-surface)" }}></div>
                    </div>
                    <div className="absolute inset-0 flex items-end overflow-hidden">
                      <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <path d={generatePathD(currentChartData)} fill="none" stroke="var(--color-admin-primary)" strokeWidth="2.5"></path>
                        <path d={generateAreaD(currentChartData)} fill="url(#grad)" opacity="0.15"></path>
                        <defs>
                          <linearGradient id="grad" x1="0%" x2="0%" y1="0%" y2="100%">
                            <stop offset="0%" style={{ stopColor: "var(--color-admin-primary)", stopOpacity: 1 }}></stop>
                            <stop offset="100%" style={{ stopColor: "var(--color-admin-primary)", stopOpacity: 0 }}></stop>
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>No statistics data found</p>
                  </div>
                )}
              </div>
              <div className="flex justify-between mt-4 text-xs font-semibold px-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                {currentChartData.map((d: any, idx: number) => {
                  // Only show key dates to prevent overlapping labels
                  const showLabel = 
                    idx === 0 || 
                    idx === Math.floor(currentChartData.length / 4) || 
                    idx === Math.floor(currentChartData.length / 2) || 
                    idx === Math.floor(currentChartData.length * 3 / 4) || 
                    idx === currentChartData.length - 1;
                  return showLabel ? <span key={idx}>{d.date}</span> : null;
                })}
              </div>
            </div>

            {/* Recent Support Tickets Section */}
            <div className="border rounded-xl overflow-hidden" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
              <div className="p-6 border-b flex justify-between items-center" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                <h2 className="text-xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Recent Support Tickets</h2>
                <Link href="/admin/help" className="text-xs font-bold flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: "var(--color-admin-primary)" }}>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span> View All
                </Link>
              </div>
              <div className="divide-y max-h-[340px] overflow-y-auto custom-scrollbar" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                {recentTickets.length === 0 ? (
                  <div className="p-8 text-center text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                    No tickets found.
                  </div>
                ) : recentTickets.map((t: any) => {
                  const priorityColor = t.priority === "P1" ? "var(--color-admin-error)" : t.priority === "P2" ? "var(--color-admin-tertiary)" : t.priority === "P3" ? "var(--color-admin-primary)" : "var(--color-admin-outline)";
                  const isResolved = t.status === "resolved";
                  return (
                    <div key={t.id} onClick={() => { setSelectedTicket(t); setTicketResolutionNote(t.reason || ""); }} className={`p-4 flex items-center gap-4 transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${isResolved ? 'opacity-50 line-through' : ''}`}>
                      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: priorityColor }}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold" style={{ color: priorityColor }}>{t.ticketId}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${t.status === "resolved" ? 'text-green-400' : t.status === "in_progress" ? 'text-amber-400' : 'text-slate-400'}`} style={{ backgroundColor: "var(--color-admin-surface-container-lowest)" }}>{t.status}</span>
                        </div>
                        <p className="text-sm font-bold truncate mt-0.5" style={{ color: "var(--color-admin-on-surface)" }}>{t.subject}</p>
                        <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                          <span className="material-symbols-outlined text-xs">person</span> {t.userName} &middot; {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded font-bold uppercase shrink-0" style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", color: priorityColor }}>{t.priority}</span>
                    </div>
                  );
                })}
              </div>
              <Link href="/admin/help" className="block w-full text-center py-3 text-xs font-bold border-t transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: "var(--color-admin-primary)", borderColor: "var(--color-admin-outline-variant)" }}>
                GO TO HELP &amp; SUPPORT CENTER
              </Link>
            </div>

            {/* Live Feed Section */}
            <div className="border rounded-xl overflow-hidden" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
              <div className="p-6 border-b flex justify-between items-center" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                <h2 className="text-xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Live Activity Feed</h2>
                <span className="flex items-center gap-2 text-xs" style={{ color: "var(--color-admin-primary)" }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--color-admin-primary)" }}></span>
                  REAL-TIME MONITORING
                </span>
              </div>
              <div className="divide-y max-h-[420px] overflow-y-auto" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                {loading && feed.length === 0 ? (
                  <div className="p-8 text-center text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                    Loading active logs...
                  </div>
                ) : feed.map((item) => (
                  <div key={item.id} className="p-4 flex gap-4 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                    <div className="p-2 rounded h-fit flex-shrink-0" style={{ backgroundColor: item.type === "warning" ? "rgba(239, 68, 68, 0.15)" : item.type === "person_add" ? "rgba(16, 185, 129, 0.15)" : "rgba(195, 192, 255, 0.15)" }}>
                      <span className="material-symbols-outlined text-[20px] block" style={{ color: item.type === "warning" ? "var(--color-admin-error)" : item.type === "person_add" ? "var(--color-admin-primary)" : "var(--color-admin-primary)" }}>
                        {item.icon || "description"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm break-words" style={{ color: "var(--color-admin-on-surface)" }}>{item.message}</p>
                      <p className="text-xs mt-1 truncate" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                        {formatTimeAgo(item.time)} • {item.subtext}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => fetchStats(true)} className="w-full py-4 text-xs font-bold border-t transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ backgroundColor: "var(--color-admin-surface-container)", color: "var(--color-admin-primary)", borderColor: "var(--color-admin-outline-variant)" }}>
                REFRESH LOGS
              </button>
            </div>
          </div>

          {/* Right Column: Distribution & Notifications */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* User Distribution Doughnut */}
            <div className="border rounded-xl p-6" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
              <h2 className="text-xl font-bold mb-6" style={{ color: "var(--color-admin-on-surface)" }}>User Distribution</h2>
              <div className="relative w-48 h-48 mx-auto mb-8 flex items-center justify-center">
                {/* SVG circular track for Doughnut chart */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Premium segment (base track) */}
                  <circle cx="50" cy="50" r="38" stroke="var(--color-admin-secondary-container)" strokeWidth="12" fill="none" />
                  {/* Free Tier segment (foreground track overlay) */}
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="38" 
                    stroke="var(--color-admin-primary)" 
                    strokeWidth="12" 
                    fill="none" 
                    strokeDasharray={`${freePct * 2.38} 238`} 
                    strokeLinecap="round" 
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-3xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>
                    {metrics.totalUsers >= 1000 ? `${(metrics.totalUsers / 1000).toFixed(0)}k` : metrics.totalUsers}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>TOTAL</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--color-admin-primary)" }}></span>
                    <span className="text-sm">Free Tier</span>
                  </div>
                  <span className="text-sm font-bold">{freePct}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--color-admin-secondary-container)" }}></span>
                    <span className="text-sm">Premium</span>
                  </div>
                  <span className="text-sm font-bold">{premiumPct}%</span>
                </div>
              </div>
            </div>

            {/* Notifications Panel */}
            <div className="border rounded-xl overflow-hidden" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
              <div className="p-6 border-b flex justify-between items-center" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                <h2 className="text-xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Notifications</h2>
                {announcements.length > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full font-bold" style={{ backgroundColor: "var(--color-admin-error)", color: "var(--color-admin-on-error)" }}>
                    {announcements.length} NEW
                  </span>
                )}
              </div>
              <div className="p-6 space-y-6 max-h-[380px] overflow-y-auto">
                {announcements.length === 0 ? (
                  <div className="text-center text-xs p-4" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                    No pending system notifications.
                  </div>
                ) : announcements.map((item) => (
                  <div key={item.id} className="relative pl-6 border-l-2 group" style={{ borderColor: item.priority === "critical" ? "var(--color-admin-error)" : item.priority === "warning" ? "var(--color-admin-primary)" : "var(--color-admin-outline)" }}>
                    <button 
                      onClick={() => handleDismissAlert(item.id)}
                      className="absolute right-0 top-0 hidden group-hover:block hover:bg-black/5 dark:hover:bg-white/5 rounded p-0.5"
                      title="Dismiss"
                    >
                      <span className="material-symbols-outlined text-[16px] block" style={{ color: "var(--color-admin-on-surface-variant)" }}>close</span>
                    </button>
                    <p className="text-sm font-bold truncate pr-6" style={{ color: item.priority === "critical" || item.priority === "warning" ? "var(--color-admin-primary)" : "var(--color-admin-on-surface)" }}>
                      {item.title}
                    </p>
                    <p className="text-sm break-words mt-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                      {item.content}
                    </p>
                    <span className="text-xs mt-2 block" style={{ color: "var(--color-admin-outline)" }}>
                      {formatTimeAgo(item.startsAt)}
                    </span>
                  </div>
                ))}
              </div>
              {announcements.length > 0 && (
                <button 
                  onClick={handleDismissAll} 
                  className="block w-full text-center py-4 text-sm font-bold border-t transition-colors hover:bg-black/5 dark:hover:bg-white/5" 
                  style={{ color: "var(--color-admin-on-surface-variant)", borderColor: "var(--color-admin-outline-variant)" }}
                >
                  DISMISS ALL
                </button>
              )}
            </div>

            {/* System Health Status */}
            <div className="border rounded-xl p-6" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
              <h3 className="text-xs mb-4 uppercase tracking-widest" style={{ color: "var(--color-admin-on-surface-variant)" }}>Global Status</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded border" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                  <p className="text-xs truncate" style={{ color: "var(--color-admin-on-surface-variant)" }}>Core API</p>
                  <p className="text-sm font-bold flex items-center gap-1" style={{ color: systemStatus.dbStatus === 'healthy' ? "var(--color-admin-primary)" : "var(--color-admin-error)" }}>
                    <span className="material-symbols-outlined text-[14px] flex-shrink-0">
                      {systemStatus.dbStatus === 'healthy' ? 'check_circle' : 'cancel'}
                    </span>
                    {systemStatus.dbStatus === 'healthy' ? 'Healthy' : 'Offline'}
                  </p>
                </div>
                <div className="p-3 rounded border" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                  <p className="text-xs truncate" style={{ color: "var(--color-admin-on-surface-variant)" }}>LaTeX Engine</p>
                  <p className="text-sm font-bold flex items-center gap-1" style={{ 
                    color: systemStatus.latexStatus === 'online' 
                      ? "var(--color-admin-primary)" 
                      : systemStatus.latexStatus === 'degraded' 
                        ? "var(--color-admin-tertiary)" 
                        : "var(--color-admin-error)" 
                  }}>
                    <span className="material-symbols-outlined text-[14px] flex-shrink-0">
                      {systemStatus.latexStatus === 'online' 
                        ? 'check_circle' 
                        : systemStatus.latexStatus === 'degraded' 
                          ? 'warning' 
                          : 'cancel'}
                    </span>
                    {systemStatus.latexStatus === 'online' 
                      ? 'Online' 
                      : systemStatus.latexStatus === 'degraded' 
                        ? 'Cloud-Only' 
                        : 'Offline'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Right-side Persistent Shell (Global Context & Checklist) */}
      <aside className="fixed right-0 top-0 h-screen w-80 border-l hidden 2xl:flex flex-col z-50 transition-colors duration-500" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
        <div className="p-6 border-b" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
          <h2 className="text-xl font-bold" style={{ color: "var(--color-admin-primary)" }}>Global Context</h2>
          <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>Latexify Management Suite</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div>
            <h3 className="text-sm mb-4 font-semibold" style={{ color: "var(--color-admin-on-surface)" }}>Traffic Density</h3>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 12 }).map((_, i) => {
                const value = trafficDensity[i] || 0;
                const opacity = Math.min(0.9, Math.max(0.2, value / 10));
                
                // Multicolor mapping based on traffic level
                let bgColor = "var(--color-admin-surface-container-high)";
                let textColor = "var(--color-admin-on-surface-variant)";
                let borderStyle = "1px solid var(--color-admin-outline-variant)";
                
                if (value > 0) {
                  borderStyle = "none";
                  if (value <= 2) {
                    bgColor = `rgba(16, 185, 129, ${opacity})`; // Green (Low)
                    textColor = opacity > 0.5 ? "#ffffff" : "var(--color-admin-on-surface)";
                  } else if (value <= 5) {
                    bgColor = `rgba(245, 158, 11, ${opacity})`; // Amber (Moderate)
                    textColor = "#ffffff";
                  } else if (value <= 9) {
                    bgColor = `rgba(249, 115, 22, ${opacity})`; // Orange (High)
                    textColor = "#ffffff";
                  } else {
                    bgColor = `rgba(244, 63, 94, ${opacity})`; // Rose (Critical)
                    textColor = "#ffffff";
                  }
                }
                
                return (
                  <div 
                    key={i} 
                    className="h-8 rounded-sm transition-all duration-300 flex items-center justify-center text-[10px] font-bold shadow-sm" 
                    style={{ 
                      backgroundColor: bgColor,
                      color: textColor,
                      border: borderStyle
                    }}
                    title={`${value} actions in this hour`}
                  >
                    {value > 0 ? value : ""}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-sm border-b pb-2 font-semibold" style={{ color: "var(--color-admin-on-surface)", borderColor: "var(--color-admin-outline-variant)" }}>Admin Tasks</h3>
            
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                value={newTaskLabel}
                onChange={(e) => setNewTaskLabel(e.target.value)}
                placeholder="New task..."
                className="flex-1 text-xs p-2 border rounded outline-none"
                style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
              />
              <button 
                type="submit" 
                className="px-3 py-1 text-xs rounded font-bold" 
                style={{ backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary)" }}
              >
                +
              </button>
            </form>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {tasks.map(t => (
                <div 
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-xl border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)" }}
                >
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input 
                      checked={t.completed} 
                      onChange={() => handleToggleTask(t.id)}
                      className="rounded focus:ring-1 cursor-pointer accent-indigo-500" 
                      style={{ backgroundColor: "var(--color-admin-background)", borderColor: "var(--color-admin-outline-variant)" }} 
                      type="checkbox" 
                    />
                    <span className={`text-sm select-none truncate ${t.completed ? "line-through" : ""}`} style={t.completed ? { color: "var(--color-admin-on-surface-variant)" } : { color: "var(--color-admin-on-surface)" }}>
                      {t.label}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(t.id)}
                    className="material-symbols-outlined text-[16px] hover:text-red-500 transition-colors ml-2 cursor-pointer"
                    style={{ color: "var(--color-admin-on-surface-variant)" }}
                  >
                    delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Broadcast Drawer */}
        <div className="p-6 mt-auto border-t" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(195,192,255,0.8)]" style={{ backgroundColor: "var(--color-admin-primary)" }}></div>
            <p className="text-xs font-bold">SYSTEM BROADCAST ACTIVE</p>
          </div>
          
          <form onSubmit={handlePostAlert} className="space-y-3">
            <input 
              value={alertTitle}
              onChange={(e) => setAlertTitle(e.target.value)}
              placeholder="Alert Title..."
              required
              className="w-full text-xs p-2 border rounded outline-none focus:ring-1 focus:ring-primary"
              style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
            />
            <textarea 
              value={alertContent}
              onChange={(e) => setAlertContent(e.target.value)}
              placeholder="Alert content details..."
              rows={2}
              required
              className="w-full text-xs p-2 border rounded outline-none resize-none focus:ring-1 focus:ring-primary"
              style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
            />
            <div className="flex gap-2 justify-between items-center">
              <span className="text-[10px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>Priority:</span>
              <select 
                value={alertPriority}
                onChange={(e: any) => setAlertPriority(e.target.value)}
                className="text-[10px] p-1 border rounded"
                style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <button 
              type="submit"
              disabled={postingAlert}
              className="w-full py-2 rounded-lg font-bold text-xs transition-all hover:brightness-110 active:scale-95 disabled:opacity-50" 
              style={{ backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary)" }}
            >
              {postingAlert ? "BROADCASTING..." : "POST ALERT"}
            </button>
          </form>
        </div>
      </aside>

      {/* Ticket List Filter Modal */}
      {ticketListFilter && !selectedTicket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setTicketListFilter(null)}>
          <div className="border p-6 rounded-2xl max-w-3xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
               style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-primary)" }}
               onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                <span className="material-symbols-outlined">
                  {ticketListFilter === "resolved" ? "check_circle" : ticketListFilter === "in_progress" ? "autorenew" : ticketListFilter === "archived" ? "archive" : ticketListFilter === "pending" ? "pending_actions" : "support"}
                </span>
                {ticketListFilter === "all" ? "All Support Tickets" : ticketListFilter === "in_progress" ? "In Progress Tickets" : ticketListFilter === "archived" ? "Archived Tickets" : ticketListFilter === "pending" ? "Pending Tickets" : "Resolved Tickets"}
                <span className="text-sm font-mono ml-2 opacity-60">({filteredTickets.length})</span>
              </h3>
              <button onClick={() => setTicketListFilter(null)} className="material-symbols-outlined opacity-75 hover:opacity-100 transition-opacity">close</button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scroll">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-12 text-xs opacity-50" style={{ color: "var(--color-admin-on-surface-variant)" }}>No tickets found.</div>
              ) : filteredTickets.map((t: any) => {
                const pColor = t.priority === "P1" ? "var(--color-admin-error)" : t.priority === "P2" ? "var(--color-admin-tertiary)" : t.priority === "P3" ? "var(--color-admin-primary)" : "var(--color-admin-outline)";
                return (
                  <div key={t.id} onClick={() => { setSelectedTicket(t); setTicketResolutionNote(t.reason || ""); }}
                    className="flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-95"
                    style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                    <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: pColor }}></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold" style={{ color: pColor }}>{t.ticketId}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ backgroundColor: "var(--color-admin-surface-container-high)", color: pColor }}>{t.priority}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${t.status === "resolved" ? "text-green-400" : t.status === "in_progress" ? "text-amber-400" : "text-slate-400"}`} style={{ backgroundColor: "var(--color-admin-surface-container-high)" }}>{t.status}</span>
                      </div>
                      <p className="text-sm font-bold truncate" style={{ color: "var(--color-admin-on-surface)" }}>{t.subject}</p>
                      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                        <span className="material-symbols-outlined text-xs">person</span> {t.userName} &middot; {new Date(t.createdAt).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <span className="material-symbols-outlined opacity-40">chevron_right</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
              <Link href="/admin/help" className="text-xs font-bold hover:opacity-80 transition-opacity" style={{ color: "var(--color-admin-primary)" }}>
                Open Full Help &amp; Support Center &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTicket(null)}>
          <div className="border p-8 rounded-2xl max-w-2xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
               style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-primary)" }}
               onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                <span className="material-symbols-outlined">support</span> Ticket Details ({selectedTicket.ticketId})
              </h3>
              <button onClick={() => setSelectedTicket(null)} className="material-symbols-outlined opacity-75 hover:opacity-100 transition-opacity">close</button>
            </div>
            <div className="space-y-6">
              <div className="flex justify-between text-xs border-b pb-3" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                <div>
                  <span className="opacity-60 font-bold uppercase tracking-wider">Date &amp; Time Raised:</span>
                  <p className="font-mono mt-1 font-bold">{new Date(selectedTicket.createdAt).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <span className="opacity-60 font-bold uppercase tracking-wider">Current Status:</span>
                  <p className="capitalize mt-1 font-black text-amber-400">{selectedTicket.status}</p>
                </div>
              </div>

              {(selectedTicket.location || selectedTicket.ipAddress) && (
                <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                  <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Location &amp; Device</span>
                  <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                    {selectedTicket.location && (
                      <div>
                        <span className="opacity-70">Location:</span>
                        <p className="font-bold mt-0.5">{selectedTicket.location}
                          {selectedTicket.country && <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-black" style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)" }}>{selectedTicket.country}</span>}
                        </p>
                      </div>
                    )}
                    {selectedTicket.ipAddress && (
                      <div>
                        <span className="opacity-70">IP Address:</span>
                        <p className="font-mono font-bold mt-0.5">{selectedTicket.ipAddress}</p>
                      </div>
                    )}
                    {selectedTicket.userAgent && (
                      <div className="col-span-2">
                        <span className="opacity-70">User Agent:</span>
                        <p className="font-mono text-[10px] mt-0.5 truncate">{selectedTicket.userAgent}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Customer Profile</span>
                {selectedTicket.customerDetails ? (
                  <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                    <div>
                      <span className="opacity-70">Customer ID:</span>
                      <p className="font-mono font-bold truncate mt-0.5">{selectedTicket.customerDetails.customerId}</p>
                    </div>
                    <div>
                      <span className="opacity-70">Email:</span>
                      <p className="font-bold truncate mt-0.5 text-primary">{selectedTicket.customerDetails.email || selectedTicket.userEmail}</p>
                    </div>
                    <div>
                      <span className="opacity-70">Membership Tier:</span>
                      <p className="font-bold uppercase mt-0.5 text-primary">{selectedTicket.customerDetails.membership.replace("_", " ")}</p>
                    </div>
                    <div>
                      <span className="opacity-70">Points Balance:</span>
                      <p className="font-bold mt-0.5 text-amber-500">{selectedTicket.customerDetails.points} Pts</p>
                    </div>
                    <div>
                      <span className="opacity-70">Projects:</span>
                      <p className="font-bold mt-0.5">{selectedTicket.customerDetails.projectCount} Projects</p>
                    </div>
                    <div className="col-span-2">
                      <span className="opacity-70">Account Status:</span>
                      <p className="font-bold mt-0.5 capitalize text-emerald-400">{selectedTicket.customerDetails.status}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs opacity-75">
                    <p>Sender: <strong>{selectedTicket.userName}</strong> ({selectedTicket.userEmail})</p>
                    <p className="text-[10px] mt-1 italic text-slate-400">No registered account linked.</p>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Subject</span>
                <h4 className="text-base font-black mt-1" style={{ color: "var(--color-admin-on-surface)" }}>{selectedTicket.subject}</h4>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Description</span>
                <p className="text-sm p-4 rounded-xl border mt-1 whitespace-pre-wrap leading-relaxed"
                   style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                  {selectedTicket.description}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 opacity-80">Resolution Reason / Notes</label>
                <textarea rows={3} value={ticketResolutionNote} onChange={e => setTicketResolutionNote(e.target.value)}
                  placeholder="Write diagnostic steps or notes..."
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                  style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                />
              </div>

              {/* Status & Priority Actions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-2 opacity-80">Update Status</label>
                  <select
                    value={selectedTicket.status}
                    onChange={e => handleTicketUpdate(selectedTicket.id, e.target.value, selectedTicket.priority)}
                    disabled={ticketUpdating}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                    style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                  >
                    <option value="open">Open (Unresolved)</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved (Closed)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2 opacity-80">Re-assign Priority</label>
                  <select
                    value={selectedTicket.priority}
                    onChange={e => handleTicketUpdate(selectedTicket.id, selectedTicket.status, e.target.value)}
                    disabled={ticketUpdating}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                    style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                  >
                    <option value="P1">P1 Priority (Urgent)</option>
                    <option value="P2">P2 Priority (High)</option>
                    <option value="P3">P3 Priority (Medium)</option>
                    <option value="P4">P4 Priority (Low)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                <button onClick={() => handleTicketUpdate(selectedTicket.id, "resolved", selectedTicket.priority)} disabled={ticketUpdating} className="px-6 py-3 rounded-xl font-bold text-sm bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50">
                  {ticketUpdating ? "Updating..." : "Resolve Ticket"}
                </button>
                <button onClick={() => handleTicketUpdate(selectedTicket.id, selectedTicket.status, selectedTicket.priority)} disabled={ticketUpdating} className="px-6 py-3 rounded-xl font-bold text-sm border hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                  {ticketUpdating ? "Saving..." : "Save Notes"}
                </button>
                <button onClick={() => { setSelectedTicket(null); setTicketResolutionNote(""); }} disabled={ticketUpdating} className="ml-auto px-6 py-3 rounded-xl font-bold text-sm border hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Sessions Modal */}
      {showActiveSessionsModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowActiveSessionsModal(false)}
        >
          <div 
            className="border p-6 md:p-8 rounded-[28px] max-w-5xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
            style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-primary)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl" style={{ color: "var(--color-admin-primary)" }}>devices</span>
                <h3 className="text-lg font-black uppercase tracking-wider dark:text-white text-slate-900">
                  Active User Sessions Insight
                </h3>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  {activeSessions.length} Active
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={fetchActiveSessions} 
                  disabled={loadingSessions}
                  className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 disabled:opacity-50 transition-all flex items-center justify-center"
                  title="Refresh active sessions"
                >
                  <span className={`material-symbols-outlined ${loadingSessions ? "animate-spin" : ""}`}>refresh</span>
                </button>
                <button 
                  onClick={() => setShowActiveSessionsModal(false)} 
                  className="material-symbols-outlined p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 opacity-75 hover:opacity-100 transition-opacity"
                >
                  close
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-admin-surface-container-low)" }}>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">User Info</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">IP Address</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Location</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Device / Machine ID</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Session Started</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                  {loadingSessions ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-sm font-semibold opacity-60">
                        Loading active sessions...
                      </td>
                    </tr>
                  ) : sessionsError ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-admin-error)' }}>{sessionsError}</p>
                        <p className="text-xs mt-1 opacity-60">Try refreshing or check admin authentication.</p>
                      </td>
                    </tr>
                  ) : (
                    activeSessions.map((session) => (
                      <tr 
                        key={session.id} 
                        className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        style={{ backgroundColor: "var(--color-admin-surface-container-lowest)" }}
                      >
                        <td className="p-4">
                          <div className="font-bold text-sm" style={{ color: "var(--color-admin-on-surface)" }}>
                            {session.name}
                          </div>
                          <div className="text-xs font-semibold opacity-60">
                            @{session.username} &middot; {session.email}
                          </div>
                        </td>
                        <td className="p-4 text-xs font-mono font-bold" style={{ color: "var(--color-admin-primary)" }}>
                          {session.ip}
                        </td>
                        <td className="p-4 text-xs font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                          {session.location}
                        </td>
                        <td className="p-4 text-xs font-mono opacity-80 max-w-[120px] truncate" title={session.machineId}>
                          {session.machineId}
                        </td>
                        <td className="p-4 text-xs font-semibold opacity-85">
                          {new Date(session.sessionStartTime).toLocaleString('en-IN')}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleTerminateSession(session.id)}
                            disabled={terminatingSessionId === session.id}
                            className="px-3.5 py-1.5 rounded-full text-xs font-bold border border-red-500/30 text-red-500 hover:bg-red-500/10 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {terminatingSessionId === session.id ? "Kicking..." : "Kick Device"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowActiveSessionsModal(false)}
                className="px-6 py-2.5 rounded-full text-xs font-bold border hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
              >
                Close Insight
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Insight Modal */}
      {showInsightModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowInsightModal(false)}
        >
          <div 
            className="border p-6 md:p-8 rounded-[28px] max-w-5xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
            style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-primary)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl" style={{ color: "var(--color-admin-primary)" }}>analytics</span>
                <h3 className="text-lg font-black uppercase tracking-wider dark:text-white text-slate-900">
                  {insightTitle}
                </h3>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  {insightData.length} Records
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fetchInsightData(insightType || "", insightTitle)} 
                  disabled={loadingInsight}
                  className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 disabled:opacity-50 transition-all flex items-center justify-center"
                  title="Refresh detailed insight"
                >
                  <span className={`material-symbols-outlined ${loadingInsight ? "animate-spin" : ""}`}>refresh</span>
                </button>
                <button 
                  onClick={() => setShowInsightModal(false)} 
                  className="material-symbols-outlined p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 opacity-75 hover:opacity-100 transition-opacity"
                >
                  close
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-admin-surface-container-low)" }}>
                    {insightType?.startsWith("tickets") ? (
                      <>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Ticket ID & Subject</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Customer Details</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Priority</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Status</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Created At</th>
                      </>
                    ) : insightType === "totalRevenue" ? (
                      <>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Customer Details</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Transaction Type</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Amount</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Date</th>
                      </>
                    ) : insightType === "aiUsage" ? (
                      <>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">User Details</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">AI Agent / Feature</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Model Used</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Tokens Spent</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Date</th>
                      </>
                    ) : insightType === "blacklisted" ? (
                      <>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">User Details</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Reason</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Blocked Until</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Date Blacklisted</th>
                      </>
                    ) : (
                      <>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">User Info</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">IP Address</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Location</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Machine ID</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Membership</th>
                        <th className="p-4 text-xs font-bold uppercase tracking-wider opacity-85">Joined Date</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                  {loadingInsight ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-sm font-semibold opacity-60">
                        Loading detailed insight records...
                      </td>
                    </tr>
                  ) : insightError ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center">
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-admin-error)' }}>{insightError}</p>
                        <p className="text-xs mt-1 opacity-60">Try refreshing or check server logs.</p>
                      </td>
                    </tr>
                  ) : insightData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-sm font-semibold opacity-60">
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    insightData.map((item) => (
                      <tr 
                        key={item.id} 
                        className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-slate-800 dark:text-slate-200"
                        style={{ backgroundColor: "var(--color-admin-surface-container-lowest)" }}
                      >
                        {insightType?.startsWith("tickets") ? (
                          <>
                            <td className="p-4 font-bold text-sm">
                              <span className="font-mono text-slate-500 mr-2">{item.ticketId}</span>
                              {item.subject}
                            </td>
                            <td className="p-4 text-xs">
                              <div className="font-semibold">{item.userName}</div>
                              <div className="opacity-60">{item.userEmail}</div>
                            </td>
                            <td className="p-4 text-xs">
                              <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800">
                                {item.priority}
                              </span>
                            </td>
                            <td className="p-4 text-xs">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-white ${
                                item.status === "resolved" ? "bg-emerald-500" : item.status === "in_progress" ? "bg-amber-500" : "bg-red-500"
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="p-4 text-xs font-semibold opacity-75">
                              {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : "N/A"}
                            </td>
                          </>
                        ) : insightType === "totalRevenue" ? (
                          <>
                            <td className="p-4 text-xs">
                              <div className="font-bold">{item.name}</div>
                              <div className="opacity-60">{item.email}</div>
                            </td>
                            <td className="p-4 text-xs font-bold" style={{ color: "var(--color-admin-primary)" }}>
                              {item.type}
                            </td>
                            <td className="p-4 text-xs font-black">
                              {fmtRevenue(item.amount)}
                            </td>
                            <td className="p-4 text-xs font-semibold opacity-75">
                              {item.date ? new Date(item.date).toLocaleString('en-IN') : "N/A"}
                            </td>
                          </>
                        ) : insightType === "aiUsage" ? (
                          <>
                            <td className="p-4 text-xs">
                              <div className="font-bold">{item.name}</div>
                              <div className="opacity-60">{item.email}</div>
                            </td>
                            <td className="p-4 text-xs">
                              <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-850">
                                {item.agent}
                              </span>
                            </td>
                            <td className="p-4 text-xs font-mono">
                              {item.model}
                            </td>
                            <td className="p-4 text-xs font-black" style={{ color: "var(--color-admin-tertiary)" }}>
                              {item.totalTokens.toLocaleString()}
                            </td>
                            <td className="p-4 text-xs font-semibold opacity-75">
                              {item.date ? new Date(item.date).toLocaleString('en-IN') : "N/A"}
                            </td>
                          </>
                        ) : insightType === "blacklisted" ? (
                          <>
                            <td className="p-4 text-xs">
                              <div className="font-bold">{item.name}</div>
                              <div className="opacity-60">{item.email}</div>
                            </td>
                            <td className="p-4 text-xs font-medium text-red-500">
                              {item.blacklistReason}
                            </td>
                            <td className="p-4 text-xs font-bold">
                              {item.blockedUntil ? new Date(item.blockedUntil).toLocaleString('en-IN') : "Indefinitely"}
                            </td>
                            <td className="p-4 text-xs font-semibold opacity-75">
                              {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : "N/A"}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-4">
                              <div className="font-bold text-sm">
                                {item.name}
                              </div>
                              <div className="text-xs font-mono font-bold opacity-40">
                                {item.id}
                              </div>
                              <div className="text-xs font-semibold opacity-60">
                                {item.email}
                              </div>
                            </td>
                            <td className="p-4 text-xs font-mono font-bold" style={{ color: "var(--color-admin-primary)" }}>
                              {item.ipAddress}
                            </td>
                            <td className="p-4 text-xs font-semibold">
                              {item.location}
                            </td>
                            <td className="p-4 text-xs font-mono opacity-85 max-w-[120px] truncate" title={item.machineId}>
                              {item.machineId}
                            </td>
                            <td className="p-4 text-xs font-bold">
                              <span className={`px-2 py-0.5 rounded-full text-white text-[10px] ${
                                item.status === "blacklisted" ? "bg-red-500" : item.status === "abnormal" ? "bg-amber-500" : "bg-emerald-500"
                              } mr-1`}>
                                {item.status}
                              </span>
                              <span className="font-mono text-slate-500">({item.membership})</span>
                            </td>
                            <td className="p-4 text-xs font-semibold opacity-75">
                              {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : "N/A"}
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInsightModal(false)}
                className="px-6 py-2.5 rounded-full text-xs font-bold border hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
              >
                Close Insight
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
