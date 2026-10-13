import { env } from "@unicum.gg/shared";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import {
  ModChangelogOutcome,
  modChangelogEnabled,
  publishModChangelog,
} from ".";

/**
 * A poll, not a slot, which is the whole difference from the site's digest.
 *
 * The site's is a weekly message written at an hour somebody chose. A release
 * is cut when it is ready, so there is nothing to schedule: the only question
 * is how long the channel waits after one is published, and a quarter of an
 * hour is well inside what anyone notices. It costs four unauthenticated GitHub
 * calls an hour, against the 60 that host allows per IP.
 *
 * Bounded to 9-22 Paris all the same, and that is not the poll being timid: the
 * message carries an `@here`, and a release cut at 03:00 would ping a community
 * channel at 03:00. The site's catch-up already settled this question for the
 * same channel ("an update posted at 04:00 is one nobody was there to read"),
 * so a release cut overnight is announced when the morning starts. The cadence
 * stays env-driven, so widening it is a variable change on the worker.
 */
const DEFAULT_SCHEDULE = "*/15 9-22 * * *";

/** Paris, for the same reason the digest reads its slot there: the window above
 * is about when a person is reading, so it must not drift with the clocks. */
const TIMEZONE = "Europe/Paris";

/**
 * Schedules the mod's release announcer. Silent when unconfigured (no bot or no
 * channel), and it needs no OpenAI key, since nothing here is written by a
 * model.
 *
 * Production only, like the digest, and for the identical reason:
 * `scheduleCron` skips the leader election in development so local crons
 * actually run, and a dev machine holding these credentials would announce the
 * release itself. Locally, run it on purpose
 * (`pnpm --filter @unicum.gg/worker mod-changelog:dry`).
 *
 * No in-flight flag of its own: there is one schedule here, and `scheduleCron`
 * already refuses to start a tick while the previous one is running. The digest
 * needs one because it has two schedules sharing a publisher.
 */
export function startModChangelogCron(): void {
  if (process.env.NODE_ENV !== "production") {
    console.log("[mod-changelog-cron] development, not scheduling");
    return;
  }
  if (!modChangelogEnabled()) {
    console.log("[mod-changelog-cron] not configured, not scheduling");
    return;
  }

  const schedule = env.MOD_CHANGELOG_CRON || DEFAULT_SCHEDULE;
  if (
    !scheduleCron(
      "mod-changelog-cron",
      schedule,
      async () => {
        const result = await publishModChangelog();
        // Only the endings that did something, since this ticks ~56 times a day
        // and "up-to-date" is nearly all of them: a line per tick would bury
        // every other job's logs.
        if (result.outcome === ModChangelogOutcome.UpToDate) return;
        console.log(
          `[mod-changelog-cron] ${result.outcome}${
            result.versions.length > 0 ? ` (${result.versions.join(", ")})` : ""
          }`,
        );
        if (result.outcome === ModChangelogOutcome.Failed) {
          console.error("[mod-changelog-cron] the marker stays where it was");
        }
      },
      { timezone: TIMEZONE },
    )
  ) {
    return;
  }
  console.log(`[mod-changelog-cron] scheduled (${schedule} ${TIMEZONE})`);
}
