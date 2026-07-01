declare global {
  var __cronStarted: boolean | undefined;
  var __dbContext: "request" | "background" | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__cronStarted) return;
  globalThis.__cronStarted = true;

  // Everything imported while booting the crons resolves its `db` to the
  // dedicated background pool (see src/services/db). Reset to "request" once
  // the boot completes so the SSR/route bundles, evaluated on the first HTTP
  // hit (always after `register` resolves), pick the request pool instead.
  globalThis.__dbContext = "background";
  try {
    const { getInstanceId } = await import("@/services/cron/lease");
    console.log(`[cron] instance ${getInstanceId()}`);

    const { installShutdownHandler } = await import(
      "@/services/cron/shutdown"
    );
    installShutdownHandler();

    const { startPlayerBackfillCron } = await import(
      "@/services/players/backfill-cron"
    );
    startPlayerBackfillCron();

    const { startPlayerRefreshCron } = await import(
      "@/services/players/refresh-cron"
    );
    startPlayerRefreshCron();

    const { startClanRefreshCron } = await import(
      "@/services/clans/refresh-cron"
    );
    startClanRefreshCron();

    const { startClanBackfillCron } = await import(
      "@/services/clans/backfill-cron"
    );
    startClanBackfillCron();

    const { startDiscoveryCron } = await import("@/services/discovery/cron");
    startDiscoveryCron();

    const { startTopClansCron } = await import(
      "@/services/wargaming/wot/clans/top/cron"
    );
    startTopClansCron();

    const { startTopPlayersCron } = await import(
      "@/services/wargaming/wot/players/top/cron"
    );
    startTopPlayersCron();
  } finally {
    globalThis.__dbContext = "request";
  }
}
