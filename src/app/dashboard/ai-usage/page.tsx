'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from "@/lib/pb-auth-react";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Zap, Clock, Target, Activity, ArrowLeft, RefreshCw,
  Cpu, TrendingUp, AlertTriangle, CheckCircle2, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { createPb } from '@/lib/pb';
import Sidebar from '@/components/Sidebar';
import ProLoader from "@/components/ProLoader";

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
const AGENT_LABELS: Record<string, string> = {
  chat: 'Chat Assistant',
  'ai-reviewer': 'AI Reviewer',
  'ai-fix': 'AI Fix',
  extract: 'Extract',
  diagram: 'Diagram Generator',
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

interface CapStatus {
  isCapped: boolean;
  dailyCap: number;
  usedToday: number;
  remaining: number;
  reactivatesAt: string | null;
  planName: string;
  agentBreakdown: Record<string, number>;
}

interface HistoryDay {
  date: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  requestCount: number;
  agentBreakdown: Record<string, number>;
}

export default function AiUsagePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [capStatus, setCapStatus] = useState<CapStatus | null>(null);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [plan, setPlan] = useState<{ name: string; dailyTokenCap: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/user/ai-cap/status');
      if (res.ok) {
        const data = await res.json();
        setCapStatus(data);
      }
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/ai-cap/history?days=${days}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
        setPlan(data.plan || null);
      }
    } catch {}
  }, [days]);

  // Track mounted state for cleanup
  const mountedRef = useRef(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') {
      setLoading(true);
      Promise.all([fetchStatus(), fetchHistory()]).then(() => setLoading(false));
    }
  }, [status, fetchStatus, fetchHistory, router]);

  useEffect(() => {
    if (status === 'authenticated') fetchHistory();
  }, [days, status, fetchHistory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStatus(), fetchHistory()]);
    setRefreshing(false);
  };

  // Real-time PB subscription + auto-poll every 15s
  useEffect(() => {
    if (status !== 'authenticated') return;

    const refreshAll = () => {
      fetchStatus();
      fetchHistory();
    };

    // Auto-poll every 15s
    const pollInterval = setInterval(refreshAll, 15000);

    // PocketBase real-time subscription
    let unsubSummaries: (() => void) | null = null;
    let unsubUsers: (() => void) | null = null;

    try {
      const pb = createPb();
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;
      if (token) pb.authStore.save(token, null);

      const triggerRefresh = () => {
        if (mountedRef.current) refreshAll();
      };

      pb.collection('ai_usage_daily_summaries').subscribe('*', triggerRefresh).then(u => { unsubSummaries = u; }).catch(() => {});
      pb.collection('users').subscribe('*', triggerRefresh).then(u => { unsubUsers = u; }).catch(() => {});
    } catch {}

    return () => {
      mountedRef.current = false;
      clearInterval(pollInterval);
      if (unsubSummaries) try { unsubSummaries(); } catch {}
      if (unsubUsers) try { unsubUsers(); } catch {}
    };
  }, [status, fetchStatus, fetchHistory]);

  if (status === 'loading' || loading) {
    return <ProLoader />;
  }

  if (!session) {
    router.replace("/register");
    return <ProLoader />;
  }

  const dailyCap = capStatus?.dailyCap || 0;
  const usedToday = capStatus?.usedToday || 0;
  const percentUsed = dailyCap > 0 ? Math.min(Math.round((usedToday / dailyCap) * 100), 100) : 0;
  const isCapped = capStatus?.isCapped || false;
  const remaining = capStatus?.remaining || 0;

  // Prepare chart data
  const chartData = [...history].reverse().map(h => ({ date: h.date.slice(5), tokens: h.totalTokens }));
  const agentBreakdown = capStatus?.agentBreakdown || {};
  const agentChart = Object.entries(agentBreakdown).map(([agent, tokens], i) => ({
    agent,
    tokens,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  // 30-day totals
  const total30d = history.reduce((sum, h) => sum + h.totalTokens, 0);
  const avgDaily = history.length > 0 ? Math.round(total30d / history.length) : 0;
  const totalRequests = history.reduce((sum, h) => sum + h.requestCount, 0);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--strict-bg)', color: 'var(--strict-text)' }}>
      <Sidebar />
      <div className="ml-64">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b px-8 py-4 flex items-center justify-between"
          style={{ backgroundColor: 'var(--strict-bg)', borderColor: 'var(--strict-border)' }}>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: 'var(--strict-text)' }}>
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--strict-text)' }}>AI Usage & Caps</h1>
              <p className="text-xs" style={{ color: 'var(--accent-secondary)' }}>
                Monitor your AI token consumption and limits
              </p>
            </div>
          </div>
          <button onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold hover:opacity-80 transition-all"
            style={{ borderColor: 'var(--strict-border)', color: 'var(--strict-text)' }}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </header>

        <div className="p-8 space-y-8">
          {/* Status Banner */}
          {isCapped && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border p-4 flex items-center gap-4"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <AlertTriangle size={24} style={{ color: '#ef4444' }} />
              <div>
                <p className="text-sm font-bold" style={{ color: '#ef4444' }}>Daily AI Cap Reached</p>
                <p className="text-xs" style={{ color: 'var(--accent-secondary)' }}>
                  You've used all {formatTokens(dailyCap)} tokens for today.
                  {capStatus?.reactivatesAt && (
                    <> Access reactivates on {new Date(capStatus.reactivatesAt).toLocaleString()}.</>
                  )}
                </p>
              </div>
            </motion.div>
          )}

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Plan', value: capStatus?.planName || 'None', icon: <Target size={18} />, color: '#6366f1' },
              { label: "Today's Usage", value: `${formatTokens(usedToday)} / ${formatTokens(dailyCap)}`, icon: <Zap size={18} />, color: percentUsed >= 80 ? '#ef4444' : '#f59e0b' },
              { label: 'Remaining', value: formatTokens(remaining), icon: <Activity size={18} />, color: '#10b981' },
              { label: '30-Day Average', value: `${formatTokens(avgDaily)}/day`, icon: <TrendingUp size={18} />, color: '#8b5cf6' },
            ].map((card, i) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="border rounded-xl p-4 transition-all hover:scale-[1.01]"
                style={{ borderColor: `${card.color}25`, backgroundColor: `${card.color}06` }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${card.color}15`, color: card.color }}>
                    {card.icon}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--accent-secondary)' }}>{card.label}</span>
                </div>
                <p className="text-lg font-bold" style={{ color: card.color }}>{card.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Usage Bar */}
          <div className="border rounded-xl p-5"
            style={{ borderColor: 'var(--strict-border)', backgroundColor: 'var(--strict-bg)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold" style={{ color: 'var(--strict-text)' }}>Daily Cap Progress</h3>
              <span className="text-xs font-semibold" style={{
                color: percentUsed >= 95 ? '#ef4444' : percentUsed >= 80 ? '#f59e0b' : '#10b981'
              }}>{percentUsed}%</span>
            </div>
            <div className="h-4 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${percentUsed}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{
                  backgroundColor: percentUsed >= 95 ? '#ef4444' : percentUsed >= 80 ? '#f59e0b' : '#10b981'
                }} />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px]" style={{ color: 'var(--accent-secondary)' }}>{formatTokens(usedToday)} used</span>
              <span className="text-[10px]" style={{ color: 'var(--accent-secondary)' }}>{formatTokens(remaining)} remaining</span>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Usage Trend */}
            <div className="border rounded-xl p-5"
              style={{ borderColor: 'var(--strict-border)', backgroundColor: 'var(--strict-bg)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--strict-text)' }}>
                  <BarChart3 size={16} style={{ color: 'var(--accent-primary)' }} />
                  Token Usage Trend
                </h3>
                <select value={days} onChange={e => setDays(Number(e.target.value))}
                  className="border rounded-lg px-2 py-1 text-xs font-semibold outline-none"
                  style={{ borderColor: 'var(--strict-border)', backgroundColor: 'var(--strict-bg)', color: 'var(--strict-text)' }}>
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--strict-border)" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--accent-secondary)' }} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--accent-secondary)' }} tickFormatter={formatTokens} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--strict-bg)',
                        border: '1px solid var(--strict-border)',
                        borderRadius: 8, fontSize: 11, color: 'var(--strict-text)',
                      }}
                      formatter={(value) => [formatTokens(Number(value)), 'Tokens']}
                    />
                    <Line type="monotone" dataKey="tokens" stroke="var(--accent-primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[240px]">
                  <p className="text-xs" style={{ color: 'var(--accent-secondary)' }}>No usage data yet</p>
                </div>
              )}
            </div>

            {/* Agent Breakdown */}
            <div className="border rounded-xl p-5"
              style={{ borderColor: 'var(--strict-border)', backgroundColor: 'var(--strict-bg)' }}>
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--strict-text)' }}>
                <PieChartIcon size={16} style={{ color: 'var(--accent-primary)' }} />
                Usage by Agent (Today)
              </h3>
              {agentChart.length > 0 ? (
                <div className="flex items-center">
                  <ResponsiveContainer width="55%" height={220}>
                    <PieChart>
                      <Pie data={agentChart} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                        dataKey="tokens" nameKey="agent" paddingAngle={2}>
                        {agentChart.map((entry, idx) => (
                          <Cell key={entry.agent} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--strict-bg)',
                          border: '1px solid var(--strict-border)',
                          borderRadius: 8, fontSize: 11, color: 'var(--strict-text)',
                        }}
                        formatter={(value, name) => [formatTokens(Number(value)), AGENT_LABELS[String(name)] || name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 w-[45%]">
                    {agentChart.map((entry) => (
                      <div key={entry.agent} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: entry.color }}></div>
                        <span className="text-[11px] font-medium truncate" style={{ color: 'var(--strict-text)' }}>
                          {AGENT_LABELS[entry.agent] || entry.agent}
                        </span>
                        <span className="text-[10px] ml-auto" style={{ color: 'var(--accent-secondary)' }}>
                          {formatTokens(entry.tokens)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[220px]">
                  <p className="text-xs" style={{ color: 'var(--accent-secondary)' }}>No agent data yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Daily History Table */}
          <div className="border rounded-xl overflow-hidden"
            style={{ borderColor: 'var(--strict-border)' }}>
            <div className="p-4 border-b flex items-center gap-2"
              style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderColor: 'var(--strict-border)' }}>
              <Clock size={16} style={{ color: 'var(--accent-primary)' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--strict-text)' }}>Daily History</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2"
                style={{ backgroundColor: 'var(--accent-primary)', color: '#fff' }}>
                {history.length} days
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
                    <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-secondary)' }}>Date</th>
                    <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-secondary)' }}>Total Tokens</th>
                    <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-secondary)' }}>Prompt</th>
                    <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-secondary)' }}>Completion</th>
                    <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-secondary)' }}>Requests</th>
                    <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-secondary)' }}>Cap %</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs" style={{ color: 'var(--accent-secondary)' }}>
                        No usage history yet. Start using AI features to see your data here.
                      </td>
                    </tr>
                  ) : (
                    history.map((h) => {
                      const pct = dailyCap > 0 ? Math.round((h.totalTokens / dailyCap) * 100) : 0;
                      return (
                        <tr key={h.date} className="border-t hover:bg-black/[.02] dark:hover:bg-white/[.02] transition-colors"
                          style={{ borderColor: 'var(--strict-border)' }}>
                          <td className="p-3 text-xs font-semibold" style={{ color: 'var(--strict-text)' }}>
                            {new Date(h.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="p-3 text-xs font-bold" style={{ color: 'var(--strict-text)' }}>{formatTokens(h.totalTokens)}</td>
                          <td className="p-3 text-xs" style={{ color: 'var(--accent-secondary)' }}>{formatTokens(h.promptTokens)}</td>
                          <td className="p-3 text-xs" style={{ color: 'var(--accent-secondary)' }}>{formatTokens(h.completionTokens)}</td>
                          <td className="p-3 text-xs font-medium" style={{ color: 'var(--strict-text)' }}>{h.requestCount}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
                                <div className="h-full rounded-full" style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: pct >= 95 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981'
                                }}></div>
                              </div>
                              <span className="text-[10px] font-bold" style={{
                                color: pct >= 95 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981'
                              }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Stats */}
          {history.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-xl p-4"
                style={{ borderColor: 'var(--strict-border)', backgroundColor: 'var(--strict-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Cpu size={14} style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-secondary)' }}>Total Tokens ({days}d)</span>
                </div>
                <p className="text-xl font-bold" style={{ color: 'var(--strict-text)' }}>{formatTokens(total30d)}</p>
              </div>
              <div className="border rounded-xl p-4"
                style={{ borderColor: 'var(--strict-border)', backgroundColor: 'var(--strict-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={14} style={{ color: 'var(--accent-primary)' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-secondary)' }}>Total Requests ({days}d)</span>
                </div>
                <p className="text-xl font-bold" style={{ color: 'var(--strict-text)' }}>{totalRequests.toLocaleString()}</p>
              </div>
              <div className="border rounded-xl p-4"
                style={{ borderColor: 'var(--strict-border)', backgroundColor: 'var(--strict-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-secondary)' }}>Cap Status</span>
                </div>
                <p className="text-xl font-bold" style={{ color: isCapped ? '#ef4444' : '#10b981' }}>
                  {isCapped ? 'Capped' : 'Active'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
