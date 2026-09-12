import { env } from "@unicum.gg/shared";
import { discordBotEnabled, postChannelMessage } from "@unicum.gg/core/discord";
import { listNewCommits } from "./commits";
import { renderChangelogMessage } from "./message";
import { readChangelogState, touchLastRun, writeLastPublished } from "./state";
import { changelogWriterEnabled, isEmptyDraft, writeChangelog } from "./write";

/**
 * Publishes the changelog to Discord: read the commits that landed since the
 * last one, have the model write them up for players (`./write`), render the
 * message (`./message`), post it, remember how far we got (`./state`).
 *
 * Nothing here is maintained per feature. A new page, a new section, a new
 * entity: they all reach the channel because they were committed.
 */

/** How far back the first run (or one whose stored commit GitHub no longer
 * knows) reaches: the week the digest covers, plus a day of slack for a tick
 * that ran late. Wide enough to cover the window without reaching far into a
 * batch already published, so it follows the cadence in `./cron`: left at the
 * daily 48h it would have covered two days of a seven-day digest. */
const FALLBACK_HOURS = 8 * 24;

export enum ChangelogOutcome {
  /** Posted to the channel. */
  Posted = "posted",
  /** Nothing landed since the last one. A completed run: it is stamped like
   * any other, so the catch-up in `./cron` leaves the slot alone. */
  NoCommits = "no-commits",
  /** Commits landed, but none of them were user-visible. */
  NothingToSay = "nothing-to-say",
  /** Rendered but not sent (dry run). */
  DryRun = "dry-run",
  /** GitHub, the writer or Discord did not answer, and the batch stays
   * unpublished so the next tick covers it. */
  Failed = "failed",
}

export type ChangelogResult = {
  outcome: ChangelogOutcome;
  commits: number;
  /** The rendered messages, whenever there were any. A week's digest can run
   * past what Discord accepts in one, so this is a list. */
  messages?: string[];
};

export function changelogEnabled(): boolean {
  return (
    discordBotEnabled() &&
    changelogWriterEnabled() &&
    Boolean(env.DISCORD_CHANGELOG_CHANNEL_ID)
  );
}

export async function publishChangelog(
  options: { dryRun?: boolean; model?: string } = {},
): Promise<ChangelogResult> {
  const state = await readChangelogState();
  let commits = await listNewCommits(state?.sha ?? null, FALLBACK_HOURS);
  // Null is "GitHub did not answer", which is not "nothing shipped": the empty
  // case below consumes the slot, and consuming it on a failed read is a digest
  // the channel never gets.
  if (commits === null) {
    return { outcome: ChangelogOutcome.Failed, commits: 0 };
  }
  if (commits.length === 0) {
    if (!options.dryRun) {
      // Nothing landed. Stamp the run anyway: it is as done as a published one,
      // and left unstamped the catch-up would re-read this window every hour
      // and then post a one-line digest on whatever day the next commit landed.
      await touchLastRun();
      return { outcome: ChangelogOutcome.NoCommits, commits: 0 };
    }
    // A dry run whose only answer is "nothing new" is useless for tuning the
    // writer, and by definition nothing is new right after a publish. Show the
    // last window instead, so the preview always has something to render.
    const window = await listNewCommits(null, FALLBACK_HOURS);
    // The same distinction on the one path a human reads directly: a window
    // GitHub never answered must not print as "nothing new".
    if (window === null) {
      return { outcome: ChangelogOutcome.Failed, commits: 0 };
    }
    commits = window;
    if (commits.length === 0) {
      return { outcome: ChangelogOutcome.NoCommits, commits: 0 };
    }
  }

  const draft = await writeChangelog(commits, options.model);
  if (!draft) {
    return { outcome: ChangelogOutcome.Failed, commits: commits.length };
  }

  const head = commits.at(-1)!.sha;
  if (isEmptyDraft(draft)) {
    // Internal-only batch: consume it anyway, otherwise every later run pays to
    // re-read the same commits and the model keeps answering "nothing here".
    if (!options.dryRun) await writeLastPublished(head);
    return { outcome: ChangelogOutcome.NothingToSay, commits: commits.length };
  }

  const messages = renderChangelogMessage(draft);
  if (options.dryRun) {
    return {
      outcome: ChangelogOutcome.DryRun,
      commits: commits.length,
      messages,
    };
  }

  for (const [i, message] of messages.entries()) {
    const posted = await postChannelMessage(
      env.DISCORD_CHANGELOG_CHANNEL_ID!,
      message,
    );
    if (posted) continue;
    // Nothing reached the channel: leave the batch for the next run rather than
    // swallow an update nobody ever saw.
    if (i === 0) {
      return {
        outcome: ChangelogOutcome.Failed,
        commits: commits.length,
        messages,
      };
    }
    // The update is already partly published, so the batch is consumed anyway:
    // resending it next week would repost what the channel has read, which is
    // worse than an update missing its last few lines.
    console.error(
      `[changelog] part ${i + 1}/${messages.length} did not post, the update is published short`,
    );
    break;
  }

  // Only after Discord took it.
  await writeLastPublished(head);
  return {
    outcome: ChangelogOutcome.Posted,
    commits: commits.length,
    messages,
  };
}
