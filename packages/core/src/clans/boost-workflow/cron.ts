import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { REGIONS } from "@unicum.gg/wargaming";
import { BoostOutcome, runRegionBoostWorkflows } from "./index";

// Every 3 minutes: frequent enough to catch the threshold being met early in
// the window and to re-fire when a reserve expires, loose enough to stay well
// under WG's per-region budget (a handful of token-scoped calls per workflow).
const SCHEDULE = "*/3 * * * *";

/**
 * Schedules one independent job per region that evaluates every enabled clan
 * boost workflow: reads the live online roster with the owner officer's token
 * and activates the configured Stronghold reserves when the rule fires.
 */
export function startBoostWorkflowCron(): void {
  for (const region of REGIONS) {
    const name = `clan-boosts-${region}`;
    if (
      scheduleCron(name, SCHEDULE, async () => {
        const results = await runRegionBoostWorkflows(region);
        const acted = results.filter(
          (r) => r.outcome === BoostOutcome.Activated,
        );
        for (const r of acted) {
          console.log(
            `[${name}] clan ${r.clanId}: activated ${r
              .activated!.map((a) => `${a.type} L${a.level}`)
              .join(", ")} (${r.onlineCount} online)`,
          );
        }
      })
    ) {
      console.log(`[${name}] scheduled (${SCHEDULE})`);
    }
  }
}
