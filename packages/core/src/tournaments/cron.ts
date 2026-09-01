import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { mirrorTournament, pickLive, pickUnmirrored, sweepCatalog } from "./index";

/**
 * Keeps the tournament mirror current, per region.
 *
 * Two jobs rather than one, because the work splits cleanly in two. What is
 * still being played changes by the minute and is a handful of tournaments, so
 * it is re-read often and in full. What has settled never changes again, so it
 * is read once, and the only thing left to do is drain whatever the archive has
 * not caught up on yet.
 */

// Registration counts move as teams sign up and a bracket fills in during play,
// which is what a tournament page is for. Five minutes is well inside the
// pace of a nightly ladder (registration runs for hours, matches for one), and
// a region only carries a handful of live tournaments, so a tick is a few dozen
// requests against a pool of its own.
const LIVE_SCHEDULE = "*/5 * * * *";

// The settled tail: yesterday's tournaments finishing, plus whatever the seed
// pass has not reached. Hourly is far more often than it needs (a region
// completes a couple of tournaments a day), which is the point: it means the
// archive is never more than an hour behind without ever running long.
const ARCHIVE_SCHEDULE = "17 * * * *";

// Settled tournaments mirrored per archive tick. Bounded so the hourly job
// cannot turn into an unattended multi-hour drain competing with the live one:
// seeding the back catalogue is `seedRegion`'s job, run deliberately.
const ARCHIVE_BATCH = 40;

export function startTournamentsCron(): void {
  for (const region of REGIONS) {
    const live = `tournaments-live-cron-${region}`;
    if (scheduleCron(live, LIVE_SCHEDULE, () => syncLive(region))) {
      console.log(`[${live}] live tournament sync scheduled (${LIVE_SCHEDULE})`);
    }
    const archive = `tournaments-archive-cron-${region}`;
    if (scheduleCron(archive, ARCHIVE_SCHEDULE, () => syncArchive(region))) {
      console.log(`[${archive}] settled tournament sync scheduled (${ARCHIVE_SCHEDULE})`);
    }
  }
}

/**
 * Re-read the catalogue's live statuses, then re-mirror every tournament that
 * has not settled. The sweep runs first because it is what discovers a
 * tournament that opened since the last tick, and what notices one has moved on.
 */
export async function syncLive(region: Region): Promise<void> {
  await sweepCatalog(region);
  const ids = await pickLive(region);
  let mirrored = 0;
  for (const id of ids) {
    try {
      await mirrorTournament(region, id);
      mirrored += 1;
    } catch (err) {
      console.error(`[tournaments-live-cron-${region}] ${id} failed:`, err);
    }
  }
  if (ids.length > 0) {
    console.log(`[tournaments-live-cron-${region}] ${mirrored}/${ids.length} mirrored`);
  }
}

/**
 * Mirror a bounded batch of settled tournaments. This is the same claim the
 * seeding pass drains, so once the archive is in, a tick usually finds the one
 * or two tournaments that completed since the last hour and returns.
 */
export async function syncArchive(region: Region): Promise<void> {
  const ids = await pickUnmirrored(region, ARCHIVE_BATCH);
  if (ids.length === 0) return;
  let mirrored = 0;
  for (const id of ids) {
    try {
      await mirrorTournament(region, id);
      mirrored += 1;
    } catch (err) {
      console.error(`[tournaments-archive-cron-${region}] ${id} failed:`, err);
    }
  }
  console.log(`[tournaments-archive-cron-${region}] ${mirrored}/${ids.length} mirrored`);
}
