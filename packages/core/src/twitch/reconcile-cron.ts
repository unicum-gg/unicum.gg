import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { streamers } from "@unicum.gg/shared";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import {
  getTwitchUsersById,
  getTwitchUsersByLogin,
  isTwitchEnabled,
} from "./index";

/**
 * Keeps every tracked channel's `twitch_login` pointing at the channel we meant.
 *
 * The whole live path is keyed by login: `getLiveStreamers` asks Helix for
 * `user_login=...`, and the badge, the embed and the chat iframe all build their
 * URL from the stored string. Twitch lets a streamer rename, and only the
 * numeric user id is immutable, so a login left unattended decays two ways.
 * It goes quiet, because Helix returns nothing for the old name and the card
 * simply stops appearing, with no error to notice. Or worse, it lies: a freed
 * login can be claimed by someone else, and we would then show a stranger's
 * stream, thumbnail and chat under our player's name.
 *
 * So this pass stores the id once and then trusts it over the name. It runs in
 * two steps because curated rows are seeded by channel name (that is what a
 * human reads off a Twitch URL) while OAuth-linked rows already carry the id.
 *
 * Everything below works per CHANNEL, not per row: `twitch_login` is
 * deliberately not unique (one streamer, several WoT accounts), so a write
 * targets the login or the id and lands on every sibling row at once, and a
 * report names each channel once instead of once per account.
 */

// Daily. A rename is rare and costs one Helix call per 100 channels to catch,
// so the cadence is set by how long we accept pointing at the wrong channel,
// not by load. 05:20 is a quiet hour with no other job on it.
const SCHEDULE = "20 5 * * *";

/** Twitch user ids are numeric strings; anything else never came from Helix. */
const TWITCH_ID = /^\d+$/;

export type StreamerReconciliation = {
  /** Rows that had no `twitch_user_id` and just got one. */
  backfilled: number;
  /** Rows whose channel was renamed, now realigned on the stored id. */
  renamed: number;
  /** Rows whose login only differed from Twitch's by letter case. */
  normalised: number;
  /** Logins Helix does not know and that carry no id to recover from. */
  unresolved: string[];
  /** Channels whose stored id Helix no longer returns, as `login (id)`. */
  vanished: string[];
  /** Stored ids that are not Twitch ids at all, as `login (value)`. */
  malformed: string[];
};

/**
 * Resolve missing ids, then realign every login on its id. Returns what moved
 * so the caller (cron log, or a manual run) can see it. Safe to run at any
 * time: it only ever writes rows whose stored login differs from Twitch's.
 */
export async function reconcileStreamerChannels(): Promise<StreamerReconciliation> {
  const result: StreamerReconciliation = {
    backfilled: 0,
    renamed: 0,
    normalised: 0,
    unresolved: [],
    vanished: [],
    malformed: [],
  };
  if (!isTwitchEnabled()) return result;

  const rows = await db
    .select({
      twitchLogin: streamers.twitchLogin,
      twitchUserId: streamers.twitchUserId,
    })
    .from(streamers);
  if (rows.length === 0) return result;

  // Lowercased only to LOOK UP: Helix answers in lowercase and
  // `getLiveStreamers` matches on it. The stored spelling is kept as-is so step
  // 2 can tell "already canonical" from "same channel, wrong case".
  await backfillIds(
    [
      ...new Set(
        rows
          .filter((r) => !r.twitchUserId)
          .map((r) => r.twitchLogin.toLowerCase()),
      ),
    ],
    result,
  );

  // Only rows that ALREADY had an id are worth a second lookup. A row just
  // backfilled got its id by submitting its login, so asking what that id is
  // called can only echo the login we sent.
  //
  // Every stored spelling for an id is collected, not just the first one seen:
  // several rows can share an id with different spellings, and which one the
  // SELECT happened to return first must not decide whether they get healed.
  const tracked = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.twitchUserId) continue;
    const logins = tracked.get(row.twitchUserId) ?? new Set<string>();
    logins.add(row.twitchLogin);
    tracked.set(row.twitchUserId, logins);
  }
  if (tracked.size > 0) await adoptRenames(tracked, result);

  return result;
}

/**
 * Give every seeded channel its immutable id. Isolated from the rename step
 * because in steady state it is a no-op, and a blip on the call it makes must
 * not cost us the day's rename detection.
 */
async function backfillIds(
  logins: string[],
  result: StreamerReconciliation,
): Promise<void> {
  if (logins.length === 0) return;
  let users;
  try {
    users = await getTwitchUsersByLogin(logins);
  } catch (err) {
    console.error(
      "[streamer-reconcile] id backfill failed, checking renames anyway:",
      err,
    );
    return;
  }
  const byLogin = new Map(users.map((u) => [u.login, u]));
  for (const login of logins) {
    const user = byLogin.get(login);
    if (!user) {
      result.unresolved.push(login);
      continue;
    }
    // Matched case-insensitively and rewritten lowercase in the same statement:
    // the row may have been seeded with the display casing, which is the form
    // that matches nothing on the live path.
    const written = await db
      .update(streamers)
      .set({ twitchUserId: user.id, twitchLogin: user.login })
      .where(
        and(
          sql`lower(${streamers.twitchLogin}) = ${login}`,
          isNull(streamers.twitchUserId),
        ),
      )
      .returning({ id: streamers.id });
    if (written.length === 0) continue;
    result.backfilled += written.length;
    // Logged per channel, not just counted: this is the step that decides which
    // Twitch account a curated name refers to, and it can only ever be as right
    // as the name it was given. The pairing has to be auditable after the fact.
    console.log(
      `[streamer-reconcile] ${login} pinned to twitch id ${user.id} (${written.length} row(s))`,
    );
  }
}

/** Rewrite the login of every channel Helix now reports under another name. */
async function adoptRenames(
  tracked: Map<string, Set<string>>,
  result: StreamerReconciliation,
): Promise<void> {
  // A non-numeric id never came from Helix (a pasted URL fragment, a display
  // name, a truncated value). Reported on its own rather than sent: it would
  // come back as "not found", which reads as a deleted channel and calls for
  // the opposite response, and it would cost a bisection to isolate.
  const lookups: string[] = [];
  for (const [userId, logins] of tracked) {
    if (TWITCH_ID.test(userId)) lookups.push(userId);
    else result.malformed.push(`${[...logins][0]} (${userId})`);
  }
  if (lookups.length === 0) return;

  let users;
  try {
    users = await getTwitchUsersById(lookups);
  } catch (err) {
    // Reported rather than thrown, so a blip here does not discard the backfill
    // work already committed and the unresolved names already collected.
    console.error("[streamer-reconcile] rename check failed:", err);
    return;
  }
  const byId = new Map(users.map((u) => [u.id, u]));

  // Collisions are read off the TARGET logins, not the stored ones: two live
  // ids answering to one login is the real conflict, and it cannot go stale
  // mid-run the way a snapshot of the old names would.
  const holders = new Map<string, string[]>();
  for (const userId of lookups) {
    const user = byId.get(userId);
    if (!user) continue;
    holders.set(user.login, [...(holders.get(user.login) ?? []), userId]);
  }

  for (const userId of lookups) {
    const stored = tracked.get(userId) ?? new Set<string>();
    const user = byId.get(userId);
    if (!user) {
      // The id is immutable, so this is the channel itself being gone. Left in
      // place rather than deleted: a ban can be lifted, and a curated row is a
      // human decision to undo by hand. Reported with the id because a vanished
      // channel is precisely one whose name no longer looks anything up.
      result.vanished.push(`${[...stored][0]} (${userId})`);
      continue;
    }
    // Compared against the STORED spelling, so a row that only differs by case
    // is repaired too. It resolves fine here but matches nothing on the live
    // path, so left alone it would stay invisible while every run reported a
    // clean pass.
    if ([...stored].every((login) => login === user.login)) continue;
    const isRename = [...stored].some(
      (login) => login.toLowerCase() !== user.login,
    );
    if ((holders.get(user.login) ?? []).length > 1) {
      // Two ids under one login is the one state the live path cannot express:
      // it queries Helix per login and keys the answer by it, so the rows would
      // collapse into a single card credited to whichever account has more
      // battles. Twitch is still the authority on the name, so the rename is
      // applied, but this needs a human to split.
      console.warn(
        `[streamer-reconcile] twitch id ${userId} shares login ${user.login} with ${(holders.get(user.login) ?? []).filter((id) => id !== userId).join(", ")}`,
      );
    }
    const written = await db
      .update(streamers)
      .set({ twitchLogin: user.login })
      .where(eq(streamers.twitchUserId, userId))
      .returning({ id: streamers.id });
    if (written.length === 0) continue;
    if (isRename) result.renamed += written.length;
    else result.normalised += written.length;
    console.log(
      `[streamer-reconcile] ${[...stored].join(", ")} ${isRename ? "renamed" : "normalised"} to ${user.login} (${written.length} row(s))`,
    );
  }
}

/** Schedule the daily reconcile pass. No-ops when Twitch is not configured. */
export function startStreamerReconcileCron(): void {
  if (!isTwitchEnabled()) {
    console.log("[streamer-reconcile] Twitch not configured, not scheduling");
    return;
  }
  scheduleCron("streamer-reconcile-cron", SCHEDULE, async () => {
    const r = await reconcileStreamerChannels();
    reportProblems(r);
    console.log(
      `[streamer-reconcile] ${r.backfilled} row(s) backfilled, ${r.renamed} renamed, ${r.normalised} normalised`,
    );
  });
}

/** Warn about every channel a human has to look at. Shared with the CLI. */
export function reportProblems(r: StreamerReconciliation): void {
  if (r.unresolved.length > 0) {
    console.warn(
      `[streamer-reconcile] ${r.unresolved.length} login(s) unknown to Twitch and unrecoverable: ${r.unresolved.join(", ")}`,
    );
  }
  if (r.vanished.length > 0) {
    console.warn(
      `[streamer-reconcile] ${r.vanished.length} channel(s) no longer exist: ${r.vanished.join(", ")}`,
    );
  }
  if (r.malformed.length > 0) {
    console.warn(
      `[streamer-reconcile] ${r.malformed.length} row(s) hold something that is not a twitch id: ${r.malformed.join(", ")}`,
    );
  }
}
