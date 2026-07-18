'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useUsersRealtime } from '@/hooks/useUsersRealtime';
import { Theme, themes, getAccentColor } from '@/components/AdminThemeStyles';
import AdminSidebar from '@/components/AdminSidebar';


// ── Types ────────────────────────────────────────────────────────────────────
interface BlacklistRecord {
  id: string;
  action: 'blacklisted' | 'reactivated';
  reason: string | null;
  adminEmail: string | null;
  createdAt: string;
}

interface PaidTransaction {
  id: string;
  orderId: string;
  planType: string;
  amount: number;
  currency: string;
  durationMonths: number;
  createdAt: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  membership: string;
  membershipRaw: string;
  membershipExpiresAt: string | null;
  points: number;
  aiTokensUsed: number;
  projectCount: number;
  status: string;
  blacklistReason: string | null;
  blacklistHistory: BlacklistRecord[];
  blockedUntil: string | null;
  lastIp: string;
  lastLocation: string;
  lastLatitude: number | null;
  lastLongitude: number | null;
  joiningDate: string;
  paidTransactions: PaidTransaction[];
  role: string;
  createdAt: string;
  aiPlanStartsAt?: string | null;
  aiPlanExpiresAt?: string | null;
  aiCapPlanId?: string | null;
}

function getDuration(membershipRaw: string): string {
  if (membershipRaw === 'free') return '';
  const match = membershipRaw.match(/(\d+)m$/);
  if (!match) return '';
  const months = parseInt(match[1], 10);
  return `${months} Month${months > 1 ? 's' : ''}`;
}

function getCurrencySymbol(currency: string): string {
  const map: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'CA$',
    AUD: 'A$',
    JPY: '¥',
    CNY: '¥',
  };
  return map[currency] || '₹';
}

function getDaysSince(dateStr: string): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ── Plan Badge ────────────────────────────────────────────────────────────────
function PlanBadge({ membership: _membership, membershipRaw }: { membership: string; membershipRaw: string }) {
  const isPro = membershipRaw !== 'free';
  const duration = getDuration(membershipRaw);
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span
        className="px-2 py-0.5 rounded border text-xs font-semibold inline-block w-fit"
        style={
          isPro
            ? { background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', borderColor: 'rgba(99,102,241,0.3)' }
            : { backgroundColor: 'var(--color-admin-surface-container-highest)', color: 'var(--color-admin-on-surface-variant)', borderColor: 'var(--color-admin-outline-variant)' }
        }
      >
        {isPro ? '★ Pro' : 'Free'}
      </span>
      {duration && (
        <span className="text-[10px] font-medium pl-1" style={{ color: 'rgba(165,180,252,0.7)' }}>
          {duration}
        </span>
      )}
    </div>
  );
}

// ── Expiry Cell ───────────────────────────────────────────────────────────────
function ExpiryCell({ membershipRaw, membershipExpiresAt }: { membershipRaw: string; membershipExpiresAt: string | null }) {
  if (membershipRaw === 'free') {
    return <span className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Never (Free)</span>;
  }
  if (!membershipExpiresAt) {
    return <span className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>No expiry set</span>;
  }
  const expiry = new Date(membershipExpiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const expired = daysLeft <= 0;
  const almostExpired = daysLeft > 0 && daysLeft <= 7;

  return (
    <div>
      <p className="text-xs font-medium" style={{
        color: expired ? 'var(--color-admin-error)' : almostExpired ? '#f59e0b' : 'var(--color-admin-on-surface)',
      }}>
        {expiry.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </p>
      <p className="text-[10px]" style={{
        color: expired ? 'var(--color-admin-error)' : almostExpired ? '#f59e0b' : 'var(--color-admin-on-surface-variant)',
      }}>
        {expired ? 'Expired' : almostExpired ? `${daysLeft}d left` : `${daysLeft}d`}
      </p>
    </div>
  );
}

// ── Blacklist Confirm Dialog ──────────────────────────────────────────────────
interface BlacklistDialogProps {
  user: AdminUser;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function BlacklistConfirmDialog({ user, onConfirm, onCancel, loading }: BlacklistDialogProps) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(6px)' }}>
      <div
        className="rounded-2xl border shadow-2xl p-6"
        style={{
          backgroundColor: 'var(--color-admin-surface-container)',
          borderColor: 'var(--color-admin-outline-variant)',
          width: '540px',
          maxWidth: '95%'
        }}
      >
        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-admin-error)', fontVariationSettings: "'FILL' 1", fontSize: '22px' }}>block</span>
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-admin-on-surface)' }}>Blacklist User</h3>
            <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
              This will freeze <strong>{user.name}</strong>'s account and notify them by email.
            </p>
          </div>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 p-3 rounded-xl mb-4"
          style={{ backgroundColor: 'var(--color-admin-surface-container-high)', border: '1px solid var(--color-admin-outline-variant)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
            style={{ backgroundColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
            {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-admin-on-surface)' }}>{user.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{user.email}</p>
          </div>
        </div>

        {/* Reason input */}
        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
          Reason for Blacklisting <span style={{ color: 'var(--color-admin-on-surface-variant)', fontWeight: 400 }}>(shown to user)</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Repeated ToS violations, fraudulent activity..."
          rows={3}
          className="w-full rounded-lg border p-3 text-sm outline-none resize-none mb-4 focus:ring-1"
          style={{
            backgroundColor: 'var(--color-admin-surface-container-lowest)',
            borderColor: 'var(--color-admin-outline-variant)',
            color: 'var(--color-admin-on-surface)',
          }}
        />

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2 rounded-lg border text-sm font-semibold hover:opacity-80 transition-opacity"
            style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface-variant)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason || 'Violation of platform terms of service.')}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--color-admin-error)', color: '#fff' }}
          >
            {loading
              ? <><div className="w-3.5 h-3.5 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div> Processing...</>
              : <><span className="material-symbols-outlined text-[16px]">block</span> Blacklist & Email</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reactivate Confirm Dialog ──────────────────────────────────────────────────────
interface ReactivateDialogProps {
  user: AdminUser;
  onConfirm: (note?: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function ReactivateConfirmDialog({ user, onConfirm, onCancel, loading }: ReactivateDialogProps) {
  const [note, setNote] = React.useState('');
  const isTempBlock = user.status !== 'blacklisted' && !!(user.blockedUntil && new Date(user.blockedUntil) > new Date());

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(6px)' }}>
      <div className="rounded-2xl border shadow-2xl p-6"
        style={{
          backgroundColor: 'var(--color-admin-surface-container)',
          borderColor: 'var(--color-admin-outline-variant)',
          width: '540px',
          maxWidth: '95%'
        }}>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              backgroundColor: isTempBlock ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
              border: isTempBlock ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(16,185,129,0.3)'
            }}>
            <span className="material-symbols-outlined"
              style={{ color: isTempBlock ? '#f59e0b' : '#10b981', fontVariationSettings: "'FILL' 1", fontSize: '22px' }}>
              {isTempBlock ? 'gavel' : 'lock_open'}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-admin-on-surface)' }}>
              {isTempBlock ? 'Lift Tool Restriction' : 'Deactivate Blacklist'}
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
              {isTempBlock
                ? `This will immediately end the tool overuse lockout for ${user.name} and restore their access.`
                : `This will fully restore ${user.name}'s account and notify them by email.`
              }
            </p>
          </div>
        </div>

        {/* User card */}
        <div className="flex items-center gap-3 p-3 rounded-xl mb-4"
          style={{ backgroundColor: 'var(--color-admin-surface-container-high)', border: '1px solid var(--color-admin-outline-variant)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
            style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
            {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-admin-on-surface)' }}>{user.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{user.email}</p>
          </div>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
            style={isTempBlock
              ? { backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }
              : { backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-admin-error)', border: '1px solid rgba(239,68,68,0.25)' }
            }>
            {isTempBlock ? 'Temporarily Blocked' : 'Blacklisted'}
          </span>
        </div>

        {/* Previous reason */}
        {user.blacklistReason && (
          <div className="mb-4 p-3 rounded-lg"
            style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderLeft: '3px solid var(--color-admin-error)' }}>
            <p className="text-[10px] font-semibold mb-1 uppercase tracking-wider" style={{ color: 'var(--color-admin-error)' }}>Suspension Reason</p>
            <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{user.blacklistReason}</p>
          </div>
        )}

        {/* Optional admin note */}
        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
          Admin Note <span style={{ fontWeight: 400 }}>(optional — logged in audit trail)</span>
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Cleared lock after support ticket review..."
          rows={2}
          className="w-full rounded-lg border p-3 text-sm outline-none resize-none mb-4"
          style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
        />

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2 rounded-lg border text-sm font-semibold hover:opacity-80 transition-opacity"
            style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface-variant)' }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(note || undefined)} disabled={loading}
            className="flex-1 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{ backgroundColor: isTempBlock ? '#f59e0b' : '#10b981', color: '#fff' }}>
            {loading
              ? <><div className="w-3.5 h-3.5 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div> Processing...</>
              : <><span className="material-symbols-outlined text-[16px]">{isTempBlock ? 'gavel' : 'lock_open'}</span> {isTempBlock ? 'Unblock User' : 'Reactivate & Email'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Subscription Edit Dialog ──────────────────────────────────────────────────────
interface SubscriptionDialogProps {
  user: AdminUser;
  onConfirm: (membership: string, expiresAt: string | null) => void;
  onCancel: () => void;
  loading: boolean;
}

function SubscriptionEditDialog({ user, onConfirm, onCancel, loading }: SubscriptionDialogProps) {
  const [membership, setMembership] = useState(user.membershipRaw || 'free');
  const [expiresAt, setExpiresAt] = useState(
    user.membershipExpiresAt 
      ? new Date(user.membershipExpiresAt).toISOString().split('T')[0] 
      : ''
  );
  const [plans, setPlans] = useState<{ planId: string; name: string; durationMonths: number }[]>([]);

  useEffect(() => {
    fetch('/api/admin/plans')
      .then(r => r.json())
      .then(data => { if (data.success) setPlans(data.plans || []); })
      .catch(() => {});
  }, []);

  const handleSave = () => {
    onConfirm(membership, expiresAt ? new Date(expiresAt).toISOString() : null);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(6px)' }}>
      <div className="rounded-2xl border shadow-2xl p-6"
        style={{
          backgroundColor: 'var(--color-admin-surface-container)',
          borderColor: 'var(--color-admin-outline-variant)',
          width: '540px',
          maxWidth: '95%'
        }}>
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <span className="material-symbols-outlined" style={{ color: '#a5b4fc', fontSize: '22px' }}>card_membership</span>
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--color-admin-on-surface)' }}>Manage Subscription</h3>
            <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
              Update subscription tier and expiration for <strong>{user.name}</strong>.
            </p>
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 p-3 rounded-xl mb-4"
          style={{ backgroundColor: 'var(--color-admin-surface-container-high)', border: '1px solid var(--color-admin-outline-variant)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
            style={{ backgroundColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
            {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-admin-on-surface)' }}>{user.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{user.email}</p>
          </div>
        </div>

        {/* Selection */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
              Membership Tier
            </label>
            <select
              value={membership}
              onChange={e => {
                const val = e.target.value;
                setMembership(val);
                if (val === 'free') {
                  setExpiresAt('');
                } else if (!expiresAt) {
                  const matchedPlan = plans.find(p => p.planId === val);
                  const months = matchedPlan ? matchedPlan.durationMonths : 1;
                  const future = new Date();
                  future.setMonth(future.getMonth() + months);
                  setExpiresAt(future.toISOString().split('T')[0]);
                }
              }}
              className="w-full border rounded-lg p-2.5 outline-none text-sm"
              style={{
                backgroundColor: 'var(--color-admin-surface-container-lowest)',
                borderColor: 'var(--color-admin-outline-variant)',
                color: 'var(--color-admin-on-surface)',
              }}
            >
              <option value="free">Free Tier</option>
              {plans.map(p => (
                <option key={p.planId} value={p.planId}>
                  {p.name} – {p.durationMonths} {p.durationMonths === 1 ? 'Month' : 'Months'}
                </option>
              ))}
              {plans.length === 0 && (
                <>
                  <option value="premium_1m">Pro – 1 Month</option>
                  <option value="premium_3m">Pro – 3 Months</option>
                  <option value="premium_6m">Pro – 6 Months</option>
                  <option value="premium_12m">Pro – 12 Months</option>
                </>
              )}
            </select>
          </div>

          {membership !== 'free' && (
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                Expiration Date
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="w-full border rounded-lg p-2.5 outline-none text-sm"
                style={{
                  backgroundColor: 'var(--color-admin-surface-container-lowest)',
                  borderColor: 'var(--color-admin-outline-variant)',
                  color: 'var(--color-admin-on-surface)',
                }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2 rounded-lg border text-sm font-semibold hover:opacity-80 transition-opacity"
            style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface-variant)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--color-admin-primary)', color: 'var(--color-admin-on-primary)' }}>
            {loading
              ? <><div className="w-3.5 h-3.5 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div> Saving...</>
              : <><span className="material-symbols-outlined text-[16px]">save</span> Save Changes</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<Theme>('indigo');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState<string>("Admin Root");

  // Database states — powered by real-time hook
  const { users, expiryNotifications, loading, error, selectedUser, setSelectedUser, refetch: fetchUsers } = useUsersRealtime();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState('All Tiers');
  const [filterStatus, setFilterStatus] = useState('Active / All');
  const [filterBehavior, setFilterBehavior] = useState('All Behaviors');
  const [showExpiryPanel, setShowExpiryPanel] = useState(false);
  const [activeFilterType, setActiveFilterType] = useState<string | null>(null);

  // ── Conflict Audit State ──────────────────────────────────────────────────
  const [auditData, setAuditData] = useState<any>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // Dialog targets
  const [blacklistTarget, setBlacklistTarget] = useState<AdminUser | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<AdminUser | null>(null);
  const [subscriptionTarget, setSubscriptionTarget] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isEditingPoints, setIsEditingPoints] = useState(false);
  const [editPointsValue, setEditPointsValue] = useState('');
  const [pointsSaving, setPointsSaving] = useState(false);
  const [isEditingExpiry, setIsEditingExpiry] = useState(false);
  const [editExpiryValue, setEditExpiryValue] = useState('');
  const [expirySaving, setExpirySaving] = useState(false);
  const [isEditingAiExpiry, setIsEditingAiExpiry] = useState(false);
  const [editAiExpiryValue, setEditAiExpiryValue] = useState('');
  const [aiExpirySaving, setAiExpirySaving] = useState(false);

  // ── User Detail Modal state ────────────────────────────────────────────
  const [_uModalOpen, setUModalOpen] = useState<{ type: string; label: string; icon: string; color: string } | null>(null);
  const [_uModalRows, setUModalRows] = useState<any[]>([]);
  const [_uModalLoading, setUModalLoading] = useState(false);
  const [_uModalSearch, setUModalSearch] = useState('');
  const [_uModalPage, setUModalPage] = useState(1);
  const [_uModalTab, setUModalTab] = useState<'overview'|'transactions'|'sessions'|'audit'>('overview');
  const [_uModalDetailUser, setUModalDetailUser] = useState<any | null>(null);
  const [_uModalDetailLoading, setUModalDetailLoading] = useState(false);
  const _U_PAGE_SIZE = 8;

  useEffect(() => {
    setMounted(true);
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

  // Fetch conflict audit data dynamically when selected user changes
  useEffect(() => {
    if (!selectedUser) {
      setAuditData(null);
      return;
    }
    const fetchAudit = async () => {
      setAuditLoading(true);
      try {
        const res = await fetch(`/api/admin/users/audit?userId=${selectedUser.id}`);
        const data = await res.json();
        if (data.success) {
          setAuditData(data.audit);
        } else {
          setAuditData(null);
        }
      } catch {
        setAuditData(null);
      } finally {
        setAuditLoading(false);
      }
    };
    fetchAudit();
  }, [selectedUser]);



  const handleSubscriptionConfirm = async (membership: string, expiresAt: string | null) => {
    if (!subscriptionTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: subscriptionTarget.id,
          membership,
          membershipExpiresAt: expiresAt,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers(true);
        setSubscriptionTarget(null);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlacklistConfirm = async (reason: string) => {
    if (!blacklistTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: blacklistTarget.id, reason }),
      });
      const data = await res.json();
      if (data.success) {
        if (selectedUser?.id === blacklistTarget.id) {
          setSelectedUser((prev: AdminUser | null) => prev ? {
            ...prev, status: 'blacklisted', blacklistReason: reason,
            blacklistHistory: [data.auditRecord, ...prev.blacklistHistory]
          } : null);
        }
        setBlacklistTarget(null);
        fetchUsers(true);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateConfirm = async (note?: string) => {
    if (!reactivateTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/blacklist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: reactivateTarget.id, note }),
      });
      const data = await res.json();
      if (data.success) {
        if (selectedUser?.id === reactivateTarget.id) {
          setSelectedUser((prev: AdminUser | null) => prev ? {
            ...prev, status: 'active', blacklistReason: null,
            blacklistHistory: [data.auditRecord, ...prev.blacklistHistory]
          } : null);
        }
        setReactivateTarget(null);
        fetchUsers(true);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Export handlers (server-side API — no Turbopack bundler issues) ──────
  const handleExportExcel = async () => {
    try {
      const res = await fetch('/api/admin/export/users?format=excel');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Doc2LateX_Users_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 300);
    } catch (e: any) {
      alert('Excel export failed: ' + e.message);
    }
  };

  const handleExportPDF = async () => {
    try {
      const res = await fetch(`/api/admin/export/users?format=pdf&theme=${currentTheme}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Doc2LateX_Users_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 300);
    } catch (e: any) {
      alert('PDF export failed: ' + e.message);
    }
  };

  // ── User Detail Modal functions ───────────────────────────────────────
  const openUserModal = async (type: string, label: string, icon: string, color: string) => {
    setUModalOpen({ type, label, icon, color });
    setUModalRows([]);
    setUModalSearch('');
    setUModalPage(1);
    setUModalDetailUser(null);
    setUModalLoading(true);
    try {
      const res = await fetch(`/api/admin/users/detail?type=${type}`);
      const data = await res.json();
      if (data.success) setUModalRows(data.rows || []);
    } catch {}
    setUModalLoading(false);
  };

  const _openUserDetailDive = async (userId: string) => {
    setUModalDetailLoading(true);
    setUModalDetailUser(null);
    setUModalTab('overview');
    try {
      const res = await fetch(`/api/admin/users/detail?userId=${userId}`);
      const data = await res.json();
      if (data.success) setUModalDetailUser(data.user);
    } catch {}
    setUModalDetailLoading(false);
  };

  const _closeUserModal = () => { setUModalOpen(null); setUModalDetailUser(null); };

  const activeFilterColor = (() => {
    const colorMap: Record<string, string> = {
      total: 'var(--color-admin-primary)',
      active: '#10b981',
      abnormal: '#f59e0b',
      ai_overaccess: '#6366f1',
      temp_locked: '#ec4899',
      banned: 'var(--color-admin-error)',
      expiring_soon: '#f59e0b',
      expired: 'var(--color-admin-error)',
    };
    return activeFilterType ? colorMap[activeFilterType] || 'var(--color-admin-primary)' : null;
  })();

  const activeFilters: { label: string; onClear: () => void }[] = [];
  if (filterTier !== 'All Tiers') activeFilters.push({ label: `Tier: ${filterTier}`, onClear: () => setFilterTier('All Tiers') });
  if (filterStatus !== 'Active / All') activeFilters.push({ label: `Status: ${filterStatus}`, onClear: () => setFilterStatus('Active / All') });
  if (filterBehavior !== 'All Behaviors') activeFilters.push({ label: `Behavior: ${filterBehavior}`, onClear: () => setFilterBehavior('All Behaviors') });

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesTier = true;
    if (filterTier === 'Free Tier') matchesTier = u.membershipRaw === 'free';
    else if (filterTier === 'Professional (Academic)') matchesTier = u.membershipRaw !== 'free';

    let matchesStatus = true;
    const isTempBlocked = u.status !== 'blacklisted' && !!(u.blockedUntil && new Date(u.blockedUntil) > new Date());
    if (filterStatus === 'Blacklisted / Banned') {
      matchesStatus = u.status === 'blacklisted';
    } else if (filterStatus === 'Temporarily Blocked') {
      matchesStatus = isTempBlocked;
    } else if (filterStatus === 'Active / All') {
      // Show normal active and abnormal flagged users who aren't permanently banned
      matchesStatus = u.status !== 'blacklisted';
    }

    let matchesBehavior = true;
    if (filterBehavior === 'Abnormal Activity') {
      matchesBehavior = u.status === 'abnormal';
    } else if (filterBehavior === 'Over-access AI (>50k tokens)') {
      matchesBehavior = u.aiTokensUsed > 50000;
    } else if (filterBehavior === 'Normal Activity') {
      matchesBehavior = u.status !== 'abnormal' && u.aiTokensUsed <= 50000;
    }

    return matchesSearch && matchesTier && matchesStatus && matchesBehavior;
  });

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white relative overflow-hidden select-none">
        {/* Ambient glowing background */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />

        <div className="z-10 flex flex-col items-center max-w-sm w-full px-6 text-center">
          <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
            <motion.div 
              className="absolute inset-0 rounded-3xl border-2 border-transparent border-t-indigo-500 border-r-purple-500"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
            <motion.div 
              className="absolute inset-2 rounded-2xl bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 blur-sm"
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            />
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
            Loading user directory
          </p>

          <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full absolute top-0"
              initial={{ width: "30%", left: "-30%" }}
              animate={{ left: ["-30%", "100%"] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            />
          </div>
        </div>
      </div>
    );
  }

  const nowStats = new Date();
  const expiringSoon = users.filter((u: AdminUser) => {
    if (u.membershipRaw === 'free' || !u.membershipExpiresAt) return false;
    const d = new Date(u.membershipExpiresAt).getTime() - nowStats.getTime();
    return d > 0 && d <= 7 * 24 * 60 * 60 * 1000;
  });
  const expiredMemberships = users.filter((u: AdminUser) => {
    if (u.membershipRaw === 'free' || !u.membershipExpiresAt) return false;
    return new Date(u.membershipExpiresAt).getTime() <= nowStats.getTime();
  });

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''} transition-colors duration-500`}
      style={{ backgroundColor: 'var(--color-admin-background)', color: 'var(--color-admin-on-background)' }}>

      {/* ── Theme CSS Variables ── */}

      <AdminSidebar isDarkMode={isDarkMode} adminName={adminName} />

      {/* ── Dialogs ── */}
      {blacklistTarget && (
        <BlacklistConfirmDialog
          user={blacklistTarget}
          onConfirm={handleBlacklistConfirm}
          onCancel={() => setBlacklistTarget(null)}
          loading={actionLoading}
        />
      )}
      {reactivateTarget && (
        <ReactivateConfirmDialog
          user={reactivateTarget}
          onConfirm={handleReactivateConfirm}
          onCancel={() => setReactivateTarget(null)}
          loading={actionLoading}
        />
      )}
      {subscriptionTarget && (
        <SubscriptionEditDialog
          user={subscriptionTarget}
          onConfirm={handleSubscriptionConfirm}
          onCancel={() => setSubscriptionTarget(null)}
          loading={actionLoading}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className="flex flex-col h-full p-4 gap-2 fixed h-screen w-64 left-0 top-0 border-r z-50 transition-colors duration-500"
        style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
        <div className="flex flex-col items-center gap-1 px-2 mb-6 mt-2 text-center">
          <Image src="/logo.png" alt="Latexify Logo" width={192} height={48} className="w-48 h-12 object-contain"
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
          <a className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all translate-x-1 duration-200 shadow-sm"
            style={{ backgroundColor: 'var(--color-admin-secondary-container)', color: 'var(--color-admin-on-secondary-container)' }} href="#">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>Users
          </a>
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
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm outline-none"
                style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                placeholder="Search users by name, email or ID..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setShowExpiryPanel(!showExpiryPanel)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors relative"
                style={{ color: expiryNotifications.length > 0 ? '#f59e0b' : 'var(--color-admin-on-surface-variant)' }}>
                <span className="material-symbols-outlined">notifications</span>
                {expiryNotifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center shadow-lg">
                    {expiryNotifications.length}
                  </span>
                )}
              </button>
              {showExpiryPanel && expiryNotifications.length > 0 && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border shadow-2xl overflow-hidden z-50"
                  style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-outline-variant)' }}>
                  <div className="p-3 border-b" style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                      Expiring Memberships
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {expiryNotifications.map(n => (
                      <div key={n.id} className="flex items-center gap-3 p-3 border-b hover:bg-black/5 transition-colors"
                        style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                        <div className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{
                          backgroundColor: n.daysRemaining <= 1 ? 'var(--color-admin-error)' : n.daysRemaining <= 3 ? '#f59e0b' : '#4ade80'
                        }}></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-admin-on-surface)' }}>
                            {n.userName}
                          </p>
                          <p className="text-[10px] truncate" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                            {n.planType} — {n.userEmail}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold" style={{
                            color: n.daysRemaining <= 1 ? 'var(--color-admin-error)' : n.daysRemaining <= 3 ? '#f59e0b' : 'var(--color-admin-on-surface)'
                          }}>
                            {n.daysRemaining}d
                          </p>
                          <p className="text-[9px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>left</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-2 border-t" style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                    <button onClick={async () => {
                      try {
                        await fetch('/api/admin/users/notify-expiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                        fetchUsers(true);
                      } catch {}
                    }}
                      className="w-full text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg border hover:opacity-80 transition-opacity"
                      style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-primary)' }}>
                      Send Reminders Now
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Switcher */}
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
                    {(['indigo', 'emerald', 'rose', 'violet', 'amber', 'cyan', 'sky', 'pink', 'orange', 'lime', 'teal', 'fuchsia', 'red', 'yellow', 'stone', 'zinc'] as const).map(t => (
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
              )}
            </div>

            <Link href="/admin/profile" className="p-2 hover:bg-black/5 rounded-full transition-colors"
              style={{ color: 'var(--color-admin-on-surface-variant)' }}>
              <span className="material-symbols-outlined">settings</span>
            </Link>
            <div className="h-8 w-px" style={{ backgroundColor: 'var(--color-admin-outline-variant)' }}></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>{adminName}</p>
                <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Super Admin</p>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                {adminName.split(/\s+/).map(n => n[0]).join("").slice(0,2).toUpperCase() || "AR"}
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-8 overflow-y-auto max-h-[calc(100vh-73px)] custom-scrollbar">
          {/* Title */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-admin-on-surface)' }}>User Management</h2>
              <p style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                Oversee system participants, handle access controls, and analyze user health.
              </p>
            </div>
             <div className="flex gap-2">
               <button onClick={() => fetchUsers()}
                 className="flex items-center gap-2 border px-4 py-2 rounded-lg hover:opacity-80 transition-all font-semibold"
                 style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                 <span className="material-symbols-outlined text-[20px]">refresh</span>Refresh List
               </button>
               <button onClick={handleExportExcel}
                 className="flex items-center gap-2 border px-4 py-2 rounded-lg hover:opacity-80 transition-all font-semibold"
                 style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                 <span className="material-symbols-outlined text-[20px] text-green-500">table_view</span>Export Excel
               </button>
               <button onClick={handleExportPDF}
                 className="flex items-center gap-2 border px-4 py-2 rounded-lg hover:opacity-80 transition-all font-semibold"
                 style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                 <span className="material-symbols-outlined text-[20px] text-red-500">picture_as_pdf</span>Export PDF
               </button>
             </div>
          </div>

          {/* Expiry Alert Banner */}
          {expiryNotifications.length > 0 && (
            <div className="mb-4 p-4 rounded-xl border flex items-center justify-between"
              style={{
                backgroundColor: 'rgba(245,158,11,0.06)',
                borderColor: 'rgba(245,158,11,0.25)',
                borderLeft: '4px solid #f59e0b'
              }}>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontVariationSettings: "'FILL' 1" }}>
                  notification_important
                </span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-admin-on-surface)' }}>
                    {expiryNotifications.length} membership{expiryNotifications.length !== 1 ? 's' : ''} expiring soon
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                    {expiryNotifications.filter(n => n.daysRemaining <= 0).length} expired ·{' '}
                    {expiryNotifications.filter(n => n.daysRemaining === 1).length} expiring today ·{' '}
                    {expiryNotifications.filter(n => n.daysRemaining >= 2 && n.daysRemaining <= 3).length} within 3 days
                  </p>
                </div>
              </div>
              <button onClick={() => setShowExpiryPanel(!showExpiryPanel)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border hover:opacity-80 transition-opacity"
                style={{ borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)' }}>
                View Details
              </button>
            </div>
          )}

          {/* Stats summary bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
            {(() => {
              const rawCards = [
                {
                  label: 'Total Users',
                  value: users.length,
                  type: 'total',
                  icon: 'group',
                  color: 'var(--color-admin-primary)',
                  bg: 'rgba(99,102,241,0.06)',
                  onClick: () => {
                    setActiveFilterType('total');
                    setFilterTier('All Tiers');
                    setFilterStatus('Active / All');
                    setFilterBehavior('All Behaviors');
                    openUserModal('total', 'Total Users', 'group', '#a5b4fc');
                  }
                },
                {
                  label: 'Active Users',
                  value: users.filter(u => u.status !== 'blacklisted').length,
                  type: 'active',
                  icon: 'check_circle',
                  color: '#10b981',
                  bg: 'rgba(16,185,129,0.06)',
                  onClick: () => {
                    setActiveFilterType('active');
                    setFilterStatus('Active / All');
                    setFilterBehavior('All Behaviors');
                    openUserModal('active', 'Active Users', 'check_circle', '#10b981');
                  }
                },
                {
                  label: 'Abnormal Users',
                  value: users.filter(u => u.status === 'abnormal').length,
                  type: 'abnormal',
                  icon: 'warning',
                  color: '#f59e0b',
                  bg: 'rgba(245,158,11,0.06)',
                  onClick: () => {
                    setActiveFilterType('abnormal');
                    setFilterBehavior('Abnormal Activity');
                    setFilterStatus('Active / All');
                    openUserModal('abnormal', 'Abnormal Activity Users', 'warning', '#f59e0b');
                  }
                },
                {
                  label: 'AI Over-Access',
                  value: users.filter(u => u.aiTokensUsed > 50000).length,
                  type: 'ai_overaccess',
                  icon: 'psychology',
                  color: '#6366f1',
                  bg: 'rgba(99,102,241,0.06)',
                  onClick: () => {
                    setActiveFilterType('ai_overaccess');
                    setFilterBehavior('Over-access AI (>50k tokens)');
                    openUserModal('ai_overaccess', 'AI Over-Access Users (>50k tokens)', 'psychology', '#6366f1');
                  }
                },
                {
                  label: 'Temp Locked',
                  value: users.filter(u => u.status !== 'blacklisted' && !!(u.blockedUntil && new Date(u.blockedUntil) > new Date())).length,
                  type: 'temp_locked',
                  icon: 'gavel',
                  color: '#ec4899',
                  bg: 'rgba(236,72,153,0.06)',
                  onClick: () => {
                    setActiveFilterType('temp_locked');
                    setFilterStatus('Temporarily Blocked');
                    openUserModal('temp_locked', 'Temporarily Locked Users', 'gavel', '#ec4899');
                  }
                },
                {
                  label: 'Banned Users',
                  value: users.filter(u => u.status === 'blacklisted').length,
                  type: 'banned',
                  icon: 'block',
                  color: 'var(--color-admin-error)',
                  bg: 'rgba(239,68,68,0.06)',
                  onClick: () => {
                    setActiveFilterType('banned');
                    setFilterStatus('Blacklisted / Banned');
                    openUserModal('banned', 'Blacklisted / Banned Users', 'block', '#ef4444');
                  }
                },
                {
                  label: 'Expiring Soon',
                  value: expiringSoon.length,
                  type: 'expiring_soon',
                  icon: 'hourglass_top',
                  color: '#f59e0b',
                  bg: 'rgba(245,158,11,0.06)',
                  onClick: () => {
                    setActiveFilterType('expiring_soon');
                    openUserModal('expiring_soon', 'Expiring Soon (≤7 days)', 'hourglass_top', '#f59e0b');
                  }
                },
                {
                  label: 'Expired',
                  value: expiredMemberships.length,
                  type: 'expired',
                  icon: 'timer_off',
                  color: 'var(--color-admin-error)',
                  bg: 'rgba(239,68,68,0.06)',
                  onClick: () => {
                    setActiveFilterType('expired');
                    openUserModal('expired', 'Expired Memberships', 'timer_off', '#ef4444');
                  }
                },
              ];
              return rawCards.map(s => {
                const isActive = activeFilterType === s.type;
                return (
                  <div
                    key={s.label}
                    onClick={s.onClick}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 cursor-pointer group select-none ${isActive ? 'shadow-lg' : 'hover:-translate-y-1 hover:shadow-lg'} transition-all duration-300 active:scale-[0.97]`}
                    style={{
                      backgroundColor: isActive ? s.color : 'var(--color-admin-surface-container)',
                      borderTopColor: isActive ? s.color : 'var(--color-admin-outline-variant)',
                      borderLeftColor: isActive ? s.color : 'var(--color-admin-outline-variant)',
                      borderRightColor: isActive ? s.color : 'var(--color-admin-outline-variant)',
                      borderBottomWidth: '3px',
                      borderBottomColor: s.color,
                    }}>
                    <div className="flex justify-between items-center">
                      <span className="material-symbols-outlined text-[24px] p-2 rounded-lg shrink-0 transition-transform group-hover:scale-110"
                        style={{ color: isActive ? '#fff' : s.color, backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : s.bg, fontVariationSettings: "'FILL' 1" }}>
                        {s.icon}
                      </span>
                      <span className="text-2xl font-black" style={{ color: isActive ? '#fff' : 'var(--color-admin-on-surface)' }}>
                        {s.value}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: isActive ? 'rgba(255,255,255,0.9)' : 'var(--color-admin-on-surface-variant)' }}>
                      {isActive ? 'Active Filter' : s.label}
                    </p>
                  </div>
                );
              });
            })()}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Membership Tier', value: filterTier, setter: setFilterTier, options: ['All Tiers', 'Free Tier', 'Professional (Academic)'] },
              { label: 'Account Status', value: filterStatus, setter: setFilterStatus, options: ['Active / All', 'Blacklisted / Banned', 'Temporarily Blocked'] },
              { label: 'Behavior Monitoring', value: filterBehavior, setter: setFilterBehavior, options: ['All Behaviors', 'Normal Activity', 'Abnormal Activity', 'Over-access AI (>50k tokens)'] },
            ].map(f => (
              <div key={f.label} className="border p-4 rounded-xl"
                style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{f.label}</p>
                <select value={f.value} onChange={e => f.setter(e.target.value)}
                  className="w-full border rounded-lg p-2 outline-none text-sm font-medium"
                  style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                  {f.options.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div onClick={() => { setFilterTier('All Tiers'); setFilterStatus('Active / All'); setFilterBehavior('All Behaviors'); setSearchQuery(''); setActiveFilterType(null); }}
              className="flex items-center justify-center border border-dashed p-4 rounded-xl cursor-pointer hover:bg-black/5 transition-all group"
              style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-primary)' }}>
              <span className="material-symbols-outlined mr-2 group-hover:scale-110 transition-transform" style={{ color: 'var(--color-admin-primary)' }}>filter_list_off</span>
              <span className="font-semibold" style={{ color: 'var(--color-admin-primary)' }}>Reset All Filters</span>
            </div>
          </div>

          {/* Active Filter Chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Active Filters:</span>
              {activeFilters.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all"
                  style={{
                    backgroundColor: 'var(--color-admin-surface-container-high)',
                    borderColor: 'var(--color-admin-outline-variant)',
                    color: 'var(--color-admin-on-surface)',
                  }}>
                  <span>{f.label}</span>
                  <button onClick={f.onClear} className="hover:opacity-70 transition-opacity ml-0.5">
                    <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>close</span>
                  </button>
                </div>
              ))}
              <button onClick={() => { setFilterTier('All Tiers'); setFilterStatus('Active / All'); setFilterBehavior('All Behaviors'); setActiveFilterType(null); }}
                className="text-[10px] font-bold uppercase tracking-wider hover:opacity-70 transition-opacity"
                style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                Clear all
              </button>
            </div>
          )}

          <div className="flex gap-6">
            {/* Main Table */}
            <div className="flex-1 border rounded-xl overflow-hidden flex flex-col"
              style={{
                backgroundColor: 'var(--color-admin-surface-container)',
                borderColor: activeFilterColor || 'var(--color-admin-outline-variant)',
                borderLeftWidth: activeFilterColor ? '4px' : '1px',
                borderLeftColor: activeFilterColor || 'var(--color-admin-outline-variant)',
              }}>
              {(loading && users.length === 0) ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500/10 border-t-indigo-500 animate-spin" style={{ borderTopColor: 'var(--color-admin-primary)' }}></div>
                  <span className="text-xs font-bold uppercase tracking-wider opacity-60" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Loading Users...</span>
                </div>
              ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-2" style={{ color: 'var(--color-admin-error)' }}>
                  <span className="material-symbols-outlined text-3xl">error</span>
                  <span>{error}</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b" style={{
                        backgroundColor: activeFilterColor ? `${activeFilterColor}15` : 'var(--color-admin-surface-container-high)',
                        borderColor: 'var(--color-admin-outline-variant)',
                      }}>
                        {['User Identity', 'Plan', 'Expiry', 'Days Remaining', 'AI Usage', 'Projects', 'Email', 'Status', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-4 uppercase tracking-wider text-xs font-bold"
                            style={{ color: 'var(--color-admin-on-surface-variant)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                      {filteredUsers.map(u => (
                        <tr key={u.id} onClick={() => { setSelectedUser(u); setIsEditingPoints(false); }}
                          className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${selectedUser?.id === u.id ? `bg-black/10 dark:bg-white/10` : ''}`}
                          style={selectedUser?.id === u.id && activeFilterColor ? { backgroundColor: `${activeFilterColor}12` } : undefined}>
                          {/* Identity */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                                style={{ backgroundColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                                {u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate max-w-[110px] text-sm" style={{ color: 'var(--color-admin-on-surface)' }}>{u.name}</p>
                                <p className="text-xs opacity-60 truncate max-w-[110px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                                  {u.id.substring(0, 8)}…
                                </p>
                              </div>
                            </div>
                          </td>
                          {/* Plan */}
                          <td className="px-4 py-4">
                            <PlanBadge membership={u.membership} membershipRaw={u.membershipRaw} />
                          </td>
                          {/* Expiry */}
                          <td className="px-4 py-4">
                            <ExpiryCell membershipRaw={u.membershipRaw} membershipExpiresAt={u.membershipExpiresAt} />
                          </td>
                          {/* Days Remaining */}
                          <td className="px-4 py-4">
                            {(() => {
                              if (u.membershipRaw === 'free' || !u.membershipExpiresAt) {
                                return <span className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>—</span>;
                              }
                              const now = new Date();
                              const expiry = new Date(u.membershipExpiresAt);
                              const diffMs = expiry.getTime() - now.getTime();
                              const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                              const expired = daysLeft <= 0;
                              return (
                                <span className="text-sm font-bold" style={{
                                  color: expired ? 'var(--color-admin-error)' : daysLeft <= 3 ? '#f59e0b' : 'var(--color-admin-on-surface)'
                                }}>
                                  {expired ? 'Expired' : `${daysLeft}d`}
                                </span>
                              );
                            })()}
                          </td>
                          {/* AI Usage */}
                          <td className="px-4 py-4 text-center">
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-admin-on-surface)' }}>
                              {u.aiTokensUsed.toLocaleString()}
                            </p>
                            <p className="text-[10px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>tokens</p>
                          </td>
                          {/* Projects */}
                          <td className="px-4 py-4 text-center">
                            <span className="font-semibold" style={{ color: 'var(--color-admin-on-surface)' }}>{u.projectCount}</span>
                          </td>
                          {/* Email */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                              <span className="material-symbols-outlined text-[14px]">mail</span>
                              <span className="truncate max-w-[130px]">{u.email}</span>
                            </div>
                          </td>
                          {/* Status */}
                          <td className="px-4 py-4">
                            {(() => {
                               const isTempBlocked = u.status !== 'blacklisted' && !!(u.blockedUntil && new Date(u.blockedUntil) > new Date());
                               return (
                                 <div className="flex items-center gap-2 text-xs font-medium"
                                   style={{
                                     color: u.status === 'blacklisted' ? 'var(--color-admin-error)' : isTempBlocked ? '#f59e0b' : '#4ade80'
                                   }}>
                                   <span className="w-2 h-2 rounded-full shrink-0"
                                     style={{ backgroundColor: u.status === 'blacklisted' ? 'var(--color-admin-error)' : isTempBlocked ? '#f59e0b' : '#4ade80' }}></span>
                                   <span>{u.status === 'blacklisted' ? 'Blacklisted' : isTempBlocked ? 'Blocked (Temp)' : 'Active'}</span>
                                 </div>
                               );
                             })()}
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-4 text-right">
                            {(() => {
                              const isTempBlocked = u.status !== 'blacklisted' && !!(u.blockedUntil && new Date(u.blockedUntil) > new Date());
                              if (u.status === 'blacklisted') {
                                return (
                                  <button
                                    onClick={e => { e.stopPropagation(); setReactivateTarget(u); }}
                                    className="px-3 py-1 text-xs rounded border font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
                                    style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}>
                                    ✓ Activate
                                  </button>
                                );
                              } else if (isTempBlocked) {
                                return (
                                  <button
                                    onClick={e => { e.stopPropagation(); setReactivateTarget(u); }}
                                    className="px-3 py-1 text-xs rounded border font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
                                    style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}>
                                    ✓ Unblock
                                  </button>
                                );
                              } else {
                                return (
                                  <button
                                    onClick={e => { e.stopPropagation(); setBlacklistTarget(u); }}
                                    className="px-3 py-1 text-xs rounded border font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
                                    style={{ backgroundColor: 'var(--color-admin-error-container)', color: 'var(--color-admin-on-error-container)', borderColor: 'var(--color-admin-error)' }}>
                                    Blacklist
                                  </button>
                                );
                              }
                            })()}
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={9} className="text-center py-8 text-sm" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                            no entries are available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div className="px-6 py-3 border-t flex justify-between items-center"
                    style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-outline-variant)' }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                      Showing {filteredUsers.length} of {users.length} users
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Side Panel */}
            <aside className="w-80 flex flex-col gap-6 shrink-0">
              {/* Selected User Card */}
              {selectedUser && (
                <div className="border rounded-xl p-6 relative overflow-hidden"
                  style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                  <p className="uppercase tracking-widest mb-1.5 text-[10px] font-bold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Selected User Health</p>
                  
                  {/* Geo Location display */}
                  <div className="mb-3 text-xs flex items-center gap-1 font-semibold" style={{ color: 'var(--color-admin-on-surface)' }}>
                    <span className="material-symbols-outlined text-[15px] select-none" style={{ color: 'var(--color-admin-primary)', fontVariationSettings: "'FILL' 1" }}>location_on</span>
                    <span>Geo Location: <strong style={{ color: 'var(--color-admin-on-surface)' }}>{selectedUser.lastLocation || 'Unknown Location'}</strong></span>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold truncate max-w-[140px]" style={{ color: 'var(--color-admin-on-surface)' }}>{selectedUser.name}</h3>
                    <div className="flex flex-col gap-1 items-end">
                      <span className="px-2 py-0.5 rounded border text-[10px] font-bold uppercase"
                        style={selectedUser.status === 'active'
                          ? { color: '#4ade80', backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.2)' }
                          : selectedUser.status === 'blacklisted'
                            ? { color: 'var(--color-admin-error)', backgroundColor: 'rgba(255,180,171,0.2)', borderColor: 'rgba(255,180,171,0.3)' }
                            : { color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.2)' }
                        }>
                        {selectedUser.status === 'active' ? 'Active' : selectedUser.status === 'blacklisted' ? 'Suspended' : 'Abnormal'}
                      </span>
                      {auditData && (
                        <span className="px-2 py-0.5 rounded border text-[9px] font-bold uppercase"
                          style={auditData.overallRisk === 'High Risk'
                            ? { color: 'var(--color-admin-error)', backgroundColor: 'rgba(255,180,171,0.15)', borderColor: 'rgba(255,180,171,0.3)' }
                            : auditData.overallRisk === 'Medium Risk'
                              ? { color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.2)' }
                              : { color: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }
                          }>
                          {auditData.overallRisk}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Plan info */}
                    <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-admin-surface-container-low)', borderColor: 'var(--color-admin-outline-variant)' }}>
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Subscription Plan</p>
                        <button
                          onClick={() => setSubscriptionTarget(selectedUser)}
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border hover:opacity-85 transition-opacity"
                          style={{
                            borderColor: 'var(--color-admin-primary)',
                            color: 'var(--color-admin-primary)',
                            backgroundColor: 'rgba(195,192,255,0.05)'
                          }}
                        >
                          Tier
                        </button>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <PlanBadge membership={selectedUser.membership} membershipRaw={selectedUser.membershipRaw} />
                        </div>
                        {selectedUser.membershipRaw !== 'free' && (
                          <div className="flex flex-col items-end gap-1">
                            {isEditingExpiry ? (
                              <div className="flex flex-col items-end gap-1">
                                <input
                                  type="date"
                                  value={editExpiryValue}
                                  onChange={e => setEditExpiryValue(e.target.value)}
                                  className="text-[11px] rounded border px-1.5 py-0.5 outline-none font-sans"
                                  style={{
                                    backgroundColor: 'var(--color-admin-surface-container-lowest)',
                                    borderColor: 'var(--color-admin-outline-variant)',
                                    color: 'var(--color-admin-on-surface)',
                                    width: '120px'
                                  }}
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    disabled={expirySaving}
                                    onClick={async () => {
                                      setExpirySaving(true);
                                      try {
                                        const res = await fetch('/api/admin/users', {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            id: selectedUser.id,
                                            membershipExpiresAt: editExpiryValue ? new Date(editExpiryValue).toISOString() : null
                                          })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                          setSelectedUser((prev: AdminUser | null) => prev ? {
                                            ...prev,
                                            membershipExpiresAt: data.user.membershipExpiresAt
                                          } : null);
                                          setIsEditingExpiry(false);
                                          fetchUsers(true);
                                        } else {
                                          alert(data.error || "Failed to update expiry date");
                                        }
                                      } catch (e: any) {
                                        alert(`Error: ${e.message}`);
                                      } finally {
                                        setExpirySaving(false);
                                      }
                                    }}
                                    className="text-[9px] font-bold text-emerald-500 uppercase px-1 rounded hover:bg-black/5"
                                  >
                                    {expirySaving ? '...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => setIsEditingExpiry(false)}
                                    className="text-[9px] font-bold text-rose-500 uppercase px-1 rounded hover:bg-black/5"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-right shrink-0" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                                  Exp: {selectedUser.membershipExpiresAt
                                    ? new Date(selectedUser.membershipExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                    : 'No expiry'}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditExpiryValue(
                                      selectedUser.membershipExpiresAt
                                        ? new Date(selectedUser.membershipExpiresAt).toISOString().split('T')[0]
                                        : ''
                                    );
                                    setIsEditingExpiry(true);
                                  }}
                                  className="text-[9px] font-bold text-primary uppercase px-1 rounded hover:bg-black/5"
                                >
                                  Edit
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Plan Info */}
                    <div className="p-3 rounded-lg border animate-fade-in" style={{ backgroundColor: 'var(--color-admin-surface-container-low)', borderColor: 'var(--color-admin-outline-variant)' }}>
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>AI Plan</p>
                        <button
                          onClick={() => setSubscriptionTarget(selectedUser)}
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border hover:opacity-85 transition-opacity"
                          style={{
                            borderColor: 'var(--color-admin-primary)',
                            color: 'var(--color-admin-primary)',
                            backgroundColor: 'rgba(195,192,255,0.05)'
                          }}
                        >
                          Change
                        </button>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>
                            {selectedUser.aiCapPlanId === 'pro' || selectedUser.membershipRaw !== 'free' ? 'Pro Plan' : 'Free Plan'}
                          </span>
                          {selectedUser.aiPlanStartsAt && (
                            <span className="text-[9px] opacity-70" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                              Started: {new Date(selectedUser.aiPlanStartsAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isEditingAiExpiry ? (
                            <div className="flex flex-col items-end gap-1">
                              <input
                                type="date"
                                value={editAiExpiryValue}
                                onChange={e => setEditAiExpiryValue(e.target.value)}
                                className="text-[11px] rounded border px-1.5 py-0.5 outline-none font-sans"
                                style={{
                                  backgroundColor: 'var(--color-admin-surface-container-lowest)',
                                  borderColor: 'var(--color-admin-outline-variant)',
                                  color: 'var(--color-admin-on-surface)',
                                  width: '120px'
                                }}
                              />
                              <div className="flex gap-1.5">
                                <button
                                  disabled={aiExpirySaving}
                                  onClick={async () => {
                                    setAiExpirySaving(true);
                                    try {
                                      const res = await fetch('/api/admin/users', {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          id: selectedUser.id,
                                          aiPlanExpiresAt: editAiExpiryValue ? new Date(editAiExpiryValue).toISOString() : null,
                                          aiPlanStartsAt: selectedUser.aiPlanStartsAt ? undefined : new Date().toISOString()
                                        })
                                      });
                                      const data = await res.json();
                                      if (data.success) {
                                        setSelectedUser((prev: AdminUser | null) => prev ? {
                                          ...prev,
                                          aiPlanExpiresAt: data.user.aiPlanExpiresAt,
                                          aiPlanStartsAt: data.user.aiPlanStartsAt || prev.aiPlanStartsAt
                                        } : null);
                                        setIsEditingAiExpiry(false);
                                        fetchUsers(true);
                                      } else {
                                        alert(data.error || "Failed to update AI expiry date");
                                      }
                                    } catch (e: any) {
                                      alert(`Error: ${e.message}`);
                                    } finally {
                                      setAiExpirySaving(false);
                                    }
                                  }}
                                  className="text-[9px] font-bold text-emerald-500 uppercase px-1 rounded hover:bg-black/5"
                                >
                                  {aiExpirySaving ? '...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setIsEditingAiExpiry(false)}
                                  className="text-[9px] font-bold text-rose-500 uppercase px-1 rounded hover:bg-black/5"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-right shrink-0" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                                Exp: {selectedUser.aiPlanExpiresAt
                                  ? new Date(selectedUser.aiPlanExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                  : 'No expiry'}
                              </span>
                              <button
                                onClick={() => {
                                  setEditAiExpiryValue(
                                    selectedUser.aiPlanExpiresAt
                                      ? new Date(selectedUser.aiPlanExpiresAt).toISOString().split('T')[0]
                                      : ''
                                  );
                                  setIsEditingAiExpiry(true);
                                }}
                                className="text-[9px] font-bold text-primary uppercase px-1 rounded hover:bg-black/5"
                              >
                                Edit
                              </button>
                            </div>
                          )}
                          {selectedUser.aiPlanExpiresAt && (
                            <span className="text-[9px] font-bold text-emerald-400">
                              ({Math.max(0, Math.ceil((new Date(selectedUser.aiPlanExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days remaining)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border flex flex-col justify-between" style={{ backgroundColor: 'var(--color-admin-surface-container-low)', borderColor: 'var(--color-admin-outline-variant)' }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Points</span>
                          {isEditingPoints ? (
                            <div className="flex gap-1.5">
                              <button
                                disabled={pointsSaving}
                                onClick={async () => {
                                  if (!editPointsValue.trim()) return;
                                  setPointsSaving(true);
                                  try {
                                    const res = await fetch('/api/admin/users', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: selectedUser.id, points: editPointsValue })
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                      setSelectedUser((prev: AdminUser | null) => prev ? { 
                                        ...prev, 
                                        points: data.user.points, 
                                        membershipRaw: data.user.membership,
                                        membershipExpiresAt: data.user.membershipExpiresAt 
                                      } : null);
                                      setIsEditingPoints(false);
                                      fetchUsers(true);
                                    } else {
                                      alert(data.error || "Failed to update points");
                                    }
                                  } catch (e: any) {
                                    alert(`Error: ${e.message}`);
                                  } finally {
                                    setPointsSaving(false);
                                  }
                                }}
                                className="text-[9px] font-bold text-emerald-500 uppercase px-1 rounded hover:bg-black/5"
                              >
                                {pointsSaving ? '...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setIsEditingPoints(false)}
                                className="text-[9px] font-bold text-rose-500 uppercase px-1 rounded hover:bg-black/5"
                              >
                                X
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditPointsValue(selectedUser.points.toString());
                                setIsEditingPoints(true);
                              }}
                              className="text-[9px] font-bold text-primary uppercase px-1 rounded hover:bg-black/5"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        {isEditingPoints ? (
                          <input
                            type="number"
                            value={editPointsValue}
                            onChange={e => setEditPointsValue(e.target.value)}
                            className="w-full text-sm font-semibold rounded border px-2 py-0.5 outline-none"
                            style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                          />
                        ) : (
                          <p className="text-xl font-bold" style={{ color: 'var(--color-admin-primary)' }}>{selectedUser.points}</p>
                        )}
                      </div>
                      <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-admin-surface-container-low)', borderColor: 'var(--color-admin-outline-variant)' }}>
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Projects</p>
                        <p className="text-xl font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>{selectedUser.projectCount}</p>
                      </div>
                    </div>

                    {/* Customer Life Cycle */}
                    <div className="p-4 rounded-lg border space-y-3" style={{ backgroundColor: 'var(--color-admin-surface-container-low)', borderColor: 'var(--color-admin-outline-variant)' }}>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Customer Life Cycle</p>
                      
                      <div className="flex justify-between items-start text-xs">
                        <span style={{ color: 'var(--color-admin-on-surface-variant)' }}>Joining Date:</span>
                        <div className="text-right">
                          <p className="font-semibold" style={{ color: 'var(--color-admin-on-surface)' }}>
                            {selectedUser.joiningDate
                              ? new Date(selectedUser.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '—'}
                          </p>
                          {selectedUser.joiningDate && (
                            <span className="text-[10px] opacity-70 block font-medium" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                              ({getDaysSince(selectedUser.joiningDate)} day{getDaysSince(selectedUser.joiningDate) !== 1 ? 's' : ''} active)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span style={{ color: 'var(--color-admin-on-surface-variant)' }}>Last Login IP:</span>
                        <span className="font-semibold font-mono" style={{ color: 'var(--color-admin-on-surface)' }}>
                          {selectedUser.lastIp || '127.0.0.1'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span style={{ color: 'var(--color-admin-on-surface-variant)' }}>Geo Location:</span>
                        <span className="font-semibold truncate max-w-[140px]" style={{ color: 'var(--color-admin-on-surface)' }} title={selectedUser.lastLocation}>
                          {selectedUser.lastLocation || 'Localhost'}
                        </span>
                      </div>
                      {(selectedUser.lastLatitude != null || selectedUser.lastLongitude != null) && (
                        <div className="flex justify-between items-center text-xs">
                          <span style={{ color: 'var(--color-admin-on-surface-variant)' }}>Coordinates:</span>
                          <span className="font-semibold font-mono text-[11px]" style={{ color: 'var(--color-admin-on-surface)' }}>
                            {selectedUser.lastLatitude != null ? selectedUser.lastLatitude.toFixed(4) : '?'}, {selectedUser.lastLongitude != null ? selectedUser.lastLongitude.toFixed(4) : '?'}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs">
                        <span style={{ color: 'var(--color-admin-on-surface-variant)' }}>Subscriptions:</span>
                        <span className="font-semibold" style={{ color: 'var(--color-admin-on-surface)' }}>
                          {selectedUser.paidTransactions?.length || 0} time{selectedUser.paidTransactions?.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span style={{ color: 'var(--color-admin-on-surface-variant)' }}>Expiry:</span>
                        <span className="font-semibold" style={{ color: selectedUser.membershipRaw === 'free' ? 'var(--color-admin-on-surface-variant)' : 'var(--color-admin-primary)' }}>
                          {selectedUser.membershipRaw === 'free'
                            ? 'Never (Free Tier)'
                            : (selectedUser.membershipExpiresAt
                              ? new Date(selectedUser.membershipExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                              : 'No expiration date')}
                        </span>
                      </div>
                    </div>

                    {/* Add-on Plans / Billing History */}
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-admin-surface-container-low)', borderColor: 'var(--color-admin-outline-variant)' }}>
                      <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Add-on / Purchase History</p>
                      {selectedUser.paidTransactions && selectedUser.paidTransactions.length > 0 ? (
                        <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                          {selectedUser.paidTransactions.map((tx: any) => (
                            <div key={tx.id} className="flex justify-between items-center text-[11px] p-2 rounded border" style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-outline-variant)' }}>
                              <div>
                                <p className="font-semibold capitalize" style={{ color: 'var(--color-admin-on-surface)' }}>
                                  {tx.planType.replace('premium_', '').replace('m', ' Month')} Plan
                                </p>
                                <p className="text-[9px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                                  {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                </p>
                              </div>
                              <span className="font-bold text-emerald-400">
                                {tx.amount > 0 ? `${getCurrencySymbol(tx.currency || 'INR')}${tx.amount}` : 'Promo'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-center py-2 italic" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                          no entries are available
                        </p>
                      )}
                    </div>

                    {/* Blacklist reason (if suspended) */}
                    {selectedUser.status === 'blacklisted' && selectedUser.blacklistReason && (
                      <div className="p-3 rounded-lg border"
                        style={{ backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)', borderLeft: '3px solid var(--color-admin-error)' }}>
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-admin-error)' }}>Suspension Reason</p>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{selectedUser.blacklistReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* System info / Conflict Audit */}
              <div className="border rounded-xl p-6"
                style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                <h4 className="flex items-center gap-2 mb-4 border-b pb-3 font-semibold text-sm"
                  style={{ color: 'var(--color-admin-on-surface)', borderColor: 'var(--color-admin-outline-variant)' }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-admin-error)', fontVariationSettings: "'FILL' 1" }}>report</span>
                  System Conflict Audit
                </h4>
                
                {!selectedUser ? (
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'rgba(255,180,171,0.2)' }}>
                        <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-admin-error)' }}>security</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--color-admin-on-surface)' }}>Select a User</p>
                        <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                          Click any user in the directory list to run a live compliance & threat audit.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : auditLoading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="w-6 h-6 rounded-full border-2 border-indigo-500/10 border-t-indigo-500 animate-spin" style={{ borderTopColor: 'var(--color-admin-primary)' }}></div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Analyzing logs & detecting conflicts...</p>
                  </div>
                ) : auditData ? (
                  <div className="space-y-5">
                    {/* 1. Security check */}
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ 
                          backgroundColor: auditData.security.status === 'critical' ? 'rgba(239,68,68,0.15)' : auditData.security.status === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(74,222,128,0.15)',
                          color: auditData.security.status === 'critical' ? 'var(--color-admin-error)' : auditData.security.status === 'warning' ? '#f59e0b' : '#4ade80'
                        }}>
                        <span className="material-symbols-outlined text-[18px]">security</span>
                      </div>
                      <div>
                        <p className="font-semibold text-xs flex items-center gap-1.5" style={{ color: 'var(--color-admin-on-surface)' }}>
                          Session & IP Security
                          {auditData.security.status !== 'clean' && (
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: auditData.security.status === 'critical' ? 'var(--color-admin-error)' : '#f59e0b' }} />
                          )}
                        </p>
                        <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                          {auditData.security.message}
                        </p>
                        {auditData.security.recent && auditData.security.recent.length > 0 && (
                          <div className="mt-1.5 p-1.5 rounded text-[9px] font-mono leading-tight space-y-0.5" style={{ backgroundColor: 'var(--color-admin-surface-container-low)', color: 'var(--color-admin-on-surface-variant)' }}>
                            <p className="font-bold border-b pb-0.5 mb-0.5">Recent Locations:</p>
                            {auditData.security.recent.map((rec: any, idx: number) => (
                              <p key={idx}>• {rec.location} ({rec.ip})</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. AI Tokens usage */}
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ 
                          backgroundColor: auditData.ai.status === 'critical' ? 'rgba(239,68,68,0.15)' : auditData.ai.status === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(74,222,128,0.15)',
                          color: auditData.ai.status === 'critical' ? 'var(--color-admin-error)' : auditData.ai.status === 'warning' ? '#f59e0b' : '#4ade80'
                        }}>
                        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                      </div>
                      <div>
                        <p className="font-semibold text-xs" style={{ color: 'var(--color-admin-on-surface)' }}>AI API Exploitation</p>
                        <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                          {auditData.ai.message}
                        </p>
                      </div>
                    </div>

                    {/* 3. Tool Rate Limit usage */}
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ 
                          backgroundColor: auditData.tools.status === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(74,222,128,0.15)',
                          color: auditData.tools.status === 'warning' ? '#f59e0b' : '#4ade80'
                        }}>
                        <span className="material-symbols-outlined text-[18px]">construction</span>
                      </div>
                      <div>
                        <p className="font-semibold text-xs" style={{ color: 'var(--color-admin-on-surface)' }}>Tool Operations Rate</p>
                        <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                          {auditData.tools.message}
                        </p>
                      </div>
                    </div>

                    {/* 4. Financial Audit logs */}
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ 
                          backgroundColor: auditData.billing.status === 'critical' ? 'rgba(239,68,68,0.15)' : auditData.billing.status === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(74,222,128,0.15)',
                          color: auditData.billing.status === 'critical' ? 'var(--color-admin-error)' : auditData.billing.status === 'warning' ? '#f59e0b' : '#4ade80'
                        }}>
                        <span className="material-symbols-outlined text-[18px]">payments</span>
                      </div>
                      <div>
                        <p className="font-semibold text-xs" style={{ color: 'var(--color-admin-on-surface)' }}>Financial Ledger Audit</p>
                        <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                          {auditData.billing.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-center py-4 italic" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Failed to build audit log.</p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
