import { REGIONS } from "@unicum.gg/wargaming";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { refreshOnslaughtCrests } from "./onslaught-crest";
import { reconcileOnslaught } from "./onslaught";

/**
 * Daily identity pass over the Onslaught standings.
 *
 * The capture records who was ranked, by account id, with the nickname and clan
 * the board carried at that moment. Both of those go stale: players rename and
 * change clans, and a stale nickname does not merely look wrong, it breaks the
 * link, since player pages are keyed by nickname and Wargaming cannot resolve a
 * name nobody holds any more. So this resolves the current identity by account
 * id and materializes it onto the rows, which is also what keeps the board a
 * pure DB read instead of a few thousand live lookups per request.
 *
 * It carries a second job that only it can do, and that has a deadline. The
 * season's codename and its year are frozen here, from a client localization
 * that names ONLY the running year: once the year rolls over, the name of a
 * season that was never stamped cannot be recovered from anywhere. Stamping the
 * year is also what lets the NEXT season work out its own position, so a season
 * that passes unstamped costs its successor that count.
 *
 * Daily is set by the identity half (a rename is rare, and resolving a full EU
 * board is a few dozen batched calls). The stamping half only needs to happen
 * once while a season is live, and a season runs about six weeks.
 */
const SCHEDULE = "50 5 * * *";

/** Schedule the daily reconcile, per region so one slow region cannot stall the others. */
export function startOnslaughtReconcileCron(): void {
  for (const region of REGIONS) {
    const name = `onslaught-reconcile-cron-${region}`;
    const armed = scheduleCron(name, SCHEDULE, async () => {
      const { resolved, formerNames } = await reconcileOnslaught(region);
      console.log(
        `[onslaught-reconcile] ${region}: ${resolved} identities resolved, ${formerNames} former name(s) recorded`,
      );
    });
    if (armed) console.log(`[${name}] scheduled (${SCHEDULE})`);
  }
}

/**
 * How often the crest is recomputed from the standings.
 *
 * The capture writes every 15 minutes, so the crest follows at the same
 * cadence, offset by two so it reads a pass that has landed rather than one
 * in flight. It rode the daily reconcile first, and a day of lag is invisible
 * everywhere the crest is worn EXCEPT the one page that also shows the current
 * rank beside it: a player who crossed into Legend this morning sat under a
 * violet pill wearing a steel-blue crest, which reads as a bug rather than as
 * a badge that has not caught up.
 *
 * It is affordable because the source is small and the write is conditional.
 * The recompute reads about 32,000 rows on EU and costs ~230ms, and rows are
 * written only where a value actually changed, so between two seasons the job
 * updates nothing at all.
 */
const CREST_SCHEDULE = "2,17,32,47 * * * *";

/**
 * Keep the Onslaught crest in step with the board it is read from.
 *
 * Separate from the reconcile above rather than folded into it, because they
 * answer to different clocks: identity drifts over weeks and a rename can wait
 * for the night, while a place on the board changes within the hour and is
 * displayed next to the crest that claims it.
 */
export function startOnslaughtCrestCron(): void {
  for (const region of REGIONS) {
    const name = `onslaught-crest-cron-${region}`;
    const armed = scheduleCron(name, CREST_SCHEDULE, async () => {
      const crests = await refreshOnslaughtCrests(region);
      // Logged only when something moved: at this cadence the honest answer is
      // almost always zero, and a line every quarter hour saying so would bury
      // the passes that did write.
      if (crests > 0) {
        console.log(`[onslaught-crest] ${region}: ${crests} crest(s) updated`);
      }
    });
    if (armed) console.log(`[${name}] scheduled (${CREST_SCHEDULE})`);
  }
}
