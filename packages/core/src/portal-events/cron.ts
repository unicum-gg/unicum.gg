import { PortalCalendarMissingError, REGIONS } from "@unicum.gg/wargaming";
import { scheduleCron } from "@unicum.gg/core/cron/scheduler";
import { createStallAlert } from "@unicum.gg/core/cron/stall-alert";
import { capturePortalEvents } from "./capture";
import { portalEventsPublishingEnabled, publishPortalEvents } from "./publish";

/**
 * Hourly, at twelve past: the widget changes a few times a week, and an entry
 * stays on it for days, so an hour is far finer than anything it does. The
 * minute is one no other hourly job holds.
 */
const SCHEDULE = "12 * * * *";

/**
 * A portal page that answers without the widget is Wargaming redesigning its
 * home page, and from then on every week goes unrecorded with nothing in the
 * log but a warning. Said once on Discord, and once more when it is back.
 */
const missingWidget = createStallAlert({
  name: "portal-events-cron",
  keyPrefix: "portal-events",
});

export async function captureAllPortalEvents(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await Promise.all(
    REGIONS.map(async (region) => {
      try {
        counts[region] = await capturePortalEvents(region);
        await missingWidget.recover(
          region,
          `✅ The ${region.toUpperCase()} portal's events widget is readable again.`,
        );
      } catch (err) {
        counts[region] = 0;
        if (err instanceof PortalCalendarMissingError) {
          await missingWidget.announce(
            region,
            `⚠️ The ${region.toUpperCase()} portal home page no longer carries its events widget, so its calendar is not being recorded.`,
          );
          return;
        }
        console.error(`[portal-events-cron] ${region} failed:`, err);
      }
    }),
  );
  return counts;
}

/**
 * The capture runs everywhere, since it is an idempotent write of what the
 * portal shows. Publishing is production only, for the reason the changelog
 * crons give: `scheduleCron` skips the leader election in development, and a
 * dev machine holding the bot token would post to the community server itself.
 * Locally, `pnpm --filter @unicum.gg/worker publish-portal-events --dry`.
 */
export function startPortalEventsCron(): void {
  const publishing =
    process.env.NODE_ENV === "production" && portalEventsPublishingEnabled();
  if (
    scheduleCron("portal-events-cron", SCHEDULE, async () => {
      const counts = await captureAllPortalEvents();
      console.log("[portal-events-cron] captured", counts);
      if (!publishing) return;
      for (const line of await publishPortalEvents()) {
        console.log(`[portal-events-cron] ${line}`);
      }
    })
  ) {
    console.log(
      `[portal-events-cron] scheduled (${SCHEDULE}), ${publishing ? "publishing to Discord" : "capture only"}`,
    );
  }
}
