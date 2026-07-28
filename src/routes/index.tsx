import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Header } from "@/components/saint/Header";
import { SessionBoard } from "@/components/saint/SessionBoard";
import { MarketContextPanel } from "@/components/saint/MarketContextPanel";
import { fetchDashboard } from "@/lib/api";
import type { SessionBuckets, StockRow } from "@/lib/market-data";

/** Default poll; open-window uses session.refreshHintMs (~30s). */
const DEFAULT_REFRESH_MS = 5 * 60 * 1000;

function emptyBuckets(): SessionBuckets {
  return { next_session: [], live_session: [], already_reacted: [] };
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

export const Route = createFileRoute("/")({
  loader: () => fetchDashboard(),
  staleTime: 45_000,
  pendingMs: 200,
  pendingComponent: () => (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Waking server &amp; building board…</p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          Free Render can take 30–90s on first open. Keep this tab open.
        </p>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-foreground">Backend required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Saint has no fixture data. Start the API on port 8000 and ensure{" "}
          <code className="font-mono text-xs">VITE_API_BASE_URL</code> is set.
        </p>
        <p className="mt-3 font-mono text-xs text-bear">{error.message}</p>
      </div>
    </div>
  ),
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
  const data = Route.useLoaderData();
  const router = useRouter();
  const refreshMs = data.session?.refreshHintMs ?? DEFAULT_REFRESH_MS;

  useEffect(() => {
    const id = setInterval(() => {
      void router.invalidate();
    }, refreshMs);
    return () => clearInterval(id);
  }, [router, refreshMs]);

  const buckets = useMemo(
    () => bucketsFromPayload(data.topStocks ?? [], data.buckets),
    [data.topStocks, data.buckets],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:h-dvh lg:overflow-hidden">
      <Header guide="dashboard" />
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-6 sm:py-5 lg:min-h-0 lg:overflow-hidden lg:px-6">
        {/* Mobile: boards first; context collapsed. Desktop: 70/30. */}
        <div className="flex flex-1 flex-col gap-3 lg:min-h-0 lg:grid lg:grid-cols-10 lg:gap-5 lg:overflow-hidden">
          <div className="min-h-[70vh] lg:col-span-7 lg:min-h-0 lg:overflow-hidden">
            <SessionBoard buckets={buckets} marketOpen={data.session?.open} />
          </div>
          <div className="shrink-0 lg:col-span-3 lg:min-h-0 lg:overflow-hidden">
            <MarketContextPanel
              indices={data.indices}
              brief={data.morningBrief}
              news={data.news}
              accuracy={data.accuracy}
              niftyBreadth={data.niftyBreadth}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
