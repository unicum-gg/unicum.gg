import { createHash } from "node:crypto";
import * as z from "zod";
import {
  battleIdIn,
  readReplay,
  readReplayHeader,
  ReplayError,
} from "@unicum.gg/shared";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import {
  assembleReplay,
  attachReplay,
  discardReplayParts,
  replayExists,
  replayKey,
  replayPartKey,
  replayStore,
  replayTargetOf,
  ReplayStoreError,
  storeReplay,
} from "@unicum.gg/core/battles/replays";
import { storeLoadoutsFromContainer } from "@unicum.gg/core/battles/loadouts";
import { storePositionsFromContainer } from "@unicum.gg/core/maps/positions";
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
 * The most pieces one replay may arrive in.
 *
 * A piece is bounded by what the game can put on the wire at once, 8000000
 * bytes of body, which is about 6 MB of file once base64 has taken its third.
 * Four covers the 12 MB a replay is allowed to be twice over, and it bounds
 * what one request can ask this to read back out of the bucket.
 */
const MAX_PARTS = 4;

/** `part` and `parts` off the query, or null when this is a whole file. */
function pieceOf(url: URL): { index: number; count: number } | null {
  const raw = url.searchParams.get("parts");
  if (raw === null) return null;
  const count = Number(raw);
  const index = Number(url.searchParams.get("part") ?? "");
  if (!Number.isInteger(count) || count < 2 || count > MAX_PARTS) return null;
  if (!Number.isInteger(index) || index < 0 || index >= count) return null;
  return { index, count };
}

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

  const piece = new Uint8Array(Buffer.from(body.data.replay, "base64"));
  const key = replayKey(account.region, startedAt, arenaUniqueId);
  const split = pieceOf(new URL(req.url));

  // A replay too long to travel in one request arrives in pieces, each one
  // parked beside the replay until the last turns up. The hash in the body is
  // the WHOLE file's, so it is only checked once there is a whole file.
  let bytes: Uint8Array<ArrayBufferLike> = piece;
  if (split) {
    if (piece.length === 0 || piece.length > MAX_REPLAY_BYTES) {
      return Response.json({ error: "body_too_large" }, { status: 413 });
    }
    const kept = await storeReplay(replayPartKey(key, split.index), piece);
    if (!kept.ok) {
      if (kept.error === ReplayStoreError.Full) return refuse(ReplayRefusal.ArchiveFull);
      if (kept.error === ReplayStoreError.NotConfigured) {
        return refuse(ReplayRefusal.NotCollected);
      }
      console.error(`[api/game/battles/replay] part store failed: ${kept.detail}`);
      return Response.json({ error: "store_failed" }, { status: 502 });
    }
    if (split.index < split.count - 1) {
      return Response.json(
        { part: split.index, parts: split.count },
        { headers: { "cache-control": "no-store" } },
      );
    }
    const whole = await assembleReplay(key, split.count);
    if (!whole) {
      // A piece never arrived, or was swept. Nothing here can mend that, and
      // leaving the others costs the quota, so the sender starts again.
      await discardReplayParts(key, split.count);
      return Response.json({ error: "missing_part" }, { status: 422 });
    }
    bytes = whole;
  }

  if (bytes.length === 0 || bytes.length > MAX_REPLAY_BYTES) {
    if (split) await discardReplayParts(key, split.count);
    return Response.json({ error: "body_too_large" }, { status: 413 });
  }

  // The hash catches what nothing else here can: a body cut short in transit
  // keeps a valid header and the right battle id, so without this a truncated
  // replay would be archived looking perfectly well.
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== body.data.sha256.toLowerCase()) {
    if (split) await discardReplayParts(key, split.count);
    // Not a refusal, deliberately: refusals are final and make the mod delete
    // its copy, and a body that arrived damaged is the one case where the copy
    // is still good and the next attempt may well work.
    return Response.json({ error: "corrupt_upload" }, { status: 422 });
  }

  // A replay of another battle would be a perfectly valid file describing the
  // wrong thirty people, which is the kind of wrong that is never noticed
  // again once it is in the archive.
  try {
    const named = battleIdIn(readReplayHeader(bytes));
    // Null means the file names no battle at all, which is what an unfinished
    // recording looks like: the block carrying the id is only written when the
    // battle ends.
    if (named === null || normaliseBattleId(named) !== arenaUniqueId) {
      return refuse(ReplayRefusal.NotThisBattle);
    }
  } catch (err) {
    if (err instanceof ReplayError) return refuse(ReplayRefusal.NotThisBattle);
    throw err;
  }

  // Between the row check above and here, another of the thirty clients may
  // have placed the same file. Cheap to ask, and it saves writing a megabyte
  // over an identical one.
  if (await replayExists(key)) {
    await attachReplay(account.region, arenaUniqueId, startedAt, key);
    // Still read, even though the file is not written again. The loadout is
    // keyed on the battle and the VEHICLE, so a second reporter contributes
    // their own vehicle's, which the first could not see; and a file stored
    // before this was collected at all has none, so an offer of it backfills.
    // The insert ignores conflicts, so offering the same one twice is free.
    // The positions are rewritten whole, so a second offer is free too.
    await writeDerived(account.region, arenaUniqueId, startedAt, bytes);
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

  // What the recorder had fitted, written down now rather than decoded again
  // on every read. This is the one moment the bytes are already in memory, and
  // the answer never changes afterwards.
  //
  // Guarded on its own, and deliberately after the row that references the
  // object: the replay is what the player offered and what the quota was spent
  // on, so a fault in reading the loadout out of it must not turn a stored
  // file into a failed upload. A loadout that could not be read is a null
  // column; a replay refused for that reason would be a file the mod deletes.
  //
  // And where the recorder's team set up and dealt its damage from, for the
  // map's minimap, out of the same decode: the positions are in the packets
  // this already reads.
  await writeDerived(account.region, arenaUniqueId, startedAt, bytes);
  // The pieces have nothing left to say once the whole is stored.
  if (split) await discardReplayParts(key, split.count);

  return Response.json(
    { stored: key },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Decode the file once and store what it says, swallowing any fault.
 *
 * Two things come out of it: the loadouts the recording carries, and where
 * the recorder's team set up and dealt its damage from, for the map's
 * minimap. The decode is the expensive half -- a decryption and an inflate
 * over about a megabyte -- and it happens here rather than on the read path
 * for exactly that reason, once for both. A
 * recording from a client this cannot read simply yields nothing, which is a
 * battle with no loadout and no positions rather than an error: coverage is a
 * thing to measure, not to fail on.
 *
 * Each write is guarded on its own, so a fault in one never costs the other.
 * The reading itself lives in `core` because the backfills do the same work on
 * the same files, and the two must not drift.
 */
async function writeDerived(
  region: Parameters<typeof storeLoadoutsFromContainer>[0],
  arenaUniqueId: string,
  startedAt: Date,
  bytes: Uint8Array,
): Promise<void> {
  let container;
  try {
    container = await readReplay(bytes);
  } catch (error) {
    console.error(
      `[api/game/battles/replay] ${region}/${arenaUniqueId}: unreadable`,
      error,
    );
    return;
  }
  try {
    await storeLoadoutsFromContainer(region, arenaUniqueId, startedAt, container);
  } catch (error) {
    console.error(
      `[api/game/battles/replay] ${region}/${arenaUniqueId}: loadout not stored`,
      error,
    );
  }
  try {
    await storePositionsFromContainer(region, arenaUniqueId, startedAt, container);
  } catch (error) {
    console.error(
      `[api/game/battles/replay] ${region}/${arenaUniqueId}: positions not stored`,
      error,
    );
  }
}

function refuse(reason: ReplayRefusal): Response {
  // 200 and not 4xx: these are all final answers the mod must act on by
  // dropping the file, and an error status invites a retry.
  return Response.json(
    { refused: reason },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
