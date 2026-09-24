"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  boardRateOf,
  climbTo,
  onslaughtRankIcon,
  onslaughtRankOf,
  pointsAfter,
  RATING_COLOR_CLASS,
  ONSLAUGHT_RANK_COLOR,
} from "@unicum.gg/shared";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { Input } from "@/components/ui/input";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import {
  buildPredictModel,
  neighbourhoodRate,
  stepsAbove,
} from "@/components/players/list/onslaught/predict/model";
import {
  predictBattlesStore,
  predictPaceStore,
  predictPointsStore,
  predictRateStore,
} from "@/components/players/list/onslaught/predict/params";
import {
  Field,
  Figure,
} from "@/components/players/list/onslaught/predict/figures";
import { PredictLadder } from "@/components/players/list/onslaught/predict/ladder";
import { standingName } from "@/components/players/list/onslaught/predict/rank-name";
import type { OnslaughtRow } from "@/components/players/list/onslaught/row";
import type {
  OnslaughtPreviousSeason,
  OnslaughtSeasonPoint,
} from "@/components/players/list/onslaught/season-race";

const INT = { maximumFractionDigits: 0 } as const;
const TWO_DP = { maximumFractionDigits: 2 } as const;

/**
 * A whole number as a reader writes one, with the empty and the half-typed read
 * as "not answered yet" rather than as zero.
 *
 * Separators are dropped rather than rejected: the figures being copied in are
 * the ones the game and this very page print, and both group their thousands (a
 * French page renders 1 560 with a non-breaking space, an English one with a
 * comma), so a field that only accepted bare digits would refuse the paste it
 * exists to receive.
 */
function parseCount(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const value = Number(raw.replace(/[\s,' ]/g, ""));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * A rate, where the comma is a decimal point rather than a thousands mark.
 *
 * The opposite reading from the one above, and it has to be: half the locales
 * this page is published in write 3,37 for what the other half writes 3.37, and
 * nothing here is ever in the thousands.
 */
function parseRate(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const value = Number(raw.replace(/[\s ]/g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** A measured figure as a field shows it: plain, so it survives being read
 * back, and two decimals, which is as fine as any of these mean anything. */
function field(value: number, decimals = 2): string {
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
}

const nullSnapshot = () => null;

/**
 * Which rank a player ends the season on, from where they stand today.
 *
 * The board shows the two ranks it reaches, Champion and Legend, and the panels
 * above say what those cost. This is the mode's other four: a season is climbed
 * from Iron E through twenty divisions before the leaderboard knows a player
 * exists, which is where nearly everyone asking how they are doing actually is.
 * So the question is not whether they will be a Legend, it is where on the whole
 * ladder they land, and the answer for most readers is a division of Silver or
 * Gold rather than a place on this page's own table.
 *
 * Three things make it an answer rather than a subtraction. The ladder is the
 * game's own and mostly arithmetic (four ranks of five divisions a hundred
 * points apart, then Champion at the board's floor), so every step below the
 * board can be named exactly. The Legend step cannot: it is the top 15% of the
 * field by position, so its price climbs all season, and what the last row is
 * measured against is that bar PROJECTED to the day the season settles. And the
 * rate is measured on the leaderboard rather than over the whole season,
 * because the climb to Champion pays around fourteen points a battle against
 * the two and a half it pays after, so the obvious division flatters a
 * prediction by a factor of two and a half.
 *
 * It is a condition rather than a prophecy, and says so: play this much at this
 * rate and this is where you land.
 */
export function OnslaughtRankPredictor({
  results,
  curve,
  previous,
  seasonStart,
  seasonEnd,
  seasonOrdinal,
  assetsRef,
}: {
  results: OnslaughtRow[];
  curve: OnslaughtSeasonPoint[];
  /** How the last season ended, which is the only precedent the projected
   * Legend bar can be judged against. */
  previous: OnslaughtPreviousSeason | null;
  seasonStart: string | null;
  seasonEnd: string | null;
  seasonOrdinal: string | null;
  assetsRef: string | null;
}) {
  const { num, date } = useFormat();
  const { t } = useTranslation("components/players/list/onslaught/predict/index");
  const { t: tGame } = useTranslation("game/vocabulary");

  // Read from the URL rather than held beside it, so an answer is a link. The
  // server snapshot is null, which is what the prerendered HTML shows: empty
  // fields, matching hydration, filled the moment React re-reads the URL.
  const battlesRaw = useSyncExternalStore(
    predictBattlesStore.subscribe,
    predictBattlesStore.read,
    nullSnapshot,
  );
  const pointsRaw = useSyncExternalStore(
    predictPointsStore.subscribe,
    predictPointsStore.read,
    nullSnapshot,
  );
  const paceRaw = useSyncExternalStore(
    predictPaceStore.subscribe,
    predictPaceStore.read,
    nullSnapshot,
  );
  const rateRaw = useSyncExternalStore(
    predictRateStore.subscribe,
    predictRateStore.read,
    nullSnapshot,
  );

  const battles = parseCount(battlesRaw);
  const points = parseCount(pointsRaw);

  const model = useMemo(
    () => buildPredictModel({ results, curve, seasonStart, seasonEnd }),
    [results, curve, seasonStart, seasonEnd],
  );

  // What a battle is worth to them: their own record where it can carry the
  // question, the board's own neighbourhood where it cannot.
  const own = useMemo(
    () =>
      battles == null || points == null
        ? null
        : boardRateOf({
            battles,
            points,
            entryBar: model.entryBar,
            entryBattles: model.entryBattles,
          }),
    [battles, points, model],
  );
  const measured =
    own ?? (points == null ? null : neighbourhoodRate(results, points));
  const rate = parseRate(rateRaw) ?? measured;

  // Under the bar, every battle they have played was spent getting to it, so
  // their own record measures that leg exactly. The board's median is the
  // fallback for a reader who has barely started, and the board rate the last
  // one, for a season we hold no arrivals of: it understates the climb and so
  // overstates the battles, which is the safe direction to be wrong in.
  const qualifyingRate =
    points != null && battles != null && points < model.entryBar && battles >= 20
      ? points / battles
      : model.qualifyingRate > 0
        ? model.qualifyingRate
        : (rate ?? 0);

  // Their own pace so far, which their two figures do give: battles over the
  // days the season has run. The field is theirs to correct, since the past is
  // a poor witness for a reader who has just decided to push.
  const ownPace =
    battles != null && model.seasonDays != null ? battles / model.seasonDays : null;
  const pace = parseRate(paceRaw) ?? ownPace;

  const standing = useMemo(() => {
    if (points == null) return null;
    const ahead = results.filter((r) => r.rating > points).length;
    return {
      rank: ahead + 1,
      total: results.length,
      ranked: points >= model.entryBar,
      now: onslaughtRankOf(points, model.legendNow),
    };
  }, [points, results, model]);

  // Where the season ends for them, at this rate and this pace. The projection
  // is what names the finishing rank, and the same arithmetic is what the
  // ladder below marks its reachable steps with.
  const finish = useMemo(() => {
    if (points == null || rate == null || pace == null || model.daysLeft == null) {
      return null;
    }
    const projected = pointsAfter({
      points,
      entryBar: model.entryBar,
      rate,
      qualifyingRate,
      battles: pace * model.daysLeft,
    });
    return { projected, standing: onslaughtRankOf(projected, model.legendTarget) };
  }, [points, rate, pace, qualifyingRate, model]);

  const steps = useMemo(
    () =>
      points == null || rate == null || model.daysLeft == null
        ? []
        : stepsAbove(points, model.legendTarget)
            .map((step) => ({
              step,
              plan: climbTo({
                points,
                target: step.floor,
                entryBar: model.entryBar,
                rate,
                qualifyingRate,
                daysLeft: model.daysLeft as number,
                paces: model.paces,
              }),
            }))
            .filter((row) => row.plan != null),
    [points, rate, qualifyingRate, model],
  );

  const settles = seasonEnd ? new Date(seasonEnd) : null;
  const dateFmt = date("d MMM");
  const answered = battles != null && points != null;
  const ready = answered && finish != null && standing != null && rate != null;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{t("title")}</PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <div className="grid gap-4 border-b border-fd-border p-4 sm:grid-cols-3">
          <Field
            id="predict-battles"
            label={t("fields.battles")}
            hint={t("fields.battles-hint")}
            value={battlesRaw ?? ""}
            placeholder={String(Math.round(model.entryBattles) || 200)}
            onChange={(v) => predictBattlesStore.write(v || null)}
          />
          <Field
            id="predict-points"
            label={t("fields.points")}
            hint={t("fields.points-hint", {
              champion: tGame("onslaught-tiers.champion"),
              entry: num(INT).format(model.entryBar),
            })}
            value={pointsRaw ?? ""}
            placeholder={String(model.entryBar)}
            onChange={(v) => predictPointsStore.write(v || null)}
          />
          <Field
            id="predict-pace"
            label={t("fields.pace")}
            hint={
              ownPace != null && parseRate(paceRaw) == null
                ? t("fields.pace-hint-own")
                : t("fields.pace-hint")
            }
            value={paceRaw ?? (ownPace != null ? field(ownPace, 1) : "")}
            placeholder={String(model.paces[1] ?? 15)}
            onChange={(v) => predictPaceStore.write(v || null)}
          />
        </div>

        {!ready || finish == null || standing == null || rate == null ? (
          <p className="p-4 text-sm text-fd-muted-foreground">
            {/* Two different silences: a form nobody has filled in, and a season
                we hold too little of to answer from (no arrivals recorded, no
                rate to read). Saying "fill it in" to a reader who just did reads
                as a form that does not work. */}
            {answered ? t("not-enough-season") : t("empty")}
          </p>
        ) : (
          <>
            <dl className="grid gap-4 border-b border-fd-border p-4 sm:grid-cols-3">
              <Figure
                label={t("figures.now")}
                value={standingName(standing.now, tGame)}
                icon={onslaughtRankIcon(
                  standing.now.rank,
                  seasonOrdinal,
                  assetsRef,
                )}
                colorClass={RATING_COLOR_CLASS[ONSLAUGHT_RANK_COLOR[standing.now.rank]]}
                hint={
                  standing.ranked
                    ? t("figures.on-the-board", {
                        rank: num(INT).format(standing.rank),
                        total: num(INT).format(standing.total),
                      })
                    : t("figures.off-the-board", {
                        points: num(INT).format(model.entryBar - points!),
                      })
                }
              />
              <Figure
                label={
                  settles
                    ? t("figures.finish", { date: dateFmt.format(settles) })
                    : t("figures.finish-undated")
                }
                value={standingName(finish.standing, tGame)}
                icon={onslaughtRankIcon(
                  finish.standing.rank,
                  seasonOrdinal,
                  assetsRef,
                )}
                colorClass={
                  RATING_COLOR_CLASS[ONSLAUGHT_RANK_COLOR[finish.standing.rank]]
                }
                hint={t("figures.finish-hint", {
                  points: num(INT).format(Math.round(finish.projected)),
                  battles: num(INT).format(
                    Math.round((pace ?? 0) * (model.daysLeft ?? 0)),
                  ),
                  days: num(INT).format(Math.round(model.daysLeft ?? 0)),
                })}
              />
              <Figure
                label={t("figures.rate")}
                hint={
                  parseRate(rateRaw) != null
                    ? t("figures.rate-yours")
                    : own != null
                      ? t("figures.rate-own")
                      : points! < model.entryBar
                        ? // Under the bar this figure is about a game they have
                          // not reached yet, and the one they are playing pays
                          // several times more. Saying only "the board's
                          // median" leaves it contradicting what they can
                          // work out from their own two numbers.
                          t("figures.rate-below", {
                            own: num(TWO_DP).format(qualifyingRate),
                          })
                        : t("figures.rate-board")
                }
                input={
                  <Input
                    className="h-10 w-24 text-2xl font-semibold tabular-nums md:text-2xl"
                    inputMode="decimal"
                    aria-label={t("figures.rate")}
                    value={rateRaw ?? field(rate)}
                    onChange={(e) => predictRateStore.write(e.target.value || null)}
                  />
                }
              />
            </dl>

            <PredictLadder
              rows={steps}
              reached={finish.projected}
              previousLegend={previous?.legendPoints ?? null}
              seasonOrdinal={seasonOrdinal}
              assetsRef={assetsRef}
            />
          </>
        )}

        <p className="p-4 text-sm text-fd-muted-foreground">
          {t("note", {
            champion: tGame("onslaught-tiers.champion"),
            legend: tGame("onslaught-tiers.legend"),
          })}
        </p>
      </PanelContent>
    </Panel>
  );
}
