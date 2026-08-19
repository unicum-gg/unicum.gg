import { PerfTrace, runWithTrace } from "@unicum.gg/core/lib/perf-trace";

/**
 * Run a route handler's body inside a `PerfTrace` scope and stamp the response
 * with a `Server-Timing` header. This is what was missing: the trace
 * infrastructure existed but nothing ever started a scope, so `traced()` spans
 * recorded nothing. With this, each response carries `total`, `cpu` and any span
 * timings, and one structured `{perf}` log line is emitted — so the per-request
 * CPU cost, the number that sets throughput, is finally observable in production
 * instead of excavated by hand during an incident.
 *
 * Wrap the handler body, not the `GET` export, so the exported
 * `export async function GET` signature stays intact for `next-openapi-gen`'s
 * detection (changing it to a `const` could drop the route from the spec/SDK).
 *
 * Read a response's cost with `curl -sD - <url> | grep -i server-timing` (or the
 * browser Network panel). Measure one request in isolation to read the true
 * per-render CPU (`process.cpuUsage` is process-wide; see PerfTrace).
 */
export async function measured(
  label: string,
  run: () => Promise<Response>,
): Promise<Response> {
  const trace = new PerfTrace(label);
  const res = await runWithTrace(trace, run);
  trace.endRender();
  const headers = new Headers(res.headers);
  headers.set("Server-Timing", trace.serverTiming());
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
