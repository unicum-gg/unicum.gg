import {
  SteelHunterBoard,
  type SteelHunterRow,
} from "@/components/players/list/steel-hunter/board";
import { Interpolate } from "@/components/interpolate";
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
import { getTranslation } from "@/lib/translations.server";
import { battleTypeName } from "@/components/game-name";
import { BattleType } from "@unicum.gg/shared";

// The full ranking is fetched once and paginated client-side (TablePager).
const LIMIT = 1000;

// Shared body for /players/steel-hunter (EU default) and
// /<region>/players/steel-hunter: the Steel Hunter (battle-royale) leaderboard,
// ranked by the HR rating. Consumes its own public API through the SDK, same
// as the WNX landing. ISR-cached (the page sets force-static + revalidate).
export async function SteelHunterView({
  region,
  locale,
}: {
  region: Region;
  /** The route's own segment, for the mode tabs below. */
  locale: string;
}) {
  // The mode's own name, in the reader's language: a French player reads
  // "Traqueur d'acier", from the client's own battle-type picker.
  const [{ t }, { t: tGame }, { t: tScale }] = await Promise.all([
    getTranslation("components/players/list/steel-hunter/view", locale),
    getTranslation("game/vocabulary", locale),
    getTranslation("components/home/rating-scale", locale),
  ]);
  const mode = battleTypeName(BattleType.BattleRoyale, tGame);
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
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <PlayersModeTabs region={region} active="steel-hunter" locale={locale} />

      <PanelSeparator />

      <SteelHunterBoard
        region={region}
        initialResults={results as SteelHunterRow[]}
      />

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>{tScale("title")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <SteelHunterRatingScale />
        </PanelContent>
      </Panel>
    </div>
  );
}
