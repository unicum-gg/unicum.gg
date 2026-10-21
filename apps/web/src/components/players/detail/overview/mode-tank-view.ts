import {
  TankBattleMode,
  type PlayerStrongholdModes,
  type StrongholdModeData,
} from "@unicum.gg/shared";
import { PlayerMode } from "@/components/players/detail/modes";

/**
 * The per-vehicle view a profile mode tab leads to, where one exists.
 *
 * The two vocabularies are not the same list, because Wargaming answers a
 * different set of blocks per account than per vehicle, so this is a map with
 * holes rather than a conversion. Every entry below was checked by summing the
 * per-vehicle blocks against the account-level one and getting the same number
 * to the battle; the absences are each a reason, not an omission.
 *
 * - **Ranked Battles** has no entry. The account block is the current format;
 *   the only per-vehicle one Wargaming still fills is `ranked_10x10`, which
 *   their own reference calls an archive of the retired 10v10 ladder. Two
 *   different things sharing a name is exactly what a link must not imply.
 * - **Rampage** HAS one, and this is where it used to be refused. The tab was
 *   labelled Steel Hunter while reading `fallout`, the 2015 Rampage event, so
 *   linking it would have carried that mislabel into a second page. Now that
 *   both sides name the mode Rampage they are the same block and the link is
 *   honest: the per-vehicle sum runs 1.6x to 2.6x over the account figure
 *   because a battle counted on every vehicle fielded, which the panel says in
 *   prose.
 * - **Onslaught** has none because nothing per-vehicle exists for it at all:
 *   the tab is built from our own capture of the season board, and
 *   **Historical Battles** has none for the same reason: `tanks/stats` answers
 *   no such block.
 */
export const PLAYER_MODE_TANK_VIEW: Partial<Record<PlayerMode, TankBattleMode>> =
  {
    [PlayerMode.Skirmish]: TankBattleMode.Skirmish,
    [PlayerMode.Advances]: TankBattleMode.Advances,
    [PlayerMode.GrandBattles]: TankBattleMode.GrandBattles,
    // All three Clan Wars tabs land on the same place, and the link says so by
    // naming Global Map rather than the tab it was clicked from. Wargaming
    // splits the account figure by tier and does not split the per-vehicle one:
    // `globalmap` is the three added up (941 against 941 on one account
    // measured, 709 against 704 on another). A superset under its own name is
    // worth more than three tabs with no way through.
    [PlayerMode.ClanWarsX]: TankBattleMode.GlobalMap,
    [PlayerMode.ClanWarsVIII]: TankBattleMode.GlobalMap,
    [PlayerMode.ClanWarsVI]: TankBattleMode.GlobalMap,
    // The ended modes, which are the same block on both sides: the per-vehicle
    // sums reconcile to the account total to the battle (388, 423, 751 and 60
    // on the account measured). Historical has no entry because `tanks/stats`
    // answers no such block at all, so there is nothing to show per vehicle.
    [PlayerMode.ClanBattles]: TankBattleMode.Clan,
    [PlayerMode.TankCompany]: TankBattleMode.Company,
    [PlayerMode.TeamBattles]: TankBattleMode.TeamBattles,
    [PlayerMode.PermanentTeams]: TankBattleMode.PermanentTeams,
  };

/**
 * Where an ended mode's record sits in the detail payload.
 *
 * The payload keys follow Wargaming's block names and the enum follows the
 * route segments, so the two spellings differ; mapped once here rather than
 * inline at each reader, since the page uses it to decide whether the route
 * exists at all and the view uses it to decide whether the tab does.
 */
const ARCHIVED_MODE_KEY: Partial<
  Record<PlayerMode, keyof PlayerStrongholdModes>
> = {
  [PlayerMode.ClanBattles]: "clan",
  [PlayerMode.TankCompany]: "company",
  [PlayerMode.TeamBattles]: "team",
  [PlayerMode.PermanentTeams]: "regularTeam",
  [PlayerMode.Historical]: "historical",
};

/** This account's record in an ended mode, or null where it has none (and for
 * every mode that is still played, which never goes through here). */
export function archivedModeRecord(
  detail: { strongholds: PlayerStrongholdModes },
  mode: PlayerMode,
): StrongholdModeData | null {
  const key = ARCHIVED_MODE_KEY[mode];
  return key ? ((detail.strongholds[key] as StrongholdModeData | null) ?? null) : null;
}
