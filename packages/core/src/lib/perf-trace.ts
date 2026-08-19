import { AsyncLocalStorage } from "node:async_hooks";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

const LOG_FILE = join(process.cwd(), ".perf-trace.log");

type Span = { name: string; startMs: number; durationMs: number };

const storage = new AsyncLocalStorage<PerfTrace>();

/**
 * Per-request performance trace. Records wall-clock spans AND the request's
 * main-thread CPU cost (`process.cpuUsage`), the number that actually determines
 * throughput: a single Node process renders on one thread, so its ceiling is
 * `1000 / cpuMsPerRequest` renders/sec per core. Latency alone hides this (it
 * counts async DB wait as if it were free), which is why we track both.
 *
 * A trace only records inside a `runWithTrace` scope (see `withPerf`); outside
 * one, `traced()` is a no-op, so an un-instrumented path costs nothing.
 *
 * CPU is `process.cpuUsage()` — process-wide, so under concurrency a request's
 * reading includes CPU spent on other in-flight requests. It is therefore an
 * upper bound in production and exact only when the request is measured in
 * isolation (one request at a time), which is how the per-render figure for the
 * capacity math should be taken.
 */
export class PerfTrace {
  private spans: Span[] = [];
  private start: number;
  private cpuStart: NodeJS.CpuUsage;
  private inflight = 0;
  private renderDone = false;
  private flushed = false;

  constructor(public label: string) {
    this.start = performance.now();
    this.cpuStart = process.cpuUsage();
  }

  async span<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const t0 = performance.now();
    this.inflight += 1;
    try {
      return await fn();
    } finally {
      this.spans.push({
        name,
        startMs: t0 - this.start,
        durationMs: performance.now() - t0,
      });
      this.inflight -= 1;
      this.maybeFlush();
    }
  }

  endRender(): void {
    this.renderDone = true;
    this.maybeFlush();
  }

  /** Record a span for a synchronous section (main-thread CPU); `startMs` is a
   * `performance.now()` captured before the work. See `tracedSync`. */
  recordSync(name: string, startMs: number): void {
    this.spans.push({
      name,
      startMs: startMs - this.start,
      durationMs: performance.now() - startMs,
    });
  }

  /** Wall-clock duration since the trace started. */
  totalMs(): number {
    return performance.now() - this.start;
  }

  /** Main-thread CPU (user + system) consumed since the trace started, in ms. */
  cpuMs(): number {
    const d = process.cpuUsage(this.cpuStart);
    return (d.user + d.system) / 1000;
  }

  /**
   * `Server-Timing` header value: `total` and `cpu` durations plus one entry per
   * recorded span (indexed name `s0,s1,…` with the real name in `desc`, since a
   * Server-Timing metric name must be a bare token). Visible per response in the
   * browser Network panel or `curl -sD -`.
   */
  serverTiming(): string {
    const parts = [
      `total;dur=${this.totalMs().toFixed(1)}`,
      `cpu;dur=${this.cpuMs().toFixed(1)}`,
    ];
    this.spans.forEach((s, i) => {
      const desc = s.name.replace(/[\\"]/g, "");
      parts.push(`s${i};dur=${s.durationMs.toFixed(1)};desc="${desc}"`);
    });
    return parts.join(", ");
  }

  private maybeFlush(): void {
    if (this.flushed) return;
    if (!this.renderDone) return;
    if (this.inflight > 0) return;
    this.flush();
  }

  /**
   * Emit the trace. In production: a single structured JSON line to stdout (the
   * platform log pipeline captures it, and it can be shipped/aggregated) — cheap
   * enough for the hot path, with no per-request file I/O. In development: also a
   * human-readable block appended to `.perf-trace.log` for local inspection.
   */
  flush(): void {
    if (this.flushed) return;
    this.flushed = true;
    const totalMs = Math.round(this.totalMs());
    const cpuMs = Math.round(this.cpuMs());
    const spans = [...this.spans]
      .sort((a, b) => a.startMs - b.startMs)
      .map((s) => ({ name: s.name, dur: Math.round(s.durationMs) }));

    console.log(
      JSON.stringify({ perf: { label: this.label, totalMs, cpuMs, spans } }),
    );

    if (process.env.NODE_ENV !== "production") {
      const fmt = (n: number, w: number) => n.toFixed(0).padStart(w);
      const lines = spans.map(
        (s) => `  +${fmt(s.dur, 4)}ms  ${s.name}`,
      );
      const stamp = new Date().toISOString();
      const header = `[PERF] ${stamp} ${this.label} total=${totalMs}ms cpu=${cpuMs}ms`;
      const block = `${header}\n${lines.join("\n")}`;
      try {
        appendFileSync(LOG_FILE, `${block}\n\n`);
      } catch {
        // ignore log file errors
      }
    }
  }

  log(line: string): void {
    console.log(`[PERF NOTE] ${line}`);
  }
}

export function runWithTrace<T>(
  trace: PerfTrace,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(trace, fn);
}

export function currentTrace(): PerfTrace | undefined {
  return storage.getStore();
}

export async function traced<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const trace = currentTrace();
  if (!trace) return fn();
  return trace.span(name, fn);
}

/** Time a synchronous section and record it as a span (a no-op outside a trace
 * scope). Use for CPU-bound work (transforms, serialization) where wall time
 * equals main-thread CPU. */
export function tracedSync<T>(name: string, fn: () => T): T {
  const trace = currentTrace();
  if (!trace) return fn();
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    trace.recordSync(name, t0);
  }
}
