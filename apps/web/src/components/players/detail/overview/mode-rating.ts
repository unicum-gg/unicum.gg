import { RatedMode } from "@unicum.gg/shared";
import { PlayerMode } from "@/components/players/detail/modes";

/**
 * Which of the profile's mode tabs carries a rating, and whose anchors it reads.
 *
 * A map with holes rather than a conversion, like `PLAYER_MODE_TANK_VIEW`
 * beside it, and every absence is a reason:
 *
 * - **Random Battles** is rated by WN7, WN8 and WNX, which are built against
 *   expected damage measured in random battles and are the right tool there.
 *   MR exists precisely because those three cannot read any other mode.
 * - **Ranked Battles** has no rating because it has no data: `ranked_battles`
 *   is a documented field that answers null for every account (zero of a
 *   400,000-account sample carries one), which matches Wargaming's own
 *   reference marking it "Warning. The field will be disabled.".
 * - **Onslaught** is not read from this block at all. It comes from our own
 *   capture of the season board, which already ranks by the game's own rating.
 * - **The five archived modes** (Clan Battles, Tank Company, Team Battles,
 *   Permanent Teams, Historical) carry the three inputs MR needs, so a rating
 *   is possible and simply has no anchors yet: those live in
 *   `*_player_archived_modes` rather than in the snapshot series the medians
 *   were measured over. Worth doing, not guessed at.
 */
export const PLAYER_MODE_RATING: Partial<Record<PlayerMode, RatedMode>> = {
  [PlayerMode.Skirmish]: RatedMode.Skirmish,
  [PlayerMode.Advances]: RatedMode.Advances,
  [PlayerMode.GrandBattles]: RatedMode.GrandBattles,
  [PlayerMode.ClanWarsX]: RatedMode.ClanWarsX,
  [PlayerMode.ClanWarsVIII]: RatedMode.ClanWarsVIII,
  [PlayerMode.ClanWarsVI]: RatedMode.ClanWarsVI,
  [PlayerMode.Rampage]: RatedMode.Rampage,
};
