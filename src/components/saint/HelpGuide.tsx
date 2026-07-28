import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type HelpGuidePage = "dashboard" | "stock";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-b border-border/70 pb-4 last:border-b-0 last:pb-0">
      <h3 className="font-serif text-base text-foreground">{title}</h3>
      <div className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "bull" | "bear" | "gold" }) {
  const cls =
    tone === "bull"
      ? "bg-bull-soft text-bull"
      : tone === "bear"
        ? "bg-bear-soft text-bear"
        : tone === "gold"
          ? "bg-gold-soft text-gold"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  );
}

function Combo({ tags, meaning }: { tags: ReactNode; meaning: string }) {
  return (
    <div className="rounded-xl border border-border/80 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">{tags}</div>
      <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{meaning}</p>
    </div>
  );
}

function DashboardHelp() {
  return (
    <div className="space-y-5">
      <Section title="What this board is">
        <p>
          Saint turns market news into a simple overnight or live call: what may move, which way, and how
          strong the evidence is. It is not a broker order book or a buy alert service.
        </p>
      </Section>

      <Section title="Layout">
        <p>
          <strong className="font-medium text-foreground">Live</strong> — overnight calls still validating,
          plus fresh headlines after 9:15.
        </p>
        <p>
          <strong className="font-medium text-foreground">Past</strong> — already reacted names, split into{" "}
          <strong className="font-medium text-foreground">Still watching</strong> (high conv / live thesis /
          bookmarks) on top and <strong className="font-medium text-foreground">Settled</strong> (priced in,
          invalidated, or low evidence) below.
        </p>
        <p>
          <strong className="font-medium text-foreground">On phone</strong> — Live board stays open;
          secondary lists, Past settled, and Market context tuck into accordions so the screen stays
          focused on what to trade.
        </p>
      </Section>

      <Section title="How to read a card">
        <p>
          <Tag tone="bull">Buy long</Tag> / <Tag tone="bull">Buy short</Tag> — the executable lean from
          news + bias. Shorts are framed as “buy short” so the action stays clear without red signal paint.
        </p>
        <p>
          Colour is conviction, not direction:{" "}
          <Tag tone="bull">≥60 green = Buy long / Buy short</Tag> ·{" "}
          <Tag tone="gold">40–59 gold = Watch</Tag> · <Tag>&lt;40 grey = Watch</Tag>. No red on
          signals.
        </p>
        <p>
          Tap the <strong className="font-medium text-foreground">bookmark</strong> on a card to pin it.
          Pinned names stay in the Pinned strip even if they fall off Live — so you can monitor exits.
        </p>
        <p>
          <Tag tone="bear">Invalidated</Tag> / <Tag tone="gold">Fading</Tag> demote Action to Watch with an
          exit note — don’t keep a Buy lit after the path kills the overnight call.
        </p>
        <p>
          <Tag tone="gold">Vol confirming</Tag> / <Tag>No demand</Tag> / <Tag tone="bull">Open flow</Tag> /
          <Tag tone="gold">Awaiting confirm</Tag> — volume/price confirmation layer on Action (not Bias).
          Buy long/short only lights when tape agrees; Telegram ENTRY follows the same gate.
        </p>
        <p>
          Green/red % next to price — <strong className="font-medium text-foreground">actual</strong> day
          move (price can still go red).
        </p>
        <p>
          <strong className="font-medium text-foreground">Conv</strong> — conviction 0–100. Higher means more
          independent evidence. Sort is usually high → low.
        </p>
        <p>
          <Tag>Revising</Tag> — overnight bias can still change until 9:15.{" "}
          <Tag>Locked</Tag> — call frozen at the open for scoring.
        </p>
      </Section>

      <Section title="Thesis health (live path)">
        <p>During cash hours, for overnight calls:</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <Tag tone="bull">Confirming</Tag> — price is still acting with the call
          </li>
          <li>
            <Tag tone="gold">Fading</Tag> — opened with the call, then reversing
          </li>
          <li>
            <Tag tone="bear">Invalidated</Tag> — opened against the call
          </li>
          <li>
            <Tag>Cooling</Tag> — flat / no clear follow-through yet
          </li>
        </ul>
        <p className="pt-1">
          “Confirming” is not the same as scorecard “Confirmed”. Confirming = still holding right now.
          Confirmed = final verdict after open / close checks.
        </p>
      </Section>

      <Section title="Useful tag combinations">
        <div className="space-y-2">
          <Combo
            tags={
              <>
                <Tag tone="bull">Buy long</Tag>
                <Tag tone="bull">Confirming</Tag>
              </>
            }
            meaning="Long lean with strong colour, and price is still acting with the call."
          />
          <Combo
            tags={
              <>
                <Tag tone="bull">Buy short</Tag>
                <Tag tone="bull">Confirming</Tag>
              </>
            }
            meaning="Short lean (still green when conviction is high) and price is following down."
          />
          <Combo
            tags={
              <>
                <Tag tone="gold">Buy long</Tag>
                <Tag tone="gold">Fading</Tag>
              </>
            }
            meaning="Medium conviction long — opened with the call, now reversing. Be careful."
          />
          <Combo
            tags={
              <>
                <Tag>Watch · long</Tag>
                <span className="font-mono text-[11px] text-foreground">Conv &lt;40</span>
              </>
            }
            meaning="Lean exists but evidence is thin — grey, not a trade cue."
          />
        </div>
      </Section>
    </div>
  );
}

function StockHelp() {
  return (
    <div className="space-y-5">
      <Section title="What this page is">
        <p>
          Left side is the stock call and structure. Right side is the chart and company news. Read the
          thesis box first — that is the live overnight health check.
        </p>
      </Section>

      <Section title="Bias, action, conviction">
        <p>
          <strong className="font-medium text-foreground">Bias</strong> — overall lean from linked news
          (bullish / bearish / mixed).
        </p>
        <p>
          <strong className="font-medium text-foreground">Action</strong> —{" "}
          <Tag tone="bull">Buy long</Tag> or <Tag tone="bull">Buy short</Tag> only when conviction ≥ 60
          and evidence is clean; else Watch / Already priced / Already fallen. Colour follows conviction
          — never red on the signal itself.
        </p>
        <p>
          <strong className="font-medium text-foreground">Conviction</strong> — 0–100 strength of evidence
          (sources, agreement, session timing, structure/tape gates). High means clearer evidence, not
          “must buy”.
        </p>
        <p>
          <strong className="font-medium text-foreground">Impact</strong> — how heavy the linked stories feel
          (1–10), separate from conviction.
        </p>
      </Section>

      <Section title="Signal vs price colour">
        <p>
          The top pill and Action box are the trade lean (Buy long / Buy short / Watch). Day % next to LTP
          can still go red or green — that is price, not the signal paint.
        </p>
      </Section>

      <Section title="Thesis health">
        <p>
          <Tag tone="bull">Confirming</Tag> means the path still matches the overnight call. It can stay
          Confirming all day if the thesis holds — it does not turn into “Confirmed”.
        </p>
        <p>
          <strong className="font-medium text-foreground">Gap vs prior close</strong> — today’s open vs last
          session close (the overnight gap you see on the 1D chart).
        </p>
      </Section>

      <Section title="Key levels">
        <p>
          Nearby resistance, support, and prior VWAP as a simple ladder. Useful for context next to action
          notes like “breakout” or “mid-range”.
        </p>
      </Section>

      <Section title="Useful combinations">
        <div className="space-y-2">
          <Combo
            tags={
              <>
                <span className="text-[11px] font-semibold text-bull">Bias Bullish</span>
                <span className="text-[11px] font-semibold text-bull">Buy long</span>
                <Tag tone="bull">Confirming</Tag>
              </>
            }
            meaning="Overnight lean is up, action agrees, and live price is still with the call."
          />
          <Combo
            tags={
              <>
                <span className="text-[11px] font-semibold text-bull">Buy short</span>
                <Tag tone="bear">Invalidated</Tag>
              </>
            }
            meaning="Short lean from news, but the open went against the overnight call — trust the thesis box first."
          />
          <Combo
            tags={
              <>
                <span className="text-[11px] font-semibold text-foreground">Conv High</span>
                <Tag>Locked</Tag>
              </>
            }
            meaning="Stronger evidence, and the overnight call was frozen at 9:15 for scoring."
          />
        </div>
      </Section>
    </div>
  );
}

export function HelpGuide({ page }: { page: HelpGuidePage }) {
  const isDash = page === "dashboard";
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={isDash ? "Help: how to read the dashboard" : "Help: how to read this stock page"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent"
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-border px-5 py-4 text-left sm:px-6">
          <SheetTitle className="font-serif text-xl text-foreground">
            {isDash ? "How to read the dashboard" : "How to read this stock"}
          </SheetTitle>
          <SheetDescription className="text-[12px] text-muted-foreground">
            {isDash
              ? "Tags, panels, and what combinations mean in plain words."
              : "Bias, action, conviction, thesis health, and key levels."}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {isDash ? <DashboardHelp /> : <StockHelp />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
