import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import {
  findStaleMarkHolders,
  findUnreadMarkCandidates,
  refreshPlayerMarks,
} from "./mark-refresh";

/**
 * Every fifteen minutes, off the quarter hours the hourly recomputes sit on, so
 * a three-mark gun earned in the evening is on the board within the hour.
 */
const SCHEDULE = "4-59/15 * * * *";

/**
 * Reads per pass. Sequential and paced by the portal pool, which this shares
 * with the live refresh lane and the clan backfill, so a pass never holds more
 * than one request of it at a time. Steady state needs about ten a pass on EU
 * to keep the board current; whatever that leaves goes to accounts never read
 * (`findUnreadMarkCandidates`), so the board fills in on its own instead of
 * waiting for somebody to look each holder up. The board comes first, so a
 * backlog there pauses discovery rather than the other way round.
 */
const PER_PASS = 120;

export function startMarksRefreshCron(): void {
  for (const region of REGIONS) {
    const name = `marks-refresh-cron-${region}`;
    if (scheduleCron(name, SCHEDULE, () => refreshStaleMarks(region))) {
      console.log(`[${name}] scheduled (${SCHEDULE})`);
    }
  }
}

async function refreshStaleMarks(region: Region): Promise<void> {
  const holders = await findStaleMarkHolders(region, PER_PASS);
  const unread = await findUnreadMarkCandidates(
    region,
    PER_PASS - holders.length,
  );
  if (holders.length + unread.length === 0) return;
  let read = 0;
  for (const holder of holders) {
    if (await refreshPlayerMarks(region, holder)) read += 1;
  }
  let discovered = 0;
  for (const candidate of unread) {
    if (await refreshPlayerMarks(region, candidate)) discovered += 1;
  }
  console.log(
    `[marks-refresh] ${region}: ${read}/${holders.length} board accounts re-read, ${discovered}/${unread.length} unread accounts discovered`,
  );
}
