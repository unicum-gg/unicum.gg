import { env } from "@unicum.gg/shared";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { ChangelogOutcome, changelogEnabled, publishChangelog } from ".";
import { readChangelogState } from "./state";

// Thursdays at 18:00, one digest a week rather than one a day: a day of work is
// a handful of entries and reads as noise in a community channel, a week of it
// reads as an update. The cadence stays env-driven, so a different day or a
// return to daily ("0 18 * * *") is a variable change on the worker, not a
// deploy.
const DEFAULT_SCHEDULE = "0 18 * * 4";

// Read in Paris time, not the container's UTC: this is the hour a message shows
// up in a community channel, so it is a human decision, and it should not drift
// by an hour when the clocks change.
const TIMEZONE = "Europe/Paris";

/**
 * The net under that slot: every hour, at the hours a community channel is read.
 *
 * A cron fires only if the process is alive on the minute, and this one is not
 * always: the worker was down from Wednesday morning to Thursday evening over
 * 2026-09-09/10, so the 18:00 tick never happened and the week's digest was
 * never written. Daily, a miss cost a day and the next tick swept the same
 * commits up. Weekly, it costs a week of silence, which makes the schedule
 * alone too fragile to be the only trigger.
 *
 * 9 to 22 rather than round the clock, because the digest is a message in a
 * community channel: an update posted at 04:00 is one nobody was there to read,
 * and waiting for the morning is the better failure. The minute is offset from
 * the slot's so a catch-up never lands on the same minute as the run it covers.
 */
const CATCHUP_SCHEDULE = "20 9-22 * * *";

/**
 * How long the channel may go without its digest before the catch-up takes over.
 * A week plus three hours.
 *
 * Not a second copy of the schedule but a staleness tolerance: it says how long
 * a silence is too long, which stays true whatever the cadence above becomes (a
 * daily digest would simply have a looser net than it needs). The three hours
 * keep it from tripping on a normal week, because a normal week is not always
 * 168 hours: the October clock change makes one of them 169, and a net that
 * fired an hour before the slot it protects would post the digest on a Thursday
 * afternoon once a year.
 *
 * The reference is the last run and not the last slot, which is the one thing
 * this does not do as well as it could: after a run that happened off slot (a
 * catch-up, or a hand-run `changelog`), the clock restarts from there, so a slot
 * missed in the following days is caught within the week rather than the same
 * evening. Catching it on the next tick would mean computing the schedule's
 * previous occurrence in TIMEZONE, which is exact only with a cron parser, and
 * the guarantee this buys without one ("the channel is never silent for more
 * than a week and a bit") is the one that was missing.
 */
const MAX_SILENCE_MS = 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000;

/**
 * Holds the two schedules apart. They sit hours from each other, but a run has
 * no deadline of its own (nothing bounds the model call or the Discord post),
 * and two at once is the one mistake the marker cannot undo: both would read the
 * same batch and the channel would get the update twice. A flag in the process
 * is enough, the cron lease means no second instance ever executes these.
 */
let publishing = false;

async function runChangelog(trigger: string): Promise<void> {
  if (publishing) {
    console.log(`[changelog-cron] ${trigger} skipped, a run is in flight`);
    return;
  }
  publishing = true;
  try {
    const result = await publishChangelog();
    console.log(
      `[changelog-cron] ${trigger}: ${result.outcome} (${result.commits} commits)`,
    );
    if (result.outcome === ChangelogOutcome.Failed) {
      console.error("[changelog-cron] the batch stays unpublished");
    }
  } finally {
    publishing = false;
  }
}

/**
 * Schedules the changelog digest, on its slot and on the net under it. Silent
 * when the feature is unconfigured (no bot, no OpenAI key or no channel).
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
    !scheduleCron("changelog-cron", schedule, () => runChangelog("slot"), {
      timezone: TIMEZONE,
    })
  ) {
    return;
  }
  console.log(`[changelog-cron] scheduled (${schedule} ${TIMEZONE})`);

  scheduleCron(
    "changelog-catchup",
    CATCHUP_SCHEDULE,
    async () => {
      // Reads the stamp every completed run leaves, so a digest that went out
      // late, or found nothing to say, counts as the week being answered.
      const lastRunAt = (await readChangelogState())?.lastRunAt ?? null;
      if (lastRunAt && Date.now() - lastRunAt.getTime() <= MAX_SILENCE_MS) {
        return;
      }
      console.log(
        `[changelog-catchup] nothing since ${lastRunAt?.toISOString() ?? "ever"}, running now`,
      );
      await runChangelog("catch-up");
    },
    { timezone: TIMEZONE },
  );
  console.log(`[changelog-catchup] scheduled (${CATCHUP_SCHEDULE} ${TIMEZONE})`);
}
