import cron from "node-cron";
import { tryAcquireLease } from "./lease";

// Local dev: skip the leader election so `pnpm dev` actually runs crons
// against the shared DB (otherwise prod always wins the lease and dev sees
// nothing happen). Prod stays HA-safe via the lease.
const SKIP_LEASE = process.env.NODE_ENV === "development";

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
): void {
  let inFlight = false;
  cron.schedule(schedule, async () => {
    if (inFlight) {
      console.warn(`[${name}] previous tick still in flight, skipping`);
      return;
    }
    inFlight = true;
    try {
      if (!SKIP_LEASE && !(await tryAcquireLease())) return;
      await fn();
    } catch (err) {
      console.error(`[${name}] tick failed:`, err);
    } finally {
      inFlight = false;
    }
  });
}
