import {
  SteelHunterBoard,
  type SteelHunterRow,
} from "@/components/players/list/steel-hunter/board";
import { SteelHunterRatingScale } from "@/components/players/list/steel-hunter/rating-scale";
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

// The full ranking is fetched once and paginated client-side (TablePager).
const LIMIT = 1000;

// Shared body for /players/steel-hunter (EU default) and
// /<region>/players/steel-hunter: the Steel Hunter (battle-royale) leaderboard,
// ranked by the HR rating. Consumes its own public API through the SDK, same
// as the WNX landing. ISR-cached (the page sets force-static + revalidate).
export async function SteelHunterView({ region }: { region: Region }) {
  const { results } = await buildSafe(
    () => unicum.region(region).players.steelHunter({ limit: LIMIT }),
    { results: [] },
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="px-4 py-12 text-center">
          <div className="mb-2 text-sm uppercase tracking-wide text-fd-muted-foreground">
            {REGION_EMOJI[region]} {REGION_LABEL[region]}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            Top <span className="text-brand">Steel Hunter</span> players
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
            Steel Hunter is World of Tanks&apos; battle royale mode. The{" "}
            {REGION_LABEL[region]} leaderboard, ranked by HR (minimum 100 Steel
            Hunter battles).
          </p>
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <PlayersModeTabs region={region} active="steel-hunter" />

      <PanelSeparator />

      <SteelHunterBoard
        region={region}
        initialResults={results as SteelHunterRow[]}
      />

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Rating scale</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <SteelHunterRatingScale />
        </PanelContent>
      </Panel>
    </div>
  );
}
