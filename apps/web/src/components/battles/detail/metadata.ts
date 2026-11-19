import type { Metadata } from "next";
import type { Region } from "@unicum.gg/wargaming";
import { modeLabel } from "@unicum.gg/shared";
import type {
  BattleDetail,
  BattleParticipant,
} from "@unicum.gg/core/battles/read";
import ROUTES from "@/constants/routes";
import { mapName } from "@/components/game-name";
import { constructMetadata } from "@/lib/metadata";
import { dateFormat, numberFormat } from "@/lib/format";
import { getTranslation } from "@/lib/translations.server";

/**
 * A battle page's metadata, for its two addresses.
 *
 * The battle's own page names no player: it belongs to the thirty, and putting
 * one name in its title would read as "this is whose battle it is", which on a
 * battle somebody's client reported is "this is who reported it". One player's
 * side of it is named after them, their tank and the figures a battle report
 * leads with, which is what a reader searches a replay by. Neither says who
 * reported it, since any of the thirty has a side.
 *
 * A battle with no replay is a roster and a result, so both stay out of the
 * index rather than being published thousands of times with nothing of their
 * own; the title and the description only promise a replay when there is one.
 */
export async function battleMetadata({
  region,
  locale,
  battle,
  player,
}: {
  region: Region;
  locale: string;
  battle: BattleDetail;
  /** The side the page is drawn from, absent for the battle's own page. */
  player?: BattleParticipant;
}): Promise<Metadata> {
  const [{ t }, { t: tMaps }] = await Promise.all([
    getTranslation("app/battles/battle-page", locale),
    getTranslation("game/maps", locale),
  ]);
  const map = mapName(battle.map, battle.map, tMaps);
  const mode = modeLabel(battle.battleType) ?? t("mode-unknown");
  const date = dateFormat(locale, "d MMM yyyy").format(battle.startedAt);
  const count = numberFormat(locale);
  const tail = t(battle.hasReplay ? "meta-description-replay" : "meta-description-no-replay");

  if (!player?.player || !player.tank) {
    return constructMetadata({
      locale,
      title: t(battle.hasReplay ? "meta-title-battle" : "meta-title-battle-no-replay", {
        map,
        mode,
        date,
      }),
      description: `${t("meta-description-battle", { map, mode, date })} ${tail}`,
      ogTitle: map,
      ogSubtitle: t("og-subtitle-battle", { mode, date }),
      canonical: ROUTES.BATTLE(region, battle.id),
      ogImage: `/api/og/${region}/battles/${battle.id}`,
      noIndex: !battle.hasReplay,
    });
  }

  const tank = player.tank.shortName || player.tank.name;
  const nickname = player.player.nickname;
  const result =
    battle.winnerTeam === null
      ? "unknown"
      : battle.winnerTeam === 0
        ? "draw"
        : battle.winnerTeam === player.team
          ? "win"
          : "loss";
  const damage = count.format(player.own.damage ?? 0);
  return constructMetadata({
    locale,
    title: t(battle.hasReplay ? "meta-title" : "meta-title-no-replay", {
      tank,
      nickname,
      map,
    }),
    // Two sentences: the battle, then what the page holds.
    description: `${t(`meta-description.${result}`, {
      nickname,
      tank,
      map,
      mode,
      date,
      damage,
      kills: count.format(player.own.kills ?? 0),
      xp: count.format(player.own.xp ?? 0),
    })} ${tail}`,
    ogTitle: t("og-title", { tank, map }),
    ogSubtitle: t("og-subtitle", { nickname, damage }),
    canonical: ROUTES.BATTLE_PLAYER(region, battle.id, player.player.accountId),
    ogImage: `/api/og/${region}/battles/${battle.id}?player=${player.player.accountId}`,
    noIndex: !battle.hasReplay,
  });
}
