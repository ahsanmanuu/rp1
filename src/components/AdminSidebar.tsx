'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AdminSidebarProps {
  isDarkMode?: boolean;
  adminName?: string;
}

const NAV_LINKS = [
  { href: '/admin/dashboard',       icon: 'dashboard',      label: 'Dashboard' },
  { href: '/admin/billings',        icon: 'payments',       label: 'Bill & Payments' },
  { href: '/admin/users',           icon: 'group',          label: 'Users' },
  { href: '/admin/profile',         icon: 'settings',       label: 'Profile & Plan Setting' },
  { href: '/admin/ai-caps',         icon: 'speed',          label: 'AI Usage & Caps Rules' },
  { href: '/admin/ai-analysis',     icon: 'psychology',     label: 'AI Analysis' },
  { href: '/admin/anomalies',       icon: 'warning',        label: 'Anomaly Center' },
  { href: '/admin/help',            icon: 'help',           label: 'Help and Support' },
  { href: '/admin/offers',          icon: 'local_offer',    label: 'Offers' },
  { href: '/admin/emails',          icon: 'mail',           label: 'Email History' },
  { href: '/admin/general-queries', icon: 'forum',          label: 'General Queries' },
  { href: '/admin/social-media',    icon: 'share',          label: 'Social Media' },
  { href: '/admin/tax-calculation', icon: 'calculate',      label: 'Tax Calculation' },
  { href: '/admin/backup',          icon: 'cloud_download', label: 'Backup & Restore' },
];

export default function AdminSidebar({ isDarkMode = false, adminName = 'Admin Root' }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col p-4 gap-2 fixed h-screen w-64 left-0 top-0 border-r z-50 transition-colors duration-500"
      style={{
        backgroundColor: 'var(--color-admin-surface-container)',
        borderColor: 'var(--color-admin-outline-variant)',
      }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-1 px-2 mb-6 mt-2 text-center">
        <Image
          src="/logo.png"
          alt="Latexify Logo"
          width={0}
          height={0}
          sizes="100%"
          className="w-48 h-12 object-contain"
          style={{ filter: isDarkMode ? 'brightness(0) invert(1)' : 'none' }}
        />
        <p
          className="text-[10px] font-bold uppercase tracking-wider opacity-85 mt-1"
          style={{ color: 'var(--color-admin-primary)' }}
        >
          Admin Console
        </p>
      </div>

      {/* Nav Links */}
      <nav className="flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1">
        {NAV_LINKS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all duration-200 hover:translate-x-1"
              style={{
                color: isActive
                  ? 'var(--color-admin-on-secondary-container)'
                  : 'var(--color-admin-on-surface-variant)',
                backgroundColor: isActive
                  ? 'var(--color-admin-secondary-container)'
                  : 'transparent',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}

        {/* Divider + PB Dashboard link */}
        <div
          className="border-t my-2"
          style={{ borderColor: 'var(--color-admin-outline-variant)' }}
        />
        <a
          href="/pb/_/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
          style={{ color: 'var(--color-admin-primary)' }}
        >
          <span className="material-symbols-outlined">database</span>
          PB Dashboard
        </a>
      </nav>

      {/* Footer */}
      <div
        className="mt-auto p-4 rounded-xl border text-sm"
        style={{
          backgroundColor: 'var(--color-admin-surface-container-low)',
          borderColor: 'var(--color-admin-outline-variant)',
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--color-admin-primary)' }}
          />
          <span style={{ color: 'var(--color-admin-primary)' }}>System Online</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
          Version 4.2.0-stable
        </p>
      </div>
    </aside>
  );
}
