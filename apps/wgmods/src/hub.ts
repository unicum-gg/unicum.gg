// Adding a version to the mod on wgmods.net, through the same two views its own
// edit page uses. A port of unicum.gg-mod's tools/publish_hub.py, which found
// every one of these the hard way: read its comments before changing a call.
import fs from "node:fs";
import path from "node:path";
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

export type ReleaseNotes = { version: string; body: string };

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

const REWRITE = new Set(["0.8.0", "0.7.1", "0.7.0", "0.6.0", "0.5.2", "0.5.1", "0.5.0", "0.4.0"]);

const newestFirst = (a: { version: string }, b: { version: string }) =>
  b.version.localeCompare(a.version, undefined, { numeric: true });

/** Everything on the mod a save must leave as it found it. */
function untouched(mod: any): string {
  return JSON.stringify({
    author: mod.author_name,
    status: mod.status,
    tags: mod.tags,
    screenshots: (mod.screenshots ?? []).map((entry: { source: string }) => entry.source),
    localizations: mod.localizations,
    versions: (mod.versions ?? []).map((entry: { id: number; status: number }) => [entry.id, entry.status]),
  });
}

/**
 * Add the releases missing from the mod's own change log, which is what its
 * page lists. A version's `change_log` does not reach that list: only saving
 * the whole mod does, so this sends what the edit page's Save sends, built from
 * the mod as it stands. Returns the versions added and whether anything else
 * on the mod moved, which is checked rather than assumed.
 */
export async function syncChangeLog(
  context: BrowserContext,
  releases: ReleaseNotes[],
): Promise<{ added: string[]; moved: boolean }> {
  const before = await json(context, OWNER());
  // A draft or a refused mod saves its version along with it, which this does not.
  if ([0, 2].includes(before.state)) throw new Error(`the mod is in state ${before.state}, not saved from here`);
  const listed = new Set((before.change_log ?? []).map((entry: { version: string }) => entry.version));
  const missing = releases.filter((release) => !listed.has(release.version));
  const rewritten = (before.change_log ?? []).map((entry: { version: string; body: string }) => {
    const release = releases.find((candidate) => candidate.version === entry.version);
    return release && REWRITE.has(entry.version) ? { ...entry, body: release.body } : entry;
  });
  const stale = rewritten.filter((entry: { body: string }, index: number) => entry.body !== before.change_log[index].body);
  if (!missing.length && !stale.length) return { added: [], moved: false };

  fs.writeFileSync(path.join(config.dataDir, `mod-before-${Date.now()}.json`), JSON.stringify(before));
  const saved = await context.request.put(`${HUB}/api/mods/${config.modId}/`, {
    headers: { ...(await hubHeaders(context)), "Content-Type": "application/json", "X-API-Version": "2" },
    data: {
      status: before.status,
      tags: before.tags,
      author_name: before.author_name || null,
      change_log: [...rewritten, ...missing.map((release) => ({ ...release, date: "" }))].sort(newestFirst),
      screenshots: (before.screenshots ?? []).map((entry: { id: number; source: string }, position: number) => ({
        screenshot: entry.id,
        source: entry.source,
        position,
      })),
      localizations: (before.localizations ?? []).map((entry: any) => ({
        lang: entry.lang.id,
        title: entry.title,
        description: entry.description,
        installation_guide: entry.installation_guide,
      })),
      versions: [],
    },
    failOnStatusCode: false,
  });
  if (saved.status() !== 200) throw new Error(`saving the mod: HTTP ${saved.status()} ${(await saved.text()).slice(0, 600)}`);

  const after = await json(context, OWNER());
  const now = new Set((after.change_log ?? []).map((entry: { version: string }) => entry.version));
  const lost = missing.filter((release) => !now.has(release.version)).map((release) => release.version);
  if (lost.length) throw new Error(`saved, but the change log still lacks ${lost.join(", ")}`);
  return {
    added: [...missing, ...stale].map((release: { version: string }) => release.version),
    moved: untouched(before) !== untouched(after) || before.state !== after.state,
  };
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
