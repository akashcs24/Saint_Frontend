import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/saint/Header";
import { NiftyPaperTradePanel } from "@/components/saint/NiftyPaperTradePanel";

export const Route = createFileRoute("/paper")({
  loader: () => null,
  pendingMs: 0,
  head: () => ({
    meta: [
      { title: "Paper Trade · Saint Infinite Market" },
      {
        name: "description",
        content:
          "Nifty ATM CE paper trades — decline×4, SL/TSL, and sync-cross buckets with Fyers fills.",
      },
    ],
  }),
  component: PaperPage,
});

function PaperPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header guide="dashboard" />
      <main className="mx-auto flex max-w-[1400px] flex-col gap-3 px-3 py-4 sm:px-6 sm:py-6">
        <div className="px-0.5">
          <h1 className="font-serif text-lg text-foreground">Paper Trade</h1>
          <p className="text-[11px] text-muted-foreground">
            ₹1L per book · decline×4, SL/TSL, sync cross — track equity over the month.
          </p>
        </div>
        <NiftyPaperTradePanel />
      </main>
    </div>
  );
}
