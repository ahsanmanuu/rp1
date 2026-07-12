import { useState, useEffect } from "react";

export type ConnectionStatus = "online" | "offline" | "slow" | "restored";

export function useOnlineStatus() {
  const [status, setStatus] = useState<ConnectionStatus>("online");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateStatus = () => {
      if (!navigator.onLine) {
        setStatus("offline");
      } else {
        const connection = (navigator as any).connection;
        if (connection && (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g")) {
          setStatus("slow");
        } else {
          // If we were offline/slow before and are now online, show restored
          setStatus(prev => {
            if (prev === "offline" || prev === "slow") {
              return "restored";
            }
            return "online";
          });
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
  }, []);

  return status;
}

// Hook that components can use to fetch data/synchronize when connectivity is restored
export function useOnOnline(callback: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      console.log("[useOnOnline] Connection restored. Running callback...");
      callback();
    };

    window.addEventListener("online-restored", handleOnline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online-restored", handleOnline);
      window.removeEventListener("online", handleOnline);
    };
  }, [callback]);
}
