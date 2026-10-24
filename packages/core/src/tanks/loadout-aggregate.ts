import { sql } from "drizzle-orm";
import {
  LoadoutItemKind,
  LoadoutMode,
  LOADOUT_MODES,
  loadoutModeOf,
  type AmmoSummary,
  type LoadoutItemUsage,
  type LoadoutModeBreakdown,
  type PopularSetup,
  type TankLoadoutStats,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { crewSkillUsage } from "@unicum.gg/core/tanks/loadout-crew";
import { fieldModUsage } from "@unicum.gg/core/tanks/loadout-field-mods";
import {
  battlesCte,
  num,
  PER_PLAYER_COLUMNS,
  performanceOf,
  PERFORMANCE_COLUMNS,
  ratingContext,
  type PerformanceRow,
  type RatingContext,
} from "@unicum.gg/core/tanks/loadout-sql";
import { topTankBattles } from "@unicum.gg/core/tanks/loadout-top-battles";
import { topTankPlayers } from "@unicum.gg/core/tanks/loadout-top-players";

/**
 * Rolling a vehicle's battles up into what its players actually fit.
 *
 * Read live, not materialised, and that follows the same line the community
 * ratings draw: a question about ONE vehicle is an indexed read of the rows
 * under one `tank_id` (`battle_loadouts_tank_idx`, on the tank and the time, so
 * the window prunes too), which is cheap and is correct the moment a battle
 * lands. Only a question comparing vehicles to each other would need a nightly
 * pass, and nothing here asks one.
 *
 * Every statement counts in Postgres and hands back one row per thing drawn.
 * Pulling the battles out to count them here is tempting while there are a few
 * hundred, and is the wrong shape to grow into.
 */

type ItemRow = PerformanceRow & { kind: string; key: string };

/**
 * Every device, consumable and directive, counted in players and in battles.
 *
 * `DISTINCT` per battle is not belt and braces: nothing stops a layout carrying
 * the same consumable in two slots, and a plain count would then report one
 * battle as two.
 */
async function itemUsage(
  region: Region,
  tankId: number,
  mode: LoadoutMode,
  sample: number,
  context: RatingContext,
): Promise<LoadoutItemUsage[]> {
  const rows = (await db.execute(sql`
    WITH observed AS (${battlesCte(region, tankId, mode)}),
    fitted AS (
      SELECT o.*, i.kind, i.key
      FROM observed o
      CROSS JOIN LATERAL (
        SELECT DISTINCT kind, key FROM (
          SELECT ${LoadoutItemKind.Equipment}::text AS kind, k AS key
          FROM unnest(o.opt_devices) k
          UNION ALL
          SELECT ${LoadoutItemKind.Consumable}, k FROM unnest(o.consumables) k
          UNION ALL
          SELECT ${LoadoutItemKind.Directive}, k FROM unnest(o.boosters) k
        ) all_items
        WHERE key IS NOT NULL
      ) i
    ),
    per_player AS (
      SELECT kind, key, account_id, ${PER_PLAYER_COLUMNS}
      FROM fitted
      GROUP BY kind, key, account_id
    )
    SELECT kind, key, ${PERFORMANCE_COLUMNS}
    FROM per_player
    GROUP BY kind, key
    ORDER BY players DESC, battles DESC, key ASC
  `)) as unknown as ItemRow[];

  return rows.map((row) => {
    const count = Number(row.players);
    return {
      kind: row.kind as LoadoutItemKind,
      key: row.key,
      count,
      battles: Number(row.battles),
      share: sample > 0 ? count / sample : 0,
      performance: performanceOf(row, context),
    };
  });
}

type SetupRow = PerformanceRow & { kind: string; items: string[] | null };

/**
 * The complete choices within one family, as whole setups rather than three
 * separate counts.
 *
 * This is the table that says something the per-item shares cannot. Three
 * devices each fitted by 60% of players do not imply that any one player runs
 * all three, and on a vehicle with a real build decision they usually do not.
 *
 * Only the families a player fills as a set are counted this way (see
 * `PopularSetup`). The devices are grouped on `devices_triple`, the sorted trio
 * the ingest already writes for exactly this; consumables are sorted here. The
 * items come back in the slot order most of the setup's battles used.
 */
async function popularSetups(
  region: Region,
  tankId: number,
  mode: LoadoutMode,
  sample: number,
  context: RatingContext,
): Promise<PopularSetup[]> {
  const rows = (await db.execute(sql`
    WITH observed AS (${battlesCte(region, tankId, mode)}),
    keyed AS (
      SELECT o.*, f.kind, f.items, f.slotted
      FROM observed o
      CROSS JOIN LATERAL (
        SELECT ${LoadoutItemKind.Equipment}::text AS kind,
               string_to_array(o.devices_triple, '+') AS items,
               array_remove(o.opt_devices, NULL) AS slotted
        UNION ALL
        SELECT ${LoadoutItemKind.Consumable},
               (SELECT array_agg(x ORDER BY x) FROM unnest(o.consumables) x WHERE x IS NOT NULL),
               array_remove(o.consumables, NULL)
      ) f
      WHERE f.items IS NOT NULL AND cardinality(f.items) > 0
    ),
    -- The order a setup is DRAWN in: the arrangement most of its battles had
    -- in their slots. The sorted set is only the key that recognises the same
    -- three items however they were placed; drawn in that order, a fire
    -- extinguisher led every row because "ext" sorts before "med".
    arranged AS (
      SELECT kind, items, mode() WITHIN GROUP (ORDER BY slotted) AS slotted
      FROM keyed
      GROUP BY kind, items
    ),
    per_player AS (
      SELECT kind, items, account_id, ${PER_PLAYER_COLUMNS}
      FROM keyed
      GROUP BY kind, items, account_id
    )
    SELECT p.kind, a.slotted AS items, ${PERFORMANCE_COLUMNS}
    FROM per_player p
    JOIN arranged a ON a.kind = p.kind AND a.items = p.items
    GROUP BY p.kind, p.items, a.slotted
    ORDER BY players DESC, battles DESC
  `)) as unknown as SetupRow[];

  return rows.map((row) => {
    const count = Number(row.players);
    return {
      kind: row.kind as LoadoutItemKind,
      items: row.items ?? [],
      count,
      battles: Number(row.battles),
      share: sample > 0 ? count / sample : 0,
      performance: performanceOf(row, context),
    };
  });
}

type SummaryRow = {
  sample: string | number;
  battles: string | number;
  ammo_battles: string | number;
  premium_share: string | number | null;
  max_premium_share: string | number | null;
  shells_loaded: string | number | null;
  updated_at: string | Date | null;
};

/**
 * The sample's own shape: how many players and battles, how much of the rack
 * is gold, and how recent the newest battle is.
 */
async function sampleSummary(
  region: Region,
  tankId: number,
  mode: LoadoutMode,
): Promise<SummaryRow> {
  const [row] = (await db.execute(sql`
    WITH observed AS (${battlesCte(region, tankId, mode)})
    SELECT
      COUNT(DISTINCT account_id)   AS sample,
      COUNT(*)                     AS battles,
      COUNT(premium_shell_share)   AS ammo_battles,
      AVG(premium_shell_share)     AS premium_share,
      MAX(premium_shell_share)     AS max_premium_share,
      AVG(shells_loaded)           AS shells_loaded,
      MAX(started_at)              AS updated_at
    FROM observed
  `)) as unknown as SummaryRow[];
  return row;
}

type ModeRow = { battle_type: string | number; players: string | number; battles: string | number };

/**
 * How many players and battles each mode holds for this vehicle, whoever they
 * are. One read over every counted mode, grouped on the game's own
 * `battle_type`, so the page knows which modes to offer before asking for any.
 */
async function modeBreakdown(
  region: Region,
  tankId: number,
): Promise<LoadoutModeBreakdown[]> {
  const rows = (await db.execute(sql`
    WITH observed AS (${battlesCte(region, tankId, null)})
    SELECT battle_type, COUNT(DISTINCT account_id) AS players, COUNT(*) AS battles
    FROM observed
    GROUP BY battle_type
  `)) as unknown as ModeRow[];
  const counted = new Map<LoadoutMode, ModeRow[]>();
  for (const row of rows) {
    const mode = loadoutModeOf(Number(row.battle_type));
    if (mode) counted.set(mode, [...(counted.get(mode) ?? []), row]);
  }
  // A mode reading several battle types would sum its players across them and
  // count anyone who played both twice. Every mode reads one today, and the
  // players figure is only used to rank and to offer the modes, so the sum is
  // the honest upper bound rather than a figure published as exact.
  return LOADOUT_MODES.map((mode) => {
    const of = counted.get(mode) ?? [];
    return {
      mode,
      players: of.reduce((total, row) => total + Number(row.players), 0),
      battles: of.reduce((total, row) => total + Number(row.battles), 0),
    };
  });
}

/**
 * Everything one vehicle's Loadouts tab draws, for one mode.
 *
 * The reads after the summary run together: they share nothing but the index
 * they descend, and the slowest of them is what the endpoint waits on rather
 * than their sum.
 */
export async function getTankLoadoutStats(
  region: Region,
  tankId: number,
  mode: LoadoutMode = LoadoutMode.Random,
): Promise<TankLoadoutStats> {
  const [modes, summary] = await Promise.all([
    modeBreakdown(region, tankId),
    sampleSummary(region, tankId, mode),
  ]);
  const sample = Number(summary.sample ?? 0);

  // Nothing to count in this mode, and every statement below would answer
  // with an empty set. The breakdown still goes back, since it is what tells
  // the page whether another mode has something.
  if (sample === 0) return emptyStats(tankId, mode, modes);

  const context = await ratingContext(region, tankId);
  const [items, fieldMods, crewSkills, setups, topPlayers, topBattles] = await Promise.all([
    itemUsage(region, tankId, mode, sample, context),
    fieldModUsage(region, tankId, mode, sample, context),
    crewSkillUsage(region, tankId, mode, context),
    popularSetups(region, tankId, mode, sample, context),
    topTankPlayers(region, tankId, mode, context),
    topTankBattles(region, tankId, mode),
  ]);

  const ammo: AmmoSummary = {
    battles: Number(summary.ammo_battles ?? 0),
    premiumShare: premiumShareOf(summary),
    shellsLoaded: num(summary.shells_loaded),
  };

  return {
    tankId,
    mode,
    modes,
    sample,
    battles: Number(summary.battles ?? 0),
    items,
    crewSkills,
    setups: [...setups, ...fieldMods],
    ammo,
    topPlayers,
    topBattles,
    updatedAt: summary.updated_at ? new Date(summary.updated_at) : null,
  };
}

/**
 * The gold share, or null while the flag it rests on carries no information.
 *
 * Counted from a `premium` flag per round, which a source can leave false on
 * everything: the garage did, on every round it ever reported. A sample whose
 * rounds are all "standard" is therefore not "nobody carries gold" but "we were
 * never told", and publishing 0% would be a measured-looking figure that is
 * wrong. So the share is withheld while no battle in the sample carries a
 * single premium round, and returns on its own once one does.
 */
function premiumShareOf(summary: SummaryRow): number | null {
  const max = num(summary.max_premium_share);
  if (max == null || max <= 0) return null;
  return num(summary.premium_share);
}

function emptyStats(
  tankId: number,
  mode: LoadoutMode,
  modes: LoadoutModeBreakdown[],
): TankLoadoutStats {
  return {
    tankId,
    mode,
    modes,
    sample: 0,
    battles: 0,
    items: [],
    crewSkills: [],
    setups: [],
    ammo: { battles: 0, premiumShare: null, shellsLoaded: null },
    topPlayers: [],
    topBattles: [],
    updatedAt: null,
  };
}
