// Adding a version to the mod on wgmods.net, through the same two views its own
// edit page uses. A port of unicum.gg-mod's tools/publish_hub.py, which found
// every one of these the hard way: read its comments before changing a call.
import type { BrowserContext } from "playwright-core";
import { config } from "./config.js";
import { HUB, hubHeaders } from "./browser.js";

const OWNER = () => `${HUB}/api/mods/${config.modId}/owner/`;
const EDIT = () => `${HUB}/${config.modId}/edit/`;
const UPLOAD = `${HUB}/api/mods/mod_file_upload`;
// Not a nested route and not a write on the mod: a PATCH carrying `versions`
// answers 200 and adds nothing.
const VERSIONS = `${HUB}/api/mods/versions/`;
const COMMENTS = () => `${HUB}/api/mods/comments/?mod_id=${config.modId}`;
// How the hub numbers a version's review (MOD_VERSION_STATUS in its own bundle).
const VERSION_STATUS = ["in review", "published", "rejected"];
// The edit page carries the client versions it offers inside a JS string
// literal, where every quote is the six characters ".
const GAME_VERSIONS = /(?:\\u0022|")gameVersions(?:\\u0022|")\s*:\s*(\[.*?\])/s;

export type Release = {
  version: string;
  /** The mods folder the archive unpacks into, which picks the hub's client. */
  client: string;
  notes: string;
  archive: { name: string; bytes: Buffer };
};

async function json(context: BrowserContext, url: string): Promise<any> {
  const response = await context.request.get(url, {
    headers: await hubHeaders(context),
    failOnStatusCode: false,
  });
  if (response.status() !== 200) throw new Error(`${url}: HTTP ${response.status()}`);
  return response.json();
}

/** The hub's own id for a client version, read off the edit page. */
async function gameVersionId(context: BrowserContext, client: string): Promise<number> {
  const response = await context.request.get(EDIT(), { failOnStatusCode: false });
  if (response.status() !== 200) throw new Error(`${EDIT()}: HTTP ${response.status()}`);
  const found = GAME_VERSIONS.exec(await response.text());
  if (!found) throw new Error(`no gameVersions on ${EDIT()}`);
  const versions: { id: number; version: string }[] = JSON.parse(found[1].replaceAll("\\u0022", '"'));
  const match = versions.find((entry) => entry.version === client);
  if (!match) {
    const offered = versions.slice(0, 6).map((entry) => entry.version).join(", ");
    throw new Error(`the hub does not offer client ${client} yet; it offers ${offered}`);
  }
  return Number(match.id);
}

/** True when the hub already carries this version, published or in review. */
export async function hasVersion(context: BrowserContext, version: string): Promise<boolean> {
  const mod = await json(context, OWNER());
  return (mod.versions ?? []).some((entry: { version?: unknown }) => String(entry.version) === version);
}

/**
 * Where every version stands with the reviewers, and what they said. Only the
 * owner's view holds it: the public one lists what has already been accepted,
 * so a version waiting or refused looks exactly like one never sent.
 */
export async function reviewReport(context: BrowserContext): Promise<string[]> {
  const mod = await json(context, OWNER());
  const comments = await json(context, COMMENTS());
  const lines = [`mod state ${mod.state}, status ${mod.status}, owner fields: ${Object.keys(mod).join(", ")}`];
  for (const entry of mod.versions ?? []) {
    const review = VERSION_STATUS[entry.status] ?? `status ${entry.status}`;
    lines.push(`${entry.version}: ${review}, security ${entry.security_status}, client ${entry.game_version?.version}, created ${entry.created_at}, notes ${String(entry.change_log ?? "").length} chars`);
  }
  lines.push(`change log list: ${(mod.change_log ?? []).map((entry: { version?: unknown }) => entry.version).join(", ")}`);
  lines.push(`comments: ${JSON.stringify(comments).slice(0, 6000)}`);
  return lines;
}

/** Upload the archive and create the version. Wargaming reviews it before it shows. */
export async function addVersion(context: BrowserContext, release: Release): Promise<number> {
  const clientId = await gameVersionId(context, release.client);
  const headers = await hubHeaders(context);

  const uploaded = await context.request.post(UPLOAD, {
    headers,
    multipart: {
      source: { name: release.archive.name, mimeType: "application/zip", buffer: release.archive.bytes },
    },
    failOnStatusCode: false,
    timeout: 300_000,
  });
  if (![200, 201].includes(uploaded.status())) {
    throw new Error(`${UPLOAD}: HTTP ${uploaded.status()} ${(await uploaded.text()).slice(0, 400)}`);
  }
  const file = await uploaded.json();

  const created = await context.request.post(VERSIONS, {
    headers: { ...headers, "Content-Type": "application/json" },
    data: {
      mod: config.modId,
      game_version: clientId,
      version: release.version,
      is_visible: true,
      change_log: release.notes,
      temporary_version_file: file.id,
      temporary_version_file_access_token: file.access_token,
    },
    failOnStatusCode: false,
  });
  if (![200, 201].includes(created.status())) {
    throw new Error(`${VERSIONS}: HTTP ${created.status()} ${(await created.text()).slice(0, 600)}`);
  }
  const version = await created.json();

  // The hub's own form posts the notes nowhere, so they are checked rather
  // than trusted, and attached to the instance if they did not stick.
  if (release.notes && !String(version.change_log ?? "").trim()) {
    const instance = `${VERSIONS}${version.id}/`;
    const patched = await context.request.patch(instance, {
      headers: { ...headers, "Content-Type": "application/json" },
      data: { change_log: release.notes },
      failOnStatusCode: false,
    });
    if (![200, 202].includes(patched.status())) {
      throw new Error(`${instance}: HTTP ${patched.status()}`);
    }
  }
  return Number(version.id);
}
