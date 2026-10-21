import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  type WN8Expected,
  type WNXExpected,
} from "../wot/ratings";
import { buildTankSlugIndex } from "../wot/tanks/slug";
import type { TankBattleMode } from "../wot/tank-modes";
import type { TankModeAvailability } from "./tank-modes";
import type { TankStats } from "../wot/tank-stats";
import type { VehicleMeta } from "../wot/tanks/meta";
import type { TankMarkReach } from "./mark-progress";

// One computed row per tank a player has battles in: vehicle metadata joined
// from the encyclopedia plus derived per-battle stats and all three ratings.
// Kept pure so the player detail endpoint can compute it once server-side
// (instead of shipping the whole encyclopedia + expected-value tables to the
// client). All three ratings are computed so the client can switch the
// displayed metric (WN7/WN8/WNX) without another round-trip.
export type PlayerTankRow = {
  tankId: number;
  // URL slug for the tank page (null if the tank is not in the catalogue).
  slug: string | null;
  name: string;
  shortName: string | null;
  tag: string | null;
  tier: number | null;
  nation: string | null;
  type: string | null;
  role: string | null;
  isPremium: boolean;
  isReward: boolean;
  /**
   * Whether the account still HOLDS this vehicle, or null when nobody has
   * verified that garage.
   *
   * Wargaming answers a stranger with a row per vehicle the account has ever
   * had and `in_garage: null` on every one of them, so `false` is only ever
   * reachable through the owner's own access token (see `*_player_garage`).
   * Null is therefore "unknown", never "sold", and every reader has to treat
   * the two apart: measured on one 185-vehicle account, 60 rows were vehicles
   * sold long ago, so reading null as owned overstates a garage by a third and
   * reading it as sold erases one entirely.
   */
  owned: boolean | null;
  // Mark of Mastery badge (0-4).
  mom: number | null;
  // Marks of Excellence on the gun (0-3), from the portal. null when we have not
  // reached the portal for this player yet.
  moe: number | null;
  /**
   * Progress towards the next mark of excellence, 0 to 100 with two decimals.
   *
   * Null for every account that does not run the mod: this number lives only
   * in the client's own vehicle dossier, so neither the public API nor the
   * portal can supply it. Where it is null the site still shows its own
   * estimate, derived from average damage against the mark thresholds.
   */
  moePercent: number | null;
  /**
   * Where this account's own combined damage sits against the region's three
   * Marks of Excellence bars on this vehicle, or null where no honest reading
   * exists (see `buildTankMarkReach`).
   *
   * Not a second opinion on `moePercent`, which is the game's own progress
   * towards the NEXT mark on the rolling window Wargaming scores, and which
   * only an account running the mod ever has. This is the comparison the whole
   * site can make for everybody: an average against a published bar. The two
   * are kept apart, and are never sorted or counted together.
   */
  markReach: TankMarkReach | null;
  battles: number;
  avgDamage: number | null;
  avgXp: number | null;
  winrate: number | null;
  /** Null when the rows describe a mode the WN ratings do not apply to, which
   * is every mode but Random Battles. See `TANK_MODES_RATED`. */
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  // Economics (from the global tank specs), for the account-value estimate:
  // gold purchase price (premiums), credits purchase price, and XP to research
  // from the direct parent. Null when the tank is absent from the specs table.
  buyGold: number | null;
  buyCredits: number | null;
  researchXp: number | null;
};

/** Per-tank economics the vehicle rows carry for the account-value estimate. */
export type TankEconomics = {
  buyGold: number | null;
  buyCredits: number | null;
  researchXp: number | null;
};

/**
 * `rated` decides whether the three WN ratings are computed.
 *
 * False for every battle mode but Random: the expected values behind them are
 * measured on random battles, so elsewhere they score a format against a
 * standard it was never set by. Null rather than a wrong number, which is what
 * lets the table drop the column instead of filling it with dashes. See
 * `TANK_MODES_RATED`.
 *
 * It composes with `played` rather than replacing it, because the two are
 * different absences: `played` is a vehicle with no record to rate (owned,
 * never driven, which only a verified garage can even show), and `rated` is a
 * record with no standard to rate it against. Either one alone is enough to
 * make a rating meaningless, so both have to hold.
 */
export function buildPlayerTankRows(
  tanks: TankStats[],
  encyclopedia: Record<string, VehicleMeta>,
  wn8Expected: Map<number, WN8Expected>,
  wnxExpected: Map<number, WNXExpected>,
  economics?: Map<number, TankEconomics>,
  /** The account's verified garage, when one has been read. */
  garage?: ReadonlySet<number> | null,
  rated = true,
): PlayerTankRow[] {
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  const { idToSlug } = buildTankSlugIndex(encyclopedia);
  const rows = tanks
    // A vehicle with no battles is normally dropped: Wargaming keeps its row
    // long after it was sold, so an unverified one says nothing and would sit
    // in the vehicle table as a line of dashes. A verified garage changes what
    // it means, because then it is a vehicle the account demonstrably HOLDS and
    // has never driven, which is the half of a garage nothing else here can
    // see and the one its owner is most often told is missing.
    .filter((t) => t.all.battles > 0 || (garage?.has(t.tank_id) ?? false))
    .map((tank) => {
      const meta = encyclopedia[String(tank.tank_id)] ?? null;
      const battles = tank.all.battles;
      // Every per-battle figure below divides by this, so a vehicle owned and
      // never driven has to answer null rather than NaN. Null is already what
      // the tables render as "—", which is the right reading: the vehicle is
      // there and has no record yet.
      const played = battles > 0;
      const avgDamage = played ? tank.all.damage_dealt / battles : null;
      // A tank with battles > 0 always earned xp, so xp === 0 means the column
      // wasn't populated yet (pre-migration snapshots): show "—", not "0".
      const avgXp =
        played && Number.isFinite(tank.all.xp) && tank.all.xp > 0
          ? tank.all.xp / battles
          : null;
      return {
        tankId: tank.tank_id,
        slug: idToSlug.get(tank.tank_id) ?? null,
        name: meta?.name ?? "",
        shortName: meta?.shortName ?? null,
        tag: meta?.tag ?? null,
        tier: meta?.tier ?? null,
        nation: meta?.nation ?? null,
        type: meta?.type ?? null,
        role: meta?.role ?? null,
        isPremium: meta?.isPremium ?? false,
        isReward: meta?.isReward ?? false,
        owned: garage ? garage.has(tank.tank_id) : null,
        mom: tank.mark_of_mastery ?? null,
        moe: tank.marks_on_gun ?? null,
        moePercent: tank.mark_percent ?? null,
        markReach: null,
        battles,
        avgDamage,
        avgXp,
        winrate: played ? tank.all.wins / battles : null,
        wn7: played && rated
          ? computeWN7(
              {
                battles,
                wins: tank.all.wins,
                frags: tank.all.frags,
                damageDealt: tank.all.damage_dealt,
                spotted: tank.all.spotted,
                droppedCapturePoints: tank.all.dropped_capture_points,
              },
              meta?.tier ?? null,
            )
          : null,
        wn8:
          played && rated
            ? computeWN8([tank], wn8Expected, encyclopedia, wn8Fallback)
            : null,
        wnx: played && rated ? computeWNX([tank], wnxExpected) : null,
        buyGold: economics?.get(tank.tank_id)?.buyGold ?? null,
        buyCredits: economics?.get(tank.tank_id)?.buyCredits ?? null,
        researchXp: economics?.get(tank.tank_id)?.researchXp ?? null,
      };
    });

  if (!garage) return rows;

  // A vehicle in the garage that the account has never driven has no stats row
  // ANYWHERE to filter in above: Wargaming has nothing to report about it, and
  // our own snapshots are built from what Wargaming reports. The garage is the
  // only record that it exists, so its row is built from the garage.
  //
  // This is the exact vehicle players say the site cannot see ("I own every
  // tier X, I just never played them, so the page says my account is empty"),
  // and it is also the one a rebuild cost most needs, because an untouched tank
  // cost its owner the same as a worn one.
  const seen = new Set(rows.map((r) => r.tankId));
  for (const tankId of garage) {
    if (seen.has(tankId)) continue;
    const meta = encyclopedia[String(tankId)] ?? null;
    // Absent from the catalogue means we cannot name it, price it or link to
    // it, which is a row of dashes with nothing to click. Those are vehicles WG
    // has withdrawn, so they are dropped rather than rendered as a mystery.
    if (!meta) continue;
    rows.push({
      tankId,
      slug: idToSlug.get(tankId) ?? null,
      name: meta.name,
      shortName: meta.shortName ?? null,
      tag: meta.tag ?? null,
      tier: meta.tier ?? null,
      nation: meta.nation ?? null,
      type: meta.type ?? null,
      role: meta.role ?? null,
      isPremium: meta.isPremium ?? false,
      isReward: meta.isReward ?? false,
      owned: true,
      mom: null,
      moe: null,
      moePercent: null,
      markReach: null,
      battles: 0,
      avgDamage: null,
      avgXp: null,
      winrate: null,
      wn7: null,
      wn8: null,
      wnx: null,
      buyGold: economics?.get(tankId)?.buyGold ?? null,
      buyCredits: economics?.get(tankId)?.buyCredits ?? null,
      researchXp: economics?.get(tankId)?.researchXp ?? null,
    });
  }
  return rows;
}


/**
 * The garage list as the endpoint serves it: the rows, which battle mode they
 * describe, and what else the player has a record in.
 *
 * The last two ride the same payload rather than an endpoint of their own,
 * because the selector has to be right on the first paint: fetched separately
 * it would appear a beat after the table, and a reader would see the mode they
 * are already looking at arrive as an option.
 */
export type PlayerTanksPayload = {
  tanks: PlayerTankRow[];
  /** Null for the vehicle's whole record, which is what the rest of the site
   * means by its stats. */
  mode: TankBattleMode | null;
  modes: TankModeAvailability[];
};
