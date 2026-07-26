import * as z from "zod";

/**
 * Server-free feedback model, shared by the widget (client) and the
 * `POST /api/feedback` handler (server), so the enums, labels and body shape
 * never drift between the form and its validation. No React / server imports,
 * mirroring the co-located OpenAPI `schema.api.ts` files.
 */

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

/** Request body of `POST /api/feedback`. The user context (nickname, region,
 * page origin) is added server-side from the session, never trusted from here. */
export const feedbackBodySchema = z.object({
  topic: z.enum(FeedbackTopic),
  sentiment: z.enum(FeedbackSentiment).optional(),
  message: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
  /** The page the feedback was sent from (path + search), for context. */
  page: z.string().max(1000).optional(),
  /** The visitor's Umami session id, when captured client-side. Falls back to
   * undefined on anything unexpected so a bad value never rejects the feedback. */
  umamiSessionId: z.uuid().optional().catch(undefined),
});

export type FeedbackBody = z.infer<typeof feedbackBodySchema>;
