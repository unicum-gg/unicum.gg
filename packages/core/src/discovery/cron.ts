import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { REGIONS } from "@unicum.gg/wargaming";
import { refreshVehicles } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { refreshTankSpecs } from "@unicum.gg/core/wargaming/wot/tanks/specs";
import { refreshMapHistory } from "@unicum.gg/core/wargaming/wot/maps/refresh";
import { discoverTopClanPlayers } from ".";

const DISCOVERY_SCHEDULE = "0 4 * * 0"; // Sundays at 04:00 server time
// Our own wot-src mirror builds daily at 05:00 UTC, so 07:00 leaves it two
// hours to publish. Daily rather than weekly on purpose: this is also what
// picks up a Common Test build, which appears between patches and is what a
// player wants to read before the vehicle ships.
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
  // Specs are region-agnostic (parsed from the EU branch once), so refresh the
  // global tank_specs table a single time after the per-region catalogues.
  try {
    const count = await refreshTankSpecs();
    console.log(`[vehicles-cron] tank specs refreshed (${count} tanks)`);
  } catch (err) {
    console.error("[vehicles-cron] tank specs refresh failed:", err);
  }
  // The maps come from the same mirror build as the specs, so they are recorded
  // on the same tick rather than on a schedule of their own.
  try {
    const { version, changes, testVersion, testChanges } = await refreshMapHistory();
    console.log(
      `[vehicles-cron] maps recorded @ ${version ?? "unknown"} (${changes} changes)` +
        (testVersion ? `, common test ${testVersion}: ${testChanges} changes` : ""),
    );
  } catch (err) {
    console.error("[vehicles-cron] map history refresh failed:", err);
  }
}
