"use client";
import { useState, useEffect } from "react";
import { useSession } from "@/lib/pb-auth-react";

/**
 * useProjectLimit
 * Checks on mount whether the current free-tier user has hit the 7-project cap.
 * Returns isOpen state + setter so any tool page can show <ProjectLimitModal>.
 */
export function useProjectLimit() {
  const { data: session, status } = useSession();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitChecked, setLimitChecked] = useState(false);

  useEffect(() => {
    if (status === "loading" || !session?.user) return;

    // Only check for free-tier users
    const membership = (session.user as any)?.membership || "free";
    if (membership !== "free") {
      setLimitChecked(true);
      return;
    }

    fetch("/api/projects/limit-status")
      .then((r) => r.json())
      .then((data) => {
        if (data.limitReached) {
          setShowLimitModal(true);
        }
      })
      .catch(() => {/* silently ignore – don't block the tool */})
      .finally(() => setLimitChecked(true));
  }, [status, session?.user]);

  return { showLimitModal, setShowLimitModal, limitChecked };
}
