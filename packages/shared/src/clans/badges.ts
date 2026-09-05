import { StrongholdTier } from "../constants/stronghold";

/**
 * Leaderboard badges shown after a clan tag, wherever a clan appears.
 *
 * The player equivalent (`PlayerBadgeFlags`) says who someone is; this says
 * what a clan has achieved. Resolved server-side and attached to the row, same
 * as the player flags, so a badge follows the clan into leaderboards, the
 * player page and search without any of them fetching anything extra.
 */

/**
 * The boards a clan can wear a placing from: the stronghold competitions, and
 * only those.
 *
 * The clan RATING used to be here, as three boards and then as one, and it is
 * deliberately gone. WN7, WN8 and WNX measure nearly the same thing, so their
 * top tens were the same clans three times over: on EU, 30 places between 14
 * clans, six of them on all three at once. Merging them into one crest fixed
 * the duplication and left the deeper problem, which is that a rating placing
 * is neither rare nor earned in a competition. The stronghold boards are: 40
 * places between 32 distinct clans, because each tier is its own contest.
 */
export enum ClanBoard {
  Advances = "advances",
  SkirmishT10 = "t10",
  SkirmishT8 = "t8",
  SkirmishT6 = "t6",
}

/**
 * Only the top ten of a board earns a badge.
 *
 * A rank threshold rather than a percentile because the boards are wildly
 * different sizes (259 eligible clans on Advances against thousands on the
 * lower skirmish tiers),
 * so a shared cut-off like "top 1%" would mean 75 clans on one and 2 on
 * another. Ten is ten everywhere, and it stays rare: 32 clans on EU hold one of
 * the 40 places the four boards offer, so the crest still means something.
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
  [ClanBoard.Advances]: "Advances stronghold rating",
  [ClanBoard.SkirmishT10]: "Tier X skirmish rating",
  [ClanBoard.SkirmishT8]: "Tier VIII skirmish rating",
  [ClanBoard.SkirmishT6]: "Tier VI skirmish rating",
};

/** How much a board weighs when two placings are otherwise equal: heaviest
 * tier first. Being second in Advances is a bigger claim than being second on the
 * tier VI skirmishes, and the order says so. */
const BOARD_ORDER: ClanBoard[] = [
  ClanBoard.Advances,
  ClanBoard.SkirmishT10,
  ClanBoard.SkirmishT8,
  ClanBoard.SkirmishT6,
];

/**
 * How impressive a placing reads, as a band rather than a raw rank.
 *
 * A podium is a podium wherever it was won, so first, second and third each
 * stand on their own and everything from fourth to tenth is one band below.
 * Sorting on the raw rank instead made the band invisible: fourth beat fifth by
 * as much as first beat second, when only the first of those gaps is something
 * a reader cares about.
 */
function rankBand(rank: number): number {
  return rank <= 3 ? rank : 4;
}

/**
 * A clan's placings, most impressive first.
 *
 * The order matters beyond tidiness: the cluster folds everything past `max`
 * into a "+N", so this decides which crests a reader actually sees. Sorting on
 * the rank alone put a first place on the tier VI skirmishes ahead of a second
 * in Advances, and pushed the bigger claim into the fold.
 *
 * Band first, then the board, then the rank inside the band. So every podium
 * comes before every top-ten, the heavier tier comes first among equals, and a
 * clan's two second places read in a stable order.
 */
export function sortClanBadges(badges: ClanRankBadge[]): ClanRankBadge[] {
  return [...badges].sort(
    (a, b) =>
      rankBand(a.rank) - rankBand(b.rank) ||
      BOARD_ORDER.indexOf(a.board) - BOARD_ORDER.indexOf(b.board) ||
      a.rank - b.rank,
  );
}
