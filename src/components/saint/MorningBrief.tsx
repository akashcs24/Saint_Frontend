import { Sunrise } from "lucide-react";
import type { MorningBriefData } from "@/lib/market-data";

export function MorningBrief({ brief, embedded }: { brief: MorningBriefData; embedded?: boolean }) {
  const date = new Date(brief.generatedAt).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  });

  return (
    <section className={embedded ? "overflow-hidden rounded-xl border border-border" : "card-elevated overflow-hidden"}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-gold-soft text-gold">
              <Sunrise className="h-3.5 w-3.5" />
            </span>
            <h2 className="truncate font-serif text-xl text-foreground">Morning brief</h2>
          </div>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {date} · research snapshot
          </p>
        </div>
      </div>
      <div className="px-4 py-4 sm:px-5">
        <p className="text-sm font-medium leading-snug text-foreground">{brief.headline}</p>
        <ul className="mt-3 space-y-1.5">
          {brief.bullets.map((b) => (
            <li key={b} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
