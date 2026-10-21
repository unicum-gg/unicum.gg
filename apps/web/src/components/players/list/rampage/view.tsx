import {
  RampageBoard,
  type RampageRow,
} from "@/components/players/list/rampage/board";
import { Interpolate } from "@/components/interpolate";
import PAGINATION from "@/constants/pagination";
import ROUTES from "@/constants/routes";
import { assertPageInRange } from "@/lib/pagination";
import { PaginationRelLinks } from "@/components/pagination-rel-links";
import { BoardUpdated } from "@/components/board-updated";
import { RampageRatingScale } from "@/components/players/list/rampage/rating-scale";
import { PlayerBoard } from "@/components/players/list/boards";
import { PlayersModeTabs } from "@/components/players/list/mode-tabs";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { buildSafe, unicum } from "@/services/sdk";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";
import { getTranslation } from "@/lib/translations.server";
import { tankModeName } from "@/components/game-name";
import { TankBattleMode } from "@unicum.gg/shared";

// The full ranking is fetched once and paginated client-side (TablePager).
const LIMIT = 1000;

// Shared body for /players/rampage (EU default) and
// /<region>/players/rampage: the Rampage leaderboard,
// ranked by the HR rating. Consumes its own public API through the SDK, same
// as the WNX landing. ISR-cached (the page sets force-static + revalidate).
export async function RampageView({
  region,
  locale,
  page,
}: {
  region: Region;
  /** The route's own segment, for the mode tabs below. */
  locale: string;
  /**
   * The page of the ranking to render, from the `/page/[n]` route the proxy
   * sends `?page=` to. Server-rendered rather than swapped in after hydration:
   * a crawler reads the HTML and leaves.
   */
  page?: number;
}) {
  // The mode's own name, from `tank-modes.fallout`, which is the one entry the
  // per-vehicle select, the profile tab and this board all read. It is pinned
  // untranslated in the term sheet: Wargaming shipped Rampage in 2015 and no
  // longer carries it in any client, so there is no official localisation to
  // copy and inventing one per language is what the sheet exists to prevent.
  const [{ t }, { t: tGame }, { t: tScale }] = await Promise.all([
    getTranslation("components/players/list/rampage/view", locale),
    getTranslation("game/vocabulary", locale),
    getTranslation("components/home/rating-scale", locale),
  ]);
  const mode = tankModeName(TankBattleMode.Fallout, tGame);
  const { results, computed_at } = await buildSafe(
    () => unicum.region(region).players.rampage({ limit: LIMIT }),
    { results: [], computed_at: null },
  );

  const pagedRows = results.length;
  assertPageInRange(page, pagedRows, PAGINATION.SIZE.LEADERBOARD);

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* Read by Bing rather than by Google, which dropped them in 2019: the
          crawlable links in the pager are what carries the chain. */}
      <PaginationRelLinks
        path={ROUTES.PLAYERS_RAMPAGE(region)}
        page={page}
        total={pagedRows}
        size={PAGINATION.SIZE.LEADERBOARD}
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
          {/* Said on the board rather than left for a reader to work out.
              Every other leaderboard on the site moves and this one does not:
              measured on its own top 100, not one account gained a battle here
              across 144 days while 74 of them played World of Tanks inside 90.
              Without the line, a ranking that never changes reads as a broken
              one.

              Phrased on the rotation rather than on a date, because Wargaming
              can bring an event back and a line naming the year it ended would
              be wrong the day they do. This is the one string to revisit if
              Rampage ever returns. */}
          <p className="mx-auto mt-2 max-w-2xl text-sm text-fd-muted-foreground/80">
            {t("archived", { mode })}
          </p>
          <BoardUpdated at={computed_at} />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <PlayersModeTabs region={region} active={PlayerBoard.Rampage} locale={locale} />

      <PanelSeparator />

      <RampageBoard
        region={region}
        initialResults={results as RampageRow[]}
        page={page}
      />

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{tScale("title")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <RampageRatingScale />
        </PanelContent>
      </Panel>
    </div>
  );
}
