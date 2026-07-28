declare global {
  var __cronStarted: boolean | undefined;
  var __dbContext: "request" | "background" | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // A dedicated cron worker runs the loops; web instances set RUN_CRONS=0 so
  // they never do cron work on the request-serving thread (the crons still hold
  // a DB lease, so at most one instance ever executes them). Leaving it unset
  // keeps the legacy single-process behaviour where crons run here.
  if (process.env.RUN_CRONS === "0" || process.env.RUN_CRONS === "false") return;
  if (globalThis.__cronStarted) return;
  globalThis.__cronStarted = true;

  // Everything imported while booting the crons resolves its `db` to the
  // dedicated background pool (see src/services/db). Reset to "request" once
  // the boot completes so the SSR/route bundles, evaluated on the first HTTP
  // hit (always after `register` resolves), pick the request pool instead.
  globalThis.__dbContext = "background";
  try {
    const { getInstanceId } = await import("@unicum.gg/core/cron/lease");
    console.log(`[cron] instance ${getInstanceId()}`);

    const { installShutdownHandler } = await import(
      "@unicum.gg/core/cron/shutdown"
    );
    installShutdownHandler();

    const { startSnapshotPipeline } = await import(
      "@unicum.gg/core/players/snapshot-pipeline"
    );
    startSnapshotPipeline();

    const { startPlayerRefreshCron } = await import(
      "@unicum.gg/core/players/refresh-cron"
    );
    startPlayerRefreshCron();

    const { startClanRefreshCron } = await import(
      "@unicum.gg/core/clans/refresh-cron"
    );
    startClanRefreshCron();

    const { startClanBackfillCron } = await import(
      "@unicum.gg/core/clans/backfill-cron"
    );
    startClanBackfillCron();

    const { startBoostWorkflowCron } = await import(
      "@unicum.gg/core/clans/boost-workflow/cron"
    );
    startBoostWorkflowCron();

    const { startDiscoveryCron } = await import("@unicum.gg/core/discovery/cron");
    startDiscoveryCron();

    const { startMomCron } = await import(
      "@unicum.gg/core/mom/refresh-cron"
    );
    startMomCron();

    const { startMoeCron } = await import("@unicum.gg/core/moe/refresh-cron");
    startMoeCron();

    const { startTopClansCron } = await import(
      "@unicum.gg/core/wargaming/wot/clans/top/cron"
    );
    startTopClansCron();

    const { startTopPlayersCron } = await import(
      "@unicum.gg/core/wargaming/wot/players/top/cron"
    );
    startTopPlayersCron();

    const { startTopPlayersByTankCron } = await import(
      "@unicum.gg/core/wargaming/wot/players/top/by-tank/cron"
    );
    startTopPlayersByTankCron();

    const { startLiveStreamersPoller } = await import(
      "@unicum.gg/core/twitch/live-poller"
    );
    startLiveStreamersPoller();
  } finally {
    globalThis.__dbContext = "request";
  }
}
