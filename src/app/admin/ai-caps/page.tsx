'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { createPb } from '@/lib/pb';
import { useAdminRealtime } from '@/hooks/useAdminRealtime';
import {
  Shield, Users, Zap, AlertTriangle, BarChart3, Settings, Plus, Search,
  RefreshCw, X, Check, TrendingUp, Clock,
  Activity, Cpu, Loader2, Eye,
  Layers, Target, UserCheck, Ban, Edit3, Save, Trash2,
  ToggleLeft, ToggleRight, Calendar, PieChart as PieChartIcon,
  BarChart as BarChartIcon, LineChart as LineChartIcon,
  Globe, Mail, Network, BugPlay, ArrowUp, ArrowDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Theme, themes, getAccentColor } from "@/components/AdminThemeStyles";

const ALL_THEMES: Theme[] = ['indigo', 'emerald', 'rose', 'violet', 'amber', 'cyan', 'sky', 'pink', 'orange', 'lime', 'teal', 'fuchsia', 'red', 'yellow', 'stone', 'zinc'];

// ── Types ────────────────────────────────────────────────────────────────────
interface CapPlan {
  planId: string;
  name: string;
  dailyTokenCap: number;
  userCount: number;
  isActive: boolean;
  color: string;
  createdAt?: string;
}

interface CapRule {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  matchType: string;
  matchValue: string;
  capType: string;
  capValue: number;
  agentFilter: string | null;
  priority: number;
  createdBy: string | null;
  hitCount: number;
  lastHitAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  all_users: 'All Users',
  email_exact: 'Email (Exact)',
  email_domain: 'Email (Domain)',
  email_regex: 'Email (Regex)',
  ip_exact: 'IP (Exact)',
  ip_cidr: 'IP (CIDR)',
  location_country: 'Location (Country)',
  location_city: 'Location (City)',
};

const MATCH_TYPE_ICONS: Record<string, React.ReactNode> = {
  all_users: <Users size={14} />,
  email_exact: <Mail size={14} />,
  email_domain: <Mail size={14} />,
  email_regex: <Mail size={14} />,
  ip_exact: <Network size={14} />,
  ip_cidr: <Network size={14} />,
  location_country: <Globe size={14} />,
  location_city: <Globe size={14} />,
};

const CAP_TYPE_COLORS: Record<string, string> = {
  daily_tokens: '#6366f1',
  daily_requests: '#f59e0b',
  block: '#ef4444',
};

const CAP_TYPE_LABELS: Record<string, string> = {
  daily_tokens: 'Daily Token Cap',
  daily_requests: 'Daily Request Cap',
  block: 'Block Access',
};

const DEFAULT_RULE = {
  name: '',
  description: '',
  matchType: 'email_domain',
  matchValue: '',
  capType: 'daily_tokens',
  capValue: 50000,
  agentFilter: '*',
  priority: 100,
  isActive: true,
};


interface DashboardStats {
  totalCapped: number;
  totalUncapped: number;
  todayTokensUsed: number;
  approachingCap: number;
  dailyUsage: { date: string; tokens: number }[];
  agentBreakdown: { agent: string; tokens: number; color: string }[];
  topUsers: { userId: string; name: string; tokensUsed: number; plan: string }[];
  capUtilization: { userId: string; name: string; usage: number; cap: number; percentage: number }[];
}

interface UserUsage {
  userId: string;
  name: string;
  email: string;
  assignedPlan: string;
  customCap: number | null;
  todayTokens: number;
  status: 'active' | 'capped' | 'approaching';
  lastActive?: string;
}

interface UserHistory {
  userId: string;
  name: string;
  email: string;
  plan: string;
  dailyCap: number;
  customCap: number | null;
  dailyHistory: { date: string; tokens: number }[];
  agentBreakdown: { agent: string; tokens: number; percentage: number }[];
  totalTokens30d: number;
  averageDaily: number;
  reactivationDate?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
const AGENT_LABELS: Record<string, string> = {
  chat: 'Chat Assistant',
  'ai-reviewer': 'AI Reviewer',
  'ai-fix': 'AI Fix',
  extract: 'Extract',
  diagram: 'Diagram Generator'
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getStatusColor(status: string): string {
  if (status === 'capped') return 'var(--color-admin-error)';
  if (status === 'approaching') return '#f59e0b';
  return '#10b981';
}

function getStatusBg(status: string): string {
  if (status === 'capped') return 'rgba(239,68,68,0.12)';
  if (status === 'approaching') return 'rgba(245,158,11,0.12)';
  return 'rgba(16,185,129,0.12)';
}

function getCardColor(color: string, isDark: boolean): string {
  if (isDark) return color;
  if (color === '#6366f1') return '#4338ca'; // Indigo 700
  if (color === '#10b981') return '#047857'; // Emerald 700
  if (color === '#f59e0b') return '#b45309'; // Amber 700
  if (color === '#ef4444') return '#b91c1c'; // Red 700
  return color;
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AdminAiCapsPage() {
  // ── Theme State ──
  const [currentTheme, setCurrentTheme] = useState<Theme>('indigo');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState<string>('Admin Root');

  // ── Tab State ──
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rules'>('dashboard');

  // ── Cap Rules State ──
  const [rules, setRules] = useState<CapRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesSearchQuery, setRulesSearchQuery] = useState('');
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [newRule, setNewRule] = useState({ ...DEFAULT_RULE });
  const [editRuleId, setEditRuleId] = useState<string | null>(null);
  const [editRuleData, setEditRuleData] = useState<Partial<CapRule>>({});
  const [editingPriority, setEditingPriority] = useState<string | null>(null);
  const [priorityValue, setPriorityValue] = useState(0);
  const [testEmail, setTestEmail] = useState('');
  const [testIp, setTestIp] = useState('');
  const [testLocation, setTestLocation] = useState('');
  const [testCountry, setTestCountry] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);

  // ── Dashboard State ──
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [plans, setPlans] = useState<CapPlan[]>([]);
  const [users, setUsers] = useState<UserUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── UI State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkPlan, setBulkPlan] = useState('');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [editPlanData, setEditPlanData] = useState<Partial<CapPlan>>({});
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlanData, setNewPlanData] = useState({ name: '', dailyTokenCap: 50000 });
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ── User Detail Modal State ──
  const [detailUser, setDetailUser] = useState<UserHistory | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [_detailUserId, setDetailUserId] = useState<string | null>(null);
  const [customCapOverride, setCustomCapOverride] = useState('');
  const [reactivationDate, setReactivationDate] = useState('');

  // ── Quick Cap State ──
  const [quickCapLoading, setQuickCapLoading] = useState(false);
  const [quickCapType, setQuickCapType] = useState<'block' | 'daily_tokens' | 'daily_requests'>('block');
  const [quickCapValue, setQuickCapValue] = useState(5000);

  // ── Card Drill-Down Modal State ──
  const [cardModalType, setCardModalType] = useState<'capped' | 'uncapped' | 'approaching' | 'top-users' | null>(null);
  const [cardModalUsers, setCardModalUsers] = useState<any[]>([]);
  const [cardModalTotal, setCardModalTotal] = useState(0);
  const [cardModalLoading, setCardModalLoading] = useState(false);
  const [cardModalPage, setCardModalPage] = useState(1);
  const [cardModalSearch, setCardModalSearch] = useState('');
  const [cardModalError, setCardModalError] = useState<string | null>(null);
  const cardSearchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // ── Theme Effect ──
  useEffect(() => {
    const savedTheme = localStorage.getItem('latexify-admin-theme') as Theme | null;
    const savedMode = localStorage.getItem('latexify-admin-mode');
    if (savedTheme) setCurrentTheme(savedTheme);
    if (savedMode) setIsDarkMode(savedMode === 'dark');
    const storedName = localStorage.getItem('latexify-admin-name');
    if (storedName) setAdminName(storedName);
  }, []);

  useEffect(() => {
    localStorage.setItem('latexify-admin-theme', currentTheme);
    localStorage.setItem('latexify-admin-mode', isDarkMode ? 'dark' : 'light');
    window.dispatchEvent(new Event('admin-theme-changed'));
  }, [currentTheme, isDarkMode]);

  // ── Toast ──
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // ── Data Fetching ──
  const fetchDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/admin/ai-caps/dashboard');
      const data = await res.json();
      if (data.success) {
        const raw = data.stats;
        const agentBreakdownArr = Object.entries(raw.agentBreakdown || {}).map(([agent, tokens]) => ({
          agent,
          tokens: tokens as number,
          color: PIE_COLORS[Object.keys(raw.agentBreakdown || {}).indexOf(agent) % PIE_COLORS.length],
        }));
        const transformed: DashboardStats = {
          totalCapped: raw.usersWithPlan,
          totalUncapped: raw.usersWithoutPlan,
          todayTokensUsed: raw.totalTokensToday,
          approachingCap: raw.approachingCap?.length || 0,
          dailyUsage: (raw.dailyTrend || []).map((d: any) => ({ date: d.date, tokens: d.totalTokens })),
          agentBreakdown: agentBreakdownArr,
          topUsers: (raw.topUsersToday || []).map((u: any) => ({
            userId: u.user?.id || u.userId,
            name: u.user?.name || 'Unknown',
            tokensUsed: u.totalTokens,
            plan: u.user?.aiCapPlanId || 'None',
          })),
          capUtilization: (raw.approachingCap || []).map((u: any) => ({
            userId: u.userId,
            name: u.name,
            usage: u.usedToday,
            cap: u.dailyCap,
            percentage: u.percentUsed,
          })),
        };
        setStats(transformed);
        setError(null);
      } else {
        setError(data.error || 'Failed to load dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai-caps/plans');
      const data = await res.json();
      if (data.success) {
        const mapped: CapPlan[] = (data.plans || []).map((p: any) => ({
          planId: p.id,
          name: p.name,
          dailyTokenCap: p.dailyTokenCap,
          userCount: p._count?.users || 0,
          isActive: p.isActive,
          color: PIE_COLORS[data.plans.indexOf(p) % PIE_COLORS.length],
          createdAt: p.createdAt,
        }));
        setPlans(mapped);
      }
    } catch {
      setError('Failed to load plans');
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai-caps/usage');
      const data = await res.json();
      if (data.success) {
        const mapped: UserUsage[] = (data.users || []).map((s: any) => {
          const u = s.user;
          const dailyCap = u.aiDailyCapOverride || u.aiCapPlan?.dailyTokenCap || 0;
          const pct = dailyCap > 0 ? (s.totalTokens / dailyCap) * 100 : 0;
          let status: 'active' | 'capped' | 'approaching' = 'active';
          if (u.aiAgentReactivatesAt && new Date(u.aiAgentReactivatesAt) > new Date()) status = 'capped';
          else if (pct >= 80) status = 'approaching';
          return {
            userId: u.id,
            name: u.name,
            email: u.email,
            assignedPlan: u.aiCapPlanId || '',
            customCap: u.aiDailyCapOverride,
            todayTokens: s.totalTokens,
            status,
          };
        });
        setUsers(mapped);
      }
    } catch {
      setError('Failed to load users');
    }
  }, []);

  const fetchUserDetail = useCallback(async (userId: string) => {
    setDetailLoading(true);
    setDetailUserId(userId);
    try {
      const res = await fetch(`/api/admin/ai-caps/usage/history?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        const u = data.user;
        const history = data.history || [];
        const dailyCap = u.aiDailyCapOverride || u.aiCapPlan?.dailyTokenCap || 0;

        const mergedAgent: Record<string, number> = {};
        history.forEach((h: any) => {
          try {
            const bd = JSON.parse(h.agentBreakdown || '{}');
            for (const [agent, tokens] of Object.entries(bd)) {
              mergedAgent[agent] = (mergedAgent[agent] || 0) + (tokens as number);
            }
          } catch (e) { /* skip malformed agent breakdown */ }
        });
        const totalTokens30d = history.reduce((sum: number, h: any) => sum + (h.totalTokens || 0), 0);
        const agentBreakdown = Object.entries(mergedAgent).map(([agent, tokens]) => ({
          agent,
          tokens: tokens as number,
          percentage: totalTokens30d > 0 ? ((tokens as number) / totalTokens30d) * 100 : 0,
        }));

        const mapped: UserHistory = {
          userId: u.id,
          name: u.name,
          email: u.email,
          plan: u.aiCapPlan?.name || 'None',
          dailyCap,
          customCap: u.aiDailyCapOverride,
          dailyHistory: history.map((h: any) => ({ date: h.date, tokens: h.totalTokens })).reverse(),
          agentBreakdown,
          totalTokens30d,
          averageDaily: history.length > 0 ? Math.round(totalTokens30d / history.length) : 0,
          reactivationDate: u.aiAgentReactivatesAt || undefined,
        };
        setDetailUser(mapped);
        setCustomCapOverride(mapped.customCap?.toString() || '');
        setReactivationDate(mapped.reactivationDate || '');
      }
    } catch {
      setError('Failed to load user details');
    }
    setDetailLoading(false);
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      setRulesLoading(true);
      const res = await fetch('/api/admin/ai-caps/rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.rules);
        setRulesError(null);
      } else {
        setRulesError(data.error || 'Failed to load rules');
      }
    } catch (err: any) {
      setRulesError(err.message || 'Failed to load rules');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const handleCreateRule = async () => {
    if (!newRule.name.trim() || !newRule.matchValue.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewRuleForm(false);
        setNewRule({ ...DEFAULT_RULE });
        fetchRules();
        setToastMessage('Rule created');
      } else {
        setToastMessage(data.error || 'Failed to create');
      }
    } catch (err: any) {
      setToastMessage(err.message);
    }
    setActionLoading(false);
  };

  const handleSaveRule = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editRuleData }),
      });
      const data = await res.json();
      if (data.success) {
        setEditRuleId(null);
        setEditRuleData({});
        fetchRules();
        setToastMessage('Rule updated');
      } else {
        setToastMessage(data.error || 'Failed to update');
      }
    } catch (err: any) {
      setToastMessage(err.message);
    }
    setActionLoading(false);
  };

  const handleToggleRuleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch('/api/admin/ai-caps/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      fetchRules();
    } catch {
      setToastMessage('Failed to toggle rule');
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    try {
      const res = await fetch(`/api/admin/ai-caps/rules?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchRules();
        setToastMessage('Rule deleted');
      }
    } catch {
      setToastMessage('Failed to delete rule');
    }
  };

  const handlePriorityUpdate = async (id: string, priority: number) => {
    try {
      await fetch('/api/admin/ai-caps/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, priority }),
      });
      setEditingPriority(null);
      fetchRules();
    } catch {
      setToastMessage('Failed to update priority');
    }
  };

  const movePriority = async (id: string, direction: 'up' | 'down') => {
    const idx = rules.findIndex(r => r.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === rules.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const currentPriority = rules[idx].priority;
    const swapPriority = rules[swapIdx].priority;
    await fetch('/api/admin/ai-caps/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rules[idx].id, priority: swapPriority }),
    });
    await fetch('/api/admin/ai-caps/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rules[swapIdx].id, priority: currentPriority }),
    });
    fetchRules();
  };

  const handleTestRule = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/ai-caps/rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail || undefined,
          ipAddress: testIp || undefined,
          location: testLocation || undefined,
          country: testCountry || undefined,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    }
    setTestLoading(false);
  };

  useEffect(() => {
    fetchDashboard();
    fetchPlans();
    fetchUsers();
    fetchRules();
  }, [fetchDashboard, fetchPlans, fetchUsers, fetchRules]);

  // ── Centralized Realtime Sync ──
  useAdminRealtime({
    triggerCollections: ['users', 'aiCapPlans', 'aiCapRules', 'ai_usage_daily_summaries', 'user_ai_caps'],
    onRefresh: useCallback(() => {
      fetchDashboard(true);
      fetchPlans();
      fetchRules();
      fetchUsers();
    }, [fetchDashboard, fetchPlans, fetchRules, fetchUsers]),
    pollIntervalMs: 15000,
    onPoll: useCallback(() => {
      fetchDashboard(true);
      fetchPlans();
      fetchRules();
      fetchUsers();
    }, [fetchDashboard, fetchPlans, fetchRules, fetchUsers]),
  });

  // Cleanup card search timeout on unmount
  useEffect(() => {
    return () => {
      if (cardSearchTimeoutRef.current) clearTimeout(cardSearchTimeoutRef.current);
    };
  }, []);

  // ── Card Drill-Down ──
  const fetchCardDetails = useCallback(async (type: 'capped' | 'uncapped' | 'approaching' | 'top-users', page = 1, search = '') => {
    setCardModalLoading(true);
    setCardModalType(type);
    setCardModalPage(page);
    setCardModalSearch(search);
    setCardModalError(null);
    try {
      const params = new URLSearchParams({ type, page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/ai-caps/card-details?${params}`);
      const data = await res.json();
      if (data.success) {
        setCardModalUsers(data.users || []);
        setCardModalTotal(data.total || 0);
      } else {
        setCardModalError(data.error || 'Failed to load card details');
      }
    } catch {
      setCardModalError('Failed to load card details');
    }
    setCardModalLoading(false);
  }, []);

  // ── Plan Actions ──
  const handleSavePlan = async (planId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: planId, ...editPlanData }),
      });
      const data = await res.json();
      if (data.success) {
        setEditPlanId(null);
        setEditPlanData({});
        fetchPlans();
        setToastMessage('Plan updated successfully');
      } else {
        setToastMessage(data.error || 'Failed to update plan');
      }
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to update plan');
    }
    setActionLoading(false);
  };

  const handleCreatePlan = async () => {
    if (!newPlanData.name.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlanData.name, label: newPlanData.name, dailyTokenCap: newPlanData.dailyTokenCap }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewPlanForm(false);
        setNewPlanData({ name: '', dailyTokenCap: 50000 });
        fetchPlans();
        setToastMessage('Plan created successfully');
      } else {
        setToastMessage(data.error || 'Failed to create plan');
      }
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to create plan');
    }
    setActionLoading(false);
  };

  const handleTogglePlan = async (planId: string, isActive: boolean) => {
    try {
      await fetch('/api/admin/ai-caps/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: planId, isActive: !isActive }),
      });
      fetchPlans();
    } catch {
      setToastMessage('Failed to toggle plan');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan? This will also remove the plan from all assigned users.')) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/plans', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: planId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPlans();
        fetchUsers();
        fetchDashboard();
        setToastMessage('Plan deleted successfully');
      } else {
        setToastMessage(data.error || 'Failed to delete plan');
      }
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to delete plan');
    }
    setActionLoading(false);
  };

  // ── User Assignment ──
  const handleAssignPlan = async (userId: string, planId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, userIds: [userId] }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
        setToastMessage('Plan assigned successfully');
      }
    } catch {
      setToastMessage('Failed to assign plan');
    }
    setActionLoading(false);
  };

  const handleBulkAssign = async () => {
    if (!bulkPlan || selectedUsers.size === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: bulkPlan, userIds: Array.from(selectedUsers) }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedUsers(new Set());
        setBulkPlan('');
        setShowBulkConfirm(false);
        fetchUsers();
        setToastMessage(`Assigned plan to ${selectedUsers.size} users`);
      }
    } catch {
      setToastMessage('Failed to assign plan');
    }
    setActionLoading(false);
  };

  const handleAssignToAll = async () => {
    if (!bulkPlan) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: bulkPlan, assignToAll: true }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedUsers(new Set());
        setBulkPlan('');
        setShowBulkConfirm(false);
        fetchUsers();
        setToastMessage('Assigned plan to all users');
      }
    } catch {
      setToastMessage('Failed to assign plan');
    }
    setActionLoading(false);
  };

  const handleSaveCustomCap = async () => {
    if (!detailUser) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/usage/history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: detailUser.userId,
          customCap: customCapOverride ? parseInt(customCapOverride) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
        fetchUserDetail(detailUser.userId);
        setToastMessage('Custom cap updated');
      }
    } catch {
      setToastMessage('Failed to update custom cap');
    }
    setActionLoading(false);
  };

  const handleSetReactivation = async () => {
    if (!detailUser) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/usage/history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: detailUser.userId,
          reactivationDate: reactivationDate || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUserDetail(detailUser.userId);
        setToastMessage('Reactivation date set');
      }
    } catch {
      setToastMessage('Failed to set reactivation date');
    }
    setActionLoading(false);
  };

  const handleQuickCap = async () => {
    if (!detailUser) return;
    setQuickCapLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/quick-cap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: detailUser.userId,
          email: detailUser.email,
          capType: quickCapType,
          capValue: quickCapType === 'block' ? 7200000 : quickCapValue,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(data.message);
        fetchUserDetail(detailUser.userId);
        fetchUsers();
      } else {
        setToastMessage(data.error || 'Failed to apply cap');
      }
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to apply cap');
    }
    setQuickCapLoading(false);
  };

  const toggleUserSelect = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // ── Filtered Users ──
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.userId.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  // ── Filtered Rules ──
  const filteredRules = useMemo(() => {
    return rules.filter(r =>
      !rulesSearchQuery ||
      r.name.toLowerCase().includes(rulesSearchQuery.toLowerCase()) ||
      (r.description?.toLowerCase() || '').includes(rulesSearchQuery.toLowerCase()) ||
      r.matchValue.toLowerCase().includes(rulesSearchQuery.toLowerCase()) ||
      r.matchType.toLowerCase().includes(rulesSearchQuery.toLowerCase())
    );
  }, [rules, rulesSearchQuery]);

  const matchTypeExamples: Record<string, string> = {
    all_users: 'Matches all users (*)',
    email_exact: 'user@example.com',
    email_domain: '@university.edu',
    email_regex: '.*@(gmail|yahoo)\\.com',
    ip_exact: '192.168.1.100',
    ip_cidr: '10.0.0.0/8',
    location_country: 'US',
    location_city: 'New York',
  };

  const matchTypeTooltip: Record<string, string> = {
    all_users: 'Applies this rule globally to all users',
    email_exact: 'Matches the exact email address',
    email_domain: 'Matches any email ending with @domain',
    email_regex: 'Matches email against a regular expression',
    ip_exact: 'Matches the exact IP address',
    ip_cidr: 'Matches IP within a CIDR range (e.g. 10.0.0.0/8)',
    location_country: 'Matches ISO country code (US, IN, GB, etc.)',
    location_city: 'Matches city name anywhere in the location string',
  };

  // ── Render ──
  return (
    <div
      className="min-h-screen transition-colors duration-500"
      style={{ backgroundColor: 'var(--color-admin-background)', color: 'var(--color-admin-on-background)' }}
    >
      {/* ── Theme CSS Variables (handled by AdminThemeStyles) ── */}

      {/* ── Toast ── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[10000] px-5 py-3 rounded-xl border shadow-xl text-sm font-semibold flex items-center gap-2"
            style={{
              backgroundColor: 'var(--color-admin-surface-container)',
              borderColor: 'var(--color-admin-outline-variant)',
              color: 'var(--color-admin-on-surface)',
            }}
          >
            <Check size={16} style={{ color: '#10b981' }} />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside className="flex flex-col h-full p-4 gap-2 fixed h-screen w-64 left-0 top-0 border-r z-50 transition-colors duration-500"
        style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
        <div className="flex flex-col items-center gap-1 px-2 mb-6 mt-2 text-center">
          <Image src="/logo.png" alt="Latexify Logo" width={192} height={48} unoptimized
            style={{ filter: isDarkMode ? 'brightness(0) invert(1)' : 'none' }} />
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-85 mt-1"
            style={{ color: 'var(--color-admin-primary)' }}>Admin Console</p>
        </div>
        <nav className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">dashboard</span>Dashboard
          </Link>
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
          <a className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all translate-x-1 duration-200 shadow-sm"
            style={{ backgroundColor: 'var(--color-admin-secondary-container)', color: 'var(--color-admin-on-secondary-container)' }} href="#">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>speed</span>AI Usage &amp; Caps Rules
          </a>
          <Link href="/admin/ai-analysis" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">psychology</span>AI Analysis
          </Link>
          <Link href="/admin/help" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">help</span>Help and Support
          </Link>
          <Link href="/admin/offers" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">local_offer</span>Offers
          </Link>
          <Link href="/admin/general-queries" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">forum</span>General Queries
          </Link>
          <Link href="/admin/emails" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">mail</span>Email History
          </Link>
          <Link href="/admin/social-media" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">share</span>Social Media
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

      {/* ── Main Content ── */}
      <main className="ml-0 lg:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="flex justify-between items-center w-full px-8 py-4 border-b z-40 relative"
          style={{ backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-outline-variant)' }}>
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-3xl">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-admin-on-surface-variant)' }}>search</span>
              <input
                value={activeTab === 'dashboard' ? searchQuery : rulesSearchQuery}
                onChange={e => activeTab === 'dashboard' ? setSearchQuery(e.target.value) : setRulesSearchQuery(e.target.value)}
                className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm outline-none"
                style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                placeholder={activeTab === 'dashboard' ? "Search users by name, email, or ID..." : "Search rules by name, type, or value..."}
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-black/5 rounded-full transition-colors"
              style={{ color: 'var(--color-admin-on-surface-variant)' }}>
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="relative">
              <button onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)} aria-label="Change Theme"
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
                style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                <span className="material-symbols-outlined">palette</span>
              </button>
              {isThemeMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border shadow-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-outline-variant)' }}>
                  <div className="p-2 flex flex-col gap-1">
                    <div className="px-3 py-2 text-xs font-semibold tracking-wider uppercase opacity-70"
                      style={{ color: 'var(--color-admin-on-surface-variant)' }}>Accent Color</div>
                    <div className="flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                    {(Object.keys(themes) as Theme[]).map(t => (
                      <button key={t} onClick={() => { setCurrentTheme(t); setIsThemeMenuOpen(false); }}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 w-full text-left"
                        style={{ color: 'var(--color-admin-on-surface)' }}>
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getAccentColor(t, isDarkMode) }}></div>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                        {currentTheme === t && <span className="material-symbols-outlined ml-auto text-[18px]">check</span>}
                      </button>
                    ))}
                    <div className="h-px w-full my-1" style={{ backgroundColor: 'var(--color-admin-outline-variant)' }}></div>
                    <button onClick={() => { setIsDarkMode(!isDarkMode); setIsThemeMenuOpen(false); }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 w-full text-left"
                      style={{ color: 'var(--color-admin-on-surface)' }}>
                      <span className="material-symbols-outlined text-[18px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                      {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="h-8 w-px" style={{ backgroundColor: 'var(--color-admin-outline-variant)' }}></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>{adminName}</p>
                <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Super Admin</p>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                {adminName.split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'AR'}
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-8 overflow-y-auto max-h-[calc(100vh-73px)] custom-scrollbar">
          {/* Title */}
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-admin-on-surface)' }}>AI Usage &amp; Caps Rules</h2>
              <p style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                {activeTab === 'dashboard'
                  ? 'Manage token limits, cap plans, and monitor AI resource consumption across all users.'
                  : 'Create targeted capping rules based on email, IP, or location to control AI resource usage.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {activeTab === 'rules' && (
                <>
                  <button onClick={() => setShowTestPanel(!showTestPanel)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border hover:opacity-80 transition-all"
                    style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                    <BugPlay size={16} /> Test Rules
                  </button>
                  <button onClick={() => setShowNewRuleForm(!showNewRuleForm)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-80 transition-all"
                    style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                    <Plus size={16} /> New Rule
                  </button>
                </>
              )}
              <button onClick={() => {
                if (activeTab === 'dashboard') {
                  fetchDashboard();
                  fetchPlans();
                  fetchUsers();
                } else {
                  fetchRules();
                }
              }}
                className="flex items-center gap-2 border px-4 py-2 rounded-lg hover:opacity-80 transition-all font-semibold"
                style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                <RefreshCw size={18} className={(activeTab === 'dashboard' ? loading : rulesLoading) ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex gap-2 mb-8 border-b" style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2"
              style={{
                borderColor: activeTab === 'dashboard' ? 'var(--color-admin-primary)' : 'transparent',
                color: activeTab === 'dashboard' ? 'var(--color-admin-primary)' : 'var(--color-admin-on-surface-variant)',
              }}
            >
              <Zap size={16} /> Dashboard &amp; Plans
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className="px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2"
              style={{
                borderColor: activeTab === 'rules' ? 'var(--color-admin-primary)' : 'transparent',
                color: activeTab === 'rules' ? 'var(--color-admin-primary)' : 'var(--color-admin-on-surface-variant)',
              }}
            >
              <Shield size={16} /> Targeted Cap Rules
            </button>
          </div>
          {/* Dashboard Tab Content */}
          {activeTab === 'dashboard' && (
            <>
              {/* Loading / Error States */}
          {loading && !stats && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-admin-primary)' }} />
            </div>
          )}
          {error && (
            <div className="rounded-xl border p-6 mb-8" style={{ backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} style={{ color: 'var(--color-admin-error)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--color-admin-error)' }}>{error}</p>
              </div>
            </div>
          )}

          {/* ── Section 1: Dashboard Stats Cards ── */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Capped Users', value: stats.totalCapped, icon: <Shield size={20} />, color: '#6366f1', gradient: 'rgba(99,102,241,0.08)', cardType: 'capped' as const },
                { label: 'Uncapped Users', value: stats.totalUncapped, icon: <Users size={20} />, color: '#10b981', gradient: 'rgba(16,185,129,0.08)', cardType: 'uncapped' as const },
                { label: "Today's Tokens", value: formatTokens(stats.todayTokensUsed), icon: <Zap size={20} />, color: '#f59e0b', gradient: 'rgba(245,158,11,0.08)', cardType: 'top-users' as const },
                { label: 'Approaching Cap (80%+)', value: stats.approachingCap, icon: <AlertTriangle size={20} />, color: '#ef4444', gradient: 'rgba(239,68,68,0.08)', cardType: 'approaching' as const },
              ].map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => fetchCardDetails(card.cardType)}
                  className="border p-5 rounded-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer hover:shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${card.gradient} 0%, transparent 100%)`,
                    borderColor: isDarkMode ? `${card.color}30` : `${getCardColor(card.color, false)}24`,
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: isDarkMode ? `${card.color}18` : `${getCardColor(card.color, false)}14`, color: getCardColor(card.color, isDarkMode) }}>
                      {card.icon}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ backgroundColor: isDarkMode ? `${card.color}15` : `${getCardColor(card.color, false)}12`, color: getCardColor(card.color, isDarkMode) }}>
                      Live
                    </span>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                    style={{ color: 'var(--color-admin-on-surface-variant)' }}>{card.label}</p>
                  <h3 className="text-2xl font-bold" style={{ color: getCardColor(card.color, isDarkMode) }}>{card.value}</h3>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── Section 2: Cap Plans Manager ── */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers size={20} style={{ color: 'var(--color-admin-primary)' }} />
                <h3 className="text-lg font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>Cap Plans</h3>
              </div>
              <button onClick={() => setShowNewPlanForm(!showNewPlanForm)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
                style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                <Plus size={16} /> New Plan
              </button>
            </div>

            {/* New Plan Form */}
            <AnimatePresence>
              {showNewPlanForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-4"
                >
                  <div className="border rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-end"
                    style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Plan Name</label>
                      <input value={newPlanData.name} onChange={e => setNewPlanData(p => ({ ...p, name: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                        placeholder="e.g. Starter, Business..." />
                    </div>
                    <div className="w-full sm:w-48">
                      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Daily Token Cap</label>
                      <input type="number" value={newPlanData.dailyTokenCap}
                        onChange={e => setNewPlanData(p => ({ ...p, dailyTokenCap: parseInt(e.target.value) || 0 }))}
                        className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleCreatePlan} disabled={actionLoading}
                        className="px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                        style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                        {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Create
                      </button>
                      <button onClick={() => setShowNewPlanForm(false)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold border hover:opacity-80"
                        style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface-variant)' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.planId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="border rounded-xl p-5 transition-all duration-300 hover:scale-[1.01]"
                  style={{
                    backgroundColor: 'var(--color-admin-surface-container)',
                    borderColor: plan.isActive ? `${plan.color || 'var(--color-admin-primary)'}40` : 'var(--color-admin-outline-variant)',
                    opacity: plan.isActive ? 1 : 0.6,
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: `${plan.color || 'var(--color-admin-primary)'}20`, color: plan.color || 'var(--color-admin-primary)' }}>
                        {plan.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: 'var(--color-admin-on-surface)' }}>{plan.name}</h4>
                        <p className="text-[10px] font-semibold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                          {plan.userCount} user{plan.userCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleTogglePlan(plan.planId, plan.isActive)}
                      className="transition-colors" style={{ color: plan.isActive ? '#10b981' : 'var(--color-admin-on-surface-variant)' }}>
                      {plan.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                  </div>

                  {editPlanId === plan.planId ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Name</label>
                        <input value={editPlanData.name ?? plan.name}
                          onChange={e => setEditPlanData(p => ({ ...p, name: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                          style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Daily Token Cap</label>
                        <input type="number" value={editPlanData.dailyTokenCap ?? plan.dailyTokenCap}
                          onChange={e => setEditPlanData(p => ({ ...p, dailyTokenCap: parseInt(e.target.value) || 0 }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                          style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSavePlan(plan.planId)} disabled={actionLoading}
                          className="flex-1 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                          style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                          <Save size={12} /> Save
                        </button>
                        <button onClick={() => { setEditPlanId(null); setEditPlanData({}); }}
                          className="px-3 py-2 rounded-lg text-xs font-semibold border hover:opacity-80"
                          style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface-variant)' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1 mb-3">
                        <span className="text-2xl font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>
                          {formatTokens(plan.dailyTokenCap)}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>tokens/day</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditPlanId(plan.planId); setEditPlanData({}); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:opacity-80 transition-all"
                          style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                          <Edit3 size={12} /> Edit Plan
                        </button>
                        <button onClick={() => handleDeletePlan(plan.planId)} disabled={actionLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:opacity-80 transition-all"
                          style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-error)' }}>
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── Section 3: User Assignment Table ── */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserCheck size={20} style={{ color: 'var(--color-admin-primary)' }} />
                <h3 className="text-lg font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>User Assignments</h3>
              </div>
              <div className="flex items-center gap-3">
                {selectedUsers.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full"
                      style={{ backgroundColor: 'var(--color-admin-primary-container)', color: '#fff' }}>
                      {selectedUsers.size} selected
                    </span>
                    <select value={bulkPlan} onChange={e => setBulkPlan(e.target.value)}
                      className="border rounded-lg px-3 py-1.5 text-xs font-semibold outline-none"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                      <option value="">Assign plan...</option>
                      {plans.map(p => <option key={p.planId} value={p.planId}>{p.name}</option>)}
                    </select>
                    <button onClick={() => setShowBulkConfirm(true)} disabled={!bulkPlan || actionLoading}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                      Assign
                    </button>
                    <button onClick={() => setSelectedUsers(new Set())}
                      className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                      <X size={14} />
                    </button>
                  </div>
                )}
                <button onClick={() => { if (bulkPlan) setShowBulkConfirm(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border hover:opacity-80"
                  style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                  <Ban size={12} /> Assign to All
                </button>
              </div>
            </div>

            {/* Bulk Confirm Dialog */}
            <AnimatePresence>
              {showBulkConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                  style={{ backgroundColor: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(6px)' }}
                >
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.95 }}
                    className="rounded-2xl border shadow-2xl p-6 w-[480px] max-w-[95%]"
                    style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
                        <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-base" style={{ color: 'var(--color-admin-on-surface)' }}>Confirm Assignment</h3>
                        <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                          {selectedUsers.size > 0
                            ? `Assign ${plans.find(p => p.planId === bulkPlan)?.name || 'selected plan'} to ${selectedUsers.size} user(s)?`
                            : `Assign ${plans.find(p => p.planId === bulkPlan)?.name || 'selected plan'} to ALL users?`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button onClick={() => setShowBulkConfirm(false)}
                        className="flex-1 py-2 rounded-lg border text-sm font-semibold hover:opacity-80"
                        style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface-variant)' }}>
                        Cancel
                      </button>
                      <button onClick={selectedUsers.size > 0 ? handleBulkAssign : handleAssignToAll}
                        disabled={actionLoading}
                        className="flex-1 py-2 rounded-lg text-sm font-bold hover:opacity-90 flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#f59e0b', color: '#fff' }}>
                        {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Confirm
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Table */}
            <div className="border rounded-xl overflow-hidden"
              style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--color-admin-surface-container-high)' }}>
                      <th className="p-3 text-left">
                        <input type="checkbox" checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                          onChange={() => {
                            if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set());
                            else setSelectedUsers(new Set(filteredUsers.map(u => u.userId)));
                          }}
                          className="accent-[var(--color-admin-primary-container)]" />
                      </th>
                      <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>User</th>
                      <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Assigned Plan</th>
                      <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Custom Cap</th>
                      <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Today's Usage</th>
                      <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Status</th>
                      <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                          {loading ? 'Loading users...' : 'No users found.'}
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user, i) => (
                        <motion.tr
                          key={user.userId}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.03, 0.5) }}
                          className="border-t hover:bg-black/[.03] dark:hover:bg-white/[.03] transition-colors cursor-pointer"
                          style={{ borderColor: 'var(--color-admin-outline-variant)' }}
                          onClick={() => fetchUserDetail(user.userId)}
                        >
                          <td className="p-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedUsers.has(user.userId)}
                              onChange={() => toggleUserSelect(user.userId)}
                              className="accent-[var(--color-admin-primary-container)]" />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                                style={{ backgroundColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                                {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-admin-on-surface)' }}>{user.name}</p>
                                <p className="text-[10px] truncate" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3" onClick={e => e.stopPropagation()}>
                            <select value={user.assignedPlan}
                              onChange={e => handleAssignPlan(user.userId, e.target.value)}
                              className="border rounded-lg px-2 py-1 text-xs font-semibold outline-none"
                              style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                              {plans.map(p => <option key={p.planId} value={p.planId}>{p.name}</option>)}
                            </select>
                          </td>
                          <td className="p-3 text-xs font-medium" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                            {user.customCap ? formatTokens(user.customCap) : '—'}
                          </td>
                          <td className="p-3 text-xs font-semibold" style={{ color: 'var(--color-admin-on-surface)' }}>
                            {formatTokens(user.todayTokens)}
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: getStatusBg(user.status), color: getStatusColor(user.status) }}>
                              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                            </span>
                          </td>
                          <td className="p-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <button onClick={() => fetchUserDetail(user.userId)}
                                className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
                                style={{ color: 'var(--color-admin-primary)' }}>
                                <Eye size={14} />
                              </button>
                              <button onClick={async () => {
                                try {
                                  const res = await fetch('/api/admin/ai-caps/quick-cap', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ userId: user.userId, capType: 'block', capValue: 7200000 }),
                                  });
                                  const data = await res.json();
                                  if (data.success) {
                                    setToastMessage(`${user.email} blocked from AI`);
                                    fetchUsers();
                                  } else {
                                    setToastMessage(data.error || 'Failed to block user');
                                  }
                                } catch (err: any) {
                                  setToastMessage(err.message || 'Failed to block user');
                                }
                              }}
                                className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
                                style={{ color: '#ef4444' }}
                                title="Quick-block this user">
                                <Ban size={14} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Section 4: Usage Analytics (Charts) ── */}
          {stats && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={20} style={{ color: 'var(--color-admin-primary)' }} />
                <h3 className="text-lg font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>Usage Analytics</h3>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Daily Token Usage Bar Chart */}
                <div className="border rounded-xl p-5"
                  style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-admin-on-surface)' }}>
                    <BarChartIcon size={16} style={{ color: 'var(--color-admin-primary)' }} />
                    Daily Token Usage (Last 30 Days)
                  </h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={stats.dailyUsage}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-admin-outline-variant)" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-admin-on-surface-variant)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--color-admin-on-surface-variant)' }} tickFormatter={formatTokens} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--color-admin-surface-container-high)',
                          border: '1px solid var(--color-admin-outline-variant)',
                          borderRadius: 8,
                          fontSize: 12,
                          color: 'var(--color-admin-on-surface)',
                        }}
                        formatter={(value) => [formatTokens(Number(value)), 'Tokens']}
                      />
                      <Bar dataKey="tokens" fill="var(--color-admin-primary-container)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Usage by Agent Pie Chart */}
                <div className="border rounded-xl p-5"
                  style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-admin-on-surface)' }}>
                    <PieChartIcon size={16} style={{ color: 'var(--color-admin-primary)' }} />
                    Usage by Agent
                  </h4>
                  <div className="flex items-center">
                    <ResponsiveContainer width="60%" height={280}>
                      <PieChart>
                        <Pie
                          data={stats.agentBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          dataKey="tokens"
                          nameKey="agent"
                          paddingAngle={2}
                        >
                          {stats.agentBreakdown.map((entry, idx) => (
                            <Cell key={entry.agent} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--color-admin-surface-container-high)',
                            border: '1px solid var(--color-admin-outline-variant)',
                            borderRadius: 8,
                            fontSize: 12,
                            color: 'var(--color-admin-on-surface)',
                          }}
                          formatter={(value, name) => [formatTokens(Number(value)), AGENT_LABELS[String(name)] || name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 w-[40%]">
                      {stats.agentBreakdown.map((entry, idx) => (
                        <div key={entry.agent} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                          <span className="text-[11px] font-medium truncate" style={{ color: 'var(--color-admin-on-surface)' }}>
                            {AGENT_LABELS[entry.agent] || entry.agent}
                          </span>
                          <span className="text-[10px] ml-auto" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                            {formatTokens(entry.tokens)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Top Users Horizontal Bar Chart */}
                <div className="border rounded-xl p-5"
                  style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-admin-on-surface)' }}>
                    <TrendingUp size={16} style={{ color: 'var(--color-admin-primary)' }} />
                    Top 10 Users by Consumption
                  </h4>
                  <div className="space-y-3">
                    {stats.topUsers.slice(0, 10).map((user, i) => {
                      const maxTokens = stats.topUsers[0]?.tokensUsed || 1;
                      const pct = (user.tokensUsed / maxTokens) * 100;
                      return (
                        <div key={user.userId} className="flex items-center gap-3">
                          <span className="text-[10px] font-bold w-5 text-center" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-admin-on-surface)' }}>{user.name}</span>
                              <span className="text-[10px] font-medium shrink-0 ml-2" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                                {formatTokens(user.tokensUsed)}
                              </span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-admin-surface-container-high)' }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, delay: i * 0.05 }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cap Utilization Progress Bars */}
                <div className="border rounded-xl p-5"
                  style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-admin-on-surface)' }}>
                    <Target size={16} style={{ color: '#ef4444' }} />
                    Cap Utilization (80-100%)
                  </h4>
                  <div className="space-y-3">
                    {stats.capUtilization.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                        No users currently approaching their cap limit.
                      </p>
                    ) : (
                      stats.capUtilization.map((user) => {
                        const pct = Math.min(user.percentage, 100);
                        const barColor = pct >= 95 ? '#ef4444' : pct >= 85 ? '#f59e0b' : '#f97316';
                        return (
                          <div key={user.userId} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{ backgroundColor: `${barColor}20`, color: barColor }}>
                              {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-admin-on-surface)' }}>{user.name}</span>
                                <span className="text-[10px] font-bold shrink-0 ml-2" style={{ color: barColor }}>
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                              <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-admin-surface-container-high)' }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 1 }}
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: barColor }}
                                />
                              </div>
                              <div className="flex justify-between mt-0.5">
                                <span className="text-[9px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                                  {formatTokens(user.usage)} / {formatTokens(user.cap)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

          {/* Rules Tab Content */}
          {activeTab === 'rules' && (
            <>
              {/* Test Rules Panel */}
              <AnimatePresence>
                {showTestPanel && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-6"
                  >
                    <div className="border rounded-xl p-5"
                      style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                      <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--color-admin-on-surface)' }}>
                        <BugPlay size={16} /> Test Rule Matching
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Email</label>
                          <input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                            placeholder="user@example.com" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>IP Address</label>
                          <input value={testIp} onChange={e => setTestIp(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                            placeholder="192.168.1.1" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Location</label>
                          <input value={testLocation} onChange={e => setTestLocation(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                            placeholder="New York, NY, US" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Country</label>
                          <input value={testCountry} onChange={e => setTestCountry(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                            placeholder="US" />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={handleTestRule} disabled={testLoading}
                          className="px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                          style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                          {testLoading ? <Loader2 size={14} className="animate-spin" /> : <BugPlay size={14} />}
                          Test Match
                        </button>
                        <button onClick={() => setTestResult(null)}
                          className="px-4 py-2 rounded-lg text-sm font-semibold border hover:opacity-80"
                          style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface-variant)' }}>
                          Clear
                        </button>
                      </div>
                      {testResult && (
                        <div className="mt-4 p-4 rounded-xl border"
                          style={{
                            backgroundColor: testResult.matched ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)',
                            borderColor: testResult.matched ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                          }}>
                          <div className="flex items-center gap-2 mb-2">
                            {testResult.matched ? (
                              <><Ban size={16} style={{ color: '#ef4444' }} /><span className="font-bold text-sm" style={{ color: '#ef4444' }}>Matched!</span></>
                            ) : (
                              <><Check size={16} style={{ color: '#10b981' }} /><span className="font-bold text-sm" style={{ color: '#10b981' }}>No match</span></>
                            )}
                          </div>
                          {testResult.rule && (
                            <div className="text-xs space-y-1" style={{ color: 'var(--color-admin-on-surface)' }}>
                              <p>Rule: <strong>{testResult.rule.ruleName}</strong></p>
                              <p>Type: {MATCH_TYPE_LABELS[testResult.rule.matchType as keyof typeof MATCH_TYPE_LABELS] || testResult.rule.matchType}</p>
                              <p>Cap: {CAP_TYPE_LABELS[testResult.rule.capType as keyof typeof CAP_TYPE_LABELS]} = {testResult.rule.capValue}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* New Rule Form */}
              <AnimatePresence>
                {showNewRuleForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-6"
                  >
                    <div className="border rounded-xl p-5"
                      style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                      <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--color-admin-on-surface)' }}>Create New Rule</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Name *</label>
                          <input value={newRule.name} onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                            placeholder="e.g. Block university.edu users" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Description</label>
                          <input value={newRule.description} onChange={e => setNewRule(p => ({ ...p, description: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                            placeholder="Optional description" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Priority</label>
                          <input type="number" value={newRule.priority} onChange={e => setNewRule(p => ({ ...p, priority: parseInt(e.target.value) || 100 }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Apply Rule To *</label>
                          <select
                            value={newRule.matchType === 'all_users' ? 'all' : 'specific'}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === 'all') {
                                setNewRule(p => ({ ...p, matchType: 'all_users', matchValue: '*' }));
                              } else {
                                setNewRule(p => ({ ...p, matchType: 'email_exact', matchValue: '' }));
                              }
                            }}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                          >
                            <option value="all">All Users</option>
                            <option value="specific">Specific User(s)</option>
                          </select>
                        </div>
                        {newRule.matchType !== 'all_users' && (
                          <>
                            <div>
                              <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Match Type *</label>
                              <select value={newRule.matchType} onChange={e => setNewRule(p => ({ ...p, matchType: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                                style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                                {Object.entries(MATCH_TYPE_LABELS).filter(([k]) => k !== 'all_users').map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                              <p className="text-[10px] mt-1 italic" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                                {matchTypeTooltip[newRule.matchType] || ''}
                              </p>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Match Value *</label>
                              <input value={newRule.matchValue} onChange={e => setNewRule(p => ({ ...p, matchValue: e.target.value }))}
                                className="w-full border rounded-lg px-3 py-2 text-sm outline-none font-mono"
                                style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                                placeholder={matchTypeExamples[newRule.matchType] || ''} />
                            </div>
                          </>
                        )}
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Cap Type *</label>
                          <select value={newRule.capType} onChange={e => setNewRule(p => ({ ...p, capType: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                            <option value="daily_tokens">Daily Token Cap</option>
                            <option value="daily_requests">Daily Request Cap</option>
                            <option value="block">Block Access</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                            Cap Value *
                            {newRule.capType === 'block' && <span className="ml-1 normal-case">(ms)</span>}
                          </label>
                          <input type="number" value={newRule.capValue} onChange={e => setNewRule(p => ({ ...p, capValue: parseInt(e.target.value) || 0 }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                          {newRule.capType === 'block' && (
                            <p className="text-[10px] mt-1 italic" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                              Block duration in ms (default: 7200000 = 2h)
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Agent Filter</label>
                          <select value={newRule.agentFilter ?? '*'} onChange={e => setNewRule(p => ({ ...p, agentFilter: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                            <option value="*">All Agents</option>
                            <option value='["chat"]'>Chat Only</option>
                            <option value='["reviewer"]'>Reviewer Only</option>
                            <option value='["extract"]'>Extract Only</option>
                            <option value='["diagram"]'>Diagram Only</option>
                            <option value='["chat","reviewer","ai-fix"]'>Chat + Reviewer + AI Fix</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={handleCreateRule} disabled={actionLoading}
                          className="px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                          style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                          {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Create Rule
                        </button>
                        <button onClick={() => setShowNewRuleForm(false)}
                          className="px-4 py-2 rounded-lg text-sm font-semibold border hover:opacity-80"
                          style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface-variant)' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Rules Table */}
              {rulesLoading && !rules.length ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-admin-primary)' }} />
                </div>
              ) : rulesError ? (
                <div className="rounded-xl border p-6 mb-8" style={{ backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={20} style={{ color: 'var(--color-admin-error)' }} />
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-admin-error)' }}>{rulesError}</p>
                  </div>
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Shield size={48} style={{ color: 'var(--color-admin-on-surface-variant)', opacity: 0.3 }} />
                  <p className="font-semibold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                    {rulesSearchQuery ? 'No rules match your search' : 'No cap rules defined yet'}
                  </p>
                  {!rulesSearchQuery && (
                    <button onClick={() => setShowNewRuleForm(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-80"
                      style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                      <Plus size={16} /> Create your first rule
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRules.map((rule, idx) => (
                    <motion.div
                      key={rule.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="border rounded-xl overflow-hidden transition-all"
                      style={{
                        backgroundColor: 'var(--color-admin-surface-container)',
                        borderColor: rule.isActive ? `${CAP_TYPE_COLORS[rule.capType]}40` : 'var(--color-admin-outline-variant)',
                        opacity: rule.isActive ? 1 : 0.6,
                      }}
                    >
                      {/* Rule Header */}
                      <div className="p-4 flex items-start gap-4">
                        {/* Priority reorder */}
                        <div className="flex flex-col items-center gap-0.5 pt-1">
                          <button onClick={() => movePriority(rule.id, 'up')}
                            className="p-0.5 rounded hover:bg-black/10 transition-colors"
                            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                            <ArrowUp size={12} />
                          </button>
                          {editingPriority === rule.id ? (
                            <input type="number" value={priorityValue} autoFocus
                              onChange={e => setPriorityValue(parseInt(e.target.value) || 0)}
                              onBlur={() => handlePriorityUpdate(rule.id, priorityValue)}
                              onKeyDown={e => { if (e.key === 'Enter') handlePriorityUpdate(rule.id, priorityValue); if (e.key === 'Escape') setEditingPriority(null); }}
                              className="w-12 text-center text-[10px] font-mono border rounded px-1 py-0.5 outline-none"
                              style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-primary)', color: 'var(--color-admin-on-surface)' }} />
                          ) : (
                            <span onClick={() => { setEditingPriority(rule.id); setPriorityValue(rule.priority); }}
                              className="text-[10px] font-mono cursor-pointer hover:opacity-80"
                              style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                              {rule.priority}
                            </span>
                          )}
                          <button onClick={() => movePriority(rule.id, 'down')}
                            className="p-0.5 rounded hover:bg-black/10 transition-colors"
                            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                            <ArrowDown size={12} />
                          </button>
                        </div>

                        {/* Rule icon */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${CAP_TYPE_COLORS[rule.capType]}18`,
                            color: CAP_TYPE_COLORS[rule.capType],
                          }}>
                          {rule.capType === 'block' ? <Ban size={18} /> : rule.capType === 'daily_requests' ? <Activity size={18} /> : <Zap size={18} />}
                        </div>

                        {/* Rule info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-sm" style={{ color: 'var(--color-admin-on-surface)' }}>{rule.name}</h4>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1"
                              style={{
                                backgroundColor: `${CAP_TYPE_COLORS[rule.capType]}15`,
                                color: CAP_TYPE_COLORS[rule.capType],
                              }}>
                              {CAP_TYPE_LABELS[rule.capType]}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1"
                              style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                              {MATCH_TYPE_ICONS[rule.matchType]}
                              {MATCH_TYPE_LABELS[rule.matchType]?.split(' ').slice(0, 2).join(' ') || rule.matchType}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                            <span className="font-mono">{rule.matchValue}</span>
                            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--color-admin-outline-variant)' }} />
                            <span>Cap: <strong>{rule.capType === 'block' ? `${rule.capValue}ms` : rule.capValue.toLocaleString()}</strong></span>
                            {rule.agentFilter && rule.agentFilter !== '*' && (
                              <>
                                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--color-admin-outline-variant)' }} />
                                <span>Agents: {(() => { try { return JSON.parse(rule.agentFilter).join(', '); } catch { return rule.agentFilter || '*'; } })()}</span>
                              </>
                            )}
                            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--color-admin-outline-variant)' }} />
                            <span>Hits: <strong>{rule.hitCount}</strong></span>
                          </div>
                          {rule.description && (
                            <p className="text-xs mt-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{rule.description}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleToggleRuleActive(rule.id, rule.isActive)}
                            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                            style={{ color: rule.isActive ? '#10b981' : 'var(--color-admin-on-surface-variant)' }}>
                            {rule.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                          </button>
                          <button onClick={() => {
                            if (editRuleId === rule.id) {
                              setEditRuleId(null);
                              setEditRuleData({});
                            } else {
                              setEditRuleId(rule.id);
                              setEditRuleData({
                                name: rule.name,
                                description: rule.description,
                                matchType: rule.matchType,
                                matchValue: rule.matchValue,
                                capType: rule.capType,
                                capValue: rule.capValue,
                                agentFilter: rule.agentFilter,
                                priority: rule.priority,
                                isActive: rule.isActive,
                              });
                            }
                          }}
                            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                            style={{ color: editRuleId === rule.id ? 'var(--color-admin-primary)' : 'var(--color-admin-on-surface-variant)' }}>
                            {editRuleId === rule.id ? <X size={16} /> : <Edit3 size={16} />}
                          </button>
                          <button onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" style={{ color: 'var(--color-admin-error)' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Edit Panel */}
                      <AnimatePresence>
                        {editRuleId === rule.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden border-t"
                            style={{ borderColor: 'var(--color-admin-outline-variant)' }}
                          >
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Name</label>
                                <input value={editRuleData.name ?? rule.name} onChange={e => setEditRuleData(p => ({ ...p, name: e.target.value }))}
                                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                                  style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Description</label>
                                <input value={editRuleData.description ?? rule.description ?? ''} onChange={e => setEditRuleData(p => ({ ...p, description: e.target.value }))}
                                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                                  style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Apply Rule To</label>
                                <select
                                  value={(editRuleData.matchType ?? rule.matchType) === 'all_users' ? 'all' : 'specific'}
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val === 'all') {
                                      setEditRuleData(p => ({ ...p, matchType: 'all_users', matchValue: '*' }));
                                    } else {
                                      setEditRuleData(p => ({ ...p, matchType: 'email_exact', matchValue: '' }));
                                    }
                                  }}
                                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                                  style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                                >
                                  <option value="all">All Users</option>
                                  <option value="specific">Specific User(s)</option>
                                </select>
                              </div>
                              {(editRuleData.matchType ?? rule.matchType) !== 'all_users' && (
                                <>
                                  <div>
                                    <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Match Type</label>
                                    <select value={editRuleData.matchType ?? rule.matchType} onChange={e => setEditRuleData(p => ({ ...p, matchType: e.target.value }))}
                                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                                      {Object.entries(MATCH_TYPE_LABELS).filter(([k]) => k !== 'all_users').map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Match Value</label>
                                    <input value={editRuleData.matchValue ?? rule.matchValue} onChange={e => setEditRuleData(p => ({ ...p, matchValue: e.target.value }))}
                                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none font-mono"
                                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                                  </div>
                                </>
                              )}
                              <div>
                                <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Cap Type</label>
                                <select value={editRuleData.capType ?? rule.capType} onChange={e => setEditRuleData(p => ({ ...p, capType: e.target.value }))}
                                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                                  style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                                  <option value="daily_tokens">Daily Token Cap</option>
                                  <option value="daily_requests">Daily Request Cap</option>
                                  <option value="block">Block Access</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Cap Value</label>
                                <input type="number" value={editRuleData.capValue ?? rule.capValue} onChange={e => setEditRuleData(p => ({ ...p, capValue: parseInt(e.target.value) || 0 }))}
                                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                                  style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Priority</label>
                                <input type="number" value={editRuleData.priority ?? rule.priority} onChange={e => setEditRuleData(p => ({ ...p, priority: parseInt(e.target.value) || 100 }))}
                                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                                  style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Agent Filter</label>
                                <select value={editRuleData.agentFilter ?? rule.agentFilter ?? '*'} onChange={e => setEditRuleData(p => ({ ...p, agentFilter: e.target.value }))}
                                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                                  style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                                  <option value="*">All Agents</option>
                                  <option value='["chat"]'>Chat Only</option>
                                  <option value='["reviewer"]'>Reviewer Only</option>
                                  <option value='["extract"]'>Extract Only</option>
                                  <option value='["diagram"]'>Diagram Only</option>
                                  <option value='["chat","reviewer","ai-fix"]'>Chat + Reviewer + AI Fix</option>
                                </select>
                              </div>
                              <div className="flex items-end gap-2">
                                <button onClick={() => handleSaveRule(rule.id)} disabled={actionLoading}
                                  className="px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
                                  style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                                  {actionLoading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                  Save
                                </button>
                                <button onClick={() => { setEditRuleId(null); setEditRuleData({}); }}
                                  className="px-3 py-2 rounded-lg text-xs font-semibold border hover:opacity-80"
                                  style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface-variant)' }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ── User Detail Modal ── */}
      <AnimatePresence>
        {(detailUser || detailLoading) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(6px)' }}
            onClick={() => { setDetailUser(null); setDetailUserId(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-2xl border shadow-2xl w-[900px] max-w-[95%] max-h-[90vh] overflow-y-auto custom-scrollbar"
              style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b"
                style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                <div className="flex items-center gap-4">
                  {detailUser && (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm"
                      style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                      {detailUser.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>
                      {detailLoading ? 'Loading...' : detailUser?.name || ''}
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                      {detailUser?.email} &middot; Plan: <span className="font-semibold">{detailUser?.plan}</span>
                    </p>
                  </div>
                </div>
                <button onClick={() => { setDetailUser(null); setDetailUserId(null); }}
                  className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                  <X size={20} />
                </button>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-admin-primary)' }} />
                </div>
              ) : detailUser && (
                <div className="p-6 space-y-6">
                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: '30-Day Total', value: formatTokens(detailUser.totalTokens30d), icon: <Zap size={16} /> },
                      { label: 'Daily Average', value: formatTokens(detailUser.averageDaily), icon: <Activity size={16} /> },
                      { label: 'Daily Cap', value: formatTokens(detailUser.customCap || detailUser.dailyCap), icon: <Target size={16} /> },
                    ].map((stat) => (
                      <div key={stat.label} className="border rounded-xl p-4 text-center"
                        style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-outline-variant)' }}>
                        <div className="flex items-center justify-center gap-1.5 mb-2" style={{ color: 'var(--color-admin-primary)' }}>
                          {stat.icon}
                        </div>
                        <p className="text-lg font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>{stat.value}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* 30-Day Usage Line Chart */}
                  <div className="border rounded-xl p-5"
                    style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-outline-variant)' }}>
                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-admin-on-surface)' }}>
                      <LineChartIcon size={16} style={{ color: 'var(--color-admin-primary)' }} />
                      Daily Usage (Last 30 Days)
                    </h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={detailUser.dailyHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-admin-outline-variant)" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--color-admin-on-surface-variant)' }} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--color-admin-on-surface-variant)' }} tickFormatter={formatTokens} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--color-admin-surface-container-high)',
                            border: '1px solid var(--color-admin-outline-variant)',
                            borderRadius: 8,
                            fontSize: 11,
                            color: 'var(--color-admin-on-surface)',
                          }}
                        formatter={(value) => [formatTokens(Number(value)), 'Tokens']}
                        />
                        <Line type="monotone" dataKey="tokens" stroke="var(--color-admin-primary-container)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Agent Breakdown Table */}
                  <div className="border rounded-xl overflow-hidden"
                    style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                    <div className="p-4 border-b" style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-outline-variant)' }}>
                      <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-admin-on-surface)' }}>
                        <Cpu size={16} style={{ color: 'var(--color-admin-primary)' }} />
                        Per-Agent Breakdown
                      </h4>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--color-admin-surface-container)' }}>
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Agent</th>
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Tokens Used</th>
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Percentage</th>
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Distribution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailUser.agentBreakdown.map((agent, idx) => (
                          <tr key={agent.agent} className="border-t" style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                                <span className="text-xs font-semibold" style={{ color: 'var(--color-admin-on-surface)' }}>
                                  {AGENT_LABELS[agent.agent] || agent.agent}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-xs font-medium" style={{ color: 'var(--color-admin-on-surface)' }}>{formatTokens(agent.tokens)}</td>
                            <td className="p-3 text-xs font-semibold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{agent.percentage.toFixed(1)}%</td>
                            <td className="p-3">
                              <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-admin-surface-container-high)' }}>
                                <div className="h-full rounded-full" style={{ width: `${agent.percentage}%`, backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Custom Cap Override & Reactivation & Quick Cap */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-xl p-5"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-outline-variant)' }}>
                      <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-admin-on-surface)' }}>
                        <Settings size={16} style={{ color: 'var(--color-admin-primary)' }} />
                        Custom Cap Override
                      </h4>
                      <p className="text-[11px] mb-3" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                        Set a per-user token limit that overrides the plan default.
                      </p>
                      <div className="flex gap-2">
                        <input type="number" value={customCapOverride}
                          onChange={e => setCustomCapOverride(e.target.value)}
                          placeholder="e.g. 100000"
                          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none"
                          style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                        <button onClick={handleSaveCustomCap} disabled={actionLoading}
                          className="px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 flex items-center gap-1"
                          style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                          <Save size={12} /> Save
                        </button>
                      </div>
                    </div>

                    <div className="border rounded-xl p-5"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-outline-variant)' }}>
                      <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-admin-on-surface)' }}>
                        <Calendar size={16} style={{ color: 'var(--color-admin-primary)' }} />
                        AI Reactivation Date
                      </h4>
                      <p className="text-[11px] mb-3" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                        Schedule when this user's AI access should be re-enabled.
                      </p>
                      <div className="flex gap-2">
                        <input type="datetime-local" value={reactivationDate}
                          onChange={e => setReactivationDate(e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none"
                          style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                        <button onClick={handleSetReactivation} disabled={actionLoading}
                          className="px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 flex items-center gap-1"
                          style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                          <Clock size={12} /> Set
                        </button>
                      </div>
                    </div>

                    {/* Quick Cap Rule */}
                    <div className="border rounded-xl p-5"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-outline-variant)' }}>
                      <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--color-admin-on-surface)' }}>
                        <Ban size={16} style={{ color: '#ef4444' }} />
                        AI Cap Rule
                      </h4>
                      <p className="text-[11px] mb-3" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                        Create an email-based cap rule to limit this user's AI access.
                      </p>
                      <div className="flex gap-2 mb-2">
                        <select value={quickCapType} onChange={e => setQuickCapType(e.target.value as any)}
                          className="flex-1 border rounded-lg px-3 py-2 text-xs outline-none"
                          style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                          <option value="block">Block Access</option>
                          <option value="daily_tokens">Token Cap</option>
                          <option value="daily_requests">Request Cap</option>
                        </select>
                      </div>
                      {quickCapType !== 'block' && (
                        <div className="flex gap-2 mb-2">
                          <input type="number" value={quickCapValue}
                            onChange={e => setQuickCapValue(parseInt(e.target.value) || 0)}
                            className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                            placeholder={quickCapType === 'daily_tokens' ? 'Tokens per day' : 'Requests per day'} />
                        </div>
                      )}
                      <button onClick={handleQuickCap} disabled={quickCapLoading}
                        className="w-full py-2 rounded-lg text-xs font-bold hover:opacity-90 flex items-center justify-center gap-1"
                        style={{ backgroundColor: '#ef4444', color: '#fff' }}>
                        {quickCapLoading ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
                        {quickCapType === 'block' ? 'Block This User' : `Apply ${quickCapType === 'daily_tokens' ? 'Token' : 'Request'} Cap`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Card Drill-Down Modal ── */}
      <AnimatePresence>
        {cardModalType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(6px)' }}
            onClick={() => { setCardModalType(null); setCardModalUsers([]); setCardModalSearch(''); setCardModalError(null); if (cardSearchTimeoutRef.current) clearTimeout(cardSearchTimeoutRef.current); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-2xl border shadow-2xl w-[900px] max-w-[95%] max-h-[85vh] overflow-hidden flex flex-col"
              style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b shrink-0"
                style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: cardModalType === 'capped' ? 'rgba(99,102,241,0.12)' :
                        cardModalType === 'uncapped' ? 'rgba(16,185,129,0.12)' :
                        cardModalType === 'approaching' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                      color: cardModalType === 'capped' ? '#6366f1' :
                        cardModalType === 'uncapped' ? '#10b981' :
                        cardModalType === 'approaching' ? '#ef4444' : '#f59e0b'
                    }}>
                    {cardModalType === 'capped' && <Shield size={20} />}
                    {cardModalType === 'uncapped' && <Users size={20} />}
                    {cardModalType === 'approaching' && <AlertTriangle size={20} />}
                    {cardModalType === 'top-users' && <Zap size={20} />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>
                      {cardModalType === 'capped' && 'Capped Users'}
                      {cardModalType === 'uncapped' && 'Uncapped Users'}
                      {cardModalType === 'approaching' && 'Approaching Cap (80%+)'}
                      {cardModalType === 'top-users' && "Today's Top Users by Token Usage"}
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                      {cardModalTotal} user{cardModalTotal !== 1 ? 's' : ''} found
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-admin-on-surface-variant)' }} />
                    <input
                      value={cardModalSearch}
                      onChange={e => {
                        setCardModalSearch(e.target.value);
                        if (cardSearchTimeoutRef.current) clearTimeout(cardSearchTimeoutRef.current);
                        const v = e.target.value;
                        cardSearchTimeoutRef.current = setTimeout(() => fetchCardDetails(cardModalType, 1, v), 300);
                      }}
                      className="pl-9 pr-3 py-1.5 border rounded-lg text-xs outline-none w-48"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                      placeholder="Search..."
                    />
                  </div>
                  <button onClick={() => { setCardModalType(null); setCardModalUsers([]); setCardModalSearch(''); setCardModalError(null); if (cardSearchTimeoutRef.current) clearTimeout(cardSearchTimeoutRef.current); }}
                    className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {cardModalError ? (
                  <div className="flex items-center justify-center py-16 gap-3 flex-col">
                    <AlertTriangle size={40} style={{ color: 'var(--color-admin-error)', opacity: 0.5 }} />
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-admin-error)' }}>{cardModalError}</p>
                  </div>
                ) : cardModalLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-admin-primary)' }} />
                  </div>
                ) : cardModalUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Users size={40} style={{ color: 'var(--color-admin-on-surface-variant)', opacity: 0.3 }} />
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>No users found</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: 'var(--color-admin-surface-container-high)' }}>
                        <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>User</th>
                        {(cardModalType === 'capped' || cardModalType === 'approaching') && (
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Plan</th>
                        )}
                        {(cardModalType === 'capped' || cardModalType === 'approaching' || cardModalType === 'top-users') && (
                          <>
                            <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Daily Cap</th>
                            <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Today's Usage</th>
                            <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Usage %</th>
                          </>
                        )}
                        {cardModalType === 'uncapped' && (
                          <>
                            <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Membership</th>
                            <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Points</th>
                            <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Joined</th>
                          </>
                        )}
                        <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cardModalUsers.map((u: any, idx: number) => (
                        <tr key={u.userId || u.id || idx} className="border-t hover:bg-black/[.03] dark:hover:bg-white/[.03] transition-colors"
                          style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                                style={{ backgroundColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                                {(u.name || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-admin-on-surface)' }}>{u.name}</p>
                                <p className="text-[10px] truncate" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{u.email}</p>
                              </div>
                            </div>
                          </td>
                          {(cardModalType === 'capped' || cardModalType === 'approaching') && (
                            <td className="p-3 text-xs font-medium" style={{ color: 'var(--color-admin-on-surface)' }}>{u.plan}</td>
                          )}
                          {(cardModalType === 'capped' || cardModalType === 'approaching' || cardModalType === 'top-users') && (
                            <>
                              <td className="p-3 text-xs font-medium" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{formatTokens(u.dailyCap)}</td>
                              <td className="p-3 text-xs font-semibold" style={{ color: 'var(--color-admin-on-surface)' }}>{formatTokens(u.todayUsage)}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-admin-surface-container-high)' }}>
                                    <div className="h-full rounded-full" style={{
                                      width: `${Math.min(u.percentUsed || 0, 100)}%`,
                                      backgroundColor: (u.percentUsed || 0) >= 95 ? '#ef4444' : (u.percentUsed || 0) >= 80 ? '#f59e0b' : '#10b981'
                                    }}></div>
                                  </div>
                                  <span className="text-[10px] font-bold" style={{
                                    color: (u.percentUsed || 0) >= 95 ? '#ef4444' : (u.percentUsed || 0) >= 80 ? '#f59e0b' : '#10b981'
                                  }}>{u.percentUsed || 0}%</span>
                                </div>
                              </td>
                            </>
                          )}
                          {cardModalType === 'uncapped' && (
                            <>
                              <td className="p-3">
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: u.membership === 'free' ? 'rgba(100,116,139,0.12)' : 'rgba(99,102,241,0.12)', color: u.membership === 'free' ? '#64748b' : '#6366f1' }}>
                                  {u.membership}
                                </span>
                              </td>
                              <td className="p-3 text-xs font-medium" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{u.points}</td>
                              <td className="p-3 text-[10px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                              </td>
                            </>
                          )}
                          <td className="p-3">
                            <button onClick={() => { setCardModalType(null); setCardModalUsers([]); fetchUserDetail(u.userId); }}
                              className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
                              style={{ color: 'var(--color-admin-primary)' }}>
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {cardModalTotal > 20 && (
                <div className="flex items-center justify-between p-4 border-t shrink-0"
                  style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                  <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                    Showing {((cardModalPage - 1) * 20) + 1}-{Math.min(cardModalPage * 20, cardModalTotal)} of {cardModalTotal}
                  </p>
                  <div className="flex gap-2">
                    <button disabled={cardModalPage <= 1}
                      onClick={() => fetchCardDetails(cardModalType!, cardModalPage - 1, cardModalSearch)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold border hover:opacity-80 disabled:opacity-40"
                      style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                      Prev
                    </button>
                    <button disabled={cardModalPage * 20 >= cardModalTotal}
                      onClick={() => fetchCardDetails(cardModalType!, cardModalPage + 1, cardModalSearch)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold border hover:opacity-80 disabled:opacity-40"
                      style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                      Next
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
