// Publishes unicum.gg-mod's releases to wgmods.net with nobody at a keyboard.
//
// release.yml calls POST /publish once a GitHub release exists; this reads the
// release back from GitHub and adds it to the hub as the mod's owner, from a
// browser profile that stays logged in (browser.ts says how long that holds and
// why). When the session is gone the release is kept, a link to the remote
// browser is sent, and the release goes out as soon as somebody has logged in.
import http from "node:http";
import fs from "node:fs";
import { config } from "./config.js";
import { ensureLoggedIn, loggedIn, securityTokenExpiry, showLogin, withBrowser } from "./browser.js";
import { readAllNotes, readRelease, verifySignature } from "./github.js";
import { addVersion, hasVersion, reviewReport, syncChangeLog } from "./hub.js";
import { loginLink, notify } from "./notify.js";
import { serveRemote, upgradeRemote } from "./remote.js";
import { readState, updateState } from "./state.js";

// The wgmods session is a fixed 24h, so a pass every six hours re-mints it
// with three to spare.
const KEEPALIVE_MS = 6 * 60 * 60 * 1000;
// Warned this long before the WG ID security token runs out, which is the one
// thing only a person can renew.
const EXPIRY_WARNING_S = 48 * 60 * 60;
// How long a just-opened remote browser is watched for the login to land.
const LOGIN_WATCH_MS = 20 * 60 * 1000;

const log = (message: string) => console.log(`[wgmods] ${message}`);

async function publish(tag: string): Promise<void> {
  const outcome = await withBrowser(async (context) => {
    if (!(await ensureLoggedIn(context))) return "logged-out" as const;
    const release = await readRelease(tag);
    if (await hasVersion(context, release.version)) return "already" as const;
    const id = await addVersion(context, release);
    log(`${tag}: version ${id} created for client ${release.client}`);
    return "sent" as const;
  });
  if (outcome === "logged-out") {
    updateState((state) => {
      state.pending = tag;
    });
    await alertLoggedOut(`${tag} is waiting for it.`);
    return;
  }
  updateState((state) => {
    state.published = tag;
    if (state.pending === tag) delete state.pending;
  });
  await updateChangeLog();
  if (outcome === "sent") {
    await notify(`${tag} sent to wgmods; Wargaming reviews it before it shows on the hub.`);
  } else {
    log(`${tag} is already on the hub`);
  }
}

/** The mod's change log, brought up to the releases. A failure costs nothing else. */
async function updateChangeLog(): Promise<void> {
  try {
    const notes = await readAllNotes();
    const { added, moved } = await withBrowser((context) => syncChangeLog(context, notes));
    if (added.length) log(`change log: added ${added.join(", ")}`);
    if (moved) await notify(`Saving the wgmods change log (${added.join(", ")}) also changed something else on the mod. The previous state is kept in the data volume.`);
  } catch (error) {
    console.error("[wgmods] updating the change log failed", error);
  }
}

async function alertLoggedOut(detail = ""): Promise<void> {
  if (readState().alerted.loggedOut) return;
  updateState((state) => {
    state.alerted.loggedOut = true;
  });
  await notify(`The wgmods session has ended and only a Wargaming login can renew it. ${detail}\n${loginLink()}`);
}

async function keepAlive(): Promise<void> {
  const { ok, expiry } = await withBrowser(async (context) => ({
    ok: await ensureLoggedIn(context),
    expiry: await securityTokenExpiry(context),
  }));
  const state = readState();
  if (expiry !== undefined && state.tokenExpiry !== undefined && expiry > state.tokenExpiry + 60) {
    // Measured as NOT happening on a silent re-login; worth seeing if it does.
    log(`the WG ID security token moved from ${new Date(state.tokenExpiry * 1000).toISOString()} to ${new Date(expiry * 1000).toISOString()}`);
  }
  updateState((next) => {
    if (expiry !== undefined) next.tokenExpiry = expiry;
  });
  log(`session ${ok ? "alive" : "gone"}, WG ID token until ${expiry ? new Date(expiry * 1000).toISOString() : "none"}`);

  if (!ok) {
    await alertLoggedOut(state.pending ? `${state.pending} is waiting for it.` : "");
    return;
  }
  const left = expiry === undefined ? Infinity : expiry - Date.now() / 1000;
  if (left < EXPIRY_WARNING_S && !state.alerted.expiring) {
    updateState((next) => {
      next.alerted.expiring = true;
    });
    await notify(`The Wargaming login behind wgmods runs out in ${Math.max(0, Math.round(left / 3600))}h. Logging in again takes a minute:\n${loginLink()}`);
  }
  if (state.alerted.loggedOut || (left >= EXPIRY_WARNING_S && state.alerted.expiring)) {
    updateState((next) => {
      next.alerted = {};
    });
    if (state.alerted.loggedOut) await notify("wgmods is logged in again.");
  }
  // Said on every pass because nothing else does: the hub sends no notice when
  // a version is refused. A failed read must not cost the pass its publish.
  await withBrowser(reviewReport)
    .then((lines) => lines.forEach((line) => log(`hub: ${line}`)))
    .catch((error) => console.error("[wgmods] reading the review state failed", error));
  await updateChangeLog();
  if (state.pending) await publish(state.pending);
}

let watching: NodeJS.Timeout | undefined;

/** After the remote browser is opened, check often until the login lands. */
function watchLogin(): void {
  void withBrowser(showLogin).catch((error) => console.error("[wgmods] showing the login failed", error));
  clearInterval(watching);
  const until = Date.now() + LOGIN_WATCH_MS;
  watching = setInterval(() => {
    if (Date.now() > until) return clearInterval(watching);
    // Only asks: ensureLoggedIn navigates, which would reload the login page
    // under whoever is typing in it.
    void withBrowser(loggedIn)
      .then(async (ok) => {
        if (!ok) return;
        clearInterval(watching);
        await keepAlive();
      })
      .catch((error) => console.error("[wgmods] login check failed", error));
  }, 20_000);
}

function readBody(request: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 64 * 1024) request.destroy(new Error("body too large"));
      else chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    if (serveRemote(request, response, watchLogin)) return;
    const url = new URL(request.url ?? "/", "http://local");

    if (request.method === "POST" && url.pathname === "/publish") {
      const body = await readBody(request);
      if (!verifySignature(body, request.headers["x-signature-256"] as string | undefined)) {
        response.writeHead(401).end("bad signature");
        return;
      }
      const tag = String(JSON.parse(body.toString("utf8")).tag ?? "");
      if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
        response.writeHead(400).end("tag must be vX.Y.Z");
        return;
      }
      // Answered before the upload: the hub can take minutes, and the release
      // job has nothing to wait for. The outcome reaches Discord.
      response.writeHead(202).end(`publishing ${tag}`);
      publish(tag).catch(async (error) => {
        console.error(`[wgmods] ${tag} failed`, error);
        await notify(`${tag} could not be sent to wgmods: ${error instanceof Error ? error.message : error}`);
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const state = readState();
      response.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          loggedIn: !state.alerted.loggedOut,
          tokenExpiry: state.tokenExpiry ? new Date(state.tokenExpiry * 1000).toISOString() : null,
          pending: state.pending ?? null,
          published: state.published ?? null,
        }),
      );
      return;
    }
    response.writeHead(404).end("not found");
  } catch (error) {
    console.error("[wgmods] request failed", error);
    if (!response.headersSent) response.writeHead(500).end("error");
  }
});
server.on("upgrade", upgradeRemote);

fs.mkdirSync(config.dataDir, { recursive: true });
server.listen(config.port, () => log(`listening on ${config.port}`));

const pass = () => keepAlive().catch((error) => console.error("[wgmods] keep-alive failed", error));
void pass();
setInterval(pass, KEEPALIVE_MS);
