import { Link } from "@tanstack/react-router";

export function SaintLogo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`group inline-flex min-w-0 items-center gap-2 sm:gap-2.5 ${className}`}>
      <img
        src="/saint-logo.png"
        alt=""
        width={36}
        height={36}
        className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-border transition-transform group-hover:scale-105 sm:h-9 sm:w-9"
      />
      <div className="flex min-w-0 flex-col leading-none">
        <span className="font-logo text-xl text-foreground sm:text-2xl">Saint</span>
        <span className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:text-[10px] sm:tracking-[0.18em]">
          Infinite Market
        </span>
      </div>
    </Link>
  );
}
