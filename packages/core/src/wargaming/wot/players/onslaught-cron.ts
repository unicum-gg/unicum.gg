import { REGIONS } from "@unicum.gg/wargaming";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
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
