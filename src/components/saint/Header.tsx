import { useEffect, useState } from "react";
import { Moon, RefreshCw, Sun } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { SaintLogo } from "./Logo";
import { HelpGuide, type HelpGuidePage } from "./HelpGuide";
import { ServerStatusLight } from "./ServerStatusLight";
import { fetchDashboard } from "@/lib/api";

const IST = "Asia/Kolkata";

function partsInIST(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return map;
}

/** NSE cash session: Mon–Fri 09:15–15:30 Asia/Kolkata */
function isMarketOpen(date = new Date()) {
  const p = partsInIST(date);
  const day = p.weekday; // Mon, Tue, ...
  if (day === "Sat" || day === "Sun") return false;
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

function formatISTClock(date: Date) {
  const p = partsInIST(date);
  return `${p.hour}:${p.minute}:${p.second}`;
}

function formatAgo(seconds: number) {
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m ago` : `${h}h ago`;
}

export function Header({ guide = "dashboard" }: { guide?: HelpGuidePage }) {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setLastUpdated(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("saint-theme") : null;
    const prefers =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const useDark = stored ? stored === "dark" : !!prefers;
    setDark(useDark);
    document.documentElement.classList.toggle("dark", useDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("saint-theme", next ? "dark" : "light");
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // Bypass server dashboard cache, then reload route loaders.
      try {
        await fetchDashboard(true);
      } catch {
        /* still invalidate so UI retries */
      }
      await router.invalidate();
    } finally {
      setLastUpdated(new Date());
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const open = isMarketOpen(now);
  const secondsAgo = lastUpdated
    ? Math.max(0, Math.floor((now.getTime() - lastUpdated.getTime()) / 1000))
    : 0;
  const updatedTimeStr = lastUpdated ? formatISTClock(lastUpdated) : "--:--:--";

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0">
          <SaintLogo />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ServerStatusLight />
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {refreshing ? "Status" : "Last updated"}
            </span>
            {refreshing ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
                Refreshing…
              </span>
            ) : (
              <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                <span className="hidden sm:inline">{updatedTimeStr} </span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  <span className="hidden sm:inline">IST · </span>
                  {lastUpdated ? formatAgo(secondsAgo) : ""}
                </span>
              </span>
            )}
          </div>
          <button
            aria-label="Refresh data"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-70"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{refreshing ? "Refreshing" : "Refresh"}</span>
          </button>
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
              open
                ? "border-transparent bg-bull-soft text-bull"
                : "border-border bg-muted text-muted-foreground"
            }`}
            title="NSE cash: Mon–Fri 09:15–15:30 IST"
          >
            {open ? (
              <span className="live-dot" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
            )}
            <span className="hidden sm:inline">{open ? "Market Open" : "Market Closed"}</span>
            <span className="sm:hidden">{open ? "Open" : "Closed"}</span>
          </div>
          <HelpGuide page={guide} />
          <button
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
