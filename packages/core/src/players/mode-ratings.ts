import { and, gt, isNotNull, sql } from "drizzle-orm";
import {
  MODE_RATING_ANCHORS,
  MR_SCALE,
  MR_VOLUME_K,
  MR_W_WIN,
  MR_W_XP,
  playersByRegion,
  RatedMode,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";

/**
 * Rewrite every cached Rampage rating with the current formula.
 *
 * The snapshot path writes `players.hr` on each account's next snapshot, which
 * is how every other cached rating converges after a formula change. It cannot
 * here, and for the reason the whole board is an archive: Rampage ended in May
 * 2016, so an account's figures never move again and nothing obliges the
 * pipeline to revisit the row. Left alone, the board would rank a mixture of
 * values computed under two different calibrations for as long as the table
 * lives, with MRB (evaluated live in SQL) on the new scale beside an MR still
 * on the old one.
 *
 * Deliberate rather than a cron: it is a one-shot after the deploy that changed
 * the formula, and running it before that deploy would leave the serving code
 * painting new values with its old thresholds.
 *
 * One `UPDATE` per region over the ~21,000 rows that carry a record, off the
 * cached `sh_*` totals with no Wargaming call and no snapshot read. The
 * expression mirrors `computeMR` and takes its constants from the same module,
 * so the two cannot drift; `WHERE hr IS DISTINCT FROM` keeps it idempotent and
 * writes only what actually changes.
 */
export async function recomputeRampageRatings(region: Region): Promise<number> {
  const players = playersByRegion[region];
  const a = MODE_RATING_ANCHORS[RatedMode.Rampage];
  // Float literals rather than bound parameters: `sh_battles` is an integer
  // column, so an integer divisor would truncate, and postgres cannot infer a
  // parameter's type inside the arithmetic. Same reason as `mrbSql`.
  const f = (n: number) => sql.raw(Number.isInteger(n) ? `${n}.0` : String(n));
  const mr = sql`round(
    ${f(MR_SCALE)}
    * (${f(MR_W_XP)} * (${players.shAvgXp} / ${f(a.xpBase)})
       + ${f(MR_W_WIN)} * ((${players.shWins}::float / ${players.shBattles}) / ${f(a.wrBase)}))
    * (${players.shBattles}::float / (${players.shBattles} + ${f(MR_VOLUME_K)}))
    / ${f(a.scoreBase)}
  )`;

  const rows = await db
    .update(players)
    .set({ hr: mr })
    .where(
      and(
        gt(players.shBattles, 0),
        isNotNull(players.shAvgXp),
        isNotNull(players.shWins),
        sql`${players.hr} IS DISTINCT FROM ${mr}`,
      ),
    )
    .returning({ id: players.id });
  return rows.length;
}
