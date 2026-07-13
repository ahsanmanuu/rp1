'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function AdminOffersPage() {
    const [currentTheme, setCurrentTheme] = useState<'indigo' | 'emerald' | 'rose'>('indigo');
    const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [adminName, setAdminName] = useState<string>("Admin Root");

    // Database campaigns (offers)
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(true);

    // Announcements state
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

    // Offer form state
    const [title, setTitle] = useState("");
    const [code, setCode] = useState("");
    const [description, setDescription] = useState("");
    const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
    const [discountValue, setDiscountValue] = useState("");
    const [offerType, setOfferType] = useState<'GLOBAL' | 'USER'>('GLOBAL');
    const [userEmail, setUserEmail] = useState("");
    const [expiry, setExpiry] = useState("");
    const [submittingCampaign, setSubmittingCampaign] = useState(false);

    // Announcement form state
    const [announcementBody, setAnnouncementBody] = useState("");
    const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);

    // Live Support Admin Console States
    const [chatSessions, setChatSessions] = useState<any[]>([]);
    const [chatHistorySessions, setChatHistorySessions] = useState<any[]>([]);
    const [activeChatTab, setActiveChatTab] = useState<'active' | 'history'>('active');
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [responseMessage, setResponseMessage] = useState("");
    const [sendingResponse, setSendingResponse] = useState(false);
    const chatEndRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const savedTheme = localStorage.getItem('latexify-admin-theme') as 'indigo' | 'emerald' | 'rose' | null;
        const savedMode = localStorage.getItem('latexify-admin-mode');

        if (savedTheme) setCurrentTheme(savedTheme);
        if (savedMode) setIsDarkMode(savedMode === 'dark');
        const storedName = localStorage.getItem('latexify-admin-name');
        if (storedName) setAdminName(storedName);
    }, []);

    useEffect(() => {
        localStorage.setItem('latexify-admin-theme', currentTheme);
        localStorage.setItem('latexify-admin-mode', isDarkMode ? 'dark' : 'light');
    }, [currentTheme, isDarkMode]);

    // Live Chat Support Handlers & Polling
    const sendAdminHeartbeat = async () => {
        try {
            await fetch("/api/admin/chat/heartbeat", { method: "POST" });
        } catch (err) {
            console.warn("[AdminOffers] Heartbeat failure:", err);
        }
    };

    const fetchChatSessions = async (silent = false) => {
        try {
            const [activeRes, historyRes] = await Promise.all([
                fetch("/api/admin/chat/sessions?status=open"),
                fetch("/api/admin/chat/sessions?status=history")
            ]);
            if (activeRes.ok) {
                const data = await activeRes.json();
                if (data.success) setChatSessions(data.sessions || []);
            }
            if (historyRes.ok) {
                const data = await historyRes.json();
                if (data.success) setChatHistorySessions(data.sessions || []);
            }
        } catch (err) {
            console.error("Failed to load chat sessions:", err);
        }
    };

    const fetchActiveMessages = async () => {
        if (!selectedSession?.id) return;
        try {
            const res = await fetch(`/api/admin/chat/messages?sessionId=${selectedSession.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setChatMessages(data.messages || []);
                }
            }
        } catch (err) {
            console.warn("Failed to load messages:", err);
        }
    };

    const handleSendResponse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!responseMessage.trim() || !selectedSession?.id) return;

        const text = responseMessage;
        setResponseMessage("");
        setSendingResponse(true);

        try {
            const res = await fetch("/api/admin/chat/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: selectedSession.id,
                    content: text
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.message) {
                    setChatMessages(prev => [...prev, data.message]);
                }
            }
        } catch (err) {
            console.error("Failed to send message response:", err);
        } finally {
            setSendingResponse(false);
        }
    };

    const handleUpdateSessionStatus = async (id: string, status: string) => {
        try {
            const res = await fetch("/api/admin/chat/sessions", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: id, status })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    if (selectedSession?.id === id) {
                        setSelectedSession(null);
                        setChatMessages([]);
                    }
                    fetchChatSessions(true);
                }
            }
        } catch (err) {
            console.error("Failed to update session status:", err);
        }
    };

    const handleDeleteChatSession = async (id: string) => {
        if (!window.confirm("Are you sure you want to permanently delete this chat session log? This cannot be undone.")) return;
        try {
            const res = await fetch(`/api/admin/chat/sessions?sessionId=${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    if (selectedSession?.id === id) {
                        setSelectedSession(null);
                        setChatMessages([]);
                    }
                    fetchChatSessions(true);
                }
            }
        } catch (err) {
            console.error("Failed to delete chat session:", err);
        }
    };

    // Auto-scroll chat window
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    // Live console scheduler
    useEffect(() => {
        sendAdminHeartbeat();
        fetchChatSessions(false);

        const heartbeatInt = setInterval(sendAdminHeartbeat, 20000);
        const sessionsInt = setInterval(() => fetchChatSessions(true), 7000);

        return () => {
            clearInterval(heartbeatInt);
            clearInterval(sessionsInt);
        };
    }, []);

    // Active conversation scheduler
    useEffect(() => {
        if (!selectedSession?.id) return;
        fetchActiveMessages();

        const messagesInt = setInterval(fetchActiveMessages, 3000);
        return () => clearInterval(messagesInt);
    }, [selectedSession?.id]);

    const fetchCampaigns = async () => {
        try {
            setLoadingCampaigns(true);
            const res = await fetch("/api/admin/offers");
            if (!res.ok) {
                console.warn("Failed to load offers:", res.statusText);
                return;
            }
            const data = await res.json();
            if (data.success) {
                setCampaigns(data.offers || []);
            }
        } catch (err) {
            console.error("Failed to load offers:", err);
        } finally {
            setLoadingCampaigns(false);
        }
    };

    const fetchAnnouncements = async () => {
        try {
            setLoadingAnnouncements(true);
            const res = await fetch("/api/admin/announcements");
            if (!res.ok) {
                console.warn("Failed to load announcements:", res.statusText);
                return;
            }
            const data = await res.json();
            if (data.success) {
                setAnnouncements(data.announcements || []);
            }
        } catch (err) {
            console.error("Failed to load announcements:", err);
        } finally {
            setLoadingAnnouncements(false);
        }
    };

    const handleDeleteAnnouncement = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this announcement?")) return;
        try {
            const res = await fetch("/api/admin/announcements", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                alert("Announcement deleted successfully!");
                fetchAnnouncements();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    useEffect(() => {
        fetchCampaigns();
        fetchAnnouncements();
    }, []);

    const toggleTheme = () => {
        setIsThemeMenuOpen(!isThemeMenuOpen);
    };

    const handleThemeSelect = (theme: 'indigo' | 'emerald' | 'rose') => {
        setCurrentTheme(theme);
        setIsThemeMenuOpen(false);
    };

    const handleCreateCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !code || !expiry || !discountValue) {
            alert("Please fill in all required fields (Title, Code, Discount, Expiry)");
            return;
        }

        try {
            setSubmittingCampaign(true);
            const payload: any = {
                title,
                code: code.toUpperCase().trim(),
                description,
                offerType,
                expiresAt: expiry,
                discountPercent: discountType === 'percent' ? parseFloat(discountValue) : null,
                discountAmount: discountType === 'amount' ? parseFloat(discountValue) : null,
            };

            if (offerType === 'USER') {
                payload.userEmail = userEmail;
            }

            const res = await fetch("/api/admin/offers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                alert(`Successfully launched offer ${code.toUpperCase()}!`);
                setTitle("");
                setCode("");
                setDescription("");
                setDiscountValue("");
                setUserEmail("");
                setExpiry("");
                fetchCampaigns();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setSubmittingCampaign(false);
        }
    };

    const handleDeleteOffer = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this offer?")) return;
        try {
            const res = await fetch("/api/admin/offers", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                alert("Offer deleted successfully");
                fetchCampaigns();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleCreateAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!announcementBody) {
            alert("Please enter notification body");
            return;
        }

        try {
            setSubmittingAnnouncement(true);
            const res = await fetch("/api/admin/announcements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: "System Broadcast",
                    content: announcementBody,
                    priority: "info"
                })
            });
            const data = await res.json();
            if (data.success) {
                alert("Global announcement broadcasted successfully!");
                setAnnouncementBody("");
                fetchAnnouncements();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setSubmittingAnnouncement(false);
        }
    };

    return (
        <div className={`min-h-screen ${isDarkMode ? 'dark' : ''} transition-colors duration-500 font-body-md overflow-x-hidden`} style={{ backgroundColor: 'var(--color-admin-background)', color: 'var(--color-admin-on-background)' }}>
            
            {/* Theme CSS Variables Injection */}
            {currentTheme === 'indigo' && (
                <style jsx global>{`
                    :root {
                        --color-admin-primary: #c3c0ff;
                        --color-admin-primary-container: #4f46e5;
                        --color-admin-on-primary-container: #dad7ff;
                        --color-admin-secondary: #c0c1ff;
                        --color-admin-secondary-container: #3131c0;
                        --color-admin-on-secondary-container: #b0b2ff;
                        --color-admin-tertiary: #ffb695;
                        --color-admin-tertiary-container: #a44100;
                        --color-admin-on-tertiary-container: #ffd2be;
                        --color-admin-error: #ffb4ab;
                        --color-admin-error-container: #93000a;
                        --color-admin-on-error-container: #ffdad6;
                    }
                `}</style>
            )}
            {currentTheme === 'emerald' && (
                <style jsx global>{`
                    :root {
                        --color-admin-primary: #6ee7b7;
                        --color-admin-primary-container: #059669;
                        --color-admin-on-primary-container: #d1fae5;
                        --color-admin-secondary: #a7f3d0;
                        --color-admin-secondary-container: #047857;
                        --color-admin-on-secondary-container: #ecfdf5;
                        --color-admin-tertiary: #fcd34d;
                        --color-admin-tertiary-container: #b45309;
                        --color-admin-on-tertiary-container: #fef3c7;
                        --color-admin-error: #fca5a5;
                        --color-admin-error-container: #b91c1c;
                        --color-admin-on-error-container: #fee2e2;
                    }
                `}</style>
            )}
            {currentTheme === 'rose' && (
                <style jsx global>{`
                    :root {
                        --color-admin-primary: #fda4af;
                        --color-admin-primary-container: #e11d48;
                        --color-admin-on-primary-container: #ffe4e6;
                        --color-admin-secondary: #fecdd3;
                        --color-admin-secondary-container: #be123c;
                        --color-admin-on-secondary-container: #fff1f2;
                        --color-admin-tertiary: #fde047;
                        --color-admin-tertiary-container: #a16207;
                        --color-admin-on-tertiary-container: #fef08a;
                        --color-admin-error: #f87171;
                        --color-admin-error-container: #991b1b;
                        --color-admin-on-error-container: #fee2e2;
                    }
                `}</style>
            )}

            {!isDarkMode && (
                <style jsx global>{`
                    :root {
                        --color-admin-background: #f8fafc !important;
                        --color-admin-surface: #ffffff !important;
                        --color-admin-surface-dim: #f1f5f9 !important;
                        --color-admin-surface-bright: #ffffff !important;
                        --color-admin-surface-container-lowest: #ffffff !important;
                        --color-admin-surface-container-low: #f8fafc !important;
                        --color-admin-surface-container: #f1f5f9 !important;
                        --color-admin-surface-container-high: #e2e8f0 !important;
                        --color-admin-surface-container-highest: #cbd5e1 !important;
                        --color-admin-on-surface: #0f172a !important;
                        --color-admin-on-surface-variant: #475569 !important;
                        --color-admin-on-background: #0f172a !important;
                        --color-admin-outline: #94a3b8 !important;
                        --color-admin-outline-variant: #cbd5e1 !important;
                        --color-admin-error: #ba1a1a !important;
                        --color-admin-on-error: #ffffff !important;
                        --color-admin-error-container: #ffdad6 !important;
                        --color-admin-on-error-container: #410002 !important;
                    }
                `}</style>
            )}

            {/* Sidebar */}
            <aside className="flex flex-col h-full p-4 gap-2 fixed h-screen w-64 left-0 top-0 border-r z-50 transition-colors duration-500"
              style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
              <div className="flex flex-col items-center gap-1 px-2 mb-6 mt-2 text-center">
                <Image src="/logo.png" alt="Latexify Logo" width={0} height={0} sizes="100%" className="w-48 h-12 object-contain"
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
                <a className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all translate-x-1 duration-200 shadow-sm"
                  style={{ backgroundColor: 'var(--color-admin-secondary-container)', color: 'var(--color-admin-on-secondary-container)' }} href="#">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>local_offer</span>Offers
                </a>
                <Link href="/admin/emails" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
                  style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                  <span className="material-symbols-outlined">mail</span>Email History
                </Link>
                <Link href="/admin/banners" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
                  style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                  <span className="material-symbols-outlined">view_carousel</span>Banners
                </Link>
                <Link href="/admin/testimonials" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
                  style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                  <span className="material-symbols-outlined">star</span>Testimonials
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

            {/* Top AppBar */}
            <header className="flex justify-between items-center w-full px-8 py-4 ml-64 fixed top-0 border-b z-40 bg-opacity-90 backdrop-blur-md transition-colors duration-500" style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)", width: "calc(100% - 16rem)" }}>
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold" style={{ color: "var(--color-admin-primary)" }}>Marketing &amp; Communication</h2>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        {/* Theme Switcher Button */}
                        <div className="relative group">
                            <button onClick={toggleTheme} className="flex items-center gap-1 transition-colors cursor-pointer" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                <span className="material-symbols-outlined text-[20px]">palette</span>
                                <span className="material-symbols-outlined text-[16px]">expand_more</span>
                            </button>
                            {/* Theme Menu Dropdown */}
                            {isThemeMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 rounded-xl border shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50 p-2" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                                    <p className="text-[10px] font-bold uppercase mb-2 px-2" style={{ color: "var(--color-admin-on-surface-variant)" }}>Theme Accent</p>
                                    <div className="grid grid-cols-4 gap-2 px-1 pb-1">
                                        <div onClick={() => handleThemeSelect('indigo')} className={`w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform ${currentTheme === 'indigo' ? 'border-2 border-white' : 'border border-white/20'}`} style={{ backgroundColor: "#c3c0ff" }} title="Indigo"></div>
                                        <div onClick={() => handleThemeSelect('emerald')} className={`w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform ${currentTheme === 'emerald' ? 'border-2 border-white' : 'border border-white/10'}`} style={{ backgroundColor: "#6ee7b7" }} title="Emerald"></div>
                                        <div onClick={() => handleThemeSelect('rose')} className={`w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform ${currentTheme === 'rose' ? 'border-2 border-white' : 'border border-white/10'}`} style={{ backgroundColor: "#fda4af" }} title="Rose"></div>
                                    </div>
                                    <div className="h-px w-full my-2" style={{ backgroundColor: "var(--color-admin-outline-variant)" }}></div>
                                    <p className="text-[10px] font-bold uppercase mb-2 px-2" style={{ color: "var(--color-admin-on-surface-variant)" }}>Mode</p>
                                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left text-sm" style={{ color: "var(--color-admin-on-surface)" }}>
                                        <span className="material-symbols-outlined text-[18px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                                        {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                                    </button>
                                </div>
                            )}
                        </div>
                        <span className="material-symbols-outlined cursor-pointer transition-colors" style={{ color: "var(--color-admin-on-surface-variant)" }}>notifications</span>
                        <Link href="/admin/profile" className="flex items-center text-inherit"><span className="material-symbols-outlined cursor-pointer transition-colors" style={{ color: "var(--color-admin-on-surface-variant)" }}>settings</span></Link>
                        <div className="h-8 w-8 rounded-full overflow-hidden border flex items-center justify-center font-bold" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-primary)" }}>
                            {adminName.split(/\s+/).map(n => n[0]).join("").slice(0,2).toUpperCase() || "AR"}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Canvas */}
            <main className="ml-64 mt-20 p-8">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Column: Offers & Campaigns */}
                    <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
                        
                        {/* Offer Creation Card */}
                        <section className="border p-6 rounded-xl" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined" style={{ color: "var(--color-admin-primary)" }}>add_circle</span>
                                    <h3 className="text-xl font-semibold" style={{ color: "var(--color-admin-on-surface)" }}>Offer Posting Workflow</h3>
                                </div>
                                <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: "rgba(195, 192, 255, 0.2)", color: "var(--color-admin-primary)" }}>New Campaign</span>
                            </div>
                            
                            <form onSubmit={handleCreateCampaign} className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Offer Title</label>
                                    <input 
                                      value={title}
                                      onChange={(e) => setTitle(e.target.value)}
                                      className="w-full border rounded-lg p-2.5 text-sm outline-none transition-all focus:ring-1" 
                                      style={{ backgroundColor: "var(--color-admin-background)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }} 
                                      placeholder="e.g., Special Launch Promo" 
                                      type="text" 
                                      required
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Description</label>
                                    <input 
                                      value={description}
                                      onChange={(e) => setDescription(e.target.value)}
                                      className="w-full border rounded-lg p-2.5 text-sm outline-none transition-all focus:ring-1" 
                                      style={{ backgroundColor: "var(--color-admin-background)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }} 
                                      placeholder="e.g., Get ₹150 off on quarterly plans" 
                                      type="text"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Promo Code</label>
                                    <input 
                                      value={code}
                                      onChange={(e) => setCode(e.target.value)}
                                      className="w-full border rounded-lg p-2.5 text-sm outline-none uppercase font-mono font-bold" 
                                      style={{ backgroundColor: "var(--color-admin-background)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }} 
                                      placeholder="LATEX25" 
                                      type="text" 
                                      required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Expiry Date</label>
                                    <input 
                                      value={expiry}
                                      onChange={(e) => setExpiry(e.target.value)}
                                      className="w-full border rounded-lg p-2.5 text-sm outline-none" 
                                      style={{ backgroundColor: "var(--color-admin-background)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }} 
                                      type="date" 
                                      required
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Offer Scope</label>
                                    <select
                                      value={offerType}
                                      onChange={(e) => setOfferType(e.target.value as 'GLOBAL' | 'USER')}
                                      className="w-full border rounded-lg p-2.5 text-sm outline-none" 
                                      style={{ backgroundColor: "var(--color-admin-background)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                    >
                                        <option value="GLOBAL">Global (All Users)</option>
                                        <option value="USER">User Specific (Email)</option>
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                        {offerType === 'USER' ? 'Target User Email' : 'Scope Target'}
                                    </label>
                                    <input 
                                      value={userEmail}
                                      disabled={offerType === 'GLOBAL'}
                                      onChange={(e) => setUserEmail(e.target.value)}
                                      className="w-full border rounded-lg p-2.5 text-sm outline-none disabled:opacity-50 disabled:cursor-not-allowed" 
                                      style={{ backgroundColor: "var(--color-admin-background)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }} 
                                      placeholder={offerType === 'GLOBAL' ? 'Active for everyone' : 'user@example.com'}
                                      type="email" 
                                      required={offerType === 'USER'}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Discount Type</label>
                                    <select
                                      value={discountType}
                                      onChange={(e) => setDiscountType(e.target.value as 'percent' | 'amount')}
                                      className="w-full border rounded-lg p-2.5 text-sm outline-none" 
                                      style={{ backgroundColor: "var(--color-admin-background)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                    >
                                        <option value="percent">Percentage (%)</option>
                                        <option value="amount">Flat Amount (₹)</option>
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Discount Value</label>
                                    <input 
                                      value={discountValue}
                                      onChange={(e) => setDiscountValue(e.target.value)}
                                      className="w-full border rounded-lg p-2.5 text-sm outline-none" 
                                      style={{ backgroundColor: "var(--color-admin-background)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }} 
                                      placeholder={discountType === 'percent' ? 'e.g. 20 for 20%' : 'e.g. 150 for ₹150 off'}
                                      type="number"
                                      step="any"
                                      min="0"
                                      required
                                    />
                                </div>
                                <div className="col-span-2 flex justify-end gap-4 mt-2">
                                    <button 
                                      disabled={submittingCampaign}
                                      className="px-6 py-2.5 bg-primary text-white rounded-lg font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer" 
                                      style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)" }} 
                                      type="submit"
                                    >
                                        <span className="material-symbols-outlined">rocket_launch</span>
                                        {submittingCampaign ? "Launching..." : "Launch Offer"}
                                    </button>
                                </div>
                            </form>
                        </section>
 
                        {/* Active Offers Table */}
                        <section className="border rounded-xl overflow-hidden" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div className="p-6 border-b flex justify-between items-center" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                                <h3 className="text-xl font-semibold" style={{ color: "var(--color-admin-on-surface)" }}>Active Promotional Offers</h3>
                                <button onClick={() => fetchCampaigns()} className="text-xs font-semibold px-3 py-1 rounded border hover:opacity-85" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                                    Refresh List
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="border-b" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                                        <tr>
                                            <th className="px-6 py-4 text-sm font-medium uppercase tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Campaign</th>
                                            <th className="px-6 py-4 text-sm font-medium uppercase tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Code</th>
                                            <th className="px-6 py-4 text-sm font-medium uppercase tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Discount</th>
                                            <th className="px-6 py-4 text-sm font-medium uppercase tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Type / Target</th>
                                            <th className="px-6 py-4 text-sm font-medium uppercase tracking-wider text-right" style={{ color: "var(--color-admin-on-surface-variant)" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                        {loadingCampaigns ? (
                                          <tr>
                                            <td colSpan={5} className="text-center py-8 text-sm" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                              Loading offers...
                                            </td>
                                          </tr>
                                        ) : campaigns.map((camp) => (
                                          <tr key={camp.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                              <td className="px-6 py-4">
                                                  <div className="text-base font-semibold" style={{ color: "var(--color-admin-on-surface)" }}>{camp.title}</div>
                                                  <div className="text-xs text-slate-500 dark:text-slate-400">{camp.description || "No description"}</div>
                                                  <div className="text-[10px] font-bold mt-1" style={{ color: new Date(camp.expiresAt).getTime() <= Date.now() ? "var(--color-admin-error)" : "var(--color-admin-primary)" }}>
                                                      {new Date(camp.expiresAt).getTime() <= Date.now() ? "🔴 Expired on " : "🟢 Expires on "}
                                                      {new Date(camp.expiresAt).toLocaleDateString()}
                                                  </div>
                                              </td>
                                              <td className="px-6 py-4 text-xs font-mono font-bold" style={{ color: "var(--color-admin-primary)" }}>{camp.code}</td>
                                              <td className="px-6 py-4 text-sm font-bold animate-pulse-slow" style={{ color: "var(--color-admin-on-surface)" }}>
                                                  {camp.discountPercent ? `${camp.discountPercent}% OFF` : `₹${camp.discountAmount} OFF`}
                                              </td>
                                              <td className="px-6 py-4">
                                                  <span className="px-2 py-1 text-[10px] font-bold rounded uppercase tracking-tighter" style={camp.offerType === "GLOBAL" ? { backgroundColor: "rgba(74, 222, 128, 0.1)", color: "#4ade80" } : { backgroundColor: "rgba(99, 102, 241, 0.1)", color: "#6366f1" }}>
                                                      {camp.offerType}
                                                  </span>
                                                  {camp.offerType === "USER" && (
                                                      <div className="text-xs font-semibold mt-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>{camp.userEmail}</div>
                                                  )}
                                              </td>
                                              <td className="px-6 py-4 text-right">
                                                  <button 
                                                    onClick={() => handleDeleteOffer(camp.id)}
                                                    className="px-3 py-1 border rounded text-xs font-bold bg-rose-500/10 hover:bg-rose-500 hover:text-white border-rose-500 text-rose-500 transition-all cursor-pointer border-none" 
                                                  >
                                                      Delete
                                                  </button>
                                              </td>
                                          </tr>
                                        ))}
                                        {campaigns.length === 0 && !loadingCampaigns && (
                                          <tr>
                                            <td colSpan={5} className="text-center py-8 text-sm" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                              No promotional offers found. Create one above!
                                            </td>
                                          </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Live Support & Broadcast Announcements */}
                    <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
                        
                        {/* Messaging Interface (Interactive Layout) */}
                        <section className="border rounded-xl h-[530px] flex flex-col overflow-hidden" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined animate-pulse text-green-500">sensors</span>
                                    <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--color-admin-on-surface)" }}>Live Chat Dashboard</h3>
                                </div>
                                <div className="flex bg-black/10 dark:bg-white/5 rounded-lg p-0.5 text-[10px] font-bold">
                                    <button
                                        onClick={() => { setActiveChatTab('active'); setSelectedSession(null); setChatMessages([]); }}
                                        className={`px-3 py-1 rounded-md transition-all ${activeChatTab === 'active' ? 'bg-primary text-zinc-950 font-black' : 'opacity-60'}`}
                                    >
                                        Active ({chatSessions.length})
                                    </button>
                                    <button
                                        onClick={() => { setActiveChatTab('history'); setSelectedSession(null); setChatMessages([]); }}
                                        className={`px-3 py-1 rounded-md transition-all ${activeChatTab === 'history' ? 'bg-primary text-zinc-950 font-black' : 'opacity-60'}`}
                                    >
                                        History ({chatHistorySessions.length})
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex flex-1 overflow-hidden">
                                {/* Left Side: Channels List */}
                                <div className="w-1/3 border-r flex flex-col overflow-y-auto" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                    {activeChatTab === 'active' ? (
                                        chatSessions.length === 0 ? (
                                            <p className="text-[10px] italic text-center p-6" style={{ color: "var(--color-admin-on-surface-variant)" }}>No active sessions.</p>
                                        ) : (
                                            chatSessions.map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => setSelectedSession(s)}
                                                    className={`w-full text-left p-3 border-b transition-colors flex flex-col gap-1 ${selectedSession?.id === s.id ? "bg-black/5 dark:bg-white/5" : ""}`}
                                                    style={{ borderColor: "var(--color-admin-outline-variant)" }}
                                                >
                                                    <div className="flex justify-between items-center w-full">
                                                        <span className="text-xs font-bold truncate max-w-[80px]" style={{ color: "var(--color-admin-on-surface)" }}>{s.userName}</span>
                                                        <span className="text-[9px] px-1 rounded bg-green-500/20 text-green-400 font-bold shrink-0">Active</span>
                                                    </div>
                                                    <p className="text-[9px] truncate" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                                        {s.messages?.[0]?.content || "No messages yet"}
                                                    </p>
                                                    <span className="text-[8px] opacity-50 block mt-0.5" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                                        {s.location || "Unknown Location"}
                                                    </span>
                                                </button>
                                            ))
                                        )
                                    ) : (
                                        chatHistorySessions.length === 0 ? (
                                            <p className="text-[10px] italic text-center p-6" style={{ color: "var(--color-admin-on-surface-variant)" }}>No history log.</p>
                                        ) : (
                                            chatHistorySessions.map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => setSelectedSession(s)}
                                                    className={`w-full text-left p-3 border-b transition-colors flex flex-col gap-1 ${selectedSession?.id === s.id ? "bg-black/5 dark:bg-white/5" : ""}`}
                                                    style={{ borderColor: "var(--color-admin-outline-variant)" }}
                                                >
                                                    <div className="flex justify-between items-center w-full">
                                                        <span className="text-xs font-bold truncate max-w-[80px]" style={{ color: "var(--color-admin-on-surface)" }}>{s.userName}</span>
                                                        <span className="text-[9px] px-1 rounded bg-zinc-500/20 text-zinc-400 font-bold shrink-0 capitalize">{s.status}</span>
                                                    </div>
                                                    <span className="text-[8px] opacity-50 block" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                                        {new Date(s.updatedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </span>
                                                </button>
                                            ))
                                        )
                                    )}
                                </div>

                                {/* Right Side: Conversation Area */}
                                <div className="flex-1 flex flex-col overflow-hidden bg-black/5">
                                    {selectedSession ? (
                                        <>
                                            {/* Chat Info Header */}
                                            <div className="px-4 py-2 border-b flex justify-between items-center" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-black truncate" style={{ color: "var(--color-admin-on-surface)" }}>{selectedSession.userName}</p>
                                                    <p className="text-[9px] truncate" style={{ color: "var(--color-admin-on-surface-variant)", opacity: 0.8 }}>
                                                        {selectedSession.userEmail} • {selectedSession.location || "Unknown"}
                                                    </p>
                                                </div>
                                                {/* Chat Session Controllers */}
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {selectedSession.status === "open" ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleUpdateSessionStatus(selectedSession.id, "closed")}
                                                                className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/20"
                                                                title="Close Session"
                                                            >
                                                                Close
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateSessionStatus(selectedSession.id, "terminated")}
                                                                className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/20"
                                                                title="Terminate Session"
                                                            >
                                                                Terminate
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleDeleteChatSession(selectedSession.id)}
                                                            className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white hover:opacity-90 flex items-center gap-0.5"
                                                            title="Purge session from database"
                                                        >
                                                            <span className="material-symbols-outlined text-[10px]">delete_forever</span> Purge
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Messages Thread */}
                                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scroll">
                                                {chatMessages.map((m: any) => {
                                                    const isSystem = m.content.startsWith("[SYSTEM_NOTIFICATION]");
                                                    if (isSystem) {
                                                        const cleaned = m.content.replace("[SYSTEM_NOTIFICATION]", "").trim();
                                                        return (
                                                            <div key={m.id} className="text-center my-2">
                                                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-bold border border-zinc-700">
                                                                    {cleaned}
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                    const isAdmin = m.senderType === "admin";
                                                    return (
                                                        <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                                                            <div className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-xs ${isAdmin ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-100"}`}>
                                                                {m.attachmentUrl ? (
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-1 font-bold pb-0.5 mb-1 border-b border-white/10 text-[10px]">
                                                                            <span className="material-symbols-outlined text-xs">attachment</span>
                                                                            <span className="truncate max-w-[120px]">{m.attachmentName || "Attachment"}</span>
                                                                        </div>
                                                                        {m.attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
                                                                            <Image
                                                                                src={m.attachmentUrl}
                                                                                alt="Upload"
                                                                                width={0}
                                                                                height={0}
                                                                                sizes="100%"
                                                                                className="rounded max-h-32 object-cover cursor-pointer hover:opacity-90"
                                                                                unoptimized
                                                                                onClick={() => window.open(m.attachmentUrl, "_blank")}
                                                                            />
                                                                        ) : (
                                                                            <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="text-amber-300 underline font-bold flex items-center gap-0.5 text-[10px]">
                                                                                View File <span className="material-symbols-outlined text-[8px]">open_in_new</span>
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <p className="leading-relaxed break-words">{m.content}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div ref={chatEndRef} />
                                            </div>

                                            {/* Composer */}
                                            {selectedSession.status === "open" && (
                                                <form onSubmit={handleSendResponse} className="p-3 border-t flex gap-2 items-center" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                                                    <input
                                                        type="text"
                                                        value={responseMessage}
                                                        onChange={e => setResponseMessage(e.target.value)}
                                                        placeholder="Type a response..."
                                                        className="flex-1 border rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1"
                                                        style={{ backgroundColor: "var(--color-admin-background)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={sendingResponse || !responseMessage.trim()}
                                                        className="p-1.5 bg-primary text-zinc-950 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                                                    >
                                                        <span className="material-symbols-outlined text-sm block">send</span>
                                                    </button>
                                                </form>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center opacity-60">
                                            <span className="material-symbols-outlined text-3xl mb-2" style={{ color: "var(--color-admin-primary)" }}>chat_bubble_outline</span>
                                            <p className="text-xs font-bold">Select a user channel to start chatting</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Push Notification Composer */}
                        <section className="border p-6 rounded-xl" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div className="flex items-center gap-3 mb-6">
                                <span className="material-symbols-outlined" style={{ color: "var(--color-admin-tertiary)" }}>notification_add</span>
                                <h3 className="text-xl font-semibold" style={{ color: "var(--color-admin-on-surface)" }}>Global Announcements</h3>
                            </div>
                            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-admin-on-surface-variant)" }}>Notification Body</label>
                                    <input 
                                      value={announcementBody}
                                      onChange={(e) => setAnnouncementBody(e.target.value)}
                                      className="w-full border rounded-lg p-3 text-sm outline-none focus:ring-1" 
                                      style={{ backgroundColor: "var(--color-admin-background)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }} 
                                      placeholder="Maintenance scheduled for tonight at 2 AM PST." 
                                      type="text" 
                                      required
                                    />
                                </div>
                                <div className="flex items-center justify-end">
                                    <button 
                                      disabled={submittingAnnouncement}
                                      className="px-6 py-2 rounded-lg font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50" 
                                      style={{ backgroundColor: "var(--color-admin-tertiary-container)", color: "var(--color-admin-on-tertiary-container)" }}
                                      type="submit"
                                    >
                                        {submittingAnnouncement ? "Broadcasting..." : "Send Announcement"}
                                    </button>
                                </div>
                            </form>
                        </section>

                        {/* Active Announcements List */}
                        <section className="border p-6 rounded-xl" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold flex items-center gap-1.5" style={{ color: "var(--color-admin-on-surface)" }}>
                                    <span className="material-symbols-outlined" style={{ color: "var(--color-admin-primary)" }}>campaign</span>
                                    Active Broadcasts
                                </h3>
                                <button onClick={() => fetchAnnouncements()} className="text-[10px] font-semibold px-2 py-0.5 rounded border hover:opacity-85" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                                    Refresh
                                </button>
                            </div>
                            <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scroll mb-6">
                                {loadingAnnouncements ? (
                                    <p className="text-xs italic" style={{ color: "var(--color-admin-on-surface-variant)" }}>Loading...</p>
                                ) : announcements.filter(ann => ann.isActive && (Date.now() - new Date(ann.startsAt).getTime() < 24 * 60 * 60 * 1000)).length > 0 ? (
                                    announcements.filter(ann => ann.isActive && (Date.now() - new Date(ann.startsAt).getTime() < 24 * 60 * 60 * 1000)).map((ann) => (
                                        <div key={ann.id} className="p-3 border rounded-lg flex items-center justify-between text-xs transition-colors" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="font-semibold flex items-center gap-1.5" style={{ color: "var(--color-admin-on-surface)" }}>
                                                    <span className={`w-1.5 h-1.5 rounded-full bg-primary`} />
                                                    {ann.title}
                                                </div>
                                                <p className="mt-1 font-medium leading-relaxed" style={{ color: "var(--color-admin-on-surface-variant)" }}>{ann.content}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteAnnouncement(ann.id)}
                                                className="px-2.5 py-1 border border-rose-500 text-rose-500 bg-rose-500/10 hover:bg-rose-600 hover:text-white rounded font-bold transition-all cursor-pointer border-none shrink-0"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs italic" style={{ color: "var(--color-admin-on-surface-variant)" }}>No active global broadcasts (shown on user dashboard for 24h).</p>
                                )}
                            </div>

                            {/* Broadcast History / Archive */}
                            <div className="border-t pt-4" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3" style={{ color: "var(--color-admin-on-surface)" }}>
                                    <span className="material-symbols-outlined text-sm" style={{ color: "var(--color-admin-on-surface-variant)" }}>history</span>
                                    Broadcast History & Archive
                                </h4>
                                <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scroll">
                                    {loadingAnnouncements ? (
                                        <p className="text-xs italic" style={{ color: "var(--color-admin-on-surface-variant)" }}>Loading...</p>
                                    ) : announcements.filter(ann => !ann.isActive || (Date.now() - new Date(ann.startsAt).getTime() >= 24 * 60 * 60 * 1000)).length > 0 ? (
                                        announcements.filter(ann => !ann.isActive || (Date.now() - new Date(ann.startsAt).getTime() >= 24 * 60 * 60 * 1000)).map((ann) => {
                                            const ageMs = Date.now() - new Date(ann.startsAt).getTime();
                                            const isExpired = ageMs >= 24 * 60 * 60 * 1000;
                                            return (
                                                <div key={ann.id} className="p-3 border rounded-lg flex items-center justify-between text-xs opacity-75" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                                                    <div className="flex-1 min-w-0 pr-4">
                                                        <div className="font-semibold flex items-center gap-1.5" style={{ color: "var(--color-admin-on-surface)" }}>
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                            {ann.title}
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase bg-slate-200 text-slate-600 font-bold">
                                                                {!ann.isActive ? "Deleted" : isExpired ? "Expired (>24h)" : "Archived"}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 font-medium leading-relaxed text-slate-500" style={{ color: "var(--color-admin-on-surface-variant)" }}>{ann.content}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleDeleteAnnouncement(ann.id)}
                                                        className="px-2 py-1 text-slate-400 hover:text-rose-500 text-[10px] font-bold transition-all cursor-pointer border-none shrink-0"
                                                    >
                                                        Purge
                                                    </button>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-xs italic" style={{ color: "var(--color-admin-on-surface-variant)" }}>No archived or expired announcements.</p>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
