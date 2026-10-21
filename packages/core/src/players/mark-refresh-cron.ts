import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { findStaleMarkHolders, refreshPlayerMarks } from "./mark-refresh";

/**
 * Every fifteen minutes, off the quarter hours the hourly recomputes sit on, so
 * a three-mark gun earned in the evening is on the board within the hour.
 */
const SCHEDULE = "4-59/15 * * * *";

/**
 * Reads per pass. Sequential and paced by the portal pool, which this shares
 * with the live refresh lane and the clan backfill, so a pass never holds more
 * than one request of it at a time. Steady state needs about ten a pass on EU;
 * the headroom is for draining a backlog (1,893 accounts on the day this
 * shipped, so about three hours), first page first.
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
  if (holders.length === 0) return;
  let read = 0;
  for (const holder of holders) {
    if (await refreshPlayerMarks(region, holder)) read += 1;
  }
  console.log(
    `[marks-refresh] ${region}: ${read}/${holders.length} board accounts re-read`,
  );
}
