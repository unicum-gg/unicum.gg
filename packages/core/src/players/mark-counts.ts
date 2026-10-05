import { sql } from "drizzle-orm";
import {
  buildPlayerMarkCounts,
  type PlayerMarkCounts,
  playerMarksByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Store how many Marks of Excellence an account holds, from the map the portal
 * just answered with.
 *
 * Called from the refresh path, right after `fetchPlayerMarksOnGun`, because
 * that is the only moment a mark can move in our data and the only reading of a
 * garage with no battle floor on it (see `*_player_marks` for why the nightly
 * snapshot walk cannot be the source). The tiers come from the per-region
 * catalogue, which is an in-memory cached read, so the whole write is one
 * upsert and no extra query.
 *
 * `languages` is deliberately absent from the upsert: it belongs to the hourly
 * pass that infers it from clan history, and naming it here would blank it on
 * every refresh.
 */
export async function writePlayerMarkCounts(
  region: Region,
  accountId: number,
  marksByTank: Map<number, number>,
  /** The account's lifetime battles, which the board filters on locally. */
  battles: number,
): Promise<PlayerMarkCounts | null> {
  // An empty map is the portal failing open (`fetchPlayerMarksOnGun` swallows a
  // blip and answers nothing), not a player with an empty garage. Writing it
  // would zero a good row on every portal hiccup, so it is left alone and the
  // stored counts keep saying when they were last measured.
  if (marksByTank.size === 0) return null;

  const encyclopedia = await getVehicleEncyclopedia(region);
  const counts = buildPlayerMarkCounts(marksByTank, (tankId) => {
    const meta = encyclopedia[String(tankId)];
    return meta ? meta.tier : null;
  });

  const table = playerMarksByRegion[region];
  const row = {
    accountId,
    marks1ByTier: counts.mark1.byTier,
    marks2ByTier: counts.mark2.byTier,
    marks3ByTier: counts.mark3.byTier,
    marks1Total: counts.mark1.total,
    marks2Total: counts.mark2.total,
    marks3Total: counts.mark3.total,
    known: counts.known,
    battles,
    measuredAt: new Date(),
  };
  await db
    .insert(table)
    .values(row)
    .onConflictDoUpdate({ target: table.accountId, set: row });
  return counts;
}

/**
 * Store a batch of accounts' counts in one statement, for the backfill.
 *
 * Same write as above and the same silence about `languages`, but the counts
 * arrive already folded: the backfill reads mark levels out of the snapshots
 * rather than off the portal, so it holds its own tier lookup and would pay a
 * catalogue read per account if it came through the single-row path.
 */
export async function writePlayerMarkCountsBatch(
  region: Region,
  rows: Array<{
    accountId: number;
    counts: PlayerMarkCounts;
    battles: number;
    measuredAt: Date;
  }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const table = playerMarksByRegion[region];
  const values = rows.map(({ accountId, counts, battles, measuredAt }) => ({
    accountId,
    marks1ByTier: counts.mark1.byTier,
    marks2ByTier: counts.mark2.byTier,
    marks3ByTier: counts.mark3.byTier,
    marks1Total: counts.mark1.total,
    marks2Total: counts.mark2.total,
    marks3Total: counts.mark3.total,
    known: counts.known,
    battles,
    measuredAt,
  }));
  await db
    .insert(table)
    .values(values)
    .onConflictDoUpdate({
      target: table.accountId,
      set: {
        marks1ByTier: sql`excluded.marks_1_by_tier`,
        marks2ByTier: sql`excluded.marks_2_by_tier`,
        marks3ByTier: sql`excluded.marks_3_by_tier`,
        marks1Total: sql`excluded.marks_1_total`,
        marks2Total: sql`excluded.marks_2_total`,
        marks3Total: sql`excluded.marks_3_total`,
        known: sql`excluded.known`,
        battles: sql`excluded.battles`,
        measuredAt: sql`excluded.measured_at`,
      },
    });
  return values.length;
}
