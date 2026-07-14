"use client";

import { useState, useEffect, useCallback } from "react";

interface SyncStatus {
  running: boolean;
  queueLength: number;
  lastSync: string | null;
  lastSyncResult: "success" | "failure" | null;
  connectivity: "online" | "offline" | "unknown";
  watching: boolean;
  currentBranch: string;
  pendingCommits: number;
}

interface SyncHistory {
  queue: any[];
  gitLog: { hash: string; message: string }[];
}

export default function AdminSyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [history, setHistory] = useState<SyncHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/status");
      const json = await res.json();
      if (json.success) setStatus(json.data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/history");
      const json = await res.json();
      if (json.success) setHistory(json.data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchStatus(), fetchHistory()]).finally(() => setLoading(false));
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchHistory]);

  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/trigger", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        await Promise.all([fetchStatus(), fetchHistory()]);
      } else {
        setError(json.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a", color: "#fff" }}>
        <p>Loading sync status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" style={{ background: "#0a0a0a", color: "#fff" }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Auto Git Sync</h1>
          <div className="flex gap-3">
            <button onClick={handleTriggerSync} disabled={syncing}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: syncing ? "#333" : "#00685f", color: "#fff", opacity: syncing ? 0.6 : 1 }}>
              {syncing ? "Syncing..." : "Trigger Sync Now"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg" style={{ background: "rgba(255,50,50,0.1)", border: "1px solid rgba(255,50,50,0.3)" }}>
            <p className="text-sm" style={{ color: "#ff6b6b" }}>{error}</p>
          </div>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatusCard label="Service" value={status?.running ? "Running" : "Stopped"} color={status?.running ? "#22c55e" : "#ef4444"} />
          <StatusCard label="Connectivity" value={status?.connectivity ?? "unknown"} color={status?.connectivity === "online" ? "#22c55e" : status?.connectivity === "offline" ? "#ef4444" : "#f59e0b"} />
          <StatusCard label="File Watcher" value={status?.watching ? "Active" : "Inactive"} color={status?.watching ? "#22c55e" : "#ef4444"} />
          <StatusCard label="Queue" value={String(status?.queueLength ?? 0)} color={status && status.queueLength > 0 ? "#f59e0b" : "#22c55e"} />
          <StatusCard label="Last Sync" value={status?.lastSync ? new Date(status.lastSync).toLocaleTimeString() : "Never"} color={status?.lastSyncResult === "success" ? "#22c55e" : status?.lastSyncResult === "failure" ? "#ef4444" : "#666"} />
          <StatusCard label="Branch" value={status?.currentBranch ?? "-"} color="#3b82f6" />
          <StatusCard label="Pending Commits" value={String(status?.pendingCommits ?? 0)} color={status && status.pendingCommits > 0 ? "#f59e0b" : "#22c55e"} />
          <StatusCard label="Watched Paths" value="Active" color="#8b5cf6" />
        </div>

        {/* Git Log */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Recent Git Commits</h2>
          <div className="rounded-lg overflow-hidden" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className="text-left p-3 font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Hash</th>
                  <th className="text-left p-3 font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {history?.gitLog?.length ? history.gitLog.map((entry, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td className="p-3 font-mono text-xs" style={{ color: "#8b5cf6" }}>{entry.hash}</td>
                    <td className="p-3" style={{ color: "rgba(255,255,255,0.7)" }}>{entry.message}</td>
                  </tr>
                )) : (
                  <tr><td className="p-3" style={{ color: "rgba(255,255,255,0.4)" }} colSpan={2}>No git history</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sync Queue */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Pending Sync Queue</h2>
          <div className="rounded-lg overflow-hidden" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className="text-left p-3 font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Action</th>
                  <th className="text-left p-3 font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>File</th>
                  <th className="text-left p-3 font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Attempts</th>
                  <th className="text-left p-3 font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {(history?.queue?.length ?? 0) > 0 ? history!.queue.map((entry: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: entry.action === "added" ? "rgba(34,197,94,0.15)" : entry.action === "deleted" ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
                          color: entry.action === "added" ? "#22c55e" : entry.action === "deleted" ? "#ef4444" : "#3b82f6",
                        }}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{entry.relativePath}</td>
                    <td className="p-3" style={{ color: "rgba(255,255,255,0.5)" }}>{entry.attempts}/{entry.maxAttempts}</td>
                    <td className="p-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{new Date(entry.timestamp).toLocaleTimeString()}</td>
                  </tr>
                )) : (
                  <tr><td className="p-3" style={{ color: "rgba(255,255,255,0.4)" }} colSpan={4}>Queue is empty</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-4 rounded-lg" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-xs font-medium mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</p>
      <p className="text-lg font-semibold" style={{ color }}>{value}</p>
    </div>
  );
}
