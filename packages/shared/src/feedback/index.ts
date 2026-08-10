// Feedback domain constants, client-safe and pure (no zod / server / DB), so
// they are shared by the web widget + `POST /api/feedback` handler AND the
// Discord bot's `/feedback` command, which cannot import from `apps/web`. The
// request-body Zod schema stays in the web layer (it references page/analytics
// context the bot does not send); this module is only the enums and labels both
// sides build their UI from.

/** What the feedback is about, chosen in the widget's topic selector. */
export enum FeedbackTopic {
  Bug = "bug",
  Idea = "idea",
  Data = "data",
  Other = "other",
}

/** Optional one-tap sentiment (the emoji row), from worst to best. */
export enum FeedbackSentiment {
  Awful = "awful",
  Bad = "bad",
  Good = "good",
  Great = "great",
}

/** Human labels for the topic selector. */
export const TOPIC_LABELS: Record<FeedbackTopic, string> = {
  [FeedbackTopic.Bug]: "Bug report",
  [FeedbackTopic.Idea]: "Feature idea",
  [FeedbackTopic.Data]: "Data accuracy",
  [FeedbackTopic.Other]: "Other",
};

/** The emoji shown for each sentiment (matches the Awful→Great order). */
export const SENTIMENT_EMOJI: Record<FeedbackSentiment, string> = {
  [FeedbackSentiment.Awful]: "😭",
  [FeedbackSentiment.Bad]: "🙁",
  [FeedbackSentiment.Good]: "🙂",
  [FeedbackSentiment.Great]: "🤩",
};

/** Accessible labels for the emoji buttons. */
export const SENTIMENT_LABELS: Record<FeedbackSentiment, string> = {
  [FeedbackSentiment.Awful]: "Awful",
  [FeedbackSentiment.Bad]: "Bad",
  [FeedbackSentiment.Good]: "Good",
  [FeedbackSentiment.Great]: "Great",
};

/** Sentiments in display order (the emoji row is rendered from this). */
export const SENTIMENT_ORDER: FeedbackSentiment[] = [
  FeedbackSentiment.Awful,
  FeedbackSentiment.Bad,
  FeedbackSentiment.Good,
  FeedbackSentiment.Great,
];

/** Upper bound on the free-text message, enforced client- and server-side. */
export const MESSAGE_MAX_LENGTH = 2000;
