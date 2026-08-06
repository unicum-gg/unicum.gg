import { env } from "@unicum.gg/shared";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { ChangelogOutcome, changelogEnabled, publishChangelog } from ".";

// Daily at 18:00, late enough that a day's work is in. The cadence is env-driven
// so moving to a weekly digest ("0 18 * * 4", Thursdays) is a variable change on
// the worker, not a deploy.
const DEFAULT_SCHEDULE = "0 18 * * *";

// Read in Paris time, not the container's UTC: this is the hour a message shows
// up in a community channel, so it is a human decision, and it should not drift
// by an hour when the clocks change.
const TIMEZONE = "Europe/Paris";

/**
 * Schedules the changelog digest. Silent when the feature is unconfigured (no
 * bot, no OpenAI key or no channel).
 *
 * Production only, and that is not a detail: `scheduleCron` skips the leader
 * election in development so local crons actually run, and this one writes to
 * the community's Discord rather than to our own database. A dev machine
 * holding the same credentials would post the update itself. Locally, run it
 * on purpose (`pnpm --filter @unicum.gg/worker changelog:dry`).
 */
export function startChangelogCron(): void {
  if (process.env.NODE_ENV !== "production") {
    console.log("[changelog-cron] development, not scheduling");
    return;
  }
  if (!changelogEnabled()) {
    console.log("[changelog-cron] not configured, not scheduling");
    return;
  }

  const schedule = env.CHANGELOG_CRON || DEFAULT_SCHEDULE;
  if (
    scheduleCron("changelog-cron", schedule, async () => {
      const result = await publishChangelog();
      console.log(
        `[changelog-cron] ${result.outcome} (${result.commits} commits)`,
      );
      if (result.outcome === ChangelogOutcome.Failed) {
        console.error("[changelog-cron] the batch stays unpublished");
      }
    }, { timezone: TIMEZONE })
  ) {
    console.log(`[changelog-cron] scheduled (${schedule} ${TIMEZONE})`);
  }
}
