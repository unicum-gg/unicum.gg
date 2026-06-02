declare global {
  var __cronStarted: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__cronStarted) return;
  globalThis.__cronStarted = true;

  const { getInstanceId } = await import("@/services/cron/lease");
  console.log(`[cron] instance ${getInstanceId()}`);

  const { startSnapshotCron } = await import("@/services/snapshots/cron");
  startSnapshotCron();

  const { startClanRefreshCron } = await import("@/services/clans/cron");
  startClanRefreshCron();

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
}
