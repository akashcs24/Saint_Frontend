import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Customized,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchPriceSeries } from "@/lib/api";
import type { NewsItem } from "@/lib/market-data";

type ChartPoint = {
  t: string;
  p: number;
  o: number;
  h: number;
  l: number;
  up: boolean;
};

type MarkerPoint = {
  t: string;
  p: number;
  sentiment: "Positive" | "Negative" | "Neutral";
  headline: string;
  impact: number;
};

function CandlesLayer(props: {
  xAxisMap?: Record<string, { scale: (v: string | number) => number; bandwidth?: () => number }>;
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
  data?: ChartPoint[];
  offset?: { top: number; left: number };
}) {
  const xAxis = props.xAxisMap ? Object.values(props.xAxisMap)[0] : null;
  const yAxis = props.yAxisMap ? Object.values(props.yAxisMap)[0] : null;
  const data = props.data ?? [];
  if (!xAxis?.scale || !yAxis?.scale || !data.length) return null;

  const bandwidth =
    typeof xAxis.bandwidth === "function" ? xAxis.bandwidth() : Math.max(4, 480 / data.length);

  return (
    <g>
      {data.map((d) => {
        const x = xAxis.scale(d.t);
        const xMid = x + bandwidth / 2;
        const yHigh = yAxis.scale(d.h);
        const yLow = yAxis.scale(d.l);
        const yOpen = yAxis.scale(d.o);
        const yClose = yAxis.scale(d.p);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(1, Math.abs(yClose - yOpen));
        const color = d.up ? "var(--color-bull)" : "var(--color-bear)";
        const bodyW = Math.max(2, bandwidth * 0.55);
        const wickW = Math.max(1, bandwidth * 0.1);
        return (
          <g key={d.t}>
            <rect
              x={xMid - wickW / 2}
              y={yHigh}
              width={wickW}
              height={Math.max(1, yLow - yHigh)}
              fill={color}
            />
            <rect x={xMid - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} rx={0.5} />
          </g>
        );
      })}
    </g>
  );
}

function NewsLightsLayer(props: {
  xAxisMap?: Record<string, { scale: (v: string | number) => number; bandwidth?: () => number }>;
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
  markers?: MarkerPoint[];
  onHover?: (tip: { m: MarkerPoint; x: number; y: number } | null) => void;
}) {
  const xAxis = props.xAxisMap ? Object.values(props.xAxisMap)[0] : null;
  const yAxis = props.yAxisMap ? Object.values(props.yAxisMap)[0] : null;
  const markers = props.markers ?? [];
  if (!xAxis?.scale || !yAxis?.scale || !markers.length) return null;
  const bandwidth =
    typeof xAxis.bandwidth === "function" ? xAxis.bandwidth() : Math.max(4, 24);

  return (
    <g>
      {markers.map((m) => {
        const x = xAxis.scale(m.t) + bandwidth / 2;
        const y = yAxis.scale(m.p);
        const fill =
          m.sentiment === "Positive"
            ? "var(--color-bull)"
            : m.sentiment === "Negative"
              ? "var(--color-bear)"
              : "var(--color-gold)";
        return (
          <g
            key={`${m.t}-${m.sentiment}-${m.headline.slice(0, 12)}`}
            transform={`translate(${x}, ${y})`}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => props.onHover?.({ m, x, y })}
            onMouseLeave={() => props.onHover?.(null)}
          >
            {/* Larger invisible hit target */}
            <circle r={14} fill="transparent" />
            <g className="news-traffic-halo" style={{ pointerEvents: "none" }}>
              <circle r={10} fill={fill} />
            </g>
            <circle r={4} fill={fill} style={{ pointerEvents: "none" }} />
          </g>
        );
      })}
    </g>
  );
}

function formatXTick(t: string, range: string) {
  // Labels are "YYYY-MM-DD HH:MM" (15m) or "YYYY-MM-DD" (daily)
  if (!t.includes(" ")) return t.slice(5); // MM-DD
  const time = t.slice(11, 16); // HH:MM
  if (range === "1D") return time;
  const day = t.slice(5, 10); // MM-DD
  // Prefer time; show day when the hour is session open-ish so days are still readable
  if (time === "09:15" || time === "09:30") return `${day} ${time}`;
  return time;
}

export function PriceChart({
  symbol,
  range = "1M",
  className,
  changePct = 0,
  news = [],
}: {
  symbol: string;
  range?: string;
  className?: string;
  changePct?: number;
  news?: NewsItem[];
}) {
  const [raw, setRaw] = useState<
    { t: string; p: number; o?: number | null; h?: number | null; l?: number | null }[]
  >([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [mode, setMode] = useState<"candle" | "line">("candle");
  const [tip, setTip] = useState<{ m: MarkerPoint; x: number; y: number } | null>(null);
  const up = changePct >= 0;
  const stroke = up ? "var(--color-bull)" : "var(--color-bear)";
  const fillId = `saint-grad-${symbol}-${range}`;

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setTip(null);
    fetchPriceSeries(symbol, range)
      .then((payload) => {
        if (cancelled) return;
        const pts = payload.points ?? [];
        setRaw(pts);
        setStatus(pts.length ? "ready" : "empty");
      })
      .catch(() => {
        if (!cancelled) {
          setRaw([]);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  const points: ChartPoint[] = useMemo(() => {
    return raw.map((d) => {
      const o = Number(d.o ?? d.p);
      const h = Number(d.h ?? d.p);
      const l = Number(d.l ?? d.p);
      const c = Number(d.p);
      return { t: d.t, p: c, o, h, l, up: c >= o };
    });
  }, [raw]);

  const markers: MarkerPoint[] = useMemo(() => {
    if (!points.length) return [];
    const byDate = new Map(points.map((p) => [p.t, p]));
    const dates = points.map((p) => p.t);
    const out: MarkerPoint[] = [];
    const seen = new Set<string>();

    const toKey = (d: Date) => {
      // Match backend IST wall labels: "YYYY-MM-DD HH:MM"
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(d);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
      return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
    };

    const snap = (chartDate: string | null | undefined, minutesAgo: number, publishedAt?: string | null) => {
      if (chartDate && byDate.has(chartDate)) return chartDate;
      // try exact / prefix match for daily vs intraday
      if (chartDate) {
        const hit = dates.find((t) => t === chartDate || t.startsWith(chartDate));
        if (hit) return hit;
        const earlier = [...dates].reverse().find((t) => t <= chartDate);
        if (earlier) return earlier;
      }
      let isoKey: string | null = null;
      if (publishedAt) {
        try {
          isoKey = toKey(new Date(publishedAt));
        } catch {
          isoKey = null;
        }
      } else if (minutesAgo < 9000) {
        isoKey = toKey(new Date(Date.now() - minutesAgo * 60_000));
      }
      if (isoKey) {
        if (byDate.has(isoKey)) return isoKey;
        // floor to nearest earlier bar
        const earlier = [...dates].reverse().find((t) => t <= isoKey!);
        if (earlier) return earlier;
        // also try date-only
        const day = isoKey.slice(0, 10);
        const dayHit = [...dates].reverse().find((t) => t.startsWith(day) && t <= isoKey!);
        if (dayHit) return dayHit;
      }
      return dates[dates.length - 1];
    };

    const ranked = [...news]
      .filter((n) => n.sentiment === "Positive" || n.sentiment === "Negative")
      .sort((a, b) => b.impact - a.impact || a.minutesAgo - b.minutesAgo)
      .slice(0, 8);

    for (const n of ranked) {
      const t = snap(n.chartDate, n.minutesAgo, n.publishedAt);
      const key = `${t}-${n.sentiment}`;
      if (!t || seen.has(key)) continue;
      seen.add(key);
      const bar = byDate.get(t);
      if (!bar) continue;
      out.push({
        t,
        p: n.sentiment === "Positive" ? bar.h * 1.006 : bar.l * 0.994,
        sentiment: n.sentiment,
        headline: n.headline,
        impact: n.impact,
      });
    }
    return out;
  }, [news, points]);

  if (status === "loading") {
    return (
      <div className={`grid h-full min-h-[180px] place-items-center text-xs text-muted-foreground ${className ?? ""}`}>
        Loading price history…
      </div>
    );
  }
  if (status !== "ready") {
    return (
      <div className={`grid h-full min-h-[180px] place-items-center text-xs text-muted-foreground ${className ?? ""}`}>
        {status === "empty" ? "No price history for this symbol yet." : "Could not load price history."}
      </div>
    );
  }

  const min = Math.min(...points.map((d) => d.l), ...(markers.length ? markers.map((m) => m.p) : [Infinity]));
  const max = Math.max(...points.map((d) => d.h), ...(markers.length ? markers.map((m) => m.p) : [-Infinity]));

  return (
    <div className={`flex h-full min-h-[200px] flex-col ${className ?? ""}`}>
      <div className="mb-1 flex justify-end">
        <div className="flex w-fit items-center gap-1 rounded-full border border-border p-0.5 text-[10px]">
          {(["candle", "line"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-2.5 py-1 font-medium capitalize transition-colors ${
                mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%" minHeight={180}>
          {mode === "line" ? (
            <ComposedChart data={points} margin={{ top: 18, right: 12, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.35} vertical={false} />
              <XAxis
                dataKey="t"
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={range === "1D" ? 28 : 40}
                tickFormatter={(t) => formatXTick(String(t), range)}
              />
              <YAxis
                domain={[min * 0.997, max * 1.003]}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={(v) => Number(v).toFixed(0)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [`₹${Number(value).toFixed(2)}`, "Close"]}
                labelFormatter={(label) => String(label)}
              />
              <Area type="monotone" dataKey="p" stroke={stroke} fill={`url(#${fillId})`} strokeWidth={2} />
              <Customized
                component={(p) => <NewsLightsLayer {...p} markers={markers} onHover={setTip} />}
              />
            </ComposedChart>
          ) : (
            <ComposedChart data={points} margin={{ top: 18, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.35} vertical={false} />
              <XAxis
                dataKey="t"
                type="category"
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={range === "1D" ? 28 : 40}
                tickFormatter={(t) => formatXTick(String(t), range)}
              />
              <YAxis
                domain={[min * 0.997, max * 1.003]}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={60}
                tickFormatter={(v) => Number(v).toFixed(0)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(_value: number, _name: string, item: { payload?: ChartPoint }) => {
                  const p = item?.payload;
                  if (!p) return ["—", "OHLC"];
                  return [
                    `O ${p.o.toFixed(2)}  H ${p.h.toFixed(2)}  L ${p.l.toFixed(2)}  C ${p.p.toFixed(2)}`,
                    "OHLC",
                  ];
                }}
                labelFormatter={(label) => String(label)}
              />
              {/* invisible series so tooltip/axes bind to OHLC payload */}
              <Area type="monotone" dataKey="p" stroke="transparent" fill="transparent" />
              <Customized component={(p) => <CandlesLayer {...p} data={points} />} />
              <Customized
                component={(p) => <NewsLightsLayer {...p} markers={markers} onHover={setTip} />}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
        {tip ? (
          <div
            className="pointer-events-none absolute z-20 max-w-[240px] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border border-border bg-card px-2.5 py-2 shadow-lg"
            style={{ left: tip.x, top: tip.y }}
          >
            <div
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                tip.m.sentiment === "Positive"
                  ? "text-bull"
                  : tip.m.sentiment === "Negative"
                    ? "text-bear"
                    : "text-muted-foreground"
              }`}
            >
              {tip.m.sentiment} · Impact {tip.m.impact}/10
            </div>
            <div className="mt-0.5 text-[11px] font-medium leading-snug text-foreground">{tip.m.headline}</div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">{tip.m.t}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
