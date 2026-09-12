// Standalone cron worker. Runs the same loops the Next app used to boot from
// `instrumentation.ts`, but in a dedicated Node process so a slow WG region or
// a heavy cron tick never competes with request serving / RSC serialization on
// the web instances. Exactly one executor runs the crons at a time (they hold a
// DB lease), so the web service can set `RUN_CRONS=0` and this owns them.
//
// `WORKER_ROLE` splits that into two jobs, because they scale differently. The
// crons are a singleton by nature: a second copy of the changelog post or the
// server sampler is a bug, and the lease is what prevents it. The snapshot
// pipeline is the opposite: its queue is the players table itself, claimed FOR
// UPDATE SKIP LOCKED, so any number of processes can drain it safely. Node is
// single-threaded, so one process caps the pipeline at one core no matter how
// many workers run inside it — measured in production at 106% CPU with Postgres
// idle 85% of the time and the WG budget at 15%. Splitting the roles is what
// lets the pipeline scale past that ceiling.

export {};

declare global {
  // eslint-disable-next-line no-var
  var __dbContext: "request" | "background" | undefined;
}

enum WorkerRole {
  /** Crons (leader-gated) + the pipeline. The default, and the historical shape. */
  All = "all",
  /** The singleton crons only. Pair with one or more Pipeline processes. */
  Crons = "crons",
  /** The snapshot pipeline only, ungated. Runs no cron, so it needs no lease. */
  Pipeline = "pipeline",
}

function resolveRole(): WorkerRole {
  const raw = (process.env.WORKER_ROLE ?? WorkerRole.All).trim().toLowerCase();
  const match = Object.values(WorkerRole).find((role) => role === raw);
  if (!match) {
    // Fail loudly: a typo here would silently run the wrong half of the worker,
    // and the symptom (a cron that never fires, or a backlog that never drains)
    // would surface hours later somewhere else entirely.
    throw new Error(
      `[worker] unknown WORKER_ROLE "${raw}" — expected one of ${Object.values(WorkerRole).join(", ")}`,
    );
  }
  return match;
}

/** Every singleton job. Each one elects a leader internally, so only one of
 * these processes across the fleet actually executes a given tick. */
async function startCrons(): Promise<void> {
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

  const { startMomCron } = await import("@unicum.gg/core/mom/refresh-cron");
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

  const { startTournamentsCron } = await import("@unicum.gg/core/tournaments/cron");
  startTournamentsCron();

  const { startOnslaughtReconcileCron, startOnslaughtCrestCron } = await import(
    "@unicum.gg/core/wargaming/wot/players/onslaught-cron"
  );
  startOnslaughtReconcileCron();
  startOnslaughtCrestCron();

  const { startOnslaughtWatchdogCron } = await import(
    "@unicum.gg/core/wargaming/wot/players/onslaught-watchdog"
  );
  startOnslaughtWatchdogCron();
}

// WG egress rate meter. The proxy only sees opaque CONNECT tunnels, so the
// real per-region req/s (all consumers, vs the rate-limit budget) is only
// observable here, at the transport. Log it every 60s as requests/second.
// Per process: with the roles split, each one reports its own share.
async function startWgRateMeter(): Promise<void> {
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
}

async function main(): Promise<void> {
  // The worker is background-only: route every DB access to the background pool.
  globalThis.__dbContext = "background";

  const role = resolveRole();

  const { getInstanceId } = await import("@unicum.gg/core/cron/lease");
  console.log(`[worker] instance ${getInstanceId()} role=${role}`);

  const { installShutdownHandler } = await import("@unicum.gg/core/cron/shutdown");
  installShutdownHandler();

  if (role !== WorkerRole.Crons) {
    const { startSnapshotPipeline } = await import(
      "@unicum.gg/core/players/snapshot-pipeline"
    );
    // Only a pipeline-dedicated process may skip the lease: in the All role this
    // process also owns the crons, and those must stay a singleton.
    startSnapshotPipeline({ requireLease: role !== WorkerRole.Pipeline });
  }

  if (role !== WorkerRole.Pipeline) {
    await startCrons();
  }

  await startWgRateMeter();

  console.log(`[worker] started (role=${role})`);
}

main().catch((err) => {
  console.error("[worker] fatal boot error:", err);
  process.exit(1);
});
