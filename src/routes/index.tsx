import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Header } from "@/components/saint/Header";
import { SessionBoard } from "@/components/saint/SessionBoard";
import { MarketContextPanel } from "@/components/saint/MarketContextPanel";
import { DASHBOARD_QUERY_KEY, fetchDashboard, type DashboardPayload } from "@/lib/api";
import type { SessionBuckets, StockRow } from "@/lib/market-data";

/** Default poll; open-window uses session.refreshHintMs (~30s). */
const DEFAULT_REFRESH_MS = 5 * 60 * 1000;

function emptyBuckets(): SessionBuckets {
  return { next_session: [], live_session: [], already_reacted: [] };
}

function emptyDashboard(): DashboardPayload {
  return {
    asOf: new Date().toISOString(),
    indices: [],
    buckets: emptyBuckets(),
    topStocks: [],
    morningBrief: {
      generatedAt: new Date().toISOString(),
      headline: "Loading market board…",
      bullets: ["Waking the API and pulling news / quotes."],
    },
    news: [],
    macro: [],
    accuracy: null,
    niftyBreadth: null,
  };
}

function bucketsFromPayload(topStocks: StockRow[], buckets?: SessionBuckets): SessionBuckets {
  if (buckets) {
    return {
      next_session: buckets.next_session ?? [],
      live_session: buckets.live_session ?? [],
      already_reacted: buckets.already_reacted ?? [],
    };
  }
  const out = emptyBuckets();
  for (const s of topStocks) {
    const key = s.bucket ?? "next_session";
    if (key in out) out[key as keyof SessionBuckets].push(s);
    else out.next_session.push(s);
  }
  return out;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/70 ${className}`} />;
}

function BoardSkeleton() {
  return (
    <div className="flex h-full min-h-[70vh] flex-col gap-3 rounded-xl border border-border/80 bg-card/30 p-3 sm:p-4">
      <SkeletonBlock className="h-10 w-full max-w-md" />
      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border/50 p-3">
            <SkeletonBlock className="h-4 w-32" />
            {Array.from({ length: 4 }).map((_, j) => (
              <SkeletonBlock key={j} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  // Shell paints immediately; React Query loads + retries the board.
  loader: () => null,
  pendingMs: 0,
  head: () => ({
    meta: [
      { title: "Saint — Market sentiment" },
      {
        name: "description",
        content:
          "Clear Indian market sentiment: what may move next session, what is moving now, and what has already reacted.",
      },
      { property: "og:title", content: "Saint — Market sentiment" },
      {
        property: "og:description",
        content: "Session-aware stock news with plain-language direction and confidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, error, isPending, isFetching, failureCount, dataUpdatedAt } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => fetchDashboard(false),
    retry: true,
    retryDelay: (n) => Math.min(8_000 + n * 2_000, 20_000),
    refetchInterval: (query) => {
      const payload = query.state.data;
      return payload?.session?.refreshHintMs ?? DEFAULT_REFRESH_MS;
    },
    refetchOnWindowFocus: true,
    staleTime: 45_000,
  });

  const buckets = useMemo(
    () => bucketsFromPayload(data?.topStocks ?? [], data?.buckets),
    [data?.topStocks, data?.buckets],
  );

  const showSkeleton = !data;
  const waking = Boolean(error) || (isPending && !data) || (isFetching && !data);
  const display = data ?? emptyDashboard();

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:h-dvh lg:overflow-hidden">
      <Header guide="dashboard" />
      {waking ? (
        <div className="border-b border-gold/30 bg-gold-soft/40 px-3 py-2 text-center text-xs text-foreground sm:px-6">
          <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
            <span>
              {error
                ? `Server waking / busy — retrying${failureCount ? ` (${failureCount})` : ""}…`
                : "Loading board…"}
            </span>
            <span className="text-muted-foreground">
              Layout is ready; numbers fill in when the API responds.
            </span>
          </span>
        </div>
      ) : isFetching && dataUpdatedAt ? (
        <div className="border-b border-border/60 bg-muted/30 px-3 py-1.5 text-center text-[11px] text-muted-foreground sm:px-6">
          Refreshing board in background…
        </div>
      ) : null}
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-6 sm:py-5 lg:min-h-0 lg:overflow-hidden lg:px-6">
        <div className="flex min-h-[70vh] flex-1 flex-col lg:min-h-0 lg:overflow-hidden">
          {showSkeleton ? (
            <BoardSkeleton />
          ) : (
            <SessionBoard
              buckets={buckets}
              marketOpen={display.session?.open}
              aside={
                <MarketContextPanel
                  indices={display.indices}
                  brief={display.morningBrief}
                  news={display.news}
                  accuracy={display.accuracy}
                  compact
                />
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}
