import { scheduleCron } from "@/services/cron/scheduler";
import { REGIONS } from "@/services/wargaming/wot";
import { discoverTopClanPlayers } from ".";

const SCHEDULE = "0 4 * * 0"; // Sundays at 04:00 server time
const TOP_N = 500;

export function startDiscoveryCron(): void {
  if (
    scheduleCron("discovery cron", SCHEDULE, async () => {
      await runDiscoveryAllRegions();
    })
  ) {
    console.log(`[discovery cron] scheduled (${SCHEDULE})`);
  }
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
