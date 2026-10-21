import {
  availableTankModes,
  buildPlayerTankRows,
  isRatedTankMode,
  tankModeBlockMap,
  withTankMarkReach,
  type PlayerTanksPayload,
  type TankBattleMode,
  type TankEconomics,
  type TankStats,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { loadPlayerInitialData } from "@unicum.gg/core/players/initial-data";
import { tankSnapshotsToTankStats } from "@unicum.gg/core/players/tanks";
import { applyGarageMarks } from "@unicum.gg/core/players";
import { recentTankStats } from "@unicum.gg/core/players/detail";
import { loadPlayerGarage } from "@unicum.gg/core/players/garage";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { getTankMoeByRegion } from "@unicum.gg/core/moe";
import { getAllTankSpecs } from "@unicum.gg/core/wargaming/wot/tanks/specs";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import {
  getPlayerModeRows,
  groupModeRowsByTank,
} from "@unicum.gg/core/players/tank-modes";

/**
 * Loader for the on-demand per-tank list endpoint (the heavy `vehicles` array
 * that used to ride along in the detail payload). Resolves the player from the
 * DB, loads the latest per-tank snapshots and builds the rows the exact same way
 * `buildPlayerDetail` does. DB-only (no live WG fetch): the detail endpoint
 * already resolves/records cold accounts, so by the time the Tanks section is
 * opened the player is tracked. Returns null when the player is unknown.
 *
 * `mode` swaps each vehicle's counters for that mode's, so the table keeps every
 * column it already has and answers a different question. The marks stay as they
 * are: a Mark of Excellence is on the gun, not on a format, so it is carried
 * from the snapshot rather than blanked or recomputed.
 */
export async function loadPlayerTanks(
  region: Region,
  nickname: string,
  mode: TankBattleMode | null = null,
): Promise<PlayerTanksPayload | null> {
  const initial = await loadPlayerInitialData(region, { nickname });
  if (!initial.player) return null;
  const playerId = initial.player.id;

  const overall = tankSnapshotsToTankStats(initial.latestTankSnapshots);
  await applyGarageMarks(region, initial.player.accountId, overall);
  const [
    encyclopedia,
    wn8Expected,
    wnxExpected,
    specs,
    garage,
    moeThresholds,
    modeRows,
  ] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
    getAllTankSpecs(),
    loadPlayerGarage(region, initial.player.accountId),
    // The region's mark bars, for the mark column. A cached catalogue read
    // like the detail endpoint's, so the heaviest list we serve pays nothing
    // for it, and the table is where the reader asks "which of these could I
    // mark" in the first place.
    getTankMoeByRegion(region),
    // The breakdown is a convenience over the vehicle list, so a failure here
    // serves the overall table rather than 502ing the tab.
    getPlayerModeRows(region, playerId).catch((err) => {
      console.error("[player tanks] getPlayerModeRows failed:", err);
      return [];
    }),
  ]);
  const economics = new Map<number, TankEconomics>();
  for (const [tankId, s] of specs) {
    economics.set(tankId, {
      buyGold: s.buyGold,
      buyCredits: s.buyCredits,
      researchXp: s.researchXp,
    });
  }

  const rowsByTank = groupModeRowsByTank(modeRows);
  // Derived ONCE per vehicle and read twice. Both the option list and the mode
  // filter need every mode's block, and deriving them separately meant up to
  // eleven block objects built twice per vehicle (around 14,400 of them on a
  // 655-vehicle account) to keep one.
  const blocksByTank = new Map(
    overall.map((tank: TankStats) => [
      tank.tank_id,
      tankModeBlockMap(
        tank.all,
        { maxXp: tank.max_xp ?? null, maxFrags: tank.max_frags ?? null },
        rowsByTank.get(tank.tank_id) ?? [],
      ),
    ]),
  );
  const modes = availableTankModes(blocksByTank);

  // A vehicle the player never took into the chosen mode drops out of the list
  // entirely, which is the point: the table answers "what did I play HERE".
  const tanks =
    mode === null
      ? overall
      : overall.flatMap((tank: TankStats) => {
          const block = blocksByTank.get(tank.tank_id)?.get(mode);
          return block ? [{ ...tank, all: block }] : [];
        });

  return {
    // The mark reach is read off the OVERALL rows whatever mode is shown: a
    // mark is scored on a rolling window of recent random battles, so a
    // Skirmish row has nothing to say about it and the estimate would be a
    // different quantity under the same column.
    tanks: withTankMarkReach(
      buildPlayerTankRows(
        tanks,
        encyclopedia,
        wn8Expected,
        wnxExpected,
        economics,
        garage?.tankIds ?? null,
        // Outside Random the WN ratings score a format against a standard it
        // was never set by, so the rows carry null and the table drops the
        // column. The mode-less list keeps them: that is the `all` block,
        // which is what every rating on the site has always been read from.
        mode === null || isRatedTankMode(mode),
      ),
      overall,
      recentTankStats(
        overall,
        initial.periodSnapshots.d30,
        initial.periodTankSnapshots.d30,
      ),
      moeThresholds,
    ),
    mode,
    modes,
  };
}
