import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHealth, isApiConfigured } from "@/lib/api";

type Status = "online" | "waking" | "offline" | "unknown";

const PING_MS = 60_000;

/**
 * Green = API responding. Amber = cold-start / waking. Grey = unreachable.
 * Phone backgrounding still lets Render sleep — this only reports state.
 */
export function ServerStatusLight() {
  const [status, setStatus] = useState<Status>(() => (isApiConfigured() ? "unknown" : "offline"));
  const inFlight = useRef(false);

  const ping = useCallback(async () => {
    if (!isApiConfigured() || inFlight.current) return;
    inFlight.current = true;
    // Show waking if the request is still open after a couple seconds (cold start).
    const wakingTimer = window.setTimeout(() => setStatus((s) => (s === "online" ? s : "waking")), 2500);
    try {
      const h = await fetchHealth();
      setStatus(h?.ok ? "online" : "offline");
    } catch {
      setStatus("offline");
    } finally {
      window.clearTimeout(wakingTimer);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void ping();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void ping();
    }, PING_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void ping();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ping]);

  const label =
    status === "online"
      ? "Server online"
      : status === "waking"
        ? "Waking server…"
        : status === "offline"
          ? "Server offline"
          : "Checking server…";

  const dot =
    status === "online"
      ? "bg-bull"
      : status === "waking"
        ? "bg-amber-500 animate-pulse"
        : "bg-muted-foreground/50";

  return (
    <div
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5"
      title={label}
      aria-label={label}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="hidden text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
        {status === "online" ? "API" : status === "waking" ? "Wake" : status === "offline" ? "Down" : "…"}
      </span>
    </div>
  );
}
