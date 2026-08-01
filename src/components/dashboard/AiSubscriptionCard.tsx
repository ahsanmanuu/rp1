'use client';

import React from 'react';
import { Brain, CheckCircle2, Clock, Zap, CalendarRange, Hourglass, ShieldCheck, Sparkles } from 'lucide-react';
import { useCountdown } from '@/hooks/useCountdown';

export interface AiSubscriptionCardProps {
  aiPlan: any;
  loading?: boolean;
  error?: string | null;
  onTakeSubscription: () => void;
  onRetry: () => void;
}

function formatTokens(n: number): string {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function fmtDate(d: string | null | undefined, fallback = "—"): string {
  if (!d) return fallback;
  try {
    return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return fallback;
  }
}

export default function AiSubscriptionCard({
  aiPlan,
  loading = false,
  error = null,
  onTakeSubscription,
  onRetry,
}: AiSubscriptionCardProps) {
  const plan = aiPlan || {};
  const isFree = !plan.isPremiumTier || plan.status === 'free' || plan.status === 'expired';
  const expired = plan.status === 'expired';

  const counter = useCountdown(plan.expiresAt, 1000);

  const remainingDays =
    plan.remainingDays ?? (plan.expiresAt ? Math.max(0, Math.ceil((new Date(plan.expiresAt).getTime() - Date.now()) / 86400000)) : null);

  const daysColor =
    remainingDays === null || remainingDays > 7
      ? 'bg-emerald-500/10 text-emerald-500'
      : remainingDays > 3
        ? 'bg-amber-500/10 text-amber-500'
        : 'bg-rose-500/10 text-rose-500';

  const statusBadge = expired
    ? { label: 'Expired', cls: 'bg-rose-500/10 text-rose-500' }
    : isFree
      ? { label: 'Free Tier', cls: 'bg-slate-500/10 text-slate-400 dark:text-slate-500' }
      : { label: 'Active', cls: 'bg-emerald-500/10 text-emerald-500' };

  const ctaLabel = expired
    ? 'Subscribe Now'
    : isFree
      ? 'Take AI Subscription'
      : 'Extend AI Plan';

  return (
    <div className="lg:col-span-1 glass-card rounded-[2rem] p-6 border border-outline hover:shadow-ambient-soft transition-all bg-surface-container-lowest/30 relative overflow-hidden flex flex-col justify-between">
      {/* Decorative Background Accent */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-[80px] pointer-events-none opacity-20" style={{ background: 'var(--accent-primary)' }} />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 bg-surface-container-lowest/40 backdrop-blur-sm flex items-center justify-center rounded-[2rem]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm font-semibold text-primary">Syncing AI plan...</span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="absolute top-4 left-4 right-4 z-20 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="material-symbols-outlined text-rose-500 text-[18px]">error_outline</span>
          <span className="text-[11px] font-bold text-rose-500 flex-1">{error}</span>
          <button onClick={onRetry} className="text-[11px] font-black text-rose-500 uppercase tracking-wider hover:underline">Retry</button>
        </div>
      )}

      <div className="relative z-10 space-y-6">
        {/* Top Row: Plan Info + Status */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
              <Brain size={22} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">AI Subscription</span>
              <div className="text-lg font-black text-on-surface flex items-center gap-2">
                {plan.planName || "Free Tier"}
                {!isFree && <CheckCircle2 className="text-emerald-500 fill-emerald-500/20 shrink-0" size={18} />}
              </div>
              {plan.priceINR > 0 && (
                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{Number(plan.priceINR).toLocaleString('en-IN')} / month
                </div>
              )}
            </div>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t border-outline/10" />

        {/* Daily AI Quota */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary">
                <Zap size={14} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Daily AI Quota</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
              {formatTokens(plan.dailyTokenCap || 0)} / day
            </span>
          </div>

          <div className="flex justify-between items-baseline mb-2">
            <div>
              <span className="text-2xl font-black text-primary leading-none">
                {formatTokens(plan.usedToday)}
              </span>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1">
                / {formatTokens(plan.limit || 0)} tokens used today
              </span>
            </div>
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
              {Math.round(plan.percentage ?? 0)}%
            </span>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-900/60 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                plan.isCapped
                  ? "bg-gradient-to-r from-rose-500 to-rose-600"
                  : (plan.percentage ?? 0) >= 80
                    ? "bg-gradient-to-r from-amber-500 to-amber-600"
                    : "bg-gradient-to-r from-emerald-500 to-emerald-600"
              }`}
              style={{ width: `${Math.max(Math.min(plan.percentage ?? 0, 100), 2)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-2 flex-wrap gap-2">
            {plan.isCapped ? (
              <span className="text-rose-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                Daily Quota Exhausted!
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                Resets in {Math.max(0, Math.ceil((new Date(plan.quotaResetAt || Date.now()).getTime() - Date.now()) / (1000 * 60 * 60)))} hours
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-outline/10" />

        {/* Plan Period: Start / Expiry / Remaining Days */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-secondary min-w-0">
            <CalendarRange size={13} className="text-primary shrink-0" />
            <span className="truncate">
              Start: <strong className="text-on-surface">{fmtDate(plan.startsAt)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-secondary min-w-0">
            <Hourglass size={13} className="text-primary shrink-0" />
            <span className="truncate">
              Expires: <strong className="text-on-surface">{fmtDate(plan.expiresAt, isFree ? "Lifetime" : "—")}</strong>
            </span>
          </div>
        </div>

        {remainingDays !== null ? (
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Remaining Days</span>
            <span className={`px-2 py-0.5 rounded font-black text-[11px] ${daysColor}`}>
              {remainingDays} day{remainingDays !== 1 ? 's' : ''} left
            </span>
          </div>
        ) : isFree ? (
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Duration</span>
            <span className="text-[11px] font-black text-on-surface">Lifetime (Free)</span>
          </div>
        ) : null}

        {/* Auto Counter — live ticking countdown */}
        <div className="rounded-2xl border border-outline/10 bg-surface/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-secondary/70 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Auto Counter
            </span>
            {plan.durationDays ? (
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                Duration: {plan.durationDays} days
              </span>
            ) : null}
          </div>
          {counter.active && !expired ? (
            <div className="flex items-center justify-between gap-1 font-mono">
              {[
                { v: counter.parts.days, l: 'Days' },
                { v: counter.parts.hours, l: 'Hrs' },
                { v: counter.parts.minutes, l: 'Min' },
                { v: counter.parts.seconds, l: 'Sec' },
              ].map((p, i) => (
                <React.Fragment key={p.l}>
                  <div className="flex flex-col items-center bg-slate-100 dark:bg-slate-900/60 rounded-lg px-2 py-1.5 min-w-[52px]">
                    <span className="text-base font-black text-primary leading-none">{p.v}</span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">{p.l}</span>
                  </div>
                  {i < 3 && <span className="text-xs font-black text-slate-400">:</span>}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 ${expired ? 'text-rose-500' : 'text-emerald-500'}`}>
              {expired ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  AI Plan Expired — Resubscribe to restore access
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  Lifetime access (Free tier)
                </>
              )}
            </div>
          )}
        </div>

        {/* Expiry Reminder Banner */}
        {plan.showReminder && remainingDays !== null && remainingDays <= 7 && !expired && (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1.5">
              <Sparkles size={13} className="animate-pulse" />
              Expires in {remainingDays} day{remainingDays !== 1 ? 's' : ''} ({fmtDate(plan.expiresAt)})
            </span>
            <button
              onClick={onTakeSubscription}
              className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white px-2.5 py-1 rounded-md hover:bg-amber-600 transition-colors shrink-0"
            >
              Renew
            </button>
          </div>
        )}

        {/* Plan type + daily cap chips */}
        <div className="flex flex-wrap gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-primary/10 text-primary">
            Type: {plan.planType || 'free'}
          </span>
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-slate-500/10 text-slate-500 dark:text-slate-400">
            Cap: {formatTokens(plan.dailyTokenCap || 0)} tokens/day
          </span>
        </div>
      </div>

      {/* Subscription-taking CTA */}
      <button
        onClick={onTakeSubscription}
        className="mt-6 w-full py-3.5 bg-tertiary hover:brightness-110 active:scale-[0.98] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2"
      >
        <Sparkles size={14} />
        {ctaLabel}
      </button>
    </div>
  );
}
