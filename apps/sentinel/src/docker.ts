import { request } from "node:http";

/**
 * The little we need of the Docker API, over its unix socket.
 *
 * Written by hand rather than with a client library for the same reason the
 * whole app has no workspace dependency: the sentinel runs so it can act while
 * the rest of the stack is in trouble, and every dependency is one more thing
 * that can be the trouble. Two calls is not worth a package.
 */
const SOCKET = process.env.DOCKER_SOCKET ?? "/var/run/docker.sock";

function call(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request(
      { socketPath: SOCKET, path, method: "GET", timeout: 15_000 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    req.on("timeout", () => req.destroy(new Error("docker socket timeout")));
    req.on("error", reject);
    req.end();
  });
}

/**
 * The id of the running container whose name starts with `prefix`.
 *
 * Matched on a prefix because Coolify renames a container on every deploy: the
 * name is `<resource-uuid>-<timestamp>`, so the uuid is the stable half and
 * anything that pins the full name breaks at the next deployment.
 */
export async function findContainer(prefix: string): Promise<string | null> {
  const body = await call("/containers/json");
  const list = JSON.parse(body) as Array<{ Id: string; Names: string[] }>;
  const hit = list.find((c) =>
    c.Names.some((n) => n.replace(/^\//, "").startsWith(prefix)),
  );
  return hit?.Id ?? null;
}

/**
 * The container's log lines since `sinceEpochSeconds`.
 *
 * Docker multiplexes stdout and stderr into a framed stream when the container
 * has no TTY: each frame is an 8 byte header whose first byte is the stream and
 * whose last four are a big-endian length. Decoding it properly matters because
 * the naive read leaves those header bytes inside the text, which turns a line
 * the caller is pattern matching on into a line that silently never matches.
 */
export async function containerLogs(
  id: string,
  sinceEpochSeconds: number,
): Promise<string[]> {
  const raw = await call(
    `/containers/${id}/logs?stdout=1&stderr=1&timestamps=0&since=${sinceEpochSeconds}`,
  );
  const buf = Buffer.from(raw, "binary");
  const out: string[] = [];
  let i = 0;
  while (i + 8 <= buf.length) {
    const stream = buf[i];
    // A frame header always starts with 0, 1 or 2 (stdin/stdout/stderr) and has
    // three zero bytes after it. Anything else means this stream is not framed
    // (a TTY container), so fall back to reading the rest as plain text.
    if (stream > 2 || buf[i + 1] !== 0 || buf[i + 2] !== 0 || buf[i + 3] !== 0) {
      return buf.subarray(i).toString("utf8").split("\n").filter(Boolean);
    }
    const len = buf.readUInt32BE(i + 4);
    out.push(buf.subarray(i + 8, i + 8 + len).toString("utf8"));
    i += 8 + len;
  }
  return out.join("").split("\n").filter(Boolean);
}

/**
 * How long the container has been running, in seconds.
 *
 * Needed because a freshly started web process stalls while it warms up: the
 * four stalls seen on a container thirty minutes old were all of that kind,
 * their rss climbing from 523 to 1486 MiB as caches filled. Those look exactly
 * like the distress this watches for, so without this a deployment would turn
 * the challenge on every time, which is both useless and the worst moment for
 * it: the site is already slow and now every reader meets a checkbox too.
 */
export async function containerAgeSeconds(id: string): Promise<number> {
  const body = await call(`/containers/${id}/json`);
  const info = JSON.parse(body) as { State?: { StartedAt?: string } };
  const started = info.State?.StartedAt;
  if (!started) return Number.POSITIVE_INFINITY;
  const ms = Date.now() - new Date(started).getTime();
  return Number.isFinite(ms) ? ms / 1000 : Number.POSITIVE_INFINITY;
}
