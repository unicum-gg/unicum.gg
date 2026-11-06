// The release being published, read back from GitHub rather than trusted from
// the webhook: the request only names a tag, so a forged or replayed one can at
// worst ask for a release that already exists to be published again, which the
// hub check turns into a no-op.
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";
import type { Release } from "./hub.js";

const API = "https://api.github.com";
const ZIP = /^unicum\.gg_(\d+\.\d+\.\d+)\.zip$/;

/** release.yml signs the body as `sha256=<hex hmac>`, like GitHub's own webhooks. */
export function verifySignature(body: Buffer, header: string | undefined): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", config.webhookSecret).update(body).digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function get(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "unicum.gg-wgmods" },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

/** The folder a release zip unpacks the mod into, read from the zip's own index. */
function clientOf(zip: Buffer): string {
  // The central directory names every entry; the first `mods/<version>/` is it.
  const found = /mods\/(\d+(?:\.\d+){3})\//.exec(zip.toString("latin1"));
  if (!found) throw new Error("no mods/<version>/ inside the release zip");
  return found[1];
}

export async function readRelease(tag: string): Promise<Release> {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`not a release tag: ${tag}`);
  const release = (await (await get(`${API}/repos/${config.repository}/releases/tags/${tag}`)).json()) as {
    draft: boolean;
    body: string | null;
    assets: { name: string; browser_download_url: string }[];
  };
  if (release.draft) throw new Error(`${tag} is a draft`);
  const asset = release.assets.find((entry) => ZIP.test(entry.name));
  if (!asset) throw new Error(`${tag} carries no unicum.gg_<version>.zip`);
  const bytes = Buffer.from(await (await get(asset.browser_download_url)).arrayBuffer());
  return {
    version: tag.slice(1),
    client: clientOf(bytes),
    notes: String(release.body ?? "").trim(),
    archive: { name: asset.name, bytes },
  };
}
