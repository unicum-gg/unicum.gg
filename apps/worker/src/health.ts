// The worker's one HTTP surface: a liveness endpoint something OUTSIDE this
// host can probe (Checkmate, on status.unicum.gg, which does not run here).
//
// It exists because every other liveness signal about this process was green
// through a 14h10 outage on 2026-10-24, and each one was honestly green. Coolify
// had the container running, because it never crashed. The process was alive,
// because it kept ticking. The web answered 200, because the web was fine. What
// had happened is that the container's /etc/hosts pinned Postgres and Redis onto
// its own loopback, so every cron tick failed on the `cron_leader` lease, which
// means the two watchdogs written to announce exactly this were among the jobs
// that never ran.
//
// So this endpoint deliberately does NOT answer "am I running". It asserts the
// dependencies, which is the part that broke, and reads the scheduler's own
// heartbeat, which is the part no dependency check would catch (a cron loop can
// be wedged with Postgres perfectly reachable). A plain 200/503 carries the
// verdict so it needs no feature of whatever is probing it.

import { createServer, type Server } from "node:http";

/** No beat for this long is a dead cron loop: the fastest job ticks every 10s. */
const STALE_BEAT_MS = 5 * 60 * 1000;

/**
 * A process this young is starting, not failing. Same reasoning as the
 * sentinel's ten-minute skip on a fresh web container: a warm-up looks identical
 * to distress, and raising the alarm during a deployment is the worst moment.
 */
const BOOT_GRACE_MS = 2 * 60 * 1000;

/** A probe result is reused for this long, so hammering the endpoint cannot
 * turn into unbounded queries on the background pool. Checkmate asks once a
 * minute at most, so nothing legitimate ever reads a stale answer. */
const PROBE_CACHE_MS = 5 * 1000;

/** Past this, a dependency counts as unreachable. The Redis client carries its
 * own 2s command timeout; Postgres has none, so the race is what bounds it. */
const PROBE_TIMEOUT_MS = 2 * 1000;

enum CheckState {
  Ok = "ok",
  Failed = "failed",
  /** Not configured in this environment, so not a verdict. Local dev has no
   * Redis, and reporting that as a failure would make the endpoint useless
   * exactly where a person is reading it by hand. */
  Skipped = "skipped",
}

type HealthReport = {
  status: "ok" | "degraded";
  checks: { postgres: CheckState; redis: CheckState; cronLoop: CheckState };
  lastBeatAgoMs: number | null;
  lastCompleted: { name: string; agoMs: number } | null;
  ticks: { completed: number; failed: number };
  uptimeMs: number;
};

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("probe timed out")),
          PROBE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function probePostgres(): Promise<CheckState> {
  try {
    const { pgClient } = await import("@unicum.gg/core/db");
    await withTimeout(pgClient`SELECT 1`);
    return CheckState.Ok;
  } catch (err) {
    console.error("[health] postgres unreachable:", (err as Error).message);
    return CheckState.Failed;
  }
}

async function probeRedis(): Promise<CheckState> {
  try {
    const { getRedisClient } = await import("@unicum.gg/core/redis");
    const client = getRedisClient();
    if (!client) return CheckState.Skipped;
    await withTimeout(client.ping());
    return CheckState.Ok;
  } catch (err) {
    console.error("[health] redis unreachable:", (err as Error).message);
    return CheckState.Failed;
  }
}

async function buildReport(): Promise<HealthReport> {
  const { readCronHeartbeat } = await import("@unicum.gg/core/cron/heartbeat");
  const beat = readCronHeartbeat();
  const now = Date.now();
  const uptimeMs = Math.round(process.uptime() * 1000);

  const [postgres, redis] = await Promise.all([probePostgres(), probeRedis()]);

  const lastBeatAgoMs =
    beat.lastBeatAt === null ? null : now - beat.lastBeatAt;
  const cronLoop =
    lastBeatAgoMs === null
      ? uptimeMs < BOOT_GRACE_MS
        ? CheckState.Ok
        : CheckState.Failed
      : lastBeatAgoMs < STALE_BEAT_MS
        ? CheckState.Ok
        : CheckState.Failed;

  const checks = { postgres, redis, cronLoop };
  const degraded = Object.values(checks).includes(CheckState.Failed);

  return {
    status: degraded ? "degraded" : "ok",
    checks,
    lastBeatAgoMs,
    lastCompleted:
      beat.lastCompletedAt === null || beat.lastCompletedName === null
        ? null
        : {
            name: beat.lastCompletedName,
            agoMs: now - beat.lastCompletedAt,
          },
    ticks: { completed: beat.completed, failed: beat.failed },
    uptimeMs,
  };
}

let cached: { at: number; report: HealthReport } | null = null;
let inFlight: Promise<HealthReport> | null = null;

async function getReport(): Promise<HealthReport> {
  if (cached && Date.now() - cached.at < PROBE_CACHE_MS) return cached.report;
  // Collapse concurrent probes onto one, so a burst costs a single round trip
  // to each dependency rather than one per request.
  inFlight ??= buildReport().finally(() => {
    inFlight = null;
  });
  const report = await inFlight;
  cached = { at: Date.now(), report };
  return report;
}

/**
 * Bind the health endpoint. Returns null when it is not wanted (see the call
 * site) so the caller can log the decision rather than guess at it.
 *
 * Every failure here is swallowed on purpose. A monitoring surface must never be
 * able to take down the thing it reports on, so a port already in use logs
 * loudly and the worker carries on doing its job unmonitored.
 */
export function startHealthServer(port: number): Server | null {
  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path !== "/" && path !== "/health") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end('{"status":"not_found"}');
      return;
    }
    void getReport()
      .then((report) => {
        res.writeHead(report.status === "ok" ? 200 : 503, {
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        res.end(JSON.stringify(report));
      })
      .catch((err: unknown) => {
        console.error("[health] report failed:", err);
        res.writeHead(503, { "content-type": "application/json" });
        res.end('{"status":"degraded"}');
      });
  });

  server.on("error", (err) => {
    console.error("[health] server error, continuing unmonitored:", err);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[health] listening on 0.0.0.0:${port}`);
  });

  // Never hold the process open on this alone.
  server.unref();
  return server;
}
