'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Plus, Search, RefreshCw, X, Check, Loader2,
  ArrowUp, ArrowDown, BugPlay, Mail, Network, Globe, Users,
  Edit3, Trash2, AlertTriangle, ToggleLeft, ToggleRight, ArrowLeft
} from 'lucide-react';

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

const CAP_TYPE_LABELS: Record<string, string> = {
  daily_tokens: 'Daily Token Cap',
  daily_requests: 'Daily Request Cap',
  block: 'Block Access',
};

const CAP_TYPE_COLORS: Record<string, string> = {
  daily_tokens: '#6366f1',
  daily_requests: '#f59e0b',
  block: '#ef4444',
};

const MATCH_TYPE_EXAMPLES: Record<string, string> = {
  all_users: '*',
  email_exact: 'user@example.com',
  email_domain: '@university.edu',
  email_regex: '.*@(gmail|yahoo)\\.com',
  ip_exact: '192.168.1.100',
  ip_cidr: '10.0.0.0/8',
  location_country: 'US',
  location_city: 'New York',
};

const MATCH_TYPE_TOOLTIPS: Record<string, string> = {
  all_users: 'Applies this rule globally to all users',
  email_exact: 'Matches the exact email address',
  email_domain: 'Matches any email ending with @domain',
  email_regex: 'Matches email against a regular expression',
  ip_exact: 'Matches the exact IP address',
  ip_cidr: 'Matches IP within a CIDR range (e.g. 10.0.0.0/8)',
  location_country: 'Matches ISO country code (US, IN, GB, etc.)',
  location_city: 'Matches city name anywhere in the location string',
};

const DEFAULT_RULE = {
  name: '',
  description: '',
  matchType: 'email_domain' as string,
  matchValue: '',
  capType: 'daily_tokens' as string,
  capValue: 50000,
  agentFilter: '*',
  priority: 100,
  isActive: true,
};

export default function AdminAiCapRulesPage() {
  const router = useRouter();

  const [rules, setRules] = useState<CapRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createData, setCreateData] = useState({ ...DEFAULT_RULE });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<CapRule>>({});

  const [testEmail, setTestEmail] = useState('');
  const [testIp, setTestIp] = useState('');
  const [testLocation, setTestLocation] = useState('');
  const [testCountry, setTestCountry] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.rules);
        setError(null);
      } else {
        setError(data.error || 'Failed to load rules');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleCreate = async () => {
    if (!createData.name.trim() || !createData.matchValue.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createData),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateForm(false);
        setCreateData({ ...DEFAULT_RULE });
        fetchRules();
        setToast('Rule created');
      } else {
        setToast(data.error || 'Failed to create rule');
      }
    } catch (err: any) {
      setToast(err.message || 'Failed to create rule');
    }
    setActionLoading(false);
  };

  const handleUpdate = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-caps/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editData }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingId(null);
        setEditData({});
        fetchRules();
        setToast('Rule updated');
      } else {
        setToast(data.error || 'Failed to update rule');
      }
    } catch (err: any) {
      setToast(err.message || 'Failed to update');
    }
    setActionLoading(false);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/ai-caps/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      if (res.ok) fetchRules();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    try {
      const res = await fetch(`/api/admin/ai-caps/rules?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchRules();
        setToast('Rule deleted');
      } else {
        setToast(data.error || 'Failed to delete');
      }
    } catch {}
  };

  const handlePriorityMove = async (id: string, direction: 'up' | 'down') => {
    const idx = rules.findIndex(r => r.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === rules.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const currentPriority = rules[idx].priority;
    const swapPriority = rules[swapIdx].priority;

    const first = fetch('/api/admin/ai-caps/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rules[idx].id, priority: swapPriority }),
    });
    const second = fetch('/api/admin/ai-caps/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rules[swapIdx].id, priority: currentPriority }),
    });

    const [res1, res2] = await Promise.allSettled([first, second]);
    if (res1.status === 'rejected' || res2.status === 'rejected') {
      setToast('Priority swap partially failed — refreshing');
    }
    fetchRules();
  };

  const handleTest = async () => {
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

  const filteredRules = useMemo(() => {
    if (!searchQuery) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      r.matchValue.toLowerCase().includes(q) ||
      r.matchType.toLowerCase().includes(q)
    );
  }, [rules, searchQuery]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-admin-background)', color: 'var(--color-admin-on-background)' }}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/ai-caps')}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: 'var(--color-admin-on-surface-variant)' }}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>Targeted Cap Rules</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                Create and manage AI usage rules based on email, IP, or location
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setShowTestPanel(!showTestPanel); setShowCreateForm(false); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border hover:opacity-80"
              style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
              <BugPlay size={16} /> Test Rules
            </button>
            <button onClick={() => { setShowCreateForm(!showCreateForm); setShowTestPanel(false); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-80"
              style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
              <Plus size={16} /> Create Rule
            </button>
            <button onClick={fetchRules}
              className="flex items-center gap-2 border px-4 py-2 rounded-lg hover:opacity-80 font-semibold"
              style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-admin-on-surface-variant)' }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full border rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 transition-all"
            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
            placeholder="Search rules by name, type, or value..." />
        </div>

        {/* Create Form */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6">
              <div className="border rounded-xl p-6" style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                <h3 className="font-bold mb-4" style={{ color: 'var(--color-admin-on-surface)' }}>Create New Rule</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Name *</label>
                    <input value={createData.name} onChange={e => setCreateData(p => ({ ...p, name: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                      placeholder="e.g. Block university.edu users" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Description</label>
                    <input value={createData.description} onChange={e => setCreateData(p => ({ ...p, description: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                      placeholder="Optional description" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Priority</label>
                    <input type="number" value={createData.priority} onChange={e => setCreateData(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Match Type *</label>
                    <select value={createData.matchType} onChange={e => setCreateData(p => ({ ...p, matchType: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                      {Object.entries(MATCH_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <p className="text-[10px] mt-1 opacity-70" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                      {MATCH_TYPE_TOOLTIPS[createData.matchType]}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Match Value *</label>
                    <input value={createData.matchValue} onChange={e => setCreateData(p => ({ ...p, matchValue: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none font-mono"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                      placeholder={MATCH_TYPE_EXAMPLES[createData.matchType] || 'Enter match value'} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Cap Type *</label>
                    <select value={createData.capType} onChange={e => setCreateData(p => ({ ...p, capType: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                      {Object.entries(CAP_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                      Cap Value * {createData.capType === 'block' ? '(ms)' : '(tokens/requests)'}
                    </label>
                    <input type="number" value={createData.capValue} onChange={e => setCreateData(p => ({ ...p, capValue: parseInt(e.target.value) || 0 }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Agent Filter</label>
                    <input value={createData.agentFilter} onChange={e => setCreateData(p => ({ ...p, agentFilter: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none font-mono"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                      placeholder="* (all agents)" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={handleCreate} disabled={actionLoading || !createData.name.trim() || !createData.matchValue.trim()}
                    className="px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Create Rule
                  </button>
                  <button onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border hover:opacity-80"
                    style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface-variant)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Test Panel */}
        <AnimatePresence>
          {showTestPanel && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6">
              <div className="border rounded-xl p-6" style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>Test Rule Matching</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>Simulation</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Email</label>
                    <input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                      placeholder="user@example.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>IP Address</label>
                    <input value={testIp} onChange={e => setTestIp(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                      placeholder="192.168.1.100" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Location (City)</label>
                    <input value={testLocation} onChange={e => setTestLocation(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                      placeholder="New York" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Country</label>
                    <input value={testCountry} onChange={e => setTestCountry(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                      placeholder="US" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={handleTest} disabled={testLoading}
                    className="px-5 py-2 rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                    {testLoading ? <Loader2 size={14} className="animate-spin" /> : <BugPlay size={14} />}
                    Test Matching
                  </button>
                  <button onClick={() => setShowTestPanel(false)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold border hover:opacity-80"
                    style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface-variant)' }}>
                    Close
                  </button>
                </div>
                {testResult && (
                  <div className="mt-4 p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: testResult.matched ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${testResult.matched ? 'bg-green-500' : 'bg-indigo-500'}`} />
                      <span className="font-bold text-sm" style={{ color: 'var(--color-admin-on-surface)' }}>
                        {testResult.matched ? 'Rule Matched' : 'No Match'}
                      </span>
                    </div>
                    {testResult.rule && (
                      <div className="text-sm space-y-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                        <p>Rule: <span className="font-semibold">{testResult.rule.name}</span></p>
                        <p>Action: <span className="font-semibold">{CAP_TYPE_LABELS[testResult.rule.capType] || testResult.rule.capType}</span></p>
                        <p>Value: <span className="font-semibold">{testResult.rule.capValue?.toLocaleString()}</span></p>
                      </div>
                    )}
                    {!testResult.matched && testResult.error && (
                      <p className="text-sm text-red-500 mt-1">{testResult.error}</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rules List */}
        {loading && rules.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-admin-primary)' }} />
          </div>
        ) : error ? (
          <div className="rounded-xl border p-6" style={{ backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} style={{ color: 'var(--color-admin-error)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--color-admin-error)' }}>{error}</p>
            </div>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-12 text-center" style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
            <Shield size={48} className="mx-auto mb-4 opacity-30" style={{ color: 'var(--color-admin-on-surface-variant)' }} />
            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--color-admin-on-surface)' }}>
              {searchQuery ? 'No rules match your search' : 'No cap rules defined yet'}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
              {searchQuery ? 'Try a different search term' : 'Create your first rule to start managing AI usage'}
            </p>
            {!searchQuery && (
              <button onClick={() => setShowCreateForm(true)}
                className="px-5 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 inline-flex items-center gap-2"
                style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                <Plus size={16} /> Create Rule
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRules.map((rule, idx) => (
              <motion.div key={rule.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="border rounded-xl p-5 transition-all hover:shadow-sm"
                style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: rule.isActive ? `${CAP_TYPE_COLORS[rule.capType] || 'var(--color-admin-primary)'}30` : 'var(--color-admin-outline-variant)', opacity: rule.isActive ? 1 : 0.6 }}>
                <div className="flex items-start gap-4">
                  {/* Priority controls */}
                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <button onClick={() => handlePriorityMove(rule.id, 'up')} disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-black/10 disabled:opacity-20 transition-colors" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                      <ArrowUp size={14} />
                    </button>
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{rule.priority}</span>
                    <button onClick={() => handlePriorityMove(rule.id, 'down')} disabled={idx === filteredRules.length - 1}
                      className="p-0.5 rounded hover:bg-black/10 disabled:opacity-20 transition-colors" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                      <ArrowDown size={14} />
                    </button>
                  </div>

                  {/* Rule info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm" style={{ color: 'var(--color-admin-on-surface)' }}>{rule.name}</span>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                        style={{ backgroundColor: `${CAP_TYPE_COLORS[rule.capType] || '#6366f1'}18`, color: CAP_TYPE_COLORS[rule.capType] || '#6366f1' }}>
                        {CAP_TYPE_LABELS[rule.capType] || rule.capType}
                      </div>
                      {rule.hitCount > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                          {rule.hitCount} hit{rule.hitCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                      <span className="flex items-center gap-1">
                        {MATCH_TYPE_ICONS[rule.matchType] || <Users size={14} />}
                        {MATCH_TYPE_LABELS[rule.matchType] || rule.matchType}
                      </span>
                      <span className="font-mono">{rule.matchValue}</span>
                      {rule.description && <span className="opacity-70">— {rule.description}</span>}
                    </div>
                    {(rule.lastHitAt || rule.agentFilter !== '*') && (
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] opacity-60" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                        {rule.lastHitAt && <span>Last hit: {new Date(rule.lastHitAt).toLocaleString()}</span>}
                        {rule.agentFilter !== '*' && <span>Agents: {rule.agentFilter}</span>}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleToggleActive(rule.id, rule.isActive)}
                      className="p-1.5 rounded-lg hover:bg-black/5 transition-colors" style={{ color: rule.isActive ? '#10b981' : 'var(--color-admin-on-surface-variant)' }}>
                      {rule.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    {editingId === rule.id ? (
                      <button onClick={() => handleUpdate(rule.id)} disabled={actionLoading}
                        className="p-1.5 rounded-lg hover:bg-black/5 transition-colors" style={{ color: 'var(--color-admin-primary)' }}>
                        {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      </button>
                    ) : (
                      <button onClick={() => { setEditingId(rule.id); setEditData({ name: rule.name, description: rule.description || '', matchType: rule.matchType, matchValue: rule.matchValue, capType: rule.capType, capValue: rule.capValue, agentFilter: rule.agentFilter, priority: rule.priority }); }}
                        className="p-1.5 rounded-lg hover:bg-black/5 transition-colors" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                        <Edit3 size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(rule.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" style={{ color: 'var(--color-admin-error)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Inline edit form */}
                <AnimatePresence>
                  {editingId === rule.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden">
                      <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
                        style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Name</label>
                          <input value={editData.name ?? ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Match Type</label>
                          <select value={editData.matchType ?? rule.matchType} onChange={e => setEditData(p => ({ ...p, matchType: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                            {Object.entries(MATCH_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Match Value</label>
                          <input value={editData.matchValue ?? ''} onChange={e => setEditData(p => ({ ...p, matchValue: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none font-mono"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Cap Type</label>
                          <select value={editData.capType ?? rule.capType} onChange={e => setEditData(p => ({ ...p, capType: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                            {Object.entries(CAP_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Cap Value</label>
                          <input type="number" value={editData.capValue ?? rule.capValue} onChange={e => setEditData(p => ({ ...p, capValue: parseInt(e.target.value) || 0 }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Agent Filter</label>
                          <input value={editData.agentFilter ?? rule.agentFilter ?? '*'} onChange={e => setEditData(p => ({ ...p, agentFilter: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none font-mono"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Priority</label>
                          <input type="number" value={editData.priority ?? rule.priority} onChange={e => setEditData(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Description</label>
                          <input value={editData.description ?? ''} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[10000] px-5 py-3 rounded-xl border shadow-xl text-sm font-semibold flex items-center gap-2"
            style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
            <Check size={16} style={{ color: '#10b981' }} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
