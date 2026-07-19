"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import AdminSidebar from "@/components/AdminSidebar";
import { Theme, themes, getAccentColor } from "@/components/AdminThemeStyles";
import { useAdminTheme } from '@/contexts/AdminThemeContext';

interface BackupResult {
  collectionsExported: number;
  totalRecords: number;
  totalFiles: number;
  totalSize: number;
  filename: string;
  backupId: string;
}

interface RestoreResult {
  collectionsRestored: number;
  recordsImported: number;
  filesRestored: number;
  errors: { collection: string; message: string }[];
  mode: string;
}

interface ScheduleConfig {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  includeFiles: boolean;
  retentionDays: number;
}

interface GDriveEntry {
  id: string;
  filename: string;
  size: number;
  createdTime: string;
  webViewLink?: string;
}

const PROGRESS_PHASES = [
  "Initializing backup...",
  "Exporting collections...",
  "Backing up records...",
  "Downloading files...",
  "Packaging ZIP...",
  "Finalizing backup...",
];

const RESTORE_PHASES = [
  "Uploading backup file...",
  "Validating archive...",
  "Restoring collections...",
  "Importing records...",
  "Restoring files...",
  "Finalizing restore...",
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminBackupPage() {
  const [mounted, setMounted] = useState(false);
  const { currentTheme, isDarkMode, setTheme: setCurrentTheme, setDarkMode: setIsDarkMode } = useAdminTheme();
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState("admin@latexify.io");
  const [adminName, setAdminName] = useState("Admin Root");
  const [loggingOut, setLoggingOut] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.admin) {
          setAdminEmail(data.admin.email);
          setAdminName(data.admin.name || "Admin Root");
        }
      })
      .catch(() => {});
  }, []);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setIsProfileOpen(false);
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) setIsThemeOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      localStorage.removeItem("latexify-admin-email");
      localStorage.removeItem("latexify-admin-name");
    } catch {}
    window.location.href = "/admin/login";
  };

  const [collectionCount, setCollectionCount] = useState(0);
  const [loadingCollections, setLoadingCollections] = useState(true);

  const [backupRunning, setBackupRunning] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupPhase, setBackupPhase] = useState("");
  const [backupCancelled, setBackupCancelled] = useState(false);
  const backupAbortRef = useRef<AbortController | null>(null);

  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [backupBlobUrl, setBackupBlobUrl] = useState<string | null>(null);

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace" | "skip">("merge");
  const [restoreRunning, setRestoreRunning] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restorePhase, setRestorePhase] = useState("");
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [showRestoreResult, setShowRestoreResult] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [schedule, setSchedule] = useState<ScheduleConfig>({
    enabled: false,
    frequency: "daily",
    time: "02:00",
    includeFiles: true,
    retentionDays: 30,
  });
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  const [gdriveEnabled, setGdriveEnabled] = useState(false);
  const [gdriveCreds, setGdriveCreds] = useState("");
  const [gdriveFolderId, setGdriveFolderId] = useState("");
  const [gdriveShowCreds, setGdriveShowCreds] = useState(false);
  const [gdriveTesting, setGdriveTesting] = useState(false);
  const [gdriveTestResult, setGdriveTestResult] = useState<"success" | "error" | null>(null);
  const [gdriveTestMessage, setGdriveTestMessage] = useState("");
  const [gdriveSaving, setGdriveSaving] = useState(false);
  const [gdriveSaved, setGdriveSaved] = useState(false);
  const [gdriveHistory, setGdriveHistory] = useState<GDriveEntry[]>([]);
  const [gdriveLoadingHistory, setGdriveLoadingHistory] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    fetch("/api/admin/backup?includeFiles=true&countOnly=true", { method: "HEAD" })
      .catch(() => {});
    fetch("/api/admin/backup?section=collections")
      .then((r) => r.json())
      .then((d) => { if (d.success) setCollectionCount(d.total || d.collections?.length || 76); })
      .catch(() => setCollectionCount(76))
      .finally(() => setLoadingCollections(false));

    fetch("/api/admin/backup/schedule")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.schedule) setSchedule(d.schedule);
      })
      .catch(() => {})
      .finally(() => setScheduleLoading(false));

    fetch("/api/admin/backup/gdrive")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setGdriveEnabled(d.enabled || false);
          setGdriveCreds(d.credentials || "");
          setGdriveFolderId(d.folderId || "");
          if (d.history) setGdriveHistory(d.history);
        }
      })
      .catch(() => {});
  }, [mounted]);

  const fetchGDriveHistory = useCallback(async () => {
    setGdriveLoadingHistory(true);
    try {
      const res = await fetch("/api/admin/backup/gdrive/history");
      const d = await res.json();
      if (d.success && d.backups) setGdriveHistory(d.backups);
    } catch {}
    setGdriveLoadingHistory(false);
  }, []);

  useEffect(() => {
    if (gdriveEnabled && mounted) fetchGDriveHistory();
  }, [gdriveEnabled, mounted, fetchGDriveHistory]);

  const handleBackup = async () => {
    setBackupRunning(true);
    setBackupProgress(0);
    setBackupPhase(PROGRESS_PHASES[0]);
    setBackupCancelled(false);
    setBackupResult(null);
    setBackupBlobUrl(null);
    backupAbortRef.current = new AbortController();

    let progressInterval: NodeJS.Timeout | undefined;
    let phaseIdx = 0;

    try {
      progressInterval = setInterval(() => {
        phaseIdx = Math.min(phaseIdx + 1, PROGRESS_PHASES.length - 1);
        setBackupPhase(PROGRESS_PHASES[phaseIdx]);
        setBackupProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 12;
        });
      }, 1800);

      const res = await fetch("/api/admin/backup?includeFiles=true", {
        signal: backupAbortRef.current.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        let errMsg = "Backup failed";
        try { errMsg = JSON.parse(text).error || errMsg; } catch { errMsg = text.slice(0, 200) || errMsg; }
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setBackupProgress(100);
      setBackupPhase("Backup complete!");
      if (progressInterval) clearInterval(progressInterval);

      const filename = `latexify-backup-${Date.now()}.zip`;
      setBackupBlobUrl(url);

      setBackupResult({
        collectionsExported: collectionCount || 76,
        totalRecords: 0,
        totalFiles: 0,
        totalSize: blob.size,
        filename,
        backupId: `bk_${Date.now()}`,
      });
      setShowResultModal(true);
    } catch (err: any) {
      if (err.name === "AbortError") {
        setBackupPhase("Backup cancelled.");
      } else {
        setBackupPhase("Backup failed: " + (err.message || "Unknown error"));
        setRestoreError(err.message);
      }
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setTimeout(() => setBackupRunning(false), 500);
    }
  };

  const handleCancelBackup = () => {
    setBackupCancelled(true);
    backupAbortRef.current?.abort();
  };

  const handleDownloadBackup = () => {
    if (!backupBlobUrl) return;
    const a = document.createElement("a");
    a.href = backupBlobUrl;
    a.download = backupResult?.filename || "latexify-backup.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoreRunning(true);
    setRestoreProgress(0);
    setRestorePhase(RESTORE_PHASES[0]);
    setRestoreResult(null);
    setRestoreError(null);
    setShowRestoreResult(false);

    let progressInterval: NodeJS.Timeout | undefined;
    let phaseIdx = 0;

    try {
      progressInterval = setInterval(() => {
        phaseIdx = Math.min(phaseIdx + 1, RESTORE_PHASES.length - 1);
        setRestorePhase(RESTORE_PHASES[phaseIdx]);
        setRestoreProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 1500);

      const formData = new FormData();
      formData.append("file", restoreFile);
      formData.append("mode", restoreMode);

      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (progressInterval) clearInterval(progressInterval);

      setRestoreProgress(100);
      setRestorePhase("Restore complete!");

      if (data.success) {
        setRestoreResult(data.result || {
          collectionsRestored: data.collectionsRestored || 0,
          recordsImported: data.recordsImported || 0,
          filesRestored: data.filesRestored || 0,
          errors: data.errors || [],
          mode: restoreMode,
        });
        setShowRestoreResult(true);
      } else {
        setRestoreError(data.error || "Restore failed");
      }
    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval);
      setRestoreError(err.message || "Restore failed");
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setTimeout(() => setRestoreRunning(false), 500);
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".zip")) {
      setRestoreFile(file);
    }
  }, []);

  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    setScheduleSaved(false);
    try {
      const res = await fetch("/api/admin/backup/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      const d = await res.json();
      if (d.success) setScheduleSaved(true);
    } catch {}
    setScheduleSaving(false);
    setTimeout(() => setScheduleSaved(false), 2500);
  };

  const handleTestGDrive = async () => {
    setGdriveTesting(true);
    setGdriveTestResult(null);
    setGdriveTestMessage("");
    try {
      const res = await fetch("/api/admin/backup/gdrive/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials: gdriveCreds, folderId: gdriveFolderId }),
      });
      const d = await res.json();
      if (d.success) {
        setGdriveTestResult("success");
        setGdriveTestMessage(d.message || "Connection successful!");
      } else {
        setGdriveTestResult("error");
        setGdriveTestMessage(d.error || "Connection failed");
      }
    } catch (err: any) {
      setGdriveTestResult("error");
      setGdriveTestMessage(err.message || "Connection failed");
    }
    setGdriveTesting(false);
  };

  const handleSaveGDrive = async () => {
    setGdriveSaving(true);
    setGdriveSaved(false);
    try {
      const res = await fetch("/api/admin/backup/gdrive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: gdriveEnabled, credentials: gdriveCreds, folderId: gdriveFolderId }),
      });
      const d = await res.json();
      if (d.success) setGdriveSaved(true);
    } catch {}
    setGdriveSaving(false);
    setTimeout(() => setGdriveSaved(false), 2500);
  };

  const handleGDriveDownload = async (entry: GDriveEntry) => {
    window.open(`/api/admin/backup/gdrive/download?id=${entry.id}`, "_blank");
  };

  const handleGDriveRestore = async (entry: GDriveEntry) => {
    setRestoreRunning(true);
    setRestoreProgress(0);
    setRestorePhase(RESTORE_PHASES[0]);
    setRestoreResult(null);
    setRestoreError(null);
    setShowRestoreResult(false);

    let progressInterval: NodeJS.Timeout | undefined;
    let phaseIdx = 0;

    try {
      progressInterval = setInterval(() => {
        phaseIdx = Math.min(phaseIdx + 1, RESTORE_PHASES.length - 1);
        setRestorePhase(RESTORE_PHASES[phaseIdx]);
        setRestoreProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 1500);

      const res = await fetch("/api/admin/backup/gdrive/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: entry.id, mode: restoreMode }),
      });

      const data = await res.json();

      if (progressInterval) clearInterval(progressInterval);
      setRestoreProgress(100);
      setRestorePhase("Restore complete!");

      if (data.success) {
        setRestoreResult(data.result || {
          collectionsRestored: data.collectionsRestored || 0,
          recordsImported: data.recordsImported || 0,
          filesRestored: data.filesRestored || 0,
          errors: data.errors || [],
          mode: restoreMode,
        });
        setShowRestoreResult(true);
      } else {
        setRestoreError(data.error || "Restore failed");
      }
    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval);
      setRestoreError(err.message || "Restore failed");
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setTimeout(() => setRestoreRunning(false), 500);
    }
  };

  const getNextBackupDisplay = (): string => {
    if (!schedule.enabled) return "Scheduling disabled";
    const now = new Date();
    const [h, m] = schedule.time.split(":").map(Number);
    const next = new Date(now);
    next.setHours(h, m, 0, 0);
    if (next <= now) {
      if (schedule.frequency === "daily") next.setDate(next.getDate() + 1);
      else if (schedule.frequency === "weekly") next.setDate(next.getDate() + 7);
      else next.setMonth(next.getMonth() + 1);
    }
    return next.toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isAnyModalOpen = backupRunning || restoreRunning || showResultModal || showRestoreResult;

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white relative overflow-hidden select-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
        <div className="z-10 flex flex-col items-center max-w-sm w-full px-6 text-center">
          <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
            <motion.div className="absolute inset-0 rounded-3xl border-2 border-transparent border-t-indigo-500 border-r-purple-500" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} />
            <div className="relative w-14 h-14 bg-slate-900 shadow-md rounded-2xl flex items-center justify-center p-2 border border-white/5">
              <Image src="/logo.png" alt="Latexify Logo" width={40} height={40} className="object-contain" priority />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-white font-[family-name:var(--font-outfit)] mb-2 uppercase">Backup & Restore</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-6">Initializing backup system</p>
          <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
            <motion.div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full absolute top-0" initial={{ width: "30%", left: "-30%" }} animate={{ left: ["-30%", "100%"] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans overflow-x-hidden transition-colors duration-500" style={{ backgroundColor: "var(--color-admin-background)", color: "var(--color-admin-on-background)" }}>
      <AdminSidebar isDarkMode={isDarkMode} adminName={adminName} />

      <header className="flex justify-between items-center fixed top-0 left-64 right-0 2xl:right-80 px-6 py-4 border-b z-40 transition-colors duration-500" style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)" }}>
        <div className="flex items-center gap-4 flex-1">
          <span className="material-symbols-outlined" style={{ color: "var(--color-admin-primary)" }}>cloud_download</span>
          <h2 className="text-lg font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Backup & Restore</h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative" ref={themeRef}>
            <button onClick={() => setIsThemeOpen(!isThemeOpen)} className="material-symbols-outlined transition-colors p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-500" style={{ color: "var(--color-admin-on-surface-variant)" }} title="Theme Settings">
              palette
            </button>
            <div className={`absolute right-0 mt-2 w-56 border rounded-xl shadow-xl z-50 overflow-hidden ${isThemeOpen ? "block" : "hidden"}`} style={{ backgroundColor: "var(--color-admin-surface-container-highest)", borderColor: "var(--color-admin-outline-variant)" }}>
              <div className="p-3 border-b" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-admin-on-surface)" }}>Accent Color</p>
              </div>
              <div className="p-1 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {(Object.keys(themes) as Theme[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setCurrentTheme(t); setIsThemeOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all group/item hover:bg-opacity-20 hover:bg-gray-500"
                  >
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: themes[t].primary }}></span>
                    <span className="text-sm font-medium capitalize" style={{ color: "var(--color-admin-on-surface)" }}>{t} {t === "indigo" ? "(Default)" : ""}</span>
                    {currentTheme === t && <span className="material-symbols-outlined text-[16px] ml-auto" style={{ color: "var(--color-admin-primary)" }}>check</span>}
                  </button>
                ))}
              </div>
              <div className="p-3 border-t" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Dark Mode</span>
                  <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-5 rounded-full relative transition-colors" style={{ backgroundColor: "var(--color-admin-primary)" }}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow-sm transition-all ${isDarkMode ? "right-0.5" : "left-0.5"}`} style={{ backgroundColor: "var(--color-admin-on-primary)" }}></div>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div ref={profileRef} className="relative pl-4 border-l" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
            <button
              id="admin-profile-btn"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
              style={{ backgroundColor: "var(--color-admin-surface-container-high)" }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)" }}>
                {adminName.split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase() || "AR"}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold" style={{ color: "var(--color-admin-on-surface)" }}>{adminName}</p>
                <p className="text-[10px] truncate max-w-[120px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>{adminEmail}</p>
              </div>
              <span className="material-symbols-outlined text-[16px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                {isProfileOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
              </span>
            </button>
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 border rounded-2xl shadow-2xl z-50 overflow-hidden" style={{ backgroundColor: "var(--color-admin-surface-container-highest)", borderColor: "var(--color-admin-outline-variant)" }}>
                <div className="p-4 border-b" style={{ borderColor: "var(--color-admin-outline-variant)", backgroundColor: "var(--color-admin-surface-container-high)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base" style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)" }}>
                      {adminName.split(/\s+/).map(n => n[0]).join("").slice(0, 2).toUpperCase() || "AR"}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--color-admin-on-surface)" }}>{adminName}</p>
                      <p className="text-xs truncate max-w-[160px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>{adminEmail}</p>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <Link href="/admin/change-password" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80" style={{ color: "var(--color-admin-on-surface)" }}>
                    <span className="material-symbols-outlined text-[20px]" style={{ color: "var(--color-admin-primary)" }}>lock_reset</span>
                    Change Password
                  </Link>
                  <button id="admin-logout-btn" onClick={handleLogout} disabled={loggingOut} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 mt-1 disabled:opacity-60" style={{ color: "#ef4444" }}>
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    {loggingOut ? "Signing Out\u2026" : "Sign Out"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="ml-0 lg:ml-64 2xl:mr-80 pt-24 pb-12 px-4 sm:px-8 min-h-screen transition-colors duration-500">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Backup & Restore</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Full system backup, restore, and automated scheduling</p>
        </div>

        {restoreError && !restoreRunning && (
          <div className="mb-6 p-4 rounded-xl border text-sm font-medium flex items-center gap-3" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.25)", color: "#ef4444" }}>
            <span className="material-symbols-outlined">error</span>
            <span>{restoreError}</span>
            <button onClick={() => setRestoreError(null)} className="ml-auto underline">Dismiss</button>
          </div>
        )}

        {/* ── Section 1: Quick Actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border p-6 relative overflow-hidden"
            style={{
              backgroundColor: "var(--color-admin-surface-container)",
              borderColor: "var(--color-admin-outline-variant)",
            }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ backgroundColor: "var(--color-admin-primary)", transform: "translate(30%, -30%)" }} />
            <div className="flex items-start justify-between mb-6 relative z-10">
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Create Full Backup</h3>
                <p className="text-sm mt-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Export all data as a ZIP archive</p>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "var(--color-admin-primary-container)" }}>
                <span className="material-symbols-outlined text-[28px]" style={{ color: "var(--color-admin-on-primary-container)" }}>cloud_download</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-6 relative z-10">
              <span className="material-symbols-outlined text-[18px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>database</span>
              <span className="text-sm" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                {loadingCollections ? (
                  <span className="inline-block w-8 h-4 rounded animate-pulse" style={{ backgroundColor: "var(--color-admin-outline-variant)" }} />
                ) : (
                  <>{collectionCount} collections ready</>
                )}
              </span>
            </div>
            <button
              onClick={handleBackup}
              disabled={backupRunning || restoreRunning}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
              style={{
                backgroundColor: "var(--color-admin-primary)",
                color: "var(--color-admin-on-primary)",
              }}
            >
              <span className="material-symbols-outlined text-[18px] align-middle mr-2">cloud_download</span>
              {backupRunning ? "Backup in Progress..." : "Start Backup"}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border p-6 relative overflow-hidden"
            style={{
              backgroundColor: "var(--color-admin-surface-container)",
              borderColor: "var(--color-admin-outline-variant)",
            }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ backgroundColor: "var(--color-admin-primary)", transform: "translate(30%, -30%)" }} />
            <div className="flex items-start justify-between mb-6 relative z-10">
              <div>
                <h3 className="text-lg font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Restore from Backup</h3>
                <p className="text-sm mt-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Import data from a backup ZIP file</p>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "var(--color-admin-primary-container)" }}>
                <span className="material-symbols-outlined text-[28px]" style={{ color: "var(--color-admin-on-primary-container)" }}>cloud_upload</span>
              </div>
            </div>

            <div
              ref={dropZoneRef}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              className={`relative z-10 border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer mb-4 ${isDragging ? "scale-[1.02]" : ""}`}
              style={{
                borderColor: isDragging ? "var(--color-admin-primary)" : "var(--color-admin-outline-variant)",
                backgroundColor: isDragging ? "var(--color-admin-primary-container)" : "transparent",
              }}
              onClick={() => document.getElementById("restore-file-input")?.click()}
            >
              <input
                id="restore-file-input"
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setRestoreFile(f);
                }}
              />
              {restoreFile ? (
                <div className="flex items-center justify-center gap-3">
                  <span className="material-symbols-outlined text-[24px]" style={{ color: "var(--color-admin-primary)" }}>folder_zip</span>
                  <div className="text-left">
                    <p className="text-sm font-bold" style={{ color: "var(--color-admin-on-surface)" }}>{restoreFile.name}</p>
                    <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>{formatFileSize(restoreFile.size)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRestoreFile(null); }}
                    className="ml-2 p-1 rounded-full hover:opacity-70"
                    style={{ color: "var(--color-admin-on-surface-variant)" }}
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[32px] mb-2 block" style={{ color: "var(--color-admin-on-surface-variant)" }}>upload_file</span>
                  <p className="text-sm font-medium" style={{ color: "var(--color-admin-on-surface)" }}>Drop ZIP file here or click to browse</p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Accepts .zip backup files</p>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4 relative z-10">
              <label className="text-sm font-medium" style={{ color: "var(--color-admin-on-surface-variant)" }}>Restore mode:</label>
              <select
                value={restoreMode}
                onChange={(e) => setRestoreMode(e.target.value as any)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none transition-all"
                style={{
                  backgroundColor: "var(--color-admin-surface-container-lowest)",
                  borderColor: "var(--color-admin-outline-variant)",
                  color: "var(--color-admin-on-surface)",
                }}
              >
                <option value="merge">Merge (upsert)</option>
                <option value="replace">Replace (full overwrite)</option>
                <option value="skip">Skip existing</option>
              </select>
            </div>

            <button
              onClick={handleRestore}
              disabled={!restoreFile || backupRunning || restoreRunning}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
              style={{
                backgroundColor: "var(--color-admin-primary)",
                color: "var(--color-admin-on-primary)",
              }}
            >
              <span className="material-symbols-outlined text-[18px] align-middle mr-2">cloud_upload</span>
              {restoreRunning ? "Restoring..." : "Start Restore"}
            </button>
          </motion.div>
        </div>

        {/* ── Section 4: Schedule Configuration ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-2xl border p-6 mb-8"
          style={{
            backgroundColor: "var(--color-admin-surface-container)",
            borderColor: "var(--color-admin-outline-variant)",
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-[24px]" style={{ color: "var(--color-admin-primary)" }}>schedule</span>
            <h3 className="text-lg font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Automated Schedule</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Enable auto-backup</p>
                  <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>Run backups automatically on schedule</p>
                </div>
                <button onClick={() => setSchedule((s) => ({ ...s, enabled: !s.enabled }))} className="w-11 h-6 rounded-full relative transition-colors" style={{ backgroundColor: schedule.enabled ? "var(--color-admin-primary)" : "var(--color-admin-outline-variant)" }}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-all ${schedule.enabled ? "right-0.5" : "left-0.5"}`} style={{ backgroundColor: schedule.enabled ? "var(--color-admin-on-primary)" : "var(--color-admin-on-surface-variant)" }} />
                </button>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--color-admin-on-surface-variant)" }}>Frequency</label>
                <select
                  value={schedule.frequency}
                  onChange={(e) => setSchedule((s) => ({ ...s, frequency: e.target.value as any }))}
                  disabled={!schedule.enabled}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-all disabled:opacity-40"
                  style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--color-admin-on-surface-variant)" }}>Time</label>
                <input
                  type="time"
                  value={schedule.time}
                  onChange={(e) => setSchedule((s) => ({ ...s, time: e.target.value }))}
                  disabled={!schedule.enabled}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-all disabled:opacity-40"
                  style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Include file attachments</p>
                  <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>Include uploaded files in backup</p>
                </div>
                <button onClick={() => setSchedule((s) => ({ ...s, includeFiles: !s.includeFiles }))} disabled={!schedule.enabled} className="w-11 h-6 rounded-full relative transition-colors disabled:opacity-40" style={{ backgroundColor: schedule.includeFiles && schedule.enabled ? "var(--color-admin-primary)" : "var(--color-admin-outline-variant)" }}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-all ${(schedule.includeFiles && schedule.enabled) ? "right-0.5" : "left-0.5"}`} style={{ backgroundColor: schedule.includeFiles && schedule.enabled ? "var(--color-admin-on-primary)" : "var(--color-admin-on-surface-variant)" }} />
                </button>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--color-admin-on-surface-variant)" }}>Retention (days)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={schedule.retentionDays}
                  onChange={(e) => setSchedule((s) => ({ ...s, retentionDays: parseInt(e.target.value) || 30 }))}
                  disabled={!schedule.enabled}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-all disabled:opacity-40"
                  style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                />
              </div>

              <div className="rounded-xl p-3" style={{ backgroundColor: "var(--color-admin-surface-container-low)" }}>
                <p className="text-xs font-medium" style={{ color: "var(--color-admin-on-surface-variant)" }}>Next backup</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: schedule.enabled ? "var(--color-admin-primary)" : "var(--color-admin-on-surface-variant)" }}>
                  <span className="material-symbols-outlined text-[16px] align-middle mr-1">event</span>
                  {getNextBackupDisplay()}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
            <button
              onClick={handleSaveSchedule}
              disabled={scheduleSaving || scheduleLoading}
              className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary)" }}
            >
              {scheduleSaving ? (
                <><span className="material-symbols-outlined text-[16px] align-middle mr-1 animate-spin">progress_activity</span> Saving...</>
              ) : scheduleSaved ? (
                <><span className="material-symbols-outlined text-[16px] align-middle mr-1">check_circle</span> Saved!</>
              ) : (
                <><span className="material-symbols-outlined text-[16px] align-middle mr-1">save</span> Save Schedule</>
              )}
            </button>
          </div>
        </motion.div>

        {/* ── Section 5: Google Drive Integration ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-2xl border p-6 mb-8"
          style={{
            backgroundColor: "var(--color-admin-surface-container)",
            borderColor: "var(--color-admin-outline-variant)",
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-[24px]" style={{ color: "var(--color-admin-primary)" }}>cloud_sync</span>
            <h3 className="text-lg font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Google Drive Integration</h3>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Enable Google Drive</p>
                <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>Automatically upload backups to Google Drive</p>
              </div>
              <button onClick={() => setGdriveEnabled((v) => !v)} className="w-11 h-6 rounded-full relative transition-colors" style={{ backgroundColor: gdriveEnabled ? "var(--color-admin-primary)" : "var(--color-admin-outline-variant)" }}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-all ${gdriveEnabled ? "right-0.5" : "left-0.5"}`} style={{ backgroundColor: gdriveEnabled ? "var(--color-admin-on-primary)" : "var(--color-admin-on-surface-variant)" }} />
              </button>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--color-admin-on-surface-variant)" }}>Service Account Credentials (JSON)</label>
              <div className="relative">
                <textarea
                  value={gdriveCreds}
                  onChange={(e) => setGdriveCreds(e.target.value)}
                  disabled={!gdriveEnabled}
                  placeholder={gdriveShowCreds ? '{"type":"service_account","project_id":"..."}' : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-all disabled:opacity-40 font-mono resize-none"
                  style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
                />
                <button
                  onClick={() => setGdriveShowCreds((v) => !v)}
                  disabled={!gdriveEnabled}
                  className="absolute top-2 right-2 p-1.5 rounded-lg hover:opacity-80 transition-opacity disabled:opacity-30"
                  style={{ color: "var(--color-admin-on-surface-variant)" }}
                  title={gdriveShowCreds ? "Hide" : "Show"}
                >
                  <span className="material-symbols-outlined text-[18px]">{gdriveShowCreds ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--color-admin-on-surface-variant)" }}>Drive Folder ID</label>
              <input
                type="text"
                value={gdriveFolderId}
                onChange={(e) => setGdriveFolderId(e.target.value)}
                disabled={!gdriveEnabled}
                placeholder="e.g. 1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-all disabled:opacity-40"
                style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleTestGDrive}
              disabled={!gdriveEnabled || !gdriveCreds || !gdriveFolderId || gdriveTesting}
              className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              style={{
                backgroundColor: "transparent",
                color: "var(--color-admin-primary)",
                border: `2px solid var(--color-admin-primary)`,
              }}
            >
              {gdriveTesting ? (
                <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Testing...</>
              ) : gdriveTestResult === "success" ? (
                <><span className="material-symbols-outlined text-[16px]">check_circle</span> Connected!</>
              ) : gdriveTestResult === "error" ? (
                <><span className="material-symbols-outlined text-[16px]">error</span> Failed</>
              ) : (
                <><span className="material-symbols-outlined text-[16px]">wifi_find</span> Test Connection</>
              )}
            </button>

            <button
              onClick={handleSaveGDrive}
              disabled={!gdriveEnabled || gdriveSaving}
              className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
              style={{ backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary)" }}
            >
              {gdriveSaving ? (
                <><span className="material-symbols-outlined text-[16px] align-middle mr-1 animate-spin">progress_activity</span> Saving...</>
              ) : gdriveSaved ? (
                <><span className="material-symbols-outlined text-[16px] align-middle mr-1">check_circle</span> Saved!</>
              ) : (
                <><span className="material-symbols-outlined text-[16px] align-middle mr-1">save</span> Save Configuration</>
              )}
            </button>
          </div>

          {gdriveTestMessage && gdriveTestResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 p-3 rounded-xl text-sm"
              style={{
                backgroundColor: gdriveTestResult === "success" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                border: `1px solid ${gdriveTestResult === "success" ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                color: gdriveTestResult === "success" ? "#22c55e" : "#ef4444",
              }}
            >
              <span className="material-symbols-outlined text-[16px] align-middle mr-1">{gdriveTestResult === "success" ? "check_circle" : "error"}</span>
              {gdriveTestMessage}
            </motion.div>
          )}
        </motion.div>

        {/* ── Section 6: Google Drive Backup History ── */}
        {gdriveEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="rounded-2xl border p-6 mb-8"
            style={{
              backgroundColor: "var(--color-admin-surface-container)",
              borderColor: "var(--color-admin-outline-variant)",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[24px]" style={{ color: "var(--color-admin-primary)" }}>history</span>
                <h3 className="text-lg font-bold" style={{ color: "var(--color-admin-on-surface)" }}>Drive Backup History</h3>
              </div>
              <button onClick={fetchGDriveHistory} disabled={gdriveLoadingHistory} className="p-2 rounded-lg hover:opacity-80 transition-opacity" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                <span className={`material-symbols-outlined text-[20px] ${gdriveLoadingHistory ? "animate-spin" : ""}`}>refresh</span>
              </button>
            </div>

            {gdriveLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <motion.div className="w-10 h-10 rounded-xl border-2 border-transparent" style={{ borderTopColor: "var(--color-admin-primary)", borderRightColor: "var(--color-admin-primary)" }} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} />
              </div>
            ) : gdriveHistory.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-[40px] block mb-2" style={{ color: "var(--color-admin-on-surface-variant)", opacity: 0.4 }}>cloud_off</span>
                <p className="text-sm" style={{ color: "var(--color-admin-on-surface-variant)" }}>No backups found on Google Drive</p>
              </div>
            ) : (
              <div className="space-y-2">
                {gdriveHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-xl border transition-all hover:scale-[1.005]"
                    style={{ borderColor: "var(--color-admin-outline-variant)", backgroundColor: "var(--color-admin-surface-container-low)" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="material-symbols-outlined text-[22px] shrink-0" style={{ color: "var(--color-admin-primary)" }}>folder_zip</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--color-admin-on-surface)" }}>{entry.filename}</p>
                        <p className="text-xs" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                          {formatDate(entry.createdTime)} &middot; {formatFileSize(entry.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleGDriveDownload(entry)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 flex items-center gap-1"
                        style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)" }}
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        Download
                      </button>
                      <button
                        onClick={() => handleGDriveRestore(entry)}
                        disabled={backupRunning || restoreRunning}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80 flex items-center gap-1 disabled:opacity-40"
                        style={{ backgroundColor: "var(--color-admin-secondary-container)", color: "var(--color-admin-on-secondary-container)" }}
                      >
                        <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* ── Section 2: Progress Modal (Backup & Restore) ── */}
      <AnimatePresence>
        {(backupRunning || restoreRunning) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(8px)" }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex flex-col items-center max-w-sm w-full px-6 text-center"
            >
              <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
                <motion.div
                  className="absolute inset-0 rounded-full border-[3px] border-transparent"
                  style={{ borderTopColor: "var(--color-admin-primary)", borderRightColor: "var(--color-admin-primary)" }}
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                />
                <motion.div
                  className="absolute inset-2 rounded-full border-[2px] border-transparent"
                  style={{ borderBottomColor: "#8b5cf6", borderLeftColor: "#8b5cf6" }}
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                />
                <motion.div
                  className="absolute inset-4 rounded-full"
                  style={{ background: "radial-gradient(circle, var(--color-admin-primary) 0%, transparent 70%)" }}
                  animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.1, 0.25, 0.1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                />
                <span className="material-symbols-outlined text-[36px] relative z-10" style={{ color: "var(--color-admin-primary)" }}>
                  {backupRunning ? "cloud_download" : "cloud_upload"}
                </span>
              </div>

              <h3 className="text-xl font-bold mb-2" style={{ color: "#ffffff" }}>
                {backupRunning ? "Creating Backup" : "Restoring Backup"}
              </h3>
              <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.6)" }}>{backupRunning ? backupPhase : restorePhase}</p>

              <div className="w-full max-w-xs h-2 bg-white/10 rounded-full overflow-hidden relative mb-3">
                <motion.div
                  className="h-full rounded-full absolute top-0 left-0"
                  style={{ background: `linear-gradient(90deg, var(--color-admin-primary), #8b5cf6)` }}
                  animate={{ width: `${backupRunning ? backupProgress : restoreProgress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>

              <div className="flex items-center gap-2 mb-6">
                {(backupRunning ? PROGRESS_PHASES : RESTORE_PHASES).map((_, i) => {
                  const currentIdx = backupRunning
                    ? PROGRESS_PHASES.indexOf(backupPhase)
                    : RESTORE_PHASES.indexOf(restorePhase);
                  const isActive = i <= currentIdx;
                  return (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: isActive ? "var(--color-admin-primary)" : "rgba(255,255,255,0.2)",
                      }}
                      animate={isActive ? { scale: [1, 1.4, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
                    />
                  );
                })}
              </div>

              <motion.div
                className="absolute w-48 h-48 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, var(--color-admin-primary) 0%, transparent 70%)" }}
                animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.03, 0.08, 0.03] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              />

              <button
                onClick={backupRunning ? handleCancelBackup : undefined}
                className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-80 border"
                style={{
                  backgroundColor: "transparent",
                  color: "rgba(255,255,255,0.7)",
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              >
                <span className="material-symbols-outlined text-[16px] align-middle mr-1">close</span>
                {backupRunning ? "Cancel Backup" : "Restore in progress..."}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section 3a: Backup Result Modal ── */}
      <AnimatePresence>
        {showResultModal && backupResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => {
              if (backupBlobUrl) URL.revokeObjectURL(backupBlobUrl);
              setBackupBlobUrl(null);
              setShowResultModal(false);
              setBackupResult(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="rounded-2xl border p-8 max-w-md w-full text-center"
              style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ backgroundColor: "rgba(34, 197, 94, 0.15)" }}
              >
                <motion.span
                  className="material-symbols-outlined text-[40px]"
                  style={{ color: "#22c55e" }}
                  initial={{ pathLength: 0 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  check_circle
                </motion.span>
              </motion.div>

              <h3 className="text-xl font-bold mb-2" style={{ color: "var(--color-admin-on-surface)" }}>Backup Complete!</h3>
              <p className="text-sm mb-6" style={{ color: "var(--color-admin-on-surface-variant)" }}>{backupResult.filename}</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: "Collections", value: backupResult.collectionsExported, icon: "folder_open" },
                  { label: "Total Records", value: backupResult.totalRecords.toLocaleString(), icon: "table_chart" },
                  { label: "Files", value: backupResult.totalFiles.toLocaleString(), icon: "attach_file" },
                  { label: "Total Size", value: formatFileSize(backupResult.totalSize), icon: "straighten" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl p-3 text-left" style={{ backgroundColor: "var(--color-admin-surface-container-low)" }}>
                    <span className="material-symbols-outlined text-[16px]" style={{ color: "var(--color-admin-on-surface-variant)" }}>{stat.icon}</span>
                    <p className="text-xs mt-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>{stat.label}</p>
                    <p className="text-sm font-bold" style={{ color: "var(--color-admin-on-surface)" }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDownloadBackup}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary)" }}
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download Backup
                </button>
                {gdriveEnabled && (
                  <button
                    className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 border"
                    style={{ backgroundColor: "transparent", color: "var(--color-admin-primary)", borderColor: "var(--color-admin-primary)" }}
                  >
                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                    Upload to Drive
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section 3b: Restore Result Modal ── */}
      <AnimatePresence>
        {showRestoreResult && restoreResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => { setShowRestoreResult(false); setRestoreResult(null); }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="rounded-2xl border p-8 max-w-md w-full text-center"
              style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${restoreResult.errors.length > 0 ? "" : ""}`}
                style={{ backgroundColor: restoreResult.errors.length > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(34, 197, 94, 0.15)" }}
              >
                <motion.span
                  className="material-symbols-outlined text-[40px]"
                  style={{ color: restoreResult.errors.length > 0 ? "#f59e0b" : "#22c55e" }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  {restoreResult.errors.length > 0 ? "warning" : "check_circle"}
                </motion.span>
              </motion.div>

              <h3 className="text-xl font-bold mb-2" style={{ color: "var(--color-admin-on-surface)" }}>
                {restoreResult.errors.length > 0 ? "Restore Completed with Errors" : "Restore Complete!"}
              </h3>
              <p className="text-sm mb-6" style={{ color: "var(--color-admin-on-surface-variant)" }}>
                Mode: {restoreResult.mode}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: "Collections", value: restoreResult.collectionsRestored, icon: "folder_open" },
                  { label: "Records", value: restoreResult.recordsImported.toLocaleString(), icon: "table_chart" },
                  { label: "Files", value: restoreResult.filesRestored.toLocaleString(), icon: "attach_file" },
                  { label: "Errors", value: restoreResult.errors.length.toString(), icon: "error", isError: restoreResult.errors.length > 0 },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl p-3 text-left" style={{ backgroundColor: "var(--color-admin-surface-container-low)" }}>
                    <span className="material-symbols-outlined text-[16px]" style={{ color: stat.isError ? "#ef4444" : "var(--color-admin-on-surface-variant)" }}>{stat.icon}</span>
                    <p className="text-xs mt-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>{stat.label}</p>
                    <p className="text-sm font-bold" style={{ color: stat.isError ? "#ef4444" : "var(--color-admin-on-surface)" }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {restoreResult.errors.length > 0 && (
                <div className="mb-6 text-left">
                  <button
                    onClick={() => setShowErrors((v) => !v)}
                    className="flex items-center gap-2 w-full py-2 px-3 rounded-lg transition-all hover:opacity-80"
                    style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                  >
                    <span className="material-symbols-outlined text-[16px]" style={{ color: "#ef4444" }}>error</span>
                    <span className="text-sm font-bold" style={{ color: "#ef4444" }}>
                      {restoreResult.errors.length} error{restoreResult.errors.length > 1 ? "s" : ""}
                    </span>
                    <span className="material-symbols-outlined text-[16px] ml-auto" style={{ color: "#ef4444" }}>
                      {showErrors ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                  <AnimatePresence>
                    {showErrors && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="max-h-40 overflow-y-auto mt-2 space-y-1 p-2 rounded-lg" style={{ backgroundColor: "var(--color-admin-surface-container-lowest)" }}>
                          {restoreResult.errors.map((err, idx) => (
                            <div key={idx} className="text-xs p-2 rounded" style={{ backgroundColor: "rgba(239, 68, 68, 0.05)" }}>
                              <span className="font-bold" style={{ color: "#ef4444" }}>{err.collection}: </span>
                              <span style={{ color: "var(--color-admin-on-surface-variant)" }}>{err.message}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <button
                onClick={() => { setShowRestoreResult(false); setRestoreResult(null); }}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: "var(--color-admin-primary)", color: "var(--color-admin-on-primary)" }}
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
