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

  const { startPlayerBackfillCron } = await import(
    "@unicum.gg/core/players/backfill-cron"
  );
  startPlayerBackfillCron();

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

  console.log("[worker] all crons scheduled");
}

main().catch((err) => {
  console.error("[worker] fatal boot error:", err);
  process.exit(1);
});
