"use client";
import Link from 'next/link';
import LatexifyLogo from '@/components/LatexifyLogo';
import { useSession, signOut } from "@/lib/pb-auth-react";
import { useState, useEffect } from 'react';

export default function Navbar() {
  const { data: session, status } = useSession();
  const [theme, setTheme] = useState('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <nav className="glass" style={{
      position: 'sticky', top: 0, zIndex: 50,
      height: 'var(--nav-height)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center'
    }}>
      <div className="container flex items-center justify-between">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <LatexifyLogo size={48} />
        </Link>
        
        <div className="flex items-center" style={{ gap: '1.5rem' }}>
          <button 
            onClick={toggleTheme} 
            className="btn btn-secondary" 
            style={{ padding: '0.4rem', borderRadius: '50%', width: '36px', height: '36px' }}
            title="Toggle Theme"
            suppressHydrationWarning
          >
            {mounted ? (theme === 'dark' ? '☀️' : '🌙') : '☀️'}
          </button>
          
          {status === 'loading' ? (
            <div style={{ width: '100px' }}>Loading...</div>
          ) : session ? (
            <div className="flex items-center" style={{ gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-tertiary)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--warning)', fontWeight: 600 }}>★</span>
                <span>{session.user?.points ?? 100} pts</span>
              </div>
              <Link href="/history" className="btn btn-secondary">History</Link>
              <Link href="/profile" className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%' }}>👤</Link>
              <button onClick={() => signOut({ callbackUrl: '/' })} className="btn btn-secondary">Logout</button>
            </div>
          ) : (
            <div className="flex items-center" style={{ gap: '1rem' }}>
              <Link href="/login" style={{ fontWeight: 500 }}>Login</Link>
              <Link href="/register" className="btn btn-primary">Sign Up</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
