import { Region } from "./region";

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

// The portal's shared "common component icons" bundle (nation flags, rank
// badges, filter strips). `latest` survives client version bumps; the filter
// sprites only exist under a pinned build, hence the version parameter.
function iconsImgBase(region: Region, version: string): string {
  return `https://${HOST[region]}/static/${version}/wotp_static/img/core/frontend/scss/common/components/icons/img`;
}

// Nation flag, flat 29x18 filter strip. Served from the pinned static bundle.
export function nationFilterFlagUrl(region: Region, nation: string): string {
  return `${iconsImgBase(region, STATIC_VERSION)}/filter-${nation}.png`;
}

// Nation flag, larger waving emblem used on the tank hero.
export function nationWavingFlagUrl(region: Region, nation: string): string {
  return `${iconsImgBase(region, "latest")}/flags/${nation}_small.png`;
}

// A file in the portal icon bundle under `latest` (e.g. the rank_0x mastery
// badges the tanks tables show).
export function portalIconUrl(region: Region, file: string): string {
  return `${iconsImgBase(region, "latest")}/${file}`;
}

// The tankopedia hangar-floor backdrop. `jpg` for Satori (no WebP decode),
// `webp` for the browser hero.
export function hangarBgUrl(region: Region, ext: "jpg" | "webp" = "jpg"): string {
  return `https://${HOST[region]}/static/latest/wotp_static/img/tankopedia_new/frontend/scss/tankopedia-detail/img/hangar-bg.${ext}`;
}

// The high-res tankopedia vehicle render (1920x900), keyed by tag.
export function tankopediaImageUrl(region: Region, tag: string): string {
  const slug = tag.toLowerCase();
  return `https://${HOST[region]}/dcont/tankopedia_images/${slug}/${slug}_image.png`;
}

// The home hero's promo video/poster bundle, pinned to the build these assets
// shipped in (they are not published under `latest`).
const PROMO_VERSION = "6.10.0_4edfb4";
export function promoVideoAssetUrl(region: Region, file: string): string {
  return `https://${HOST[region]}/static/${PROMO_VERSION}/wotp_static/img/core/frontend/scss/common/blocks/video-bg/img/${file}`;
}
