import {
  declarationFromReplay,
  readReplayHeader,
  replayRecorder,
  type BattleEconomy,
} from "@unicum.gg/shared";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import { battleBody } from "@/app/api/game/battles/body";
import { battleAccounts, toRow } from "./battle-row";

/**
 * The recorder's own economy, read from their file's results block and mapped
 * exactly as a reported battle's is, through the one function that builds a
 * stored row. Null for a file with no results (a battle left early) or one
 * this cannot read: the replay is still stored, its panel just shows less.
 */
export function replayEconomy(bytes: Uint8Array): BattleEconomy | null {
  try {
    const declaration = declarationFromReplay(readReplayHeader(bytes));
    if (!declaration?.recorder) return null;
    const parsed = battleBody.safeParse(declaration.battle);
    if (!parsed.success) return null;
    const battle = parsed.data;
    const row = toRow(
      battle,
      normaliseBattleId(battle.arenaUniqueId),
      new Date(battle.startedAt * 1000),
      battleAccounts(battle),
      declaration.recorder,
    );
    return row.personal ?? null;
  } catch {
    return null;
  }
}

/** Whose recording these bytes are, read off their own header. */
export function replayRecorderOf(bytes: Uint8Array): number | null {
  try {
    return replayRecorder(readReplayHeader(bytes));
  } catch {
    return null;
  }
}
