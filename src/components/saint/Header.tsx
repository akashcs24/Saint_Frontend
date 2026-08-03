import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Moon, RefreshCw, Sun } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { SaintLogo } from "./Logo";
import { HelpGuide, type HelpGuidePage } from "./HelpGuide";
import { ServerStatusLight } from "./ServerStatusLight";
import { FyersConnectButton } from "./FyersConnect";
import {
  DASHBOARD_QUERY_KEY,
  fetchDashboard,
  fetchNiftyBoard,
  NIFTY_PAPER_QUERY_KEY,
  NIFTY_QUERY_KEY,
} from "@/lib/api";

const IST = "Asia/Kolkata";

const CTRL =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent disabled:opacity-70";

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
  const day = p.weekday;
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

const SUB_NAV = [
  { to: "/", label: "Home", exact: true },
  { to: "/nifty", label: "Market", exact: false },
  { to: "/paper", label: "Paper Trade", exact: false },
] as const;

export function Header({ guide = "dashboard" }: { guide?: HelpGuidePage }) {
  const queryClient = useQueryClient();
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
      try {
        const [next, nifty] = await Promise.all([
          fetchDashboard(false),
          fetchNiftyBoard(false).catch(() => null),
        ]);
        queryClient.setQueryData(DASHBOARD_QUERY_KEY, next);
        if (nifty) queryClient.setQueryData(NIFTY_QUERY_KEY, nifty);
        void queryClient.invalidateQueries({ queryKey: NIFTY_PAPER_QUERY_KEY });
      } catch {
        await queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
        await queryClient.invalidateQueries({ queryKey: NIFTY_QUERY_KEY });
        await queryClient.invalidateQueries({ queryKey: NIFTY_PAPER_QUERY_KEY });
      }
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
      <div className="mx-auto flex max-w-[1400px] flex-col px-4 sm:px-6">
        <div className="flex items-center gap-2 py-3 sm:gap-3 sm:py-3.5">
          <SaintLogo className="shrink-0" />

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <ServerStatusLight />
            <FyersConnectButton />
            <button
              type="button"
              aria-label="Refresh data"
              title="Refresh"
              onClick={handleRefresh}
              disabled={refreshing}
              className={`${CTRL} w-9`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <HelpGuide page={guide} />
            <button
              type="button"
              aria-label="Toggle theme"
              onClick={toggleTheme}
              className={`${CTRL} w-9`}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <div
            className="hidden shrink-0 items-center gap-2 pl-1 sm:flex sm:pl-2"
            title={open ? "NSE cash open" : "NSE cash closed · Mon–Fri 09:15–15:30 IST"}
          >
            <div className="flex flex-col items-end leading-tight">
              <span className="hidden text-[9px] uppercase tracking-wider text-muted-foreground sm:inline">
                {refreshing ? "Refreshing" : "Updated"}
              </span>
              <span className="font-mono text-[11px] font-medium tabular-nums text-foreground sm:text-xs">
                {updatedTimeStr}
                <span className="ml-1 hidden font-sans text-[10px] font-normal text-muted-foreground sm:inline">
                  IST · {lastUpdated ? formatAgo(secondsAgo) : ""}
                </span>
              </span>
            </div>
            <span
              className={`h-6 w-6 shrink-0 rounded-full ${
                open ? "bg-bull" : "bg-muted-foreground/50"
              } ${refreshing ? "animate-pulse" : ""}`}
              aria-label={open ? "Market open" : "Market closed"}
            />
          </div>
        </div>

        <nav className="-mx-1 flex items-center gap-0.5 overflow-x-auto border-t border-border/50 pb-2.5 pt-2 text-[11px] font-semibold uppercase tracking-wider sm:text-xs">
          {SUB_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={item.exact ? { exact: true } : undefined}
              activeProps={{
                className:
                  "rounded-md bg-muted px-3 py-1.5 text-foreground",
              }}
              inactiveProps={{
                className:
                  "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
