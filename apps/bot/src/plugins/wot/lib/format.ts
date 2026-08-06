import { APP_IDENTITY, RATING_COLOR_HEX, wnxColor } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/** Link to a player's profile on the site. */
export const playerUrl = (region: Region, nickname: string): string =>
  `${APP_IDENTITY.URL}/${region}/players/${encodeURIComponent(nickname)}`;

/** Link to a clan's page on the site. */
export const clanUrl = (region: Region, tag: string): string =>
  `${APP_IDENTITY.URL}/${region}/clans/${encodeURIComponent(tag)}`;

/** Link to a tank's page on the site. */
export const tankUrl = (region: Region, slug: string): string =>
  `${APP_IDENTITY.URL}/${region}/tanks/${encodeURIComponent(slug)}`;

/** Link to a battle map's page on the site. */
export const mapUrl = (region: Region, slug: string): string =>
  `${APP_IDENTITY.URL}/${region}/maps/${encodeURIComponent(slug)}`;

/** The WNX rating-tier colour as a Discord embed integer (matches the site). */
export const wnxColorInt = (wnx: number | null): number =>
  parseInt(RATING_COLOR_HEX[wnxColor(wnx ?? 0)].slice(1), 16);
