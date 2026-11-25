import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import {
  GameChangesOutcome,
  gameChangesEnabled,
  publishGameChanges,
} from ".";

/**
 * A poll, like the mod's releases: a game version lands when Wargaming ships
 * it and is announced once it has settled (`./versions`), so the only question
 * is how long the channel waits after that. An hour is well inside it, and the
 * work is four small reads when nothing is new, which is nearly every tick.
 *
 * Bounded to 9-22 Paris for the same reason as the other announcers: the card
 * pings a role, and a version that settles at 03:00 is better announced in the
 * morning than to nobody. The minute sits away from the changelog catch-up's.
 */
const SCHEDULE = "40 9-22 * * *";
const TIMEZONE = "Europe/Paris";

/**
 * Production only, for the reason the changelog crons give: `scheduleCron`
 * skips the leader election in development, and a dev machine holding the bot
 * token would post to the community's channels itself. Locally, run it on
 * purpose (`pnpm --filter @unicum.gg/worker game-changes:dry`).
 */
export function startGameChangesCron(): void {
  if (process.env.NODE_ENV !== "production") {
    console.log("[game-changes-cron] development, not scheduling");
    return;
  }
  if (!gameChangesEnabled()) {
    console.log("[game-changes-cron] not configured, not scheduling");
    return;
  }
  if (
    !scheduleCron(
      "game-changes-cron",
      SCHEDULE,
      async () => {
        for (const result of await publishGameChanges()) {
          // Only the endings that did something: "up-to-date" is nearly every
          // tick, and a line each would bury every other job's logs.
          if (
            result.outcome === GameChangesOutcome.UpToDate ||
            result.outcome === GameChangesOutcome.Off
          ) {
            continue;
          }
          const labels = result.announced.map((a) => a.label).join(", ");
          console.log(
            `[game-changes-cron] ${result.product}: ${result.outcome}${labels ? ` (${labels})` : ""}`,
          );
        }
      },
      { timezone: TIMEZONE },
    )
  ) {
    return;
  }
  console.log(`[game-changes-cron] scheduled (${SCHEDULE} ${TIMEZONE})`);
}
