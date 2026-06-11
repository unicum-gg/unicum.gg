import { Region } from ".";

// Per-region wgcdn portal hosts. EU and NA follow `<region>-wotp`; ASIA is
// served from Singapore via `sg-wotp`. All three host the same assets.
const HOST: Record<Region, string> = {
  [Region.EU]: "eu-wotp.wgcdn.co",
  [Region.NA]: "na-wotp.wgcdn.co",
  [Region.ASIA]: "sg-wotp.wgcdn.co",
};

export function wgCdnHost(region: Region): string {
  return HOST[region];
}

export function tankIconUrl(region: Region, tag: string): string {
  const slug = tag.toLowerCase();
  return `https://${HOST[region]}/dcont/tankopedia_images/${slug}/${slug}_icon.svg`;
}

// Per-type generic silhouettes WG ships in the tankopedia static bundle.
// Used as a fallback when the per-tank `_icon.svg` 404s (rare: some
// removed/event tanks don't have a dedicated icon published).
const STATIC_VERSION = "6.15.1_aca52e";
const STATIC_DEFAULT_SLUG: Record<string, string> = {
  heavyTank: "heavy",
  mediumTank: "medium",
  lightTank: "light",
  "AT-SPG": "at-spg",
  SPG: "spg",
};

export function defaultTankIconUrl(region: Region, type: string): string {
  const slug = STATIC_DEFAULT_SLUG[type];
  if (!slug) return tankIconUrl(region, "");
  return `https://${HOST[region]}/static/${STATIC_VERSION}/wotp_static/img/tankopedia_new/frontend/scss/tankopedia-detail/img/tanks/default_${slug}_icon.svg`;
}

export function masteryBadgeUrl(region: Region, mark: number): string {
  return `https://${HOST[region]}/dcont/wot/current/achievement/big/markOfMastery${mark}.png`;
}
