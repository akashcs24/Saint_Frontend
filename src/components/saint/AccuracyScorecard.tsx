import { Info } from "lucide-react";
import type { AccuracySlice, AccuracySummary } from "@/lib/market-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function pct(rate: number | null | undefined) {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function SliceCard({
  label,
  hint,
  slice,
  emphasize,
  compact,
}: {
  label: string;
  hint: string;
  slice?: AccuracySlice | null;
  emphasize?: boolean;
  compact?: boolean;
}) {
  if (!slice || slice.resolved < 1) {
    return (
      <div className={`rounded-xl border border-dashed border-border/80 ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground/80">Warming up</p>
      </div>
    );
  }

  const hit = slice.hitRate;
  const tone =
    hit == null
      ? "text-muted-foreground"
      : hit >= 0.7
        ? "text-bull"
        : hit >= 0.5
          ? "text-gold"
          : "text-muted-foreground";

  return (
    <div
      className={`rounded-xl border ${compact ? "px-2.5 py-2" : "px-3 py-2.5"} ${
        emphasize ? "border-gold/40 bg-gold-soft/30" : "border-border bg-background/60"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className={`font-mono text-sm font-bold tabular-nums ${tone}`}>{pct(hit)}</div>
      </div>
      {!compact ? <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
      <p className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground">
        {slice.confirmed}✓ · {slice.wrong}✗ · n={slice.decided ?? slice.confirmed + slice.wrong}
      </p>
    </div>
  );
}

function TrackRecordHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="How track record works"
          className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-80 space-y-2.5 p-3.5 text-[12px] leading-relaxed text-muted-foreground"
      >
        <p className="font-serif text-sm text-foreground">How track record works</p>
        <p>
          Saint scores past directional calls after the open and close.{" "}
          <span className="font-medium text-foreground">Hit rate</span> = confirmed ÷ (confirmed + wrong).
          Flats are shown but don’t count as wins or losses.
        </p>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            <span className="font-medium text-foreground">At open / At close</span> — same calls, judged at
            those checkpoints. Open is usually the cleaner overnight edge.
          </li>
          <li>
            <span className="font-medium text-foreground">High ≥60</span> — only calls in the Buy long / Buy
            short publish tier. This is the slice we steer toward ~80%.
          </li>
          <li>
            <span className="font-medium text-foreground">Mid 40–59</span> — Watch zone; expect noisier hits.
          </li>
          <li>
            <span className="font-medium text-foreground">Direct vs Sector</span> — company named in the
            story vs indirect peer/sector read-through.
          </li>
        </ul>
        <p>
          The board only lists stocks with fresh board-worthy news — not every Nifty name. Fewer, cleaner
          calls beat scanning all 50.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function AccuracyScorecard({
  accuracy,
  embedded,
}: {
  accuracy?: AccuracySummary | null;
  embedded?: boolean;
}) {
  if (!accuracy) return null;
  const slices = accuracy.slices;
  const hasAny =
    accuracy.resolved > 0 ||
    (slices?.atOpen?.resolved ?? 0) > 0 ||
    (slices?.atClose?.resolved ?? 0) > 0;
  if (!hasAny) return null;

  return (
    <section
      className={
        embedded
          ? "rounded-xl border border-border bg-muted/30 px-3 py-3"
          : "mt-3 shrink-0 rounded-xl border border-border bg-card/60 px-3 py-3 sm:px-4"
      }
    >
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="font-serif text-base text-foreground">Track record</h3>
            <TrackRecordHelp />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Selectivity slices toward ~80%
            {accuracy.ready ? "" : " · warming up"}
          </p>
        </div>
        {accuracy.hitRate != null ? (
          <div className="text-right">
            <div className="font-mono text-base font-bold tabular-nums text-foreground">
              {pct(accuracy.hitRate)}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">close</div>
          </div>
        ) : null}
      </div>
      <div className={`grid gap-2 ${embedded ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
        <SliceCard label="At open" hint="Gap / open checkpoint" slice={slices?.atOpen} emphasize compact={embedded} />
        <SliceCard label="At close" hint="End-of-day checkpoint" slice={slices?.atClose} compact={embedded} />
        <SliceCard
          label="High ≥60"
          hint="Published Buy long/short tier"
          slice={slices?.highConviction}
          emphasize
          compact={embedded}
        />
        <SliceCard label="Mid 40–59" hint="Watch zone" slice={slices?.midConviction} compact={embedded} />
        <SliceCard label="Direct" hint="Company named" slice={slices?.direct} compact={embedded} />
        <SliceCard label="Sector" hint="Indirect read-through" slice={slices?.sector} compact={embedded} />
      </div>
    </section>
  );
}
