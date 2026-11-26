import { dateFormat } from "@/lib/format";
import PAGINATION from "@/constants/pagination";
import ROUTES from "@/constants/routes";
import { assertPageInRange } from "@/lib/pagination";
import { PaginationRelLinks } from "@/components/pagination-rel-links";
import { BoardUpdated } from "@/components/board-updated";
import { OnslaughtBoardLive } from "@/components/players/list/onslaught/board-live";
import { PlayerBoard } from "@/components/players/list/boards";
import { PlayersModeTabs } from "@/components/players/list/mode-tabs";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { buildSafe, unicum } from "@/services/sdk";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";
import { getTranslation } from "@/lib/translations.server";
import { battleTypeName } from "@/components/game-name";
import { Interpolate } from "@/components/interpolate";
import { BattleType, onslaughtAggregates } from "@unicum.gg/shared";
import { seasonName } from "@/components/game-name";
import { CalendarCrossLink } from "@/components/calendar/cross-link";

// One page of the standings, and the page this route names.
//
// The whole ranked population used to be fetched and paginated client-side.
// Onslaught's board is a few thousand rows down to the Master cutoff rather
// than a top-N, so that was 1,679,926 octets of rows on EU behind a page
// drawing a hundred, inlined twice over into a 3,996,734 octet document which
// then sat in a 4 GiB LRU cache shared with every other prerendered page. The
// aggregates the endpoint folds over the whole board are what let the panels
// below keep describing the field from a page of it.
const PAGE = PAGINATION.SIZE.LEADERBOARD;

// What the page prerenders as when even the in-process handler cannot answer,
// which only happens during a build with no database (see `buildSafe`). The
// aggregates are folded from nothing rather than hand-written as zeroes, so the
// shape can never drift from what the endpoint publishes.
const EMPTY_BOARD = {
  season: null,
  seasons: [],
  results: [],
  aggregates: onslaughtAggregates([], {
    elitePosition: null,
    masterPosition: null,
  }),
  dropouts: [],
  lost: 0,
  previous: null,
};

type OnslaughtHistory = Awaited<
  ReturnType<ReturnType<typeof unicum.region>["players"]["onslaughtHistory"]>
> | null;

// Shared body for /players/onslaught (EU default) and
// /<region>/players/onslaught: the Onslaught (Competitive 7) ranked leaderboard,
// mirrored from the in-game source into our database.
//
// The page renders the CURRENT season and is ISR-cached (`force-static` +
// revalidate), like the other leaderboards, so the common case is a cheap cached
// read rather than a per-request render of the whole ~4k-row board. Past seasons
// are picked with `?season=`, which a static page ignores, so `OnslaughtBoardLive`
// reads it client-side and refetches that season through the SDK.
export async function OnslaughtView({
  region,
  locale,
  page,
}: {
  region: Region;
  /** The route's own segment, for the mode tabs below. */
  locale: string;
  /**
   * The page of the standings to render, from the `/page/[n]` route the proxy
   * sends `?page=` to. Server-rendered rather than swapped in after hydration:
   * a crawler reads the HTML and leaves.
   */
  page?: number;
}) {
  // Both in one pass: the standings, and the curve of what a rank has cost while
  // the season ran.
  //
  // The curve carries its own `catch`, and `buildSafe` is not it: that one only
  // swallows during the build, and deliberately lets a runtime error through so
  // a failed revalidation keeps serving the last good page. Inside a
  // `Promise.all` that behaviour is contagious, so a 502 on the curve alone
  // would take the whole leaderboard down with it. The board is the page; the
  // curve is an extra, and it is allowed to be missing.
  const [initial, history] = await Promise.all([
    buildSafe(
      () =>
        unicum
          .region(region)
          .players.onslaught({ limit: PAGE, offset: ((page ?? 1) - 1) * PAGE }),
      EMPTY_BOARD,
    ),
    buildSafe(
      () => unicum.region(region).players.onslaughtHistory(),
      null as OnslaughtHistory,
    ).catch(() => null as OnslaughtHistory),
  ]);

  // The board's own length, which the endpoint reports whatever slice it served:
  // asked of `results` it would be the page, every page would be the last one,
  // and the guard would answer 200 for every number a crawler tried.
  const pagedRows = initial.aggregates.ranked;
  assertPageInRange(page, pagedRows, PAGE);

  const [{ t }, { t: tGame }, { t: tSeasons }] = await Promise.all([
    getTranslation("components/players/list/onslaught/view", locale),
    getTranslation("game/vocabulary", locale),
    getTranslation("game/onslaught-seasons", locale),
  ]);
  const mode = battleTypeName(BattleType.Onslaught, tGame);
  // The reader's own calendar: a season's dates are read, not parsed, and
  // "2 sept. 2026" is what a French reader expects where "Sep 2, 2026" is not.
  const dateFmt = dateFormat(locale, "d MMM yyyy");
  const { season } = initial;
  // Unix seconds from the source, so it is the instant the standings were
  // recomputed and not the instant our page rendered.
  const updatedAt =
    season?.lastRecalculationTs != null
      ? new Date(season.lastRecalculationTs * 1000)
      : null;
  const seasonLine = season
    ? [
        // The season's own name, in the reader's language: the client ships
        // it under the ordinal it was released in, and the board itself serves
        // only dates. Falls back to the English codename core resolved.
        seasonName(season.seasonOrdinal, season.codename ?? season.name, tSeasons),
        season.startDate && season.endDate
          ? t("season.range", {
              start: dateFmt.format(new Date(season.startDate)),
              end: dateFmt.format(new Date(season.endDate)),
            })
          : null,
        t(season.ended ? "season.final" : "season.live"),
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Read by Bing rather than by Google, which dropped them in 2019: the
          crawlable links in the pager are what carries the chain. */}
      <PaginationRelLinks
        path={ROUTES.PLAYERS_ONSLAUGHT(region)}
        page={page}
        total={pagedRows}
        size={PAGE}
        locale={locale}
      />
      <Panel>
        <PanelContent className="relative px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            <Interpolate
              template={t("heading", { mode })}
              wrap={{
                accent: (text) => <span className="text-brand">{text}</span>,
              }}
            />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            {t("intro", { mode, region: REGION_LABEL[region] })}
          </p>
          {seasonLine ? (
            <p className="mt-3 text-sm text-fd-muted-foreground">
              {seasonLine}
            </p>
          ) : null}
          {/* The source's own recomputation time rather than when we asked:
              on a live season, whether the board is still moving changes
              what a reader does next. */}
          <BoardUpdated at={updatedAt} />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <PlayersModeTabs region={region} active={PlayerBoard.Onslaught} locale={locale} />

      <PanelSeparator />

      <OnslaughtBoardLive
        region={region}
        initial={initial}
        initialHistory={history}
        page={page}
      />

      <PanelSeparator />
      <CalendarCrossLink region={region} locale={locale} />
    </div>
  );
}
