"use client";

import { useEffect, useRef } from "react";
import { toRoman } from "roman-numerals";
import useSWR from "swr";
import { useLocale } from "@onruntime/translations/react";
import { Interpolate } from "@/components/interpolate";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import { PeriodInlineSelect } from "@/components/period-inline-select";
import { RatingMetricInlineSelect } from "@/components/rating-metric-inline-select";
import { SegmentedControl } from "@/components/segmented-control";
import { PlayerBoard, boardLanguageHref } from "@/components/players/list/boards";
import { PlayerLanguageSelect } from "@/components/players/list/language-select";
import { TopPlayersBoard } from "@/components/players/list/top-players-board";
import { isStrongholdPeriod, useStatsPeriod } from "@/hooks/use-period";
import { useTierFloor } from "@/hooks/use-tier-floor";
import { useTranslation } from "@/hooks/use-translation";
import { numberFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { unicum } from "@/services/sdk";
import type { TopPlayerByLanguageResult } from "@/services/wargaming/wot/players/top/by-language";
import {
  RATING_METRICS,
  RatingMetric,
  StrongholdPeriod,
  TIER_FLOORS,
  type TierFloor,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/** The windows offered, in the stronghold board's menu order. */
const BOARD_PERIODS = Object.values(StrongholdPeriod);

const LIMIT = 1000;

/** A floor as the API's `min_tier` spells it. */
function tierParam(floor: TierFloor): "6" | "8" | "10" {
  return String(floor) as "6" | "8" | "10";
}

export type TopPlayersByMetric = Record<RatingMetric, TopPlayerByLanguageResult[]>;

export type LanguageCount = { code: string; total: number; strict: number };

/**
 * The player leaderboard's panel: the title, the window it ranks over, the
 * language filter, and the three metric boards CSS picks between.
 *
 * The period works exactly as the stronghold board's does, which is what a
 * reader asked for by pointing at it. The page is prerendered at Overall and
 * seeded here as `initial`; any other window is fetched through the SDK from
 * the hourly materialized pool, so switching is one cheap read and never a
 * navigation. The window is the site's shared period cookie, so a reader who
 * picked 30 days on the home page or a stronghold board lands here on it too,
 * and `?period=` keeps a link to it shareable.
 *
 * A recent window is ranked three times over, by the battles fought at tier VI,
 * VIII and X and up (`TierFloor`), picked by the segments beside the language
 * filter and carried in `?tier=`. Counting every tier let a low-tier farm take
 * the top of the board, so a recent window always counts from a floor. The
 * lifetime board has no floor and shows no segments.
 *
 * PR and WTR are account figures with no value over a window (see
 * `RatingMetric`), so on a recent window they rank the players who cleared its
 * floors by their current figure, and the intro sentence says so.
 *
 * The language filter works on every window. Its chips and the strict toggle
 * count the pool of the window on screen (the lifetime counts arrive with the
 * page, a recent window's are fetched beside its rows), and picking a language
 * navigates to its landing, which keeps the window through the same cookie.
 */
export function TopPlayersPanel({
  region,
  initial,
  page,
  title,
  language,
  strict,
  languageStats,
}: {
  region: Region;
  initial: TopPlayersByMetric;
  page?: number;
  /** The heading template's key in `components/players/list/view`, and what fills it. */
  title: { key: "board.all" | "board.language" | "board.strict"; language?: string };
  /** The language this landing is filtered to, null for the whole region. */
  language: string | null;
  strict: boolean;
  /** The lifetime pool's language counts, from the page. */
  languageStats: LanguageCount[];
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/players/list/view");
  const { t: tGame } = useTranslation("game/vocabulary");
  const [period, setPeriodCookie] = useStatsPeriod();
  const [tier, setTier] = useTierFloor();
  const overall = period === StrongholdPeriod.Overall;

  const { data, isLoading } = useSWR(
    overall ? null : (["players-top", region, period, tier, language, strict] as const),
    async ([, r, p, floor, lang, s]) => {
      const api = unicum.region(r).players;
      const lists = await Promise.all(
        RATING_METRICS.map((metric) =>
          api
            .top({
              metric,
              period: p,
              min_tier: tierParam(floor),
              limit: LIMIT,
              ...(lang ? { lang } : {}),
              ...(s ? { strict: "true" as const } : {}),
            })
            .then((res) => res.results as unknown as TopPlayerByLanguageResult[]),
        ),
      );
      return Object.fromEntries(
        RATING_METRICS.map((m, i) => [m, lists[i]]),
      ) as Partial<TopPlayersByMetric>;
    },
    { keepPreviousData: true },
  );
  const { data: periodStats } = useSWR(
    overall ? null : (["players-languages", region, period, tier] as const),
    ([, r, p, floor]) =>
      unicum
        .region(r)
        .players.languages({ period: p, min_tier: tierParam(floor) })
        .then((res) => res.results as LanguageCount[]),
    { keepPreviousData: true },
  );
  const boards: Partial<TopPlayersByMetric> = overall ? initial : (data ?? initial);
  const stats = overall ? languageStats : (periodStats ?? languageStats);
  const loading = !overall && (isLoading || data === undefined);
  const filterCounts = language ? stats.find((s) => s.code === language) : null;

  // Reflect the window in the URL without a Next navigation, keeping the
  // Overall URL clean, and read the filter bar's own keys back rather than
  // starting empty so a period change does not drop them.
  function setPeriod(next: StrongholdPeriod) {
    setPeriodCookie(next);
    const params = new URLSearchParams(window.location.search);
    if (next !== StrongholdPeriod.Overall) params.set("period", next);
    else params.delete("period");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }

  // Adopt a `?period=` deep link once on mount: the page is static, so the
  // query is only readable client-side, and a shared link also becomes the
  // reader's saved preference, as on the stronghold board.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const raw = new URLSearchParams(window.location.search).get("period");
    if (raw && isStrongholdPeriod(raw)) setPeriodCookie(raw);
  }, [setPeriodCookie]);

  const count = boards[RatingMetric.Wnx]?.length ?? 0;

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <PanelTitle>
          <Interpolate
            template={t(title.key, {
              count: numberFormat(locale).format(count),
              language: title.language ?? "",
            })}
            values={{
              metric: (
                <RatingMetricInlineSelect
                  className="-my-1 inline-flex! h-7! gap-1 px-1.5! py-0! align-middle text-xl! font-semibold [&_svg]:size-4"
                />
              ),
            }}
          />{" "}
          <PeriodInlineSelect
            period={period}
            periods={BOARD_PERIODS}
            label={(p) => tGame(`stronghold-periods.${p}`)}
            onChange={setPeriod}
          />
        </PanelTitle>
        <div className="flex flex-wrap items-center gap-2">
          {!overall && (
            <SegmentedControl
              active={tierParam(tier)}
              onSelect={(id) => setTier(Number(id) as TierFloor)}
              segments={TIER_FLOORS.map((floor) => ({
                id: tierParam(floor),
                label: t("tier-floor", { tier: toRoman(floor) }),
              }))}
            />
          )}
          <PlayerLanguageSelect
            available={stats.map((s) => ({ code: s.code, playersCount: s.total }))}
            active={language}
            region={region}
            board={PlayerBoard.Overall}
            strict={strict}
          />
          {language && filterCounts && (
            <SegmentedControl
              active={strict ? "strict" : "any"}
              segments={[
                {
                  id: "any",
                  label: t("any-toggle"),
                  href: boardLanguageHref(PlayerBoard.Overall, region, language),
                  count: filterCounts.total,
                },
                {
                  id: "strict",
                  label: t("strict-toggle"),
                  href: boardLanguageHref(PlayerBoard.Overall, region, language, true),
                  count: filterCounts.strict,
                },
              ]}
            />
          )}
        </div>
      </PanelHeader>
      <PanelContent className={cn("p-0 transition-opacity", loading && "opacity-60")}>
        {RATING_METRICS.map((metric) => (
          <div key={metric} data-rating-col={metric}>
            <TopPlayersBoard
              region={region}
              metric={metric}
              results={boards[metric] ?? []}
              page={page}
              // The lifetime board prints the recent figure beside the career
              // one; a recent window already ranks by it.
              recent={overall}
            />
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}
