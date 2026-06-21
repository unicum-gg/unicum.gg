import { toRoman } from "roman-numerals";
import { env } from "env";
import type { PlayerInfo } from "@/services/wargaming/wot/accounts";
import { Region, REGION_EMOJI, REGION_LABEL } from "@/services/wargaming/wot";
import type { StatCardEnrichment } from "./enrichment";
import { BRAND_COLOR, type Embed, type EmbedField } from "./types";

const intFmt = new Intl.NumberFormat("en-US");

function pct(part: number, whole: number): string {
  if (whole <= 0) return "n/a";
  return `${((part / whole) * 100).toFixed(2)}%`;
}

function ratio(part: number, whole: number): string {
  if (whole <= 0) return "n/a";
  return intFmt.format(Math.round(part / whole));
}

function rating(value: number | null): string {
  return value === null ? "n/a" : intFmt.format(Math.round(value));
}

export function playerProfileUrl(region: Region, nickname: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}/${region}/players/${encodeURIComponent(
    nickname,
  )}`;
}

/**
 * Builds the free stat card. The headline winrate/battles/damage are sourced
 * from the live WG account/info payload so the card works for ANY player in ANY
 * region on first lookup, with no dependency on whether we have already crawled
 * them. When the account is already tracked we layer in `enrichment`: the same
 * DB-backed WN8 / WNX, 30d recent battles and most-played tank the profile page
 * renders. Either way the card links back to the indexable profile page, which
 * is the whole point of it: drive the click back (the reach loop).
 */
export function buildPlayerStatCard(
  region: Region,
  info: PlayerInfo,
  enrichment?: StatCardEnrichment | null,
): Embed {
  const s = info.statistics.all;
  const url = playerProfileUrl(region, info.nickname);

  const fields: EmbedField[] = [
    { name: "Win Rate", value: pct(s.wins, s.battles), inline: true },
    { name: "Battles", value: intFmt.format(s.battles), inline: true },
    { name: "Avg Damage", value: ratio(s.damage_dealt, s.battles), inline: true },
  ];

  if (enrichment) {
    fields.push(
      { name: "WN8", value: rating(enrichment.wn8), inline: true },
      { name: "WNX", value: rating(enrichment.wnx), inline: true },
      {
        name: "Personal Rating",
        value: intFmt.format(info.global_rating),
        inline: true,
      },
      {
        name: "Recent (30d)",
        value:
          enrichment.battles30d === null
            ? "n/a"
            : `${intFmt.format(enrichment.battles30d)} battles`,
        inline: true,
      },
      { name: "Survival", value: pct(s.survived_battles, s.battles), inline: true },
      {
        name: "Last Battle",
        value: info.last_battle_time ? `<t:${info.last_battle_time}:R>` : "n/a",
        inline: true,
      },
    );
    if (enrichment.topTank) {
      const t = enrichment.topTank;
      fields.push({
        name: "Most Played",
        value: `${t.name} (Tier ${toRoman(t.tier)}) | ${intFmt.format(
          t.battles,
        )} battles | ${(t.winRate * 100).toFixed(2)}% WR`,
        inline: false,
      });
    }
  } else {
    fields.push(
      {
        name: "Personal Rating",
        value: intFmt.format(info.global_rating),
        inline: true,
      },
      { name: "Survival", value: pct(s.survived_battles, s.battles), inline: true },
      {
        name: "Last Battle",
        value: info.last_battle_time ? `<t:${info.last_battle_time}:R>` : "n/a",
        inline: true,
      },
    );
  }

  return {
    title: info.nickname,
    url,
    color: BRAND_COLOR,
    description: `${REGION_EMOJI[region]} ${REGION_LABEL[region]} | World of Tanks`,
    fields,
    footer: {
      text: enrichment
        ? "unicum.gg | full history and per-tank breakdown on the profile"
        : "unicum.gg | full WN8, WNX and per-tank stats on the profile",
    },
  };
}

export function notFoundEmbed(query: string): Embed {
  return {
    title: "Player not found",
    color: BRAND_COLOR,
    description: `No World of Tanks account named \`${query}\` on EU, NA or ASIA. Check the spelling (names are exact match).`,
  };
}
