import { refreshVehicles } from "@/services/wargaming/wot/encyclopedia";
import { REGIONS } from "@/services/wargaming/wot";

async function main(): Promise<void> {
  for (const region of REGIONS) {
    const start = Date.now();
    try {
      const count = await refreshVehicles(region);
      console.log(
        `[refresh-vehicles] ${region}: ${count} rows upserted in ${Date.now() - start}ms`,
      );
    } catch (err) {
      console.error(`[refresh-vehicles] ${region} failed:`, err);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
