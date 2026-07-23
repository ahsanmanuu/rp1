"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from "@/lib/pb-auth-react";
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileEdit, 
  FileText, 
  Network, 
  RefreshCw, 
  Brain, 
  Quote, 
  Grid, 
  History,
  Headphones,
  Bell,
  LogOut,
  Zap,
  Archive
} from 'lucide-react';
import LatexifyLogo from '@/components/LatexifyLogo';

const NAV_ITEMS = [
  { href: '/dashboard',         icon: LayoutDashboard,   label: 'Dashboard',   color: 'text-primary' },
  { href: '/latex-studio/projects', icon: FileEdit,   label: 'Latexify Studio',   color: 'text-primary' },
  { href: '/upload',            icon: FileText,   label: 'Doc2LateX Studio',  color: 'text-blue-500' },
  { href: '/diagrams/editor',   icon: Network,    label: 'AI Diagram Studio',   color: 'text-amber-500' },
  { href: '/template-migrator/studio', icon: RefreshCw,  label: 'Template Migrator', color: 'text-purple-500' },
  { href: '/reviewer/studio',   icon: Brain,      label: 'AI Peer Reviewer',  color: 'text-indigo-500' },
  { href: '/citations/studio',  icon: Quote,      label: 'AI Citation Studio', color: 'text-rose-500' },
  { href: '/templates',         icon: Grid,   label: 'Template Gallery', color: 'text-emerald-500' },
  { href: '/dashboard/ai-usage', icon: Zap,      label: 'AI Usage & Caps',  color: 'text-amber-500' },
  { href: '/history',           icon: History,     label: 'History', color: 'text-secondary' },
  { href: '/dashboard/support', icon: Headphones,  label: 'Support',  color: 'text-cyan-500' },
  { href: '/archive',           icon: Archive,     label: 'Archive', color: 'text-amber-600' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !session) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/user/notifications?unreadOnly=true");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [mounted, session]);

  if (!session || !mounted) return null;

  return (
    <nav 
      className="flex flex-col fixed left-0 top-[64px] h-[calc(100vh-64px)] py-6 space-y-2 w-64 hidden md:flex z-[110] shadow-sm transition-all duration-300"
      style={{ 
        borderRight: '1px solid var(--strict-border)', 
        background: 'var(--strict-bg)',
        color: 'var(--strict-text)' 
      }}
    >
      <div className="px-6 pb-8">
        <Link href="/dashboard" style={{ color: 'var(--accent-primary)' }} className="block">
          <LatexifyLogo size={48} />
        </Link>

      </div>
      
      <div className="flex-1 px-4 space-y-1 overflow-y-auto custom-scroll">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-3 rounded-xl transition-all duration-300 group relative border ${
                active 
                  ? "bg-primary/10 border-primary shadow-sm" 
                  : "border-transparent hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              style={{ color: active ? 'var(--accent-primary)' : 'var(--strict-text)' }}
            >
              <Icon className={`mr-4 ${active ? "text-primary" : item.color}`} size={22} />
              <span className="font-bold tracking-tight text-[14px]">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* User Section */}
      <div className="px-4 mt-auto pt-6 border-t border-[var(--strict-border)]">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-[var(--strict-border)] shadow-sm">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs border border-[var(--strict-border)] shadow-sm">
            {session.user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[11px] font-black text-[var(--strict-text)] truncate leading-tight">{session.user?.name || "Scholar"}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-primary">{(session.user as any)?.points || 0} Credits</p>
          </div>
          <Link
            href="/dashboard/support"
            className="relative text-secondary hover:text-primary transition-colors"
            title="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
          <button 
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-secondary hover:text-rose-600 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
}
