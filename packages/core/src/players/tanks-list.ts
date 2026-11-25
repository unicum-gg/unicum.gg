import {
  DEFAULT_TANK_BATTLE_MODE,
  EMPTY_TANK_OVERALL,
  availableTankModes,
  buildPlayerTankRows,
  isRatedTankMode,
  tankModeBlockMap,
  withTankMarkReach,
  type PlayerTankCareer,
  type PlayerTankRow,
  type PlayerTanksPayload,
  type PlayerTanksWindow,
  type StatWindow,
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
import { loadTankWindowBaseline } from "./stat-window";
import { tankPeriod } from "./tank-periods";
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
 *
 * `window` reads every row over that window instead of the vehicle's career,
 * lists only the vehicles played inside it, and carries each one's career
 * beside it. Random Battles only (or the mode-less list, whose window is the
 * same battles): the per-mode breakdown is current state with no history to
 * diff, so a window under any other mode is ignored and `window` answers null.
 */
export async function loadPlayerTanks(
  region: Region,
  nickname: string,
  mode: TankBattleMode | null = null,
  window: StatWindow | null = null,
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
  // A vehicle only ever taken into a mode outside `all` (Skirmishes, Advances,
  // Global Map...) has no snapshot at all, since Wargaming reports it with
  // `all.battles` at 0 and nothing is recorded for that. The whole of the tier
  // XI Skirmish fleet is in that state (the 7x7 copies, Black Rock), so walking
  // the snapshots alone dropped its rows from every mode view while the tier
  // split on the profile still counted their battles. Such a vehicle joins the
  // mode views with an empty overall block (see `EMPTY_TANK_OVERALL`), so it
  // stays out of the Random list exactly as before.
  const tracked = new Set(overall.map((tank: TankStats) => tank.tank_id));
  const modeOnly: TankStats[] = [...rowsByTank.keys()]
    .filter((tankId) => !tracked.has(tankId))
    .map((tankId) => ({
      tank_id: tankId,
      mark_of_mastery: null,
      all: { ...EMPTY_TANK_OVERALL },
    }));
  const withModeOnly = [...overall, ...modeOnly];
  // Derived ONCE per vehicle and read twice. Both the option list and the mode
  // filter need every mode's block, and deriving them separately meant up to
  // eleven block objects built twice per vehicle (around 14,400 of them on a
  // 655-vehicle account) to keep one.
  const blocksByTank = new Map(
    withModeOnly.map((tank: TankStats) => [
      tank.tank_id,
      tankModeBlockMap(
        tank.all,
        { maxXp: tank.max_xp ?? null, maxFrags: tank.max_frags ?? null },
        rowsByTank.get(tank.tank_id) ?? [],
      ),
    ]),
  );
  const modes = availableTankModes(blocksByTank);

  const windowed =
    window !== null && (mode === null || mode === DEFAULT_TANK_BATTLE_MODE);
  if (windowed) {
    return {
      ...(await loadWindowedTanks(region, playerId, window, overall, {
        encyclopedia,
        wn8Expected,
        wnxExpected,
        economics,
        garage: garage?.tankIds ?? null,
        moeThresholds,
        recent: recentTankStats(overall, initial.periodTankSnapshots.d30),
      })),
      mode,
      modes,
    };
  }

  // A vehicle the player never took into the chosen mode drops out of the list
  // entirely, which is the point: the table answers "what did I play HERE".
  const tanks =
    mode === null
      ? overall
      : withModeOnly.flatMap((tank: TankStats) => {
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
      recentTankStats(overall, initial.periodTankSnapshots.d30),
      moeThresholds,
    ),
    mode,
    modes,
    window: null,
  };
}

type RowContext = {
  encyclopedia: Awaited<ReturnType<typeof getVehicleEncyclopedia>>;
  wn8Expected: Awaited<ReturnType<typeof getWN8ExpectedValues>>;
  wnxExpected: Awaited<ReturnType<typeof getWNXExpectedValues>>;
  economics: Map<number, TankEconomics>;
  garage: ReadonlySet<number> | null;
  moeThresholds: Awaited<ReturnType<typeof getTankMoeByRegion>>;
  recent: ReturnType<typeof recentTankStats>;
};

function careerOf(row: PlayerTankRow): PlayerTankCareer {
  return {
    battles: row.battles,
    avgDamage: row.avgDamage,
    avgXp: row.avgXp,
    winrate: row.winrate,
    wn7: row.wn7,
    wn8: row.wn8,
    wnx: row.wnx,
  };
}

/**
 * The garage over a window: each vehicle's counters diffed against its
 * baseline with the same `tankPeriod` the profile's period columns use, rated
 * the same way the career rows are, and paired with its career row.
 *
 * Only what was played inside the window is listed, so a verified garage's
 * never-driven vehicles stay out. The marks stay the gun's (they are not a
 * figure of a window), and so does the mark comparison, which reads the
 * career and the last 30 days exactly as on the career list.
 */
async function loadWindowedTanks(
  region: Region,
  playerId: number,
  window: StatWindow,
  overall: TankStats[],
  ctx: RowContext,
): Promise<Pick<PlayerTanksPayload, "tanks" | "window">> {
  const { baseline, from, truncated } = await loadTankWindowBaseline(
    region,
    playerId,
    window,
  );
  const meta: PlayerTanksWindow = { window, from, truncated };
  const period = tankPeriod(overall, baseline, null);
  if (!period) return { tanks: [], window: meta };

  const byId = new Map(overall.map((t) => [t.tank_id, t]));
  const played = period.tanks.map((p) => ({ ...byId.get(p.tank_id)!, all: p.all }));
  const rows = (tanks: TankStats[]) =>
    buildPlayerTankRows(
      tanks,
      ctx.encyclopedia,
      ctx.wn8Expected,
      ctx.wnxExpected,
      ctx.economics,
      ctx.garage,
    ).filter((r) => r.battles > 0);
  const careers = new Map(
    rows(played.map((p) => byId.get(p.tank_id)!)).map((r) => [r.tankId, careerOf(r)]),
  );
  const windowRows = withTankMarkReach(rows(played), overall, ctx.recent, ctx.moeThresholds);
  return {
    tanks: windowRows.map((r) => ({ ...r, career: careers.get(r.tankId) ?? null })),
    window: meta,
  };
}
