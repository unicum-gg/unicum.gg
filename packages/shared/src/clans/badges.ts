import { StrongholdTier } from "../constants/stronghold";

/**
 * Leaderboard badges shown after a clan tag, wherever a clan appears.
 *
 * The player equivalent (`PlayerBadgeFlags`) says who someone is; this says
 * what a clan has achieved. Resolved server-side and attached to the row, same
 * as the player flags, so a badge follows the clan into leaderboards, the
 * player page and search without any of them fetching anything extra.
 */

/** A ranked board a clan can hold a position on. */
export enum ClanBoard {
  Wn7 = "wn7",
  Wn8 = "wn8",
  Wnx = "wnx",
  Advances = "advances",
  SkirmishT10 = "t10",
  SkirmishT8 = "t8",
  SkirmishT6 = "t6",
}

/**
 * Only the top ten of a board earns a badge.
 *
 * A rank threshold rather than a percentile because the boards are wildly
 * different sizes (7.5k eligible clans on each rating board, 259 on Advances),
 * so a shared cut-off like "top 1%" would mean 75 clans on one and 2 on
 * another. Ten is ten everywhere, and it stays rare: 46 clans out of the 125k
 * on EU hold one, against 16 at a top-three cut-off.
 */
export const CLAN_BADGE_MAX_RANK = 10;

export type ClanRankBadge = {
  board: ClanBoard;
  /** 1 to `CLAN_BADGE_MAX_RANK`. */
  rank: number;
};

/** Badges attached to a clan row at the API boundary. Absent means none. */
export type ClanBadgeFlags = {
  ranks?: ClanRankBadge[];
};

export const CLAN_BOARD_LABEL: Record<ClanBoard, string> = {
  [ClanBoard.Wn7]: "WN7",
  [ClanBoard.Wn8]: "WN8",
  [ClanBoard.Wnx]: "WNX",
  [ClanBoard.Advances]: "Advances",
  [ClanBoard.SkirmishT10]: "Skirmish X",
  [ClanBoard.SkirmishT8]: "Skirmish VIII",
  [ClanBoard.SkirmishT6]: "Skirmish VI",
};

/**
 * Crest colour per board, so a cluster of badges is readable at a glance:
 * the tincture says which leaderboard, the rank digit says the position.
 * Colouring by podium metal instead would make every badge gold/silver/bronze
 * and leave the board itself invisible until you hover.
 *
 * Two families, so the kind of achievement reads before the exact board does:
 * the random-battle ratings take cool hues, the stronghold boards warm ones.
 * `edge` is the darker shade the crest's gradient and outline use.
 */
export type ClanBoardTincture = { fill: string; edge: string };

export const CLAN_BOARD_TINCTURE: Record<ClanBoard, ClanBoardTincture> = {
  [ClanBoard.Wnx]: { fill: "#A855F7", edge: "#7E22CE" },
  [ClanBoard.Wn8]: { fill: "#2563EB", edge: "#1E40AF" },
  [ClanBoard.Wn7]: { fill: "#0891B2", edge: "#155E75" },
  [ClanBoard.Advances]: { fill: "#EF4444", edge: "#B91C1C" },
  [ClanBoard.SkirmishT10]: { fill: "#F59E0B", edge: "#B45309" },
  [ClanBoard.SkirmishT8]: { fill: "#10B981", edge: "#047857" },
  [ClanBoard.SkirmishT6]: { fill: "#EC4899", edge: "#BE185D" },
};

/**
 * The board a stronghold tier is ranked on. Declared once here so the two
 * directions stay in step: the badge needs it to build a link to the tier's
 * page, and the tier's page needs it to know which badge is its own.
 */
export const CLAN_BOARD_BY_STRONGHOLD_TIER: Record<StrongholdTier, ClanBoard> = {
  [StrongholdTier.Advances]: ClanBoard.Advances,
  [StrongholdTier.T10]: ClanBoard.SkirmishT10,
  [StrongholdTier.T8]: ClanBoard.SkirmishT8,
  [StrongholdTier.T6]: ClanBoard.SkirmishT6,
};

/** Longer wording for the tooltip, where there is room to say which board. */
export const CLAN_BOARD_DESCRIPTION: Record<ClanBoard, string> = {
  [ClanBoard.Wn7]: "clan WN7 rating",
  [ClanBoard.Wn8]: "clan WN8 rating",
  [ClanBoard.Wnx]: "clan WNX rating",
  [ClanBoard.Advances]: "Advances stronghold rating",
  [ClanBoard.SkirmishT10]: "Tier X skirmish rating",
  [ClanBoard.SkirmishT8]: "Tier VIII skirmish rating",
  [ClanBoard.SkirmishT6]: "Tier VI skirmish rating",
};

/** Display order: the ratings first (the site's headline metric), then the
 * stronghold boards heaviest tier first, so a clan's badges always read in the
 * same sequence rather than in whatever order the query returned them. */
const BOARD_ORDER: ClanBoard[] = [
  ClanBoard.Wnx,
  ClanBoard.Wn8,
  ClanBoard.Wn7,
  ClanBoard.Advances,
  ClanBoard.SkirmishT10,
  ClanBoard.SkirmishT8,
  ClanBoard.SkirmishT6,
];

export function sortClanBadges(badges: ClanRankBadge[]): ClanRankBadge[] {
  return [...badges].sort(
    (a, b) =>
      a.rank - b.rank ||
      BOARD_ORDER.indexOf(a.board) - BOARD_ORDER.indexOf(b.board),
  );
}
