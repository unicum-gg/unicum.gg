import http from "node:http";
import net from "node:net";

/**
 * A minimal HTTP CONNECT forward proxy that pins its egress source IP.
 *
 * Why this exists: our WG traffic must leave the host from specific
 * Wargaming-whitelisted source IPs, and each IP has its own G-Core per-IP rate
 * budget (see `@unicum.gg/wargaming` DEFAULT_WG_RPS). A process inside a Docker
 * bridge container cannot bind those public IPs (`EADDRNOTAVAIL`, and Docker's
 * SNAT rewrites the source anyway), so the binding has to happen on the host.
 *
 * One instance runs per egress IP, on the host network so the public IP is
 * actually present on an interface. Every CONNECT tunnel's upstream socket is
 * opened with `localAddress = EGRESS_IP`, so all traffic through this instance
 * exits from that IP. The app (worker/web) points an undici `ProxyAgent` at
 * `BIND_ADDR:PORT` and keeps calling `api.worldoftanks.*` normally. The tunnel
 * is transparent, so TLS stays end-to-end between the app and Wargaming.
 *
 * Security: on the host network, listening on 0.0.0.0 would expose an open proxy
 * on the public IP. So we listen only on BIND_ADDR (the private Docker bridge
 * gateway, e.g. 10.0.1.1), reachable from our containers but not the internet.
 */

const EGRESS_IP = process.env.EGRESS_IP;
const PORT = Number(process.env.PORT ?? 8080);
// Default to loopback rather than 0.0.0.0 so a misconfigured deploy fails closed
// (unreachable) instead of exposing an open proxy on the public IP.
const BIND_ADDR = process.env.BIND_ADDR ?? "127.0.0.1";

if (!EGRESS_IP) {
  console.error("[proxy] EGRESS_IP is required");
  process.exit(1);
}

// A G-Core block manifests as the upstream TCP connect hanging (not an error),
// so cap it and count it: a rising `timeouts` on one instance is our per-IP
// early warning that this egress IP is being throttled.
const UPSTREAM_TIMEOUT_MS = 30_000;
const HEARTBEAT_MS = 60_000;

// Rolling per-interval counters, flushed by the heartbeat. Per-request logging
// would flood at our WG volume, so we aggregate instead.
let tunnels = 0;
let errors = 0;
let timeouts = 0;

// Throttle the error/timeout warnings so a sustained block (which hits every
// request) can't drown the logs; the heartbeat carries the real totals.
let lastWarnAt = 0;
const warnSampled = (message: string) => {
  const now = Date.now();
  if (now - lastWarnAt > 5_000) {
    lastWarnAt = now;
    console.warn(message);
  }
};

const server = http.createServer((req, res) => {
  // This proxy only speaks CONNECT; a plain request is just the health check.
  const ok = req.url === "/" || req.url === "/health";
  res.writeHead(ok ? 200 : 404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok, egress: EGRESS_IP }));
});

server.on("connect", (req, clientSocket, head) => {
  const [host, portStr] = (req.url ?? "").split(":");
  const port = Number(portStr) || 443;
  if (!host) {
    clientSocket.destroy();
    return;
  }
  const upstream = net.connect({ host, port, localAddress: EGRESS_IP }, () => {
    tunnels += 1;
    upstream.setTimeout(0); // connected: drop the connect-phase watchdog
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head.length) upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  upstream.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
    timeouts += 1;
    warnSampled(`[proxy ${EGRESS_IP}] upstream timeout to ${host}:${port} (G-Core block?)`);
    upstream.destroy();
    clientSocket.destroy();
  });
  upstream.on("error", (err: NodeJS.ErrnoException) => {
    errors += 1;
    warnSampled(`[proxy ${EGRESS_IP}] upstream error ${err.code ?? err.message} to ${host}:${port}`);
    upstream.destroy();
    clientSocket.destroy();
  });
  clientSocket.on("error", () => {
    upstream.destroy();
    clientSocket.destroy();
  });
});

server.on("clientError", (_err, socket) => socket.destroy());

server.listen(PORT, BIND_ADDR, () => {
  console.log(`[proxy] CONNECT proxy listening on ${BIND_ADDR}:${PORT}, egress ${EGRESS_IP}`);
});

// Per-IP throughput + health heartbeat. Silent when idle to avoid noise; a
// non-zero `timeouts` is the signal that this egress IP is being blocked.
const heartbeat = setInterval(() => {
  if (tunnels || errors || timeouts) {
    console.log(
      `[proxy ${EGRESS_IP}] 60s: ${tunnels} tunnels, ${errors} errors, ${timeouts} timeouts`,
    );
    tunnels = 0;
    errors = 0;
    timeouts = 0;
  }
}, HEARTBEAT_MS);
heartbeat.unref();

const shutdown = () => {
  clearInterval(heartbeat);
  server.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
