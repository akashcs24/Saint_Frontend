import { Link } from "@tanstack/react-router";
import type { NewsItem, SentimentLabel } from "@/lib/market-data";

function pill(s: SentimentLabel) {
  if (s === "Positive") return "bg-bull-soft text-bull";
  if (s === "Negative") return "bg-bear-soft text-bear";
  return "bg-muted text-muted-foreground";
}

function timeAgo(m: number) {
  if (m >= 9000) return "time n/a";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m ago` : `${h}h ago`;
}

export function NewsFeed({ items, embedded }: { items: NewsItem[]; embedded?: boolean }) {
  const ordered = [...items].sort((a, b) => a.minutesAgo - b.minutesAgo || b.impact - a.impact);

  return (
    <div className={embedded ? "flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border" : "card-elevated flex h-full min-h-0 flex-col overflow-hidden"}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-xl text-foreground sm:text-2xl">Market pulse</h2>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            News · tweets · FII/DII · newest first
          </p>
        </div>
      </div>

      <ol className="flex-1 divide-y divide-border/60 overflow-y-auto">
        {ordered.length === 0 ? (
          <li className="px-5 py-12 text-center text-sm text-muted-foreground">
            No headlines from live feeds right now.
          </li>
        ) : (
          ordered.map((n) => (
            <li key={n.id} className="group px-4 py-4 transition-colors hover:bg-accent/40 sm:px-5">
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
                {(n.themeLabels ?? []).slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
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
                <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {timeAgo(n.minutesAgo)}
                </span>
              </div>
              {n.url ? (
                <a
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-sm font-semibold leading-snug text-foreground group-hover:text-gold"
                >
                  {n.headline}
                </a>
              ) : (
                <h3 className="mt-2 text-sm font-semibold leading-snug text-foreground group-hover:text-gold">
                  {n.headline}
                </h3>
              )}
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.summary}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {n.source}
                </span>
                <span className="text-muted-foreground/50">·</span>
                {n.scope === "offshore" ? (
                  <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                    Global · no India read-through
                  </span>
                ) : null}
                {n.tickers
                  .filter((t) => t !== "NIFTY" || (n.tags ?? []).includes("FII") || (n.tags ?? []).includes("DII"))
                  .map((t) =>
                    t === "NIFTY" ? (
                      <span
                        key={t}
                        className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {t}
                      </span>
                    ) : (
                      <Link
                        key={t}
                        to="/stocks/$symbol"
                        params={{ symbol: t }}
                        className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] font-medium text-foreground transition-colors hover:border-gold/50 hover:text-gold"
                      >
                        {t}
                      </Link>
                    ),
                  )}
              </div>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
