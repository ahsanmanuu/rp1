'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPb } from '@/lib/pb';
import ProLoader from '@/components/ProLoader';
import AdminSidebar from '@/components/AdminSidebar';
import { Theme, getAccentColor, themes } from '@/components/AdminThemeStyles';
import { useAdminTheme } from '@/contexts/AdminThemeContext';

const GST_SLABS = [
  { min: 0, max: 500000, rate: 0, name: 'Nil', type: 'Exempt' },
  { min: 500001, max: 1000000, rate: 5, name: '5% Slab', type: 'GST' },
  { min: 1000001, max: 2500000, rate: 12, name: '12% Slab', type: 'GST' },
  { min: 2500001, max: 7500000, rate: 18, name: '18% Slab', type: 'GST' },
  { min: 7500001, max: Infinity, rate: 28, name: '28% Slab', type: 'GST' },
];

function getGstSlab(amount: number) {
  return GST_SLABS.find(s => amount >= s.min && amount <= s.max) || GST_SLABS[3];
}

const ALL_THEMES: Theme[] = ['indigo', 'emerald', 'rose', 'violet', 'amber', 'cyan', 'sky', 'pink', 'orange', 'lime', 'teal', 'fuchsia', 'red', 'yellow', 'stone', 'zinc'];

export default function AdminTaxCalculationPage() {
  const { currentTheme, isDarkMode, setTheme: setCurrentTheme, setDarkMode: setIsDarkMode } = useAdminTheme();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState("Admin Root");

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [regionData, setRegionData] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [filings, setFilings] = useState<any[]>([]);
  const [calculatorResult, setCalculatorResult] = useState<any>(null);

  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [ruleForm, setRuleForm] = useState({ region: '', jurisdiction: '', taxType: 'GST', rate: 18, threshold: '', status: 'Active', isActive: true });

  const [calcPeriod, setCalcPeriod] = useState('30');
  const [calcExemptions, setCalcExemptions] = useState<string[]>([]);

  const [showGstPopup, setShowGstPopup] = useState(false);
  const [gstManualAmount, setGstManualAmount] = useState<number>(0);
  const [gstSlab, setGstSlab] = useState(GST_SLABS[3]);

  const [showTaxSlabCalc, setShowTaxSlabCalc] = useState(false);
  const [taxSlabTurnover, setTaxSlabTurnover] = useState<number>(1240000);
  const [taxSlabResult, setTaxSlabResult] = useState<any>(null);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editField, setEditField] = useState('');
  const [editValue, setEditValue] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, rulesRes, filingsRes] = await Promise.all([
        fetch('/api/admin/tax/stats'),
        fetch('/api/admin/tax/rules'),
        fetch('/api/admin/tax/filings'),
      ]);
      if (statsRes.ok) { const d = await statsRes.json(); if (d.success) { setStats(d.stats); setRegionData(d.regionCollection || []); setFilings(d.filings || []); } }
      if (rulesRes.ok) { const d = await rulesRes.json(); if (d.success) setRules(d.rules); }
      if (filingsRes.ok) { const d = await filingsRes.json(); if (d.success) setFilings(d.filings); }
    } catch (err) { console.error('Tax data fetch error:', err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const pb = createPb();
    const unsubFns: (() => void)[] = [];
    (async () => {
      for (const coll of ['tax_rules', 'tax_transactions', 'tax_filings']) {
        try { const u = await pb.collection(coll).subscribe('*', () => { fetchData(); }); unsubFns.push(u); } catch {}
      }
    })();
    return () => { for (const fn of unsubFns) { try { fn(); } catch {} } };
  }, [fetchData]);

  const runCalc = async () => {
    const params = new URLSearchParams({ period: calcPeriod });
    if (calcExemptions.length > 0) params.set('exemptions', calcExemptions.join(','));
    try {
      const res = await fetch(`/api/admin/tax/calculator?${params}`);
      if (res.ok) { const d = await res.json(); if (d.success) setCalculatorResult(d); }
    } catch {}
  };

  const runBatch = async () => {
    try {
      const res = await fetch('/api/admin/tax/batch', { method: 'POST' });
      if (res.ok) { const d = await res.json(); if (d.success) { alert(d.message); fetchData(); } }
    } catch {}
  };

  const saveRule = async () => {
    try {
      if (editingRule) {
        await fetch(`/api/admin/tax/rules/${editingRule.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ruleForm) });
      } else {
        await fetch('/api/admin/tax/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ruleForm) });
      }
      setShowRuleForm(false); setEditingRule(null); fetchData();
    } catch {}
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Delete this tax rule?')) return;
    try { await fetch(`/api/admin/tax/rules/${id}`, { method: 'DELETE' }); fetchData(); } catch {}
  };

  const handleEditRule = (rule: any) => {
    setEditingRule(rule);
    setRuleForm({ region: rule.region, jurisdiction: rule.jurisdiction, taxType: rule.taxType, rate: rule.rate, threshold: rule.threshold, status: rule.status, isActive: rule.isActive });
    setShowRuleForm(true);
  };

  const calcTaxSlab = () => {
    const slab = getGstSlab(taxSlabTurnover);
    setTaxSlabResult({
      ...slab,
      turnover: taxSlabTurnover,
      taxAmount: parseFloat((taxSlabTurnover * slab.rate / 100).toFixed(2)),
    });
    setGstSlab(slab);
    setShowTaxSlabCalc(true);
  };

  const toggleTheme = () => setIsThemeMenuOpen(!isThemeMenuOpen);
  const handleThemeSelect = (t: Theme) => { setCurrentTheme(t); setIsThemeMenuOpen(false); };

  const accentColor = getAccentColor(currentTheme, isDarkMode);
  const bgColor = isDarkMode ? '#0b1326' : '#f8fafc';
  const surfaceColor = isDarkMode ? '#0b1326' : '#ffffff';
  const onSurfaceColor = isDarkMode ? '#dae2fd' : '#0f172a';
  const surfaceVariant = isDarkMode ? '#475569' : '#475569';
  const borderColor = isDarkMode ? '#2d3449' : '#e2e8f0';
  const cardBg = isDarkMode ? '#171f33' : '#ffffff';

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ backgroundColor: bgColor, color: onSurfaceColor }}>
      <div className="flex min-h-screen">
        <AdminSidebar isDarkMode={isDarkMode} adminName={adminName} />

        <main className="flex-1 ml-0 lg:ml-64 min-h-screen pb-16">
          <header className="flex justify-between items-center w-full px-4 sm:px-8 py-4 border-b backdrop-blur-md sticky top-0 z-40" style={{ backgroundColor: surfaceColor + 'cc', borderColor }}>
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate" style={{ color: onSurfaceColor }}>Financial Compliance</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: accentColor + '20', color: accentColor }}>Tax Reporting Dashboard</span>
            </div>
            <div className="flex items-center gap-3 sm:gap-6 ml-4 shrink-0">
              <div className="relative">
                <button onClick={toggleTheme} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors" style={{ borderColor, color: surfaceVariant }}>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: accentColor }} />
                  <span className="hidden sm:inline">Theme</span>
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </button>
                {isThemeMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 max-h-80 overflow-y-auto rounded-xl border shadow-lg z-50 custom-scrollbar" style={{ backgroundColor: surfaceColor, borderColor }}>
                    {ALL_THEMES.map(t => (
                      <button key={t} onClick={() => handleThemeSelect(t)} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold hover:brightness-90 transition-all border-b last:border-b-0" style={{ borderColor, color: onSurfaceColor, backgroundColor: currentTheme === t ? accentColor + '20' : 'transparent', textTransform: 'capitalize' }}>
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getAccentColor(t, true) }} />
                        {t}
                        {currentTheme === t && <span className="material-symbols-outlined ml-auto text-[14px]">check</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ color: surfaceVariant }}>
                <span className="material-symbols-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: accentColor + '30', color: accentColor }}>A</div>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold" style={{ color: onSurfaceColor }}>{adminName}</p>
                  <p className="text-[10px]" style={{ color: surfaceVariant }}>Administrator</p>
                </div>
              </div>
            </div>
          </header>

          <div className="px-4 sm:px-8 py-6 space-y-6">
            {loading ? (
              <ProLoader variant="admin" fullScreen={false} />
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined" style={{ color: surfaceVariant }}>calendar_today</span>
                    <span className="text-sm font-semibold" style={{ color: onSurfaceColor }}>Q3 {(new Date().getFullYear())} (July - Sept)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all hover:brightness-95" style={{ borderColor, color: onSurfaceColor }}>
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      Export PDF Report
                    </button>
                    <button onClick={runBatch} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:brightness-110" style={{ backgroundColor: accentColor }}>
                      <span className="material-symbols-outlined text-[18px]">bolt</span>
                      Run Batch Calculation
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 rounded-xl border transition-colors" style={{ backgroundColor: cardBg, borderColor }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-symbols-outlined text-[20px]" style={{ color: accentColor }}>account_balance_wallet</span>
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: surfaceVariant }}>Total VAT Collected</span>
                    </div>
                    <p className="text-3xl font-bold" style={{ color: onSurfaceColor }}>₹{stats?.totalVatCollected?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0'}</p>
                    <p className="text-xs mt-1 font-medium" style={{ color: '#22c55e' }}>+{stats?.changePercent || 0}% vs prev quarter</p>
                  </div>
                  <div className="p-5 rounded-xl border transition-colors" style={{ backgroundColor: cardBg, borderColor }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-symbols-outlined text-[20px]" style={{ color: '#06b6d4' }}>receipt_long</span>
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: surfaceVariant }}>Exempt Transactions</span>
                    </div>
                    <p className="text-3xl font-bold" style={{ color: onSurfaceColor }}>{stats?.exemptCount || 0}</p>
                    <p className="text-xs mt-1 font-medium" style={{ color: '#06b6d4' }}>Stable</p>
                  </div>
                  <div className="p-5 rounded-xl border transition-colors" style={{ backgroundColor: cardBg, borderColor }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-symbols-outlined text-[20px] text-red-500">warning</span>
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: surfaceVariant }}>Pending Tax Audits</span>
                    </div>
                    <p className="text-3xl font-bold text-red-500">{stats?.pendingAudits || 0}</p>
                    <p className="text-xs mt-1 font-medium" style={{ color: '#ef4444' }}>Action Needed</p>
                  </div>
                  <div className="p-5 rounded-xl border transition-colors cursor-pointer hover:brightness-95" style={{ backgroundColor: cardBg, borderColor }} onClick={() => { setShowGstPopup(true); setGstManualAmount(stats?.totalVatCollected || 0); }}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-symbols-outlined text-[20px]" style={{ color: '#f59e0b' }}>account_balance</span>
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: surfaceVariant }}>Indian GST Calculator</span>
                    </div>
                    <p className="text-xs font-bold" style={{ color: '#f59e0b' }}>Click to calculate GST slab</p>
                    <p className="text-xs mt-1 font-medium" style={{ color: surfaceVariant }}>Auto-detect tax bracket</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 p-6 rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
                    <h3 className="text-sm font-bold mb-4" style={{ color: onSurfaceColor }}>Regional Tax Collection</h3>
                    {regionData.length === 0 ? (
                      <p className="text-xs py-8 text-center" style={{ color: surfaceVariant }}>No regional data yet. Run a batch calculation to populate.</p>
                    ) : (
                      <div className="space-y-3">
                        {regionData.map((r, i) => {
                          const maxAmount = Math.max(...regionData.map(x => x.taxAmount), 1);
                          const pct = (r.taxAmount / maxAmount) * 100;
                          const regionNames: Record<string, string> = { 'IN': 'India (GST)', 'US-CA': 'California, USA', 'DE': 'Germany, EU', 'GB': 'UK', 'SG': 'Singapore', 'AU': 'Australia' };
                          const regionIcons: Record<string, string> = { 'IN': 'IN', 'US-CA': 'US', 'DE': 'DE', 'GB': 'GB', 'SG': 'SG', 'AU': 'AU' };
                          const colors = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];
                          return (
                            <div key={r.region} className="flex items-center gap-4">
                              <span className="text-sm w-8 text-center">{regionIcons[r.region] || r.region}</span>
                              <div className="flex-1">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-semibold" style={{ color: onSurfaceColor }}>{regionNames[r.region] || r.region}</span>
                                  <span style={{ color: surfaceVariant }}>₹{r.taxAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: borderColor }}>
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="p-6 rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined" style={{ color: accentColor }}>calculate</span>
                      <h3 className="text-sm font-bold" style={{ color: onSurfaceColor }}>Automated Calculator</h3>
                    </div>
                    <p className="text-xs mb-4" style={{ color: surfaceVariant }}>Estimate liabilities based on historical transaction volume and current tax rules.</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Select Period</label>
                        <select value={calcPeriod} onChange={e => setCalcPeriod(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border text-sm" style={{ backgroundColor: bgColor, borderColor, color: onSurfaceColor }}>
                          <option value="30">Last 30 Days (Real-time)</option>
                          <option value="90">Last 90 Days</option>
                          <option value="365">Last 12 Months</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Exemption Filters</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {['B2B SaaS', 'Non-Profit', 'Educational'].map(e => (
                            <button key={e} onClick={() => setCalcExemptions(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all"
                              style={{ borderColor, color: calcExemptions.includes(e) ? '#fff' : surfaceVariant, backgroundColor: calcExemptions.includes(e) ? accentColor : 'transparent' }}>
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Gross Revenue</label>
                        <p className="text-xl font-bold mt-1" style={{ color: onSurfaceColor }}>₹{(calculatorResult?.grossRevenue || stats?.grossRevenue || 1240000).toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Estimated Liability (avg {calculatorResult?.avgRate || 18}%)</label>
                        <p className="text-xl font-bold mt-1" style={{ color: accentColor }}>₹{(calculatorResult?.estimatedLiability || stats?.estimatedLiability || 223200).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                      </div>
                      <button onClick={runCalc}
                        className="w-full py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:brightness-110 flex items-center justify-center gap-2"
                        style={{ backgroundColor: accentColor }}>
                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                        Calculate
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-xl border overflow-x-auto" style={{ backgroundColor: cardBg, borderColor }}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: onSurfaceColor }}>Active Tax Configurations</h3>
                      <p className="text-xs mt-0.5" style={{ color: surfaceVariant }}>Global Nexus rates and active exemptions rules</p>
                    </div>
                    <button onClick={() => { setEditingRule(null); setRuleForm({ region: '', jurisdiction: '', taxType: 'GST', rate: 18, threshold: '', status: 'Active', isActive: true }); setShowRuleForm(true); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:brightness-110"
                      style={{ backgroundColor: accentColor }}>
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      Add New Rule
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b" style={{ borderColor }}>
                          <th className="p-3 font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Region / Jurisdiction</th>
                          <th className="p-3 font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Tax Type</th>
                          <th className="p-3 font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Current Rate</th>
                          <th className="p-3 font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Threshold (Nexus)</th>
                          <th className="p-3 font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Status</th>
                          <th className="p-3 font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rules.map((r: any) => (
                          <tr key={r.id} className="border-b hover:brightness-95" style={{ borderColor }}>
                            <td className="p-3 font-semibold" style={{ color: onSurfaceColor }}>
                              <span className="mr-2">{r.region === 'IN' ? 'IN' : r.region === 'US-CA' ? 'US' : r.region === 'DE' ? 'DE' : r.region === 'GB' ? 'GB' : 'GL'}</span>
                              {r.jurisdiction}
                            </td>
                            <td className="p-3" style={{ color: surfaceVariant }}>{r.taxType}</td>
                            <td className="p-3 font-bold" style={{ color: onSurfaceColor }}>{r.rate}%</td>
                            <td className="p-3" style={{ color: surfaceVariant }}>{r.threshold}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.status === 'Active' ? 'text-green-600 bg-green-500/10' :
                                r.status === 'Re-evaluating' ? 'text-amber-600 bg-amber-500/10' :
                                'text-red-600 bg-red-500/10'
                              }`}>{r.status}</span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleEditRule(r)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit"><span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span></button>
                                <button onClick={() => deleteRule(r.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Delete"><span className="material-symbols-outlined text-[16px] text-red-500">delete</span></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {rules.length === 0 && (
                          <tr><td colSpan={6} className="p-8 text-center" style={{ color: surfaceVariant }}>No tax rules configured. Click "Add New Rule" to create one.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-6 rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>task</span>
                    <h3 className="text-sm font-bold" style={{ color: onSurfaceColor }}>Upcoming Filing Deadlines</h3>
                  </div>
                  {filings.length === 0 ? (
                    <p className="text-xs py-4 text-center" style={{ color: surfaceVariant }}>No upcoming filings.</p>
                  ) : (
                    <div className="space-y-3">
                      {filings.map((f: any) => {
                        const isUrgent = new Date(f.dueDate).getTime() - Date.now() < 15 * 86400000;
                        return (
                          <div key={f.id} className="p-4 rounded-xl border flex flex-col sm:flex-row items-start justify-between gap-4" style={{ backgroundColor: isUrgent ? '#fef2f2' : isDarkMode ? '#131b2e' : '#f8fafc', borderColor: isUrgent ? '#fecaca' : borderColor }}>
                            <div>
                              <p className="text-sm font-bold" style={{ color: onSurfaceColor }}>{f.jurisdiction} — {f.taxType}</p>
                              <p className="text-xs mt-1" style={{ color: isUrgent ? '#dc2626' : surfaceVariant }}>
                                {isUrgent ? `Your ${f.taxType} report for ${f.jurisdiction} is due in ${Math.ceil((new Date(f.dueDate).getTime() - Date.now()) / 86400000)} days.` : `Due: ${new Date(f.dueDate).toLocaleDateString('en-IN', { dateStyle: 'long' })}`}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] font-bold" style={{ color: surfaceVariant }}>Data Validation: {f.dataValidation}% complete</span>
                                <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: borderColor }}>
                                  <div className="h-full rounded-full" style={{ width: `${f.dataValidation}%`, backgroundColor: f.dataValidation >= 100 ? '#22c55e' : '#f59e0b' }} />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:brightness-110" style={{ backgroundColor: accentColor }}>Review Evidence</button>
                              <button className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all" style={{ borderColor, color: onSurfaceColor }}>Submit</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {showRuleForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg p-6 rounded-2xl border shadow-2xl" style={{ backgroundColor: surfaceColor, borderColor }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: onSurfaceColor }}>{editingRule ? 'Edit Tax Rule' : 'Add New Rule'}</h3>
              <button onClick={() => setShowRuleForm(false)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-3">
              {['region', 'jurisdiction', 'taxType', 'rate', 'threshold'].map(field => (
                <div key={field}>
                  <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>{field}</label>
                  <input type={field === 'rate' ? 'number' : 'text'} value={(ruleForm as any)[field]} onChange={e => setRuleForm({ ...ruleForm, [field]: field === 'rate' ? parseFloat(e.target.value) || 0 : e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border text-sm" style={{ backgroundColor: bgColor, borderColor, color: onSurfaceColor }} />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Status</label>
                <select value={ruleForm.status} onChange={e => setRuleForm({ ...ruleForm, status: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border text-sm" style={{ backgroundColor: bgColor, borderColor, color: onSurfaceColor }}>
                  <option>Active</option><option>Pending</option><option>Re-evaluating</option><option>Inactive</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium mt-2" style={{ color: onSurfaceColor }}>
                <input type="checkbox" checked={ruleForm.isActive} onChange={e => setRuleForm({ ...ruleForm, isActive: e.target.checked })} />
                Active
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowRuleForm(false)} className="flex-1 py-2.5 rounded-lg border text-sm font-bold" style={{ borderColor, color: surfaceVariant }}>Cancel</button>
              <button onClick={saveRule} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: accentColor }}>{editingRule ? 'Update' : 'Create'} Rule</button>
            </div>
          </div>
        </div>
      )}

      {showGstPopup && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl p-6 rounded-2xl border shadow-2xl my-auto" style={{ backgroundColor: surfaceColor, borderColor, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold" style={{ color: onSurfaceColor }}>Indian GST Calculator</h3>
              </div>
              <button onClick={() => setShowGstPopup(false)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined">close</span></button>
            </div>
            <p className="text-xs mb-4" style={{ color: surfaceVariant }}>Calculate GST liability based on Indian tax slabs. Click values to manually edit.</p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Transaction Amount (₹)</label>
                <input type="number" value={gstManualAmount} onChange={e => setGstManualAmount(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg border text-lg font-bold" style={{ backgroundColor: bgColor, borderColor, color: onSurfaceColor }} />
              </div>
              {(() => {
                const slab = getGstSlab(gstManualAmount);
                return (
                  <>
                    <div className="p-3 rounded-xl border cursor-pointer hover:brightness-95 transition-all" style={{ backgroundColor: bgColor, borderColor: slab.rate === 0 ? '#22c55e' : accentColor }}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold" style={{ color: surfaceVariant }}>Tax Slab</span>
                        <span className="text-sm font-bold" style={{ color: slab.rate === 0 ? '#22c55e' : accentColor }}>{slab.name}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs" style={{ color: surfaceVariant }}>GST Rate</span>
                        <span className="text-lg font-bold" style={{ color: onSurfaceColor }}>{slab.rate}%</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs" style={{ color: surfaceVariant }}>Range</span>
                        <span className="text-xs font-semibold" style={{ color: surfaceVariant }}>
                          ₹{slab.min.toLocaleString('en-IN')} {slab.max === Infinity ? '+' : `- ₹${slab.max.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ backgroundColor: accentColor + '10', borderColor: accentColor, borderWidth: 1 }}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold" style={{ color: surfaceVariant }}>GST Amount</span>
                        <span className="text-2xl font-bold" style={{ color: accentColor }}>₹{(gstManualAmount * slab.rate / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs" style={{ color: surfaceVariant }}>Total incl. GST</span>
                        <span className="text-lg font-bold" style={{ color: onSurfaceColor }}>₹{(gstManualAmount * (1 + slab.rate / 100)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div className="pt-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>GST Slabs Reference</span>
                      <div className="grid grid-cols-5 gap-2 mt-1">
                        {GST_SLABS.map(s => (
                          <div key={s.rate} className="p-2 rounded-lg text-center text-xs font-bold" style={{ backgroundColor: slab.rate === s.rate ? accentColor + '30' : bgColor, border: `1px solid ${slab.rate === s.rate ? accentColor : borderColor}` }}>
                            <span style={{ color: onSurfaceColor }}>{s.rate}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <button onClick={() => setShowGstPopup(false)} className="w-full mt-4 py-2.5 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: accentColor }}>Done</button>
          </div>
        </div>
      )}

      {showTaxSlabCalc && taxSlabResult && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-lg p-6 rounded-2xl border shadow-2xl my-auto" style={{ backgroundColor: surfaceColor, borderColor, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ color: accentColor }}>account_balance</span>
                <h3 className="text-lg font-bold" style={{ color: onSurfaceColor }}>Tax Slab Result</h3>
              </div>
              <button onClick={() => setShowTaxSlabCalc(false)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined">close</span></button>
            </div>
            <p className="text-xs mb-4" style={{ color: surfaceVariant }}>
              Based on total annual turnover from successful transactions. Click any value to manually edit for what-if analysis.
            </p>
            <div className="space-y-3">
              <div className="p-4 rounded-xl border cursor-pointer hover:brightness-95" style={{ backgroundColor: bgColor, borderColor, transition: 'all 0.2s' }}
                onClick={() => { setEditField('turnover'); setEditValue(String(taxSlabResult.turnover)); setShowEditPopup(true); }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Annual Turnover</span>
                  <span className="material-symbols-outlined text-[14px]" style={{ color: surfaceVariant }}>edit</span>
                </div>
                <p className="text-2xl font-bold mt-1" style={{ color: onSurfaceColor }}>₹{taxSlabResult.turnover.toLocaleString('en-IN')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border" style={{ backgroundColor: bgColor, borderColor }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>GST Slab</span>
                  <p className="text-lg font-bold mt-1" style={{ color: taxSlabResult.rate === 0 ? '#22c55e' : accentColor }}>{taxSlabResult.name}</p>
                </div>
                <div className="p-3 rounded-xl border" style={{ backgroundColor: bgColor, borderColor }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Tax Rate</span>
                  <p className="text-lg font-bold mt-1" style={{ color: onSurfaceColor }}>{taxSlabResult.rate}%</p>
                </div>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: accentColor + '10', border: `1px solid ${accentColor}` }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>Estimated GST Liability</span>
                  <span className="text-2xl font-bold" style={{ color: accentColor }}>₹{taxSlabResult.taxAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>GST Slab Guide</span>
                {GST_SLABS.map(s => (
                  <div key={s.rate} className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs" style={{ backgroundColor: taxSlabResult.rate === s.rate ? accentColor + '20' : 'transparent' }}>
                    <span className="font-semibold" style={{ color: onSurfaceColor }}>{s.name}</span>
                    <span style={{ color: surfaceVariant }}>₹{s.min.toLocaleString('en-IN')} — {s.max === Infinity ? '∞' : '₹' + s.max.toLocaleString('en-IN')}</span>
                    <span className="font-bold" style={{ color: accentColor }}>{s.rate}%</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setShowTaxSlabCalc(false)} className="w-full mt-4 py-2.5 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: accentColor }}>Close</button>
          </div>
        </div>
      )}

      {showEditPopup && (
        <div className="fixed inset-0 z-[99999] flex items-start justify-center bg-black/50 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-sm p-6 rounded-2xl border shadow-2xl my-auto" style={{ backgroundColor: surfaceColor, borderColor, maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: onSurfaceColor }}>Edit {editField}</h3>
            <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border text-lg font-bold mb-4" style={{ backgroundColor: bgColor, borderColor, color: onSurfaceColor }} />
            <div className="flex gap-3">
              <button onClick={() => setShowEditPopup(false)} className="flex-1 py-2.5 rounded-lg border text-sm font-bold" style={{ borderColor, color: surfaceVariant }}>Cancel</button>
              <button onClick={() => {
                const val = parseFloat(editValue) || 0;
                if (editField === 'turnover') {
                  setTaxSlabTurnover(val);
                  const slab = getGstSlab(val);
                  setTaxSlabResult({ ...slab, turnover: val, taxAmount: parseFloat((val * slab.rate / 100).toFixed(2)) });
                }
                setShowEditPopup(false);
              }} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: accentColor }}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
