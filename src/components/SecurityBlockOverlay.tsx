'use client';

import React, { useState, useEffect } from 'react';

export default function SecurityBlockOverlay() {
  const [mounted, setMounted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [blacklistReason, setBlacklistReason] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('admin@latexify.io');
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    setMounted(true);

    const checkBlock = async () => {
      try {
        const res = await fetch('/api/security/check-block');
        if (!res.ok) {
          console.warn('[SecurityBlock] Check block response not OK:', res.status);
          return;
        }
        const data = await res.json();
        if (data.success) {
          setBlocked(data.blocked);
          setIsBlacklisted(data.isBlacklisted || false);
          setBlockedUntil(data.blockedUntil || null);
          setBlacklistReason(data.blacklistReason || null);
          setAdminEmail(data.adminEmail || 'admin@latexify.io');
        }
      } catch (err: any) {
        console.warn('[SecurityBlock] Failed to check security block status:', err.message || err);
      }
    };

    const recordGeoLocation = async () => {
      if (typeof window !== 'undefined' && sessionStorage.getItem('latexify-geo-recorded')) {
        return;
      }
      try {
        // Query free geocoding API to resolve client-side public IP to location name
        const geoRes = await fetch('https://ip-api.com/json/');
        const geoData = await geoRes.json();
        if (geoData && geoData.query) {
          const locStr = `${geoData.city || ''}, ${geoData.regionName || ''}, ${geoData.country || ''}`
            .replace(/^,\s*/, '')
            .replace(/,\s*$/, '')
            .trim();

          // Send to background logger
          const logRes = await fetch('/api/security/check-block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ipAddress: geoData.query,
              location: locStr || 'Unknown Location'
            })
          });
          if (logRes.ok && typeof window !== 'undefined') {
            sessionStorage.setItem('latexify-geo-recorded', 'true');
          }
        }
      } catch (e) {
        console.warn('[Geolocation capturing] Failed in background:', e);
      }
    };

    recordGeoLocation();
    checkBlock();
    const interval = setInterval(checkBlock, 10000); // Poll block check every 10s
    return () => clearInterval(interval);
  }, []);

  // Countdown timer for temporary blocks only
  useEffect(() => {
    if (!blocked || isBlacklisted || !blockedUntil) return;

    const updateCountdown = () => {
      const target = new Date(blockedUntil).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setBlocked(false);
        setBlockedUntil(null);
        window.location.reload();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const hDisplay = hours > 0 ? `${hours}h ` : '';
      const mDisplay = minutes > 0 ? `${minutes}m ` : '0m ';
      setTimeLeft(`${hDisplay}${mDisplay}${seconds}s`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [blocked, isBlacklisted, blockedUntil]);

  if (!mounted || !blocked) return null;

  // ── Permanent blacklist overlay ──────────────────────────────────────────
  if (isBlacklisted) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(12px)' }}>
        <div style={{
          background: 'linear-gradient(145deg, #1a0a0a, #1e1010)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '20px',
          padding: '48px 40px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(239,68,68,0.1)',
          textAlign: 'center',
          animation: 'fadeIn 0.4s ease-out',
        }}>
          {/* Lock Icon */}
          <div style={{
            width: '80px', height: '80px',
            background: 'radial-gradient(circle, rgba(239,68,68,0.2), rgba(239,68,68,0.05))',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <span className="material-symbols-outlined" style={{
              fontSize: '40px', color: '#ef4444',
              fontVariationSettings: "'FILL' 1"
            }}>lock_person</span>
          </div>

          {/* Title */}
          <h2 style={{ margin: '0 0 8px', color: '#fff', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.3px' }}>
            Account Suspended
          </h2>
          <p style={{ margin: '0 0 24px', color: '#ef4444', fontSize: '13px', fontWeight: '500', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Access Permanently Restricted
          </p>

          {/* Reason */}
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderLeft: '3px solid #ef4444',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'left',
          }}>
            <p style={{ margin: '0 0 6px', color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Reason for Suspension
            </p>
            <p style={{ margin: '0', color: '#fca5a5', fontSize: '14px', lineHeight: '1.6' }}>
              {blacklistReason || 'Violation of platform terms of service.'}
            </p>
          </div>

          {/* Message */}
          <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '13px', lineHeight: '1.7' }}>
            Your account has been reviewed and suspended by the platform administration.
            All access to your projects and tools has been frozen pending further action.
          </p>

          {/* Admin Contact */}
          <div style={{
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '10px',
            padding: '16px',
          }}>
            <p style={{ margin: '0 0 6px', color: '#60a5fa', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              To Appeal This Decision
            </p>
            <p style={{ margin: '0 0 8px', color: '#9ca3af', fontSize: '13px' }}>
              Contact the platform administrator:
            </p>
            <a
              href={`mailto:${adminEmail}`}
              style={{
                color: '#93c5fd',
                fontSize: '15px',
                fontWeight: '600',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>mail</span>
              {adminEmail}
            </a>
          </div>
        </div>

        <style jsx global>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // ── Temporary block overlay (existing behavior) ───────────────────────────
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center flex flex-col items-center animate-fade-in">
        <span className="material-symbols-outlined text-[64px] text-rose-500 mb-4 animate-pulse"
          style={{ fontVariationSettings: "'FILL' 1" }}>lock_person</span>
        <h2 className="text-2xl font-bold text-white mb-2">Access Temporarily Suspended</h2>
        <p className="text-slate-300 text-sm mb-6 leading-relaxed">
          You have overused the tools. Please try again after 2 hours with current locked positions.
        </p>
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-6 py-3 font-mono text-xl text-rose-400 font-bold">
          Locked for: {timeLeft || 'Calculating...'}
        </div>
      </div>
    </div>
  );
}
