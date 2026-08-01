'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Check, Loader2, Zap, CheckCircle2 } from 'lucide-react';

export interface AiPlanSubscribeModalProps {
  open: boolean;
  onClose: () => void;
  availablePlans: any[];
  currentPlanType?: string | null;
  isPremiumMember?: boolean;
  onSubscribed?: (result: any) => void;
}

function formatTokens(n: number): string {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

const DURATIONS = [
  { months: 1, label: '1 Month' },
  { months: 3, label: '3 Months' },
  { months: 6, label: '6 Months' },
  { months: 12, label: '12 Months' },
];

export default function AiPlanSubscribeModal({
  open,
  onClose,
  availablePlans = [],
  currentPlanType = null,
  isPremiumMember = false,
  onSubscribed,
}: AiPlanSubscribeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [durationMonths, setDurationMonths] = useState(3);
  const [subscribing, setSubscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  React.useEffect(() => {
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

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
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
      setErrorMsg(err.message || 'Failed to activate AI subscription.');
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md px-4 py-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] max-w-3xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 relative flex flex-col my-auto max-h-[90vh] overflow-y-auto custom-scroll"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors border-none cursor-pointer z-10"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <Brain size={20} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">AI Subscription Plans</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
                  Choose a plan &amp; duration for your AI token subscription
                </p>
              </div>
            </div>

            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Boost your daily AI token quota. {isPremiumMember ? 'Your Premium membership already includes the Pro AI plan — add an Enterprise or custom tier for even more.' : 'Pick a higher tier to unlock more daily tokens for all AI assistants.'}
            </p>

            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 p-4 rounded-xl text-xs font-semibold w-full mb-6 text-center flex items-center justify-center gap-2">
                <CheckCircle2 size={16} />
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 p-4 rounded-xl text-xs font-semibold w-full mb-6 text-center">
                {errorMsg}
              </div>
            )}

            {/* Plan Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-6">
              {availablePlans.map((p: any) => {
                const isFree = p.name === 'free';
                const isCurrent = p.name === currentPlanType;
                const isSelected = selectedPlan === p.name;
                return (
                  <div
                    key={p.id || p.name}
                    onClick={() => !isCurrent && !isFree && setSelectedPlan(p.name)}
                    className={`p-5 border rounded-2xl flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
                      isSelected
                        ? "border-primary bg-primary/5 dark:bg-primary/5 shadow-md scale-[1.01]"
                        : isCurrent
                          ? "border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                    } ${!isCurrent && !isFree ? "cursor-pointer hover:border-primary/50" : ""}`}
                  >
                    {isCurrent && (
                      <div className="absolute top-0 right-0 bg-emerald-500 text-white font-mono text-[9px] font-bold px-3 py-1 rounded-bl-xl">
                        CURRENT
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">{p.label || p.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5 min-h-[28px]">{p.description || `${formatTokens(p.dailyTokenCap)} tokens per day`}</p>
                    </div>
                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-primary">{formatTokens(p.dailyTokenCap)}</span>
                      <span className="text-sm text-slate-400">tokens / day</span>
                    </div>
                    <button
                      disabled={isCurrent || isFree || subscribing}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isCurrent && !isFree) setSelectedPlan(p.name);
                      }}
                      className={`w-full mt-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 cursor-pointer border-none ${
                        isCurrent
                          ? "bg-emerald-500/15 text-emerald-600"
                          : isSelected
                            ? "bg-amber-500 text-white shadow-md"
                            : "bg-primary text-white hover:opacity-95"
                      }`}
                    >
                      {isCurrent ? (
                        <span className="flex items-center justify-center gap-1.5"><Check size={14} /> Current Plan</span>
                      ) : isSelected ? (
                        "Selected — Proceed Below"
                      ) : (
                        "Select Plan"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Duration Picker */}
            <div className="w-full mb-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Subscription Duration</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DURATIONS.map(d => (
                  <button
                    key={d.months}
                    onClick={() => setDurationMonths(d.months)}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                      durationMonths === d.months
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 hover:border-primary/40"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSubscribe}
              disabled={subscribing || !selectedPlan}
              className="w-full py-3.5 bg-tertiary hover:brightness-110 active:scale-[0.98] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {subscribing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Zap size={15} />
                  Activate {durationMonths}-Month Subscription
                </>
              )}
            </button>

            <p className="text-[10px] text-slate-400 font-medium text-center mt-3">
              Your current plan stays valid until its expiry, then the new duration compounds from there.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
