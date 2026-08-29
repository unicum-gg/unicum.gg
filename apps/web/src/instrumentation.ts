declare global {
  var __cronStarted: boolean | undefined;
  var __dbContext: "request" | "background" | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Observe event-loop stalls on every node instance (before the RUN_CRONS
  // early-return, so RUN_CRONS=0 web instances are covered too). Diagnostic
  // only: it logs the worst stall per window, no behaviour change. See the
  // module for why this is caught in prod rather than fixed blind.
  const { startEventLoopLagMonitor } = await import("@/lib/event-loop-lag");
  startEventLoopLagMonitor();
  // A dedicated cron worker runs the loops; web instances set RUN_CRONS=0 so
  // they never do cron work on the request-serving thread (the crons still hold
  // a DB lease, so at most one instance ever executes them). Leaving it unset
  // keeps the legacy single-process behaviour where crons run here.
  //
  // `installShutdownHandler` (below) is deliberately NOT hoisted above this
  // return, even though that means a RUN_CRONS=0 web never drains its pools on
  // SIGTERM. It was tried and measured: Next's own signal handler
  // (`server/lib/start-server.js`) races ours and calls `process.exit(143)` as
  // soon as it has closed the HTTP server, so the async `closeDbPools()` never
  // finishes, and the only way to win that race is `NEXT_MANUAL_SIG_HANDLE`,
  // which would hand us a shutdown with no access to the HTTP server to close.
  // It buys nothing anyway: exiting closes the sockets, so Postgres reaps those
  // backends at once (verified on a killed standalone server, zero backends
  // left behind). The drain still matters in `apps/worker`, which owns its own
  // process and where it does run to completion.
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

    const { startClanStrongholdCron } = await import(
      "@unicum.gg/core/clans/stronghold-cron"
    );
    startClanStrongholdCron();

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

    const { startTankRatingsCron } = await import(
      "@unicum.gg/core/tanks/ratings-aggregate"
    );
    startTankRatingsCron();

    const { startCoverageTrendsCron } = await import(
      "@unicum.gg/core/coverage/trends-aggregate"
    );
    startCoverageTrendsCron();
  } finally {
    globalThis.__dbContext = "request";
  }
}
