'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useBillingRealtime } from '@/hooks/useBillingRealtime';
import AdminSidebar from '@/components/AdminSidebar';
import { Theme, themes, getAccentColor } from "@/components/AdminThemeStyles";

const ALL_THEMES: Theme[] = ['indigo', 'emerald', 'rose', 'violet', 'amber', 'cyan', 'sky', 'pink', 'orange', 'lime', 'teal', 'fuchsia', 'red', 'yellow', 'stone', 'zinc'];

// ── Currency System ────────────────────────────────────────────────────────
interface CurrencyDef { code: string; symbol: string; rate: number; label: string; }
const CURRENCIES: Record<string, CurrencyDef> = {
    INR: { code: 'INR', symbol: '₹',   rate: 1,       label: '₹ INR — Indian Rupee' },
    USD: { code: 'USD', symbol: '$',    rate: 0.012,   label: '$ USD — US Dollar' },
    EUR: { code: 'EUR', symbol: '€',    rate: 0.011,   label: '€ EUR — Euro' },
    GBP: { code: 'GBP', symbol: '£',   rate: 0.0094,  label: '£ GBP — British Pound' },
    AED: { code: 'AED', symbol: 'د.إ', rate: 0.044,   label: 'د.إ AED — UAE Dirham' },
    SAR: { code: 'SAR', symbol: '﷼',   rate: 0.045,   label: '﷼ SAR — Saudi Riyal' },
    SGD: { code: 'SGD', symbol: 'S$',  rate: 0.016,   label: 'S$ SGD — Singapore Dollar' },
    AUD: { code: 'AUD', symbol: 'A$',  rate: 0.018,   label: 'A$ AUD — Australian Dollar' },
    CAD: { code: 'CAD', symbol: 'C$',  rate: 0.016,   label: 'C$ CAD — Canadian Dollar' },
    JPY: { code: 'JPY', symbol: '¥',   rate: 1.93,    label: '¥ JPY — Japanese Yen' },
};

/** Auto-detect currency from browser timezone and locale */
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
    return 'USD'; // default fallback
}

export default function AdminBillingsPage() {
    const [mounted, setMounted] = useState(false);
    const [currentTheme, setCurrentTheme] = useState<Theme>('indigo');
    const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [adminName, setAdminName] = useState<string>("Admin Root");

    // ── Currency state ────────────────────────────────────────────────────
    const [activeCurrency, setActiveCurrency] = useState<string>('INR');
    const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
    const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({});
    const currencyMenuRef = useRef<HTMLDivElement>(null);

    // Fetch live market exchange rates on mount relative to INR
    useEffect(() => {
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
                console.error("Failed to fetch exchange rates:", err);
            }
        };
        fetchRates();
    }, []);

    // Close currency menu when clicking anywhere outside it
    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (currencyMenuRef.current && !currencyMenuRef.current.contains(e.target as Node)) {
                setIsCurrencyMenuOpen(false);
            }
        };
        if (isCurrencyMenuOpen) {
            document.addEventListener('mousedown', handleOutsideClick);
        }
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [isCurrencyMenuOpen]);

    /** Convert from base INR to the active display currency */
    const fmtCurrency = (inrAmount: number): string => {
        const cur = CURRENCIES[activeCurrency] ?? CURRENCIES['INR'];
        const rate = currencyRates[activeCurrency] ?? cur.rate;
        const converted = inrAmount * rate;
        const decimals = ['JPY', 'INR'].includes(activeCurrency) ? 0 : 2;
        return `${cur.symbol}${converted.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    };
    const currencySymbol = CURRENCIES[activeCurrency]?.symbol ?? '₹';

    // Billings database states — powered by realtime hook with PB subscriptions + polling
    const { data: billingData, loading, error, refetch: fetchBillings } = useBillingRealtime({
        pollIntervalMs: 10000,
        onError: (msg) => console.warn('[Billings] Realtime error:', msg),
    });
    const transactions = useMemo(() => billingData?.transactions || [], [billingData]);
    const metrics = useMemo(() => billingData?.metrics || {
        monthlyRevenue: 0, pendingPayments: 0, totalRefunds: 0, pendingRefunds: 0,
        failedPaymentsCount: 0, failedPaymentsAmount: 0, totalPointsCredited: 0,
        successfulCheckoutsCount: 0, averageOrderValue: 0, renewedCount: 0, churnedCount: 0
    }, [billingData]);
    const charts = useMemo(() => billingData?.charts || {
        revenue: { "7D": [], "30D": [], "ALL": [] },
        userGrowth: { "7D": [], "30D": [], "ALL": [] }
    }, [billingData]);
    const [selectedRevenueInterval, setSelectedRevenueInterval] = useState<"7D" | "30D" | "ALL">("30D");
    const [selectedGrowthInterval, setSelectedGrowthInterval] = useState<"7D" | "30D" | "ALL">("30D");

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("All Status");
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;

    // Form states for manual provision / invoice
    const [formEmail, setFormEmail] = useState("");
    const [formAmount, setFormAmount] = useState("");
    const [formType, setFormType] = useState("recharge");
    const [formDescription, setFormDescription] = useState("");
    const [formSubmitting, setFormSubmitting] = useState(false);

    // ── Modal drill-down state ───────────────────────────────────────────────
    const [activeModal, setActiveModal] = useState<{ type: string; title: string; icon: string; color: string } | null>(null);
    const [modalRows, setModalRows] = useState<any[]>([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [modalSearch, setModalSearch] = useState("");
    const [modalPage, setModalPage] = useState(1);
    const [modalActionLoading, setModalActionLoading] = useState<string | null>(null);
    const [modalAdjustId, setModalAdjustId] = useState<string | null>(null);
    const [modalAdjustAmt, setModalAdjustAmt] = useState("");
    const MODAL_PAGE_SIZE = 10;

    useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem('latexify-admin-theme') as Theme | null;
        const savedMode = localStorage.getItem('latexify-admin-mode');
        const savedCurrency = localStorage.getItem('latexify-admin-currency');

        if (savedTheme) setCurrentTheme(savedTheme);
        if (savedMode) setIsDarkMode(savedMode === 'dark');
        const storedName = localStorage.getItem('latexify-admin-name');
        if (storedName) setAdminName(storedName);
        // Auto-detect currency from locale/timezone; respect saved preference
        setActiveCurrency(savedCurrency || detectCurrency());
    }, []);

    useEffect(() => {
        localStorage.setItem('latexify-admin-theme', currentTheme);
        localStorage.setItem('latexify-admin-mode', isDarkMode ? 'dark' : 'light');
        localStorage.setItem('latexify-admin-currency', activeCurrency);
        window.dispatchEvent(new Event('admin-theme-changed'));
    }, [currentTheme, isDarkMode, activeCurrency]);

    const generatePathD = (data: { value: number }[]) => {
        if (!data || data.length === 0) return "";
        const values = data.map(d => d.value);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;
        
        const points = data.map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
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
    const toggleTheme = () => {
        setIsThemeMenuOpen(!isThemeMenuOpen);
    };

    const handleThemeSelect = (theme: 'indigo' | 'emerald' | 'rose') => {
        setCurrentTheme(theme);
        setIsThemeMenuOpen(false);
    };

    const handleQuickInvoiceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formEmail || !formAmount) {
            alert("Please fill in Email and Amount");
            return;
        }

        try {
            setFormSubmitting(true);
            const res = await fetch("/api/admin/billings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formEmail,
                    amount: parseInt(formAmount, 10),
                    type: formType,
                    description: formDescription
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Successfully processed transaction for ${formEmail}!`);
                setFormEmail("");
                setFormAmount("");
                setFormDescription("");
                fetchBillings();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setFormSubmitting(false);
        }
    };

    // ── Export handlers (server-side API — no Turbopack bundler issues) ──────
    const handleExportExcel = async () => {
        try {
            const res = await fetch(`/api/admin/export/billings?format=excel&currency=${activeCurrency}`);
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Doc2LateX_Billings_${activeCurrency}_${Date.now()}.xlsx`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 300);
        } catch (e: any) {
            alert('Excel export failed: ' + e.message);
        }
    };

    const handleExportPDF = async () => {
        try {
            const res = await fetch(`/api/admin/export/billings?format=pdf&currency=${activeCurrency}&theme=${currentTheme}`);
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Doc2LateX_Billings_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 300);
        } catch (e: any) {
            alert('PDF export failed: ' + e.message);
        }
    };

    // ── Modal functions ────────────────────────────────────────────────────
    const openModal = async (type: string, title: string, icon: string, color: string) => {
        setActiveModal({ type, title, icon, color });
        setModalRows([]);
        setModalSearch("");
        setModalPage(1);
        setModalLoading(true);
        try {
            const res = await fetch(`/api/admin/billings/detail?type=${type}`);
            const data = await res.json();
            if (data.success) setModalRows(data.rows || []);
        } catch {}
        setModalLoading(false);
    };

    const closeModal = () => { setActiveModal(null); setModalAdjustId(null); setModalAdjustAmt(""); };

    const modalAction = async (action: string, txId: string, source: string, userId?: string) => {
        setModalActionLoading(txId + action);
        try {
            const res = await fetch("/api/admin/billings/detail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, txId, source, userId })
            });
            const data = await res.json();
            if (data.success) {
                // Refresh modal data
                if (activeModal) {
                    const r2 = await fetch(`/api/admin/billings/detail?type=${activeModal.type}`);
                    const d2 = await r2.json();
                    if (d2.success) setModalRows(d2.rows || []);
                }
            } else { alert(data.error || "Action failed"); }
        } catch (e: any) { alert(e.message); }
        setModalActionLoading(null);
    };

    const modalAdjustPoints = async (userId: string) => {
        if (!modalAdjustAmt || isNaN(Number(modalAdjustAmt))) return alert("Enter a valid number");
        setModalActionLoading(userId + "adjust");
        try {
            const res = await fetch("/api/admin/billings/detail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "adjust_points", userId, amount: parseInt(modalAdjustAmt, 10) })
            });
            const data = await res.json();
            if (data.success) {
                setModalAdjustId(null); setModalAdjustAmt("");
                if (activeModal) {
                    const r2 = await fetch(`/api/admin/billings/detail?type=${activeModal.type}`);
                    const d2 = await r2.json();
                    if (d2.success) setModalRows(d2.rows || []);
                }
            } else { alert(data.error || "Failed"); }
        } catch (e: any) { alert(e.message); }
        setModalActionLoading(null);
    };

    if (!mounted || (loading && transactions.length === 0)) {
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
                        Loading financial telemetry
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

    // Client-side search and filters
    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = 
            (t.userName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.userEmail || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchesStatus = true;
        if (filterStatus === "Completed") matchesStatus = t.status === "Completed";
        else if (filterStatus === "Pending") matchesStatus = t.status === "Pending";
        else if (filterStatus === "Failed") matchesStatus = t.status === "Failed";

        return matchesSearch && matchesStatus;
    });

    const paginatedTransactions = filteredTransactions.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );
    const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));

    return (
        <div className={`min-h-screen ${isDarkMode ? 'dark' : ''} transition-colors duration-500`} style={{ backgroundColor: 'var(--color-admin-background)', color: 'var(--color-admin-on-background)' }}>
            
            <AdminSidebar isDarkMode={isDarkMode} adminName={adminName} />


            {/* Main Content Area */}
            <main className="ml-0 lg:ml-64 flex flex-col min-h-screen">
                {/* Header */}
                <header className="flex justify-between items-center w-full px-8 py-4 border-b z-40 relative transition-colors duration-500" style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)" }}>
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-full max-w-3xl">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-admin-on-surface-variant)" }}>search</span>
                            <input 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-container focus:border-primary outline-none transition-all" 
                              style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }} 
                              placeholder="Search transactions, invoices, or customers..." 
                              type="text" 
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors active:opacity-80 scale-95" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        
                        {/* Theme Switcher Button */}
                        <div className="relative">
                            <button onClick={toggleTheme} aria-label="Change Theme" className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors active:opacity-80 scale-95" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                <span className="material-symbols-outlined">palette</span>
                            </button>

                            {/* Theme Menu Dropdown */}
                            {isThemeMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 rounded-xl border shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                                    <div className="p-2 flex flex-col gap-1 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
                                        <div className="px-3 py-2 text-xs font-semibold tracking-wider uppercase opacity-70" style={{ color: "var(--color-admin-on-surface-variant)" }}>Accent Color</div>
                                        <button onClick={() => handleThemeSelect('indigo')} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: "var(--color-admin-on-surface)" }}>
                                            <div className="w-4 h-4 rounded-full bg-indigo-500"></div> Indigo
                                            {currentTheme === 'indigo' && <span className="material-symbols-outlined ml-auto text-[18px]">check</span>}
                                        </button>
                                        <button onClick={() => handleThemeSelect('emerald')} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: "var(--color-admin-on-surface)" }}>
                                            <div className="w-4 h-4 rounded-full bg-emerald-500"></div> Emerald
                                            {currentTheme === 'emerald' && <span className="material-symbols-outlined ml-auto text-[18px]">check</span>}
                                        </button>
                                        <button onClick={() => handleThemeSelect('rose')} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: "var(--color-admin-on-surface)" }}>
                                            <div className="w-4 h-4 rounded-full bg-rose-500"></div> Rose
                                            {currentTheme === 'rose' && <span className="material-symbols-outlined ml-auto text-[18px]">check</span>}
                                        </button>
                                        
                                        <div className="h-px w-full my-1" style={{ backgroundColor: "var(--color-admin-outline-variant)" }}></div>
                                        
                                        <div className="px-3 py-2 text-xs font-semibold tracking-wider uppercase opacity-70" style={{ color: "var(--color-admin-on-surface-variant)" }}>Mode</div>
                                        <button onClick={() => { setIsDarkMode(!isDarkMode); setIsThemeMenuOpen(false); }} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: "var(--color-admin-on-surface)" }}>
                                            <span className="material-symbols-outlined text-[18px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                                            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Link href="/admin/profile" className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors active:opacity-80 scale-95" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                            <span className="material-symbols-outlined">settings</span>
                        </Link>
                        
                        <div className="h-8 w-px mx-2" style={{ backgroundColor: "var(--color-admin-outline-variant)" }}></div>
                        
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-semibold" style={{ color: "var(--color-admin-on-surface)" }}>{adminName}</p>
                                <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>Super Admin</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center overflow-hidden border-2" style={{ borderColor: "var(--color-admin-primary)" }}>
                                <div className="font-bold text-sm" style={{ color: "var(--color-admin-primary)" }}>{adminName.split(/\s+/).map(n => n[0]).join("").slice(0,2).toUpperCase() || "AR"}</div>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 p-8 overflow-y-auto">
                    {/* Header & Export Actions */}
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h2 className="text-3xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Billings &amp; Payments</h2>
                            <p className="text-base mt-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Manage institutional subscriptions and financial records.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => fetchBillings()} className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-all" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                                <span className="material-symbols-outlined text-[18px]">refresh</span> Refresh List
                            </button>
                            <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-all" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                                <span className="material-symbols-outlined text-[18px] text-green-500">table_view</span> Export Excel
                            </button>
                            <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-all" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                                <span className="material-symbols-outlined text-[18px] text-red-500">picture_as_pdf</span> Export PDF
                            </button>
                            {/* Currency Dropdown Selector */}
                            <div className="relative" ref={currencyMenuRef}>
                                <button 
                                    onClick={() => setIsCurrencyMenuOpen(!isCurrencyMenuOpen)} 
                                    className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-all outline-none" 
                                    style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                >
                                    <span className="material-symbols-outlined text-[18px] text-yellow-500">payments</span>
                                    <span>Currency: {activeCurrency} ({currencySymbol})</span>
                                    <span className="material-symbols-outlined text-[16px] transition-transform duration-200" style={{ transform: isCurrencyMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }}>expand_more</span>
                                </button>
                                {isCurrencyMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-64 rounded-xl border shadow-xl z-50 overflow-hidden" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                                        <div className="px-4 py-2 text-xs font-bold border-b opacity-50 uppercase tracking-wider" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface-variant)" }}>
                                            Select Display Currency
                                        </div>
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar divide-y" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                            {Object.values(CURRENCIES).map((cur) => (
                                                <button
                                                    key={cur.code}
                                                    onClick={() => {
                                                        setActiveCurrency(cur.code);
                                                        setIsCurrencyMenuOpen(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-between"
                                                    style={{ color: activeCurrency === cur.code ? "var(--color-admin-primary)" : "var(--color-admin-on-surface)" }}
                                                >
                                                    <span className="font-semibold">{cur.label}</span>
                                                    {activeCurrency === cur.code && (
                                                        <span className="material-symbols-outlined text-[16px]">check</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Summary Cards (Bento Grid) */}
                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8" id="billing-metric-cards">
                        {/* Card 1: Monthly Revenue */}
                        <div onClick={() => openModal("monthly_revenue", "Monthly Revenue Breakdown", "trending_up", "#4ade80")} className="p-5 rounded-xl flex flex-col justify-between border cursor-pointer hover:scale-[1.02] transition-transform" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div>
                                <div className="flex justify-between items-start">
                                    <p className="text-xs font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Monthly Revenue</p>
                                    <span className="material-symbols-outlined text-[20px]" style={{ color: "#4ade80" }}>trending_up</span>
                                </div>
                                <h3 className="text-2xl font-black mt-2" style={{ color: "var(--color-admin-on-surface)" }}>{fmtCurrency(metrics.monthlyRevenue || 0)}</h3>
                            </div>
                            <p className="text-[10px] mt-4" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                {activeCurrency} converted · <span style={{color:"var(--color-admin-primary)"}}>Click to view</span>
                            </p>
                        </div>
                        
                        {/* Card 2: Successful Checkouts & AOV */}
                        <div onClick={() => openModal("successful", "Successful Checkouts", "shopping_cart", "#10b981")} className="p-5 rounded-xl flex flex-col justify-between border cursor-pointer hover:scale-[1.02] transition-transform" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div>
                                <div className="flex justify-between items-start">
                                    <p className="text-xs font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Success checkouts</p>
                                    <span className="material-symbols-outlined text-[20px]" style={{ color: "#10b981" }}>shopping_cart</span>
                                </div>
                                <h3 className="text-2xl font-black mt-2" style={{ color: "var(--color-admin-on-surface)" }}>{metrics.successfulCheckoutsCount || 0} Txns</h3>
                            </div>
                            <p className="text-[10px] mt-4 font-semibold" style={{ color: "var(--color-admin-primary)" }}>
                                Avg value: {fmtCurrency(metrics.averageOrderValue || 0)} · <span style={{color:"#10b981"}}>Click to view</span>
                            </p>
                        </div>

                        {/* Card 3: Total Points Credited */}
                        <div onClick={() => openModal("points_credit", "Total Points Credit Ledger", "monetization_on", "#f59e0b")} className="p-5 rounded-xl flex flex-col justify-between border cursor-pointer hover:scale-[1.02] transition-transform" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div>
                                <div className="flex justify-between items-start">
                                    <p className="text-xs font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Total Points Credit</p>
                                    <span className="material-symbols-outlined text-[20px]" style={{ color: "#f59e0b" }}>monetization_on</span>
                                </div>
                                <h3 className="text-2xl font-black mt-2" style={{ color: "var(--color-admin-on-surface)" }}>{(metrics.totalPointsCredited || 0).toLocaleString()} Pts</h3>
                            </div>
                            <p className="text-[10px] mt-4" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                Recharges & adjustments · <span style={{color:"#f59e0b"}}>Click to view</span>
                            </p>
                        </div>

                        {/* Card 4: Payments Refund to User */}
                        <div onClick={() => openModal("refunded", "Refunded to User", "assignment_return", "#3b82f6")} className="p-5 rounded-xl flex flex-col justify-between border cursor-pointer hover:scale-[1.02] transition-transform" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div>
                                <div className="flex justify-between items-start">
                                    <p className="text-xs font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Refunded to User</p>
                                    <span className="material-symbols-outlined text-[20px]" style={{ color: "#3b82f6" }}>assignment_return</span>
                                </div>
                                <h3 className="text-2xl font-black mt-2" style={{ color: "var(--color-admin-on-surface)" }}>{fmtCurrency(metrics.totalRefunds || 0)}</h3>
                            </div>
                            <p className="text-[10px] mt-4" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                Fully processed refunds · <span style={{color:"#3b82f6"}}>Click to view</span>
                            </p>
                        </div>

                        {/* Card 5: Payments Refund Pending */}
                        <div onClick={() => openModal("refund_pending", "Refund Pending", "hourglass_empty", "#a855f7")} className="p-5 rounded-xl flex flex-col justify-between border cursor-pointer hover:scale-[1.02] transition-transform" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div>
                                <div className="flex justify-between items-start">
                                    <p className="text-xs font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Refund Pending</p>
                                    <span className="material-symbols-outlined text-[20px]" style={{ color: "#a855f7" }}>hourglass_empty</span>
                                </div>
                                <h3 className="text-2xl font-black mt-2" style={{ color: "var(--color-admin-on-surface)" }}>{fmtCurrency(metrics.pendingRefunds || 0)}</h3>
                            </div>
                            <p className="text-[10px] mt-4" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                Waiting for processor · <span style={{color:"#a855f7"}}>Click to view</span>
                            </p>
                        </div>

                        {/* Card 6: Transaction Failures */}
                        <div onClick={() => openModal("failed", "Failed Transactions", "error", "#ef4444")} className="p-5 rounded-xl flex flex-col justify-between border cursor-pointer hover:scale-[1.02] transition-transform" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div>
                                <div className="flex justify-between items-start">
                                    <p className="text-xs font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Failed Transactions</p>
                                    <span className="material-symbols-outlined text-[20px]" style={{ color: "var(--color-admin-error)" }}>error</span>
                                </div>
                                <h3 className="text-2xl font-black mt-2" style={{ color: "var(--color-admin-on-surface)" }}>{metrics.failedPaymentsCount || 0} Txns</h3>
                            </div>
                            <p className="text-[10px] mt-4 font-semibold" style={{ color: "var(--color-admin-error)" }}>
                                Volume: {fmtCurrency(metrics.failedPaymentsAmount || 0)} · <span style={{color:"#ef4444"}}>Click to view</span>
                            </p>
                        </div>
                    </section>

                    {/* Retention & Renewal Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div onClick={() => openModal("renewed", "Total Customers Renewed", "published_with_changes", "#10b981")} className="p-6 rounded-xl flex items-center justify-between border cursor-pointer hover:scale-[1.01] transition-transform" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center border" style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.2)", color: "#10b981" }}>
                                    <span className="material-symbols-outlined text-[24px]">published_with_changes</span>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Total Customers Renewed</p>
                                    <h4 className="text-xl font-black mt-1" style={{ color: "var(--color-admin-on-surface)" }}>{metrics.renewedCount || 0} Accounts</h4>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Click to view</span>
                        </div>

                        <div onClick={() => openModal("churned", "Customers Who Did Not Renew", "heart_broken", "#ef4444")} className="p-6 rounded-xl flex items-center justify-between border cursor-pointer hover:scale-[1.01] transition-transform" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center border" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.2)", color: "var(--color-admin-error)" }}>
                                    <span className="material-symbols-outlined text-[24px]">heart_broken</span>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Customers Who Did Not Renew</p>
                                    <h4 className="text-xl font-black mt-1" style={{ color: "var(--color-admin-on-surface)" }}>{metrics.churnedCount || 0} Accounts</h4>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">Click to view</span>
                        </div>
                    </div>

                    {/* Analytics Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Revenue Chart */}
                        <div className="border rounded-xl p-6 flex flex-col justify-between" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-sm font-bold" style={{ color: "var(--color-admin-primary)" }}>Revenue Over Time</h3>
                                    <p className="text-[11px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>Trend of completed points and plan recharges</p>
                                </div>
                                <div className="flex gap-1.5">
                                    {["7D", "30D", "ALL"].map(inv => (
                                        <button
                                            key={inv}
                                            onClick={() => setSelectedRevenueInterval(inv as any)}
                                            className="px-2.5 py-0.5 text-[10px] rounded transition-all font-semibold"
                                            style={selectedRevenueInterval === inv ? { backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary)" } : { backgroundColor: "var(--color-admin-surface-container-highest)", color: "var(--color-admin-on-surface)", border: "1px solid var(--color-admin-outline-variant)" }}
                                        >
                                            {inv}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="relative h-48 w-full flex items-end pb-8 border-b" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                {(loading && (!charts.revenue[selectedRevenueInterval] || charts.revenue[selectedRevenueInterval].length === 0)) ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 dark:bg-white/5 rounded-lg gap-2">
                                        <div className="w-6 h-6 rounded-full border-2 border-indigo-500/10 border-t-indigo-500 animate-spin" style={{ borderTopColor: "var(--color-admin-primary)" }}></div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-60" style={{ color: "var(--color-admin-on-surface-variant)" }}>Loading Chart...</span>
                                    </div>
                                ) : charts.revenue[selectedRevenueInterval]?.length > 0 ? (
                                    <>
                                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                                            <div className="border-t" style={{ borderColor: "var(--color-admin-on-surface)" }}></div>
                                            <div className="border-t" style={{ borderColor: "var(--color-admin-on-surface)" }}></div>
                                            <div className="border-t" style={{ borderColor: "var(--color-admin-on-surface)" }}></div>
                                        </div>
                                        <div className="absolute inset-0 flex items-end overflow-hidden">
                                            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                                                <path d={generatePathD(charts.revenue[selectedRevenueInterval])} fill="none" stroke="var(--color-admin-primary)" strokeWidth="2.5"></path>
                                                <path d={generateAreaD(charts.revenue[selectedRevenueInterval])} fill="url(#revGrad)" opacity="0.12"></path>
                                                <defs>
                                                    <linearGradient id="revGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                                                        <stop offset="0%" style={{ stopColor: "var(--color-admin-primary)", stopOpacity: 1 }}></stop>
                                                        <stop offset="100%" style={{ stopColor: "var(--color-admin-primary)", stopOpacity: 0 }}></stop>
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                        </div>
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-xs opacity-50">No data available</div>
                                )}
                            </div>
                            <div className="flex justify-between items-center mt-3 text-[10px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                <span>{charts.revenue[selectedRevenueInterval]?.[0]?.label || "Start"}</span>
                                <span>{charts.revenue[selectedRevenueInterval]?.[charts.revenue[selectedRevenueInterval].length - 1]?.label || "End"}</span>
                            </div>
                        </div>

                        {/* User Growth Chart */}
                        <div className="border rounded-xl p-6 flex flex-col justify-between" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-sm font-bold" style={{ color: "var(--color-admin-secondary)" }}>User Growth Timeline</h3>
                                    <p className="text-[11px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>Cumulative registered platform user base</p>
                                </div>
                                <div className="flex gap-1.5">
                                    {["7D", "30D", "ALL"].map(inv => (
                                        <button
                                            key={inv}
                                            onClick={() => setSelectedGrowthInterval(inv as any)}
                                            className="px-2.5 py-0.5 text-[10px] rounded transition-all font-semibold"
                                            style={selectedGrowthInterval === inv ? { backgroundColor: "var(--color-admin-secondary)", color: "var(--color-admin-on-secondary)" } : { backgroundColor: "var(--color-admin-surface-container-highest)", color: "var(--color-admin-on-surface)", border: "1px solid var(--color-admin-outline-variant)" }}
                                        >
                                            {inv}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="relative h-48 w-full flex items-end pb-8 border-b" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                {(loading && (!charts.userGrowth[selectedGrowthInterval] || charts.userGrowth[selectedGrowthInterval].length === 0)) ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 dark:bg-white/5 rounded-lg gap-2">
                                        <div className="w-6 h-6 rounded-full border-2 border-purple-500/10 border-t-purple-500 animate-spin" style={{ borderTopColor: "var(--color-admin-secondary)" }}></div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-60" style={{ color: "var(--color-admin-on-surface-variant)" }}>Loading Chart...</span>
                                    </div>
                                ) : charts.userGrowth[selectedGrowthInterval]?.length > 0 ? (
                                    <>
                                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                                            <div className="border-t" style={{ borderColor: "var(--color-admin-on-surface)" }}></div>
                                            <div className="border-t" style={{ borderColor: "var(--color-admin-on-surface)" }}></div>
                                            <div className="border-t" style={{ borderColor: "var(--color-admin-on-surface)" }}></div>
                                        </div>
                                        <div className="absolute inset-0 flex items-end overflow-hidden">
                                            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                                                <path d={generatePathD(charts.userGrowth[selectedGrowthInterval])} fill="none" stroke="var(--color-admin-secondary)" strokeWidth="2.5"></path>
                                                <path d={generateAreaD(charts.userGrowth[selectedGrowthInterval])} fill="url(#growthGrad)" opacity="0.12"></path>
                                                <defs>
                                                    <linearGradient id="growthGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                                                        <stop offset="0%" style={{ stopColor: "var(--color-admin-secondary)", stopOpacity: 1 }}></stop>
                                                        <stop offset="100%" style={{ stopColor: "var(--color-admin-secondary)", stopOpacity: 0 }}></stop>
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                        </div>
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-xs opacity-50">No data available</div>
                                )}
                            </div>
                            <div className="flex justify-between items-center mt-3 text-[10px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                <span>{charts.userGrowth[selectedGrowthInterval]?.[0]?.label || "Start"}</span>
                                <span>{charts.userGrowth[selectedGrowthInterval]?.[charts.userGrowth[selectedGrowthInterval].length - 1]?.label || "End"}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                        {/* Main Table Section */}
                        <div className="xl:col-span-2 space-y-6">
                            {/* Filters Bar */}
                            <div className="p-4 rounded-xl flex flex-wrap gap-4 items-end border" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                                <div className="flex-1 min-w-[200px]">
                                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Status Filter</label>
                                    <select 
                                      value={filterStatus}
                                      onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" 
                                      style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                    >
                                        <option>All Status</option>
                                        <option>Completed</option>
                                        <option>Pending</option>
                                    </select>
                                </div>
                                <button onClick={() => { setSearchQuery(""); setFilterStatus("All Status"); setCurrentPage(1); }} className="px-4 py-2 rounded-lg hover:opacity-90 transition-all flex items-center justify-center border font-semibold" style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)", borderColor: "var(--color-admin-primary)" }}>
                                    Reset Filters
                                </button>
                            </div>

                            {/* Transaction Table */}
                            <div className="rounded-xl overflow-hidden border" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                                {(loading && transactions.length === 0) ? (
                                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <div className="w-8 h-8 rounded-full border-2 border-indigo-500/10 border-t-indigo-500 animate-spin" style={{ borderTopColor: "var(--color-admin-primary)" }}></div>
                                    <span className="text-xs font-bold uppercase tracking-wider opacity-60" style={{ color: "var(--color-admin-on-surface-variant)" }}>Loading Ledger...</span>
                                  </div>
                                ) : error ? (
                                  <div className="flex flex-col items-center justify-center py-20 text-red-500 gap-2">
                                    <span className="material-symbols-outlined text-3xl">error</span>
                                    <span>{error}</span>
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                                                <th className="px-6 py-4 text-xs font-semibold tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Transaction ID</th>
                                                <th className="px-6 py-4 text-xs font-semibold tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Customer</th>
                                                <th className="px-6 py-4 text-xs font-semibold tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Plan / Description</th>
                                                <th className="px-6 py-4 text-xs font-semibold tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Credits</th>
                                                <th className="px-6 py-4 text-xs font-semibold tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Amount ({currencySymbol})</th>
                                                <th className="px-6 py-4 text-xs font-semibold tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                            {paginatedTransactions.map((tx) => (
                                              <tr key={tx.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors group">
                                                  <td className="px-6 py-4 text-sm font-mono" style={{ color: "var(--color-admin-on-surface)" }}>
                                                    #LTX-{tx.id.substring(0, 6).toUpperCase()}
                                                  </td>
                                                  <td className="px-6 py-4">
                                                      <div>
                                                          <p className="text-sm font-semibold" style={{ color: "var(--color-admin-on-surface)" }}>{tx.userName}</p>
                                                          <p className="text-xs opacity-75" style={{ color: "var(--color-admin-on-surface-variant)" }}>{tx.userEmail}</p>
                                                      </div>
                                                  </td>
                                                  <td className="px-6 py-4">
                                                      <span className="text-sm font-medium" style={{ color: "var(--color-admin-on-surface)" }}>{tx.description}</span>
                                                  </td>
                                                  <td className="px-6 py-4 text-sm font-semibold" style={{ color: "var(--color-admin-primary)" }}>
                                                    {tx.amountCredits} pts
                                                  </td>
                                                  <td className="px-6 py-4 text-sm font-medium" style={{ color: "var(--color-admin-on-surface)" }}>
                                                    {fmtCurrency(tx.amount ?? 0)}
                                                  </td>
                                                  <td className="px-6 py-4">
                                                      <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={tx.status === "Completed" ? { color: "var(--color-admin-primary)" } : tx.status === "Pending" ? { color: "var(--color-admin-secondary)" } : { color: "var(--color-admin-error)" }}>
                                                          <span className="w-1.5 h-1.5 rounded-full" style={tx.status === "Completed" ? { backgroundColor: "var(--color-admin-primary)" } : tx.status === "Pending" ? { backgroundColor: "var(--color-admin-secondary)" } : { backgroundColor: "var(--color-admin-error)" }}></span> {tx.status}
                                                      </span>
                                                  </td>
                                              </tr>
                                            ))}
                                            {paginatedTransactions.length === 0 && (
                                              <tr>
                                                <td colSpan={6} className="text-center py-8 text-sm" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                                  no entries are available
                                                </td>
                                              </tr>
                                            )}
                                        </tbody>
                                    </table>
                                  </div>
                                )}
                                <div className="px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                                    <p className="text-xs font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                      Showing {filteredTransactions.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, filteredTransactions.length)} of {filteredTransactions.length} entries
                                    </p>
                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                className="p-1.5 rounded-lg border text-xs font-semibold hover:opacity-80 transition-all flex items-center justify-center disabled:opacity-40"
                                                style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                            >
                                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                                            </button>
                                            {Array.from({ length: totalPages }).map((_, idx) => {
                                                const pageNum = idx + 1;
                                                const isCurrent = pageNum === currentPage;
                                                // Only show current page, first, last, and immediate neighbors to avoid page listing overflow
                                                if (totalPages > 5 && pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentPage) > 1) {
                                                    if (pageNum === 2 || pageNum === totalPages - 1) {
                                                        return <span key={pageNum} className="text-xs opacity-50 px-1">...</span>;
                                                    }
                                                    return null;
                                                }
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className="w-7 h-7 rounded-lg text-xs font-semibold transition-all flex items-center justify-center border"
                                                        style={isCurrent ? {
                                                            backgroundColor: "var(--color-admin-primary-container)",
                                                            color: "var(--color-admin-on-primary-container)",
                                                            borderColor: "var(--color-admin-primary)"
                                                        } : {
                                                            backgroundColor: "var(--color-admin-surface-container-lowest)",
                                                            borderColor: "var(--color-admin-outline-variant)",
                                                            color: "var(--color-admin-on-surface)"
                                                        }}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                            <button
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                className="p-1.5 rounded-lg border text-xs font-semibold hover:opacity-80 transition-all flex items-center justify-center disabled:opacity-40"
                                                style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                            >
                                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Point Provision Section */}
                        <aside className="space-y-6">
                            <div className="p-6 rounded-xl border shadow-lg animate-fade-in" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                                <h4 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                                    <span className="material-symbols-outlined">description</span> Quick Point Provision
                                </h4>
                                <form onSubmit={handleQuickInvoiceSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Customer Email</label>
                                        <input 
                                          value={formEmail}
                                          onChange={(e) => setFormEmail(e.target.value)}
                                          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" 
                                          style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }} 
                                          placeholder="Enter user email..." 
                                          type="email" 
                                          required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Credits (Points)</label>
                                            <input 
                                              value={formAmount}
                                              onChange={(e) => setFormAmount(e.target.value)}
                                              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" 
                                              style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }} 
                                              placeholder="e.g. 100" 
                                              type="number" 
                                              required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Type</label>
                                            <select 
                                              value={formType}
                                              onChange={(e) => setFormType(e.target.value)}
                                              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" 
                                              style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                            >
                                                <option value="recharge">Recharge</option>
                                                <option value="refund">Refund (Deduct)</option>
                                                <option value="pending">Pending Ledger</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Transaction Notes</label>
                                        <textarea
                                          value={formDescription}
                                          onChange={(e) => setFormDescription(e.target.value)}
                                          className="w-full border rounded-lg p-3 h-24 text-sm outline-none focus:ring-1 focus:ring-primary"
                                          style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                          placeholder="Notes or description..."
                                        />
                                    </div>
                                    <button 
                                      disabled={formSubmitting}
                                      className="w-full py-3 font-bold rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-2 shadow-lg disabled:opacity-50" 
                                      style={{ backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-primary-container)" }} 
                                      type="submit"
                                    >
                                        <span className="material-symbols-outlined">send</span> {formSubmitting ? "Processing..." : "Generate & Post"}
                                    </button>
                                </form>
                            </div>

                            {/* Recent Activity Feed */}
                            <div className="p-6 rounded-xl border animate-fade-in" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                                <h4 className="text-sm font-bold mb-4" style={{ color: "var(--color-admin-on-surface)" }}>Financial Logs</h4>
                                <div className="space-y-4">
                                    {transactions.slice(0, 3).map((tx) => (
                                      <div key={tx.id} className="flex gap-3">
                                          <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(195, 192, 255, 0.2)" }}>
                                              <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--color-admin-primary)" }}>history_edu</span>
                                          </div>
                                          <div>
                                              <p className="text-sm font-medium" style={{ color: "var(--color-admin-on-surface)" }}>
                                                {tx.description} for {tx.userName}
                                              </p>
                                              <p className="text-xs mt-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                                {new Date(tx.createdAt).toLocaleString()}
                                              </p>
                                          </div>
                                      </div>
                                    ))}
                                    {transactions.length === 0 && (
                                      <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>no entries are available</p>
                                    )}
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </main>

            {/* ═══════════════════════════════════════════════════════════════
                BILLING DETAIL MODAL
            ═══════════════════════════════════════════════════════════════ */}
            {activeModal && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
                    onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
                >
                    <div
                        className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
                        style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)" }}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: activeModal.color + "22" }}>
                                    <span className="material-symbols-outlined text-[22px]" style={{ color: activeModal.color }}>{activeModal.icon}</span>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold" style={{ color: "var(--color-admin-on-surface)" }}>{activeModal.title}</h3>
                                    <p className="text-[11px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                        {modalLoading ? "Loading..." : `${modalRows.length} record${modalRows.length !== 1 ? "s" : ""} found`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Search inside modal */}
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>search</span>
                                    <input
                                        value={modalSearch}
                                        onChange={e => { setModalSearch(e.target.value); setModalPage(1); }}
                                        placeholder="Search..."
                                        className="pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none"
                                        style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)", width: 200 }}
                                    />
                                </div>
                                <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto">
                            {modalLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-transparent animate-spin" style={{ borderStyle: "solid", borderWidth: "2px", borderTopColor: activeModal.color, borderRightColor: activeModal.color + "22", borderBottomColor: activeModal.color + "22", borderLeftColor: activeModal.color + "22" }}></div>
                                    <span className="text-xs font-bold uppercase tracking-wider opacity-60" style={{ color: "var(--color-admin-on-surface-variant)" }}>Loading details...</span>
                                </div>
                            ) : (() => {
                                // Filter rows by search
                                const filtered = modalRows.filter(r => {
                                    const q = modalSearch.toLowerCase();
                                    return !q ||
                                        (r.userName || "").toLowerCase().includes(q) ||
                                        (r.userEmail || "").toLowerCase().includes(q) ||
                                        (r.description || "").toLowerCase().includes(q) ||
                                        (r.orderId || "").toLowerCase().includes(q) ||
                                        (r.planType || "").toLowerCase().includes(q) ||
                                        (r.id || "").toLowerCase().includes(q);
                                });
                                const totalPages = Math.max(1, Math.ceil(filtered.length / MODAL_PAGE_SIZE));
                                const pageRows = filtered.slice((modalPage - 1) * MODAL_PAGE_SIZE, modalPage * MODAL_PAGE_SIZE);
                                const isUserModal = activeModal.type === "renewed" || activeModal.type === "churned";

                                return filtered.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <span className="material-symbols-outlined text-4xl opacity-30" style={{ color: "var(--color-admin-on-surface-variant)" }}>inbox</span>
                                        <p className="text-sm opacity-50" style={{ color: "var(--color-admin-on-surface-variant)" }}>no entries are available</p>
                                    </div>
                                ) : (
                                    <>
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b" style={{ borderColor: "var(--color-admin-outline-variant)", backgroundColor: "var(--color-admin-surface-container-low)" }}>
                                                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>User</th>
                                                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Email</th>
                                                    {!isUserModal && <th className="px-4 py-3 text-right font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Amount</th>}
                                                    {!isUserModal && <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Description</th>}
                                                    {isUserModal && <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Membership</th>}
                                                    {isUserModal && <th className="px-4 py-3 text-right font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Renewals</th>}
                                                    {isUserModal && <th className="px-4 py-3 text-right font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Points</th>}
                                                    <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Date & Time</th>
                                                    <th className="px-4 py-3 text-center font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Status</th>
                                                    <th className="px-4 py-3 text-right font-semibold" style={{ color: "var(--color-admin-on-surface-variant)" }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pageRows.map((row: any, idx: number) => {
                                                    const actionKey = row.id;
                                                    const isActing = (k: string) => modalActionLoading === actionKey + k;
                                                    const statusColor =
                                                        row.status === "Completed" || row.status === "Active" ? "#10b981" :
                                                        row.status === "Refunded" ? "#3b82f6" :
                                                        row.status === "Refund Pending" ? "#a855f7" :
                                                        row.status === "Churned" || row.status === "Expired" ? "#ef4444" :
                                                        row.status === "Failed" ? "#ef4444" : "#94a3b8";

                                                    return (
                                                        <tr key={row.id + idx} className="border-b hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                                            <td className="px-4 py-3 font-medium" style={{ color: "var(--color-admin-on-surface)" }}>
                                                                {row.userName}
                                                            </td>
                                                            <td className="px-4 py-3" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                                                {row.userEmail}
                                                            </td>

                                                            {/* Transaction-type rows */}
                                                            {!isUserModal && (
                                                                <td className="px-4 py-3 text-right font-bold" style={{ color: "var(--color-admin-on-surface)" }}>
                                                                    {row.source === "membership"
                                                                        ? fmtCurrency(row.amount ?? 0)
                                                                        : `${(row.amountCredits ?? row.amount ?? 0).toLocaleString()} pts`}
                                                                    {row.source === "membership" && activeCurrency !== "INR" && (
                                                                        <span className="block text-[10px] font-normal opacity-60">(~₹{(row.amount ?? 0).toLocaleString()})</span>
                                                                    )}
                                                                </td>
                                                            )}
                                                            {!isUserModal && (
                                                                <td className="px-4 py-3 max-w-[180px] truncate" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                                                    {row.description}
                                                                    {row.orderId && <span className="block text-[10px] opacity-50">#{row.orderId}</span>}
                                                                </td>
                                                            )}

                                                            {/* User-type rows */}
                                                            {isUserModal && (
                                                                <td className="px-4 py-3" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: row.membership !== "free" ? "#10b98122" : "#ef444422", color: row.membership !== "free" ? "#10b981" : "#ef4444" }}>
                                                                        {row.membership}
                                                                    </span>
                                                                    {row.membershipExpiresAt && (
                                                                        <span className="block text-[10px] opacity-50 mt-0.5">Exp: {new Date(row.membershipExpiresAt).toLocaleDateString()}</span>
                                                                    )}
                                                                </td>
                                                            )}
                                                            {isUserModal && (
                                                                <td className="px-4 py-3 text-right font-bold" style={{ color: "var(--color-admin-on-surface)" }}>
                                                                    {row.renewalCount}×
                                                                </td>
                                                            )}
                                                            {isUserModal && (
                                                                <td className="px-4 py-3 text-right" style={{ color: "#f59e0b" }}>
                                                                    {(row.points || 0).toLocaleString()} pts
                                                                </td>
                                                            )}

                                                            <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                                                {new Date(row.createdAt).toLocaleDateString()}
                                                                <span className="block text-[10px] opacity-60">{new Date(row.createdAt).toLocaleTimeString()}</span>
                                                            </td>

                                                            <td className="px-4 py-3 text-center">
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: statusColor + "22", color: statusColor }}>
                                                                    {row.status}
                                                                </span>
                                                            </td>

                                                            {/* Context-aware Actions */}
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                                    {/* REFUND PENDING: Approve / Reject */}
                                                                    {activeModal.type === "refund_pending" && (
                                                                        <>
                                                                            <button
                                                                                disabled={!!modalActionLoading}
                                                                                onClick={() => modalAction("approve_refund", row.id, row.source)}
                                                                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all hover:opacity-80 disabled:opacity-40"
                                                                                style={{ backgroundColor: "#10b98122", color: "#10b981" }}
                                                                            >
                                                                                {isActing("approve_refund") ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div> : <span className="material-symbols-outlined text-[12px]">check_circle</span>}
                                                                                Approve
                                                                            </button>
                                                                            <button
                                                                                disabled={!!modalActionLoading}
                                                                                onClick={() => modalAction("reject_refund", row.id, row.source)}
                                                                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all hover:opacity-80 disabled:opacity-40"
                                                                                style={{ backgroundColor: "#ef444422", color: "#ef4444" }}
                                                                            >
                                                                                {isActing("reject_refund") ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div> : <span className="material-symbols-outlined text-[12px]">cancel</span>}
                                                                                Reject
                                                                            </button>
                                                                        </>
                                                                    )}

                                                                    {/* FAILED: Re-initiate */}
                                                                    {activeModal.type === "failed" && (
                                                                        <button
                                                                            disabled={!!modalActionLoading}
                                                                            onClick={() => modalAction("reinitiate", row.id, row.source)}
                                                                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all hover:opacity-80 disabled:opacity-40"
                                                                            style={{ backgroundColor: "#f59e0b22", color: "#f59e0b" }}
                                                                        >
                                                                            {isActing("reinitiate") ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div> : <span className="material-symbols-outlined text-[12px]">replay</span>}
                                                                            Re-initiate
                                                                        </button>
                                                                    )}

                                                                    {/* SUCCESSFUL / MONTHLY_REVENUE: Issue Refund */}
                                                                    {(activeModal.type === "successful" || activeModal.type === "monthly_revenue") && (
                                                                        <button
                                                                            disabled={!!modalActionLoading}
                                                                            onClick={() => modalAction("issue_refund", row.id, row.source)}
                                                                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all hover:opacity-80 disabled:opacity-40"
                                                                            style={{ backgroundColor: "#3b82f622", color: "#3b82f6" }}
                                                                        >
                                                                            {isActing("issue_refund") ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div> : <span className="material-symbols-outlined text-[12px]">assignment_return</span>}
                                                                            Issue Refund
                                                                        </button>
                                                                    )}

                                                                    {/* REFUNDED: Re-issue */}
                                                                    {activeModal.type === "refunded" && (
                                                                        <button
                                                                            disabled={!!modalActionLoading}
                                                                            onClick={() => modalAction("issue_refund", row.id, row.source)}
                                                                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all hover:opacity-80 disabled:opacity-40"
                                                                            style={{ backgroundColor: "#3b82f622", color: "#3b82f6" }}
                                                                        >
                                                                            {isActing("issue_refund") ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div> : <span className="material-symbols-outlined text-[12px]">redo</span>}
                                                                            Re-issue
                                                                        </button>
                                                                    )}

                                                                    {/* POINTS CREDIT: Adjust Points */}
                                                                    {activeModal.type === "points_credit" && (
                                                                        <>
                                                                            {modalAdjustId === row.id ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    <input
                                                                                        type="number"
                                                                                        value={modalAdjustAmt}
                                                                                        onChange={e => setModalAdjustAmt(e.target.value)}
                                                                                        placeholder="±pts"
                                                                                        className="w-16 px-1.5 py-1 text-[10px] rounded border outline-none"
                                                                                        style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                                                                    />
                                                                                    <button
                                                                                        disabled={!!modalActionLoading}
                                                                                        onClick={() => modalAdjustPoints(row.userId)}
                                                                                        className="px-1.5 py-1 rounded text-[10px] font-bold transition-all hover:opacity-80 disabled:opacity-40"
                                                                                        style={{ backgroundColor: "#10b98122", color: "#10b981" }}
                                                                                    >
                                                                                        {modalActionLoading === row.userId + "adjust" ? "..." : "Apply"}
                                                                                    </button>
                                                                                    <button onClick={() => { setModalAdjustId(null); setModalAdjustAmt(""); }} className="px-1.5 py-1 rounded text-[10px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>✕</button>
                                                                                </div>
                                                                            ) : (
                                                                                <button
                                                                                    onClick={() => { setModalAdjustId(row.id); setModalAdjustAmt(""); }}
                                                                                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all hover:opacity-80"
                                                                                    style={{ backgroundColor: "#f59e0b22", color: "#f59e0b" }}
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[12px]">tune</span>
                                                                                    Adjust Points
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}

                                                                    {/* RENEWED / CHURNED: View Profile */}
                                                                    {isUserModal && (
                                                                        <Link
                                                                            href={`/admin/users?id=${row.userId}`}
                                                                            onClick={closeModal}
                                                                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all hover:opacity-80"
                                                                            style={{ backgroundColor: "#a855f722", color: "#a855f7" }}
                                                                        >
                                                                            <span className="material-symbols-outlined text-[12px]">person</span>
                                                                            View Profile
                                                                        </Link>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>

                                        {/* Pagination */}
                                        {totalPages > 1 && (
                                            <div className="flex items-center justify-between px-6 py-3 border-t" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                                <span className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                                    Page {modalPage} of {totalPages} · {filtered.length} total
                                                </span>
                                                <div className="flex gap-2">
                                                    <button
                                                        disabled={modalPage <= 1}
                                                        onClick={() => setModalPage(p => p - 1)}
                                                        className="px-3 py-1 rounded text-xs font-medium border disabled:opacity-40 hover:bg-black/5 transition-colors"
                                                        style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                                    >← Prev</button>
                                                    <button
                                                        disabled={modalPage >= totalPages}
                                                        onClick={() => setModalPage(p => p + 1)}
                                                        className="px-3 py-1 rounded text-xs font-medium border disabled:opacity-40 hover:bg-black/5 transition-colors"
                                                        style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                                    >Next →</button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
