declare global {
  var __cronStarted: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__cronStarted) return;
  globalThis.__cronStarted = true;

  const { startSnapshotCron } = await import("@/services/snapshots/cron");
  startSnapshotCron();
}
