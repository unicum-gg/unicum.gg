import { Region } from "@unicum.gg/wargaming";
import type { NewBattleRow } from "@unicum.gg/shared";
import {
  normaliseBattleId,
  recordBattles,
  startsInRange,
} from "@unicum.gg/core/battles/ingest";
import { consumeQuota } from "@unicum.gg/core/lib/request-quota";
import { provenAccount } from "@/services/game/proven-account";
import { battlesUploadBody, type BattleBody } from "./body";

export const dynamic = "force-dynamic";

/** Why a battle was refused for good, so the mod stops offering it. */
export enum BattleRefusal {
  /** The sender was not in it, so it is not theirs to report. */
  NotAPlayer = "not_a_player",
  /** Older than the oldest month the table has a partition for. */
  TooOld = "too_old",
  /** Starts in the future, which only a broken clock produces. */
  InTheFuture = "in_the_future",
  /** It names a cluster in another region than the account we resolved. */
  WrongRegion = "wrong_region",
  /** The database would not take it. The reason rides along. */
  Refused = "database_refused",
}

/**
 * What one account may upload in an hour, **counted in battles**.
 *
 * A battle lasts about seven minutes, so a player cannot honestly produce
 * more than ten an hour, and the mod sends each one as it ends. The headroom
 * above that is for the queue: a client that was offline, or whose uploads
 * failed, flushes its backlog at the next garage, and that flush is exactly
 * the moment a tight limit would throw away the data it was meant to protect.
 *
 * Battles, not requests, and the difference is not cosmetic: a request may
 * carry twenty-five, so the first version of this allowed 3000 battles an hour
 * while its own comment reasoned about 120. That is the number that decides
 * how fast a malicious account can fabricate history, so it is the number
 * that has to be counted.
 */
const UPLOAD_QUOTA = { limit: 300, windowSeconds: 3600 };

/**
 * The most a body may be before it is read at all.
 *
 * App Router route handlers have no size limit of their own (the old
 * `api.bodyParser.sizeLimit` was Pages-only), and `req.json()` buffers the
 * whole thing before any `.max()` in the schema can object. Twenty-five
 * sixty-vehicle battles measure about 520 KB, so this is generous and still
 * finite.
 */
const MAX_BODY_BYTES = 1_500_000;

/**
 * How the game mod tells us about a battle that has just ended.
 *
 * Not part of the public API: its only caller is the mod. It is also the first
 * endpoint here whose payload is **not** a statement about the caller alone.
 * A loadout describes the sender's own garage and nothing else; a battle
 * describes thirty accounts, twenty-nine of which belong to other people, and
 * everything about this route follows from that.
 *
 * What it does about it:
 *
 * - the sender's account is proven, by `provenAccount`, as everywhere the mod
 *   writes;
 * - the battle must **name that account among its players**. A proven account
 *   may report the battles it played in, which is the only claim it is in a
 *   position to make;
 * - and the sender is **written down**, in `reported_by`. That is the part the
 *   check cannot do: it bounds who must appear, not what is said about the
 *   other twenty-nine, so a fabricated battle has to be findable afterwards.
 *   Without provenance it would be neither findable nor withdrawable, which is
 *   the one thing `tank_loadouts` gets for free by being keyed on the proven
 *   account.
 *
 * Deduplication rather than ownership: see `@unicum.gg/core/battles/ingest`.
 * Two of our players in the same battle send the same battle, the first one
 * through is kept, the second is added to `reported_by`, and the answer names
 * it `known` rather than refusing it.
 *
 * **The answer names every battle it accounts for**, and never counts them. A
 * count cannot be acted on: the mod's queue is the only copy of a battle it
 * has not placed yet, and "three accepted" does not say which three. The first
 * version answered counts, and the mod consequently dropped its whole queue
 * on any 200 it could not parse.
 */
export async function POST(req: Request): Promise<Response> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return Response.json({ error: "body_too_large" }, { status: 413 });
  }

  const account = await provenAccount(req);
  if (!account) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  const parsed = battlesUploadBody.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  // Charged before anything is written, and by the battle rather than by the
  // call. Refusing the whole request rather than trimming it: a partial
  // acceptance the mod cannot predict is worse than a retry it can.
  const quota = await consumeQuota(
    `battles:${account.region}:${account.accountId}`,
    UPLOAD_QUOTA,
    parsed.data.battles.length,
  );
  if (!quota.allowed) {
    return Response.json(
      { error: "too_many_uploads" },
      { status: 429, headers: { "retry-after": String(quota.resetSeconds) } },
    );
  }

  const now = new Date();
  const rows: NewBattleRow[] = [];
  // Named back to the mod so a battle it can never store stops being retried.
  const rejected: { arenaUniqueId: string; reason: string }[] = [];
  const refuse = (id: string, reason: BattleRefusal) =>
    rejected.push({ arenaUniqueId: id, reason });

  for (const battle of parsed.data.battles) {
    const id = normaliseBattleId(battle.arenaUniqueId);
    const players = accountsIn(battle);
    if (!players.includes(account.accountId)) {
      refuse(id, BattleRefusal.NotAPlayer);
      continue;
    }
    const cluster = battle.server ? regionOf(battle.server) : null;
    if (cluster !== null && cluster !== account.region) {
      // The battle itself says which cluster it ran on, and the region we
      // resolved decides which table it lands in. When they disagree the row
      // would be written among another region's accounts, so it is refused
      // rather than misfiled. It happens for real: a linked account's region
      // comes from the unicum.gg sign-in, not from the client that is playing.
      refuse(id, BattleRefusal.WrongRegion);
      continue;
    }
    const startedAt = new Date(battle.startedAt * 1000);
    if (!startsInRange(startedAt, now)) {
      refuse(
        id,
        startedAt.getTime() > now.getTime()
          ? BattleRefusal.InTheFuture
          : BattleRefusal.TooOld,
      );
      continue;
    }
    rows.push(toRow(battle, id, startedAt, players, account.accountId));
  }

  try {
    const { stored, known, failed } = await recordBattles(
      account.region,
      rows,
    );
    for (const { arenaUniqueId, reason } of failed) {
      rejected.push({
        arenaUniqueId,
        reason: `${BattleRefusal.Refused}: ${reason}`,
      });
    }
    if (rejected.length > 0) {
      // The clearest abuse signal this endpoint has, and the first version
      // answered it and forgot it.
      console.warn(
        `[api/game/battles] ${account.region}/${account.accountId}: refused ${rejected.length} of ${parsed.data.battles.length} (${rejected.map((r) => r.reason).join(", ")})`,
      );
    }
    return Response.json(
      { stored, known, rejected },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    // `recordBattles` already falls back to one row at a time, so reaching
    // here means the database itself is unreachable. Nothing is named, so the
    // mod keeps its whole queue and tries again.
    console.error("[api/game/battles] failed:", err);
    return Response.json({ error: "save_failed" }, { status: 502 });
  }
}

/** Which region a cluster name belongs to, or null when it names none we know. */
function regionOf(server: string): Region | null {
  // `EU-201`, `ASIA-101`, out of the battle's own replayURL. Unknown prefixes
  // answer null and are not held against the battle: this is here to catch a
  // misfiling, not to be a list of every cluster Wargaming may ever name.
  const prefix = server.split("-")[0].toUpperCase();
  if (prefix === "EU") return Region.EU;
  if (prefix === "NA" || prefix === "US") return Region.NA;
  if (prefix === "ASIA" || prefix === "SG") return Region.ASIA;
  return null;
}

/**
 * The accounts in a battle, bots excluded, sorted and without repeats.
 *
 * Derived here rather than sent by the mod, for the reason the loadout
 * endpoint derives its flat columns: `player_ids` is an index over `vehicles`,
 * and a client that built the list slightly differently would make the two
 * disagree for the players running that version alone. A vehicle with no
 * account is a bot and simply has nobody to list.
 */
function accountsIn(battle: BattleBody): number[] {
  const accounts = new Set<number>();
  for (const vehicle of battle.vehicles) {
    if (vehicle.account) accounts.add(vehicle.account);
  }
  return [...accounts].sort((a, b) => a - b);
}

function toRow(
  battle: BattleBody,
  arenaUniqueId: string,
  startedAt: Date,
  playerIds: number[],
  reporter: number,
): NewBattleRow {
  return {
    arenaUniqueId,
    startedAt,
    mapName: battle.mapName,
    battleType: battle.battleType,
    gameplayId: battle.gameplayId ?? null,
    duration: battle.duration ?? null,
    winnerTeam: battle.winnerTeam ?? null,
    finishReason: battle.finishReason ?? null,
    clientVersion: battle.clientVersion ?? null,
    server: battle.server ?? null,
    playerIds,
    reportedBy: [reporter],
    vehicles: battle.vehicles.map((vehicle) => ({ ...vehicle })),
    // Stored on the first write only: the conflict path updates `reported_by`
    // and nothing else, so a second reporter's economy never overwrites the
    // first's. It belongs to whoever created the row, which is what
    // `reported_by[0]` names.
    personal: battle.personal ?? null,
  };
}
