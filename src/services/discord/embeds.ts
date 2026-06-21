import { env } from "env";
import type { PlayerInfo } from "@/services/wargaming/wot/accounts";
import { Region, REGION_EMOJI, REGION_LABEL } from "@/services/wargaming/wot";
import { BRAND_COLOR, type Embed } from "./types";

const intFmt = new Intl.NumberFormat("en-US");

function pct(part: number, whole: number): string {
  if (whole <= 0) return "n/a";
  return `${((part / whole) * 100).toFixed(2)}%`;
}

function ratio(part: number, whole: number): string {
  if (whole <= 0) return "n/a";
  return intFmt.format(Math.round(part / whole));
}

export function playerProfileUrl(region: Region, nickname: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}/${region}/players/${encodeURIComponent(
    nickname,
  )}`;
}

/**
 * Builds the free stat card. It is intentionally sourced from the live WG
 * account/info payload so it works for ANY player in ANY region on first
 * lookup, with no dependency on whether we have already crawled them. The
 * headline WN8 / WNX and per-tank breakdown live on the linked profile page,
 * which is the whole point of the card: drive the click back to the indexable
 * page (the reach loop).
 */
export function buildPlayerStatCard(region: Region, info: PlayerInfo): Embed {
  const s = info.statistics.all;
  const url = playerProfileUrl(region, info.nickname);
  return {
    title: info.nickname,
    url,
    color: BRAND_COLOR,
    description: `${REGION_EMOJI[region]} ${REGION_LABEL[region]} | World of Tanks`,
    fields: [
      { name: "Win Rate", value: pct(s.wins, s.battles), inline: true },
      { name: "Battles", value: intFmt.format(s.battles), inline: true },
      { name: "Avg Damage", value: ratio(s.damage_dealt, s.battles), inline: true },
      {
        name: "Personal Rating",
        value: intFmt.format(info.global_rating),
        inline: true,
      },
      {
        name: "Survival",
        value: pct(s.survived_battles, s.battles),
        inline: true,
      },
      {
        name: "Last Battle",
        value: info.last_battle_time ? `<t:${info.last_battle_time}:R>` : "n/a",
        inline: true,
      },
    ],
    footer: { text: "unicum.gg | full WN8, WNX and per-tank stats on the profile" },
  };
}

export function notFoundEmbed(query: string): Embed {
  return {
    title: "Player not found",
    color: BRAND_COLOR,
    description: `No World of Tanks account named \`${query}\` on EU, NA or ASIA. Check the spelling (names are exact match).`,
  };
}
