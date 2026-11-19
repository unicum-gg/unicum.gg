import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isRegion, type Region } from "@unicum.gg/wargaming";
import { BattleTab } from "@/components/players/detail/overview/battle-types";
import { getTranslation } from "@/lib/translations.server";
import { mapName } from "@/components/game-name";
import { withDictionaries } from "@/components/dictionaries";
import { BattlePageView } from "@/components/battles/detail/page-view";
import { battleMetadata } from "@/components/battles/detail/metadata";
import { loadBattle, loadComments } from "@/components/battles/detail/load";
import { unicum } from "@/services/sdk";

/**
 * One player's side of a battle: the same battle, named after them and opened
 * on them, which is what a replay is looked up as ("this tank, this player, this
 * map").
 *
 * Any of the thirty has one, so the address says nothing about who reported the
 * battle. A player who keeps their battle list to themselves has none: the
 * battle's own page still shows them in the rosters, as it shows everybody.
 */
async function sideOf(region: Region, id: string, accountId: string, locale: string) {
  if (!/^[0-9]{1,15}$/.test(accountId)) return null;
  const battle = await loadBattle(region, id, locale);
  const player = battle?.participants.find(
    (one) => one.account === Number(accountId) && one.player && one.tank,
  );
  if (!battle || !player?.player) return null;
  // Through the player's own list, which answers `hidden` for a player who
  // keeps it to themselves: their side of a battle is part of that list.
  const hidden = await unicum
    .region(region)
    .players(player.player.nickname)
    .battles({ limit: 1 })
    .then((list) => list.hidden === true)
    .catch(() => false);
  return hidden ? null : { battle, player };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; region: string; id: string; accountId: string }>;
}): Promise<Metadata> {
  const { locale, region, id, accountId } = await params;
  if (!isRegion(region)) return {};
  const side = await sideOf(region, id, accountId, locale);
  return side ? battleMetadata({ region, locale, ...side }) : {};
}

async function BattlePlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; region: string; id: string; accountId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale, region, id, accountId } = await params;
  const { tab } = await searchParams;
  if (!isRegion(region)) notFound();
  const side = await sideOf(region, id, accountId, locale);
  if (!side) notFound();
  const { battle, player } = side;
  const comments = await loadComments(region, battle.id);

  const [{ t }, { t: tMaps }] = await Promise.all([
    getTranslation("app/battles/battle-page", locale),
    getTranslation("game/maps", locale),
  ]);
  return (
    <BattlePageView
      locale={locale}
      focus={player.account}
      region={region}
      battle={battle}
      heading={t("heading-player", {
        nickname: player.player!.nickname,
        tank: player.tank!.shortName || player.tank!.name,
        map: mapName(battle.map, battle.map, tMaps),
      })}
      // A recorder's side opens on their results screen, anybody else's on
      // the teams; `?tab=` names any other view.
      initialTab={
        tab === BattleTab.Replay && battle.hasReplay
          ? BattleTab.Replay
          : tab === BattleTab.Report || tab === BattleTab.Teams
            ? tab
            : battle.recorders.some((one) => one.accountId === player.account)
              ? BattleTab.Personal
              : BattleTab.Teams
      }
      mapLabel={mapName(battle.map, battle.map, tMaps)}
      initialPlayer={player.id}
      initialComments={comments}
    />
  );
}

export default withDictionaries(
  "[locale]/(site)/[region]/battles/[id]/players/[accountId]",
  BattlePlayerPage,
);
