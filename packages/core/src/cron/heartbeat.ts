/**
 * In-process record of the cron loop's last signs of life, read by the worker's
 * health endpoint (`apps/worker/src/health.ts`).
 *
 * It exists because a watchdog cannot report the failure of the host it runs on,
 * and ours are crons like any other: `scheduleCron` begins every tick by
 * acquiring the `cron_leader` lease, which is an INSERT, so a worker that cannot
 * reach Postgres never runs the very jobs whose purpose is to announce that
 * nothing is landing. That is not theory: on 2026-10-24 the worker spent 14h10
 * alive and unable to resolve Postgres or Redis, every tick failing on the
 * lease, with `server-online-watchdog` and `onslaught-watchdog` among the jobs
 * it therefore never executed, and nothing said a word.
 *
 * So the signal has to be stamped by the scheduler itself and read from outside
 * the process. Deliberately in memory rather than in Redis or the database:
 * both are what this is meant to catch, and a record kept in either would be
 * unreadable in exactly the failure it exists for.
 */

type CronHeartbeat = {
  /**
   * Last tick whose lease query ANSWERED, whether or not this instance won it.
   * Proves two things at once, which is why the health check reads this one:
   * node-cron is still firing, and Postgres replied.
   */
  lastBeatAt: number | null;
  /** Last tick whose job ran to completion, and which job it was. */
  lastCompletedAt: number | null;
  lastCompletedName: string | null;
  completed: number;
  failed: number;
};

const heartbeat: CronHeartbeat = {
  lastBeatAt: null,
  lastCompletedAt: null,
  lastCompletedName: null,
  completed: 0,
  failed: 0,
};

/** The lease query came back. Called whether or not this instance is leader. */
export function recordCronBeat(): void {
  heartbeat.lastBeatAt = Date.now();
}

export function recordCronCompleted(name: string): void {
  heartbeat.lastCompletedAt = Date.now();
  heartbeat.lastCompletedName = name;
  heartbeat.completed += 1;
}

export function recordCronFailed(): void {
  heartbeat.failed += 1;
}

export function readCronHeartbeat(): Readonly<CronHeartbeat> {
  return heartbeat;
}
