"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Palette, Check, ChevronDown, Moon, Sun, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type ScholarlyTheme = 'indigo' | 'purple' | 'emerald' | 'gold' | 'slate';
export type AppearanceMode = 'light' | 'dark' | 'system';

interface ThemeSwitcherProps {
  onThemeChange?: (theme: ScholarlyTheme) => void;
  onAppearanceChange?: (mode: AppearanceMode) => void;
}

export default function ThemeSwitcher({ onThemeChange, onAppearanceChange }: ThemeSwitcherProps) {
  const [currentTheme, setCurrentTheme] = useState<ScholarlyTheme>('indigo');
  const [appearance, setAppearance] = useState<AppearanceMode>('light');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Load Accent Theme
    const savedTheme = localStorage.getItem('scholarly-preferred-theme') as ScholarlyTheme;
    if (savedTheme && themeOptions.some(t => t.id === savedTheme)) {
      applyTheme(savedTheme);
    } else {
      applyTheme('indigo');
    }

    // 2. Load Appearance Mode
    const savedAppearance = localStorage.getItem('scholarly-appearance') as AppearanceMode;
    if (savedAppearance) {
      applyAppearance(savedAppearance);
    } else {
      applyAppearance('light');
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyTheme = (theme: ScholarlyTheme) => {
    setCurrentTheme(theme);
    const root = window.document.documentElement;
    const themes: ScholarlyTheme[] = ['indigo', 'purple', 'emerald', 'gold', 'slate'];
    
    themes.forEach(t => {
      root.classList.remove(`theme-${t}`);
      document.body.classList.remove(`theme-${t}`);
    });
    
    root.classList.add(`theme-${theme}`);
    document.body.classList.add(`theme-${theme}`);
    
    localStorage.setItem('scholarly-preferred-theme', theme);
    if (onThemeChange) onThemeChange(theme);
  };

  const applyAppearance = (mode: AppearanceMode) => {
    setAppearance(mode);
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let resolvedMode = mode;
    if (mode === 'system') {
      resolvedMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    root.classList.add(resolvedMode);
    localStorage.setItem('scholarly-appearance', mode);
    if (onAppearanceChange) onAppearanceChange(mode);
  };

  const themeOptions: { id: ScholarlyTheme; color: string; label: string; secondary: string }[] = [
    { id: 'indigo', color: '#4f46e5', secondary: '#3b82f6', label: 'Royal Indigo' },
    { id: 'purple', color: '#7c4dff', secondary: '#9c27b0', label: 'Deep Amethyst' },
    { id: 'emerald', color: '#10b981', secondary: '#059669', label: 'Scientific Emerald' },
    { id: 'gold', color: '#ffab00', secondary: '#f59e0b', label: 'Amber Gold' },
    { id: 'slate', color: '#475569', secondary: '#1e293b', label: 'Classic Scholar' },
  ];

  const activeTheme = themeOptions.find(t => t.id === currentTheme) || themeOptions[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2.5 px-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline transition-all duration-300 shadow-sm hover:shadow-md"
      >
        <div 
          className="w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-500 group-hover:rotate-90 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${activeTheme.color}, ${activeTheme.secondary})` }}
        >
          <Palette size={12} className="text-white opacity-80" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-on-surface transition-colors hidden md:block">Theme</span>
        <ChevronDown size={14} className={`text-on-surface transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-72 bg-surface rounded-[2rem] border-2 border-outline shadow-ambient-deep z-[200] p-6 overflow-hidden"
          >
            <div className="space-y-8">
              {/* Appearance Toggles */}
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface px-2">Appearance</span>
                <div className="grid grid-cols-3 gap-2 p-1.5 bg-surface-container-low rounded-2xl border border-outline">
                  <AppearanceButton 
                    active={appearance === 'light'} 
                    onClick={() => applyAppearance('light')} 
                    icon={<Sun size={14}/>} 
                    label="Light" 
                  />
                  <AppearanceButton 
                    active={appearance === 'dark'} 
                    onClick={() => applyAppearance('dark')} 
                    icon={<Moon size={14}/>} 
                    label="Dark" 
                  />
                  <AppearanceButton 
                    active={appearance === 'system'} 
                    onClick={() => applyAppearance('system')} 
                    icon={<Monitor size={14}/>} 
                    label="Sys" 
                  />
                </div>
              </div>

              {/* Accent Palette */}
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface px-2">Accent Palette</span>
                <div className="grid grid-cols-1 gap-2">
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => applyTheme(opt.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-200 group/item ${
                        currentTheme === opt.id 
                          ? 'bg-primary/10 border border-primary/50 shadow-sm' 
                          : 'hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-xl shadow-md transition-transform group-hover/item:scale-110"
                          style={{ background: `linear-gradient(135deg, ${opt.color}, ${opt.secondary})` }}
                        />
                        <span className={`text-xs font-bold transition-colors ${currentTheme === opt.id ? 'text-primary' : 'text-on-surface'}`}>
                          {opt.label}
                        </span>
                      </div>
                      {currentTheme === opt.id && <Check size={14} className="text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const AppearanceButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-surface shadow-lg text-primary border border-primary/20' 
        : 'text-on-surface hover:bg-surface-container-high'
    }`}
  >
    {icon}
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);
