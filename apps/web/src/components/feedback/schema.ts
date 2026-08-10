import * as z from "zod";
import {
  FeedbackSentiment,
  FeedbackTopic,
  MESSAGE_MAX_LENGTH,
} from "@unicum.gg/shared";

/**
 * Request-body model for `POST /api/feedback`, shared by the widget (client) and
 * the handler (server) so the body shape never drifts. The topic/sentiment
 * enums and their labels now live in `@unicum.gg/shared` (so the Discord bot can
 * build the same command), and are re-exported here so existing
 * `@/components/feedback/schema` imports keep resolving unchanged.
 */
export {
  FeedbackSentiment,
  FeedbackTopic,
  MESSAGE_MAX_LENGTH,
  SENTIMENT_EMOJI,
  SENTIMENT_LABELS,
  SENTIMENT_ORDER,
  TOPIC_LABELS,
} from "@unicum.gg/shared";

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
  /** Set by the Discord bot's `/feedback` command instead of a web session:
   * the submitter's Discord identity. Only used when there is no signed-in WG
   * session, and always shown as an unverified Discord handle (the endpoint is
   * public, so this is a self-reported label, never a trusted identity). */
  discordAuthor: z
    .object({ id: z.string().max(32), username: z.string().max(64) })
    .optional(),
});

export type FeedbackBody = z.infer<typeof feedbackBodySchema>;
