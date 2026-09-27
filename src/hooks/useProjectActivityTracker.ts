"use client";

import { useEffect, useRef, useCallback } from "react";
import { authFetch } from "@/lib/authFetch";

export type ToolType =
  | "latexify_studio"
  | "doc2latex"
  | "template_migrator"
  | "ai_peer_reviewer"
  | "ai_citation_generator"
  | "ai_diagram_studio"
  | "general";

export type ActionType =
  | "dwell_1s"
  | "build"
  | "compile"
  | "draw"
  | "search_citation";

interface UseProjectActivityTrackerProps {
  projectId?: string | null;
  tool: ToolType;
  enabled?: boolean;
}

const DELETED_PROJECTS_CACHE = new Set<string>();

/**
 * Broadcasts an updated project counter across tabs and windows
 */
export function broadcastProjectCounterUpdate(count: number) {
  if (typeof window === "undefined") return;

  try {
    window.dispatchEvent(
      new CustomEvent("project_counter_updated", { detail: { count } })
    );
  } catch {}

  try {
    const channel = new BroadcastChannel("project_counter_sync");
    channel.postMessage({ type: "COUNT_UPDATED", count, timestamp: Date.now() });
    channel.close();
  } catch {}

  try {
    localStorage.setItem("project_counter_last_sync", String(Date.now()));
  } catch {}
}

/**
 * Broadcasts project deletion so cards, windows, and panels purge the deleted project
 * while preserving the user's project counter.
 */
export function broadcastProjectDeleted(projectId: string) {
  if (!projectId || typeof window === "undefined") return;
  DELETED_PROJECTS_CACHE.add(projectId);

  try {
    window.dispatchEvent(
      new CustomEvent("project_deleted_event", { detail: { projectId } })
    );
  } catch {}

  try {
    const channel = new BroadcastChannel("project_counter_sync");
    channel.postMessage({ type: "PROJECT_DELETED", projectId, timestamp: Date.now() });
    channel.close();
  } catch {}
}

export function useProjectActivityTracker({
  projectId,
  tool,
  enabled = true,
}: UseProjectActivityTrackerProps) {
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedRef = useRef<Record<string, boolean>>({});

  const recordActivity = useCallback(
    async (action: ActionType, targetProjectId?: string | null) => {
      const pid = targetProjectId !== undefined ? targetProjectId : projectId;
      if (!enabled) return;

      // CRITICAL: Must not count any deleted project
      if (pid && DELETED_PROJECTS_CACHE.has(pid)) {
        return;
      }

      // If already recorded dwell for this project in this lifecycle, skip duplicate dwell
      const cacheKey = `${tool}_${pid || "none"}_${action}`;
      if (action === "dwell_1s" && recordedRef.current[cacheKey]) {
        return;
      }

      try {
        const res = await authFetch("/api/projects/count-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: pid || null,
            tool,
            action,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.deleted && pid) {
            DELETED_PROJECTS_CACHE.add(pid);
            return;
          }

          recordedRef.current[cacheKey] = true;

          if (typeof data.count === "number") {
            broadcastProjectCounterUpdate(data.count);
          }
        }
      } catch (err) {
        console.warn("[ProjectActivityTracker] Silent sync notice:", err);
      }
    },
    [enabled, projectId, tool]
  );

  // Trigger 1-second dwell counting
  useEffect(() => {
    if (!enabled) return;
    if (projectId && DELETED_PROJECTS_CACHE.has(projectId)) return;

    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
    }

    dwellTimerRef.current = setTimeout(() => {
      recordActivity("dwell_1s", projectId);
    }, 1000);

    return () => {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
    };
  }, [projectId, enabled, recordActivity]);

  // Listen for cross-tab deleted project broadcasts
  useEffect(() => {
    if (typeof window === "undefined") return;

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("project_counter_sync");
      channel.onmessage = (event) => {
        if (event.data?.type === "PROJECT_DELETED" && event.data?.projectId) {
          DELETED_PROJECTS_CACHE.add(event.data.projectId);
        }
      };
    } catch {}

    const handleDeletedEvent = (e: any) => {
      const id = e?.detail?.projectId;
      if (id) DELETED_PROJECTS_CACHE.add(id);
    };

    window.addEventListener("project_deleted_event", handleDeletedEvent);

    return () => {
      window.removeEventListener("project_deleted_event", handleDeletedEvent);
      if (channel) channel.close();
    };
  }, []);

  const triggerBuild = useCallback(
    (customProjectId?: string | null) => recordActivity("build", customProjectId),
    [recordActivity]
  );

  const triggerCompile = useCallback(
    (customProjectId?: string | null) => recordActivity("compile", customProjectId),
    [recordActivity]
  );

  const triggerDraw = useCallback(
    (customProjectId?: string | null) => recordActivity("draw", customProjectId),
    [recordActivity]
  );

  const triggerSearchCitation = useCallback(
    (customProjectId?: string | null) =>
      recordActivity("search_citation", customProjectId),
    [recordActivity]
  );

  return {
    triggerBuild,
    triggerCompile,
    triggerDraw,
    triggerSearchCitation,
    notifyDeleted: broadcastProjectDeleted,
  };
}
