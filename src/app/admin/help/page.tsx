'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createPb } from '@/lib/pb';
import AdminSidebar from '@/components/AdminSidebar';
import { Theme, themes, getAccentColor } from "@/components/AdminThemeStyles";

const ALL_THEMES: Theme[] = ['indigo', 'emerald', 'rose', 'violet', 'amber', 'cyan', 'sky', 'pink', 'orange', 'lime', 'teal', 'fuchsia', 'red', 'yellow', 'stone', 'zinc'];

interface CustomerDetails {
  customerId: string;
  email: string;
  membership: string;
  points: number;
  status: string;
  projectCount: number;
}

interface Ticket {
  id: string;
  ticketId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  userName: string;
  userEmail: string;
  customerId?: string;
  reason?: string;
  ipAddress?: string;
  location?: string;
  country?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string | null;
  customerDetails?: CustomerDetails | null;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  views: number;
}

interface ServiceHealth {
  id: string;
  serviceKey: string;
  name: string;
  status: string;
  uptime: number;
  latencyMs: number;
  queueJobs: number;
  usagePercent: number;
}

interface Documentation {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt: string;
}

export default function AdminHelpPage() {
    const [currentTheme, setCurrentTheme] = useState<Theme>('indigo');
    const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [adminName, setAdminName] = useState<string>("Admin Root");

    // Dynamic state variables
    const [services, setServices] = useState<ServiceHealth[]>([]);
    const [overallStatus, setOverallStatus] = useState<string>("operational");
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [ticketMetrics, setTicketMetrics] = useState({ urgent: 0, totalOpen: 0, inProgress: 0, totalResolved: 0, archived: 0 });
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [docs, setDocs] = useState<Documentation[]>([]);
    const [engineConfig, setEngineConfig] = useState({
      engine: "TeX Live 2024",
      apiStatus: "CONNECTED",
      region: "US-East",
      activeNodes: 18,
      idleNodes: 2
    });
    const [lastSyncText, setLastSyncText] = useState<string>("Just now");

    // Modal state managers
    const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
    const [isFaqManagerOpen, setIsFaqManagerOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [editingService, setEditingService] = useState<ServiceHealth | null>(null);
    
    const [selectedDoc, setSelectedDoc] = useState<Documentation | null>(null);
    const [isDocManagerOpen, setIsDocManagerOpen] = useState(false);

    // Form inputs
    const [newTicket, setNewTicket] = useState({ subject: "", description: "", priority: "P4", userName: "", userEmail: "" });
    const [newFaq, setNewFaq] = useState({ question: "", answer: "", views: 0 });
    const [editingFaqId, setEditingFaqId] = useState<string | null>(null);

    const [newDoc, setNewDoc] = useState({ title: "", content: "", category: "General" });
    const [editingDocId, setEditingDocId] = useState<string | null>(null);
    
    const [ticketResolutionNote, setTicketResolutionNote] = useState("");
    const [ticketUpdating, setTicketUpdating] = useState(false);
    const [ticketListFilter, setTicketListFilter] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Ticket message thread
    const [selectedTicketMessages, setSelectedTicketMessages] = useState<any[]>([]);
    const [isTicketDetailOpen, setIsTicketDetailOpen] = useState(false);
    const [replyMessage, setReplyMessage] = useState("");
    const [sendingReply, setSendingReply] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Admin notifications
    const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
    const [adminUnreadCount, setAdminUnreadCount] = useState(0);
    const [showAdminNotifications, setShowAdminNotifications] = useState(false);

    // General queries states
    const [queries, setQueries] = useState<any[]>([]);
    const [queryStats, setQueryStats] = useState({ total: 0, replied: 0, pending: 0 });
    const [selectedQueryCard, setSelectedQueryCard] = useState<'total' | 'replied' | 'pending' | null>(null);
    const [selectedQuery, setSelectedQuery] = useState<any | null>(null);
    const [replyText, setReplyText] = useState('');
    const [submittingReply, setSubmittingReply] = useState(false);
    const [isEditQueryMode, setIsEditQueryMode] = useState(false);
    
    // For editing a query
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editMessage, setEditMessage] = useState('');

    const handleDeleteQuery = async (id: string) => {
      if (!confirm("Are you sure you want to delete this query?")) return;
      try {
        const res = await fetch('/api/admin/general-queries', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d.success) {
            showToast('success', 'Query deleted successfully');
            setSelectedQuery(null);
            fetchData();
          }
        }
      } catch (err) {
        showToast('error', 'Failed to delete query');
      }
    };

    const handleSendQueryReply = async () => {
      if (!selectedQuery || !replyText.trim()) return;
      setSubmittingReply(true);
      try {
        const res = await fetch('/api/admin/general-queries', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedQuery.id,
            reply: replyText.trim(),
            status: 'replied',
            isRead: true,
          }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d.success) {
            showToast('success', 'Reply saved successfully');
            setSelectedQuery(d.data);
            setReplyText('');
            fetchData();
          }
        }
      } catch (err) {
        showToast('error', 'Failed to save reply');
      } finally {
        setSubmittingReply(false);
      }
    };

    const handleToggleQueryRead = async (id: string, currentIsRead: boolean) => {
      try {
        const res = await fetch('/api/admin/general-queries', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, isRead: !currentIsRead }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d.success) {
            setSelectedQuery(d.data);
            fetchData();
          }
        }
      } catch (err) {
        console.error('Failed to toggle read state', err);
      }
    };

    const handleSaveQueryEdits = async () => {
      if (!selectedQuery) return;
      try {
        const res = await fetch('/api/admin/general-queries', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedQuery.id,
            name: editName,
            email: editEmail,
            phone: editPhone,
            message: editMessage
          }),
        });
        if (res.ok) {
          const d = await res.json();
          if (d.success) {
            showToast('success', 'Query updated successfully');
            setSelectedQuery(d.data);
            setIsEditQueryMode(false);
            fetchData();
          }
        }
      } catch (err) {
        showToast('error', 'Failed to update query');
      }
    };

    const filteredTickets = ticketListFilter === "all" ? tickets
      : ticketListFilter === "pending" ? tickets.filter((t: Ticket) => t.status === "open")
      : ticketListFilter === "in_progress" ? tickets.filter((t: Ticket) => t.status === "in_progress")
      : ticketListFilter === "resolved" ? tickets.filter((t: Ticket) => t.status === "resolved")
      : ticketListFilter === "archived" ? tickets.filter((t: Ticket) => t.archivedAt !== null)
      : [];

    // Fetch data individually so one failure doesn't block others
    const fetchData = async () => {
      try {
        const [healthRes, ticketsRes, faqsRes, docsRes, notifRes, queriesRes, qStatsRes] = await Promise.allSettled([
          fetch("/api/admin/help/health"),
          fetch("/api/admin/help/tickets"),
          fetch("/api/admin/help/faqs"),
          fetch("/api/admin/help/docs"),
          fetch("/api/admin/notifications?unreadOnly=true"),
          fetch("/api/admin/general-queries?type=all"),
          fetch("/api/admin/general-queries/stats")
        ]);

        if (healthRes.status === "fulfilled") {
          const healthData = await healthRes.value.json();
          if (healthData.success) {
            setServices(healthData.services);
            setOverallStatus(healthData.overallStatus);
            setEngineConfig(healthData.engineConfig);
          }
        }
        if (ticketsRes.status === "fulfilled") {
          const ticketsData = await ticketsRes.value.json();
          if (ticketsData.success) {
            setTickets(ticketsData.tickets);
            setTicketMetrics(ticketsData.metrics);
          }
        }
        if (faqsRes.status === "fulfilled") {
          const faqsData = await faqsRes.value.json();
          if (faqsData.success) setFaqs(faqsData.faqs);
        }
        if (docsRes.status === "fulfilled") {
          const docsData = await docsRes.value.json();
          if (docsData.success) setDocs(docsData.docs);
        }
        if (notifRes.status === "fulfilled") {
          const notifData = await notifRes.value.json();
          setAdminNotifications(notifData.notifications || []);
          setAdminUnreadCount(notifData.unreadCount || 0);
        }
        if (queriesRes.status === "fulfilled") {
          const queriesData = await queriesRes.value.json();
          if (queriesData.success) setQueries(queriesData.data || []);
        }
        if (qStatsRes.status === "fulfilled") {
          const qStatsData = await qStatsRes.value.json();
          if (qStatsData.success) setQueryStats(qStatsData.data || { total: 0, replied: 0, pending: 0 });
        }
        setLastSyncText("Just now");
      } catch (err) {
        console.error("Failed to load help page resources", err);
      }
    };

    useEffect(() => {
        const savedTheme = localStorage.getItem('latexify-admin-theme') as Theme | null;
        const savedMode = localStorage.getItem('latexify-admin-mode');

        if (savedTheme) setCurrentTheme(savedTheme);
        if (savedMode) setIsDarkMode(savedMode === 'dark');
        const storedName = localStorage.getItem('latexify-admin-name');
        if (storedName) setAdminName(storedName);

        fetchData();

        // Refresh dynamic components every 15 seconds for near-real-time health monitoring
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    // ── PB Realtime Subscriptions ──
    useEffect(() => {
      const pb = createPb();
      const unsubFns: (() => void)[] = [];
      const setup = async () => {
        for (const coll of ['support_tickets', 'service_health', 'user_faqs', 'admin_documentations', 'admin_notifications', 'general_queries']) {
          try {
            const unsub = await pb.collection(coll).subscribe('*', () => { fetchData(); });
            unsubFns.push(unsub);
          } catch {}
        }
      };
      setup();
      return () => { for (const fn of unsubFns) { try { fn(); } catch {} } };
    }, []);

    // Sync status string
    useEffect(() => {
      const syncInterval = setInterval(() => {
        setLastSyncText(prev => {
          if (prev === "Just now") return "10s ago";
          if (prev === "10s ago") return "20s ago";
          return "30s ago";
        });
      }, 10000);
      return () => clearInterval(syncInterval);
    }, []);

    useEffect(() => {
        localStorage.setItem('latexify-admin-theme', currentTheme);
        localStorage.setItem('latexify-admin-mode', isDarkMode ? 'dark' : 'light');
        window.dispatchEvent(new Event('admin-theme-changed'));
    }, [currentTheme, isDarkMode]);

    const showToast = (type: 'success' | 'error', text: string) => {
      setToastMessage({ type, text });
      setTimeout(() => setToastMessage(null), 3000);
    };

    const toggleTheme = () => {
        setIsThemeMenuOpen(!isThemeMenuOpen);
    };

    const handleThemeSelect = (theme: Theme) => {
        setCurrentTheme(theme);
        setIsThemeMenuOpen(false);
    };

    // Support Tickets handlers
    const loadTicketMessages = async (ticketId: string) => {
      setLoadingMessages(true);
      setSelectedTicketMessages([]);
      try {
        const res = await fetch(`/api/admin/help/tickets/messages?ticketId=${ticketId}`);
        const data = await res.json();
        if (data.success) setSelectedTicketMessages(data.messages);
      } catch {}
      setLoadingMessages(false);
    };

    const handleCreateTicketSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const res = await fetch("/api/admin/help/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newTicket)
        });
        const data = await res.json();
        if (data.success) {
          showToast("success", `Ticket ${data.ticket.ticketId} created successfully!`);
          setIsCreateTicketOpen(false);
          setNewTicket({ subject: "", description: "", priority: "P4", userName: "", userEmail: "" });
          fetchData();
        } else {
          showToast("error", data.error || "Failed to create ticket");
        }
      } catch (err: any) {
        showToast("error", err.message);
      }
    };

    const handleUpdateTicketStatus = async (id: string, status: string, priority: string, reasonNote?: string) => {
      setTicketUpdating(true);
      try {
        const note = reasonNote !== undefined ? reasonNote : ticketResolutionNote;
        const res = await fetch("/api/admin/help/tickets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status, priority, reason: note })
        });
        const data = await res.json();
        if (data.success) {
          showToast("success", "Ticket updated successfully.");
          setSelectedTicket(null);
          setTicketResolutionNote("");
          fetchData();
        } else {
          showToast("error", data.error || "Failed to update ticket");
        }
      } catch (err: any) {
        showToast("error", err.message);
      } finally {
        setTicketUpdating(false);
      }
    };

    const handleDeleteTicket = async (id: string) => {
      if (!confirm("Are you sure you want to delete this ticket?")) return;
      try {
        const res = await fetch(`/api/admin/help/tickets?id=${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          showToast("success", "Ticket removed from database.");
          setSelectedTicket(null);
          fetchData();
        } else {
          showToast("error", data.error || "Failed to delete ticket");
        }
      } catch (err: any) {
        showToast("error", err.message);
      }
    };

    // FAQs Handlers
    const handleSaveFaq = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const method = editingFaqId ? "PUT" : "POST";
        const body = editingFaqId ? { id: editingFaqId, ...newFaq } : newFaq;
        const res = await fetch("/api/admin/help/faqs", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
          showToast("success", editingFaqId ? "FAQ updated." : "FAQ created successfully.");
          setNewFaq({ question: "", answer: "", views: 0 });
          setEditingFaqId(null);
          fetchData();
        } else {
          showToast("error", data.error || "Failed to save FAQ");
        }
      } catch (err: any) {
        showToast("error", err.message);
      }
    };

    const handleDeleteFaq = async (id: string) => {
      if (!confirm("Delete this FAQ article?")) return;
      try {
        const res = await fetch(`/api/admin/help/faqs?id=${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          showToast("success", "FAQ deleted.");
          fetchData();
        } else {
          showToast("error", data.error || "Failed to delete FAQ");
        }
      } catch (err: any) {
        showToast("error", err.message);
      }
    };

    // Documentation Handlers
    const handleSaveDoc = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const method = editingDocId ? "PUT" : "POST";
        const body = editingDocId ? { id: editingDocId, ...newDoc } : newDoc;
        const res = await fetch("/api/admin/help/docs", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
          showToast("success", editingDocId ? "Document updated." : "Document created.");
          setNewDoc({ title: "", content: "", category: "General" });
          setEditingDocId(null);
          fetchData();
        } else {
          showToast("error", data.error || "Failed to save document");
        }
      } catch (err: any) {
        showToast("error", err.message);
      }
    };

    const handleDeleteDoc = async (id: string) => {
      if (!confirm("Delete this documentation page?")) return;
      try {
        const res = await fetch(`/api/admin/help/docs?id=${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          showToast("success", "Document deleted.");
          fetchData();
        } else {
          showToast("error", data.error || "Failed to delete document");
        }
      } catch (err: any) {
        showToast("error", err.message);
      }
    };

    // Admin Notification Handlers
    const markAllAdminRead = async () => {
      try {
        await fetch("/api/admin/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markAll: true }),
        });
        setAdminNotifications([]);
        setAdminUnreadCount(0);
      } catch {}
    };

    const markAdminRead = async (id: string) => {
      try {
        await fetch("/api/admin/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: id }),
        });
        setAdminNotifications(prev => prev.filter(n => n.id !== id));
        setAdminUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err: any) {
        console.error("Failed to dismiss notification:", err);
      }
    };

    // Service Status Handlers
    const handleUpdateServiceHealth = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingService) return;
      try {
        const res = await fetch("/api/admin/help/health", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingService)
        });
        const data = await res.json();
        if (data.success) {
          showToast("success", `${editingService.name} status updated.`);
          setEditingService(null);
          fetchData();
        } else {
          showToast("error", data.error || "Failed to update service health");
        }
      } catch (err: any) {
        showToast("error", err.message);
      }
    };

    return (
        <div className={`min-h-screen ${isDarkMode ? 'dark' : ''} transition-colors duration-500 font-body-md overflow-x-hidden`} style={{ backgroundColor: 'var(--color-admin-background)', color: 'var(--color-admin-on-background)' }}>
            
            {/* Toast Notification */}
            {toastMessage && (
              <div className="fixed top-20 right-6 z-[10000] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 border font-bold text-sm transition-all"
                   style={{ 
                     backgroundColor: toastMessage.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', 
                     borderColor: toastMessage.type === 'success' ? '#10b981' : '#ef4444',
                     color: toastMessage.type === 'success' ? '#10b981' : '#ef4444' 
                   }}>
                <span className="material-symbols-outlined">{toastMessage.type === 'success' ? 'check_circle' : 'error'}</span>
                {toastMessage.text}
              </div>
            )}

            <AdminSidebar isDarkMode={isDarkMode} adminName={adminName} />

            {/* Main Content Area */}
            <main className="ml-0 lg:ml-64 min-h-screen pb-16">
                {/* Header */}
                <header className="flex justify-between items-center w-full px-8 py-4 border-b z-40 sticky top-0 transition-colors duration-500" style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)" }}>
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-full max-w-3xl">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-admin-on-surface-variant)" }}>search</span>
                            <input className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-container focus:border-primary outline-none transition-all" style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }} placeholder="Search documentation or tickets..." type="text" />
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        {/* Theme Switcher Button */}
                        <div className="relative">
                            <button onClick={toggleTheme} aria-label="Change Theme" className="flex items-center gap-2 px-3 py-1.5 rounded-full border hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface-variant)" }}>
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--color-admin-primary)" }}></span>
                                <span className="text-xs font-medium">Theme</span>
                                <span className="material-symbols-outlined text-[18px]">expand_more</span>
                            </button>

                            {/* Theme Menu Dropdown */}
                            {isThemeMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 rounded-xl border shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                                    <div className="p-2 flex flex-col gap-1">
                                        <div className="px-3 py-2 text-xs font-semibold tracking-wider uppercase opacity-70" style={{ color: "var(--color-admin-on-surface-variant)" }}>Accent Color</div>
                                        {ALL_THEMES.map((t) => (
                                        <button key={t} onClick={() => handleThemeSelect(t)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: "var(--color-admin-on-surface)" }}>
                                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: getAccentColor(t, isDarkMode) }}></div> {t.charAt(0).toUpperCase() + t.slice(1)}
                                            {currentTheme === t && <span className="material-symbols-outlined ml-auto text-[18px]">check</span>}
                                        </button>
                                        ))}
                                        
                                        <div className="h-px w-full my-1" style={{ backgroundColor: "var(--color-admin-outline-variant)" }}></div>
                                        
                                        <div className="px-3 py-2 text-xs font-semibold tracking-wider uppercase opacity-70" style={{ color: "var(--color-admin-on-surface-variant)" }}>Mode</div>
                                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: "var(--color-admin-on-surface)" }}>
                                            <span className="material-symbols-outlined text-[18px]">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                                            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <button onClick={() => setShowAdminNotifications(!showAdminNotifications)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors active:opacity-80 scale-95 relative" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                <span className="material-symbols-outlined">notifications</span>
                                {adminUnreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black px-1">
                                        {adminUnreadCount > 99 ? "99+" : adminUnreadCount}
                                    </span>
                                )}
                            </button>
                            {showAdminNotifications && (
                                <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border shadow-2xl z-[110] animate-in fade-in zoom-in-95 duration-150" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                                    <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                        <span className="text-xs font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Notifications</span>
                                        {adminUnreadCount > 0 && (
                                            <button onClick={markAllAdminRead} className="text-[10px] font-bold hover:underline flex items-center gap-1" style={{ color: "var(--color-admin-primary)" }}>
                                                <span className="material-symbols-outlined text-xs">done_all</span> Mark all read
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-80 overflow-y-auto custom-scroll">
                                        {adminNotifications.length === 0 ? (
                                            <p className="p-6 text-xs text-center" style={{ color: "var(--color-admin-on-surface-variant)" }}>No notifications yet</p>
                                        ) : adminNotifications.map(n => (
                                            <div key={n.id} className={`px-4 py-3 border-b transition-colors relative group ${n.isRead ? "opacity-60" : ""}`} style={{ borderColor: "var(--color-admin-outline-variant)", backgroundColor: n.isRead ? "transparent" : "var(--color-admin-primary-container)" }}>
                                                <button 
                                                    onClick={() => markAdminRead(n.id)}
                                                    className="absolute right-3 top-3 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    title="Dismiss"
                                                >
                                                    <span className="material-symbols-outlined text-xs block" style={{ color: "var(--color-admin-on-surface-variant)" }}>close</span>
                                                </button>
                                                <div className="pr-6">
                                                    <p className="text-[11px] font-bold mb-0.5" style={{ color: "var(--color-admin-on-surface)" }}>{n.title}</p>
                                                    <p className="text-[10px] leading-relaxed" style={{ color: "var(--color-admin-on-surface-variant)" }}>{n.body}</p>
                                                    <p className="text-[9px] mt-1" style={{ color: "var(--color-admin-on-surface-variant)", opacity: 0.6 }}>
                                                        {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <Link href="/admin/profile" className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors active:opacity-80 scale-95" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                            <span className="material-symbols-outlined">settings</span>
                        </Link>
                        
                        <div className="h-8 w-px mx-2" style={{ backgroundColor: "var(--color-admin-outline-variant)" }}></div>
                        
                        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                            <div className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center overflow-hidden border-2 font-bold text-sm" style={{ borderColor: "var(--color-admin-primary)", color: "var(--color-admin-primary)" }}>
                                {adminName.split(/\s+/).map(n => n[0]).join("").slice(0,2).toUpperCase() || "AR"}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-8">
                    {/* Header Section */}
                    <div className="flex justify-between items-end mb-12">
                        <div>
                            <h2 className="text-4xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Help &amp; Support Center</h2>
                            <p className="text-lg max-w-2xl mt-2" style={{ color: "var(--color-admin-on-surface-variant)" }}>Monitor service health, manage technical documentation, and resolve priority support tickets for the Latexify ecosystem.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
                                <span className={`w-2 h-2 rounded-full animate-pulse ${overallStatus === 'operational' ? 'bg-green-500' : 'bg-rose-500'}`}></span>
                                <span className="text-sm font-medium" style={{ color: "var(--color-admin-on-surface)" }}>
                                  {overallStatus === 'operational' ? 'System Operational' : 'Degraded Performance'}
                                </span>
                            </div>
                            <button onClick={() => setIsCreateTicketOpen(true)} className="px-6 py-2 rounded-lg font-bold hover:opacity-90 transition-all flex items-center gap-2" style={{ backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary-fixed)" }}>
                                <span className="material-symbols-outlined">add</span> Create New Ticket
                            </button>
                        </div>
                    </div>

                    {/* General Queries Stats Row */}
                    <div className="mb-10">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-[20px]" style={{ color: "var(--color-admin-primary)" }}>question_answer</span>
                        <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--color-admin-on-surface)" }}>
                          General Queries &amp; Contact Enquiries
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Total Queries Received */}
                        <div onClick={() => setSelectedQueryCard("total")} className="rounded-2xl p-6 border flex items-center justify-between cursor-pointer hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Total Queries Received</span>
                            <h3 className="text-3xl font-black mt-2" style={{ color: "var(--color-admin-on-surface)" }}>
                              {queryStats.total}
                            </h3>
                          </div>
                          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                            <span className="material-symbols-outlined text-[26px]">question_answer</span>
                          </div>
                        </div>

                        {/* Total Replied Queries */}
                        <div onClick={() => setSelectedQueryCard("replied")} className="rounded-2xl p-6 border flex items-center justify-between cursor-pointer hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Replied Queries</span>
                            <h3 className="text-3xl font-black mt-2" style={{ color: "var(--color-admin-primary)" }}>
                              {queryStats.replied}
                            </h3>
                          </div>
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                            <span className="material-symbols-outlined text-[26px]">check_circle</span>
                          </div>
                        </div>

                        {/* Total Pending Queries */}
                        <div onClick={() => setSelectedQueryCard("pending")} className="rounded-2xl p-6 border flex items-center justify-between cursor-pointer hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Pending Queries</span>
                            <h3 className="text-3xl font-black mt-2" style={{ color: "var(--color-admin-error)" }}>
                              {queryStats.pending}
                            </h3>
                          </div>
                          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                            <span className="material-symbols-outlined text-[26px]">pending_actions</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-4 border-t pt-8" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                      <span className="material-symbols-outlined text-[20px]" style={{ color: "var(--color-admin-primary)" }}>support</span>
                      <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--color-admin-on-surface)" }}>
                        User Support Tickets
                      </h3>
                    </div>

                    {/* Ticket Quick Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                      {/* Total Tickets */}
                      <div onClick={() => setTicketListFilter("all")} className="rounded-2xl p-6 border flex items-center justify-between cursor-pointer hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Total Support Tickets</span>
                          <h3 className="text-3xl font-black mt-2" style={{ color: "var(--color-admin-on-surface)" }}>
                            {tickets.length}
                          </h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                          <span className="material-symbols-outlined text-[26px]">support</span>
                        </div>
                      </div>

                      {/* Pending Tickets */}
                      <div onClick={() => setTicketListFilter("pending")} className="rounded-2xl p-6 border flex items-center justify-between cursor-pointer hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Tickets Pending</span>
                          <h3 className="text-3xl font-black mt-2" style={{ color: "var(--color-admin-error)" }}>
                            {ticketMetrics.totalOpen}
                          </h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                          <span className="material-symbols-outlined text-[26px]">pending_actions</span>
                        </div>
                      </div>

                      {/* In Progress Tickets */}
                      <div onClick={() => setTicketListFilter("in_progress")} className="rounded-2xl p-6 border flex items-center justify-between cursor-pointer hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider opacity-60">In Progress</span>
                          <h3 className="text-3xl font-black mt-2" style={{ color: "var(--color-admin-tertiary)" }}>
                            {ticketMetrics.inProgress}
                          </h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                          <span className="material-symbols-outlined text-[26px]">autorenew</span>
                        </div>
                      </div>

                      {/* Resolved Tickets */}
                      <div onClick={() => setTicketListFilter("resolved")} className="rounded-2xl p-6 border flex items-center justify-between cursor-pointer hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Tickets Resolved</span>
                          <h3 className="text-3xl font-black mt-2" style={{ color: "var(--color-admin-primary)" }}>
                            {ticketMetrics.totalResolved}
                          </h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                          <span className="material-symbols-outlined text-[26px]">check_circle</span>
                        </div>
                      </div>

                      {/* Archived Tickets */}
                      <div onClick={() => setTicketListFilter("archived")} className="rounded-2xl p-6 border flex items-center justify-between cursor-pointer hover:scale-[1.02] active:scale-95 transition-all" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Archived (30d+)</span>
                          <h3 className="text-3xl font-black mt-2" style={{ color: "var(--color-admin-outline)" }}>
                            {ticketMetrics.archived}
                          </h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-400 border border-slate-500/20">
                          <span className="material-symbols-outlined text-[26px]">archive</span>
                        </div>
                      </div>
                    </div>

                    {/* Bento Grid Layout */}
                    <div className="grid grid-cols-12 gap-6">
                        {/* 1. Live Status & Service Health */}
                        <div className="col-span-8 rounded-xl p-6 border" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-semibold flex items-center gap-2" style={{ color: "var(--color-admin-on-surface)" }}>
                                    Core Services Health
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "var(--color-admin-primary)" }}></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: "var(--color-admin-primary)" }}></span>
                                    </span>
                                </h3>
                                <span className="text-xs font-medium tracking-wider flex items-center gap-1.5" style={{ color: "var(--color-admin-primary)" }}>
                                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "var(--color-admin-primary)" }}></span>
                                    LIVE MONITORING
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                                {services.map(s => {
                                  let iconName = "edit_note";
                                  let iconColorClass = "var(--color-admin-primary)";
                                  let detailText = `Uptime: ${s.uptime}%`;
                                  
                                  if (s.serviceKey === "doc2latex") {
                                    iconName = "transform";
                                    iconColorClass = "var(--color-admin-secondary)";
                                    detailText = `Latency: ${s.latencyMs}ms`;
                                  } else if (s.serviceKey === "template_migrator") {
                                    iconName = "move_down";
                                    iconColorClass = "var(--color-admin-tertiary)";
                                    detailText = `Queue: ${s.queueJobs} jobs`;
                                  } else if (s.serviceKey === "ai_diagram") {
                                    iconName = "hub";
                                    iconColorClass = "var(--color-admin-primary)";
                                    detailText = `Usage: ${s.usagePercent}% Peak`;
                                  } else if (s.serviceKey === "ai_reviewer") {
                                    iconName = "psychology";
                                    iconColorClass = "var(--color-admin-secondary)";
                                    detailText = `Uptime: ${s.uptime}%`;
                                  } else if (s.serviceKey === "citation_studio") {
                                    iconName = "format_quote";
                                    iconColorClass = "var(--color-admin-tertiary)";
                                    detailText = `Uptime: ${s.uptime}%`;
                                  }

                                  const statusColors: Record<string, string> = {
                                    stable: "text-green-400 dark:text-green-300",
                                    normal: "text-blue-400 dark:text-blue-300",
                                    high_load: "text-amber-400 dark:text-amber-300",
                                    degraded: "text-rose-400 dark:text-rose-300",
                                    down: "text-red-500 font-bold"
                                  };

                                  const statusBarColors: Record<string, string> = {
                                    stable: s.status === 'down' ? 'bg-red-500' : 'bg-green-500',
                                    normal: s.status === 'down' ? 'bg-red-500' : 'bg-green-500',
                                    high_load: s.status === 'down' ? 'bg-red-500' : s.status === 'degraded' ? 'bg-rose-400' : 'bg-amber-400',
                                    degraded: s.status === 'down' ? 'bg-red-500' : 'bg-rose-400',
                                    down: 'bg-red-500',
                                  };

                                  const barColor = statusBarColors[s.status] || 'bg-green-500';

                                  return (
                                    <div 
                                      key={s.id} 
                                      onClick={() => setEditingService({ ...s })}
                                      className="border p-4 rounded-lg flex items-center justify-between cursor-pointer hover:border-admin-primary hover:scale-[1.01] transition-all" 
                                      style={{ backgroundColor: "var(--color-admin-background)", borderColor: "var(--color-admin-outline-variant)" }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded" style={{ backgroundColor: "rgba(195, 192, 255, 0.15)", color: iconColorClass }}>
                                                <span className="material-symbols-outlined">{iconName}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold" style={{ color: "var(--color-admin-on-surface)" }}>{s.name}</p>
                                                <p className="text-xs mt-0.5" style={{ color: "var(--color-admin-on-surface-variant)" }}>{detailText}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-xs capitalize font-bold transition-colors duration-700 ${statusColors[s.status] || 'text-slate-400'}`}>{s.status.replace("_", " ")}</p>
                                            <div className="flex gap-0.5 mt-1 justify-end">
                                                <div className={`w-1.5 h-4 rounded-full transition-all duration-700 ${s.status === 'down' ? 'bg-red-500' : 'bg-green-500/40'}`}></div>
                                                <div className={`w-1.5 h-4 rounded-full transition-all duration-700 ${barColor}`}></div>
                                                <div className={`w-1.5 h-4 rounded-full transition-all duration-700 ${barColor}`}></div>
                                                <div className={`w-1.5 h-4 rounded-full transition-all duration-700 ${barColor}`}></div>
                                            </div>
                                        </div>
                                    </div>
                                  );
                                })}
                            </div>
                            
                            {/* Statistics Graph Placeholder */}
                            <div className="mt-6 border rounded-lg p-6 h-48 relative overflow-hidden flex flex-col justify-end" style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)" }}>
                                <div className="absolute inset-0 opacity-10">
                                    <Image className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAH0d3kyrKKkJ5Cru2-gZMMG_p8Cpk0pqQIER0cJr6oiMo0FHyQ_6YL1VcW5hOJxzgklnwmVQEKA8jKSrU-OZ-zhFzXPeO91y7HXykDo57kBg4CnW2p3Mshc_Q7hWlfYdXqbp9DR4pjItoDined-HhcW3Cfo60uUUqCcs_a03oJBEcwJLoJgzuE-TCtd7jUA18pUj4MpFC0TKF02_4tpQbA0AEC9tZHCCMNXLrYidFSUv5F0Ebx47MSZfBmHULbIuXTyNGIfcM1G8A" alt="Dashboard Chart Background" width={0} height={0} sizes="100%" unoptimized />
                                </div>
                                <div className="relative z-10 flex justify-between items-end h-32 gap-2">
                                    <div className="flex-1 rounded-t opacity-40 border-t" style={{ backgroundColor: "var(--color-admin-primary)", borderColor: "var(--color-admin-primary)", height: "40%" }}></div>
                                    <div className="flex-1 rounded-t opacity-40 border-t" style={{ backgroundColor: "var(--color-admin-primary)", borderColor: "var(--color-admin-primary)", height: "60%" }}></div>
                                    <div className="flex-1 rounded-t opacity-40 border-t" style={{ backgroundColor: "var(--color-admin-primary)", borderColor: "var(--color-admin-primary)", height: "55%" }}></div>
                                    <div className="flex-1 rounded-t opacity-40 border-t" style={{ backgroundColor: "var(--color-admin-primary)", borderColor: "var(--color-admin-primary)", height: "85%" }}></div>
                                    <div className="flex-1 rounded-t opacity-40 border-t" style={{ backgroundColor: "var(--color-admin-primary)", borderColor: "var(--color-admin-primary)", height: "70%" }}></div>
                                </div>
                                <div className="flex justify-between mt-2 text-xs font-mono" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                    <span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>00:00</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Support Ticket Queue */}
                        <div className="col-span-4 rounded-xl p-6 flex flex-col border h-[520px]" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                            <div className="flex justify-between items-center mb-4 shrink-0">
                                <h3 className="text-xl font-semibold" style={{ color: "var(--color-admin-on-surface)" }}>Ticket Queue</h3>
                                {ticketMetrics.urgent > 0 && (
                                  <span className="px-2 py-0.5 text-xs font-black rounded" style={{ backgroundColor: "var(--color-admin-error-container)", color: "var(--color-admin-on-error-container)" }}>
                                    {ticketMetrics.urgent} URGENT
                                  </span>
                                )}
                            </div>
                            <div className="space-y-4 overflow-y-auto custom-scroll flex-1 pr-1">
                                {tickets.map(t => {
                                  let priorityColor = "var(--color-admin-primary)";
                                  if (t.priority === "P1") priorityColor = "var(--color-admin-error)";
                                  else if (t.priority === "P2") priorityColor = "var(--color-admin-tertiary)";
                                  else if (t.priority === "P3") priorityColor = "var(--color-admin-primary)";
                                  else priorityColor = "var(--color-admin-outline)";

                                  const isResolved = t.status === "resolved";

                                  return (
                                    <div 
                                      key={t.id} 
                                      onClick={() => { setSelectedTicket(t); setTicketResolutionNote(t.reason || ""); loadTicketMessages(t.id); }}
                                      className={`p-3 rounded shadow-sm hover:opacity-90 transition-opacity cursor-pointer border-l-4 ${isResolved ? 'opacity-50 line-through' : ''}`} 
                                      style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: priorityColor }}
                                    >
                                        <div className="flex justify-between mb-1">
                                            <span className="text-xs font-mono font-bold" style={{ color: priorityColor }}>{t.ticketId}</span>
                                            <span className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                              {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold truncate" style={{ color: "var(--color-admin-on-surface)" }}>{t.subject}</p>
                                        <div className="flex justify-between mt-2">
                                            <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                                <span className="material-symbols-outlined text-sm">person</span> {t.userName}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded font-black uppercase" style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", color: priorityColor }}>
                                              {t.priority} Priority
                                            </span>
                                        </div>
                                    </div>
                                  );
                                })}
                                {tickets.length === 0 && (
                                  <div className="text-center py-8 text-xs opacity-50">No tickets found in database.</div>
                                )}
                            </div>
                            <button onClick={() => showToast("success", "Showing all ticket search records.")} className="w-full py-3 mt-4 border rounded-lg transition-all font-bold text-xs shrink-0 hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface-variant)" }}>
                                View All Tickets ({tickets.length})
                            </button>
                        </div>

                        {/* 3. Service Studios & Knowledge Base */}
                        <div className="col-span-12 grid grid-cols-3 gap-6">
                            {/* Service Studio Cards — row 1 */}
                            {(() => {
                              const svcDefs = [
                                { serviceKey: 'latex_editor', icon: 'edit_note', label: 'LaTeX Studio', desc: 'Real-time collaborative LaTeX editing with syntax highlighting, compilation, and version history.' },
                                { serviceKey: 'ai_reviewer', icon: 'psychology', label: 'AI Peer Reviewer', desc: 'Automated manuscript scoring with detailed rubric analysis, similarity check, and revision suggestions.' },
                                { serviceKey: 'ai_diagram', icon: 'hub', label: 'AI Diagram Studio', desc: 'Generate UML, flowcharts, ER diagrams and figures from natural language descriptions.' },
                              ];
                              return svcDefs.map(def => {
                                const svc = services.find(s => s.serviceKey === def.serviceKey);
                                const statusStr = svc?.status || 'stable';
                                const statusColor: Record<string, string> = { stable: '#10b981', normal: '#3b82f6', high_load: '#f59e0b', degraded: '#f43f5e', down: '#ef4444' };
                                const statusLabel: Record<string, string> = { stable: 'Operational', normal: 'Normal', high_load: 'High Load', degraded: 'Degraded', down: 'Down' };
                                const metricText = def.serviceKey === 'latex_editor' ? `Uptime: ${svc?.uptime ?? 99.9}%`
                                  : def.serviceKey === 'ai_reviewer' ? `Latency: ${svc?.latencyMs ?? 120}ms`
                                  : def.serviceKey === 'ai_diagram' ? `Usage: ${svc?.usagePercent ?? 0}% Peak` : '';
                                return (
                                  <div key={def.serviceKey} className="rounded-xl p-6 relative overflow-hidden border transition-all hover:scale-[1.01]" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                                    <div className="relative z-10">
                                      <div className="flex items-center gap-3 mb-3">
                                        <span className="material-symbols-outlined" style={{ color: "var(--color-admin-primary)" }}>{def.icon}</span>
                                        <h4 className="text-lg font-semibold" style={{ color: "var(--color-admin-on-surface)" }}>{def.label}</h4>
                                      </div>
                                      <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--color-admin-on-surface-variant)" }}>{def.desc}</p>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1.5 font-medium" style={{ color: statusColor[statusStr] || '#94a3b8' }}>
                                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor[statusStr] || '#94a3b8' }}></span>
                                          {statusLabel[statusStr] || statusStr}
                                        </span>
                                        <span style={{ color: "var(--color-admin-on-surface-variant)" }}>{metricText}</span>
                                      </div>
                                    </div>
                                    <div className="absolute -right-8 -bottom-8 opacity-5 scale-150" style={{ color: "var(--color-admin-primary)" }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: "160px" }}>{def.icon}</span>
                                    </div>
                                  </div>
                                );
                              });
                            })()}

                            {/* Service Studio Cards — row 2 */}
                            {(() => {
                              const svcDefs = [
                                { serviceKey: 'doc2latex', icon: 'transform', label: 'Doc2LaTeX Studio', desc: 'Convert Word documents to clean LaTeX source with full table, math, and formatting preservation.' },
                                { serviceKey: 'citation_studio', icon: 'format_quote', label: 'Citation Studio', desc: 'Manage BibTeX integration, reference formatting engine logs, and citation style libraries.' },
                                { serviceKey: 'template_migrator', icon: 'move_down', label: 'Template Migrator', desc: 'Migrate templates between projects, convert between document classes, and bulk-apply styles.' },
                              ];
                              return svcDefs.map(def => {
                                const svc = services.find(s => s.serviceKey === def.serviceKey);
                                const statusStr = svc?.status || 'stable';
                                const statusColor: Record<string, string> = { stable: '#10b981', normal: '#3b82f6', high_load: '#f59e0b', degraded: '#f43f5e', down: '#ef4444' };
                                const statusLabel: Record<string, string> = { stable: 'Operational', normal: 'Normal', high_load: 'High Load', degraded: 'Degraded', down: 'Down' };
                                const metricText = def.serviceKey === 'doc2latex' ? `Latency: ${svc?.latencyMs ?? 140}ms`
                                  : def.serviceKey === 'citation_studio' ? `Uptime: ${svc?.uptime ?? 99.9}%`
                                  : def.serviceKey === 'template_migrator' ? `Queue: ${svc?.queueJobs ?? 0} jobs` : '';
                                return (
                                  <div key={def.serviceKey} className="rounded-xl p-6 relative overflow-hidden border transition-all hover:scale-[1.01]" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                                    <div className="relative z-10">
                                      <div className="flex items-center gap-3 mb-3">
                                        <span className="material-symbols-outlined" style={{ color: "var(--color-admin-secondary)" }}>{def.icon}</span>
                                        <h4 className="text-lg font-semibold" style={{ color: "var(--color-admin-on-surface)" }}>{def.label}</h4>
                                      </div>
                                      <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--color-admin-on-surface-variant)" }}>{def.desc}</p>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-1.5 font-medium" style={{ color: statusColor[statusStr] || '#94a3b8' }}>
                                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor[statusStr] || '#94a3b8' }}></span>
                                          {statusLabel[statusStr] || statusStr}
                                        </span>
                                        <span style={{ color: "var(--color-admin-on-surface-variant)" }}>{metricText}</span>
                                      </div>
                                    </div>
                                    <div className="absolute -right-8 -bottom-8 opacity-5 scale-150" style={{ color: "var(--color-admin-secondary)" }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: "160px" }}>{def.icon}</span>
                                    </div>
                                  </div>
                                );
                              });
                            })()}

                            {/* Admin Documentation */}
                            <div className="rounded-xl p-6 border flex flex-col justify-between" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                                <div>
                                  <h4 className="text-xl font-semibold mb-4" style={{ color: "var(--color-admin-on-surface)" }}>Admin Documentation</h4>
                                  <ul className="space-y-2 mb-6">
                                      {docs.map(doc => (
                                        <li 
                                          key={doc.id} 
                                          onClick={() => setSelectedDoc(doc)}
                                          className="flex items-center gap-2 text-sm transition-colors cursor-pointer hover:text-admin-primary hover:opacity-100" 
                                          style={{ color: "var(--color-admin-on-surface-variant)" }}
                                        >
                                            <span className="material-symbols-outlined text-sm">article</span> {doc.title}
                                        </li>
                                      ))}
                                      {docs.length === 0 && (
                                        <li className="text-xs opacity-50 py-2">No documents published.</li>
                                      )}
                                  </ul>
                                </div>
                                <button onClick={() => setIsDocManagerOpen(true)} className="w-full py-2 rounded-lg text-sm font-bold border hover:opacity-90 transition-colors" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                                    Manage Content
                                </button>
                            </div>

                            {/* FAQ Management */}
                            <div className="rounded-xl p-6 flex flex-col justify-between border" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                                <div>
                                    <h4 className="text-xl font-semibold mb-4" style={{ color: "var(--color-admin-on-surface)" }}>User FAQ Matrix</h4>
                                    {faqs.length > 0 ? (
                                      <div className="p-3 rounded border mb-4" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                                          <div className="flex justify-between items-center text-xs font-mono mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                              <span>MOST SEARCHED</span>
                                              <span>{faqs[0].views} views</span>
                                          </div>
                                          <p className="text-sm font-bold" style={{ color: "var(--color-admin-on-surface)" }}>"{faqs[0].question}"</p>
                                      </div>
                                    ) : (
                                      <div className="p-3 rounded border mb-4 text-center text-xs opacity-50" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                                        No FAQs seeded yet.
                                      </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsFaqManagerOpen(true)} className="flex-1 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-all" style={{ backgroundColor: "var(--color-admin-secondary-container)", color: "var(--color-admin-on-secondary-container)" }}>Edit FAQs</button>
                                    <button onClick={() => showToast("success", `FAQ list counts loaded.`)} className="p-2 border rounded-lg hover:opacity-80 transition-all" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                        <span className="material-symbols-outlined" style={{ color: "var(--color-admin-on-surface-variant)" }}>analytics</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Live Indicators Footer */}
                    <div className="mt-12 pt-6 border-t flex justify-between items-center" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                        <div className="flex gap-6">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono" style={{ color: "var(--color-admin-on-surface-variant)" }}>ENGINE:</span>
                                <span className="flex items-center gap-1 text-xs font-mono text-green-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> RUNNING ({engineConfig.engine})
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono" style={{ color: "var(--color-admin-on-surface-variant)" }}>API:</span>
                                <span className="flex items-center gap-1 text-xs font-mono text-green-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> {engineConfig.apiStatus} (Region: {engineConfig.region})
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono" style={{ color: "var(--color-admin-on-surface-variant)" }}>WORKER NODES:</span>
                                <span className="flex items-center gap-1 text-xs font-mono" style={{ color: "var(--color-admin-primary)" }}>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-admin-primary)" }}></span> {engineConfig.activeNodes} ACTIVE / {engineConfig.idleNodes} IDLE
                                </span>
                            </div>
                        </div>
                        <div className="text-xs font-mono italic" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                            Last sync: {lastSyncText}
                        </div>
                    </div>
                </div>
            </main>

            {/* Create Support Ticket Modal */}
            {isCreateTicketOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateTicketOpen(false)}>
                <div className="border p-8 rounded-2xl max-w-2xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
                     style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-primary)" }}
                     onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                      <span className="material-symbols-outlined">add_circle</span> Create New Support Ticket
                    </h3>
                    <button onClick={() => setIsCreateTicketOpen(false)} className="material-symbols-outlined opacity-75 hover:opacity-100 transition-opacity">close</button>
                  </div>
                  <form onSubmit={handleCreateTicketSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold mb-2 opacity-80">Subject / Issue Title *</label>
                      <input 
                        type="text" required placeholder="e.g. pdflatex worker connection lost"
                        value={newTicket.subject} onChange={e => setNewTicket({...newTicket, subject: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                        style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 opacity-80">Details / Description *</label>
                      <textarea 
                        rows={4} required placeholder="Provide error logs or stack details..."
                        value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                        style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-2 opacity-80">User Name *</label>
                        <input 
                          type="text" required placeholder="e.g. Prof. Aris"
                          value={newTicket.userName} onChange={e => setNewTicket({...newTicket, userName: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                          style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-2 opacity-80">User Email *</label>
                        <input 
                          type="email" required placeholder="aris@university.edu"
                          value={newTicket.userEmail} onChange={e => setNewTicket({...newTicket, userEmail: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                          style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 opacity-80">Priority Level</label>
                      <select 
                        value={newTicket.priority} onChange={e => setNewTicket({...newTicket, priority: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                        style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                      >
                        <option value="P1">P1 Priority (Urgent)</option>
                        <option value="P2">P2 Priority (High)</option>
                        <option value="P3">P3 Priority (Medium)</option>
                        <option value="P4">P4 Priority (Low)</option>
                      </select>
                    </div>
                    <div className="flex gap-4 pt-2">
                      <button type="submit" className="px-6 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary-fixed)" }}>Submit Ticket</button>
                      <button type="button" onClick={() => setIsCreateTicketOpen(false)} className="px-6 py-3 rounded-xl font-bold text-sm border" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Ticket List Filter Modal */}
            {ticketListFilter && !selectedTicket && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setTicketListFilter(null)}>
                <div className="border p-6 rounded-2xl max-w-3xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
                     style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-primary)" }}
                     onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                      <span className="material-symbols-outlined">
                        {ticketListFilter === "resolved" ? "check_circle" : ticketListFilter === "in_progress" ? "autorenew" : ticketListFilter === "archived" ? "archive" : ticketListFilter === "pending" ? "pending_actions" : "support"}
                      </span>
                      {ticketListFilter === "all" ? "All Support Tickets" : ticketListFilter === "in_progress" ? "In Progress Tickets" : ticketListFilter === "archived" ? "Archived Tickets" : ticketListFilter === "pending" ? "Pending Tickets" : "Resolved Tickets"}
                      <span className="text-sm font-mono ml-2 opacity-60">({filteredTickets.length})</span>
                    </h3>
                    <button onClick={() => setTicketListFilter(null)} className="material-symbols-outlined opacity-75 hover:opacity-100 transition-opacity">close</button>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scroll">
                    {filteredTickets.length === 0 ? (
                      <div className="text-center py-12 text-xs opacity-50" style={{ color: "var(--color-admin-on-surface-variant)" }}>No tickets found.</div>
                    ) : filteredTickets.map((t: Ticket) => {
                      const pColor = t.priority === "P1" ? "var(--color-admin-error)" : t.priority === "P2" ? "var(--color-admin-tertiary)" : t.priority === "P3" ? "var(--color-admin-primary)" : "var(--color-admin-outline)";
                      return (
                         <div key={t.id} onClick={() => { setSelectedTicket(t); setTicketResolutionNote(t.reason || ""); setTicketListFilter(null); loadTicketMessages(t.id); }}
                          className="flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-95"
                          style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                          <div className="w-1.5 h-12 rounded-full shrink-0" style={{ backgroundColor: pColor }}></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono font-bold" style={{ color: pColor }}>{t.ticketId}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ backgroundColor: "var(--color-admin-surface-container-high)", color: pColor }}>{t.priority}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${t.status === "resolved" ? "text-green-400" : t.status === "in_progress" ? "text-amber-400" : "text-slate-400"}`} style={{ backgroundColor: "var(--color-admin-surface-container-high)" }}>{t.status}</span>
                              {t.archivedAt && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase text-slate-500 bg-slate-500/10 border border-slate-500/20">archived</span>}
                            </div>
                            <p className="text-sm font-bold truncate" style={{ color: "var(--color-admin-on-surface)" }}>{t.subject}</p>
                            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                              <span className="material-symbols-outlined text-xs">person</span> {t.userName} &middot; {new Date(t.createdAt).toLocaleString('en-IN')}
                            </p>
                          </div>
                          <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Ticket Detail Resolver Modal (Pop Window) */}
            {selectedTicket && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedTicket(null)}>
                <div className="border p-8 rounded-2xl max-w-2xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
                     style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-primary)" }}
                     onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                      <span className="material-symbols-outlined">support</span> Support Ticket Details ({selectedTicket.ticketId})
                    </h3>
                    <button onClick={() => setSelectedTicket(null)} className="material-symbols-outlined opacity-75 hover:opacity-100 transition-opacity">close</button>
                  </div>
                  <div className="space-y-6">
                    {/* Date and Time */}
                    <div className="flex justify-between text-xs border-b pb-3" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                      <div>
                        <span className="opacity-60 font-bold uppercase tracking-wider">Date &amp; Time Raised:</span>
                        <p className="font-mono mt-1 font-bold">{new Date(selectedTicket.createdAt).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="text-right">
                        <span className="opacity-60 font-bold uppercase tracking-wider">Current Status:</span>
                        <p className="capitalize mt-1 font-black text-amber-400">{selectedTicket.status}</p>
                      </div>
                    </div>

                    {/* Location & Device Info */}
                    {(selectedTicket.location || selectedTicket.ipAddress) && (
                      <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                        <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Location &amp; Device</span>
                        <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                          {selectedTicket.location && (
                            <div>
                              <span className="opacity-70">Location:</span>
                              <p className="font-bold mt-0.5">{selectedTicket.location}
                                {selectedTicket.country && <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-black" style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)" }}>{selectedTicket.country}</span>}
                              </p>
                            </div>
                          )}
                          {selectedTicket.ipAddress && (
                            <div>
                              <span className="opacity-70">IP Address:</span>
                              <p className="font-mono font-bold mt-0.5">{selectedTicket.ipAddress}</p>
                            </div>
                          )}
                          {selectedTicket.userAgent && (
                            <div className="col-span-2">
                              <span className="opacity-70">User Agent:</span>
                              <p className="font-mono text-[10px] mt-0.5 truncate">{selectedTicket.userAgent}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Customer Intelligence details */}
                    <div className="p-4 rounded-xl border" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                      <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Customer Profile details</span>
                      {selectedTicket.customerDetails ? (
                        <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                          <div>
                            <span className="opacity-70">Customer ID:</span>
                            <p className="font-mono font-bold truncate mt-0.5">{selectedTicket.customerDetails.customerId}</p>
                          </div>
                          <div>
                            <span className="opacity-70">Email:</span>
                            <p className="font-bold truncate mt-0.5 text-primary">{selectedTicket.customerDetails.email || selectedTicket.userEmail}</p>
                          </div>
                          <div>
                            <span className="opacity-70">Membership Tier:</span>
                            <p className="font-bold uppercase mt-0.5 text-primary">{selectedTicket.customerDetails.membership.replace("_", " ")}</p>
                          </div>
                          <div>
                            <span className="opacity-70">Active Points Balance:</span>
                            <p className="font-bold mt-0.5 text-amber-500">{selectedTicket.customerDetails.points} Pts</p>
                          </div>
                          <div>
                            <span className="opacity-70">Total Workspace Projects:</span>
                            <p className="font-bold mt-0.5">{selectedTicket.customerDetails.projectCount} Projects</p>
                          </div>
                          <div className="col-span-2">
                            <span className="opacity-70">Account Security Status:</span>
                            <p className="font-bold mt-0.5 capitalize text-emerald-400">{selectedTicket.customerDetails.status}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs opacity-75">
                          <p>Sender: <strong className="text-on-surface">{selectedTicket.userName}</strong> ({selectedTicket.userEmail})</p>
                          <p className="text-[10px] mt-1 text-slate-400 italic">No registered account linked to this email address.</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Subject</span>
                      <h4 className="text-base font-black mt-1" style={{ color: "var(--color-admin-on-surface)" }}>{selectedTicket.subject}</h4>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Detailed Description</span>
                      <p className="text-sm p-4 rounded-xl border mt-1 whitespace-pre-wrap leading-relaxed"
                         style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                        {selectedTicket.description}
                      </p>
                    </div>

                    {/* Message Thread */}
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Message Thread</span>
                      <div className="mt-2 space-y-3 max-h-48 overflow-y-auto custom-scrollbar p-3 rounded-xl border" style={{ borderColor: "var(--color-admin-outline-variant)", backgroundColor: "var(--color-admin-surface-container-lowest)" }}>
                        {loadingMessages ? (
                          <p className="text-xs text-center py-4" style={{ color: "var(--color-admin-on-surface-variant)" }}>Loading messages...</p>
                        ) : selectedTicketMessages.length === 0 ? (
                          <p className="text-xs text-center py-4 italic" style={{ color: "var(--color-admin-on-surface-variant)" }}>No messages yet. Reply below to start the conversation.</p>
                        ) : selectedTicketMessages.map((msg: any) => (
                          <div key={msg.id} className="flex gap-2">
                            <div className={`w-1 rounded-full shrink-0 ${msg.senderType === 'admin' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase" style={{ color: msg.senderType === 'admin' ? 'var(--color-admin-primary)' : '#10b981' }}>
                                  {msg.senderType === 'admin' ? 'Support Agent' : 'Customer'}
                                </span>
                                <span className="text-[9px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                                  {new Date(msg.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                              <p className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--color-admin-on-surface)' }}>{msg.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Reply Box */}
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={replyMessage}
                          onChange={e => setReplyMessage(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (!replyMessage.trim() || sendingReply) return;
                              setSendingReply(true);
                              try {
                                const res = await fetch('/api/admin/help/tickets/messages', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ ticketId: selectedTicket.id, message: replyMessage.trim() }),
                                });
                                const data = await res.json();
                                if (data.success) {
                                  setReplyMessage('');
                                  const msgRes = await fetch(`/api/admin/help/tickets/messages?ticketId=${selectedTicket.id}`);
                                  const msgData = await msgRes.json();
                                  if (msgData.success) setSelectedTicketMessages(msgData.messages);
                                  fetchData();
                                }
                              } catch {}
                              setSendingReply(false);
                            }
                          }}
                          placeholder="Type a reply and press Enter..."
                          className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none"
                          style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                          disabled={sendingReply}
                        />
                        <button
                          onClick={async () => {
                            if (!replyMessage.trim() || sendingReply) return;
                            setSendingReply(true);
                            try {
                              const res = await fetch('/api/admin/help/tickets/messages', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ticketId: selectedTicket.id, message: replyMessage.trim() }),
                              });
                              const data = await res.json();
                              if (data.success) {
                                setReplyMessage('');
                                const msgRes = await fetch(`/api/admin/help/tickets/messages?ticketId=${selectedTicket.id}`);
                                const msgData = await msgRes.json();
                                if (msgData.success) setSelectedTicketMessages(msgData.messages);
                                fetchData();
                              }
                            } catch {}
                            setSendingReply(false);
                          }}
                          className="px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:opacity-90"
                          style={{ backgroundColor: 'var(--color-admin-primary)', color: '#fff' }}
                          disabled={sendingReply || !replyMessage.trim()}
                        >
                          {sendingReply ? '...' : 'Send'}
                        </button>
                      </div>
                    </div>

                    {/* Resolution Notes / Reason Input */}
                    <div>
                      <label className="block text-xs font-bold mb-2 opacity-80">Resolution Reason / Action Notes</label>
                      <textarea 
                        rows={3} 
                        value={ticketResolutionNote} 
                        onChange={e => setTicketResolutionNote(e.target.value)}
                        placeholder="Write down diagnostic steps or reason for status updates..."
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                        style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-2 opacity-80">Update Ticket Status</label>
                        <select 
                          value={selectedTicket.status} 
                          disabled={ticketUpdating}
                          onChange={e => handleUpdateTicketStatus(selectedTicket.id, e.target.value, selectedTicket.priority)}
                          className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                          style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                        >
                          <option value="open">Open (Unresolved)</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved (Closed)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-2 opacity-80">Re-assign Priority</label>
                        <select 
                          value={selectedTicket.priority} 
                          disabled={ticketUpdating}
                          onChange={e => handleUpdateTicketStatus(selectedTicket.id, selectedTicket.status, e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                          style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                        >
                          <option value="P1">P1 Priority (Urgent)</option>
                          <option value="P2">P2 Priority (High)</option>
                          <option value="P3">P3 Priority (Medium)</option>
                          <option value="P4">P4 Priority (Low)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4 border-t" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                      <button onClick={() => handleUpdateTicketStatus(selectedTicket.id, "resolved", selectedTicket.priority)} disabled={ticketUpdating} className="px-6 py-3 rounded-xl font-bold text-sm bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50">{ticketUpdating ? "Working..." : "Resolve Ticket"}</button>
                      <button onClick={() => handleDeleteTicket(selectedTicket.id)} disabled={ticketUpdating} className="px-6 py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50">Delete Ticket</button>
                      <button type="button" onClick={() => handleUpdateTicketStatus(selectedTicket.id, selectedTicket.status, selectedTicket.priority)} disabled={ticketUpdating} className="ml-auto px-6 py-3 rounded-xl font-bold text-sm border hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>{ticketUpdating ? "Saving..." : "Save Notes"}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Documentation Viewer Modal */}
            {selectedDoc && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDoc(null)}>
                <div className="border p-8 rounded-2xl max-w-3xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
                     style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-primary)" }}
                     onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-mono font-black uppercase px-3 py-1 rounded" style={{ backgroundColor: "var(--color-admin-surface-container-low)", color: "var(--color-admin-primary)" }}>{selectedDoc.category} Docs</span>
                    <button onClick={() => setSelectedDoc(null)} className="material-symbols-outlined opacity-75 hover:opacity-100 transition-opacity">close</button>
                  </div>
                  <div className="prose dark:prose-invert max-w-none text-on-surface">
                    <h2 className="text-2xl font-bold mb-4">{selectedDoc.title}</h2>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                      {selectedDoc.content}
                    </div>
                  </div>
                  <div className="mt-8 pt-4 border-t text-xs opacity-60 text-right" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                    Last updated: {new Date(selectedDoc.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )}

            {/* Documentation Manager Modal */}
            {isDocManagerOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsDocManagerOpen(false)}>
                <div className="border p-8 rounded-2xl max-w-4xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
                     style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-primary)" }}
                     onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                      <span className="material-symbols-outlined">edit_document</span> Admin Documentation Content Manager
                    </h3>
                    <button onClick={() => setIsDocManagerOpen(false)} className="material-symbols-outlined opacity-75 hover:opacity-100 transition-opacity">close</button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Add / Edit Form */}
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: "var(--color-admin-primary)" }}>
                        {editingDocId ? "Edit Guide Details" : "Create New Document"}
                      </h4>
                      <form onSubmit={handleSaveDoc} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold mb-2 opacity-80">Title *</label>
                          <input 
                            type="text" required placeholder="e.g. LaTeX Syntax Check"
                            value={newDoc.title} onChange={e => setNewDoc({...newDoc, title: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                            style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-2 opacity-80">Category *</label>
                          <input 
                            type="text" required placeholder="e.g. Operations, API, Compliance"
                            value={newDoc.category} onChange={e => setNewDoc({...newDoc, category: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                            style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-2 opacity-80">Markdown Content *</label>
                          <textarea 
                            rows={8} required placeholder="Write down instructions, endpoints details..."
                            value={newDoc.content} onChange={e => setNewDoc({...newDoc, content: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none font-mono"
                            style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90" style={{ backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary-fixed)" }}>
                            {editingDocId ? "Update Document" : "Publish Document"}
                          </button>
                          {editingDocId && (
                            <button type="button" onClick={() => { setEditingDocId(null); setNewDoc({ title: "", content: "", category: "General" }); }} className="px-5 py-2.5 rounded-lg text-sm font-bold border" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                              Cancel Edit
                            </button>
                          )}
                        </div>
                      </form>
                    </div>

                    {/* Docs List */}
                    <div className="space-y-4 overflow-y-auto max-h-[50vh] pr-2 custom-scroll">
                      <h4 className="text-sm font-bold uppercase tracking-wide mb-4 opacity-75">Existing Guides</h4>
                      {docs.map(doc => (
                        <div key={doc.id} className="p-4 border rounded-xl" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                          <div className="flex justify-between items-start gap-4">
                            <h5 className="font-bold text-sm" style={{ color: "var(--color-admin-on-surface)" }}>{doc.title}</h5>
                            <span className="text-[10px] font-mono whitespace-nowrap opacity-65 px-2 py-0.5 rounded bg-slate-800">{doc.category}</span>
                          </div>
                          <p className="text-xs mt-2 opacity-75 line-clamp-3">{doc.content.substring(0, 100)}...</p>
                          <div className="flex gap-2 mt-4">
                            <button onClick={() => { setEditingDocId(doc.id); setNewDoc({ title: doc.title, content: doc.content, category: doc.category }); }} className="text-xs font-bold" style={{ color: "var(--color-admin-primary)" }}>Edit</button>
                            <button onClick={() => handleDeleteDoc(doc.id)} className="text-xs font-bold text-red-400">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FAQ Manager Modal */}
            {isFaqManagerOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsFaqManagerOpen(false)}>
                <div className="border p-8 rounded-2xl max-w-4xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
                     style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-primary)" }}
                     onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                      <span className="material-symbols-outlined">menu_book</span> User FAQ Matrix Manager
                    </h3>
                    <button onClick={() => setIsFaqManagerOpen(false)} className="material-symbols-outlined opacity-75 hover:opacity-100 transition-opacity">close</button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Add / Edit Form */}
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: "var(--color-admin-primary)" }}>
                        {editingFaqId ? "Edit FAQ Article" : "Create New FAQ"}
                      </h4>
                      <form onSubmit={handleSaveFaq} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold mb-2 opacity-80">Question *</label>
                          <input 
                            type="text" required placeholder="e.g. How to recover password?"
                            value={newFaq.question} onChange={e => setNewFaq({...newFaq, question: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                            style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-2 opacity-80">Answer *</label>
                          <textarea 
                            rows={5} required placeholder="Write a clear answers or links..."
                            value={newFaq.answer} onChange={e => setNewFaq({...newFaq, answer: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
                            style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-2 opacity-80">View Count</label>
                          <input 
                            type="number" min={0}
                            value={newFaq.views} onChange={e => setNewFaq({...newFaq, views: parseInt(e.target.value, 10) || 0})}
                            className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                            style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90" style={{ backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary-fixed)" }}>
                            {editingFaqId ? "Update FAQ" : "Add FAQ"}
                          </button>
                          {editingFaqId && (
                            <button type="button" onClick={() => { setEditingFaqId(null); setNewFaq({ question: "", answer: "", views: 0 }); }} className="px-5 py-2.5 rounded-lg text-sm font-bold border" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
                              Cancel Edit
                            </button>
                          )}
                        </div>
                      </form>
                    </div>

                    {/* FAQ List */}
                    <div className="space-y-4 overflow-y-auto max-h-[50vh] pr-2 custom-scroll">
                      <h4 className="text-sm font-bold uppercase tracking-wide mb-4 opacity-75">Existing FAQ Matrix</h4>
                      {faqs.map(f => (
                        <div key={f.id} className="p-4 border rounded-xl" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
                          <div className="flex justify-between items-start gap-4">
                            <h5 className="font-bold text-sm" style={{ color: "var(--color-admin-on-surface)" }}>{f.question}</h5>
                            <span className="text-[10px] font-mono whitespace-nowrap opacity-65">{f.views} views</span>
                          </div>
                          <p className="text-xs mt-2 opacity-75 line-clamp-3">{f.answer}</p>
                          <div className="flex gap-2 mt-4">
                            <button onClick={() => { setEditingFaqId(f.id); setNewFaq({ question: f.question, answer: f.answer, views: f.views }); }} className="text-xs font-bold" style={{ color: "var(--color-admin-primary)" }}>Edit</button>
                            <button onClick={() => handleDeleteFaq(f.id)} className="text-xs font-bold text-red-400">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Service Health Edit Modal */}
            {editingService && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditingService(null)}>
                <div className="border p-8 rounded-2xl max-w-2xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
                     style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-primary)" }}
                     onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                      <span className="material-symbols-outlined">settings_suggest</span> Edit Service Health Status: {editingService.name}
                    </h3>
                    <button onClick={() => setEditingService(null)} className="material-symbols-outlined opacity-75 hover:opacity-100 transition-opacity">close</button>
                  </div>
                  <form onSubmit={handleUpdateServiceHealth} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold mb-2 opacity-80">Service Status</label>
                      <select 
                        value={editingService.status} 
                        onChange={e => setEditingService({ ...editingService, status: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                        style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                      >
                        <option value="stable">Stable (Operational)</option>
                        <option value="normal">Normal</option>
                        <option value="high_load">High Load</option>
                        <option value="degraded">Degraded</option>
                        <option value="down">Down (Offline)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 opacity-80">Uptime Percent (%)</label>
                      <input 
                        type="number" step="0.01" min="0" max="100"
                        value={editingService.uptime} 
                        onChange={e => setEditingService({ ...editingService, uptime: parseFloat(e.target.value) || 99.9 })}
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                        style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                      />
                    </div>
                    {(editingService.serviceKey === "doc2latex") && (
                      <div>
                        <label className="block text-xs font-bold mb-2 opacity-80">Latency (ms)</label>
                        <input 
                          type="number" min="0"
                          value={editingService.latencyMs} 
                          onChange={e => setEditingService({ ...editingService, latencyMs: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                          style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                        />
                      </div>
                    )}
                    {(editingService.serviceKey === "template_migrator") && (
                      <div>
                        <label className="block text-xs font-bold mb-2 opacity-80">Queue Jobs</label>
                        <input 
                          type="number" min="0"
                          value={editingService.queueJobs} 
                          onChange={e => setEditingService({ ...editingService, queueJobs: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                          style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                        />
                      </div>
                    )}
                    {(editingService.serviceKey === "ai_diagram") && (
                      <div>
                        <label className="block text-xs font-bold mb-2 opacity-80">Usage Peak Percent (%)</label>
                        <input 
                          type="number" min="0" max="100"
                          value={editingService.usagePercent} 
                          onChange={e => setEditingService({ ...editingService, usagePercent: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                          style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                        />
                      </div>
                    )}
                    <div className="flex gap-4 pt-2">
                      <button type="submit" className="px-6 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary-fixed)" }}>Update Service settings</button>
                      <button type="button" onClick={() => setEditingService(null)} className="px-6 py-3 rounded-xl font-bold text-sm border" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* General Queries Modal Dialog */}
            {selectedQueryCard && (
              <div className="fixed inset-0 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm z-[9999]">
                <div 
                  className="w-full max-w-4xl rounded-3xl border shadow-2xl flex flex-col h-[75vh] overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95" 
                  style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)" }}
                >
                  {/* Modal Header */}
                  <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                    <div>
                      <h3 className="text-xl font-black capitalize" style={{ color: "var(--color-admin-on-surface)" }}>
                        {selectedQueryCard} Queries Insights
                      </h3>
                      <p className="text-xs mt-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                        Showing {
                          selectedQueryCard === 'total' ? queries.length
                          : selectedQueryCard === 'replied' ? queries.filter(q => q.status === 'replied').length
                          : queries.filter(q => q.status !== 'replied').length
                        } entries
                      </p>
                    </div>
                    <button 
                      onClick={() => { setSelectedQueryCard(null); setSelectedQuery(null); setIsEditQueryMode(false); }} 
                      className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                      style={{ color: "var(--color-admin-on-surface-variant)" }}
                    >
                      <span className="material-symbols-outlined block">close</span>
                    </button>
                  </div>

                  {/* Modal Content - Dual Column Layout */}
                  <div className="flex-1 overflow-hidden flex min-h-[50vh]">
                    {/* Left: Queries List */}
                    <div className="w-1/2 border-r overflow-y-auto p-4 flex flex-col gap-2 custom-scroll" style={{ borderColor: "var(--color-admin-outline-variant)", backgroundColor: "var(--color-admin-surface-container-low)" }}>
                      {(() => {
                        const filtered = queries.filter(q => {
                          if (selectedQueryCard === 'replied') return q.status === 'replied';
                          if (selectedQueryCard === 'pending') return q.status !== 'replied';
                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-12 text-sm text-gray-500">
                              no entries are available
                            </div>
                          );
                        }

                        return filtered.map((q) => {
                          const active = selectedQuery?.id === q.id;
                          return (
                            <div
                              key={q.id}
                              onClick={() => {
                                setSelectedQuery(q);
                                setReplyText(q.reply || '');
                                setIsEditQueryMode(false);
                                setEditName(q.name || '');
                                setEditEmail(q.email || '');
                                setEditPhone(q.phone || '');
                                setEditMessage(q.message || '');
                              }}
                              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                                active 
                                  ? "border-indigo-500 shadow-md bg-indigo-500/5" 
                                  : "border-transparent hover:bg-black/5 dark:hover:bg-white/5"
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-bold text-xs truncate max-w-[200px]" style={{ color: "var(--color-admin-on-surface)" }}>
                                  {q.name}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  q.status === 'replied' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                }`}>
                                  {q.status || 'pending'}
                                </span>
                              </div>
                              <p className="text-[10px] truncate mt-1 opacity-70" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                                {q.email}
                              </p>
                              <p className="text-xs line-clamp-2 mt-2 font-medium" style={{ color: "var(--color-admin-on-surface)" }}>
                                {q.message}
                              </p>
                              <div className="flex justify-between items-center mt-3 text-[9px] opacity-50">
                                <span>{new Date(q.created || q.createdAt).toLocaleDateString()}</span>
                                {!q.isRead && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Right: Selected Query Details & Actions */}
                    <div className="w-1/2 overflow-y-auto p-6 flex flex-col custom-scroll">
                      {selectedQuery ? (
                        <div className="space-y-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-lg font-black" style={{ color: "var(--color-admin-on-surface)" }}>
                                {isEditQueryMode ? "Edit Query Details" : selectedQuery.subject || "General Query"}
                              </h4>
                              <p className="text-xs opacity-75 mt-0.5">{new Date(selectedQuery.created || selectedQuery.createdAt).toLocaleString()}</p>
                            </div>
                            <div className="flex gap-2">
                              {!isEditQueryMode ? (
                                <button 
                                  onClick={() => setIsEditQueryMode(true)}
                                  className="p-2 hover:bg-black/5 rounded-full text-indigo-500"
                                  title="Edit"
                                >
                                  <span className="material-symbols-outlined block text-[18px]">edit</span>
                                </button>
                              ) : (
                                <button 
                                  onClick={() => setIsEditQueryMode(false)}
                                  className="p-2 hover:bg-black/5 rounded-full text-slate-500"
                                  title="Cancel Edit"
                                >
                                  <span className="material-symbols-outlined block text-[18px]">close</span>
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteQuery(selectedQuery.id)}
                                className="p-2 hover:bg-black/5 rounded-full text-rose-500"
                                title="Delete"
                              >
                                <span className="material-symbols-outlined block text-[18px]">delete</span>
                              </button>
                            </div>
                          </div>

                          {isEditQueryMode ? (
                            // Edit Form
                            <div className="space-y-4">
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Name</label>
                                <input 
                                  type="text" 
                                  value={editName}
                                  onChange={e => setEditName(e.target.value)}
                                  className="w-full border rounded-lg px-3 py-2 text-xs outline-none"
                                  style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Email</label>
                                <input 
                                  type="email" 
                                  value={editEmail}
                                  onChange={e => setEditEmail(e.target.value)}
                                  className="w-full border rounded-lg px-3 py-2 text-xs outline-none"
                                  style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Phone</label>
                                <input 
                                  type="text" 
                                  value={editPhone}
                                  onChange={e => setEditPhone(e.target.value)}
                                  className="w-full border rounded-lg px-3 py-2 text-xs outline-none"
                                  style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Message</label>
                                <textarea 
                                  rows={4}
                                  value={editMessage}
                                  onChange={e => setEditMessage(e.target.value)}
                                  className="w-full border rounded-lg px-3 py-2 text-xs outline-none resize-none"
                                  style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                />
                              </div>
                              <button 
                                onClick={handleSaveQueryEdits}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg text-xs font-bold transition-colors"
                              >
                                Save Changes
                              </button>
                            </div>
                          ) : (
                            // View details
                            <div className="space-y-4 text-sm">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                  <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Name</span>
                                  <span className="font-bold text-xs" style={{ color: "var(--color-admin-on-surface)" }}>{selectedQuery.name}</span>
                                </div>
                                <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                  <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Contact Number</span>
                                  <span className="font-bold text-xs" style={{ color: "var(--color-admin-on-surface)" }}>{selectedQuery.phone || "—"}</span>
                                </div>
                              </div>
                              <div className="p-3 bg-black/5 dark:bg-white/5 rounded-xl border" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Email</span>
                                <span className="font-bold text-xs" style={{ color: "var(--color-admin-on-surface)" }}>{selectedQuery.email}</span>
                              </div>
                              <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Message Query</span>
                                <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap" style={{ color: "var(--color-admin-on-surface)" }}>{selectedQuery.message}</p>
                              </div>

                              {/* Query Reply Section */}
                              <div className="border-t pt-4 space-y-3" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Reply &amp; Follow-up</span>
                                {selectedQuery.reply && (
                                  <div className="p-3.5 bg-emerald-500/5 text-emerald-500 rounded-xl border border-emerald-500/25">
                                    <span className="block text-[9px] font-black uppercase tracking-wider mb-1">Previous Reply Sent</span>
                                    <p className="text-xs font-semibold">{selectedQuery.reply}</p>
                                  </div>
                                )}
                                <textarea
                                  rows={3}
                                  value={replyText}
                                  onChange={e => setReplyText(e.target.value)}
                                  placeholder="Write a response to the user..."
                                  className="w-full border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                  style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleSendQueryReply}
                                    disabled={submittingReply || !replyText.trim()}
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                  >
                                    {submittingReply ? "Submitting..." : "Send Reply"}
                                  </button>
                                  <button
                                    onClick={() => handleToggleQueryRead(selectedQuery.id, selectedQuery.isRead)}
                                    className="px-4 py-2.5 border rounded-xl text-xs font-bold hover:bg-black/5 transition-all"
                                    style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                                  >
                                    Mark as {selectedQuery.isRead ? "Unread" : "Read"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 py-16">
                          <span className="material-symbols-outlined text-[48px] text-gray-400 mb-2">info</span>
                          <p className="text-sm font-semibold">Select a query from the list to view insights and respond.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FAB for Urgent Support */}
            <button onClick={() => setIsCreateTicketOpen(true)} className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-all z-50 group" style={{ backgroundColor: "var(--color-admin-error)", color: "var(--color-admin-on-error)" }}>
                <span className="material-symbols-outlined">support_agent</span>
                <span className="absolute right-full mr-4 px-3 py-1 text-xs font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: "var(--color-admin-error)", color: "var(--color-admin-on-error)" }}>Contact System Ops</span>
            </button>
        </div>
    );
}
