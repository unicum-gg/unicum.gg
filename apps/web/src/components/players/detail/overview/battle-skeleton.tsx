import { Skeleton } from "@/components/ui/skeleton";

/** One team's roster while the battle loads: the head, then a row per vehicle. */
function RosterSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="border-border/40 flex items-center gap-3 border-b px-4 py-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="ms-auto h-3 w-48" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="border-border/40 flex items-center gap-3 border-b px-4 py-2 last:border-0"
        >
          <Skeleton className="h-3.5" style={{ width: `${30 + ((index * 23) % 25)}%` }} />
          <Skeleton className="h-3.5 w-24" />
          <span className="ms-auto flex gap-3">
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-3.5 w-6" />
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-3.5 w-12" />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * A battle while it loads, in its own shape: the tabs and the battle's facts
 * above, both teams' rosters side by side below, so the rows a reader is
 * about to read are where they will be.
 */
export function BattleSkeleton({ rows = 15 }: { rows?: number }) {
  return (
    <div className="bg-background/40 border-border/40 border-t" aria-busy="true">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <Skeleton className="h-8 w-72 rounded-lg" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="divide-border/40 divide-y lg:grid lg:grid-cols-2 lg:gap-px lg:divide-y-0">
        <RosterSkeleton rows={rows} />
        <RosterSkeleton rows={rows} />
      </div>
    </div>
  );
}
