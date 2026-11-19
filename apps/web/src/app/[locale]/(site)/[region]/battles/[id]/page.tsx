import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isRegion } from "@unicum.gg/wargaming";
import { BattleTab } from "@/components/players/detail/overview/battle-types";
import { getTranslation } from "@/lib/translations.server";
import { mapName } from "@/components/game-name";
import { withDictionaries } from "@/components/dictionaries";
import { BattlePageView } from "@/components/battles/detail/page-view";
import { battleMetadata } from "@/components/battles/detail/metadata";
import { loadBattle, loadComments } from "@/components/battles/detail/load";

/**
 * One battle, on a page of its own.
 *
 * Until now a battle could only be read inside the page of a player who was in
 * it, which meant the one thing anybody wants to do with a good game -- hand
 * it to somebody -- had no link to hand over. This is that link, and it is why
 * the page exists: the share button beside the title is the point, not an
 * ornament on it.
 *
 * It belongs to the thirty and names none of them: one player's side of it is
 * `players/[accountId]` below, which exists for any of them and so says nothing
 * about who reported the battle.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; id: string }>;
}): Promise<Metadata> {
  const { locale, region, id } = await params;
  if (!isRegion(region)) return {};
  const battle = await loadBattle(region, id, locale);
  return battle ? battleMetadata({ region, locale, battle }) : {};
}

async function BattlePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; region: string; id: string }>;
  searchParams: Promise<{ tab?: string; player?: string }>;
}) {
  const { locale, region, id } = await params;
  // The view a shared link names, so a replay sent to somebody opens on the
  // replay rather than on the rosters above it. Anything else is the rosters.
  // The player it names is opened on them.
  const { tab, player } = await searchParams;
  const initialTab = tab === BattleTab.Replay ? BattleTab.Replay : BattleTab.Teams;
  const initialPlayer =
    player && /^[0-9]{1,15}$/.test(player) ? Number(player) : null;
  if (!isRegion(region)) notFound();
  const battle = await loadBattle(region, id, locale);
  if (!battle) notFound();

  // The map, which is a fact about the battle rather than a label to translate.
  const [{ t: tMaps }, comments] = await Promise.all([
    getTranslation("game/maps", locale),
    loadComments(region, battle.id),
  ]);
  return (
    <BattlePageView
      locale={locale}
      region={region}
      battle={battle}
      heading={mapName(battle.map, battle.map, tMaps)}
      mapLabel={mapName(battle.map, battle.map, tMaps)}
      initialTab={initialTab}
      initialPlayer={initialPlayer}
      initialComments={comments}
    />
  );
}

export default withDictionaries(
  "[locale]/(site)/[region]/battles/[id]",
  BattlePage,
);
