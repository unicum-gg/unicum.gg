"use client";

import { useLocale } from "@onruntime/translations/react";
import { statLabel } from "@/components/stat-label";
import { Interpolate } from "@/components/interpolate";
import { useTranslation } from "@/hooks/use-translation";
import { useStatLabels } from "@/hooks/use-stat-labels";
import dynamic from "next/dynamic";
import Link from "@/components/link";
import { toRoman } from "roman-numerals";
import {
  DEFAULT_RATING_METRIC,
  RATING_METRIC_LABEL,
  DEFAULT_TANK_BATTLE_MODE,
  isRatingMetric,
  type PlayerAchievement,
  type PlayerTankDetail,
  type PlayerTankModeRecord,
  type RatingHistoryPoint,
  type TankRecordStats,
} from "@unicum.gg/shared";
import { MountOnVisible } from "@/components/mount-on-visible";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import { TankAwards } from "./awards";
import { TankModeSelect } from "./mode-select";
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
import { useTankMode } from "@/hooks/use-tank-mode";
import { tankModeName } from "@/components/game-name";


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
  loadout,
  modes = [],
}: {
  region: Region;
  detail: PlayerTankDetail;
  /** The two curves for this vehicle, over the same 90 days as the profile's. */
  ratingHistory: RatingHistoryPoint[];
  /** The medals earned on it, already trimmed to what was earned. Null when we
   * do not know them yet, which shows no section rather than an empty one. */
  awards: PlayerAchievement[] | null;
  /** How this player set the vehicle up. Rendered on the SERVER and handed
   * down, because it names equipment and crew perks out of the two catalogues
   * that never cross the wire (`SERVER_ONLY_NAMESPACES`). Absent for the
   * players we hold no loadout for, which is most of them: only the mod can
   * read one, and Wargaming publishes none. */
  loadout?: React.ReactNode;
  /** Where those battles were fought. Empty on a vehicle only ever taken into
   * Random Battles, which is most of them, and the pills then draw nothing. */
  modes?: PlayerTankModeRecord[];
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/players/detail/tanks/detail-panel");
  const { t: tGame } = useTranslation("game/vocabulary");
  const name = detail.shortName || detail.name || `#${detail.tankId}`;
  // The SAME `?mode=` the table beside it reads, so the Tanks tab has one
  // notion of which mode is being looked at: a row clicked from a Skirmish list
  // opens its record on Skirmish, and the link can be sent to somebody.
  //
  // A vehicle may hold nothing in the mode the URL names, which a hand-typed
  // link can do and a click never can (the list only shows what was played in
  // it). Then Random stands in, or the first mode this vehicle DOES have when
  // it was never taken into a random battle at all, rather than leaving the
  // panel on a block it has no numbers for.
  const [urlMode, setUrlMode] = useTankMode();
  const holdsUrlMode = modes.some((m) => m.mode === urlMode);
  const activeMode = holdsUrlMode
    ? urlMode
    : modes.some((m) => m.mode === DEFAULT_TANK_BATTLE_MODE)
      ? DEFAULT_TANK_BATTLE_MODE
      : (modes[0]?.mode ?? DEFAULT_TANK_BATTLE_MODE);
  const modeRecord = modes.find((m) => m.mode === activeMode) ?? null;
  // The table beside this panel is on a mode this vehicle was never taken into,
  // so the record stayed where it could. Said rather than left to be inferred
  // from a select that quietly disagrees with the list next to it.
  const notPlayedIn = !holdsUrlMode && modes.length > 0 ? urlMode : null;
  // The three blocks read the selected mode: the stat half of the record and
  // the stat half of a mode are the same shape, which is the whole reason
  // `TankRecordStats` was split out. `detail` stands in only while the record
  // predates the breakdown being collected, which fills in on the next refresh.
  const shown: TankRecordStats = modeRecord ?? detail;
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
        // `min-h-14` matches the vehicle table's header across from it, see
        // the note there: the two rules have to meet and their content alone
        // is four pixels apart.
        className="flex min-h-14 items-center justify-between gap-3 border-b border-fd-border"
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
          {/* The real figure from the client's dossier, shown beside the bars
              rather than instead of them: the bars say what was earned, this
              says how far the next one is, and a gun on its way to a first
              mark has the second without the first. */}
          {detail.moePercent == null ? null : (
            <span className="text-fd-muted-foreground text-sm tabular-nums">
              {detail.moePercent.toFixed(2)}%
            </span>
          )}
        </div>
      </PanelHeader>

      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        {/* What a mode's numbers are, where the name alone does not say it: a
            retired ladder is an archive, and Fallout's battles are counted once
            per vehicle fielded. */}
        {notPlayedIn ? (
          <p className={styles.mutedDescription}>
            {t("never-played-in", { mode: tankModeName(notPlayedIn, tGame) })}
          </p>
        ) : null}
        {modeRecord?.retired || modeRecord?.multiVehicle ? (
          <p className={styles.mutedDescription}>
            {modeRecord.multiVehicle
              ? t("mode-multi-vehicle")
              : t("mode-retired")}
          </p>
        ) : null}
        {/* The mode rides the first block's heading rather than a headed row of
            its own. It governs all three blocks below, so a line naming it
            separately was a heading for a control, stacked above the heading
            of the thing the control acts on. The select says what it does by
            sitting on the numbers it changes, which is how the table beside it
            already carries its own copy, across from the count it narrows. */}
        <Block
          title={t("general-parameters")}
          rows={generalRows(shown, locale)}
          action={
            modes.length > 0 ? (
              <TankModeSelect
                options={modes.map((m) => ({
                  mode: m.mode,
                  // One vehicle, so a count beside each mode would read "1"
                  // eleven times. The select leaves it out at zero.
                  tanks: 0,
                  retired: m.retired,
                  multiVehicle: m.multiVehicle,
                }))}
                // The URL's mode, not the one the blocks fell back to. They
                // differ only when this vehicle holds nothing in what the URL
                // names, and the note above says so; showing the fallback here
                // instead would make picking it a no-op (Radix fires nothing
                // for the value already selected), leaving the reader no way
                // out of the mismatch from the control that caused it.
                active={urlMode}
                onSelect={setUrlMode}
                // Named here because its heading no longer is: "General
                // parameters" says what the block holds, not what the control
                // does, so the accessible name has to come from the control.
                label={t("by-mode")}
                // Narrower than the table's, which appends a vehicle count to
                // every name and needs the room.
                className="w-48 shrink-0"
              />
            ) : null
          }
        />
        <Block title={t("average-score-per-battle")} rows={averageRows(shown, locale)} />
        <Block title={t("record-score")} rows={recordRows(shown, locale)} />

        <div>
          {/* The same inline picker the profile's chart carries: the metric is
              a reading preference, so it belongs where the reader is looking
              rather than only in the navbar. */}
          <h4 className="mb-1.5 text-sm font-semibold">
            <Interpolate
              template={t("metric-progression")}
              values={{ metric: <RatingMetricInlineSelect /> }}
            />
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
              {t("not-enough-history-on-this")}</p>
          )}
        </div>

        {/* Above the medals, which is not the game's own order and is the
            right one here: the record above is what Wargaming counted, this
            is what the player chose, and it is the half somebody reads a
            stranger's vehicle page for. A cabinet of medals is a nice thing
            to have seen, not a thing anybody came to copy. */}
        {loadout}

        {/* Rendered straight from the payload: the medals come stored, so
            there is nothing to wait for and nothing to defer. */}
        {awards ? <TankAwards awards={awards} locale={locale} /> : null}

        <p className={`text-xs ${styles.mutedText}`}>
          {t("updated")} <RelativeTime date={new Date(detail.updatedAt)} />
        </p>
      </div>
    </div>
  );
}

function Block({
  title,
  rows,
  action,
}: {
  title: string;
  rows: DetailRow[];
  /** A control for the block, on the heading's own line.
   *
   * It keeps the block alive on its own: a block with no rows is normally
   * nothing worth drawing, but the one control that can change which rows
   * there are must not disappear with them. That is exactly the state a reader
   * reaches by picking a mode this vehicle was never taken into, and losing
   * the select there would leave them no way back out of it. */
  action?: React.ReactNode;
}) {
  const { t: tStats } = useStatLabels();
  if (rows.length === 0 && !action) return null;
  return (
    <div>
      {/* One line, like the panel's own header: the rows below are a
          label-and-number list where a heading earns its line, and a single
          control does not. */}
      <div className="mb-1.5 flex min-h-8 flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        {action}
      </div>
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
              {r.metric ? <RatingMetricInlineSelect /> : statLabel(r.label, tStats)}
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
