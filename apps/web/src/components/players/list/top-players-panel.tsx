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
import { usePaintedRatingMetric } from "@/hooks/use-rating-metric";
import { useTierFloor } from "@/hooks/use-tier-floor";
import { useTranslation } from "@/hooks/use-translation";
import { numberFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { unicum } from "@/services/sdk";
import type { TopPlayerByLanguageResult } from "@/services/wargaming/wot/players/top/by-language";
import PAGINATION from "@/constants/pagination";
import {
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

export type LanguageCount = { code: string; total: number; strict: number };

/**
 * The player leaderboard's panel: the title, the window it ranks over, the
 * language filter, and the one metric board the reader is actually reading.
 *
 * It rendered one board per metric and let CSS show one, which is what a static
 * page has to do when the pick lives in a cookie. Measured on the EU landing,
 * the four a reader cannot see were 10,744 of its 14,162 DOM nodes: 76% of the
 * page, hydrated by every visitor to be hidden. So the page serves the default
 * metric and this fetches another one when the document says the reader picked
 * it, which costs those readers one request and everybody else nothing.
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
  initialMetric,
  page,
  total,
  title,
  language,
  strict,
  languageStats,
}: {
  region: Region;
  /** The rows the page was built with, which are `initialMetric`'s. */
  initial: TopPlayerByLanguageResult[];
  /**
   * The metric those rows rank by, which is the default one: the page is static
   * and no static render may read the reader's cookie.
   */
  initialMetric: RatingMetric;
  page?: number;
  /**
   * Rows the lifetime board holds in all, when `initial` is one server-cut page
   * of it rather than the whole thing. It is what the heading counts and what
   * the pager pages against; absent, `initial` is the whole board as before.
   */
  total?: number;
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
  // The pick as the document is painted with it, which is readable on the very
  // first render where the cookie hook is not (see `usePaintedRatingMetric`).
  const metric = usePaintedRatingMetric(initialMetric);
  // The server's rows answer for its own metric over its own window and nothing
  // else, so anything else is fetched.
  const served = overall && metric === initialMetric;

  const { data, isLoading } = useSWR(
    served
      ? null
      : ([
          "players-top",
          region,
          period,
          tier,
          language,
          strict,
          metric,
          page,
        ] as const),
    async ([, r, p, floor, lang, s, m, pg]) => {
      const api = unicum.region(r).players;
      // A lifetime board that the route can page is cut by the server, here as
      // on the page, so switching metric on page four answers with page four.
      const cut = p === StrongholdPeriod.Overall && pg !== undefined;
      const size = PAGINATION.SIZE.LEADERBOARD;
      const res = await api.top({
        metric: m,
        period: p,
        min_tier: tierParam(floor),
        limit: cut ? size : LIMIT,
        ...(cut ? { offset: (pg - 1) * size } : {}),
        // The language pair has to be the page's own, or this filters a
        // different population: without `languages` the rows come back with no
        // inferred languages at all and the board throws on the flags it draws
        // from them.
        ...(lang ? { lang } : { languages: "true" as const }),
        ...(s ? { strict: "true" as const } : {}),
      });
      return {
        rows: res.results as unknown as TopPlayerByLanguageResult[],
        total: res.total ?? null,
      };
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
  // The fetched rows once they exist, the page's own until then. A reader who
  // picked PR therefore reads the default board faded for as long as theirs is
  // in flight, which is the same compromise the period switch already makes and
  // the honest one: the alternative is an empty table under a filled heading.
  const rows = data?.rows ?? initial;
  const stats = overall ? languageStats : (periodStats ?? languageStats);
  const loading = !served && (isLoading || data === undefined);
  const filterCounts = language ? stats.find((s) => s.code === language) : null;
  // The depth the pager pages against: the page's for the board it was built
  // with, the endpoint's own count for a board fetched here. A recent window is
  // paged in the browser over rows it holds whole, so it names none.
  const serverTotal = overall
    ? served
      ? total
      : (data?.total ?? undefined)
    : undefined;

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
      // The hash is kept, as the shared param store keeps it: it can be
      // carrying something else entirely, such as `#settings/billing`.
      `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
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

  // The heading names the board's depth, which a server-cut page cannot be
  // asked for: it holds a hundred rows whatever the thousand behind it.
  const count = serverTotal ?? rows.length;

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
        <TopPlayersBoard
          serverTotal={serverTotal}
          language={language}
          strict={strict}
          region={region}
          metric={metric}
          results={rows}
          page={page}
          // The lifetime board prints the recent figure beside the career one;
          // a recent window already ranks by it.
          recent={overall}
        />
      </PanelContent>
    </Panel>
  );
}
