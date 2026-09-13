"use client";

import Image from "next/image";
import { type ReactNode, useMemo } from "react";
import { Interpolate } from "@/components/interpolate";
import {
  activityReference,
  type OnslaughtRow,
} from "@/components/players/list/onslaught/row";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import {
  DEFAULT_RATING_METRIC,
  isRatingMetric,
  onslaughtRankIcon,
  onslaughtTier,
  OnslaughtTier,
  RATING_COLOR_CLASS,
  RATING_COLOR_OF,
  RatingMetric,
} from "@unicum.gg/shared";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const TIERS = [OnslaughtTier.Legend, OnslaughtTier.Champion] as const;

/**
 * The middle of a set of values.
 *
 * The median rather than the mean everywhere on this panel, because each of
 * these distributions has one long tail and no other: a handful of accounts sit
 * far above the field on rating, and a handful grind several hundred battles
 * where most need a hundred. A mean reports those few and calls it typical.
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function ratingOf(row: OnslaughtRow, metric: RatingMetric): number | null {
  switch (metric) {
    case RatingMetric.Wn7:
      return row.wn7;
    case RatingMetric.Wn8:
      return row.wn8;
    case RatingMetric.Wnx:
      return row.wnx;
  }
}

type TierProfile = {
  tier: OnslaughtTier;
  players: number;
  rating: number | null;
  /** What they had played when they first appeared on the board. */
  entryBattles: number | null;
  /** What they have played over the whole season, which is the figure someone
   * aiming at this rank is really asking for: qualifying puts you on the board,
   * holding a place on it is the rest of these battles. */
  seasonBattles: number | null;
  /** The same total spread over every day the season has run, which is the
   * pace to match rather than the sum to reach.
   *
   * Deliberately NOT called battles per day: the board's own Battles/Day column
   * divides by the days a player was seen playing, and this divides by the days
   * the season has run. Two different questions, and giving them one name made
   * the same cohort read 40 in the table and 44 here as if one contradicted the
   * other. */
  dailyPace: number | null;
  /** Days they were actually seen playing, against the days available. The two
   * ranks differ here more than anywhere else on this panel, and the pace above
   * cannot be read without it. */
  daysPlayed: number | null;
};

/**
 * Who the players on the board actually are, per rank.
 *
 * The standings say where someone placed and nothing about what it took, which
 * is the question anyone looking at a Legend is really asking. Three figures
 * answer it, none of them on the board itself. The rating these players carry
 * in ordinary random battles is the only scale a reader shares with them. The
 * battles they had played the first time they appeared on the leaderboard is
 * the price of getting on it, and exists only because we watched them arrive.
 * And the battles they have played over the season is the price of staying,
 * which is the larger of the two and the one nobody expects.
 */
export function OnslaughtTierProfile({
  results,
  elitePosition,
  masterPosition,
  seasonOrdinal,
  assetsRef,
  seasonStart,
  seasonEnd,
  ended,
}: {
  results: OnslaughtRow[];
  elitePosition: number | null;
  masterPosition: number | null;
  seasonOrdinal: string | null;
  assetsRef: string | null;
  seasonStart: string | null;
  seasonEnd: string | null;
  ended: boolean;
}) {
  const { num } = useFormat();
  const { t } = useTranslation("components/players/list/onslaught/tier-profile");
  const { t: tGame } = useTranslation("game/vocabulary");
  // The same cookie the navbar selector writes, so this follows the metric
  // chosen anywhere on the site rather than keeping its own idea of one.
  const [stored] = useCookie(STORAGE.COOKIES.RATING, DEFAULT_RATING_METRIC);
  const metric: RatingMetric = isRatingMetric(stored)
    ? stored
    : DEFAULT_RATING_METRIC;

  // How long the season has been running, in days, measured against the board's
  // own newest capture rather than the reader's clock: the page is prerendered
  // and hydrated, so a clock read during render disagrees with itself across
  // that boundary. A finished season we hold no captures of falls back to its
  // own end date, and one still running does not, or the pace would be divided
  // by days that have not happened.
  const reference = useMemo(() => activityReference(results), [results]);
  const seasonDays = useMemo(() => {
    if (!seasonStart) return null;
    const start = Date.parse(seasonStart);
    const until =
      reference > 0
        ? reference * 1000
        : ended && seasonEnd
          ? Date.parse(seasonEnd)
          : Number.NaN;
    if (!Number.isFinite(start) || !Number.isFinite(until)) return null;
    return Math.max(1, (until - start) / DAY_MS);
  }, [reference, seasonStart, seasonEnd, ended]);

  const profiles = useMemo<TierProfile[]>(() => {
    const rows: Record<OnslaughtTier, OnslaughtRow[]> = {
      [OnslaughtTier.Legend]: [],
      [OnslaughtTier.Champion]: [],
    };
    for (const row of results) {
      const tier = onslaughtTier(row.rank, { elitePosition, masterPosition });
      if (tier) rows[tier].push(row);
    }
    return TIERS.map((tier) => {
      const ratings = rows[tier]
        .map((r) => ratingOf(r, metric))
        .filter((v): v is number => v != null);
      const entries = rows[tier]
        .map((r) => r.entryBattles)
        .filter((v): v is number => v != null);
      const seasonBattles = median(rows[tier].map((r) => r.battles));
      const active = rows[tier]
        .map((r) => r.activeDays)
        .filter((v): v is number => v != null);
      return {
        tier,
        players: rows[tier].length,
        rating: median(ratings),
        entryBattles: median(entries),
        seasonBattles,
        dailyPace:
          seasonBattles != null && seasonDays != null
            ? seasonBattles / seasonDays
            : null,
        daysPlayed: median(active),
      };
    });
  }, [results, metric, elitePosition, masterPosition, seasonDays]);

  if (profiles.every((p) => p.players === 0)) return null;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{t("title")}</PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <div className="grid sm:grid-cols-2 sm:divide-x divide-y sm:divide-y-0 divide-fd-border">
          {profiles.map((profile) => (
            <TierCard
              key={profile.tier}
              profile={profile}
              metric={metric}
              label={tGame(`onslaught-tiers.${profile.tier}`)}
              icon={onslaughtRankIcon(profile.tier, seasonOrdinal, assetsRef)}
              playersLabel={t("players", { count: profile.players })}
              // The metric is named where the figure is, and picking another
              // one is the same control the rest of the site uses, rather than
              // a switch of this panel's own sitting far from what it changes.
              ratingLabel={
                <Interpolate
                  template={t("median-rating")}
                  values={{ metric: <RatingMetricInlineSelect /> }}
                />
              }
              entryLabel={t("battles-to-qualify")}
              seasonLabel={t("battles-played")}
              paceLabel={t("daily-pace")}
              paceHint={
                profile.daysPlayed != null && seasonDays != null
                  ? t("days-played", {
                      days: num(INT_FORMAT).format(profile.daysPlayed),
                      total: num(INT_FORMAT).format(Math.round(seasonDays)),
                    })
                  : undefined
              }
              format={(value: number) => num(INT_FORMAT).format(value)}
            />
          ))}
        </div>
        <p className="border-t border-fd-border p-4 text-sm text-fd-muted-foreground">
          {t("note")}
        </p>
      </PanelContent>
    </Panel>
  );
}

function TierCard({
  profile,
  metric,
  label,
  icon,
  playersLabel,
  ratingLabel,
  entryLabel,
  seasonLabel,
  paceLabel,
  paceHint,
  format,
}: {
  profile: TierProfile;
  metric: RatingMetric;
  label: string;
  icon: string;
  playersLabel: string;
  ratingLabel: ReactNode;
  entryLabel: string;
  seasonLabel: string;
  paceLabel: string;
  paceHint?: string;
  format: (value: number) => string;
}) {
  const colorClass =
    profile.rating == null
      ? ""
      : RATING_COLOR_CLASS[RATING_COLOR_OF[metric](profile.rating)];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Image src={icon} alt="" width={28} height={28} className="h-7 w-7" />
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-fd-muted-foreground tabular-nums">
          {playersLabel}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt className="flex h-6 items-center gap-1 text-xs text-fd-muted-foreground">
            {ratingLabel}
          </dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {profile.rating == null ? (
              <span className="text-fd-muted-foreground">-</span>
            ) : (
              <span className={cn("rounded px-2 py-0.5", colorClass)}>
                {format(profile.rating)}
              </span>
            )}
          </dd>
        </div>
        <Figure label={entryLabel} value={profile.entryBattles} format={format} />
        <Figure
          label={seasonLabel}
          value={profile.seasonBattles}
          format={format}
        />
        <Figure
          label={paceLabel}
          value={profile.dailyPace}
          hint={paceHint}
          format={format}
        />
      </dl>
    </div>
  );
}

/** One plain number under its label, for the figures that carry no colour. */
function Figure({
  label,
  value,
  hint,
  format,
}: {
  label: string;
  value: number | null;
  hint?: string;
  format: (value: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="flex h-6 items-center text-xs text-fd-muted-foreground">
        {label}
      </dt>
      <dd className="text-2xl font-semibold tabular-nums">
        {value == null ? (
          <span className="text-fd-muted-foreground">-</span>
        ) : (
          format(value)
        )}
      </dd>
      {hint && value != null ? (
        <p className="text-xs text-fd-muted-foreground tabular-nums">{hint}</p>
      ) : null}
    </div>
  );
}
