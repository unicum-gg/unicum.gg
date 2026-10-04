import {
  APP_IDENTITY,
  BRAND_COLOR_INT,
  env,
  MAX_STARS,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { postChannelEmbedWithComponents } from "@unicum.gg/core/discord";

/**
 * What a moderator reads before a written opinion about a map goes live, and
 * the two buttons they answer with.
 *
 * Only the prose is on trial here. The stars were counted the moment they were
 * cast, and the author's record is on the card next to them precisely so the
 * question is the right one: not "is this verdict correct", which is nobody's
 * to settle, but "is this a real opinion from someone who plays the game, or is
 * it abuse".
 *
 * The card leads with the trailing thirty days rather than with the lifetime
 * count, which is the one place it reads differently from a vehicle card. A map
 * is reworked between updates, so "four hundred battles this month" says the
 * verdict is about the layout as it stands and "none since 2019" says it is
 * about a layout that no longer exists, and only the moderator can weigh that.
 */

/** `maprating:approve:<id>:<digest>` / `maprating:reject:<id>:<digest>`, read
 * back by the bot. Its own prefix rather than the vehicle one so a press routes
 * to the right queue endpoint, and deliberately not a prefix of it: a
 * `startsWith` test on the vehicle's `rating:` must not match these.
 *
 * The row id rides in the button rather than in memory so the buttons keep
 * working across a redeploy, which a component collector would not; the digest
 * rides with it so a card that outlived its text cannot publish the text that
 * replaced it. Well inside Discord's 100-character limit. */
export const MAP_RATING_REVIEW_PREFIX = "maprating";

export type MapRatingModerationCard = {
  /** `map_ratings` row id, which is what the button carries. */
  id: number;
  /** Fingerprint of the exact prose below, so pressing Publish publishes what
   * was read rather than whatever the row holds by then. */
  digest: string;
  mapName: string;
  mapSlug: string;
  region: Region;
  nickname: string;
  overall: number;
  fun: number;
  /** The author's own record. Account-level, because Wargaming publishes no
   * per-arena record for anyone to read. */
  battles: number | null;
  recentBattles: number | null;
  winrate: number | null;
  playerWn8: number | null;
  body: string;
};

/** Five characters rather than a number, so a moderator reads the verdict at a
 * glance instead of parsing it. */
function stars(value: number): string {
  return "★".repeat(value) + "☆".repeat(Math.max(0, MAX_STARS - value));
}

export async function postMapRatingModerationCard(
  card: MapRatingModerationCard,
): Promise<void> {
  if (!env.DISCORD_REVIEW_CHANNEL_ID) return;

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: "Overall", value: stars(card.overall), inline: true },
    { name: "Fun", value: stars(card.fun), inline: true },
  ];
  if (card.recentBattles != null) {
    fields.push({
      name: "Battles in 30 days",
      value: card.recentBattles.toLocaleString("en-US"),
      inline: true,
    });
  }
  if (card.battles != null) {
    fields.push({
      name: "Battles overall",
      value: card.battles.toLocaleString("en-US"),
      inline: true,
    });
  }
  if (card.winrate != null) {
    fields.push({
      name: "Their win rate",
      value: `${(card.winrate * 100).toFixed(1)}%`,
      inline: true,
    });
  }
  if (card.playerWn8 != null) {
    fields.push({
      name: "Account WN8",
      value: Math.round(card.playerWn8).toLocaleString("en-US"),
      inline: true,
    });
  }

  await postChannelEmbedWithComponents(
    env.DISCORD_REVIEW_CHANNEL_ID,
    {
      title: `${card.nickname} on ${card.mapName}`,
      url: `${APP_IDENTITY.URL}/${card.region}/maps/${card.mapSlug}/community`,
      // The prose is the whole point of the card, so it is the body rather than
      // a field: fields are truncated at 1024 and rendered cramped, and this is
      // the thing being read.
      description: card.body,
      color: BRAND_COLOR_INT,
      fields,
      footer: {
        text: `${APP_IDENTITY.NAME} · the stars are already counted, only this text is on hold`,
      },
    },
    [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: "Publish",
            custom_id: `${MAP_RATING_REVIEW_PREFIX}:approve:${card.id}:${card.digest}`,
          },
          {
            type: 2,
            style: 4,
            label: "Reject",
            custom_id: `${MAP_RATING_REVIEW_PREFIX}:reject:${card.id}:${card.digest}`,
          },
        ],
      },
    ],
  );
}
