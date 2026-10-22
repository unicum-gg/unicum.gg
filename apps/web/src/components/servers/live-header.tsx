"use client";

import { useLocale } from "@onruntime/translations/react";
import { useTranslation } from "@/hooks/use-translation";
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
import { formatMoment, formatPlayers } from "./format";
import { useDisplayZone } from "./use-display-zone";
import { Hint } from "@/components/hint";

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
  until,
}: {
  region: Region;
  fallbackTotal: number | null;
  /** Last recorded per-cluster populations, busiest first. */
  fallbackClusters: { server: string; current: number | null }[];
  /** The weekly rhythm, to say whether right now is busy for the hour it is. */
  rhythm: ServerRhythmCell[];
  /** The newest sample on record. With no figure to show, this is what
   * separates a source that stopped answering from a region we have never
   * recorded, and the headline says which rather than printing a dash. */
  until: Date | null;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/servers/live-header");
  const zone = useDisplayZone();
  const live = usePlayersOnline(region);

  const { total, servers: clusters } = mergeServerOnline(
    region,
    live,
    fallbackTotal,
    fallbackClusters,
  );

  // A cluster we hold no figure for is left out rather than shown with a dash,
  // the same rule the top bar's tooltip follows: these are pills, not cells in
  // a column that needs its rows to line up.
  const measured = clusters.filter(
    (c): c is typeof c & { players: number } => c.players != null,
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

  // No figure means no figure, rather than a dash the size of the headline,
  // which reads as a broken number where the honest reading is that nobody is
  // publishing one. `current` is null for exactly one reason, the newest sample
  // being too old to describe now, so a recorded `until` here IS the source
  // having stopped and the page can date it. See `isServerRecordingStalled`.
  if (total == null) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-baseline gap-3">
          <span
            className="size-2 shrink-0 rounded-full bg-fd-muted-foreground/40"
            aria-hidden
          />
          <span className="font-heading text-xl font-bold md:text-2xl">
            {until
              ? t("last-recorded-on", { at: formatMoment(until, zone, locale) })
              : t("nothing-recorded-yet")}
          </span>
        </div>
        {until ? (
          <p className="text-sm text-fd-muted-foreground">
            {t("wargaming-has-not-published-since")}</p>
        ) : null}
      </div>
    );
  }

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
          {formatPlayers(total, locale)}
        </span>
        <span className="text-fd-muted-foreground">{t("players-online")}</span>
      </div>

      {deviation === null ? null : <DeviationNote deviation={deviation} />}

      {measured.length === 0 ? null : (
        <ul className="flex flex-wrap items-center justify-center gap-2">
          {measured.map((cluster) => (
            <li
              key={cluster.server}
              className="inline-flex items-baseline gap-2 rounded-md border border-fd-border bg-fd-card px-2.5 py-1 text-sm"
            >
              <Hint content={cluster.server}>
                <span className="font-medium">
                  {serverDisplayName(region, cluster.server)}
                </span>
              </Hint>
              <span className="tabular-nums text-fd-muted-foreground">
                {formatPlayers(cluster.players, locale)}
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
  const { t } = useTranslation("components/servers/live-header");
  const delta = Math.round((deviation - 1) * 100);
  if (Math.abs(delta) < 10) {
    return (
      <p className="text-sm text-fd-muted-foreground">
        {t("about-as-busy-as-usual")}</p>
    );
  }
  return (
    <p className="text-sm text-fd-muted-foreground">
      <span className={delta > 0 ? "text-brand font-medium" : "font-medium"}>
        {delta > 0 ? `+${delta}%` : `${delta}%`}
      </span>{" "}
      {t(delta > 0 ? "busier-than-usual" : "quieter-than-usual")}
    </p>
  );
}
