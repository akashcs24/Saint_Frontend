import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { AccuracySummary, IndexQuote, MorningBriefData, NewsItem } from "@/lib/market-data";
import { MorningBrief } from "@/components/saint/MorningBrief";
import { NewsFeed } from "@/components/saint/NewsFeed";
import { AccuracyScorecard } from "@/components/saint/AccuracyScorecard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from "@/lib/use-mobile";

const SHOWN = ["NIFTY", "BANKNIFTY", "SENSEX", "VIX"];

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CompactIndices({ indices, dense }: { indices: IndexQuote[]; dense?: boolean }) {
  const items = SHOWN.map((key) => indices.find((i) => i.key === key)).filter(
    (x): x is IndexQuote => Boolean(x),
  );
  if (!items.length) return null;

  if (dense) {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((idx) => {
          const up = idx.changePct >= 0;
          return (
            <span key={idx.key} className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums">
              <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {idx.key === "BANKNIFTY" ? "BN" : idx.key === "NIFTY" ? "Nifty" : idx.key}
              </span>
              <span className={up ? "text-bull" : "text-bear"}>
                {up ? "+" : ""}
                {idx.changePct.toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60 border-b border-border">
      {items.map((idx) => {
        const up = idx.changePct >= 0;
        return (
          <div key={idx.key} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {idx.key === "BANKNIFTY" ? "Bank Nifty" : idx.key}
            </span>
            <div className="text-right">
              <div className="font-mono text-xs font-semibold tabular-nums text-foreground">
                {fmt(idx.ltp)}
              </div>
              <div
                className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${up ? "text-bull" : "text-bear"}`}
              >
                {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {up ? "+" : ""}
                {idx.changePct.toFixed(2)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContextSections({
  indices,
  brief,
  news,
  accuracy,
}: {
  indices: IndexQuote[];
  brief: MorningBriefData;
  news: NewsItem[];
  accuracy?: AccuracySummary | null;
}) {
  return (
    <Accordion type="multiple" defaultValue={["track"]} className="rounded-xl border border-border px-2">
      <AccordionItem value="track">
        <AccordionTrigger className="py-2.5 text-xs hover:no-underline">Track record</AccordionTrigger>
        <AccordionContent className="pb-2">
          <AccuracyScorecard accuracy={accuracy} embedded />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="brief">
        <AccordionTrigger className="py-2.5 text-xs hover:no-underline">Morning brief</AccordionTrigger>
        <AccordionContent className="pb-2">
          <MorningBrief brief={brief} embedded />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="pulse">
        <AccordionTrigger className="py-2.5 text-xs hover:no-underline">
          Market pulse ({news.length})
        </AccordionTrigger>
        <AccordionContent className="pb-2">
          <div className="max-h-[40vh] overflow-y-auto">
            <NewsFeed items={news} embedded />
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="indices">
        <AccordionTrigger className="py-2.5 text-xs hover:no-underline">Index levels</AccordionTrigger>
        <AccordionContent className="pb-2">
          <CompactIndices indices={indices} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function MarketContextPanel({
  indices,
  brief,
  news,
  accuracy,
  compact = false,
}: {
  indices: IndexQuote[];
  brief: MorningBriefData;
  news: NewsItem[];
  accuracy?: AccuracySummary | null;
  /** Tighter chrome when seated beside session boards */
  compact?: boolean;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <aside className="card-elevated overflow-hidden">
        <Accordion type="multiple" defaultValue={[]} className="w-full">
          <AccordionItem value="context" className="border-b-0">
            <AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-5">
              <div className="min-w-0 flex-1 pr-2 text-left">
                <div className="font-serif text-lg text-foreground">Market context</div>
                <div className="mt-1">
                  <CompactIndices indices={indices} dense />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 sm:px-4">
              <ContextSections indices={indices} brief={brief} news={news} accuracy={accuracy} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </aside>
    );
  }

  return (
    <aside
      className={`card-elevated flex h-full min-h-0 flex-col overflow-hidden ${
        compact ? "" : ""
      }`}
    >
      <div className={`border-b border-border ${compact ? "px-3 py-2.5" : "px-4 py-3 sm:px-5"}`}>
        <h2 className={`font-serif text-foreground ${compact ? "text-base" : "text-xl"}`}>
          Market context
        </h2>
        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Indices · track · brief · pulse
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CompactIndices indices={indices} />
        <div className={`space-y-3 ${compact ? "p-2.5" : "p-3 sm:p-4"}`}>
          <AccuracyScorecard accuracy={accuracy} embedded />
          <MorningBrief brief={brief} embedded />
          <div className="min-h-[160px]">
            <NewsFeed items={news} embedded />
          </div>
        </div>
      </div>
    </aside>
  );
}
