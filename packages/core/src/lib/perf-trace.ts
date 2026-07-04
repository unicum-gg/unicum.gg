import { AsyncLocalStorage } from "node:async_hooks";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

const LOG_FILE = join(process.cwd(), ".perf-trace.log");

type Span = { name: string; startMs: number; durationMs: number };

const storage = new AsyncLocalStorage<PerfTrace>();

export class PerfTrace {
  private spans: Span[] = [];
  private start: number;
  private inflight = 0;
  private renderDone = false;
  private flushed = false;

  constructor(public label: string) {
    this.start = performance.now();
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

  private maybeFlush(): void {
    if (this.flushed) return;
    if (!this.renderDone) return;
    if (this.inflight > 0) return;
    this.flushed = true;
    this.flush();
  }

  flush(): void {
    const total = performance.now() - this.start;
    const fmt = (n: number, w: number) =>
      n.toFixed(0).padStart(w);
    const lines = [...this.spans]
      .sort((a, b) => a.startMs - b.startMs)
      .map((s) =>
        `  ${fmt(s.startMs, 5)}ms  +${fmt(s.durationMs, 4)}ms  ${s.name}`,
      );
    const stamp = new Date().toISOString();
    const header = `[PERF] ${stamp} ${this.label} total=${total.toFixed(0)}ms`;
    const block = `${header}\n${lines.join("\n")}`;
    console.log(block);
    try {
      appendFileSync(LOG_FILE, `${block}\n\n`);
    } catch {
      // ignore log file errors
    }
  }

  log(line: string): void {
    console.log(`[PERF NOTE] ${line}`);
    try {
      appendFileSync(LOG_FILE, `[PERF NOTE] ${line}\n`);
    } catch {
      // ignore log file errors
    }
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
