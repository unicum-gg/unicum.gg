import "server-only";
import { APP_IDENTITY, env } from "@unicum.gg/shared";
import {
  FeedbackSentiment,
  SENTIMENT_EMOJI,
  SENTIMENT_LABELS,
  TOPIC_LABELS,
  type FeedbackTopic,
} from "@/components/feedback/schema";

/** The feedback widget is available only when a Discord webhook is configured;
 * otherwise the top-bar button hides and `POST /api/feedback` 404s. */
export function isFeedbackEnabled(): boolean {
  return !!env.DISCORD_FEEDBACK_WEBHOOK_URL;
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
  author: FeedbackAuthor;
};

/** Embed accent per sentiment (worst → best), brand orange when none given. */
const SENTIMENT_COLOR: Record<FeedbackSentiment, number> = {
  [FeedbackSentiment.Awful]: 0xef4444,
  [FeedbackSentiment.Bad]: 0xf97316,
  [FeedbackSentiment.Good]: 0x84cc16,
  [FeedbackSentiment.Great]: 0x22c55e,
};
const BRAND_COLOR = 0xf25322;

function buildEmbed(payload: FeedbackPayload) {
  const { topic, sentiment, message, page, author } = payload;
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
  return {
    title: `New feedback${emoji ? ` ${emoji}` : ""}`,
    description: message.slice(0, 4000),
    color: sentiment ? SENTIMENT_COLOR[sentiment] : BRAND_COLOR,
    fields,
    footer: { text: APP_IDENTITY.NAME },
  };
}

/**
 * Post a feedback submission to the configured Discord channel as an embed.
 * Returns whether the webhook accepted it (Discord replies 204 on success);
 * best-effort, the caller surfaces a failure to the user.
 */
export async function sendFeedbackToDiscord(
  payload: FeedbackPayload,
): Promise<boolean> {
  const webhookUrl = env.DISCORD_FEEDBACK_WEBHOOK_URL;
  if (!webhookUrl) return false;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: APP_IDENTITY.NAME,
        embeds: [buildEmbed(payload)],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
