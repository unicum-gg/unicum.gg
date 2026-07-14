import type { Region } from "@unicum.gg/wargaming";

/** A currently-live tracked streamer (client-safe shape). The Twitch polling +
 * enrichment live in core (`twitch`). */
export type LiveStreamer = {
  region: Region;
  accountId: number;
  nickname: string;
  clanTag: string | null;
  clanColor: string | null;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  wn730d: number | null;
  wn830d: number | null;
  wnx30d: number | null;
  twitchLogin: string;
  twitchUserName: string;
  title: string;
  viewerCount: number;
  startedAt: string;
  thumbnailUrl: string;
};
