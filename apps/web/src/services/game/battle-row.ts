import { Region } from "@unicum.gg/wargaming";
import type { NewBattleRow } from "@unicum.gg/shared";
import type { BattleBody } from "@/app/api/game/battles/body";

/**
 * Turning a declared battle into the row it is stored as.
 *
 * Shared by the two ways a battle reaches us, the mod reporting it live and a
 * player uploading its `.wotreplay` on the site, so a battle cannot look
 * different depending on which door it came through.
 */

/** Which region a cluster name belongs to, or null when it names none we know. */
export function regionOf(server: string): Region | null {
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
export function battleAccounts(battle: BattleBody): number[] {
  const accounts = new Set<number>();
  for (const vehicle of battle.vehicles) {
    if (vehicle.account) accounts.add(vehicle.account);
  }
  return [...accounts].sort((a, b) => a - b);
}

function knownTank(tank: number | null | undefined): number | null {
  return tank && tank > 0 ? tank : null;
}

/** The stored row for a validated battle, credited to whoever reported it. */
export function toRow(
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
    // `tank` is normalised here rather than in the schema so the one place
    // that builds a stored row is the one place that decides what an unknown
    // vehicle looks like in the column. Never 0: the filters read
    // `(v->>'tank')::int`, and a zero would gather every unidentified
    // vehicle in the game under one fictional tank.
    vehicles: battle.vehicles.map(({ tanks, ...vehicle }) => ({
      ...vehicle,
      tank: knownTank(vehicle.tank),
      ...(tanks
        ? { tanks: tanks.map((one) => ({ ...one, tank: knownTank(one.tank) })) }
        : {}),
    })),
    // Stored on the first write only: the conflict path updates `reported_by`
    // and nothing else, so a second reporter's economy never overwrites the
    // first's. It belongs to whoever created the row, which is what
    // `reported_by[0]` names.
    personal: battle.personal ?? null,
  };
}
