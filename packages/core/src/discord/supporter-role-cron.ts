import { and, eq } from "drizzle-orm";
import { account, subscription } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { reconcileSupporterRole, supporterRoleConfig } from "./supporter-role";

/**
 * Re-applies every linked supporter's Discord roles once a day.
 *
 * The webhook already does it on each monthly renewal, which is exactly when a
 * pledge crosses into the next metal, so in steady state this changes nothing.
 * It exists because that path is best-effort and silent: a Discord blip during
 * the renewal leaves the supporter on last month's metal for a whole month,
 * and a lapse whose webhook failed would leave the roles on forever. So it
 * walks everyone who has ever subscribed and linked Discord, lapsed ones
 * included, since those are the ones with something to take back.
 */

// Daily, on a quiet minute between the streamer (05:20) and Onslaught (05:50)
// reconciles. A few rows and a handful of Discord calls each.
const SCHEDULE = "40 5 * * *";

export async function reconcileAllSupporterRoles(): Promise<number> {
  const rows = await db
    .selectDistinct({ userId: subscription.userId })
    .from(subscription)
    .innerJoin(
      account,
      and(
        eq(account.userId, subscription.userId),
        eq(account.providerId, "discord"),
      ),
    );
  for (const { userId } of rows) await reconcileSupporterRole(userId);
  return rows.length;
}

/** Schedule the daily pass. No-ops when the supporter role is not configured. */
export function startSupporterRoleCron(): void {
  if (!supporterRoleConfig()) {
    console.log("[supporter-role] Discord role not configured, not scheduling");
    return;
  }
  scheduleCron("supporter-role-cron", SCHEDULE, async () => {
    const count = await reconcileAllSupporterRoles();
    console.log(`[supporter-role] reconciled ${count} linked supporter(s)`);
  });
}
