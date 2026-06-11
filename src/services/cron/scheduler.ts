import cron from "node-cron";
import { tryAcquireLease } from "./lease";

// Local dev: skip the leader election so `pnpm dev` actually runs crons
// against the shared DB (otherwise prod always wins the lease and dev sees
// nothing happen). Prod stays HA-safe via the lease.
const SKIP_LEASE = process.env.NODE_ENV === "development";

// Hard kill-switch: set `SKIP_CRONS=true` in .env.local to disable all crons
// entirely (no schedule registration). Useful when iterating on rating logic
// or anything else that doesn't need background ticks polluting the DB.
const SKIP_CRONS = process.env.SKIP_CRONS === "true";

/**
 * Schedule a cron tick that (a) skips if the previous tick is still in flight
 * (prevents pileup of concurrent ticks that hold thousands of in-flight
 * Promises in the rate-limit queue → heap OOM), and (b) only runs on the
 * leader instance (production-only).
 */
export function scheduleCron(
  name: string,
  schedule: string,
  fn: () => Promise<void>,
): boolean {
  if (SKIP_CRONS) {
    console.log(`[${name}] SKIP_CRONS=true, not scheduling`);
    return false;
  }
  let inFlight = false;
  cron.schedule(schedule, async () => {
    if (inFlight) return;
    inFlight = true;
    const start = Date.now();
    try {
      if (!SKIP_LEASE && !(await tryAcquireLease())) return;
      await fn();
      console.log(`[${name}] tick completed in ${Date.now() - start}ms`);
    } catch (err) {
      console.error(
        `[${name}] tick failed after ${Date.now() - start}ms:`,
        err,
      );
    } finally {
      inFlight = false;
    }
  });
  return true;
}
