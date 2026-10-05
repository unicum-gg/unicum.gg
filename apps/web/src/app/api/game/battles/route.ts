import type { NewBattleRow } from "@unicum.gg/shared";
import {
  recordBattles,
  startsInRange,
} from "@unicum.gg/core/battles/ingest";
import { consumeQuota } from "@unicum.gg/core/lib/request-quota";
import { provenAccount } from "@/services/game/proven-account";
import { battlesUploadBody, type BattleBody } from "./body";

export const dynamic = "force-dynamic";

/**
 * What one account may upload in an hour.
 *
 * A battle lasts about seven minutes, so a player cannot honestly produce more
 * than ten an hour, and the mod sends each one as it ends. The headroom above
 * that is for the queue: a client that was offline, or whose uploads failed,
 * flushes its backlog at the next garage, and that flush is exactly the moment
 * a tight limit would throw away the data it was meant to protect.
 */
const UPLOAD_QUOTA = { limit: 120, windowSeconds: 3600 };

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
 * - and the battle must **name that account among its players**. A proven
 *   account may report the battles it played in, which is the only claim it is
 *   in a position to make. It may not report battles it was not in.
 *
 * That check is not a formality. Without it any client could write rows about
 * any thirty accounts it liked, and since a battle arrives from whichever
 * participant happens to run the mod, there would be no later moment at which
 * the lie could be caught.
 *
 * Deduplication rather than ownership: see `@unicum.gg/core/battles/ingest`.
 * Two of our players in the same battle send the same battle, the first one
 * through is kept, and the second is answered `known` rather than refused.
 */
export async function POST(req: Request): Promise<Response> {
  const account = await provenAccount(req);
  if (!account) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  const quota = await consumeQuota(
    `battles:${account.region}:${account.accountId}`,
    UPLOAD_QUOTA,
  );
  if (!quota.allowed) {
    return Response.json(
      { error: "too_many_uploads" },
      { status: 429, headers: { "retry-after": String(quota.resetSeconds) } },
    );
  }

  const parsed = battlesUploadBody.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const now = new Date();
  const rows: NewBattleRow[] = [];
  // Named back to the mod so a battle it can never store stops being retried.
  const rejected: { arenaUniqueId: string; reason: string }[] = [];

  for (const battle of parsed.data.battles) {
    const players = accountsIn(battle);
    if (!players.includes(account.accountId)) {
      rejected.push({ arenaUniqueId: battle.arenaUniqueId, reason: "not_a_player" });
      continue;
    }
    const startedAt = new Date(battle.startedAt * 1000);
    if (!startsInRange(startedAt, now)) {
      rejected.push({ arenaUniqueId: battle.arenaUniqueId, reason: "out_of_range" });
      continue;
    }
    rows.push(toRow(battle, startedAt, players));
  }

  try {
    const { stored, known } = await recordBattles(account.region, rows);
    return Response.json(
      { stored, known, rejected },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/game/battles] failed:", err);
    return Response.json({ error: "save_failed" }, { status: 502 });
  }
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
  startedAt: Date,
  playerIds: number[],
): NewBattleRow {
  return {
    arenaUniqueId: battle.arenaUniqueId,
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
    vehicles: battle.vehicles.map((vehicle) => ({ ...vehicle })),
  };
}
