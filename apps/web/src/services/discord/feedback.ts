import "server-only";
import { APP_IDENTITY, BRAND_COLOR_INT, env } from "@unicum.gg/shared";
import { discordBotEnabled, postChannelEmbed } from "@unicum.gg/core/discord";
import UMAMI from "@/constants/umami";
import {
  FeedbackSentiment,
  SENTIMENT_EMOJI,
  SENTIMENT_LABELS,
  TOPIC_LABELS,
  type FeedbackTopic,
} from "@/components/feedback/schema";

/** The feedback widget is available only when the bot is configured and a target
 * channel is set; otherwise the top-bar button hides and `POST /api/feedback`
 * 404s. Posted via the bot (same path as boost notifications), not a webhook. */
export function isFeedbackEnabled(): boolean {
  return discordBotEnabled() && !!env.DISCORD_FEEDBACK_CHANNEL_ID;
}

/** Who sent it, derived server-side from the session (never from the client). */
type FeedbackAuthor = {
  /** WG nickname, when signed in. */
  nickname?: string;
  /** Region the account belongs to. */
  region?: string;
  /** Absolute link to the sender's profile, when signed in. */
  profileUrl?: string;
};

type FeedbackPayload = {
  topic: FeedbackTopic;
  sentiment?: FeedbackSentiment;
  message: string;
  /** The page it was sent from (path + search). */
  page?: string;
  /** The visitor's Umami session id, when captured. */
  umamiSessionId?: string;
  author: FeedbackAuthor;
};

/** Embed accent per sentiment (worst → best), brand orange when none given. */
const SENTIMENT_COLOR: Record<FeedbackSentiment, number> = {
  [FeedbackSentiment.Awful]: 0xef4444,
  [FeedbackSentiment.Bad]: 0xf97316,
  [FeedbackSentiment.Good]: 0x84cc16,
  [FeedbackSentiment.Great]: 0x22c55e,
};

function buildEmbed(payload: FeedbackPayload) {
  const { topic, sentiment, message, page, umamiSessionId, author } = payload;
  const emoji = sentiment ? SENTIMENT_EMOJI[sentiment] : "";
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Topic", value: TOPIC_LABELS[topic], inline: true },
  ];
  if (sentiment) {
    fields.push({
      name: "Sentiment",
      value: `${SENTIMENT_EMOJI[sentiment]} ${SENTIMENT_LABELS[sentiment]}`,
      inline: true,
    });
  }
  fields.push({
    name: "From",
    value: author.nickname
      ? author.profileUrl
        ? `[${author.nickname}](${author.profileUrl})${author.region ? ` (${author.region.toUpperCase()})` : ""}`
        : author.nickname
      : "Anonymous",
    inline: true,
  });
  if (page) {
    const url = `${APP_IDENTITY.URL}${page}`;
    fields.push({ name: "Page", value: `[${page}](${url})` });
  }
  if (umamiSessionId) {
    fields.push({
      name: "Analytics",
      value: `[View session](${UMAMI.sessionUrl(umamiSessionId)})`,
    });
  }
  return {
    title: `New feedback${emoji ? ` ${emoji}` : ""}`,
    description: message.slice(0, 4000),
    color: sentiment ? SENTIMENT_COLOR[sentiment] : BRAND_COLOR_INT,
    fields,
    footer: { text: APP_IDENTITY.NAME },
  };
}

/**
 * Post a feedback submission to the configured Discord channel as an embed, sent
 * by the bot (bot-token REST, same mechanism as boost notifications). Returns
 * whether the bot could post it; best-effort, the caller surfaces a failure to
 * the user.
 */
export async function sendFeedbackToDiscord(
  payload: FeedbackPayload,
): Promise<boolean> {
  const channelId = env.DISCORD_FEEDBACK_CHANNEL_ID;
  if (!channelId) return false;
  return postChannelEmbed(channelId, buildEmbed(payload));
}
