import { ChangelogProduct, env } from "@unicum.gg/shared";
import { discordBotEnabled, postChannelMessage } from "@unicum.gg/core/discord";
import { readChangelogState, writeLastPublished } from "../state";
import { renderModChangelogMessage } from "./message";
import { listPublishedReleases, releasesAfter } from "./releases";
import type { ModRelease } from "./releases";

/**
 * Announces the mod's releases to Discord: read what is published, keep what
 * landed since the last announcement, post each one as its author wrote it,
 * remember how far we got.
 *
 * No model and no OpenAI key, unlike the site's digest beside it. The site's
 * source is a commit log, which needs someone to decide what was user-visible
 * and say it in a player's words. The mod's source is a release whose notes are
 * already that, so the only work left is the shape of the message.
 */

export enum ModChangelogOutcome {
  /** Announced to the channel. */
  Posted = "posted",
  /** The repository has no published release at all. */
  NoReleases = "no-releases",
  /** Nothing new since the last announcement. */
  UpToDate = "up-to-date",
  /** The marker was absent or unknown, so it was set to the newest release
   * without announcing anything. */
  Seeded = "seeded",
  /** Rendered but not sent (dry run). */
  DryRun = "dry-run",
  /** GitHub or Discord did not answer, and the marker stays where it was. */
  Failed = "failed",
}

export type ModChangelogResult = {
  outcome: ModChangelogOutcome;
  /** Versions announced, in the order they went out. */
  versions: string[];
  /** The rendered messages, whenever there were any: every part of every
   * release this run had to announce. */
  messages?: string[];
};

export function modChangelogEnabled(): boolean {
  return discordBotEnabled() && Boolean(env.DISCORD_MOD_CHANGELOG_CHANNEL_ID);
}

/**
 * Posts one release and records it.
 *
 * The marker moves per release rather than once at the end of the run, because
 * a run can carry more than one (a release and the hotfix behind it) and a
 * failure on the second must not replay the first. Same rule as the site's
 * digest within a single release: a part that fails after the first one has
 * posted consumes the release anyway, since reposting it would duplicate what
 * the channel has already read.
 */
async function announce(release: ModRelease): Promise<boolean> {
  const messages = renderModChangelogMessage(release);

  for (const [i, message] of messages.entries()) {
    const posted = await postChannelMessage(
      env.DISCORD_MOD_CHANGELOG_CHANNEL_ID!,
      message,
    );
    if (posted) continue;
    if (i === 0) {
      console.error(
        `[mod-changelog] ${release.version} did not post, the marker stays put`,
      );
      return false;
    }
    console.error(
      `[mod-changelog] ${release.version} part ${i + 1}/${messages.length} did not post, the announcement is published short`,
    );
    break;
  }

  await writeLastPublished(ChangelogProduct.Mod, release.tag);
  return true;
}

export async function publishModChangelog(
  options: { dryRun?: boolean } = {},
): Promise<ModChangelogResult> {
  const state = await readChangelogState(ChangelogProduct.Mod);
  const releases = await listPublishedReleases();
  // Null is "GitHub did not answer". Read as an empty list it would reseed the
  // marker off nothing, and the next real release would be the only one the
  // channel ever hears about.
  if (releases === null) {
    return { outcome: ModChangelogOutcome.Failed, versions: [] };
  }
  if (releases.length === 0) {
    return { outcome: ModChangelogOutcome.NoReleases, versions: [] };
  }

  const newest = releases.at(-1)!;
  const pending = releasesAfter(releases, state?.ref ?? null);

  // No marker, or one naming a tag that is gone. Record where we are and say
  // nothing: the first run of this feature would otherwise announce four
  // releases at once, the newest of them a fortnight old, as though the mod had
  // just shipped all of it. The next release is the first the channel hears
  // about, which is what switching an announcer on should mean.
  if (pending === null) {
    const reason = state ? `${state.ref} is gone from GitHub` : "no marker yet";
    if (options.dryRun) {
      // The one path a person reads directly, and "seeded" would show them
      // nothing. Preview the newest release so the rendering can be checked
      // before the feature is ever armed.
      return {
        outcome: ModChangelogOutcome.DryRun,
        versions: [newest.version],
        messages: renderModChangelogMessage(newest),
      };
    }
    console.log(
      `[mod-changelog] ${reason}, marking ${newest.tag} as the starting point without announcing it`,
    );
    await writeLastPublished(ChangelogProduct.Mod, newest.tag);
    return { outcome: ModChangelogOutcome.Seeded, versions: [] };
  }

  // A release with no notes is not announced, and does not hold the queue
  // behind it: `release.yml` writes "No changelog entry for x.y.z." when the
  // CHANGELOG has no section, which is a sentence for whoever cut the release
  // and not an update for a channel.
  const announceable = pending.filter(
    (release) => renderModChangelogMessage(release).length > 0,
  );

  if (announceable.length === 0) {
    if (pending.length > 0 && !options.dryRun) {
      // Consume them, or every later run re-reads the same note-less releases.
      await writeLastPublished(ChangelogProduct.Mod, pending.at(-1)!.tag);
    }
    return {
      outcome: options.dryRun
        ? ModChangelogOutcome.DryRun
        : ModChangelogOutcome.UpToDate,
      versions: [],
      messages: options.dryRun ? renderModChangelogMessage(newest) : undefined,
    };
  }

  if (options.dryRun) {
    return {
      outcome: ModChangelogOutcome.DryRun,
      versions: announceable.map((release) => release.version),
      messages: announceable.flatMap(renderModChangelogMessage),
    };
  }

  const announced: string[] = [];
  for (const release of announceable) {
    if (!(await announce(release))) {
      // Whatever went out before this stays recorded, so the next run resumes
      // at the one that failed rather than starting over.
      return {
        outcome: announced.length > 0
          ? ModChangelogOutcome.Posted
          : ModChangelogOutcome.Failed,
        versions: announced,
      };
    }
    announced.push(release.version);
  }

  return {
    outcome: ModChangelogOutcome.Posted,
    versions: announced,
    messages: announceable.flatMap(renderModChangelogMessage),
  };
}
