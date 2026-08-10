'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Check, Loader2, Zap, CheckCircle2, Sparkles, Flame, Rocket, Crown } from 'lucide-react';

export interface AiPlanSubscribeModalProps {
  open: boolean;
  onClose: () => void;
  availablePlans: any[];
  currentPlanType?: string | null;
  isPremiumMember?: boolean;
  loading?: boolean;
  onSubscribed?: (result: any) => void;
}

function formatTokens(n: number): string {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function formatINR(n: number): string {
  const v = n || 0;
  return v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const DURATIONS = [
  { months: 1, label: '1 Month' },
  { months: 3, label: '3 Months' },
  { months: 6, label: '6 Months' },
  { months: 12, label: '12 Months' },
];

const PLAN_META: Record<string, { icon: any; color: string; glow: string; tag?: string }> = {
  free:       { icon: Sparkles, color: '#94a3b8', glow: 'rgba(148,163,184,0.25)', tag: 'Starter' },
  pro:        { icon: Rocket,   color: '#10b981', glow: 'rgba(16,185,129,0.3)',  tag: 'Popular' },
  enterprise: { icon: Crown,    color: '#8b5cf6', glow: 'rgba(139,92,246,0.35)', tag: 'Maximum' },
};

export default function AiPlanSubscribeModal({
  open,
  onClose,
  availablePlans = [],
  currentPlanType = null,
  isPremiumMember = false,
  loading = false,
  onSubscribed,
}: AiPlanSubscribeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [durationMonths, setDurationMonths] = useState(3);
  const [subscribing, setSubscribing] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (open) {
      const fallback = availablePlans.find(p => p.name !== 'free' && p.name !== currentPlanType)?.name
        || availablePlans.find(p => p.name !== 'free')?.name
        || null;
      setSelectedPlan(fallback);
      setDurationMonths(3);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [open, availablePlans, currentPlanType]);

  const selectedPlanObj = availablePlans.find(p => p.name === selectedPlan);

  const handleSubscribe = async () => {
    if (!selectedPlan) return;

    const planObj = availablePlans.find(p => p.name === selectedPlan);
    const isPaidPlan = !!planObj && (planObj.priceINR || 0) > 0;

    // Paid plans route through Cashfree checkout; free plans activate instantly.
    if (isPaidPlan) {
      setPaymentLoading(true);
      setErrorMsg('');
      setSuccessMsg('');
      try {
        const res = await fetch('/api/payments/ai-plan/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planName: selectedPlan, durationMonths }),
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.paymentSessionId) {
          setErrorMsg(data.error || 'Failed to initiate payment. Please try again.');
          setPaymentLoading(false);
          return;
        }
        const { load } = await import('@cashfreepayments/cashfree-js');
        const cashfree = await load({
          mode: (data.cashfreeEnv === 'production' ? 'production' : 'sandbox') as 'production' | 'sandbox',
        });
        cashfree.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: '_self' });
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to initiate payment.');
        setPaymentLoading(false);
      }
      return;
    }

    setSubscribing(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/user/ai-plan/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName: selectedPlan, durationMonths }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || 'AI subscription activated successfully!');
        onSubscribed?.(data);
        setTimeout(() => onClose(), 1400);
      } else {
        setErrorMsg(data.error || 'Failed to activate AI subscription.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to activate AI subscription.');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ai-plan-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-900/70 backdrop-blur-md px-4 py-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] max-w-4xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 relative flex flex-col my-auto max-h-[92vh] overflow-y-auto custom-scroll"
          >
            {/* Ambient glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[180px] rounded-full blur-3xl opacity-40"
              style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.35), transparent 70%)' }}
            />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all border-none cursor-pointer z-10"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-2 relative">
              <motion.div
                initial={{ rotate: -8, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 border border-white/10"
              >
                <Brain size={22} />
              </motion.div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">AI Subscription Plans</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
                  Choose a plan &amp; duration for your AI token subscription
                </p>
              </div>
            </div>

            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 relative">
              Boost your daily AI token quota. {isPremiumMember ? 'Your Premium membership already includes the Pro AI plan — add an Enterprise tier for even more.' : 'Pick a higher tier to unlock more daily tokens for all AI assistants.'}
            </p>

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 p-4 rounded-xl text-xs font-semibold w-full mb-6 text-center flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                {successMsg}
              </motion.div>
            )}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 text-rose-600 p-4 rounded-xl text-xs font-semibold w-full mb-6 text-center"
              >
                {errorMsg}
              </motion.div>
            )}

            {/* Plan Grid */}
            {loading && availablePlans.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-6">
                {[0, 1, 2].map(i => (
                  <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 animate-pulse">
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md mb-3" />
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded mb-2" />
                    <div className="h-3 w-2/3 bg-slate-100 dark:bg-slate-800 rounded mb-5" />
                    <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded mb-5" />
                    <div className="h-9 w-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : availablePlans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center mb-6">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">No AI plans are available right now</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Please check back later or contact support.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full mb-6 relative">
                {availablePlans.map((p: any) => {
                  const isFree = p.name === 'free';
                  const isCurrent = p.name === currentPlanType;
                  const isSelected = selectedPlan === p.name;
                  const meta = PLAN_META[p.name] || { icon: Zap, color: '#0ea5e9', glow: 'rgba(14,165,233,0.3)' };
                  const Icon = meta.icon;

                  return (
                    <motion.div
                      key={p.id || p.name}
                      layout
                      whileHover={!isCurrent && !isFree ? { y: -4, scale: 1.02 } : {}}
                      whileTap={!isCurrent && !isFree ? { scale: 0.98 } : {}}
                      onClick={() => !isCurrent && !isFree && setSelectedPlan(p.name)}
                      className={`p-5 border rounded-2xl flex flex-col justify-between relative overflow-hidden transition-colors duration-300 cursor-pointer ${
                        isSelected
                          ? "border-transparent bg-slate-50 dark:bg-slate-800/60 shadow-xl"
                          : isCurrent
                            ? "border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/50"
                      }`}
                      style={isSelected ? { boxShadow: `0 12px 32px -12px ${meta.glow}, 0 0 0 1.5px ${meta.color}` } : undefined}
                    >
                      {/* Colored top accent */}
                      <div
                        aria-hidden
                        className="absolute top-0 left-0 right-0 h-1"
                        style={{ background: `linear-gradient(90deg, ${meta.color}, transparent)` }}
                      />

                      {meta.tag && !isCurrent && (
                        <div
                          className="absolute top-3 right-3 text-white font-mono text-[9px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background: meta.color, boxShadow: `0 2px 8px ${meta.glow}` }}
                        >
                          {meta.tag}
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute top-3 right-3 bg-emerald-500 text-white font-mono text-[9px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Check size={10} /> CURRENT
                        </div>
                      )}

                      {isSelected && (
                        <motion.div
                          layoutId={`ai-selected-ring-${p.id || p.name}`}
                          className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-40"
                          style={{ background: meta.color }}
                        />
                      )}

                      <div className="relative">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}
                          >
                            <Icon size={18} />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-[15px] leading-tight">{p.label || p.name}</h3>
                            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                              {meta.tag || p.name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-baseline gap-1.5 mb-3">
                          <span className="text-[26px] font-black tracking-tight" style={{ color: meta.color }}>
                            {formatTokens(p.dailyTokenCap)}
                          </span>
                          <span className="text-[11px] text-slate-400 font-semibold">tokens / day</span>
                        </div>

                        <div className="flex items-baseline gap-1 mb-3">
                          {p.priceINR > 0 ? (
                            <>
                              <span className="text-lg font-black text-slate-900 dark:text-white">₹{formatINR(p.priceINR)}</span>
                              <span className="text-[10px] text-slate-400 font-semibold">/ month</span>
                            </>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Free</span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed min-h-[32px]">
                          {p.description || `${formatTokens(p.dailyTokenCap)} tokens per day for all AI assistants.`}
                        </p>
                      </div>

                      <motion.button
                        whileTap={!isCurrent && !isFree && !subscribing ? { scale: 0.97 } : {}}
                        disabled={isCurrent || isFree || subscribing}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isCurrent && !isFree) setSelectedPlan(p.name);
                        }}
                        className={`w-full mt-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 cursor-pointer border-none flex items-center justify-center gap-1.5 ${
                          isCurrent
                            ? "bg-emerald-500/15 text-emerald-600"
                            : isSelected
                              ? "text-white shadow-md"
                              : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90"
                        }`}
                        style={isSelected && !isCurrent ? { background: meta.color, boxShadow: `0 6px 16px -6px ${meta.glow}` } : undefined}
                      >
                        {isCurrent ? (
                          <><Check size={14} /> Current Plan</>
                        ) : isSelected ? (
                          <>Selected — Proceed Below <Check size={14} /></>
                        ) : (
                          <>Select Plan <Zap size={13} /></>
                        )}
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Duration Picker */}
            {availablePlans.length > 0 && (
              <div className="w-full mb-6 relative">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Subscription Duration</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DURATIONS.map(d => (
                    <motion.button
                      key={d.months}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setDurationMonths(d.months)}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                        durationMonths === d.months
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 hover:border-primary/40"
                      }`}
                    >
                      {d.label}
                    </motion.button>
                  ))}
                </div>
                {selectedPlanObj && (selectedPlanObj.priceINR || 0) > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-xs font-bold"
                  >
                    <span className="text-slate-500 dark:text-slate-400">
                      {selectedPlanObj.label || selectedPlan} · {durationMonths} month{durationMonths > 1 ? 's' : ''}
                    </span>
                    <span className="text-slate-900 dark:text-white">
                      ₹{formatINR((selectedPlanObj.priceINR || 0) * durationMonths)}
                      <span className="text-slate-400 font-semibold"> total</span>
                    </span>
                  </motion.div>
                )}
              </div>
            )}

            {/* Activate */}
            <motion.button
              whileTap={!subscribing && !paymentLoading && selectedPlan ? { scale: 0.98 } : {}}
              onClick={handleSubscribe}
              disabled={subscribing || paymentLoading || !selectedPlan}
              className="w-full py-3.5 bg-tertiary hover:brightness-110 active:scale-[0.98] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed relative"
            >
              {subscribing || paymentLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {paymentLoading ? 'Opening Secure Checkout...' : 'Activating...'}
                </>
              ) : selectedPlanObj && (selectedPlanObj.priceINR || 0) > 0 ? (
                <>
                  <Sparkles size={15} />
                  Pay ₹{formatINR((selectedPlanObj.priceINR || 0) * durationMonths)} &amp; Activate
                </>
              ) : (
                <>
                  <Zap size={15} />
                  Activate {durationMonths}-Month Subscription
                </>
              )}
            </motion.button>

            <p className="text-[10px] text-slate-400 font-medium text-center mt-3 relative">
              {selectedPlanObj && (selectedPlanObj.priceINR || 0) > 0
                ? 'Payments are securely processed by Cashfree (UPI, cards & net banking). Your current plan stays valid until its expiry, then the new duration compounds from there.'
                : 'Your current plan stays valid until its expiry, then the new duration compounds from there.'}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}