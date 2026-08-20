import {
  APP_IDENTITY,
  BRAND_COLOR_INT,
  env,
  MAX_STARS,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { postChannelEmbedWithComponents } from "@unicum.gg/core/discord";

/**
 * What a moderator reads before a written opinion goes live, and the two
 * buttons they answer with.
 *
 * Only the prose is on trial here. The stars were counted the moment they were
 * cast, and the author's record is on the card next to them precisely so the
 * question is the right one: not "is this verdict correct", which is nobody's
 * to settle, but "is this a real opinion from someone who plays the tank, or is
 * it abuse".
 */

/** `rating:approve:<id>:<digest>` / `rating:reject:<id>:<digest>`, read back by
 * the bot. The row id rides in the button rather than in memory so the buttons
 * keep working across a redeploy, which a component collector would not; the
 * digest rides with it so a card that outlived its text cannot publish the text
 * that replaced it. Well inside Discord's 100-character limit. */
export const RATING_REVIEW_PREFIX = "rating";

export type RatingModerationCard = {
  /** `tank_ratings` row id, which is what the button carries. */
  id: number;
  /** Fingerprint of the exact prose below, so pressing Approve publishes what
   * was read rather than whatever the row holds by then. */
  digest: string;
  tankName: string;
  tankSlug: string;
  region: Region;
  nickname: string;
  overall: number;
  fun: number;
  /** The author's record on this exact tank. The card leads with it: a verdict
   * from four thousand battles and one from twenty-six read differently, and
   * that is the moderator's main signal. */
  battles: number;
  winrate: number | null;
  avgDamage: number | null;
  playerWn8: number | null;
  body: string;
};

/** Five characters rather than a number, so a moderator reads the verdict at a
 * glance instead of parsing it. */
function stars(value: number): string {
  return "★".repeat(value) + "☆".repeat(Math.max(0, MAX_STARS - value));
}

export async function postRatingModerationCard(
  card: RatingModerationCard,
): Promise<void> {
  if (!env.DISCORD_REVIEW_CHANNEL_ID) return;

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: "Overall", value: stars(card.overall), inline: true },
    { name: "Fun", value: stars(card.fun), inline: true },
    {
      name: "Battles on it",
      value: card.battles.toLocaleString("en-US"),
      inline: true,
    },
  ];
  if (card.winrate != null) {
    fields.push({
      name: "Their win rate",
      value: `${(card.winrate * 100).toFixed(1)}%`,
      inline: true,
    });
  }
  if (card.avgDamage != null) {
    fields.push({
      name: "Their damage",
      value: Math.round(card.avgDamage).toLocaleString("en-US"),
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
      title: `${card.nickname} on the ${card.tankName}`,
      url: `${APP_IDENTITY.URL}/${card.region}/tanks/${card.tankSlug}/community`,
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
            custom_id: `${RATING_REVIEW_PREFIX}:approve:${card.id}:${card.digest}`,
          },
          {
            type: 2,
            style: 4,
            label: "Reject",
            custom_id: `${RATING_REVIEW_PREFIX}:reject:${card.id}:${card.digest}`,
          },
        ],
      },
    ],
  );
}
