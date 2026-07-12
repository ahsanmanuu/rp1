'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from "@/lib/pb-auth-react";
import Sidebar from '@/components/Sidebar';
import dynamic from 'next/dynamic';
const ChatWidget = dynamic(() => import('@/components/ChatWidget'), { ssr: false });
import ProLoader from "@/components/ProLoader";
import {
  Headphones, Plus, Send, ChevronDown, ChevronRight,
  CheckCircle, AlertCircle, FileText, Activity,
  MessageSquare, Loader2, X, BookOpen, Bell, Check
} from 'lucide-react';

interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: string;
  message: string;
  createdAt: string;
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
  updatedAt: string;
  messages?: TicketMessage[];
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  views: number;
}

interface Documentation {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt: string;
}

interface ServiceHealth {
  id: string;
  serviceKey: string;
  name: string;
  status: string;
  uptime: number;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  ticketId?: string;
  isRead: boolean;
  createdAt: string;
}

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  P1: { label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  P2: { label: 'High', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  P3: { label: 'Medium', color: '#00685f', bg: 'rgba(0,104,95,0.1)' },
  P4: { label: 'Low', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  open: { label: 'Open', color: '#f59e0b', icon: 'hourglass_empty' },
  in_progress: { label: 'In Progress', color: '#3b82f6', icon: 'autorenew' },
  resolved: { label: 'Resolved', color: '#22c55e', icon: 'check_circle' },
};

const healthColors: Record<string, string> = {
  stable: 'bg-emerald-500',
  normal: 'bg-blue-500',
  high_load: 'bg-amber-500',
  degraded: 'bg-rose-500',
  down: 'bg-red-600',
};

export default function SupportPage() {
  const { data: _session } = useSession();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [metrics, setMetrics] = useState({ totalOpen: 0, inProgress: 0, totalResolved: 0, urgent: 0 });
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [docs, setDocs] = useState<Documentation[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Documentation | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', description: '', priority: 'P4' });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const [loading, setLoading] = useState(true);

  // Use refs to avoid stale closures in polling interval
  const statusFilterRef = useRef(statusFilter);
  const selectedTicketRef = useRef(selectedTicket);
  statusFilterRef.current = statusFilter;
  selectedTicketRef.current = selectedTicket;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchTickets = async (status?: string) => {
    try {
      const qs = status && status !== 'all' ? `?status=${status}` : '';
      const res = await fetch(`/api/support/tickets${qs}`);
      const data = await res.json();
      if (data.success) {
        setTickets(data.tickets);
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to fetch tickets', err);
    }
  };

  const fetchTicketDetail = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedTicket(data.ticket);
        setTicketMessages(data.ticket.messages || []);
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Failed to fetch ticket detail', err);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket)
      });
      const data = await res.json();
      if (data.success) {
        setIsCreateOpen(false);
        setNewTicket({ subject: '', description: '', priority: 'P4' });
        fetchTickets();
        fetchTicketDetail(data.ticket.id);
      }
    } catch (err) {
      console.error('Failed to create ticket', err);
    } finally {
      setCreating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;
    setSendingMessage(true);
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage })
      });
      const data = await res.json();
      if (data.success) {
        setTicketMessages(prev => [...prev, data.newMessage]);
        setNewMessage('');
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const fetchFaqs = async () => {
    try {
      const res = await fetch('/api/support/faqs');
      const data = await res.json();
      if (data.success) setFaqs(data.faqs);
    } catch (err) {
      console.error('Failed to fetch FAQs', err);
    }
  };

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/support/docs');
      const data = await res.json();
      if (data.success) setDocs(data.docs);
    } catch (err) {
      console.error('Failed to fetch docs', err);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/support/health');
      const data = await res.json();
      if (data.success) setServices(data.services);
    } catch (err) {
      console.error('Failed to fetch health', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/user/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/user/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.allSettled([fetchTickets(), fetchFaqs(), fetchDocs(), fetchHealth(), fetchNotifications()]);
      setLoading(false);
    };
    init();
    const interval = setInterval(() => {
      fetchTickets(statusFilterRef.current);
      fetchHealth();
      fetchNotifications();
      if (selectedTicketRef.current) {
        fetchTicketDetail(selectedTicketRef.current.id);
      }
    }, 30000);
    return () => clearInterval(interval);
   
  }, []);

  const handleFilterChange = (filter: string) => {
    setStatusFilter(filter);
    fetchTickets(filter);
  };

  const filteredTickets = statusFilter === 'all' ? tickets
    : tickets.filter(t => t.status === statusFilter);

  if (loading) {
    return <ProLoader />;
  }

  return (
    <div className="flex h-screen bg-background text-on-background font-body-md overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col md:ml-64 h-full relative overflow-hidden">
        <div className="flex-1 overflow-y-auto p-margin academic-grid custom-scroll pt-24 pb-12">

          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-display)' }}>Support Center</h1>
              <p className="text-sm mt-1 text-on-surface-variant">Get help with your projects and account</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-3 glass-card rounded-2xl border border-outline hover:shadow-ambient-soft transition-all"
                >
                  <Bell size={18} className={unreadCount > 0 ? 'text-primary' : 'text-on-surface-variant'} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-black px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-80 glass-card rounded-2xl border border-outline shadow-2xl z-[110] animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-4 border-b border-outline flex items-center justify-between">
                      <span className="text-xs font-black">Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1">
                          <Check size={12} /> Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scroll">
                      {notifications.length === 0 ? (
                        <p className="p-6 text-xs text-on-surface-variant text-center">No notifications yet</p>
                      ) : notifications.map(n => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b border-outline-variant/30 transition-colors ${n.isRead ? 'opacity-60' : 'bg-primary/5'}`}
                        >
                          <p className="text-[11px] font-bold mb-0.5">{n.title}</p>
                          <p className="text-[10px] text-on-surface-variant leading-relaxed">{n.body}</p>
                          <p className="text-[9px] text-on-surface-variant/50 mt-1">
                            {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-2xl font-black text-xs uppercase tracking-widest shadow-md hover:brightness-110 active:scale-[0.98] transition-all"
              >
                <Plus size={18} /> New Ticket
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-gutter mb-8">
            <div
              onClick={() => handleFilterChange('all')}
              className="glass-card rounded-2xl p-6 border border-outline cursor-pointer hover:shadow-ambient-soft transition-all active:scale-[0.98]"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary/80">Total Tickets</span>
              <h3 className="text-3xl font-black mt-2 text-primary">{tickets.length}</h3>
            </div>
            <div
              onClick={() => handleFilterChange('open')}
              className="glass-card rounded-2xl p-6 border border-outline cursor-pointer hover:shadow-ambient-soft transition-all active:scale-[0.98]"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary/80">Open / Pending</span>
              <h3 className="text-3xl font-black mt-2" style={{ color: '#f59e0b' }}>{metrics.totalOpen}</h3>
            </div>
            <div
              onClick={() => handleFilterChange('in_progress')}
              className="glass-card rounded-2xl p-6 border border-outline cursor-pointer hover:shadow-ambient-soft transition-all active:scale-[0.98]"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary/80">In Progress</span>
              <h3 className="text-3xl font-black mt-2" style={{ color: '#3b82f6' }}>{metrics.inProgress}</h3>
            </div>
            <div
              onClick={() => handleFilterChange('resolved')}
              className="glass-card rounded-2xl p-6 border border-outline cursor-pointer hover:shadow-ambient-soft transition-all active:scale-[0.98]"
            >
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary/80">Resolved</span>
              <h3 className="text-3xl font-black mt-2" style={{ color: '#22c55e' }}>{metrics.totalResolved}</h3>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">

            {/* Left: Tickets */}
            <div className="lg:col-span-2 space-y-6">

              {/* Ticket List Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black" style={{ fontFamily: 'var(--font-display)' }}>
                  {statusFilter === 'all' ? 'My Tickets' : `${statusConfig[statusFilter]?.label || statusFilter} Tickets`}
                  <span className="text-sm font-normal text-on-surface-variant ml-2">({filteredTickets.length})</span>
                </h2>
                <div className="flex gap-1">
                  {['all', 'open', 'in_progress', 'resolved'].map(f => (
                    <button
                      key={f}
                      onClick={() => handleFilterChange(f)}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all ${
                        statusFilter === f
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'border-outline-variant text-secondary hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {f === 'in_progress' ? 'In Progress' : f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ticket Cards */}
              <div className="space-y-3">
                {filteredTickets.length === 0 ? (
                  <div className="glass-card rounded-2xl p-12 border border-outline text-center">
                    <Headphones className="mx-auto mb-4 text-outline" size={48} />
                    <p className="text-on-surface-variant font-medium">No tickets found</p>
                    <p className="text-xs text-on-surface-variant/60 mt-1">Create a new ticket to get started</p>
                  </div>
                ) : filteredTickets.map(t => {
                  const pc = priorityConfig[t.priority] || priorityConfig.P4;
                  const sc = statusConfig[t.status] || statusConfig.open;
                  const lastMsg = t.messages?.[0];
                  return (
                    <div
                      key={t.id}
                      onClick={() => fetchTicketDetail(t.id)}
                      className="glass-card rounded-2xl p-5 border border-outline cursor-pointer hover:shadow-ambient-soft transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black font-mono" style={{ color: pc.color }}>{t.ticketId}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border" style={{ backgroundColor: pc.bg, borderColor: pc.color + '33', color: pc.color }}>
                            {pc.label}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: sc.color }}>
                          <span className="material-symbols-outlined text-sm">{sc.icon}</span>
                          {sc.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold mb-1">{t.subject}</h3>
                      <p className="text-xs text-on-surface-variant line-clamp-2 mb-2">{t.description}</p>
                      {lastMsg && (
                        <div className="flex items-center gap-2 text-[10px] text-on-surface-variant/60 bg-surface-container-lowest/50 rounded-lg px-3 py-2">
                          <MessageSquare size={12} />
                          <span className="truncate">{lastMsg.senderType === 'admin' ? 'Support' : 'You'}: {lastMsg.message}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-[10px] text-on-surface-variant/50">
                          {new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <ChevronRight size={14} className="text-on-surface-variant/30" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: FAQs, Health, Docs */}
            <div className="space-y-6">

              {/* FAQs */}
              <div className="glass-card rounded-2xl border border-outline overflow-hidden">
                <div className="p-5 border-b border-outline">
                  <h3 className="text-sm font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                    <BookOpen size={16} className="text-primary" /> Frequently Asked Questions
                  </h3>
                </div>
                <div className="divide-y divide-outline-variant/30">
                  {faqs.length === 0 ? (
                    <p className="p-5 text-xs text-on-surface-variant text-center">No FAQs available</p>
                  ) : faqs.slice(0, 6).map(faq => (
                    <div key={faq.id}>
                      <button
                        onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <span className="text-xs font-bold pr-2">{faq.question}</span>
                        <ChevronDown
                          size={14}
                          className={`text-on-surface-variant shrink-0 transition-transform ${expandedFaq === faq.id ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {expandedFaq === faq.id && (
                        <div className="px-4 pb-4">
                          <p className="text-xs text-on-surface-variant leading-relaxed">{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Service Health */}
              <div className="glass-card rounded-2xl border border-outline overflow-hidden">
                <div className="p-5 border-b border-outline">
                  <h3 className="text-sm font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                    <Activity size={16} className="text-primary" /> Service Status
                  </h3>
                </div>
                <div className="p-4 space-y-2">
                  {services.length === 0 ? (
                    <p className="text-xs text-on-surface-variant text-center py-4">No services tracked</p>
                  ) : services.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${healthColors[s.status] || 'bg-gray-400'}`}></span>
                        <span className="text-xs font-medium">{s.name}</span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/60">
                        {s.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documentation */}
              <div className="glass-card rounded-2xl border border-outline overflow-hidden">
                <div className="p-5 border-b border-outline">
                  <h3 className="text-sm font-black flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                    <FileText size={16} className="text-primary" /> Documentation
                  </h3>
                </div>
                <div className="p-4 space-y-2">
                  {docs.length === 0 ? (
                    <p className="text-xs text-on-surface-variant text-center py-4">No documentation available</p>
                  ) : docs.slice(0, 5).map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc)}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <FileText size={14} className="text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{doc.title}</p>
                        <p className="text-[10px] text-on-surface-variant/60">{doc.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ticket Detail Slide-over */}
        {selectedTicket && (
          <div className="fixed inset-0 z-[100] flex justify-end" onClick={() => { setSelectedTicket(null); setTicketMessages([]); }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
            <div
              className="relative w-full max-w-xl bg-surface-container-lowest border-l border-outline flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-outline flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black font-mono" style={{ color: priorityConfig[selectedTicket.priority]?.color }}>
                      {selectedTicket.ticketId}
                    </span>
                    <span
                      className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border"
                      style={{
                        backgroundColor: priorityConfig[selectedTicket.priority]?.bg,
                        borderColor: priorityConfig[selectedTicket.priority]?.color + '33',
                        color: priorityConfig[selectedTicket.priority]?.color
                      }}
                    >
                      {priorityConfig[selectedTicket.priority]?.label}
                    </span>
                    <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: statusConfig[selectedTicket.status]?.color }}>
                      <span className="material-symbols-outlined text-sm">{statusConfig[selectedTicket.status]?.icon}</span>
                      {statusConfig[selectedTicket.status]?.label}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold">{selectedTicket.subject}</h3>
                </div>
                <button
                  onClick={() => { setSelectedTicket(null); setTicketMessages([]); }}
                  className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <X size={18} className="text-on-surface-variant" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scroll">
                {/* Location & Device Info */}
                {(selectedTicket.location || selectedTicket.ipAddress) && (
                  <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/30">
                    <span className="text-[9px] font-black uppercase tracking-widest text-secondary/60 block mb-2">Location & Device</span>
                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      {selectedTicket.location && (
                        <div>
                          <span className="text-on-surface-variant/50 block">Location</span>
                          <span className="font-bold">{selectedTicket.location}</span>
                          {selectedTicket.country && <span className="ml-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-black text-[9px]">{selectedTicket.country}</span>}
                        </div>
                      )}
                      {selectedTicket.ipAddress && (
                        <div>
                          <span className="text-on-surface-variant/50 block">IP Address</span>
                          <span className="font-mono font-bold">{selectedTicket.ipAddress}</span>
                        </div>
                      )}
                      {selectedTicket.userAgent && (
                        <div className="col-span-2">
                          <span className="text-on-surface-variant/50 block">Browser</span>
                          <span className="font-mono text-[10px] truncate block">{selectedTicket.userAgent}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Original description */}
                <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-black">
                      {selectedTicket.userName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-[10px] font-bold">You</span>
                    <span className="text-[9px] text-on-surface-variant/50 ml-auto">
                      {new Date(selectedTicket.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-on-surface-variant">{selectedTicket.description}</p>
                </div>

                {/* Conversation messages */}
                {ticketMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.senderType === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl p-4 ${
                      msg.senderType === 'customer'
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-low border border-outline-variant/30'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black ${msg.senderType === 'customer' ? 'text-on-primary/80' : 'text-primary'}`}>
                          {msg.senderType === 'admin' ? 'Support Team' : 'You'}
                        </span>
                        <span className={`text-[9px] ${msg.senderType === 'customer' ? 'text-on-primary/50' : 'text-on-surface-variant/50'} ml-auto`}>
                          {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed ${msg.senderType === 'customer' ? '' : 'text-on-surface-variant'}`}>{msg.message}</p>
                    </div>
                  </div>
                ))}

                {/* Admin reason/note if present */}
                {selectedTicket.reason && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/30">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle size={12} className="text-amber-600" />
                      <span className="text-[10px] font-black text-amber-700 dark:text-amber-400">Admin Note</span>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{selectedTicket.reason}</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {selectedTicket.status !== 'resolved' && (
                <div className="p-4 border-t border-outline shrink-0">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-3 text-sm rounded-2xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium transition-all"
                      disabled={sendingMessage}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={sendingMessage || !newMessage.trim()}
                      className="px-4 py-3 bg-primary text-on-primary rounded-2xl hover:brightness-110 disabled:opacity-40 transition-all"
                    >
                      {sendingMessage ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {selectedTicket.status === 'resolved' && (
                <div className="p-4 border-t border-outline text-center shrink-0">
                  <p className="text-xs text-on-surface-variant/60 flex items-center justify-center gap-1">
                    <CheckCircle size={14} className="text-emerald-500" /> This ticket has been resolved
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Ticket Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setIsCreateOpen(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
            <div
              className="relative bg-surface-container-lowest rounded-3xl border border-outline shadow-2xl w-full max-w-2xl p-8 animate-in fade-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black" style={{ fontFamily: 'var(--font-display)' }}>Create Support Ticket</h2>
                <button onClick={() => setIsCreateOpen(false)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <X size={18} className="text-on-surface-variant" />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary/80 block mb-2">Subject</label>
                  <input
                    type="text"
                    required
                    value={newTicket.subject}
                    onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                    placeholder="Brief summary of your issue"
                    className="w-full px-4 py-3 text-sm rounded-2xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary/80 block mb-2">Description</label>
                  <textarea
                    rows={4}
                    required
                    value={newTicket.description}
                    onChange={e => setNewTicket({ ...newTicket, description: e.target.value })}
                    placeholder="Describe your issue in detail..."
                    className="w-full px-4 py-3 text-sm rounded-2xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.25em] text-secondary/80 block mb-2">Priority</label>
                  <select
                    value={newTicket.priority}
                    onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })}
                    className="w-full px-4 py-3 text-sm rounded-2xl border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium transition-all"
                  >
                    <option value="P1">P1 - Urgent</option>
                    <option value="P2">P2 - High</option>
                    <option value="P3">P3 - Medium</option>
                    <option value="P4">P4 - Low</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-6 py-3 bg-primary text-on-primary rounded-2xl font-black text-xs uppercase tracking-widest shadow-md hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {creating ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-6 py-3 border border-outline-variant rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Documentation Viewer Modal */}
        {selectedDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setSelectedDoc(null)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
            <div
              className="relative bg-surface-container-lowest rounded-3xl border border-outline shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto custom-scroll p-8 animate-in fade-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  {selectedDoc.category}
                </span>
                <button onClick={() => setSelectedDoc(null)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <X size={18} className="text-on-surface-variant" />
                </button>
              </div>
              <h2 className="text-xl font-black mb-4" style={{ fontFamily: 'var(--font-display)' }}>{selectedDoc.title}</h2>
              <div className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-wrap">{selectedDoc.content}</div>
              <div className="mt-6 pt-4 border-t border-outline text-[10px] text-on-surface-variant/50 text-right">
                Last updated: {new Date(selectedDoc.updatedAt).toLocaleDateString('en-IN')}
              </div>
            </div>
          </div>
        )}
        <ChatWidget />
      </div>
    </div>
  );
}
