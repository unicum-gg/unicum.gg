// The one browser the publisher owns, and the session that lives in it.
//
// Why a browser at all: wgmods has no API key. Its own pages drive a Django
// REST API with a `sessionid` cookie, and that cookie is minted by a Wargaming
// ID OpenID login. Measured on 2026-11-06 with a real login:
//
//   wgmods sessionid               24h, fixed: a request does not extend it
//   WG ID npprod_wgni_sessionid    14 days, renewed by every OpenID round trip
//   WG ID security token           14 days, NOT renewed, and required
//
// So the wgmods half is cheap to keep: with the WG ID cookies in the profile,
// /auth/login/<realm>/ comes back logged in with no password, headless or not.
// The WG ID half is what a person has to renew, about every two weeks, which is
// what /login (remote.ts) is for. Presenting the WG session without its
// security token logged that session out server-side when tested, so cookies
// are never edited here: the profile is only ever driven like a browser.
//
// Headed on the entrypoint's Xvfb rather than headless, so the very same window
// is what a person sees through noVNC when they log in.
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { config } from "./config.js";

export const HUB = "https://wgmods.net";
const SECURITY_TOKEN = "npprod_wgni_session_security_token";

let context: BrowserContext | undefined;
let queue: Promise<unknown> = Promise.resolve();

/**
 * Run `work` with the browser to itself. A keep-alive pass navigating while a
 * publish is uploading would pull the page out from under it.
 */
export function withBrowser<T>(work: (context: BrowserContext) => Promise<T>): Promise<T> {
  const run = queue.then(async () => work(await open()));
  queue = run.catch(() => undefined);
  return run;
}

async function open(): Promise<BrowserContext> {
  if (context) return context;
  context = await chromium.launchPersistentContext(path.join(config.dataDir, "profile"), {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ["--no-first-run", "--disable-dev-shm-usage", "--start-maximized"],
  });
  context.on("close", () => {
    context = undefined;
  });
  return context;
}

export async function page(context: BrowserContext): Promise<Page> {
  return context.pages()[0] ?? (await context.newPage());
}

/** The headers wgmods' views want: without X-Requested-With they answer 404. */
export async function hubHeaders(context: BrowserContext): Promise<Record<string, string>> {
  const csrf = (await context.cookies(HUB)).find((cookie) => cookie.name === "csrftoken")?.value;
  return {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "X-CSRFToken": csrf ?? "",
    Referer: `${HUB}/${config.modId}/edit/`,
  };
}

/** True when the owner's view of the mod answers, which only the owner gets. */
export async function loggedIn(context: BrowserContext): Promise<boolean> {
  const response = await context.request.get(`${HUB}/api/mods/${config.modId}/owner/`, {
    headers: await hubHeaders(context),
    failOnStatusCode: false,
  });
  return response.status() === 200;
}

/**
 * Logged in on wgmods, re-minting its 24h session from the WG ID one if that
 * is still alive. False means a person has to log in.
 */
export async function ensureLoggedIn(context: BrowserContext): Promise<boolean> {
  if (await loggedIn(context)) return true;
  const tab = await page(context);
  await tab.goto(`${HUB}/auth/login/${config.realm}/?next=/${config.modId}/`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  // The OpenID hop is an auto-submitting page ("OpenID transaction in
  // progress"), so the landing is waited for rather than the first load.
  await tab
    .waitForURL((url) => url.hostname === "wgmods.net" && !url.pathname.startsWith("/auth/"), {
      timeout: 60_000,
    })
    .catch(() => undefined);
  return loggedIn(context);
}

/** When the WG ID security token expires, in epoch seconds, if there is one. */
export async function securityTokenExpiry(context: BrowserContext): Promise<number | undefined> {
  const cookies = await context.cookies(`https://${config.realm}.wargaming.net/`);
  const token = cookies.find((cookie) => cookie.name === SECURITY_TOKEN);
  return token && token.expires > 0 ? token.expires : undefined;
}

/** Put the WG login in front of whoever opens the remote browser. */
export async function showLogin(context: BrowserContext): Promise<void> {
  const tab = await page(context);
  await tab.bringToFront();
  await tab.goto(`${HUB}/auth/login/${config.realm}/?next=/${config.modId}/`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
}
