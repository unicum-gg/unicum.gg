declare global {
  var __cronStarted: boolean | undefined;
  var __shutdownInstalled: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__cronStarted) return;
  globalThis.__cronStarted = true;

  const { getInstanceId } = await import("@/services/cron/lease");
  console.log(`[cron] instance ${getInstanceId()}`);

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
}

/**
 * Graceful shutdown: on SIGTERM/SIGINT, stop all cron schedulers so no new
 * ticks fire while Next.js drains in-flight HTTP requests (SSE streams included).
 * In-flight cron drains keep running until completion; the platform's drain
 * timeout (systemd TimeoutStopSec, 10-30s recommended) is the upper bound.
 */
function installShutdownHandler() {
  if (globalThis.__shutdownInstalled) return;
  globalThis.__shutdownInstalled = true;

  const shutdown = async (signal: string) => {
    console.log(`[shutdown] ${signal} received, stopping crons`);
    try {
      const cron = (await import("node-cron")).default;
      for (const task of cron.getTasks().values()) task.stop();
    } catch (err) {
      console.error("[shutdown] failed to stop crons:", err);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}
