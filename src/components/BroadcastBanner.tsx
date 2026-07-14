'use client';

import React, { useState, useEffect } from 'react';
import { createPb } from '@/lib/pb';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
}

export default function BroadcastBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // Helper function to dismiss an announcement in state and localStorage
  const dismissAnnouncement = (id: string) => {
    setDismissedIds(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      localStorage.setItem('dismissed-announcements', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('dismissed-announcements');
    if (saved) {
      try {
        setDismissedIds(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }

    const fetchAnnouncements = async () => {
      try {
        const res = await fetch('/api/announcements');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) {
          setAnnouncements(data.announcements || []);
        }
      } catch (err: any) {
        if (err?.message?.includes('503')) return;
        console.error('Failed to fetch announcements:', err);
      }
    };

    fetchAnnouncements();

    const pb = createPb();

    // Subscribe to announcements in real-time
    pb.collection('announcements').subscribe('*', (e) => {
      console.log('[PB Realtime Broadcast] Announcement event:', e.action, e.record);
      fetchAnnouncements();
    }).catch(err => {
      console.warn('[PB Realtime Broadcast] Failed to subscribe to announcements, falling back to polling:', err);
    });

    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchAnnouncements, 30000);

    return () => {
      clearInterval(interval);
      pb.collection('announcements').unsubscribe('*').catch(() => {});
    };
  }, []);

  // Filter out dismissed/seen announcements
  const activeAnnouncements = announcements.filter(a => !dismissedIds.includes(a.id));

  const current = activeAnnouncements[currentIndex % activeAnnouncements.length];

  // Auto-hide current announcement after 10 seconds of being displayed
  useEffect(() => {
    if (!current?.id) return;

    const timer = setTimeout(() => {
      console.log(`[BroadcastBanner] Auto-hiding seen announcement: ${current.id}`);
      dismissAnnouncement(current.id);
      setCurrentIndex(prev => {
        const remainingCount = activeAnnouncements.length - 1;
        if (remainingCount <= 0) return 0;
        return prev >= remainingCount ? 0 : prev;
      });
    }, 10000);

    return () => clearTimeout(timer);
  }, [current?.id, activeAnnouncements.length]);

  // Dynamically set CSS variables for banner height to prevent overlap with fixed headers/sidebars
  useEffect(() => {
    console.log("[BroadcastBanner] activeAnnouncements:", activeAnnouncements.length, "mounted:", mounted);
    if (activeAnnouncements.length > 0 && mounted) {
      console.log("[BroadcastBanner] Adding class has-broadcast-banner and setting --broadcast-banner-height to 44px");
      document.documentElement.style.setProperty('--broadcast-banner-height', '44px');
      document.documentElement.classList.add('has-broadcast-banner');
    } else {
      console.log("[BroadcastBanner] Removing class has-broadcast-banner and resetting --broadcast-banner-height to 0px");
      document.documentElement.style.setProperty('--broadcast-banner-height', '0px');
      document.documentElement.classList.remove('has-broadcast-banner');
    }
    return () => {
      console.log("[BroadcastBanner] Cleanup: removing class and style property");
      document.documentElement.style.removeProperty('--broadcast-banner-height');
      document.documentElement.classList.remove('has-broadcast-banner');
    };
  }, [activeAnnouncements.length, mounted]);

  if (!mounted) return null;

  if (activeAnnouncements.length === 0) return null;

  const handleDismiss = () => {
    if (!current?.id) return;
    dismissAnnouncement(current.id);
    setCurrentIndex(prev => {
      const remainingCount = activeAnnouncements.length - 1;
      if (remainingCount <= 0) return 0;
      return prev >= remainingCount ? 0 : prev;
    });
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % activeAnnouncements.length);
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + activeAnnouncements.length) % activeAnnouncements.length);
  };

  // Styles based on priority
  let bgStyle = 'bg-indigo-600 text-white';
  let iconName = 'info';
  let priorityLabel = 'System Update';

  if (current.priority === 'critical') {
    bgStyle = 'bg-rose-700 text-white animate-pulse';
    iconName = 'error';
    priorityLabel = 'Critical Alert';
  } else if (current.priority === 'warning') {
    bgStyle = 'bg-amber-600 text-white';
    iconName = 'warning';
    priorityLabel = 'Warning';
  }

  return (
    <div className={`w-full py-2.5 px-4 flex items-center justify-between transition-all duration-300 relative z-[9999] shadow-md border-b border-white/10 ${bgStyle}`}>
      <div className="flex-1 flex items-center justify-center gap-3 pr-8 min-w-0">
        <span className="material-symbols-outlined shrink-0 text-[20px] select-none">{iconName}</span>
        <div className="text-sm font-semibold flex flex-wrap items-center gap-2 min-w-0">
          <span className="uppercase text-[10px] tracking-wider bg-black/25 px-2 py-0.5 rounded font-mono font-bold">
            {priorityLabel}
          </span>
          <span className="font-bold truncate max-w-[150px] md:max-w-[250px]">{current.title}:</span>
          <span className="font-medium opacity-95 truncate max-w-[300px] md:max-w-[600px]">{current.content}</span>
        </div>

        {activeAnnouncements.length > 1 && (
          <div className="flex items-center gap-1.5 ml-3 shrink-0">
            <button onClick={handlePrev} className="hover:bg-white/20 rounded p-0.5 transition-colors leading-none" aria-label="Previous Broadcast">
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <span className="text-[10px] font-mono opacity-80">{currentIndex + 1}/{activeAnnouncements.length}</span>
            <button onClick={handleNext} className="hover:bg-white/20 rounded p-0.5 transition-colors leading-none" aria-label="Next Broadcast">
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        )}
      </div>

      <button 
        onClick={handleDismiss} 
        className="absolute right-4 hover:bg-white/20 rounded-full p-1 transition-colors leading-none shrink-0"
        aria-label="Dismiss Alert"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
