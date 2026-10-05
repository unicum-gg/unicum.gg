import { and, eq, sql } from "drizzle-orm";
import { env } from "@unicum.gg/shared/env";
import type { Region } from "@unicum.gg/wargaming";
import { battlesByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { s3Error, s3Request, type S3Target } from "@unicum.gg/core/storage/s3";

/**
 * Where a battle's `.wotreplay` file is kept, and how it gets there.
 *
 * Why keep the file at all, when the mod already sends the positions: the
 * samples are 64 KB against the replay's 1.1 MB and they draw a 2D battle
 * perfectly, but they are positions and three angles, nothing else. A 3D view
 * would want shell trajectories, the geometry of each hit and the state of the
 * destructible terrain, and none of that can be collected after the fact. The
 * file is insurance against a decision we have not made yet.
 *
 * It is therefore written once and read almost never, which is what makes a
 * bucket on our own host the right first home for it: no egress to pay, no
 * vendor, and a move to a real provider later is four environment variables
 * because everything here speaks S3 rather than a filesystem.
 *
 * **The bucket has a hard quota** (100 GB, set on the bucket itself, not in
 * this code). That is deliberate and it is the whole safety story: the bucket
 * shares a disk with Postgres, and a disk that fills takes the database and
 * the site down with it. When the quota is reached the store says so plainly
 * and the upload is refused; it never degrades into writing somewhere else.
 */

/** One day of one region, so no directory ever holds a year of files. */
export function replayKey(
  region: Region,
  startedAt: Date,
  arenaUniqueId: string,
): string {
  const year = startedAt.getUTCFullYear();
  const month = String(startedAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(startedAt.getUTCDate()).padStart(2, "0");
  return `${region}/${year}/${month}/${day}/${arenaUniqueId}.wotreplay`;
}

/**
 * The bucket, or null when this deployment has none.
 *
 * Read as a set and all-or-nothing: a half-filled configuration is a mistake
 * someone made in a dashboard, and the useful response to it is the same as to
 * no configuration at all. Throwing here would take down every page in the
 * app over a feature that is allowed to be absent.
 */
export function replayStore(): S3Target | null {
  const endpoint = env.REPLAY_S3_ENDPOINT;
  const bucket = env.REPLAY_S3_BUCKET;
  const keyId = env.REPLAY_S3_KEY_ID;
  const secret = env.REPLAY_S3_SECRET;
  if (!endpoint || !bucket || !keyId || !secret) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    region: env.REPLAY_S3_REGION ?? "garage",
    keyId,
    secret,
  };
}

/** Why a file could not be stored, in the terms the caller must act on. */
export enum ReplayStoreError {
  /** No bucket configured. Nothing is wrong; this deployment has no archive. */
  NotConfigured = "not_configured",
  /** The bucket is at its quota. Retrying will not help, so stop asking. */
  Full = "full",
  /** Anything else: unreachable, refused, misconfigured credentials. */
  Failed = "failed",
}

export type ReplayStoreResult =
  | { ok: true; key: string }
  | { ok: false; error: ReplayStoreError; detail?: string };

/**
 * Whether the error S3 returned means "the bucket is full".
 *
 * Checked on the text rather than the status, because the status is not
 * agreed: Garage answers 403 for a quota it enforces itself, AWS answers 400,
 * and the only stable part is the code. Getting this wrong in the safe
 * direction costs a retry; getting it wrong in the other direction makes the
 * mod retry a full bucket forever.
 */
function isFull(detail: string): boolean {
  return /quota|exceeded|too large|no space/i.test(detail);
}

/** Put one replay in the bucket, overwriting nothing that matters. */
export async function storeReplay(
  key: string,
  bytes: Uint8Array,
): Promise<ReplayStoreResult> {
  const target = replayStore();
  if (!target) {
    return { ok: false, error: ReplayStoreError.NotConfigured };
  }

  try {
    const response = await s3Request(target, "PUT", key, {
      body: bytes,
      // Not `application/octet-stream`: a type of our own makes the archive
      // self-describing to anything that browses the bucket later.
      contentType: "application/vnd.wargaming.wotreplay",
    });
    if (response.ok) return { ok: true, key };

    const detail = s3Error(response);
    return {
      ok: false,
      error: isFull(detail) ? ReplayStoreError.Full : ReplayStoreError.Failed,
      detail,
    };
  } catch (err) {
    // The bucket is unreachable. Distinct from a refusal on purpose: the
    // caller should keep the file and try again, not discard it.
    return {
      ok: false,
      error: ReplayStoreError.Failed,
      detail: (err as Error).message,
    };
  }
}

/** Whether a replay is already stored, without pulling a megabyte to find out. */
export async function replayExists(key: string): Promise<boolean> {
  const target = replayStore();
  if (!target) return false;
  try {
    const response = await s3Request(target, "HEAD", key);
    return response.ok;
  } catch {
    // Unknown rather than absent: answering "no" to an unreachable bucket
    // would invite a re-upload of something that is very likely already there.
    return false;
  }
}

/** The stored file, or null when there is none (or no bucket at all). */
export async function fetchReplay(key: string): Promise<Uint8Array | null> {
  const target = replayStore();
  if (!target) return null;
  const response = await s3Request(target, "GET", key);
  if (!response.ok) return null;
  return response.body;
}

/** What the row says about a battle somebody is offering a replay for. */
export type ReplayTarget = {
  /** Already stored, so the sender can stop holding the file. */
  storedKey: string | null;
  /** Whether the sending account actually played in it. */
  wasThere: boolean;
};

/**
 * The battle a replay claims to belong to, looked up by its primary key.
 *
 * `startedAt` comes from the caller rather than being searched for, and that
 * is not a convenience: `started_at` is the partition key, so a lookup by
 * `arena_unique_id` alone would scan every partition of a table that holds a
 * row per battle per region. The mod already has the value, it is the one it
 * sent with the results.
 */
export async function replayTargetOf(
  region: Region,
  arenaUniqueId: string,
  startedAt: Date,
  accountId: number,
): Promise<ReplayTarget | null> {
  const table = battlesByRegion[region];
  const [row] = await db
    .select({
      storedKey: table.replayKey,
      // Asked of Postgres rather than pulled back as an array: `player_ids`
      // holds thirty bigints and the only question is whether one of them is
      // this account, which the GIN index answers without reading the row's
      // thirty-vehicle payload.
      wasThere: sql<boolean>`${table.playerIds} @> ARRAY[${accountId}]::bigint[]`,
    })
    .from(table)
    .where(
      and(eq(table.startedAt, startedAt), eq(table.arenaUniqueId, arenaUniqueId)),
    )
    .limit(1);
  return row ?? null;
}

/** Write down where the file went, once it is actually in the bucket. */
export async function attachReplay(
  region: Region,
  arenaUniqueId: string,
  startedAt: Date,
  key: string,
): Promise<void> {
  const table = battlesByRegion[region];
  await db
    .update(table)
    .set({ replayKey: key, replayStoredAt: new Date() })
    .where(
      and(eq(table.startedAt, startedAt), eq(table.arenaUniqueId, arenaUniqueId)),
    );
}

/** Remove one replay. Used by retention, never by a request from outside. */
export async function deleteReplay(key: string): Promise<boolean> {
  const target = replayStore();
  if (!target) return false;
  const response = await s3Request(target, "DELETE", key);
  // S3 answers 204 for a delete, and also for deleting what was not there.
  return response.ok || response.status === 404;
}
