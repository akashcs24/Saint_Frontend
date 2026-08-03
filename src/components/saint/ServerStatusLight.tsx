import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHealth, isApiConfigured } from "@/lib/api";

type Status = "online" | "waking" | "offline" | "unknown";

const PING_MS = 60_000;
const VIS_PING_MIN_MS = 30_000;
const ONLINE_GRACE_MS = 120_000;

/** Persist across route changes so tab switches don't flash Wake. */
let lastKnown: { status: Status; ts: number } = { status: "unknown", ts: 0 };

function initialStatus(): Status {
  if (!isApiConfigured()) return "offline";
  if (
    lastKnown.status === "online" &&
    Date.now() - lastKnown.ts < ONLINE_GRACE_MS
  ) {
    return "online";
  }
  return lastKnown.status === "offline" ? "offline" : "unknown";
}

/**
 * Green = API responding. Amber = cold-start / waking. Grey = unreachable.
 * Phone backgrounding still lets Render sleep — this only reports state.
 */
export function ServerStatusLight() {
  const [status, setStatus] = useState<Status>(initialStatus);
  const inFlight = useRef(false);
  const lastPingAt = useRef(0);

  const ping = useCallback(async (opts?: { allowWake?: boolean }) => {
    if (!isApiConfigured() || inFlight.current) return;
    inFlight.current = true;
    const allowWake = opts?.allowWake ?? false;
    const wasOnline =
      lastKnown.status === "online" &&
      Date.now() - lastKnown.ts < ONLINE_GRACE_MS;

    const wakingTimer = allowWake
      ? window.setTimeout(
          () =>
            setStatus((s) => {
              if (s === "online" || wasOnline) return s;
              return "waking";
            }),
          2500,
        )
      : undefined;

    try {
      const h = await fetchHealth(12_000);
      const next: Status = h?.ok ? "online" : "offline";
      lastKnown = { status: next, ts: Date.now() };
      setStatus(next);
    } catch {
      if (!wasOnline) {
        lastKnown = { status: "offline", ts: Date.now() };
        setStatus("offline");
      }
    } finally {
      if (wakingTimer) window.clearTimeout(wakingTimer);
      inFlight.current = false;
      lastPingAt.current = Date.now();
    }
  }, []);

  useEffect(() => {
    void ping({ allowWake: lastKnown.status !== "online" });
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void ping({ allowWake: false });
    }, PING_MS);
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastPingAt.current < VIS_PING_MIN_MS) return;
      void ping({ allowWake: false });
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
