import cron from "node-cron";
import { tryAcquireLease } from "./lease";

/**
 * Schedule a cron tick that (a) skips if the previous tick is still in flight
 * (prevents pileup of concurrent ticks that hold thousands of in-flight
 * Promises in the rate-limit queue → heap OOM), and (b) only runs on the
 * leader instance.
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
      if (!(await tryAcquireLease())) return;
      await fn();
    } catch (err) {
      console.error(`[${name}] tick failed:`, err);
    } finally {
      inFlight = false;
    }
  });
}
