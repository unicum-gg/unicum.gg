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

export type StreamerReconciliation = {
  /** Rows that had no `twitch_user_id` and just got one. */
  backfilled: number;
  /** Rows whose channel was renamed, now realigned on the stored id. */
  renamed: number;
  /** Logins Helix does not know and that carry no id to recover from. */
  unresolved: string[];
  /** Channels whose stored id Helix no longer returns, as `login (id)`. */
  vanished: string[];
};

/**
 * Resolve missing ids, then realign every login on its id. Returns what moved
 * so the caller (cron log, or a manual run) can see it. Safe to run at any
 * time: it only ever writes rows whose channel actually changed.
 */
export async function reconcileStreamerChannels(): Promise<StreamerReconciliation> {
  const result: StreamerReconciliation = {
    backfilled: 0,
    renamed: 0,
    unresolved: [],
    vanished: [],
  };
  if (!isTwitchEnabled()) return result;

  // Lowercased on read: Helix answers in lowercase and `getLiveStreamers`
  // matches on it, so a row seeded with the display casing would otherwise miss
  // every lookup here and be reported as an unknown channel.
  const rows = (
    await db
      .select({
        twitchLogin: streamers.twitchLogin,
        twitchUserId: streamers.twitchUserId,
      })
      .from(streamers)
  ).map((row) => ({
    login: row.twitchLogin.toLowerCase(),
    userId: row.twitchUserId || null,
  }));
  if (rows.length === 0) return result;

  await backfillIds(
    [...new Set(rows.filter((r) => !r.userId).map((r) => r.login))],
    result,
  );

  // Only rows that ALREADY had an id are worth a second lookup. A row just
  // backfilled got its id by submitting its login, so asking what that id is
  // called can only echo the login we sent.
  const tracked = new Map<string, string>();
  for (const row of rows) {
    if (row.userId && !tracked.has(row.userId)) tracked.set(row.userId, row.login);
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
  tracked: Map<string, string>,
  result: StreamerReconciliation,
): Promise<void> {
  const byId = new Map(
    (await getTwitchUsersById([...tracked.keys()])).map((u) => [u.id, u]),
  );
  const holderByLogin = new Map(
    [...tracked].map(([userId, login]) => [login, userId]),
  );
  for (const [userId, login] of tracked) {
    const user = byId.get(userId);
    if (!user) {
      // The id is immutable, so this is the channel itself being gone. Left in
      // place rather than deleted: a ban can be lifted, and a curated row is a
      // human decision to undo by hand. Reported with the id because a vanished
      // channel is precisely one whose name no longer looks anything up.
      result.vanished.push(`${login} (${userId})`);
      continue;
    }
    if (user.login === login) continue;
    const holder = holderByLogin.get(user.login);
    if (holder && holder !== userId) {
      // Two ids under one login is the one state the live path cannot express:
      // it queries Helix per login and keys the answer by it, so the two rows
      // would collapse into a single card credited to whichever account has
      // more battles. Twitch is still the authority on the name, so the rename
      // is applied, but this needs a human to split.
      console.warn(
        `[streamer-reconcile] ${userId} renamed to ${user.login}, a login twitch id ${holder} already holds`,
      );
    }
    const written = await db
      .update(streamers)
      .set({ twitchLogin: user.login })
      .where(eq(streamers.twitchUserId, userId))
      .returning({ id: streamers.id });
    result.renamed += written.length;
    console.log(
      `[streamer-reconcile] ${login} renamed to ${user.login} (${written.length} row(s))`,
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
    const { backfilled, renamed, unresolved, vanished } =
      await reconcileStreamerChannels();
    if (unresolved.length > 0) {
      console.warn(
        `[streamer-reconcile] ${unresolved.length} login(s) unknown to Twitch and unrecoverable: ${unresolved.join(", ")}`,
      );
    }
    if (vanished.length > 0) {
      console.warn(
        `[streamer-reconcile] ${vanished.length} channel(s) no longer exist: ${vanished.join(", ")}`,
      );
    }
    console.log(
      `[streamer-reconcile] ${backfilled} row(s) backfilled, ${renamed} row(s) realigned`,
    );
  });
}
