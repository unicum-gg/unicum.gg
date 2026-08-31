// Standalone cron worker. Runs the same loops the Next app used to boot from
// `instrumentation.ts`, but in a dedicated Node process so a slow WG region or
// a heavy cron tick never competes with request serving / RSC serialization on
// the web instances. Exactly one executor runs the crons at a time (they hold a
// DB lease), so the web service can set `RUN_CRONS=0` and this owns them.

export {};

declare global {
  // eslint-disable-next-line no-var
  var __dbContext: "request" | "background" | undefined;
}

async function main(): Promise<void> {
  // The worker is background-only: route every DB access to the background pool.
  globalThis.__dbContext = "background";

  const { getInstanceId } = await import("@unicum.gg/core/cron/lease");
  console.log(`[worker] instance ${getInstanceId()}`);

  const { installShutdownHandler } = await import("@unicum.gg/core/cron/shutdown");
  installShutdownHandler();

  const { startSnapshotPipeline } = await import(
    "@unicum.gg/core/players/snapshot-pipeline"
  );
  startSnapshotPipeline();

  const { startPlayerRefreshCron } = await import(
    "@unicum.gg/core/players/refresh-cron"
  );
  startPlayerRefreshCron();

  const { startClanRefreshCron } = await import("@unicum.gg/core/clans/refresh-cron");
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

  const { startStreamerReconcileCron } = await import(
    "@unicum.gg/core/twitch/reconcile-cron"
  );
  startStreamerReconcileCron();

  const { startChangelogCron } = await import("@unicum.gg/core/changelog/cron");
  startChangelogCron();

  const { startTankWarmCron } = await import(
    "@unicum.gg/core/wargaming/wot/tanks/warm-cron"
  );
  startTankWarmCron();

  const { startTankRatingsCron } = await import(
    "@unicum.gg/core/tanks/ratings-aggregate"
  );
  startTankRatingsCron();

  const { startCoverageTrendsCron } = await import(
    "@unicum.gg/core/coverage/trends-aggregate"
  );
  startCoverageTrendsCron();

  const { startServerOnlineCron } = await import(
    "@unicum.gg/core/wargaming/wot/server/sample-cron"
  );
  startServerOnlineCron();

  const { startPlayerDistributionCron } = await import(
    "@unicum.gg/core/players/distribution"
  );
  startPlayerDistributionCron();

  // WG egress rate meter. The proxy only sees opaque CONNECT tunnels, so the
  // real per-region req/s (all consumers, vs the rate-limit budget) is only
  // observable here, at the transport. Log it every 60s as requests/second.
  const { drainWgRequestCounts } = await import("@unicum.gg/wargaming");
  setInterval(() => {
    const counts = drainWgRequestCounts();
    const entries = Object.entries(counts).filter(([, n]) => n > 0);
    if (entries.length === 0) return;
    const parts = entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, n]) => `${key}=${(n / 60).toFixed(1)}/s`);
    console.log(`[wg-rate] last 60s: ${parts.join(" ")}`);
  }, 60_000).unref();

  console.log("[worker] all crons scheduled");
}

main().catch((err) => {
  console.error("[worker] fatal boot error:", err);
  process.exit(1);
});
