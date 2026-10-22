import { env } from "@unicum.gg/shared";
import { postChannelMessage } from "@unicum.gg/core/discord";
import { getRedisClient } from "@unicum.gg/core/redis";

/**
 * Edge-triggered alerting for a job judged by whether rows are still landing.
 *
 * A watchdog over a recorder has the same shape whatever it records: ask how
 * old the newest row is, say so once when it falls behind, say so once more
 * when it catches up, and stay quiet in between. What differs per job is the
 * read and the wording, and both of those belong to the job. This holds the
 * part that does not: where the "already said" flag lives, and how a line
 * reaches a person.
 *
 * Extracted from `onslaught-watchdog`, which held the only copy, the day the
 * server sampler needed the same thing. The alternative was a second
 * independent copy of the Redis handling below, and the one thing that handling
 * gets right is subtle enough (see `wasAnnounced`) that two copies would
 * eventually disagree about it.
 */

/**
 * How long a reported stall is remembered, so an incident still open a week
 * later is said once more rather than never again. Long enough that no ordinary
 * outage is repeated, short enough that the key does not outlive the thing it
 * describes.
 */
const STALL_MEMORY_SECONDS = 7 * 24 * 60 * 60;

export type StallAlert = {
  /**
   * Say that this subject has stalled, unless that has already been said.
   * Returns whether the message went out.
   */
  announce(subject: string, message: string): Promise<boolean>;
  /**
   * Say that it is recording again, but only if a stall was announced.
   * Returns whether the message went out.
   */
  recover(subject: string, message: string): Promise<boolean>;
  /**
   * Drop an open alert without announcing a recovery, for a subject that has
   * stopped being judged rather than started recording again: nothing
   * recovered, so saying it did would be false.
   */
  forget(subject: string): Promise<void>;
  /** Put a line in the channel when there is one, and in the log either way. */
  say(message: string): Promise<void>;
};

export function createStallAlert({
  name,
  keyPrefix,
}: {
  /** Log prefix, e.g. `onslaught-watchdog`. */
  name: string;
  /**
   * Namespace of the Redis flag. Kept separate from `name` because an incident
   * that is open right now must keep its key's exact spelling across any
   * refactor, or every open alert is re-announced once on the next tick.
   */
  keyPrefix: string;
}): StallAlert {
  /** Fallback for a process with no Redis (local dev), and for a Redis blip. */
  const inProcess = new Set<string>();

  const key = (subject: string) => `${keyPrefix}:stalled:${subject}`;

  /**
   * Whether this subject's stall has already been reported.
   *
   * Kept in Redis rather than in memory because the alert is edge-triggered and
   * the process is not long-lived: the worker is redeployed several times on a
   * busy day, and each restart used to replay every open alert. A missing key
   * is read as "not reported", so an eviction or an unreachable Redis costs one
   * repeated warning, which is exactly the behaviour this replaces, and never a
   * silent one.
   */
  async function wasAnnounced(subject: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis) return inProcess.has(subject);
    try {
      return (await redis.get(key(subject))) !== null;
    } catch {
      return inProcess.has(subject);
    }
  }

  async function setAnnounced(
    subject: string,
    announced: boolean,
  ): Promise<void> {
    if (announced) inProcess.add(subject);
    else inProcess.delete(subject);

    const redis = getRedisClient();
    if (!redis) return;
    try {
      if (announced) {
        await redis.set(
          key(subject),
          new Date().toISOString(),
          "EX",
          STALL_MEMORY_SECONDS,
        );
      } else {
        await redis.del(key(subject));
      }
    } catch {
      // Best effort: the in-process set above still holds this tick's answer.
    }
  }

  async function say(message: string): Promise<void> {
    console.warn(`[${name}] ${message}`);
    const channel = env.DISCORD_ALERTS_CHANNEL_ID;
    if (!channel) return;
    try {
      await postChannelMessage(channel, message);
    } catch (err) {
      console.error(`[${name}] could not reach Discord:`, err);
    }
  }

  return {
    async announce(subject, message) {
      if (await wasAnnounced(subject)) return false;
      // Recorded BEFORE the message goes out, so a Discord failure cannot turn
      // into the same line every tick for as long as the outage lasts. `say`
      // logs either way, which is what keeps the failure itself visible.
      await setAnnounced(subject, true);
      await say(message);
      return true;
    },
    async recover(subject, message) {
      if (!(await wasAnnounced(subject))) return false;
      await setAnnounced(subject, false);
      await say(message);
      return true;
    },
    async forget(subject) {
      await setAnnounced(subject, false);
    },
    say,
  };
}
