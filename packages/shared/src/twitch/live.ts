import type { Region } from "@unicum.gg/wargaming";

/** One WoT account behind a live channel. */
export type LiveStreamerAccount = {
  region: Region;
  accountId: number;
};

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
  pr: number | null;
  wtr: number | null;
  wn730d: number | null;
  wn830d: number | null;
  wnx30d: number | null;
  twitchLogin: string;
  twitchUserName: string;
  title: string;
  viewerCount: number;
  startedAt: string;
  /** Stream language (ISO 639-1, from Twitch). */
  language: string;
  thumbnailUrl: string;
  /**
   * EVERY account linked to this channel, not just the one the card shows.
   *
   * The entry above is collapsed to one card per channel, so the fields beside
   * this describe whichever account won that collapse. Being live is a property
   * of the CHANNEL though, so a badge keyed on the representative alone left the
   * streamer's other pages without one: three accounts, one of them badged.
   * Carries the region per account, since a channel may link accounts on more
   * than one server and an account id alone does not say which.
   *
   * OPTIONAL on purpose. The snapshot is published by a single poller in the
   * worker and relayed over SSE, so the web can be serving this code while the
   * worker still publishes payloads from the previous one. Reading it as given
   * crashed the home page on exactly that skew, which is the normal deploy
   * order rather than an edge case: the two are separate services.
   */
  accounts?: LiveStreamerAccount[];
};
