import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import {
  account as accountTable,
  playerGarageByRegion,
  wgIdentityFromAccountKey,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { refreshPlayerGarage } from "@unicum.gg/core/players/garage";
import { PROLONGATE_WHEN_UNDER_MS } from "@unicum.gg/core/auth/wargaming-token";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { Region } from "@unicum.gg/wargaming";

/**
 * How stale a stored garage may get before it is read again.
 *
 * A week, because a garage moves when its owner buys or sells something and
 * neither is an hourly event, while the cost of being wrong is small and
 * visible: the profile publishes the date it was verified, so a week-old
 * reading reads as a week-old reading.
 *
 * This age alone does NOT keep the token alive, which it was once believed to.
 * A token lives about two weeks and is only prolongated once under three days
 * remain, so a reading taken with four to seven days left skips the
 * prolongation, the next one falls due after the expiry, and the account is
 * frozen until its owner signs in again (observed 2026-10: read on the 12th
 * with six days left, expired on the 18th, re-read never). `isDue` therefore
 * also claims every account whose token is inside that window.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Accounts read per pass. The whole linked population is in the hundreds, so
 * this is a ceiling against a future where it is not, rather than a batch. */
const BATCH = 200;

type LinkedAccount = {
  userId: string;
  region: Region;
  accountId: number;
  tokenExpiresAt: Date;
};

/**
 * Every account signed in with Wargaming.net ID whose token has not already
 * expired.
 *
 * An expired one cannot be prolongated (WG refuses), so its owner has to sign
 * in again and there is nothing a background pass can do about it. Skipped
 * rather than attempted, so the log stays a list of real failures.
 */
async function listLinkedAccounts(): Promise<LinkedAccount[]> {
  const rows = await db
    .select({
      userId: accountTable.userId,
      key: accountTable.accountId,
      tokenExpiresAt: accountTable.accessTokenExpiresAt,
    })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.providerId, "wargaming"),
        isNotNull(accountTable.accessToken),
        gt(accountTable.accessTokenExpiresAt, new Date()),
      ),
    );

  const out: LinkedAccount[] = [];
  for (const row of rows) {
    const identity = wgIdentityFromAccountKey(row.key);
    if (identity && row.tokenExpiresAt) {
      out.push({
        userId: row.userId,
        ...identity,
        tokenExpiresAt: row.tokenExpiresAt,
      });
    }
  }
  return out;
}

/** When each of these accounts' garages was last read, per region. */
async function loadVerifiedAt(
  accounts: LinkedAccount[],
): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  const regions = new Set(accounts.map((a) => a.region));
  for (const region of regions) {
    const table = playerGarageByRegion[region];
    const rows = await db
      .select({
        accountId: table.accountId,
        // A raw aggregate has no column type for the driver to map, so this
        // comes back as the string Postgres printed rather than as a Date, type
        // annotation or no type annotation. Parsed here rather than trusted.
        verifiedAt: sql<string | Date>`max(${table.verifiedAt})`,
      })
      .from(table)
      .groupBy(table.accountId);
    for (const row of rows) {
      out.set(`${region}-${row.accountId}`, new Date(row.verifiedAt));
    }
  }
  return out;
}

/**
 * Re-read the garage of every linked account whose stored one is missing or
 * stale.
 *
 * One WG request per account on an endpoint that does not batch, so the pass is
 * paced by the region's own limiter like every other fan-out here. It runs the
 * accounts in sequence rather than concurrently on purpose: there is no
 * deadline on it, and the interactive reserve this shares is the one a player
 * waiting on their own profile is spending.
 */
export async function syncLinkedGarages(
  options: { maxAgeMs?: number; limit?: number } = {},
): Promise<{
  read: number;
  failures: Map<string, number>;
  skipped: number;
}> {
  const maxAge = options.maxAgeMs ?? MAX_AGE_MS;
  const limit = options.limit ?? BATCH;

  const accounts = await listLinkedAccounts();
  const verifiedAt = await loadVerifiedAt(accounts);
  const now = Date.now();
  const cutoff = now - maxAge;

  // A stale garage, or a token close enough to its expiry that reading the
  // garage now is what prolongates it. The pass is daily and the window three
  // days, so every token crosses it at least twice before it can lapse.
  const isDue = (a: LinkedAccount): boolean => {
    const seen = verifiedAt.get(`${a.region}-${a.accountId}`);
    if (!seen || seen.getTime() < cutoff) return true;
    return a.tokenExpiresAt.getTime() - now < PROLONGATE_WHEN_UNDER_MS;
  };

  const due = accounts
    .filter(isDue)
    // Never read first, then the oldest reading. A player who has just signed
    // in is already covered by the callback, so this ordering puts the accounts
    // nothing else will reach at the front.
    .sort((a, b) => {
      const sa = verifiedAt.get(`${a.region}-${a.accountId}`)?.getTime() ?? 0;
      const sb = verifiedAt.get(`${b.region}-${b.accountId}`)?.getTime() ?? 0;
      return sa - sb;
    })
    .slice(0, limit);

  let read = 0;
  // Counted by reason rather than summed, because the three say different
  // things about what to do next: a revoked token needs its owner to sign in
  // again, an unauthenticated read means WG answered without applying it, and
  // an empty one is WG having a bad minute and will clear on its own.
  const failures = new Map<string, number>();
  for (const acc of due) {
    const res = await refreshPlayerGarage(acc.userId).catch(() => null);
    if (res?.ok) {
      read += 1;
      continue;
    }
    const reason = res ? res.reason : "error";
    failures.set(reason, (failures.get(reason) ?? 0) + 1);
  }
  return { read, failures, skipped: accounts.length - due.length };
}

// Daily, at an hour nobody reads, and well inside the week a reading is allowed
// to last, so a day the worker is down costs nothing.
const SCHEDULE = "35 4 * * *";

export function startGarageSyncCron(): void {
  scheduleCron("garage-sync-cron", SCHEDULE, async () => {
    const res = await syncLinkedGarages();
    const failed = [...res.failures]
      .map(([reason, n]) => `${reason} ${n}`)
      .join(", ");
    console.log(
      `[garage-sync] read ${res.read}, fresh ${res.skipped}${failed ? `, failed: ${failed}` : ""}`,
    );
  });
}
