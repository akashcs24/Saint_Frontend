import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, Bookmark } from "lucide-react";
import { Header } from "@/components/saint/Header";
import { PriceChart } from "@/components/saint/PriceChart";
import { KeyLevelsPanel } from "@/components/saint/KeyLevelsPanel";
import { AiHelperPanel } from "@/components/saint/AiHelperPanel";
import { fetchStockDetail } from "@/lib/api";
import { useBookmarkStorageSync, useBookmarks } from "@/lib/bookmarks";
import type { NewsItem, SentimentLabel, StockRow, ThesisHealth } from "@/lib/market-data";
import {
  actionLabel,
  primarySignal,
  signalBarClass,
  signalSurface,
  signalTextClass,
  signalTier,
} from "@/lib/signal";

export const Route = createFileRoute("/stocks/$symbol")({
  loader: async ({ params }) => {
    try {
      return await fetchStockDetail(params.symbol);
    } catch (err) {
      if (err instanceof Error && err.message === "NOT_FOUND") throw notFound();
      throw err;
    }
  },
  staleTime: 30_000,
  pendingMs: 150,
  pendingComponent: () => (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Loading stock…</p>
      </div>
    </div>
  ),
  head: ({ loaderData }) => {
    const s = loaderData?.stock;
    const title = s ? `${s.symbol} · ${s.name} — Saint` : "Stock — Saint";
    const desc = s
      ? `${s.name} (${s.symbol}) is at ₹${s.ltp.toFixed(2)}, ${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}% today. Sentiment: ${s.sentiment}. Impact ${s.impact}/10.`
      : "Scored sentiment and news for Indian stocks on Saint.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: StockDetail,
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <p>Could not load stock. {error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <Header guide="stock" />
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-foreground">Stock not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We don't cover this ticker yet in the Saint sentiment room.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>
    </div>
  ),
});

function pill(s: SentimentLabel) {
  // News tone only — trade signals use signalSurface (no red).
  if (s === "Positive") return "bg-bull-soft text-bull";
  if (s === "Negative") return "bg-bear-soft text-bear";
  return "bg-muted text-muted-foreground";
}

function directionPill(direction?: number) {
  if (direction && direction > 0) return { label: "Tailwind", cls: "bg-bull-soft text-bull" };
  if (direction && direction < 0) return { label: "Headwind", cls: "bg-muted text-muted-foreground" };
  return { label: "Unclear", cls: "bg-muted text-muted-foreground" };
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function timeAgo(m: number) {
  if (m >= 9000) return "time n/a";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m ago` : `${h}h ago`;
}

function thesisTone(h?: ThesisHealth | null) {
  if (h === "confirming") {
    return {
      wrap: "bg-bull-soft text-bull ring-bull/40",
      bar: "bg-bull",
      label: "Thesis holding — price aligns with the overnight read",
    };
  }
  if (h === "invalidated") {
    return {
      wrap: "bg-bear-soft text-bear ring-bear/40",
      bar: "bg-bear",
      label: "Thesis broken — price moved against the story",
    };
  }
  if (h === "fading") {
    return {
      wrap: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
      bar: "bg-amber-500",
      label: "Thesis fading — gave back the run or reversing (don’t wait for red)",
    };
  }
  if (h === "cooling") {
    return {
      wrap: "bg-muted text-muted-foreground ring-border",
      bar: "bg-muted-foreground/50",
      label: "Thesis cooling — move has slowed",
    };
  }
  return {
    wrap: "bg-muted text-muted-foreground ring-border",
    bar: "bg-muted-foreground/40",
    label: "Waiting for cash-session confirmation",
  };
}

/** An indirect story: what it is, and the one line explaining the read-through. */
function ContextRow({ item }: { item: NewsItem }) {
  const dir = directionPill(item.expectedDirection);
  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {item.linkType === "peer" ? "Peer" : item.linkType === "index" ? "Market" : "Sector"}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${dir.cls}`}>
          {dir.label}
        </span>
        {item.relevance != null ? (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            Relevance {Math.round(item.relevance * 100)}%
          </span>
        ) : null}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {timeAgo(item.minutesAgo)}
        </span>
      </div>
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 block text-[13px] font-medium leading-snug text-foreground hover:text-gold"
        >
          {item.headline}
        </a>
      ) : (
        <h4 className="mt-1.5 text-[13px] font-medium leading-snug text-foreground">{item.headline}</h4>
      )}
      {item.linkReason ? (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{item.linkReason}</p>
      ) : null}
    </li>
  );
}

function StockDetail() {
  const { stock, news, context } = Route.useLoaderData();
  const contextNews = context ?? [];
  const [chartRange, setChartRange] = useState("5D");
  useBookmarkStorageSync();
  const { isBookmarked, toggle } = useBookmarks();
  const bookmarked = isBookmarked(stock.symbol);
  const up = stock.changePct >= 0;
  const vol = stock.volume * 100000;
  const avg = stock.avgVolume * 100000;
  const diff = vol - avg;
  const diffPct = (diff / avg) * 100;
  const diffUp = diff >= 0;
  const fmtInt = (n: number) => Math.round(n).toLocaleString("en-IN");
  const thesis = thesisTone(stock.thesisHealth);
  const showThesis = Boolean(stock.thesisHealth && stock.thesisHealth !== "na");

  const stats: [string, string][] = [
    ["Sector", stock.sector],
    ["Market cap", stock.marketCap],
    ["P/E ratio", stock.peRatio != null ? stock.peRatio.toFixed(2) : "—"],
    ["Day range", `₹${fmt(stock.dayRange[0])} – ₹${fmt(stock.dayRange[1])}`],
    ["52W range", `₹${fmt(stock.yearRange[0])} – ₹${fmt(stock.yearRange[1])}`],
    ["Company news (24h)", `${stock.newsCount}`],
  ];

  const biasColor =
    stock.bias === "bullish"
      ? "text-bull"
      : stock.bias === "bearish"
        ? "text-foreground"
        : "text-muted-foreground";
  const biasBg =
    stock.bias === "bullish"
      ? "bg-bull-soft"
      : stock.bias === "bearish"
        ? "bg-muted"
        : "bg-muted";
  const tier = signalTier(stock.conviction, stock.signalTier);
  const actionRing = signalSurface(tier);
  const signal = primarySignal(stock);
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:h-dvh lg:overflow-hidden">
      <Header guide="stock" />
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 pb-6 pt-3 sm:px-6 lg:min-h-0 lg:overflow-hidden lg:pb-4">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sentiment room
        </Link>

        <div className="mt-3 grid flex-1 grid-cols-1 gap-4 lg:min-h-0 lg:grid-cols-5 lg:gap-5">
          {/* Left: stock info + thesis + key levels */}
          <div className="card-elevated flex flex-col overflow-hidden p-4 sm:p-5 lg:col-span-2 lg:min-h-0 lg:overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {stock.index}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <h1 className="truncate font-serif text-2xl leading-tight text-foreground sm:text-3xl">
                    {stock.symbol}
                  </h1>
                  <button
                    type="button"
                    aria-label={bookmarked ? `Unpin ${stock.symbol}` : `Pin ${stock.symbol}`}
                    title={bookmarked ? "Unpin from dashboard monitoring" : "Pin to dashboard for exit monitoring"}
                    onClick={() => toggle(stock.symbol)}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors ${
                      bookmarked
                        ? "border-gold/50 bg-gold-soft text-gold"
                        : "border-border bg-card text-muted-foreground hover:border-gold/40 hover:text-gold"
                    }`}
                  >
                    <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-current" : ""}`} />
                  </button>
                </div>
                <p className="truncate text-xs text-muted-foreground">{stock.name}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${signalSurface(tier, { ring: false })}`}
                title={stock.themeConflict ? "Opposing themes — treat as watch" : undefined}
              >
                {signal}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-2">
              <div className="font-mono text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                ₹{fmt(stock.ltp)}
              </div>
              <div
                className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                  up ? "bg-bull-soft text-bull" : "bg-bear-soft text-bear"
                }`}
              >
                {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {up ? "+" : ""}
                {stock.changePct.toFixed(2)}%
              </div>
            </div>

            {/* Thesis health — primary live signal */}
            {showThesis ? (
              <div className={`mt-4 rounded-2xl px-4 py-3.5 ring-1 ${thesis.wrap}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">
                      Thesis health
                    </div>
                    <div className="mt-1 font-serif text-2xl font-semibold capitalize leading-none tracking-tight">
                      {stock.thesisHealth}
                    </div>
                  </div>
                  {stock.thesisOpenMovePct != null ? (
                    <div className="text-right">
                      <div className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
                        Gap vs prior close
                      </div>
                      <div
                        className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${
                          stock.thesisOpenMovePct >= 0 ? "text-bull" : "text-bear"
                        }`}
                      >
                        {stock.thesisOpenMovePct >= 0 ? "+" : ""}
                        {stock.thesisOpenMovePct.toFixed(2)}%
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-background/40">
                  <div
                    className={`h-full rounded-full ${thesis.bar}`}
                    style={{
                      width:
                        stock.thesisHealth === "confirming"
                          ? "88%"
                          : stock.thesisHealth === "fading"
                            ? "45%"
                            : stock.thesisHealth === "invalidated"
                              ? "18%"
                              : "55%",
                    }}
                  />
                </div>
                <p className="mt-2.5 text-[12px] font-medium leading-snug opacity-95">
                  {stock.thesisLabel || thesis.label}
                </p>
              </div>
            ) : null}

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className={`rounded-xl px-2.5 py-2 sm:px-3 ${biasBg}`}>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Bias
                </div>
                <div className={`text-sm font-bold capitalize leading-tight sm:text-base ${biasColor}`}>
                  {stock.bias}
                </div>
              </div>
              <div className={`rounded-xl px-2.5 py-2 ring-1 sm:px-3 ${actionRing}`}>
                <div className="text-[9px] font-semibold uppercase tracking-wider opacity-80">Action</div>
                <div className="text-sm font-bold leading-tight sm:text-base">{actionLabel(stock.action)}</div>
              </div>
              <div className="rounded-xl bg-muted px-2.5 py-2 sm:px-3">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Impact
                </div>
                <div className="font-mono text-sm font-bold leading-tight text-foreground sm:text-base">
                  {stock.impact}
                  <span className="text-[10px] text-muted-foreground">/10</span>
                </div>
              </div>
            </div>
            {stock.actionNote ? (
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{stock.actionNote}</p>
            ) : null}

            {stock.conviction != null ? (
              <div className="mt-3 rounded-xl border border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Conviction
                  </span>
                  <span className={`text-xs font-bold uppercase tracking-wide ${signalTextClass(tier)}`}>
                    {stock.confidence ?? "low"}
                  </span>
                  <span className="ml-auto font-mono text-xs font-semibold tabular-nums text-foreground">
                    {stock.conviction}/100
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${signalBarClass(tier)}`}
                    style={{ width: `${stock.conviction}%` }}
                  />
                </div>
                {stock.convictionDrivers?.length ? (
                  <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                    {stock.convictionDrivers.join(" · ")}
                    {stock.contextCount ? ` · ${stock.contextCount} sector/macro threads` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}

            <AiHelperPanel symbol={stock.symbol} />

            {stock.about ? (
              <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-muted-foreground">{stock.about}</p>
            ) : null}

            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3">
              {stats.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{v}</dd>
                </div>
              ))}
              <div className="col-span-2 min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Volume
                </dt>
                <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-sm tabular-nums text-foreground">
                  <span>Vol {fmtInt(vol)}</span>
                  <span className="text-muted-foreground">Avg {fmtInt(avg)}</span>
                  <span className={diffUp ? "text-bull" : "text-bear"}>
                    Diff {diffUp ? "+" : ""}
                    {fmtInt(diff)} ({diffUp ? "+" : ""}
                    {diffPct.toFixed(2)}%)
                  </span>
                </dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-border pt-3">
              <KeyLevelsPanel stock={stock} />
            </div>
          </div>

          {/* Right: chart card above company news */}
          <div className="flex min-h-0 flex-col gap-4 lg:col-span-3 lg:overflow-hidden">
            <div className="card-elevated shrink-0 overflow-hidden p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-serif text-xl text-foreground">Price history</h2>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    15m candles · cached on open · ~60d max
                  </p>
                </div>
                <div className="flex w-fit items-center gap-1 rounded-full border border-border p-0.5 text-xs">
                  {["1D", "5D", "1M", "60D"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setChartRange(r)}
                      className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
                        chartRange === r
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 h-[220px] w-full sm:h-[260px]">
                <PriceChart
                  symbol={stock.symbol}
                  range={chartRange}
                  changePct={stock.changePct}
                  news={news}
                  className="h-full w-full"
                />
              </div>
            </div>

            <aside className="card-elevated flex min-h-[280px] flex-1 flex-col overflow-hidden lg:min-h-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5 sm:py-4">
                <div>
                  <h2 className="font-serif text-xl text-foreground">Company news</h2>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {news.length} thread{news.length === 1 ? "" : "s"} naming {stock.symbol} · newest first
                  </p>
                </div>
              </div>

              {news.length === 0 && contextNews.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No fresh headlines for {stock.symbol} in the last 24 hours.
                </div>
              ) : (
                <ol className="flex-1 divide-y divide-border/60 overflow-y-auto">
                  {news.length === 0 ? (
                    <li className="px-5 py-8 text-center text-xs text-muted-foreground">
                      Nothing naming {stock.symbol} directly. Sector and macro context below.
                    </li>
                  ) : null}
                  {news.map((n) => (
                    <li key={n.id} className="px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {n.kind === "tweet" && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                            Tweet
                          </span>
                        )}
                        {(n.tags ?? [])
                          .filter((t) => t === "FII" || t === "DII" || t === "flows")
                          .map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold"
                            >
                              {t}
                            </span>
                          ))}
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${pill(n.sentiment)}`}
                        >
                          {n.sentiment}
                        </span>
                        <span className="font-mono text-[10px] font-semibold tabular-nums text-foreground">
                          Impact {n.impact}/10
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {n.source}
                        </span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {timeAgo(n.minutesAgo)}
                        </span>
                      </div>
                      {n.url ? (
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block text-sm font-semibold leading-snug text-foreground hover:text-gold"
                        >
                          {n.headline}
                        </a>
                      ) : (
                        <h3 className="mt-2 text-sm font-semibold leading-snug text-foreground">
                          {n.headline}
                        </h3>
                      )}
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{n.summary}</p>
                    </li>
                  ))}

                  {contextNews.length ? (
                    <li className="sticky top-0 z-10 border-y border-border bg-card/95 px-4 py-2.5 backdrop-blur sm:px-5">
                      <h3 className="font-serif text-base text-foreground">Sector & macro context</h3>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Not about {stock.symbol} — read-through only
                      </p>
                    </li>
                  ) : null}
                  {contextNews.map((n) => (
                    <ContextRow key={n.id} item={n} />
                  ))}
                </ol>
              )}
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
