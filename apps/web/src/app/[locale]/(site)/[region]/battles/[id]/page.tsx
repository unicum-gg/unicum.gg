import { notFound } from "next/navigation";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import { RatingMetric } from "@unicum.gg/shared";
import { battleDetail } from "@unicum.gg/core/battles/read";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import { BattleDetail } from "@/components/players/detail/overview/battle-detail";
import { ShareButton } from "@/components/share-button";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { getTranslation } from "@/lib/translations.server";
import APP from "@/constants/app";

/**
 * One battle, on a page of its own.
 *
 * Until now a battle could only be read inside the page of a player who was in
 * it, which meant the one thing anybody wants to do with a good game -- hand
 * it to somebody -- had no link to hand over. This is that link, and it is why
 * the page exists: the share button beside the title is the point, not an
 * ornament on it.
 *
 * Everything below is the SAME component a player's page expands inline. A
 * second rendering of a battle would be a second place for the replay viewer,
 * the rosters and the report to drift apart.
 */
export default async function BattlePage({
  params,
}: {
  params: Promise<{ locale: string; region: string; id: string }>;
}) {
  const { locale, region, id } = await params;
  if (!isRegion(region)) notFound();
  if (!/^[0-9]{1,20}$/.test(id)) notFound();

  const battle = await battleDetail(region, normaliseBattleId(id));
  if (!battle) notFound();

  const url = `${APP.URL}/${locale}/${region}/battles/${battle.id}`;
  // The map and the date, which are facts about the battle rather than a label
  // to translate. The list's own heading reads "Battles of <nickname>", and
  // borrowing it here left the placeholder unfilled on a page that belongs to
  // no player.
  const { t: tMaps } = await getTranslation("game/maps", locale);
  const heading = tMaps(battle.map) || battle.map;

  return (
    // The site's own page shell, not a rounded box of this file's invention:
    // `Panel` is what carries the rules down either side and the screen lines
    // above and below, which is what makes a page look like it belongs here.
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-2">
          <PanelTitle as="h1">{heading}</PanelTitle>
          <ShareButton
            title={heading}
            url={url}
            shareText={url}
            nativeShareTitle={heading}
          />
        </PanelHeader>
        <PanelContent className="p-0">
          <BattleDetail
            region={region as Region}
            battleId={battle.id}
            arenaId={battle.map}
            mapImage={battle.mapImage}
            mapBounds={battle.mapBounds}
            mapOverlay={battle.mapOverlay}
            startedAt={battle.startedAt.toISOString()}
            duration={battle.duration}
            // No economy here, and that is not a gap: the results carry one for
            // the reporting client alone, and this page belongs to nobody in
            // particular. The detailed report is a player's own view of their
            // own battle and stays on their own page.
            personal={null}
            metric={RatingMetric.Wnx}
          />
        </PanelContent>
      </Panel>
      <PanelSeparator />
    </div>
  );
}
