import { createHash } from "node:crypto";
import * as z from "zod";
import { readReplayHeader, ReplayError } from "@unicum.gg/shared";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import {
  attachReplay,
  replayExists,
  replayKey,
  replayStore,
  replayTargetOf,
  ReplayStoreError,
  storeReplay,
} from "@unicum.gg/core/battles/replays";
import { consumeQuota } from "@unicum.gg/core/lib/request-quota";
import { provenAccount } from "@/services/game/proven-account";

export const dynamic = "force-dynamic";

/** Why a replay was refused, in terms the mod can act on. */
export enum ReplayRefusal {
  /** This deployment keeps no archive. Stop offering files; nothing is wrong. */
  NotCollected = "not_collected",
  /** The archive is at its quota. Stop offering files until told otherwise. */
  ArchiveFull = "archive_full",
  /** The battle is not in the database, so there is nothing to attach it to. */
  UnknownBattle = "unknown_battle",
  /** The sender was not in this battle. */
  NotAPlayer = "not_a_player",
  /** The bytes are not a replay, or not of the battle they were offered for. */
  NotThisBattle = "not_this_battle",
  /** Already in the archive. Delete the local copy, this is a success. */
  AlreadyStored = "already_stored",
}

/**
 * One account's replay uploads per hour.
 *
 * Lower than the battle quota and in a different unit, because this is a
 * different cost: a battle's results are 20 KB of JSON, a replay is 1.3 MB of
 * opaque bytes that go straight into a bucket with a finite quota. Thirty an
 * hour is more than anyone can play and still leaves room for a client that
 * was offline flushing its backlog at the next garage.
 */
const UPLOAD_QUOTA = { limit: 30, windowSeconds: 3600 };

/**
 * The largest replay this will accept, once decoded.
 *
 * Measured, not guessed: across 12,583 real replays the mean is 1299 KB, the
 * 99th percentile 2892 KB and **the largest is 7.4 MB**. Twelve is comfortably
 * above anything observed and still finite.
 */
const MAX_REPLAY_BYTES = 12 * 1024 * 1024;

/**
 * The largest body, which is the above plus what base64 costs.
 *
 * The file arrives base64 inside JSON rather than as raw bytes, and that is
 * not laziness about content types. The mod posts through `BigWorld.fetchURL`,
 * whose `postData` is used nowhere in the game with anything but text, and
 * whose binary safety is undocumented. A replay is full of zero bytes, so if
 * that path is not binary-safe the failure is a file truncated at the first
 * one: still a valid header, still the right battle id, archived silently
 * broken. Paying 33% on the wire once per battle buys certainty instead.
 *
 * It matters that this is finite at all: a route handler has no body limit of
 * its own, and `req.json()` buffers everything before any check here could
 * object.
 */
const MAX_BODY_BYTES = Math.ceil(MAX_REPLAY_BYTES * 1.4);

/** The file, and what it should hash to once decoded. */
const replayBody = z.object({
  replay: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-fA-F]{64}$/),
});

/**
 * Where the game mod sends the `.wotreplay` file of a battle already reported.
 *
 * Separate from the results endpoint on purpose, and it is not just about
 * payload size. The two have different lifetimes: the results are sent the
 * moment the battle ends, while the file is **volatile**. The game's default
 * setting records the LAST battle only and overwrites it when the next one
 * starts, so the mod has to copy the file aside at the garage and send it
 * whenever it can. Tying it to the results would mean losing it whenever the
 * upload of the results happened to fail.
 *
 * Why a file at all, when the mod already sends five position samples a second
 * for every vehicle: those draw the 2D battle and weigh 64 KB. The file is
 * insurance for a 3D view nobody has built, which would need shell
 * trajectories and hit geometry that cannot be collected retroactively.
 *
 * The three things checked before a megabyte reaches the bucket:
 *
 * - the sender is proven, as everywhere the mod writes;
 * - **the battle exists and the sender played in it.** A replay is a file
 *   about thirty people, so the rule is the one the results endpoint uses;
 * - **the bytes are a replay, and are the battle they claim to be.** The
 *   header is parsed here, which is cheap: the JSON blocks sit in the clear at
 *   the front of the file, so this never decrypts the packet stream.
 *
 * `already_stored` is a refusal the mod should treat as success: the archive
 * only needs one of the thirty clients to send the file, and the twenty-nine
 * others should delete their copy rather than queue it forever.
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return Response.json({ error: "body_too_large" }, { status: 413 });
  }

  // Answered before the account is proven and before the body is read: a
  // deployment with no bucket should cost the mod one cheap round trip, not an
  // upload it was always going to throw away.
  if (!replayStore()) {
    return Response.json(
      { refused: ReplayRefusal.NotCollected },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  }

  const account = await provenAccount(req);
  if (!account) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  const arenaUniqueId = normaliseBattleId((await context.params).id);
  const startedAtSeconds = Number(
    new URL(req.url).searchParams.get("startedAt") ?? "",
  );
  if (!Number.isFinite(startedAtSeconds) || startedAtSeconds <= 0) {
    // Required rather than searched for: `started_at` is the partition key, so
    // without it finding the row means scanning every partition of a table
    // that holds one row per battle. The mod already has the value.
    return Response.json({ error: "missing_started_at" }, { status: 400 });
  }
  const startedAt = new Date(startedAtSeconds * 1000);

  const quota = await consumeQuota(
    `replays:${account.region}:${account.accountId}`,
    UPLOAD_QUOTA,
    1,
  );
  if (!quota.allowed) {
    return Response.json(
      { error: "too_many_uploads" },
      { status: 429, headers: { "retry-after": String(quota.resetSeconds) } },
    );
  }

  const target = await replayTargetOf(
    account.region,
    arenaUniqueId,
    startedAt,
    account.accountId,
  );
  if (!target) return refuse(ReplayRefusal.UnknownBattle);
  if (!target.wasThere) return refuse(ReplayRefusal.NotAPlayer);
  if (target.storedKey) return refuse(ReplayRefusal.AlreadyStored);

  const body = replayBody.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const bytes = new Uint8Array(Buffer.from(body.data.replay, "base64"));
  if (bytes.length === 0 || bytes.length > MAX_REPLAY_BYTES) {
    return Response.json({ error: "body_too_large" }, { status: 413 });
  }

  // The hash catches what nothing else here can: a body cut short in transit
  // keeps a valid header and the right battle id, so without this a truncated
  // replay would be archived looking perfectly well.
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== body.data.sha256.toLowerCase()) {
    // Not a refusal, deliberately: refusals are final and make the mod delete
    // its copy, and a body that arrived damaged is the one case where the copy
    // is still good and the next attempt may well work.
    return Response.json({ error: "corrupt_upload" }, { status: 422 });
  }

  // A replay of another battle would be a perfectly valid file describing the
  // wrong thirty people, which is the kind of wrong that is never noticed
  // again once it is in the archive.
  try {
    const { blocks } = readReplayHeader(bytes);
    if (!namesBattle(blocks, arenaUniqueId)) {
      return refuse(ReplayRefusal.NotThisBattle);
    }
  } catch (err) {
    if (err instanceof ReplayError) return refuse(ReplayRefusal.NotThisBattle);
    throw err;
  }

  const key = replayKey(account.region, startedAt, arenaUniqueId);

  // Between the row check above and here, another of the thirty clients may
  // have placed the same file. Cheap to ask, and it saves writing a megabyte
  // over an identical one.
  if (await replayExists(key)) {
    await attachReplay(account.region, arenaUniqueId, startedAt, key);
    return refuse(ReplayRefusal.AlreadyStored);
  }

  const stored = await storeReplay(key, bytes);
  if (!stored.ok) {
    if (stored.error === ReplayStoreError.Full) {
      console.warn(`[api/game/battles/replay] archive full, refusing uploads`);
      return refuse(ReplayRefusal.ArchiveFull);
    }
    if (stored.error === ReplayStoreError.NotConfigured) {
      return refuse(ReplayRefusal.NotCollected);
    }
    // Unreachable or refused: the mod keeps its copy and tries again later.
    console.error(`[api/game/battles/replay] store failed: ${stored.detail}`);
    return Response.json({ error: "store_failed" }, { status: 502 });
  }

  // The row is written after the object, never before: a key that points at
  // nothing is worse than an object nobody references, because only the first
  // produces a broken download for a reader.
  await attachReplay(account.region, arenaUniqueId, startedAt, key);

  return Response.json(
    { stored: key },
    { headers: { "cache-control": "no-store" } },
  );
}

function refuse(reason: ReplayRefusal): Response {
  // 200 and not 4xx: these are all final answers the mod must act on by
  // dropping the file, and an error status invites a retry.
  return Response.json(
    { refused: reason },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}

/**
 * Whether the replay's own header names this battle.
 *
 * The id lives in the second JSON block, the one the client writes when the
 * battle ends. A file for a battle still in progress has no second block, and
 * is refused: an unfinished replay has no packet stream either, so it is not
 * worth archiving.
 */
function namesBattle(blocks: unknown[], arenaUniqueId: string): boolean {
  const results = Array.isArray(blocks[1]) ? blocks[1][0] : blocks[1];
  const id = (results as Record<string, unknown> | null)?.arenaUniqueID;
  if (id === undefined || id === null) return false;
  return normaliseBattleId(String(id)) === arenaUniqueId;
}
