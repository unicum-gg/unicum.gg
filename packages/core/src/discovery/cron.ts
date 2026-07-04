import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { REGIONS } from "@unicum.gg/wargaming/region";
import { refreshVehicles } from "@unicum.gg/core/wargaming/wot/encyclopedia";
import { discoverTopClanPlayers } from ".";

const DISCOVERY_SCHEDULE = "0 4 * * 0"; // Sundays at 04:00 server time
// IzeBerg's wot-src mirror gets pushed almost exclusively on Tuesday or
// Thursday between 02:30 and 07:00 UTC (concentrated 04:30-05:00). Running
// at 07:00 keeps us safely after that window so we never miss the day of a
// fresh release.
const VEHICLES_SCHEDULE = "0 7 * * *"; // Every day at 07:00 server time
const TOP_N = 500;

export function startDiscoveryCron(): void {
  if (
    scheduleCron("discovery-cron", DISCOVERY_SCHEDULE, async () => {
      await runDiscoveryAllRegions();
    })
  ) {
    console.log(`[discovery-cron] scheduled (${DISCOVERY_SCHEDULE})`);
  }
  // Vehicles tracks the live WoT client via IzeBerg/wot-src and gets new
  // tanks at every patch (typically monthly), so daily is the right cadence
  // to catch them quickly. Cheap too: 11 small XML + 11 .po fetches from
  // GitHub raw per region, ~3-5s total.
  if (
    scheduleCron("vehicles-cron", VEHICLES_SCHEDULE, async () => {
      await refreshVehiclesCatalogue();
    })
  ) {
    console.log(`[vehicles-cron] scheduled (${VEHICLES_SCHEDULE})`);
  }
}

async function runDiscoveryAllRegions(): Promise<void> {
  for (const region of REGIONS) {
    try {
      await discoverTopClanPlayers(region, TOP_N);
    } catch (err) {
      console.error(`[discovery-cron] ${region} failed:`, err);
    }
  }
}

async function refreshVehiclesCatalogue(): Promise<void> {
  for (const region of REGIONS) {
    try {
      const count = await refreshVehicles(region);
      console.log(`[vehicles-cron] ${region} refreshed (${count} rows)`);
    } catch (err) {
      console.error(`[vehicles-cron] ${region} refresh failed:`, err);
    }
  }
}
