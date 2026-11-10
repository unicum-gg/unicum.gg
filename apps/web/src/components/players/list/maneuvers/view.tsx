import { Interpolate } from "@/components/interpolate";
import { ManeuversBoardSwitch } from "@/components/maneuvers-board-switch";
import { ManeuversEditionProvider } from "@/components/maneuvers/edition-context";
import { MANEUVERS_LIMIT } from "@/components/maneuvers/limit";
import { ManeuversRace } from "@/components/maneuvers/race";
import { ManeuversRewards } from "@/components/maneuvers/rewards";
import { ManeuversScale } from "@/components/maneuvers/scale";
import { ManeuversEditionHeader } from "@/components/maneuvers/edition-header";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { PlayerBoard } from "@/components/players/list/boards";
import { ManeuversPlayersBoard } from "@/components/players/list/maneuvers/board";
import { PlayersModeTabs } from "@/components/players/list/mode-tabs";
import { getTranslation } from "@/lib/translations.server";
import { buildSafe, unicum } from "@/services/sdk";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";

// Shared body for /players/maneuvers (EU default) and
// /<region>/players/maneuvers: the player half of the Maneuvers edition, ranked
// by Fame Points, mirrored from the in-game source into our database.
//
// Both halves of the edition come from the one combined endpoint, so the player
// standings a reader sees were recomputed at the same instant as the clan ones
// the sibling page shows. This page renders only the player half and links
// across to the clan board.
export async function ManeuversPlayersView({
  region,
  locale,
}: {
  region: Region;
  /** The route's own segment, for the mode tabs below. */
  locale: string;
}) {
  const board = await buildSafe(
    () => unicum.region(region).maneuvers({ limit: MANEUVERS_LIMIT }),
    {
      editions: [],
      edition: null,
      standing: null,
      players: [],
      clans: [],
    },
  );

  const [{ t }, { t: tGame }] = await Promise.all([
    getTranslation("components/players/list/maneuvers/view", locale),
    getTranslation("game/vocabulary", locale),
  ]);
  // The event's own name, as the reader's client writes it: a French reader
  // sees "Manœuvres" where an English one sees "Maneuvers".
  const maneuvers = tGame("battle-formats.maneuvers");

  return (
    <ManeuversEditionProvider region={region} initial={board}>
      <div className="mx-auto w-full max-w-7xl">
        <Panel>
          <PanelContent className="relative px-4 py-12 text-center">
            <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
              {REGION_EMOJI[region]} {REGION_LABEL[region]}
            </div>
            <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
              <Interpolate
                template={t("heading", { maneuvers })}
                wrap={{
                  accent: (text) => <span className="text-brand">{text}</span>,
                }}
              />
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
              {t("intro", { maneuvers, region: REGION_LABEL[region] })}
            </p>
            <div className="mt-6 flex justify-center">
              <ManeuversBoardSwitch current="players" region={region} locale={locale} />
            </div>
            <ManeuversEditionHeader />
          </PanelContent>
        </Panel>

        <PanelSeparator />

        <PlayersModeTabs region={region} active={PlayerBoard.Maneuvers} locale={locale} />

        <PanelSeparator />

        <ManeuversPlayersBoard />
        {/* Each carries its own separator, so an edition with nothing to
            show (one nobody recorded) leaves no rules over empty space. */}
        <ManeuversRace kind="players" />
        <ManeuversRewards kind="players" />
        <ManeuversScale kind="players" />
      </div>
    </ManeuversEditionProvider>
  );
}
