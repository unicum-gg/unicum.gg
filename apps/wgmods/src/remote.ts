// The remote browser: the publisher's own Chromium window, shown through noVNC
// so a person can log in to Wargaming in it from anywhere, with no command.
//
// That window holds a live Wargaming session, so it is behind a secret: the
// link carries LOGIN_TOKEN once, which is swapped for an HttpOnly cookie, and
// every noVNC file and the VNC websocket itself check that cookie. x11vnc and
// websockify listen on loopback only (see the entrypoint), so this proxy is the
// one way in.
import { createHash, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import net from "node:net";
import path from "node:path";
import type { Duplex } from "node:stream";
import { config } from "./config.js";

const COOKIE = "wgmods_remote";
export const PREFIX = "/login";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

const digest = (value: string) => createHash("sha256").update(value).digest();

// The cookie holds a digest derived from the token rather than the token, so a
// cookie read off a disk is not the link.
const cookieValue = () => digest(`remote:${config.loginToken}`);

/** Compared as digests, so the comparison takes the same time at any length. */
const tokenMatches = (given: string | null) =>
  given !== null && timingSafeEqual(digest(given), digest(config.loginToken));

function authorised(request: IncomingMessage): boolean {
  const found = new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9a-f]{64})`).exec(request.headers.cookie ?? "");
  return found !== null && timingSafeEqual(Buffer.from(found[1], "hex"), cookieValue());
}

/**
 * GET /login?token=... sets the cookie and opens noVNC; anything under /login/
 * is noVNC's own files. Answers true when it handled the request.
 */
export function serveRemote(request: IncomingMessage, response: ServerResponse, onOpen: () => void): boolean {
  const url = new URL(request.url ?? "/", "http://local");
  if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) return false;

  if (url.pathname === PREFIX) {
    if (!tokenMatches(url.searchParams.get("token"))) {
      response.writeHead(403).end("forbidden");
      return true;
    }
    // Lax, not Strict: the link is opened from Discord, and a redirect keeps the
    // cross-site origin of the click that started it, so a Strict cookie set
    // here is withheld from the very page this redirects to.
    response.writeHead(302, {
      "Set-Cookie": `${COOKIE}=${cookieValue().toString("hex")}; Path=${PREFIX}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`,
      Location: `${PREFIX}/vnc.html?autoconnect=1&resize=scale&path=${PREFIX.slice(1)}/websockify`,
      "Cache-Control": "no-store",
    });
    response.end();
    onOpen();
    return true;
  }

  if (!authorised(request)) {
    response.writeHead(403).end("forbidden");
    return true;
  }
  const relative = path.normalize(url.pathname.slice(PREFIX.length + 1) || "vnc.html");
  const file = path.join(config.novncDir, relative);
  if (!file.startsWith(config.novncDir + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404).end("not found");
    return true;
  }
  response.writeHead(200, {
    "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(file).pipe(response);
  return true;
}

/** The VNC websocket, piped to websockify once the cookie checks out. */
export function upgradeRemote(request: IncomingMessage, socket: Duplex, head: Buffer): void {
  const url = new URL(request.url ?? "/", "http://local");
  if (url.pathname !== `${PREFIX}/websockify` || !authorised(request)) {
    socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    return;
  }
  const upstream = net.connect(config.websockifyPort, "127.0.0.1", () => {
    // Replay the handshake as received; websockify answers it itself.
    const lines = [`${request.method} /websockify HTTP/1.1`];
    for (let i = 0; i < request.rawHeaders.length; i += 2) {
      lines.push(`${request.rawHeaders[i]}: ${request.rawHeaders[i + 1]}`);
    }
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  const close = () => {
    upstream.destroy();
    socket.destroy();
  };
  upstream.on("error", close);
  socket.on("error", close);
}
