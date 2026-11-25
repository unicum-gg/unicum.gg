import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import {
  isMemberIdentityEnabled,
  syncAllMemberIdentities,
} from "./member-identity";

// Hourly, on a minute nothing else holds. A link and a disconnect apply the
// identity on the spot, so this only catches what neither sees: a rename on
// Wargaming's side, and a player who linked before joining the server.
const SCHEDULE = "55 * * * *";

export function startMemberIdentityCron(): void {
  if (!isMemberIdentityEnabled()) return;
  const name = "discord-member-identity";
  if (
    scheduleCron(name, SCHEDULE, async () => {
      await syncAllMemberIdentities();
    })
  ) {
    console.log(`[${name}] scheduled (${SCHEDULE})`);
  }
}
