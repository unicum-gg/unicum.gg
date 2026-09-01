import type { Region } from "@unicum.gg/wargaming";
import { countPending, mirrorTournament, pickUnmirrored, sweepCatalog } from "./index";

/**
 * Drains a region's un-mirrored tournaments.
 *
 * Serial on purpose. The whole pass is bounded by the tournament system's own
 * rate pool (three requests a second, shared across the host), so firing several
 * tournaments at once would only queue deeper on the same bucket while making a
 * failure harder to place. One tournament costs roughly 4 + stages + groups
 * requests, so a region's full archive is hours of walking, not minutes, and
 * that is fine: nothing downstream is waiting on it.
 */

export type BackfillProgress = {
  region: Region;
  mirrored: number;
  failed: number;
  remaining: number;
};

export type BackfillOptions = {
  /** Stop after this many tournaments. Omit to drain the region. */
  limit?: number;
  /** Called after each tournament, for progress output. */
  onProgress?: (progress: BackfillProgress) => void;
};

/** Tournaments claimed per round trip to the database. Small, because each one
 * takes seconds to mirror and a crash mid-batch simply re-claims the rest. */
const CLAIM_SIZE = 25;

export async function backfillRegion(
  region: Region,
  { limit, onProgress }: BackfillOptions = {},
): Promise<BackfillProgress> {
  let mirrored = 0;
  let failed = 0;
  // A failure leaves the tournament unstamped, which is what lets the next run
  // retry it. Within THIS run that would be a loop: the claim is ordered by date
  // and knows nothing about attempts, so once only failing tournaments are left
  // it would hand back the same ids forever. Remembering what has been tried is
  // what turns "retry next time" into "retry next time" rather than "retry now,
  // and now, and now".
  const attempted = new Set<number>();
  for (;;) {
    const budget = limit === undefined ? CLAIM_SIZE : limit - mirrored - failed;
    if (budget <= 0) break;
    const claimed = await pickUnmirrored(region, CLAIM_SIZE + attempted.size);
    const ids = claimed.filter((id) => !attempted.has(id)).slice(0, budget);
    if (ids.length === 0) break;
    for (const id of ids) {
      attempted.add(id);
      try {
        await mirrorTournament(region, id);
        mirrored += 1;
      } catch (err) {
        failed += 1;
        console.error(`[tournaments-backfill-${region}] ${id} failed:`, err);
      }
      onProgress?.({ region, mirrored, failed, remaining: -1 });
    }
  }
  return { region, mirrored, failed, remaining: await countPending(region) };
}

/**
 * The one-time seeding pass: walk the settled archive into the catalogue, then
 * mirror every bracket in it. Safe to interrupt and re-run, since it only ever
 * claims what is still unstamped.
 */
export async function seedRegion(
  region: Region,
  options: BackfillOptions = {},
): Promise<BackfillProgress> {
  const sweep = await sweepCatalog(region, { settled: true });
  console.log(
    `[tournaments-backfill-${region}] catalogue: ${sweep.seen} listed, ${sweep.pending} to mirror`,
  );
  return backfillRegion(region, options);
}
