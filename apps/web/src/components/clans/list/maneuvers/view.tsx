import { ManeuversClansBoard } from "@/components/clans/list/maneuvers/board";
import { Interpolate } from "@/components/interpolate";
import { ManeuversBoardSwitch } from "@/components/maneuvers-board-switch";
import { ManeuversEditionProvider } from "@/components/maneuvers/edition-context";
import { MANEUVERS_PAGE_SIZE } from "@/components/maneuvers/limit";
import { ManeuversRace } from "@/components/maneuvers/race";
import { ManeuversRewards } from "@/components/maneuvers/rewards";
import { ManeuversScale } from "@/components/maneuvers/scale";
import { ManeuversEditionHeader } from "@/components/maneuvers/edition-header";
import { Panel, PanelContent, PanelSeparator } from "@/components/panel";
import { getTranslation } from "@/lib/translations.server";
import { buildSafe, unicum } from "@/services/sdk";
import { ManeuversBoardKind } from "@unicum.gg/shared";
import { Region, REGION_EMOJI, REGION_LABEL } from "@unicum.gg/wargaming";

// Shared body for /clans/maneuvers (EU default) and /<region>/clans/maneuvers:
// the clan half of the Maneuvers edition, ranked by Fame Points. A standalone
// board like /clans/stronghold (the clan leaderboards have no mode-tab bar of
// their own), linked across to the player board it shares an edition with.
export async function ManeuversClansView({
  region,
  locale,
}: {
  region: Region;
  locale: string;
}) {
  const board = await buildSafe(
    () => unicum.region(region).maneuvers({
        board: ManeuversBoardKind.Clans,
        limit: MANEUVERS_PAGE_SIZE,
      }),
    {
      editions: [],
      edition: null,
      standing: null,
      players: [],
      clans: [],
      totals: { players: 0, clans: 0 },
    },
  );

  const [{ t }, { t: tGame }] = await Promise.all([
    getTranslation("components/clans/list/maneuvers/view", locale),
    getTranslation("game/vocabulary", locale),
  ]);
  const maneuvers = tGame("battle-formats.maneuvers");

  return (
    <ManeuversEditionProvider
      region={region}
      kind={ManeuversBoardKind.Clans}
      initial={board}
    >
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
              <ManeuversBoardSwitch current="clans" region={region} locale={locale} />
            </div>
            <ManeuversEditionHeader />
          </PanelContent>
        </Panel>

        <PanelSeparator />

        <ManeuversClansBoard />
        {/* Each carries its own separator, so an edition with nothing to
            show (one nobody recorded) leaves no rules over empty space. */}
        <ManeuversRace kind={ManeuversBoardKind.Clans} />
        <ManeuversRewards kind={ManeuversBoardKind.Clans} />
        <ManeuversScale kind={ManeuversBoardKind.Clans} />
      </div>
    </ManeuversEditionProvider>
  );
}
