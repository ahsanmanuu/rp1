"use client";
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { createPb } from '@/lib/pb';
import { Theme, themes, getAccentColor } from "@/components/AdminThemeStyles";

const ALL_THEMES: Theme[] = ['indigo', 'emerald', 'rose', 'violet', 'amber', 'cyan', 'sky', 'pink', 'orange', 'lime', 'teal', 'fuchsia', 'red', 'yellow', 'stone', 'zinc'];

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

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#84cc16'];

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

export default function AdminAiAnalysisPage() {
  const [currentTheme, setCurrentTheme] = useState<Theme>('indigo');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState<string>("Admin Root");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCurrency, setActiveCurrency] = useState<string>('INR');
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({});
  const [chartKey, setChartKey] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<string>('chat');

  const fmtCurrency = (inrAmount: number): string => {
    const cur = CURRENCIES[activeCurrency] ?? CURRENCIES['INR'];
    const rate = currencyRates[activeCurrency] ?? cur.rate;
    const converted = inrAmount * rate;
    const decimals = ['JPY', 'INR'].includes(activeCurrency) ? 0 : 2;
    return `${cur.symbol}${converted.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  const fmtNum = (n: number) => n.toLocaleString('en-IN');

  const fetchStats = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch("/api/admin/ai-analysis");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setError(null);
        setChartKey(k => k + 1);
      } else {
        setError(data.error || "Failed to load AI stats");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load AI stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('latexify-admin-theme') as Theme | null;
    const savedMode = localStorage.getItem('latexify-admin-mode');
    const savedCurrency = localStorage.getItem('latexify-admin-currency');
    if (savedTheme) setCurrentTheme(savedTheme);
    if (savedMode) setIsDarkMode(savedMode === 'dark');
    const storedName = localStorage.getItem('latexify-admin-name');
    if (storedName) setAdminName(storedName);
    setActiveCurrency(savedCurrency || detectCurrency());

    const fetchRates = async () => {
      try {
        const res = await fetch("/api/currency/rates");
        if (res.ok) {
          const data = await res.json();
          if (data && data.rates) setCurrencyRates(data.rates);
        }
      } catch {}
    };
    fetchRates();
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    localStorage.setItem('latexify-admin-theme', currentTheme);
    localStorage.setItem('latexify-admin-mode', isDarkMode ? 'dark' : 'light');
    window.dispatchEvent(new Event('admin-theme-changed'));
  }, [currentTheme, isDarkMode]);

  // ── PB Realtime Subscriptions ──
  useEffect(() => {
    const pb = createPb();
    const unsubFns: (() => void)[] = [];
    const setup = async () => {
      try {
        const unsub1 = await pb.collection('ai_usage_logs').subscribe('*', () => { fetchStats(true); });
        unsubFns.push(unsub1);
      } catch {}
      try {
        const unsub2 = await pb.collection('membership_transactions').subscribe('*', () => { fetchStats(true); });
        unsubFns.push(unsub2);
      } catch {}
      try {
        const unsub3 = await pb.collection('users').subscribe('*', () => { fetchStats(true); });
        unsubFns.push(unsub3);
      } catch {}
    };
    setup();
    return () => { for (const fn of unsubFns) { try { fn(); } catch {} } };
  }, [fetchStats]);

  // ── Auto-refresh every 15s ──
  useEffect(() => {
    const timer = setInterval(() => fetchStats(true), 15000);
    return () => clearInterval(timer);
  }, [fetchStats]);

  const revenue = stats?.totalRevenue || 0;
  const cost = stats?.infrastructureCost || 0;
  const marginPercent = stats?.netMargin ?? (revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0);

  const chartTextColor = isDarkMode ? '#94a3b8' : '#475569';
  const chartGridColor = isDarkMode ? '#1e293b' : '#e2e8f0';
  const chartTooltipBg = isDarkMode ? '#1e293b' : '#ffffff';
  const chartTooltipBorder = isDarkMode ? '#334155' : '#cbd5e1';

  return (
    <div className={`transition-colors duration-500`} style={{ backgroundColor: 'var(--color-admin-background)', color: 'var(--color-admin-on-background)' }}>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-admin-outline-variant); border-radius: 4px; }
      `}</style>

      {/* Sidebar */}
      <aside className="flex flex-col p-4 gap-2 fixed h-screen w-64 left-0 top-0 border-r z-50" style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
        <div className="flex flex-col items-center gap-1 px-2 mb-6 mt-2 text-center">
          <Image src="/logo.png" alt="Latexify Logo" width={0} height={0} sizes="100%" className="w-48 h-12 object-contain" style={{ filter: isDarkMode ? 'brightness(0) invert(1)' : 'none' }} />
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-85 mt-1" style={{ color: 'var(--color-admin-primary)' }}>Admin Console</p>
        </div>
        <nav className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">dashboard</span>Dashboard
          </Link>
          <Link href="/admin/billings" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">payments</span>Bill and Payments
          </Link>
          <Link href="/admin/users" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">group</span>Users
          </Link>
          <Link href="/admin/profile" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">settings</span>Profile and Plan Setting
          </Link>
          <Link href="/admin/ai-caps" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">speed</span>AI Usage & Caps Rules
          </Link>
          <a className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all translate-x-1 duration-200 shadow-sm" style={{ backgroundColor: 'var(--color-admin-secondary-container)', color: 'var(--color-admin-on-secondary-container)' }} href="#">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>AI Analysis
          </a>
          <Link href="/admin/anomalies" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">warning</span>Anomaly Center
          </Link>
          <Link href="/admin/help" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">help</span>Help and Support
          </Link>
          <Link href="/admin/offers" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">local_offer</span>Offers
          </Link>
          <Link href="/admin/emails" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">mail</span>Email History
          </Link>
          <Link href="/admin/social-media" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">share</span>Social Media
          </Link>
          <Link href="/admin/tax-calculation" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">calculate</span>Tax Calculation
          </Link>
          <div className="border-t my-2" style={{ borderColor: 'var(--color-admin-outline-variant)' }}></div>
          <a href="/pb/_/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-primary)' }}>
            <span className="material-symbols-outlined">database</span>PB Dashboard
          </a>
        </nav>
        <div className="mt-auto p-4 rounded-xl border text-sm" style={{ backgroundColor: 'var(--color-admin-surface-container-low)', borderColor: 'var(--color-admin-outline-variant)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-admin-primary)' }}></div>
            <span style={{ color: 'var(--color-admin-primary)' }}>System Online</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Version 4.2.0-stable</p>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-0 lg:ml-64 flex flex-col min-h-screen">
        <header className="flex justify-between items-center w-full px-8 py-4 border-b z-40 sticky top-0" style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)" }}>
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-xl font-bold" style={{ color: "var(--color-admin-primary)" }}>AI Performance Intelligence</h2>
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
                    <div className="flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                    {(Object.keys(themes) as Theme[]).map(t => (
                      <button key={t} onClick={() => { setCurrentTheme(t); setIsThemeMenuOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: "var(--color-admin-on-surface)" }}>
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getAccentColor(t, isDarkMode) }}></div>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                        {currentTheme === t && <span className="material-symbols-outlined ml-auto text-[18px]">check</span>}
                      </button>
                    ))}
                    </div>
                    <div className="h-px w-full my-1" style={{ backgroundColor: "var(--color-admin-outline-variant)" }}></div>
                    <div className="px-3 py-2 text-xs font-semibold tracking-wider uppercase opacity-70" style={{ color: "var(--color-admin-on-surface-variant)" }}>Mode</div>
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: "var(--color-admin-on-surface)" }}>
                      <span className="material-symbols-outlined text-[18px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                      {isDarkMode ? 'Light Mode' : 'Dark Mode'}
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

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-40 gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-indigo-500/10 border-t-indigo-500 animate-spin" style={{ borderTopColor: "var(--color-admin-primary)" }}></div>
            <span className="text-xs font-bold uppercase tracking-wider opacity-60 font-mono" style={{ color: "var(--color-admin-on-surface-variant)" }}>Loading Intelligence...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-40 text-red-500 gap-2">
            <span className="material-symbols-outlined text-4xl">error</span>
            <span>{error}</span>
          </div>
        ) : (
          <div className="flex-1 p-8 max-w-[1440px] mx-auto w-full">
            <div className="mb-8 flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold mb-1" style={{ color: "var(--color-admin-on-surface)" }}>AI Performance Intelligence</h2>
                <p style={{ color: "var(--color-admin-on-surface-variant)" }}>Deep analysis of token consumption, cost-revenue parity, and power users.</p>
              </div>
              <button onClick={() => fetchStats()} disabled={loading} className="px-4 py-2 border rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-semibold flex items-center gap-2 disabled:opacity-50" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
                {loading ? 'Refreshing...' : 'Refresh Analytics'}
              </button>
            </div>

            {/* ───── SUMMARY CARDS ───── */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
              <div className="col-span-3 p-5 rounded-xl border" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Total Revenue</p>
                <p className="text-2xl font-bold" style={{ color: "var(--color-admin-primary)" }}>{fmtCurrency(revenue)}</p>
              </div>
              <div className="col-span-3 p-5 rounded-xl border" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Infrastructure Cost</p>
                <p className="text-2xl font-bold" style={{ color: "var(--color-admin-error)" }}>{fmtCurrency(cost)}</p>
              </div>
              <div className="col-span-3 p-5 rounded-xl border" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Net Margin</p>
                <p className="text-2xl font-bold" style={{ color: marginPercent >= 50 ? "#10b981" : marginPercent >= 20 ? "#f59e0b" : "#ef4444" }}>{marginPercent.toFixed(1)}%</p>
              </div>
              <div className="col-span-3 p-5 rounded-xl border" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Total Tokens</p>
                <p className="text-2xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>{fmtNum(stats?.totalTokensUsed || 0)}</p>
              </div>
            </div>

            {/* ───── BENTO GRID ───── */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* Fiscal Efficiency ── 7 cols */}
              <div className="col-span-7 border rounded-xl p-6" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                    Fiscal Efficiency Analysis
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)" }}>
                    Real-time margins
                  </span>
                </div>
                <div className="h-64" key={chartKey}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.revenueTrend?.slice(-14) || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: chartTextColor }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: chartTextColor }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                        formatter={(value: any) => [fmtCurrency(Number(value)), undefined]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="revenue" name="Revenue" fill="var(--color-admin-primary)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cost" name="Infra Cost" fill="var(--color-admin-error)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs mt-3 opacity-75 font-mono" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                  *Infrastructure costs estimated at $10.00 per million total tokens consumed.
                </p>
              </div>

              {/* Retention Predictor ── 5 cols */}
              <div className="col-span-5 border rounded-xl p-6 flex flex-col" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-admin-primary)" }}>Retention Predictor</h3>
                <div className="flex items-center gap-6 mb-4">
                  <div className="relative w-28 h-28 shrink-0">
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="56" cy="56" fill="transparent" r="50" stroke="var(--color-admin-surface-container-highest)" strokeWidth="10" />
                      <circle cx="56" cy="56" fill="transparent" r="50"
                        stroke={stats?.retentionScore >= 80 ? '#10b981' : stats?.retentionScore >= 50 ? '#f59e0b' : '#ef4444'}
                        strokeDasharray={314.16}
                        strokeDashoffset={314.16 - (314.16 * (stats?.retentionScore || 100) / 100)}
                        strokeWidth="10"
                        style={{ strokeLinecap: 'round', transition: 'stroke-dashoffset 1s ease' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>{stats?.retentionScore || 100}%</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 text-sm">
                    <div className="flex justify-between"><span style={{ color: "var(--color-admin-on-surface-variant)" }}>Retention Health</span><span className="font-semibold" style={{ color: stats?.retentionScore >= 80 ? '#10b981' : '#f59e0b' }}>{stats?.retentionScore >= 80 ? 'Good' : stats?.retentionScore >= 50 ? 'Fair' : 'At Risk'}</span></div>
                    <div className="flex justify-between"><span style={{ color: "var(--color-admin-on-surface-variant)" }}>Registered</span><span className="font-semibold" style={{ color: "var(--color-admin-on-surface)" }}>{fmtNum(stats?.totalUsers || 0)}</span></div>
                    <div className="flex justify-between"><span style={{ color: "var(--color-admin-on-surface-variant)" }}>Active (30d)</span><span className="font-semibold" style={{ color: "#10b981" }}>{fmtNum(stats?.activeUsers30d || 0)}</span></div>
                    <div className="flex justify-between"><span style={{ color: "var(--color-admin-on-surface-variant)" }}>Churned (30d)</span><span className="font-semibold" style={{ color: "#ef4444" }}>{fmtNum(stats?.churnedUsers30d || 0)}</span></div>
                    <div className="flex justify-between"><span style={{ color: "var(--color-admin-on-surface-variant)" }}>New (30d)</span><span className="font-semibold" style={{ color: "#6366f1" }}>{fmtNum(stats?.newUsers30d || 0)}</span></div>
                  </div>
                </div>
                <div className="h-32 mt-auto" key={chartKey + 1}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats?.retentionTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: chartTextColor }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: chartTextColor }} />
                      <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="score" name="Retention %" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Daily Token Trend ── 6 cols */}
              <div className="col-span-6 border rounded-xl p-6" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-admin-primary)" }}>Daily Token Consumption</h3>
                <div className="h-56" key={chartKey + 2}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.tokenTrend30d || []}>
                      <defs>
                        <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-admin-primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-admin-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: chartTextColor }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 9, fill: chartTextColor }} />
                      <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="totalTokens" name="Tokens" stroke="var(--color-admin-primary)" fill="url(#tokenGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Token by Agent ── 6 cols */}
              <div className="col-span-6 border rounded-xl p-6" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-admin-primary)" }}>Token Consumption by Agent</h3>
                <div className="flex items-center h-56 gap-4" key={chartKey + 3}>
                  <div className="w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats?.tokenByAgent || []} dataKey="tokens" nameKey="agent" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                          {(stats?.tokenByAgent || []).map((_: any, i: number) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-1.5 text-xs">
                    {(stats?.tokenByAgent || []).map((a: any, i: number) => (
                      <div key={a.agent} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="truncate" style={{ color: "var(--color-admin-on-surface-variant)" }}>{a.agent}</span>
                        <span className="ml-auto font-semibold" style={{ color: "var(--color-admin-on-surface)" }}>{fmtNum(a.tokens)}</span>
                      </div>
                    ))}
                    {(!stats?.tokenByAgent || stats.tokenByAgent.length === 0) && (
                      <p style={{ color: "var(--color-admin-on-surface-variant)" }}>No usage data yet.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Studio Token Consumption by Scholar ── 12 cols (full width) */}
              <div className="col-span-12 border rounded-xl p-6" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                    <span className="material-symbols-outlined">account_tree</span>
                    AI Studio Consumption by Scholar
                  </h3>
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                    {Object.keys(stats?.agentUsageByUser || {}).map((agent) => (
                      <button
                        key={agent}
                        onClick={() => setSelectedAgent(agent)}
                        className={`px-3 py-1 rounded-full font-semibold transition-all ${
                          selectedAgent === agent
                            ? 'text-white shadow-sm'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: selectedAgent === agent
                            ? (agent === 'chat' ? '#6366f1' : agent === 'reviewer' ? '#10b981' : agent === 'diagram' ? '#f59e0b' : agent === 'extract' ? '#8b5cf6' : agent === 'ai-fix' ? '#ec4899' : '#06b6d4')
                            : 'var(--color-admin-surface-container-highest)',
                          color: selectedAgent === agent ? '#fff' : 'var(--color-admin-on-surface-variant)',
                        }}
                      >
                        {stats?.AGENT_LABELS?.[agent] || agent}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedAgent && (
                  <div>
                    <div className="flex items-center gap-3 mb-3 text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                      <span>{(stats?.agentUsageByUser?.[selectedAgent] || []).length} scholars</span>
                      <span className="font-mono font-bold" style={{ color: "var(--color-admin-primary)" }}>
                        {fmtNum(stats?.agentTotals?.[selectedAgent] || 0)} tokens total
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface-variant)" }}>
                            <th className="text-left py-2 pr-2">Scholar</th>
                            <th className="text-right py-2 pr-2">Requests</th>
                            <th className="text-right py-2 pr-2">Total Tokens</th>
                            <th className="text-right py-2 pr-2">Prompt</th>
                            <th className="text-right py-2 pr-2">Completion</th>
                            <th className="text-right py-2">Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(stats?.agentUsageByUser?.[selectedAgent] || []).map((u: any, i: number) => (
                            <tr key={u.userId} className="border-b transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                              <td className="py-3 pr-2">
                                <p className="font-semibold truncate max-w-[140px]" style={{ color: "var(--color-admin-on-surface)" }}>{u.name}</p>
                                <p className="text-xs truncate max-w-[140px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>{u.email}</p>
                              </td>
                              <td className="py-3 pr-2 text-right font-mono text-xs" style={{ color: "var(--color-admin-on-surface)" }}>{fmtNum(u.requestCount)}</td>
                              <td className="py-3 pr-2 text-right font-mono text-xs" style={{ color: "var(--color-admin-on-surface)" }}>{fmtNum(u.totalTokens)}</td>
                              <td className="py-3 pr-2 text-right font-mono text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>{fmtNum(u.promptTokens)}</td>
                              <td className="py-3 pr-2 text-right font-mono text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>{fmtNum(u.completionTokens)}</td>
                              <td className="py-3 text-right">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-admin-surface-container-highest)" }}>
                                    <div className="h-full rounded-full" style={{ width: `${u.share}%`, backgroundColor: u.share > 50 ? "#8b5cf6" : u.share > 20 ? "#6366f1" : "#94a3b8" }} />
                                  </div>
                                  <span className="text-[10px] font-mono w-10 text-right" style={{ color: "var(--color-admin-on-surface-variant)" }}>{u.share}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {(!stats?.agentUsageByUser?.[selectedAgent] || stats.agentUsageByUser[selectedAgent].length === 0) && (
                            <tr><td colSpan={6} className="py-8 text-center text-sm" style={{ color: "var(--color-admin-on-surface-variant)" }}>No usage data for this studio yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {!selectedAgent && (
                  <div className="py-8 text-center text-sm" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                    Select a studio tab above to view token consumption by scholar.
                  </div>
                )}
              </div>

              {/* Power User Trends ── 7 cols */}
              <div className="col-span-7 border rounded-xl p-6" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold" style={{ color: "var(--color-admin-primary)" }}>Power User Trends</h3>
                  <span className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>Top {stats?.powerUsers?.length || 0} consumers</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface-variant)" }}>
                        <th className="text-left py-2 pr-2">#</th>
                        <th className="text-left py-2 pr-2">Scholar</th>
                        <th className="text-left py-2 pr-2">Plan</th>
                        <th className="text-right py-2 pr-2">Tokens</th>
                        <th className="text-right py-2 pr-2">Requests</th>
                        <th className="text-right py-2">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats?.powerUsers || []).map((u: any, i: number) => (
                        <tr key={u.id} className="border-b transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                          <td className="py-3 pr-2 font-bold text-xs" style={{ color: "var(--color-admin-outline)" }}>{i + 1}</td>
                          <td className="py-3 pr-2">
                            <p className="font-semibold truncate max-w-[140px]" style={{ color: "var(--color-admin-on-surface)" }}>{u.name}</p>
                            <p className="text-xs truncate max-w-[140px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>{u.email}</p>
                          </td>
                          <td className="py-3 pr-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)" }}>
                              {u.plan}
                            </span>
                          </td>
                          <td className="py-3 pr-2 text-right font-mono text-xs" style={{ color: "var(--color-admin-on-surface)" }}>{fmtNum(u.totalTokens)}</td>
                          <td className="py-3 pr-2 text-right font-mono text-xs" style={{ color: "var(--color-admin-on-surface)" }}>{fmtNum(u.requestCount)}</td>
                          <td className="py-3 text-right text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                            {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                      {(!stats?.powerUsers || stats.powerUsers.length === 0) && (
                        <tr><td colSpan={6} className="py-8 text-center text-sm" style={{ color: "var(--color-admin-on-surface-variant)" }}>No AI usage logged yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Anomaly Detection ── 5 cols */}
              <div className="col-span-5 border rounded-xl p-6" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--color-admin-error)" }}>
                    <span className="material-symbols-outlined">warning</span>
                    Anomaly Detection
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--color-admin-error-container)", color: "var(--color-admin-on-error)" }}>
                    {stats?.anomalies?.length || 0} alerts
                  </span>
                </div>
                <div className="rounded-lg p-3 h-64 overflow-y-auto border font-mono text-xs leading-relaxed custom-scrollbar" style={{ backgroundColor: "#000000", borderColor: "rgba(145, 143, 161, 0.3)", color: "#4ade80" }}>
                  {(stats?.anomalies || []).length === 0 && (
                    <div>
                      <span style={{ color: "#94a3b8" }}>[{new Date().toLocaleTimeString()}]</span>
                      <span style={{ color: "#4ade80" }}> OK:</span> No anomalies detected.
                    </div>
                  )}
                  {(stats?.anomalies || []).slice(0, 20).map((a: any, i: number) => {
                    const sevColor = a.severity === 'high' ? '#ef4444' : a.severity === 'medium' ? '#f59e0b' : '#94a3b8';
                    return (
                      <div key={i} className="mb-1.5">
                        <span style={{ color: "#64748b" }}>[{new Date(a.timestamp).toLocaleTimeString()}]</span>
                        <span style={{ color: sevColor }}> {a.severity.toUpperCase()}: </span>
                        <span style={{ color: "#e2e8f0" }}>{a.title}</span>
                        <span style={{ color: "#94a3b8" }}> — {a.description}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => fetchStats()} className="flex-1 py-2 border text-xs font-mono rounded-lg hover:opacity-80 transition-all" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                    Refresh System Audit
                  </button>
                </div>
              </div>

              {/* Daily Active Users ── 6 cols */}
              <div className="col-span-6 border rounded-xl p-6" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-admin-primary)" }}>Daily Active Users</h3>
                <div className="h-48" key={chartKey + 4}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.dailyActiveUsers || []}>
                      <defs>
                        <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: chartTextColor }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 9, fill: chartTextColor }} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: chartTooltipBg, border: `1px solid ${chartTooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="count" name="Active Users" stroke="#10b981" fill="url(#dauGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Model Breakdown ── 6 cols */}
              <div className="col-span-6 border rounded-xl p-6" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-admin-primary)" }}>Model Usage Distribution</h3>
                <div className="space-y-2">
                  {(stats?.tokenByModel || []).map((m: any, i: number) => {
                    const total = (stats?.tokenByModel || []).reduce((s: number, x: any) => s + x.tokens, 0);
                    const pct = total > 0 ? ((m.tokens / total) * 100).toFixed(1) : '0';
                    return (
                      <div key={m.model} className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs w-36 truncate" style={{ color: "var(--color-admin-on-surface)" }}>{m.model}</span>
                        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-admin-surface-container-highest)" }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-xs font-mono w-20 text-right" style={{ color: "var(--color-admin-on-surface-variant)" }}>{fmtNum(m.tokens)}</span>
                        <span className="text-xs w-12 text-right" style={{ color: "var(--color-admin-outline)" }}>{pct}%</span>
                      </div>
                    );
                  })}
                  {(!stats?.tokenByModel || stats.tokenByModel.length === 0) && (
                    <p className="text-sm py-6 text-center" style={{ color: "var(--color-admin-on-surface-variant)" }}>No model usage data yet.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        <footer className="p-6 border-t flex justify-between items-center" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface-variant)" }}>
          <p className="text-xs font-mono">© 2026 Latexify Engine. Systems operational. Active sessions: {stats?.activeSessions || '—'}</p>
        </footer>
      </main>
    </div>
  );
}
