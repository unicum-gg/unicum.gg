import { env } from "@unicum.gg/shared";
import { discordBotEnabled, postChannelMessage } from "@unicum.gg/core/discord";
import { listNewCommits } from "./commits";
import { renderChangelogMessage } from "./message";
import { readLastPublished, writeLastPublished } from "./state";
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
 * knows) reaches. Wide enough to cover a missed tick without reaching into a
 * batch already published. */
const FALLBACK_HOURS = 48;

export enum ChangelogOutcome {
  /** Posted to the channel. */
  Posted = "posted",
  /** Nothing landed since the last one. */
  NoCommits = "no-commits",
  /** Commits landed, but none of them were user-visible. */
  NothingToSay = "nothing-to-say",
  /** Rendered but not sent (dry run). */
  DryRun = "dry-run",
  /** The writer or Discord did not answer; the batch stays unpublished. */
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
  const lastSha = await readLastPublished();
  let commits = await listNewCommits(lastSha, FALLBACK_HOURS);
  if (commits.length === 0) {
    // A dry run whose only answer is "nothing new" is useless for tuning the
    // writer, and by definition nothing is new right after a publish. Show the
    // last window instead, so the preview always has something to render.
    if (!options.dryRun) return { outcome: ChangelogOutcome.NoCommits, commits: 0 };
    commits = await listNewCommits(null, FALLBACK_HOURS);
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
