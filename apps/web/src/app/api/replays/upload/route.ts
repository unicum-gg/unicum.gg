import { headers } from "next/headers";
import {
  declarationFromReplay,
  readReplayHeader,
  ReplayError,
} from "@unicum.gg/shared";
import { auth } from "@unicum.gg/core/auth";
import {
  normaliseBattleId,
  recordBattles,
  startsInRange,
} from "@unicum.gg/core/battles/ingest";
import {
  recordReplay,
  replayExists,
  replayKey,
  replayStore,
  replayTargetOf,
  ReplayStoreError,
  storeReplay,
} from "@unicum.gg/core/battles/replays";
import { consumeQuota } from "@unicum.gg/core/lib/request-quota";
import { battleBody } from "@/app/api/game/battles/body";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { jsonResponse } from "@/services/openapi/json-response";
import { battleAccounts, regionOf, toRow } from "@/services/game/battle-row";
import { writeDerived } from "@/services/game/replay-derived";
import { replayEconomy } from "@/services/game/replay-economy";
import { ReplayUploadResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/** Why an upload was turned down, as the form names it to the player. */
export enum ReplayUploadRefusal {
  /** This deployment keeps no archive at all. */
  NotCollected = "not_collected",
  /** The archive is at its quota. */
  ArchiveFull = "archive_full",
  /** The file is not a replay, or is one we cannot read. */
  NotAReplay = "not_a_replay",
  /** A replay of a battle left before it ended: no results were written. */
  Unfinished = "unfinished",
  /** Recorded by another account than the one signed in. */
  NotYours = "not_yours",
  /** It names a cluster in another region than the signed-in account's. */
  WrongRegion = "wrong_region",
  /** Older than the oldest month the battles table holds. */
  TooOld = "too_old",
  /** The results do not pass the schema every declared battle goes through. */
  Malformed = "malformed",
  /** Larger than the archive takes, or than the proxy lets through whole. */
  TooLarge = "too_large",
}

/**
 * The same budget as the mod's replay uploads, under the same key.
 *
 * Shared on purpose: a replay is a replay whichever door it comes through, and
 * two budgets would let one account put twice as much in the bucket by using
 * both.
 */
const UPLOAD_QUOTA = { limit: 30, windowSeconds: 3600 };

/**
 * The largest file this takes.
 *
 * Under the 10 MB the proxy buffers before handing a body on
 * (`proxyClientMaxBodySize`): past it the body is cut short silently, and a cut
 * replay keeps a valid header. Measured over 12,583 replays the 99th percentile
 * is 2.9 MB and the largest 7.4 MB, so this refuses nothing anybody plays.
 */
const MAX_REPLAY_BYTES = 9 * 1024 * 1024;

/** The file plus what multipart costs around it. */
const MAX_BODY_BYTES = MAX_REPLAY_BYTES + 64 * 1024;

/**
 * Upload a replay
 * @description Add a finished battle to the site from its `.wotreplay` file, for players who do not run the mod. Requires a signed-in Wargaming account, and the file must have been recorded by that account: a replay names who recorded it, and a battle is a statement about thirty players, so the one claim an account is in a position to make is about the battles it played itself. The battle is read entirely out of the file (results, map, client version) through the same conversion and the same checks as the mod's live reports, so a battle uploaded here and the same battle reported by the mod are one row. The file itself is archived so the battle's 2D replay can be watched on its page. Answers 200 with the battle's id, whether this upload created it or it was already held. 401 when signed out, 413 when too large, 422 with a reason when the file cannot be taken, 429 past 30 uploads an hour.
 * @contentType multipart/form-data
 * @body ReplayUploadBody
 * @response ReplayUploadResponse
 * @tag Players
 * @openapi
 */
export async function POST(request: Request) {
  if (!replayStore()) return refuse(ReplayUploadRefusal.NotCollected, 503);

  const session = await auth.api.getSession({ headers: await headers() });
  const account = wgIdentityFromEmail(session?.user?.email);
  if (!account) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return refuse(ReplayUploadRefusal.TooLarge, 413);
  }

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

  const form = await request.formData().catch(() => null);
  const file = form?.get("replay");
  if (!(file instanceof File)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_REPLAY_BYTES) {
    return refuse(ReplayUploadRefusal.TooLarge, 413);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());

  let declaration;
  try {
    declaration = declarationFromReplay(readReplayHeader(bytes));
  } catch (error) {
    if (error instanceof ReplayError) return refuse(ReplayUploadRefusal.NotAReplay);
    throw error;
  }
  if (!declaration) return refuse(ReplayUploadRefusal.Unfinished);
  // Checked against the file's own `playerID` rather than the roster: being
  // one of the thirty is what lets the mod report a battle, but the file is
  // the recorder's own, and an account uploading another player's recording
  // would be publishing a file that player chose not to share.
  if (declaration.recorder !== account.accountId) {
    return refuse(ReplayUploadRefusal.NotYours);
  }

  const parsed = battleBody.safeParse(declaration.battle);
  if (!parsed.success) return refuse(ReplayUploadRefusal.Malformed);
  const battle = parsed.data;

  const cluster = battle.server ? regionOf(battle.server) : null;
  if (cluster !== null && cluster !== account.region) {
    return refuse(ReplayUploadRefusal.WrongRegion);
  }
  const arenaUniqueId = normaliseBattleId(battle.arenaUniqueId);
  const startedAt = new Date(battle.startedAt * 1000);
  if (!(await startsInRange(account.region, startedAt))) {
    return refuse(ReplayUploadRefusal.TooOld);
  }

  // The row first, and the file after it: unlike the mod, which reports the
  // battle before offering its replay, here the file IS the report, so the
  // row it hangs on has to exist before anything is attached to it.
  const { stored, failed } = await recordBattles(account.region, [
    toRow(battle, arenaUniqueId, startedAt, battleAccounts(battle), account.accountId),
  ]);
  if (failed.length > 0) {
    console.error(
      `[api/replays/upload] ${account.region}/${arenaUniqueId}: ${failed[0].reason}`,
    );
    return refuse(ReplayUploadRefusal.Malformed);
  }

  const target = await replayTargetOf(
    account.region,
    arenaUniqueId,
    startedAt,
    account.accountId,
  );
  if (!target?.storedKey) {
    // Keyed on the recorder: every participant who runs the mod records their
    // own point of view, so a second recording of the battle is kept beside
    // the first, never refused for it.
    const key = replayKey(account.region, startedAt, arenaUniqueId, account.accountId);
    if (!(await replayExists(key))) {
      const kept = await storeReplay(key, bytes);
      if (!kept.ok) {
        if (kept.error === ReplayStoreError.Full) {
          return refuse(ReplayUploadRefusal.ArchiveFull, 507);
        }
        if (kept.error === ReplayStoreError.NotConfigured) {
          return refuse(ReplayUploadRefusal.NotCollected, 503);
        }
        console.error(`[api/replays/upload] store failed: ${kept.detail}`);
        return Response.json({ error: "store_failed" }, { status: 502 });
      }
    }
    await recordReplay({
      region: account.region,
      arenaUniqueId,
      startedAt,
      recorder: account.accountId,
      key,
      bytes,
      personal: replayEconomy(bytes),
    });
    await writeDerived(account.region, arenaUniqueId, startedAt, bytes);
  }

  return jsonResponse(
    ReplayUploadResponse,
    {
      region: account.region,
      id: arenaUniqueId,
      created: stored.includes(arenaUniqueId),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

function refuse(reason: ReplayUploadRefusal, status = 422): Response {
  return Response.json(
    { error: reason },
    { status, headers: { "cache-control": "no-store" } },
  );
}
