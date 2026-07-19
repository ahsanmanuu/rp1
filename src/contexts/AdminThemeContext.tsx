"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { Theme } from "@/components/AdminThemeStyles";
import { themes } from "@/components/AdminThemeStyles";

export interface AdminThemeContextValue {
  currentTheme: Theme;
  isDarkMode: boolean;
  activeCurrency: string;
  mounted: boolean;
  setTheme: (theme: Theme) => void;
  setDarkMode: (dark: boolean) => void;
  setCurrency: (currency: string) => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

function detectCurrency(): string {
  try {
    const locale = navigator.language || "en-IN";
    if (locale.includes("IN")) return "INR";
  } catch {}
  return "INR";
}

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<Theme>("indigo");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState<string>("INR");

  const prevPanelsRef = useRef<string>("");

  // Load from PocketBase on mount (localStorage already loaded synchronously above)
  useEffect(() => {
    let cancelled = false;

    const loadFromDB = async () => {
      try {
        const storedToken = localStorage.getItem("latexify-admin-token");
        if (!storedToken) return;

        const res = await fetch("/api/admin/layout-settings", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.success && data.settings?.panels && !cancelled) {
          const panels = data.settings.panels;
          if (panels.theme && themes[panels.theme as Theme]) {
            setCurrentTheme(panels.theme as Theme);
            localStorage.setItem("latexify-admin-theme", panels.theme);
          }
          if (panels.mode) {
            setIsDarkMode(panels.mode === "dark");
            localStorage.setItem("latexify-admin-mode", panels.mode);
          }
          if (panels.currency) {
            setActiveCurrency(panels.currency);
            localStorage.setItem("latexify-admin-currency", panels.currency);
          }
          prevPanelsRef.current = JSON.stringify({ theme: panels.theme, mode: panels.mode, currency: panels.currency });
        }
      } catch {
        // Fallback to localStorage values already loaded
      }
    };

    loadFromDB();
    return () => { cancelled = true; };
  }, []);

  // Load from localStorage immediately on mount (before DB response)
  useEffect(() => {
    const savedTheme = localStorage.getItem("latexify-admin-theme") as Theme | null;
    const savedMode = localStorage.getItem("latexify-admin-mode");
    const savedCurrency = localStorage.getItem("latexify-admin-currency");

    if (savedTheme && themes[savedTheme]) setCurrentTheme(savedTheme);
    if (savedMode) setIsDarkMode(savedMode === "dark");
    if (savedCurrency) setActiveCurrency(savedCurrency);
    else setActiveCurrency(detectCurrency());

    setMounted(true);

    // Listen for cross-tab changes
    const handleStorage = () => {
      const t = localStorage.getItem("latexify-admin-theme") as Theme | null;
      const m = localStorage.getItem("latexify-admin-mode");
      const c = localStorage.getItem("latexify-admin-currency");
      if (t && themes[t]) setCurrentTheme(t);
      if (m) setIsDarkMode(m === "dark");
      if (c) setActiveCurrency(c);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Persist to localStorage + PocketBase + dispatch event on every change
  useEffect(() => {
    if (!mounted) return;

    // 1. localStorage
    localStorage.setItem("latexify-admin-theme", currentTheme);
    localStorage.setItem("latexify-admin-mode", isDarkMode ? "dark" : "light");
    localStorage.setItem("latexify-admin-currency", activeCurrency);

    // 2. Broadcast to AdminThemeStyles and other listeners
    window.dispatchEvent(new Event("admin-theme-changed"));

    // 3. Persist to PocketBase (debounced via PUT)
    const nextMode = isDarkMode ? "dark" : "light";
    const panelStr = JSON.stringify({ theme: currentTheme, mode: nextMode, currency: activeCurrency });
    if (panelStr !== prevPanelsRef.current) {
      prevPanelsRef.current = panelStr;
      // Debounced save
      const timer = setTimeout(() => {
        fetch("/api/admin/layout-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            panels: {
              theme: currentTheme,
              mode: nextMode,
              currency: activeCurrency,
            },
          }),
        }).catch(() => {});
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentTheme, isDarkMode, activeCurrency, mounted]);

  const setTheme = useCallback((t: Theme) => setCurrentTheme(t), []);
  const setDarkMode = useCallback((d: boolean) => setIsDarkMode(d), []);
  const setCurrency = useCallback((c: string) => setActiveCurrency(c), []);

  return (
    <AdminThemeContext.Provider value={{ currentTheme, isDarkMode, activeCurrency, mounted, setTheme, setDarkMode, setCurrency }}>
      {children}
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme(): AdminThemeContextValue {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) {
    // Fallback for pages outside the provider (e.g. during SSR)
    return {
      currentTheme: "indigo",
      isDarkMode: false,
      activeCurrency: "INR",
      mounted: false,
      setTheme: () => {},
      setDarkMode: () => {},
      setCurrency: () => {},
    };
  }
  return ctx;
}
