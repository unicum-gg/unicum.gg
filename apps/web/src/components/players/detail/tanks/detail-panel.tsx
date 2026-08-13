"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { toRoman } from "roman-numerals";
import {
  DEFAULT_RATING_METRIC,
  RATING_METRIC_LABEL,
  isRatingMetric,
  type PlayerAchievement,
  type PlayerTankDetail,
  type RatingHistoryPoint,
} from "@unicum.gg/shared";
import { MountOnVisible } from "@/components/mount-on-visible";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import { TankAwards } from "./awards";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import type { Region } from "@unicum.gg/wargaming";
import { PanelHeader } from "@/components/panel";
import { NationFlag } from "@/components/tanks/nation-flag";
import { MoEIcon, MOE_COLORS } from "@/components/tanks/moe-icon";
import { MoMIcon } from "@/components/tanks/mom-icon";
import { RelativeTime } from "@/components/relative-time";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import ROUTES from "@/constants/routes";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import {
  averageRows,
  generalRows,
  recordRows,
  type DetailRow,
} from "./detail-rows";


// Same treatment as the profile's own chart: recharts is ~40% of the page's JS,
// so it is fetched when the chart actually mounts rather than shipped with the
// panel. `ssr: false` keeps it out of the initial graph; nothing indexable is
// lost, a chart carries no text.
const PlayerRatingChart = dynamic(
  () =>
    import("@/components/players/detail/overview/rating-chart").then(
      (m) => m.PlayerRatingChart,
    ),
  { ssr: false, loading: () => <div className="h-56 w-full" /> },
);

/**
 * One player's record on one vehicle, the game's Service Record for that pair.
 *
 * Two blocks in the game's own order, so someone who knows the client finds
 * what they expect where they expect it, and a third the client has no notion
 * of: the ratings this player earned on this tank.
 */
export function PlayerTankDetailPanel({
  region,
  detail,
  ratingHistory,
  awards,
}: {
  region: Region;
  detail: PlayerTankDetail;
  /** The two curves for this vehicle, over the same 90 days as the profile's. */
  ratingHistory: RatingHistoryPoint[];
  /** The medals earned on it, already trimmed to what was earned. Null when we
   * do not know them yet, which shows no section rather than an empty one. */
  awards: PlayerAchievement[] | null;
}) {
  const name = detail.shortName || detail.name || `#${detail.tankId}`;
  const [storedMetric] = useCookie(
    STORAGE.COOKIES.RATING,
    DEFAULT_RATING_METRIC,
  );
  const metric = isRatingMetric(storedMetric)
    ? storedMetric
    : DEFAULT_RATING_METRIC;
  // A day with no battle on this tank carries no session value, so a vehicle
  // parked for the window charts as a flat line with nothing on it. Below two
  // points there is no line at all, and the panel says so instead.
  const chartable = ratingHistory.filter(
    (p) => p.lifetime[metric] !== null,
  ).length;
  return (
    <div className="flex h-full flex-col">
      {/* Its own bottom border rather than the site's `screen-line-*`, which
          draws a 200vw rule and would run straight across the table beside
          it. */}
      <PanelHeader
        screenLines={false}
        className="flex items-center justify-between gap-3 border-b border-fd-border"
      >
        {/* Tier, flag and class icon ahead of the name, the way the tank page's
            own hero reads them. They say what a "Tier VIII · CZECH · Premium"
            line used to spell out, in the width of three glyphs. */}
        <div className="flex min-w-0 items-center gap-2">
          {detail.tier ? (
            <span className="shrink-0 text-sm font-semibold text-brand">
              {toRoman(detail.tier)}
            </span>
          ) : null}
          {detail.nation ? (
            <NationFlag
              nation={detail.nation}
              region={region}
              variant="flag"
              className="shrink-0"
            />
          ) : null}
          {detail.type ? (
            <VehicleTypeIcon
              type={detail.type}
              premium={detail.isPremium}
              className="shrink-0"
            />
          ) : null}
          <h3 className="truncate text-lg font-semibold">
            {detail.slug ? (
              <Link
                href={ROUTES.TANK(region, detail.slug)}
                className="hover:underline"
                // The vehicle itself, not this player on it: the server
                // averages, the expected values, the best players.
                title={`${detail.name} on ${region.toUpperCase()}`}
              >
                {name}
              </Link>
            ) : (
              name
            )}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {detail.mom && detail.mom >= 1 && detail.mom <= 4 ? (
            <MoMIcon mastery={detail.mom as 1 | 2 | 3 | 4} />
          ) : null}
          {detail.moe && detail.moe >= 1 && detail.moe <= 3 ? (
            <MoEIcon
              bars={detail.moe as 1 | 2 | 3}
              color={MOE_COLORS[detail.moe as 1 | 2 | 3]}
            />
          ) : null}
        </div>
      </PanelHeader>

      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        <Block title="General parameters" rows={generalRows(detail)} />
        <Block title="Average score per battle" rows={averageRows(detail)} />
        <Block title="Record score" rows={recordRows(detail)} />

        <div>
          {/* The same inline picker the profile's chart carries: the metric is
              a reading preference, so it belongs where the reader is looking
              rather than only in the navbar. */}
          <h4 className="mb-1.5 text-sm font-semibold">
            <RatingMetricInlineSelect /> progression
          </h4>
          {chartable >= 2 ? (
            <MountOnVisible placeholder={<div className="h-56 w-full" />}>
              <PlayerRatingChart
                data={ratingHistory}
                metricLabel={RATING_METRIC_LABEL[metric]}
                metric={metric}
              />
            </MountOnVisible>
          ) : (
            <p className={styles.mutedDescription}>
              Not enough history on this tank yet. It needs at least two
              snapshots in the last 90 days to draw a line.
            </p>
          )}
        </div>

        {/* Last, the way the game orders its own vehicle record. Rendered
            straight from the payload: the medals come stored, so there is
            nothing to wait for and nothing to defer. */}
        {awards ? <TankAwards awards={awards} /> : null}

        <p className={`text-xs ${styles.mutedText}`}>
          Updated <RelativeTime date={new Date(detail.updatedAt)} />
        </p>
      </div>
    </div>
  );
}

function Block({ title, rows }: { title: string; rows: DetailRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h4 className="mb-1.5 text-sm font-semibold">{title}</h4>
      {/* Dotted leaders rather than a rule under every line, the way the tank
          page's own characteristics read: the eye follows one label to one
          number instead of crossing a ladder. */}
      <dl className="flex flex-col gap-0.5">
        {rows.map((r) => (
          <div
            key={r.label}
            data-rating-col={r.metric}
            className={cn("flex items-baseline gap-2 text-sm", r.sub && "pl-3")}
          >
            <dt
              className={cn(
                styles.mutedText,
                r.sub && "text-fd-muted-foreground/75",
              )}
            >
              {/* A rating line labels itself with the picker: the label is the
                  metric's name, so making it the control costs no room and puts
                  the switch on the number it changes. All three rows carry one,
                  and the CSS shows the one whose metric is selected. */}
              {r.metric ? <RatingMetricInlineSelect /> : r.label}
            </dt>
            <span
              aria-hidden
              className="mb-1 flex-1 self-end border-b border-dotted border-fd-border"
            />
            <dd
              className="font-medium whitespace-nowrap tabular-nums"
              style={r.color ? { color: r.color } : undefined}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
