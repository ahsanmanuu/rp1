"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Activity } from "lucide-react";
import { useRouter } from "next/navigation";
import { 
  isSyncableUrl, 
  enqueueRequest, 
  replaySyncQueue, 
  cacheGetResponse, 
  getCachedGetResponse 
} from "@/lib/offlineSync";

export default function InternetMonitor() {
  const [status, setStatus] = useState<"online" | "offline" | "slow" | "restored">("online");
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();
  const prevStatusRef = useRef<string>("online");

  // Handle connection events and Telemetry Speed
  useEffect(() => {
    const updateStatus = () => {
      if (!navigator.onLine) {
        setStatus("offline");
        setIsVisible(true);
      } else {
        const connection = (navigator as any).connection;
        if (connection && (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g")) {
          setStatus("slow");
          setIsVisible(true);
        } else {
          // Check if we are restoring from an offline/slow state
          if (prevStatusRef.current === "offline" || prevStatusRef.current === "slow") {
            setStatus("restored");
            setIsVisible(true);
            
            // Dispatch custom restored event for page hooks
            window.dispatchEvent(new Event("online-restored"));
            
            // Trigger background queue replay
            replaySyncQueue();
            
            // Background pull server components data
            router.refresh();

            const timer = setTimeout(() => {
              setStatus("online");
              setIsVisible(false);
            }, 4000);
            return () => clearTimeout(timer);
          } else {
            setStatus("online");
            setIsVisible(false);
          }
        }
      }
    };

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener("change", updateStatus);
    }

    updateStatus();

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      if (connection) {
        connection.removeEventListener("change", updateStatus);
      }
    };
  }, [router]);

  // Keep track of previous status to detect restored state transitions
  useEffect(() => {
    prevStatusRef.current = status;
  }, [status]);

  // Handle scroll lock (overflow: hidden) when offline
  useEffect(() => {
    if (status === "offline") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [status]);

  // Server heartbeat: periodically ping /api/health to verify real connectivity
  useEffect(() => {
    if (status === "offline") return; // Don't heartbeat while already offline

    const heartbeat = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch("/api/health", { method: "GET", signal: controller.signal, cache: "no-store" });
        clearTimeout(timeout);
        if (!res.ok) {
          // Server responded but with error — server is reachable, not offline
          console.log("[InternetMonitor] Health check returned", res.status, "— server reachable");
        }
      } catch (err: any) {
        // Only force offline if navigator.onLine is also false (real disconnect)
        // OR if it's a true network error (not abort/timeout)
        if (!navigator.onLine) {
          console.warn("[InternetMonitor] Heartbeat failed + navigator.onLine=false → offline");
          setStatus("offline");
          setIsVisible(true);
        } else {
          console.warn("[InternetMonitor] Heartbeat failed but navigator.onLine=true — server may be restarting, not forcing offline");
        }
      }
    };

    // Check every 30 seconds
    const interval = setInterval(heartbeat, 30000);
    // Initial check after 5 seconds
    const initial = setTimeout(heartbeat, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, [status]);

  // Debounce: wait 3s after navigator.onLine turns false before treating as offline
  const offlineGracePeriodMs = 3000;
  const lastOnlineRef = useRef(Date.now());

  // Update lastOnline whenever navigator.onLine is true
  useEffect(() => {
    const update = () => { lastOnlineRef.current = Date.now(); };
    window.addEventListener("online", update);
    const interval = setInterval(() => {
      if (navigator.onLine) update();
    }, 500);
    return () => {
      window.removeEventListener("online", update);
      clearInterval(interval);
    };
  }, []);

  const isEffectivelyOffline = () => {
    if (navigator.onLine) return false;
    return (Date.now() - lastOnlineRef.current) >= offlineGracePeriodMs;
  };

  // Monkey-patch window.fetch to handle offline exceptions and perform offline caching/queueing
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;

    window.fetch = async function (input, init) {
      // 1. Resolve request details
      const url = typeof input === "string" 
        ? input 
        : input instanceof URL 
          ? input.toString() 
          : (input as Request).url;
          
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

      // 2. Handle Offline state (with grace period to avoid flicker)
      if (isEffectivelyOffline()) {
        // Intercept mutating requests (POST, PUT, DELETE) for syncable APIs
        if (isSyncableUrl(url, method)) {
          let body = init?.body || null;
          if (input instanceof Request && !body) {
            try {
              body = await input.clone().text();
            } catch (e) {}
          }
          
          const headers: Record<string, string> = {};
          if (init?.headers) {
            if (init.headers instanceof Headers) {
              init.headers.forEach((val, key) => { headers[key] = val; });
            } else if (Array.isArray(init.headers)) {
              init.headers.forEach(([key, val]) => { headers[key] = val; });
            } else {
              Object.assign(headers, init.headers);
            }
          }

          enqueueRequest(url, method, body, headers);
          
          // Return simulated success response
          return new Response(JSON.stringify({ success: true, offline: true, message: "Queued offline" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Intercept GET requests and return cached version if available
        if (method === "GET") {
          const cachedData = getCachedGetResponse(url);
          if (cachedData !== null) {
            return new Response(JSON.stringify(cachedData), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        // Return error response instead of throwing — callers check res.ok
        return new Response(JSON.stringify({ error: "offline", message: "No internet connection" }), {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "application/json" },
        });
      }

      // 3. Handle Online state (Normal Fetch with Caching)
      try {
        const response = await originalFetch(input, init);

        // Cache successful JSON GET responses
        if (response.ok && method === "GET") {
          const clone = response.clone();
          try {
            const contentType = clone.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              clone.json().then(data => {
                cacheGetResponse(url, data);
              }).catch(() => {});
            }
          } catch (e) {}
        }

        return response;
      } catch (error: any) {
        // Don't force offline for server errors, CORS, timeouts — those aren't "no internet"
        if (error instanceof TypeError && (error.message.includes("Failed to fetch") || error.message.includes("NetworkError"))) {
          if (isEffectivelyOffline()) {
            console.warn("[OfflineSync] Confirmed offline:", error.message);
            setStatus("offline");
            setIsVisible(true);
          }
          // Return 503 instead of throwing — callers check res.ok
          return new Response(JSON.stringify({ error: "offline", message: "No internet connection" }), {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "application/json" },
          });
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const getUIConfig = () => {
    switch (status) {
      case "offline":
        return {
          title: "No Internet Connection",
          icon: WifiOff,
          iconColor: "text-red-500 bg-red-50 dark:bg-red-950/30",
          borderColor: "border-red-200 dark:border-red-900",
          message: "You are currently disconnected from the network node.",
          subtext: "Internet is required to function on this site. Please connect to the internet to proceed."
        };
      case "slow":
        return {
          title: "Slow Network Speed",
          icon: Activity,
          iconColor: "text-amber-500 bg-amber-50 dark:bg-amber-950/30",
          borderColor: "border-amber-200 dark:border-amber-900",
          message: "Poor network telemetry performance detected.",
          subtext: "Your performance might be impacted. A stable connection is highly recommended."
        };
      case "restored":
        return {
          title: "Connection Restored",
          icon: Wifi,
          iconColor: "text-green-500 bg-green-50 dark:bg-green-950/30",
          borderColor: "border-green-200 dark:border-green-900",
          message: "Network operational link successfully re-established.",
          subtext: "All background syncs are running. Good connectivity."
        };
      default:
        return null;
    }
  };

  const config = getUIConfig();

  if (!isVisible || !config) return null;

  const Icon = config.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md px-4 pointer-events-auto select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] max-w-2xl w-full shadow-2xl border ${config.borderColor} relative flex flex-col items-center text-center backdrop-blur-xl`}
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${config.iconColor}`}>
            <Icon size={32} />
          </div>

          <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-4">{config.title}</h3>
          
          <div className="w-full px-2 flex flex-col gap-3 items-center justify-center">
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
              {config.message}
            </p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed text-justify border-t border-slate-100 dark:border-slate-800 pt-3 w-full">
              {config.subtext}
            </p>
          </div>

          {/* Acknowledge button is only available for slow connections, NOT when fully offline */}
          {status === "slow" && (
            <button 
              onClick={() => setIsVisible(false)}
              className="mt-6 px-6 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-all cursor-pointer"
            >
              Acknowledge
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
