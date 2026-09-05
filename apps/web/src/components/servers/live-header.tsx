"use client";

import {
  mergeServerOnline,
  rhythmDeviation,
  serverDisplayName,
  type ServerRhythmCell,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { useHydrated } from "@/hooks/use-hydrated";
import { usePlayersOnline } from "@/hooks/use-players-online";
import { cn } from "@/lib/utils";
import { formatPlayers } from "./format";

/**
 * The live population, straight from Wargaming over SSE.
 *
 * The rest of the page reads the recorded history, which is at best a few
 * minutes old; this reads the same instant the game does, so the headline
 * figure is never behind the one a player sees in their client. It falls back
 * to the last recorded total until the first frame lands, so the number is
 * there in the prerendered HTML rather than appearing a second later.
 */
export function ServersLiveHeader({
  region,
  fallbackTotal,
  fallbackClusters,
  rhythm,
}: {
  region: Region;
  fallbackTotal: number | null;
  /** Last recorded per-cluster populations, busiest first. */
  fallbackClusters: { server: string; current: number | null }[];
  /** The weekly rhythm, to say whether right now is busy for the hour it is. */
  rhythm: ServerRhythmCell[];
}) {
  const live = usePlayersOnline(region);

  const { total, servers: clusters } = mergeServerOnline(
    region,
    live,
    fallbackTotal,
    fallbackClusters,
  );

  // Against the average for this weekday and hour, so "busy" means busy for a
  // Sunday evening rather than busy compared with a Tuesday at dawn.
  //
  // Only once hydrated, because it reads the clock. The page is prerendered and
  // revalidated on its own schedule, so computing this on the server would bake
  // the revalidation moment's cell into the HTML and then contradict it on
  // hydration: a sentence claiming the game is busy for a Tuesday dawn, read by
  // someone opening the page on a Sunday evening.
  const hydrated = useHydrated();
  const deviation =
    !hydrated || total == null
      ? null
      : rhythmDeviation(rhythm, new Date(), total);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            live ? "bg-brand animate-pulse" : "bg-fd-muted-foreground/40",
          )}
          aria-hidden
        />
        <span className="font-heading text-4xl font-bold tabular-nums md:text-5xl">
          {total == null ? "—" : formatPlayers(total)}
        </span>
        <span className="text-fd-muted-foreground">players online</span>
      </div>

      {deviation === null ? null : <DeviationNote deviation={deviation} />}

      {clusters.length === 0 ? null : (
        <ul className="flex flex-wrap items-center justify-center gap-2">
          {clusters.map((cluster) => (
            <li
              key={cluster.server}
              className="inline-flex items-baseline gap-2 rounded-md border border-fd-border bg-fd-card px-2.5 py-1 text-sm"
            >
              <span className="font-medium" title={cluster.server}>
                {serverDisplayName(region, cluster.server)}
              </span>
              <span className="tabular-nums text-fd-muted-foreground">
                {cluster.players == null ? "—" : formatPlayers(cluster.players)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** How far the live count sits from what this hour usually holds. Anything
 * inside a tenth reads as "about usual": the sampling is five-minutely and the
 * average is over four weeks, so a few percent is noise, not news. */
function DeviationNote({ deviation }: { deviation: number }) {
  const delta = Math.round((deviation - 1) * 100);
  if (Math.abs(delta) < 10) {
    return (
      <p className="text-sm text-fd-muted-foreground">
        About as busy as usual for this time of week.
      </p>
    );
  }
  return (
    <p className="text-sm text-fd-muted-foreground">
      <span className={delta > 0 ? "text-brand font-medium" : "font-medium"}>
        {delta > 0 ? `+${delta}%` : `${delta}%`}
      </span>{" "}
      {delta > 0 ? "busier" : "quieter"} than usual for this time of week.
    </p>
  );
}
