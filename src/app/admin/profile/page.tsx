"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

type Theme = "indigo" | "emerald" | "rose" | "violet" | "amber" | "cyan";

interface Themes {
  primary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  surfaceContainer: string;
  outlineVariant: string;
}

const themes: Record<Theme, Themes> = {
  indigo: {
    primary: "#c3c0ff",
    primaryContainer: "rgba(195, 192, 255, 0.15)",
    onPrimaryContainer: "#dad7ff",
    surfaceContainer: "#171f33",
    outlineVariant: "#464555",
  },
  emerald: {
    primary: "#6ee7b7",
    primaryContainer: "rgba(110, 231, 183, 0.15)",
    onPrimaryContainer: "#d1fae5",
    surfaceContainer: "#0f2c20",
    outlineVariant: "#2d4a3e",
  },
  rose: {
    primary: "#fda4af",
    primaryContainer: "rgba(253, 164, 175, 0.15)",
    onPrimaryContainer: "#ffe4e6",
    surfaceContainer: "#33181b",
    outlineVariant: "#553639",
  },
  violet: {
    primary: "#d8b4fe",
    primaryContainer: "rgba(216, 180, 254, 0.15)",
    onPrimaryContainer: "#f3e8ff",
    surfaceContainer: "#2e1065",
    outlineVariant: "#4c1d95",
  },
  amber: {
    primary: "#fcd34d",
    primaryContainer: "rgba(252, 211, 77, 0.15)",
    onPrimaryContainer: "#fef3c7",
    surfaceContainer: "#451a03",
    outlineVariant: "#78350f",
  },
  cyan: {
    primary: "#67e8f9",
    primaryContainer: "rgba(103, 232, 249, 0.15)",
    onPrimaryContainer: "#ecfeff",
    surfaceContainer: "#083344",
    outlineVariant: "#164e63",
  }
};

export default function AdminProfilePage() {
  const [mounted, setMounted] = useState(false);

  // Theme & Appearance State
  const [currentTheme, setCurrentTheme] = useState<Theme>("indigo");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);

  // Profile data
  const [adminEmail, setAdminEmail] = useState("admin@latexify.io");
  const [adminName, setAdminName] = useState("Admin Root");
  const [adminRole, setAdminRole] = useState("Super Admin");
  const [createdAt, setCreatedAt] = useState<string>("");

  // Edit states
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Plans states
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [savePlanLoading, setSavePlanLoading] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ planId: "", name: "", description: "", priceINR: "", durationMonths: "", pointsExchange: "" });
  const [createPlanLoading, setCreatePlanLoading] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/admin/plans");
      const data = await res.json();
      if (data.success) {
        setPlans(data.plans);
      }
    } catch (err) {
      console.error("Failed to fetch plans:", err);
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setSavePlanLoading(true);

    try {
      const res = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingPlan),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: `Successfully updated ${editingPlan.name}` });
        setEditingPlan(null);
        fetchPlans();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update plan" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSavePlanLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatePlanLoading(true);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlan),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: `Plan "${newPlan.name}" created successfully!` });
        setCreatingPlan(false);
        setNewPlan({ planId: "", name: "", description: "", priceINR: "", durationMonths: "", pointsExchange: "" });
        fetchPlans();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to create plan" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setCreatePlanLoading(false);
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`Are you sure you want to delete "${planName}"? This cannot be undone.`)) return;
    setDeletingPlanId(planId);
    try {
      const res = await fetch(`/api/admin/plans?planId=${encodeURIComponent(planId)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: `Plan "${planName}" deleted successfully.` });
        fetchPlans();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to delete plan" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setDeletingPlanId(null);
    }
  };

  // Header Dropdown States
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Load theme & mode
    const savedTheme = localStorage.getItem("latexify-admin-theme") as Theme | null;
    const savedMode = localStorage.getItem("latexify-admin-mode");
    if (savedTheme) setCurrentTheme(savedTheme);
    if (savedMode) setIsDarkMode(savedMode === "dark");

    // Load admin info from server session
    fetch("/api/admin/session")
      .then(r => r.json())
      .then(data => {
        if (data.success && data.admin) {
          setAdminEmail(data.admin.email);
          const nameVal = data.admin.name || "Admin Root";
          setAdminName(nameVal);
          setEditName(nameVal);
          localStorage.setItem("latexify-admin-email", data.admin.email);
          localStorage.setItem("latexify-admin-name", nameVal);
        }
      })
      .catch(() => {
        // Fallback to localStorage display values
        const storedEmail = localStorage.getItem("latexify-admin-email");
        const storedName = localStorage.getItem("latexify-admin-name");
        if (storedEmail) setAdminEmail(storedEmail);
        if (storedName) {
          setAdminName(storedName);
          setEditName(storedName);
        }
      });

    // Fetch full profile info from db
    fetch("/api/admin/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.admin) {
          setAdminEmail(data.admin.email);
          const nameVal = data.admin.name || "Admin Root";
          setAdminName(nameVal);
          setEditName(nameVal);
          localStorage.setItem("latexify-admin-name", nameVal);
          
          // Format role
          const roleMap: Record<string, string> = {
            superadmin: "Super Admin",
            editor: "System Editor",
            billing: "Billing Specialist"
          };
          setAdminRole(roleMap[data.admin.role] || data.admin.role || "Administrator");
          if (data.admin.createdAt) {
            setCreatedAt(new Date(data.admin.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric"
            }));
          }
        }
      })
      .catch((err) => console.error("Failed to load admin profile info", err));

    fetchPlans();
  }, []);

  // Save Theme Selection
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("latexify-admin-theme", currentTheme);
      localStorage.setItem("latexify-admin-mode", isDarkMode ? "dark" : "light");
      window.dispatchEvent(new Event("admin-theme-changed"));
    }
  }, [currentTheme, isDarkMode, mounted]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setIsThemeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate initials
  const adminInitials = adminName
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AR";

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      localStorage.removeItem("latexify-admin-email");
      localStorage.removeItem("latexify-admin-name");
    } catch {
      // ignore
    }
    window.location.href = "/admin/login";
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      const data = await res.json();
      if (data.success && data.admin) {
        const newName = data.admin.name || editName;
        setAdminName(newName);
        localStorage.setItem("latexify-admin-name", newName);
        setMessage({ type: "success", text: "Profile details updated successfully!" });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update profile." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  const colors = themes[currentTheme];

  return (
    <div
      className="min-h-screen relative flex font-sans transition-colors duration-500"
      style={{
        backgroundColor: isDarkMode ? "var(--color-admin-background, #0b1326)" : "var(--color-admin-background, #f8fafc)",
        color: "var(--color-admin-on-surface)",
      }}
    >
      {/* Material Design Theme Tokens Injector */}
      <style jsx global>{`
        :root {
          ${isDarkMode
            ? `
            --color-admin-primary: ${colors.primary};
            --color-admin-primary-container: ${colors.primaryContainer};
            --color-admin-on-primary-container: ${colors.onPrimaryContainer};
            --color-admin-secondary-container: ${colors.primaryContainer};
            --color-admin-outline-variant: ${colors.outlineVariant};
            --color-admin-background: #0b1326 !important;
            --color-admin-surface: #0b1326 !important;
            --color-admin-surface-dim: #0b1326 !important;
            --color-admin-surface-bright: #31394d !important;
            --color-admin-surface-container-lowest: #060e20 !important;
            --color-admin-surface-container-low: #131b2e !important;
            --color-admin-surface-container: #171f33 !important;
            --color-admin-surface-container-high: #222a3d !important;
            --color-admin-surface-container-highest: #2d3449 !important;
            --color-admin-on-surface: #dae2fd !important;
            --color-admin-on-surface-variant: #c7c4d8 !important;
            --color-admin-on-background: #dae2fd !important;
            --color-admin-outline: #918fa1 !important;
            --color-admin-tertiary: ${colors.primary};
            --color-admin-tertiary-container: ${colors.primaryContainer};
            --color-admin-on-tertiary-container: ${colors.onPrimaryContainer};
            --color-admin-inverse-surface: #dae2fd;
            --color-admin-inverse-on-surface: #283044;
            --color-admin-inverse-primary: ${colors.primary};
            --color-admin-surface-tint: ${colors.primary};
          `
            : `
            --color-admin-primary: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5'} !important;
            --color-admin-primary-container: ${currentTheme === 'rose' ? '#ffe4e6' : currentTheme === 'emerald' ? '#d1fae5' : '#e0e7ff'} !important;
            --color-admin-on-primary-container: ${currentTheme === 'rose' ? '#4c0519' : currentTheme === 'emerald' ? '#022c22' : '#1e1b4b'} !important;
            --color-admin-secondary-container: ${currentTheme === 'rose' ? '#ffe4e6' : currentTheme === 'emerald' ? '#d1fae5' : '#e0e7ff'} !important;
            --color-admin-outline-variant: #cbd5e1 !important;
            --color-admin-background: #f8fafc !important;
            --color-admin-surface: #ffffff !important;
            --color-admin-surface-dim: #f1f5f9 !important;
            --color-admin-surface-bright: #ffffff !important;
            --color-admin-surface-container-lowest: #ffffff !important;
            --color-admin-surface-container-low: #f1f5f9 !important;
            --color-admin-surface-container: #e2e8f0 !important;
            --color-admin-surface-container-high: #cbd5e1 !important;
            --color-admin-surface-container-highest: #94a3b8 !important;
            --color-admin-on-surface: #0f172a !important;
            --color-admin-on-surface-variant: #475569 !important;
            --color-admin-on-background: #0f172a !important;
            --color-admin-outline: #64748b !important;
            --color-admin-tertiary: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5'} !important;
            --color-admin-tertiary-container: ${currentTheme === 'rose' ? '#ffe4e6' : currentTheme === 'emerald' ? '#d1fae5' : '#e0e7ff'} !important;
            --color-admin-on-tertiary-container: ${currentTheme === 'rose' ? '#4c0519' : currentTheme === 'emerald' ? '#022c22' : '#1e1b4b'} !important;
            --color-admin-on-error-container: #410002 !important;
            --color-admin-inverse-surface: #1e293b !important;
            --color-admin-inverse-on-surface: #f1f5f9 !important;
            --color-admin-inverse-primary: ${colors.primary} !important;
            --color-admin-surface-tint: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5'} !important;
            --color-admin-surface-variant: #e2e8f0 !important;
          `}
        }
      `}</style>

      {/* Side Navigation Shell */}
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
          <a className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all translate-x-1 duration-200 shadow-sm"
            style={{ backgroundColor: 'var(--color-admin-secondary-container)', color: 'var(--color-admin-on-secondary-container)' }} href="#">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>settings</span>Profile and Plan Setting
          </a>
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
          <Link href="/admin/offers" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">local_offer</span>Offers
          </Link>
          <Link href="/admin/emails" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">mail</span>Email History
          </Link>
          <Link href="/admin/social-media" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">share</span>Social Media
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

      {/* Top App Bar */}
      <header
        className="flex justify-between items-center fixed top-0 left-64 right-0 px-6 py-4 border-b z-40 transition-colors duration-500"
        style={{
          backgroundColor: "var(--color-admin-surface)",
          borderColor: "var(--color-admin-outline-variant)",
        }}
      >
        <div className="flex items-center gap-4 flex-1">
          <h1 className="text-lg font-bold" style={{ color: "var(--color-admin-on-surface)" }}>
            Profile Settings
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative" ref={themeRef}>
            <button
              onClick={() => setIsThemeOpen(!isThemeOpen)}
              className="material-symbols-outlined transition-colors p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-500"
              style={{ color: "var(--color-admin-on-surface-variant)" }}
              title="Theme Settings"
            >
              palette
            </button>
            <div
              className={`absolute right-0 mt-2 w-56 border rounded-xl shadow-xl z-50 overflow-hidden ${
                isThemeOpen ? "block" : "hidden"
              }`}
              style={{
                backgroundColor: "var(--color-admin-surface-container-highest)",
                borderColor: "var(--color-admin-outline-variant)",
              }}
            >
              <div className="p-3 border-b" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-admin-on-surface)" }}>
                  Accent Color
                </p>
              </div>
              <div className="p-1">
                {(Object.keys(themes) as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setCurrentTheme(t);
                      setIsThemeOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all group/item hover:bg-opacity-20 hover:bg-gray-500"
                  >
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: themes[t].primary }}></span>
                    <span className="text-sm font-medium capitalize" style={{ color: "var(--color-admin-on-surface)" }}>
                      {t} {t === "indigo" ? "(Default)" : ""}
                    </span>
                    {currentTheme === t && (
                      <span className="material-symbols-outlined text-[16px] ml-auto" style={{ color: "var(--color-admin-primary)" }}>
                        check
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div
                className="p-3 border-t"
                style={{
                  backgroundColor: "var(--color-admin-surface-container)",
                  borderColor: "var(--color-admin-outline-variant)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: "var(--color-admin-on-surface)" }}>
                    Dark Mode
                  </span>
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="w-10 h-5 rounded-full relative transition-colors"
                    style={{ backgroundColor: "var(--color-admin-primary)" }}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full shadow-sm transition-all ${
                        isDarkMode ? "right-0.5" : "left-0.5"
                      }`}
                      style={{ backgroundColor: "var(--color-admin-on-primary, #ffffff)" }}
                    ></div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            ref={profileRef}
            className="relative pl-4 border-l"
            style={{ borderColor: "var(--color-admin-outline-variant)" }}
          >
            <button
              id="admin-profile-btn"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
              style={{ backgroundColor: "var(--color-admin-surface-container-high)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                style={{
                  backgroundColor: "var(--color-admin-primary-container)",
                  color: "var(--color-admin-on-primary-container)",
                }}
              >
                {adminInitials}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold" style={{ color: "var(--color-admin-on-surface)" }}>
                  {adminName}
                </p>
                <p className="text-[10px] truncate max-w-[120px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                  {adminEmail}
                </p>
              </div>
              <span className="material-symbols-outlined text-[16px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                {isProfileOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
              </span>
            </button>

            {isProfileOpen && (
              <div
                className="absolute right-0 mt-2 w-64 border rounded-2xl shadow-2xl z-50 overflow-hidden"
                style={{
                  backgroundColor: "var(--color-admin-surface-container-highest)",
                  borderColor: "var(--color-admin-outline-variant)",
                }}
              >
                <div
                  className="p-4 border-b"
                  style={{
                    borderColor: "var(--color-admin-outline-variant)",
                    backgroundColor: "var(--color-admin-surface-container-high)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base"
                      style={{
                        backgroundColor: "var(--color-admin-primary-container)",
                        color: "var(--color-admin-on-primary-container)",
                      }}
                    >
                      {adminInitials}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--color-admin-on-surface)" }}>
                        {adminName}
                      </p>
                      <p className="text-xs truncate max-w-[160px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                        {adminEmail}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  <Link
                    href="/admin/change-password"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                    style={{ color: "var(--color-admin-on-surface)" }}
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ color: "var(--color-admin-primary)" }}>
                      lock_reset
                    </span>
                    Change Password
                  </Link>
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 mt-1 disabled:opacity-60"
                    style={{ color: "#ef4444" }}
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    {loggingOut ? "Signing Out…" : "Sign Out"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="ml-64 pt-24 pb-12 px-8 min-h-screen transition-colors duration-500 w-[calc(100%-16rem)]">
        <div className="max-w-4xl mx-auto">
          {/* Status Message */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-xl border text-sm font-medium flex items-center gap-3 ${
                message.type === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}
            >
              <span className="material-symbols-outlined">
                {message.type === "success" ? "check_circle" : "error"}
              </span>
              <span>{message.text}</span>
            </div>
          )}

          {/* Profile Overview Bento Card */}
          <div
            className="border p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6"
            style={{
              backgroundColor: "var(--color-admin-surface-container)",
              borderColor: "var(--color-admin-outline-variant)",
            }}
          >
            <div className="flex flex-col md:flex-row items-center gap-5">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-3xl shadow-lg"
                style={{
                  backgroundColor: "var(--color-admin-primary-container)",
                  color: "var(--color-admin-primary)",
                  border: "2px solid var(--color-admin-outline-variant)",
                }}
              >
                {adminInitials}
              </div>
              <div className="text-center md:text-left">
                <h2 className="text-xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>
                  {adminName}
                </h2>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                  <span
                    className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: "var(--color-admin-primary-container)",
                      color: "var(--color-admin-primary)",
                    }}
                  >
                    {adminRole}
                  </span>
                  <span className="text-xs opacity-60" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                    • Active System Operator
                  </span>
                </div>
              </div>
            </div>
            {createdAt && (
              <div className="text-center md:text-right border-t md:border-t-0 pt-4 md:pt-0 w-full md:w-auto">
                <p className="text-xs opacity-60" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                  Registered Since
                </p>
                <p className="text-sm font-semibold mt-0.5">{createdAt}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Form Section */}
            <div className="md:col-span-2 space-y-6">
              <div
                className="border p-6 rounded-2xl"
                style={{
                  backgroundColor: "var(--color-admin-surface-container)",
                  borderColor: "var(--color-admin-outline-variant)",
                }}
              >
                <h3 className="text-sm font-bold uppercase tracking-wider mb-6" style={{ color: "var(--color-admin-primary)" }}>
                  Update Personal Information
                </h3>
                <form onSubmit={handleUpdateName} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-2 opacity-80">Full Display Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. Admin Root"
                      required
                      className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-opacity-40"
                      style={{
                        backgroundColor: "var(--color-admin-surface-container-lowest)",
                        borderColor: "var(--color-admin-outline-variant)",
                        color: "var(--color-admin-on-surface)",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2 opacity-80">Account Email (Read-only)</label>
                    <input
                      type="email"
                      value={adminEmail}
                      disabled
                      className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none opacity-60 cursor-not-allowed"
                      style={{
                        backgroundColor: "var(--color-admin-surface-container-lowest)",
                        borderColor: "var(--color-admin-outline-variant)",
                        color: "var(--color-admin-on-surface)",
                      }}
                    />
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110 active:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: "var(--color-admin-primary)",
                        color: "var(--color-admin-surface, #0b1326)",
                      }}
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div>
                          Saving Changes...
                        </>
                      ) : (
                        "Save Profile"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Quick Actions / Role constraints info */}
            <div className="space-y-6">
              <div
                className="border p-6 rounded-2xl"
                style={{
                  backgroundColor: "var(--color-admin-surface-container)",
                  borderColor: "var(--color-admin-outline-variant)",
                }}
              >
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--color-admin-primary)" }}>
                  Security Settings
                </h3>
                <p className="text-xs opacity-75 leading-relaxed mb-6" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                  Update your authentication credentials regular to prevent unauthorized workspace access.
                </p>
                <Link
                  href="/admin/change-password"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{
                    color: "var(--color-admin-on-surface)",
                    borderColor: "var(--color-admin-outline-variant)",
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                  Change Password
                </Link>
              </div>

              <div
                className="border p-6 rounded-2xl"
                style={{
                  backgroundColor: "var(--color-admin-surface-container-low)",
                  borderColor: "var(--color-admin-outline-variant)",
                }}
              >
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3 opacity-60">Role Permissions</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs border-b pb-1.5" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                    <span className="opacity-70">User Edit:</span>
                    <span className="font-bold text-emerald-400">Allowed</span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-b pb-1.5" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                    <span className="opacity-70">Tax Override:</span>
                    <span className="font-bold text-emerald-400">Allowed</span>
                  </div>
                  <div className="flex items-center justify-between text-xs" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                    <span className="opacity-70">Billing Action:</span>
                    <span className="font-bold text-emerald-400">Allowed</span>
                  </div>
                </div>
              </div>
          </div>
        </div>

          {/* Membership Plans Section */}
          <div
            className="border p-6 rounded-2xl mt-8"
            style={{
              backgroundColor: "var(--color-admin-surface-container)",
              borderColor: "var(--color-admin-outline-variant)",
            }}
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-bold uppercase tracking-wider" style={{ color: "var(--color-admin-primary)" }}>
                  Membership Plans &amp; Pricing
                </h3>
                <p className="text-xs opacity-75 mt-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                  Configure Pro subscription pricing, durations, descriptions, and points redemption packages.
                </p>
              </div>
              <button
                onClick={() => setCreatingPlan(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110 active:opacity-90"
                style={{
                  backgroundColor: "var(--color-admin-primary)",
                  color: "var(--color-admin-surface, #0b1326)",
                }}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                New Plan
              </button>
            </div>

            {loadingPlans ? (
              <div className="py-8 text-center text-sm opacity-60">Loading plans...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                      <th className="py-3 px-2 opacity-60">Plan ID</th>
                      <th className="py-3 px-2 opacity-60">Plan Name</th>
                      <th className="py-3 px-2 opacity-60">Duration</th>
                      <th className="py-3 px-2 opacity-60 text-right">Price (INR)</th>
                      <th className="py-3 px-2 opacity-60 text-right">Points Swap</th>
                      <th className="py-3 px-2 opacity-60 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        style={{ borderColor: "var(--color-admin-outline-variant)" }}
                      >
                        <td className="py-3.5 px-2 font-mono">{p.planId}</td>
                        <td className="py-3.5 px-2 font-bold">{p.name}</td>
                        <td className="py-3.5 px-2 font-semibold">
                          {p.durationMonths} {p.durationMonths === 1 ? "Month" : "Months"}
                        </td>
                        <td className="py-3.5 px-2 font-mono font-bold text-right text-emerald-400">
                          ₹{p.priceINR.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-2 font-mono text-right">{p.pointsExchange} pts</td>
                        <td className="py-3.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setEditingPlan({ ...p })}
                              className="px-3 py-1 rounded-lg text-xs font-bold transition-all hover:brightness-110 flex items-center gap-1"
                              style={{
                                backgroundColor: "var(--color-admin-primary-container)",
                                color: "var(--color-admin-primary)",
                              }}
                            >
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePlan(p.planId, p.name)}
                              disabled={deletingPlanId === p.planId}
                              className="px-3 py-1 rounded-lg text-xs font-bold transition-all hover:brightness-110 flex items-center gap-1 disabled:opacity-50"
                              style={{
                                backgroundColor: "rgba(239,68,68,0.12)",
                                color: "#f87171",
                              }}
                            >
                              {deletingPlanId === p.planId
                                ? <div className="w-3.5 h-3.5 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div>
                                : <span className="material-symbols-outlined text-[14px]">delete</span>
                              }
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Create Plan Modal */}
          {creatingPlan && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setCreatingPlan(false)}
            >
              <div
                className="border p-8 rounded-2xl max-w-3xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
                style={{
                  backgroundColor: "var(--color-admin-surface-container-high)",
                  borderColor: "var(--color-admin-primary)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                    <span className="material-symbols-outlined">add_circle</span>
                    Create New Membership Plan
                  </h3>
                  <button
                    type="button"
                    onClick={() => setCreatingPlan(false)}
                    className="material-symbols-outlined opacity-70 hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/5"
                    style={{ color: "var(--color-admin-on-surface)" }}
                  >
                    close
                  </button>
                </div>
                <form onSubmit={handleCreatePlan} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-2 opacity-80">Plan ID <span className="text-rose-400">*</span></label>
                      <input
                        type="text"
                        placeholder="e.g. premium_2m"
                        value={newPlan.planId}
                        onChange={(e) => setNewPlan({ ...newPlan, planId: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                        required
                        className="w-full px-4 py-3 rounded-xl border text-sm font-mono outline-none"
                        style={{
                          backgroundColor: "var(--color-admin-surface-container-lowest)",
                          borderColor: "var(--color-admin-outline-variant)",
                          color: "var(--color-admin-on-surface)",
                        }}
                      />
                      <p className="text-[10px] opacity-50 mt-1">Unique identifier, lowercase with underscores</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 opacity-80">Display Name <span className="text-rose-400">*</span></label>
                      <input
                        type="text"
                        placeholder="e.g. 2 Month Pro"
                        value={newPlan.name}
                        onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                        required
                        className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none"
                        style={{
                          backgroundColor: "var(--color-admin-surface-container-lowest)",
                          borderColor: "var(--color-admin-outline-variant)",
                          color: "var(--color-admin-on-surface)",
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-2 opacity-80">Duration (Months) <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        placeholder="e.g. 2"
                        value={newPlan.durationMonths}
                        onChange={(e) => setNewPlan({ ...newPlan, durationMonths: e.target.value })}
                        required
                        min={1}
                        className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none"
                        style={{
                          backgroundColor: "var(--color-admin-surface-container-lowest)",
                          borderColor: "var(--color-admin-outline-variant)",
                          color: "var(--color-admin-on-surface)",
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 opacity-80">Price (INR ₹) <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        placeholder="e.g. 450"
                        value={newPlan.priceINR}
                        onChange={(e) => setNewPlan({ ...newPlan, priceINR: e.target.value })}
                        required
                        min={0}
                        className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none"
                        style={{
                          backgroundColor: "var(--color-admin-surface-container-lowest)",
                          borderColor: "var(--color-admin-outline-variant)",
                          color: "var(--color-admin-on-surface)",
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 opacity-80">Points Exchange <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        placeholder="e.g. 350"
                        value={newPlan.pointsExchange}
                        onChange={(e) => setNewPlan({ ...newPlan, pointsExchange: e.target.value })}
                        required
                        min={0}
                        className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none"
                        style={{
                          backgroundColor: "var(--color-admin-surface-container-lowest)",
                          borderColor: "var(--color-admin-outline-variant)",
                          color: "var(--color-admin-on-surface)",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-2 opacity-80">Description / Tagline</label>
                    <input
                      type="text"
                      placeholder="e.g. Best for short-term projects"
                      value={newPlan.description}
                      onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none"
                      style={{
                        backgroundColor: "var(--color-admin-surface-container-lowest)",
                        borderColor: "var(--color-admin-outline-variant)",
                        color: "var(--color-admin-on-surface)",
                      }}
                    />
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button
                      type="submit"
                      disabled={createPlanLoading}
                      className="px-6 py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110 active:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: "var(--color-admin-primary)",
                        color: "var(--color-admin-surface, #0b1326)",
                      }}
                    >
                      {createPlanLoading ? (
                        <>
                          <div className="w-4 h-4 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">add_circle</span>
                          Create Plan
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatingPlan(false)}
                      className="px-6 py-3 rounded-xl font-bold text-sm border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      style={{
                        color: "var(--color-admin-on-surface)",
                        borderColor: "var(--color-admin-outline-variant)",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Plan Modal (Pop Window) */}
          {editingPlan && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setEditingPlan(null)}
            >
              <div
                className="border p-8 rounded-2xl max-w-3xl w-full shadow-2xl transition-all duration-300 relative max-h-[90vh] overflow-y-auto custom-scroll"
                style={{
                  backgroundColor: "var(--color-admin-surface-container-high)",
                  borderColor: "var(--color-admin-primary)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--color-admin-primary)" }}>
                    <span className="material-symbols-outlined">edit_note</span>
                    Edit Membership Plan: {editingPlan.planId}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="material-symbols-outlined opacity-70 hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/5"
                    style={{ color: "var(--color-admin-on-surface)" }}
                  >
                    close
                  </button>
                </div>
                <form onSubmit={handleUpdatePlan} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-2 opacity-80">Display Name</label>
                    <input
                      type="text"
                      value={editingPlan.name || ""}
                      onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                      required
                      className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none"
                      style={{
                        backgroundColor: "var(--color-admin-surface-container-lowest)",
                        borderColor: "var(--color-admin-outline-variant)",
                        color: "var(--color-admin-on-surface)",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2 opacity-80">Duration (Months)</label>
                    <input
                      type="number"
                      value={editingPlan.durationMonths === undefined || isNaN(editingPlan.durationMonths) ? "" : editingPlan.durationMonths}
                      onChange={(e) => setEditingPlan({ ...editingPlan, durationMonths: parseInt(e.target.value, 10) })}
                      required
                      min={1}
                      className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none"
                      style={{
                        backgroundColor: "var(--color-admin-surface-container-lowest)",
                        borderColor: "var(--color-admin-outline-variant)",
                        color: "var(--color-admin-on-surface)",
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-2 opacity-80">Price (INR, ₹)</label>
                    <input
                      type="number"
                      value={editingPlan.priceINR === undefined || isNaN(editingPlan.priceINR) ? "" : editingPlan.priceINR}
                      onChange={(e) => setEditingPlan({ ...editingPlan, priceINR: parseFloat(e.target.value) })}
                      required
                      min={0}
                      className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none"
                      style={{
                        backgroundColor: "var(--color-admin-surface-container-lowest)",
                        borderColor: "var(--color-admin-outline-variant)",
                        color: "var(--color-admin-on-surface)",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2 opacity-80">Points Exchange Required</label>
                    <input
                      type="number"
                      value={editingPlan.pointsExchange === undefined || isNaN(editingPlan.pointsExchange) ? "" : editingPlan.pointsExchange}
                      onChange={(e) => setEditingPlan({ ...editingPlan, pointsExchange: parseInt(e.target.value, 10) })}
                      required
                      min={0}
                      className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none"
                      style={{
                        backgroundColor: "var(--color-admin-surface-container-lowest)",
                        borderColor: "var(--color-admin-outline-variant)",
                        color: "var(--color-admin-on-surface)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-2 opacity-80">Plan Description / Tagline</label>
                  <input
                    type="text"
                    value={editingPlan.description || ""}
                    onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none"
                    style={{
                      backgroundColor: "var(--color-admin-surface-container-lowest)",
                      borderColor: "var(--color-admin-outline-variant)",
                      color: "var(--color-admin-on-surface)",
                    }}
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={savePlanLoading}
                    className="px-6 py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110 active:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: "var(--color-admin-primary)",
                      color: "var(--color-admin-surface, #0b1326)",
                    }}
                  >
                    {savePlanLoading ? (
                      <>
                        <div className="w-4 h-4 rounded-full border border-current border-t-transparent animate-spin shrink-0"></div>
                        Saving Plan...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="px-6 py-3 rounded-xl font-bold text-sm border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{
                      color: "var(--color-admin-on-surface)",
                      borderColor: "var(--color-admin-outline-variant)",
                    }}
                  >
                    Cancel
                  </button>
                </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
