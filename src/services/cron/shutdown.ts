import cron from "node-cron";

/**
 * Graceful shutdown: on SIGTERM/SIGINT, stop all cron schedulers so no new
 * ticks fire while Next.js drains in-flight HTTP requests (SSE streams included),
 * then drain the postgres pools so no idle backend outlives the container.
 * In-flight cron drains keep running until completion; the platform's drain
 * timeout (systemd TimeoutStopSec, 10-30s recommended) is the upper bound.
 *
 * Lives in its own file so it only ships to the Node runtime — the Edge
 * compiler chokes on `process.once`.
 */
export function installShutdownHandler() {
  if ((globalThis as { __shutdownInstalled?: boolean }).__shutdownInstalled) {
    return;
  }
  (globalThis as { __shutdownInstalled?: boolean }).__shutdownInstalled = true;

  const shutdown = async (signal: string) => {
    console.log(`[shutdown] ${signal} received, stopping crons`);
    try {
      for (const task of cron.getTasks().values()) task.stop();
    } catch (err) {
      console.error("[shutdown] failed to stop crons:", err);
    }
    try {
      const { closeDbPools } = await import("@/services/db");
      await closeDbPools();
      console.log("[shutdown] db pools drained");
    } catch (err) {
      console.error("[shutdown] failed to drain db pools:", err);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}
