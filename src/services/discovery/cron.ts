import cron from "node-cron";
import { tryAcquireLease } from "@/services/cron/lease";
import { REGIONS } from "@/services/wargaming/wot";
import { discoverTopClanPlayers } from ".";

const SCHEDULE = "0 4 * * 0"; // Sundays at 04:00 server time
const TOP_N = 500;

export function startDiscoveryCron() {
  cron.schedule(SCHEDULE, async () => {
    try {
      const isLeader = await tryAcquireLease();
      if (!isLeader) return;
      await runDiscoveryAllRegions();
    } catch (err) {
      console.error("[discovery cron] tick failed:", err);
    }
  });
  console.log(`[discovery cron] scheduled (${SCHEDULE})`);
}

async function runDiscoveryAllRegions(): Promise<void> {
  for (const region of REGIONS) {
    try {
      await discoverTopClanPlayers(region, TOP_N);
    } catch (err) {
      console.error(`[discovery cron] ${region} failed:`, err);
    }
  }
}
