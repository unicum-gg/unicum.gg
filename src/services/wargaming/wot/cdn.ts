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

export function masteryBadgeUrl(region: Region, mark: number): string {
  return `https://${HOST[region]}/dcont/wot/current/achievement/big/markOfMastery${mark}.png`;
}
