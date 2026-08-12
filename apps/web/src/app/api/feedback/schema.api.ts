// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { FeedbackSentiment, FeedbackTopic } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";

/**
 * Documented shape of `POST /api/feedback`.
 *
 * The runtime schema stays in `components/feedback/schema.ts`, next to the
 * widget that fills it: this one exists because the generator reads `.api.ts`
 * files only, and because documenting the endpoint is what puts it in the SDK.
 * Before that, the Discord bot had to call it with a hand-written fetch and a
 * hardcoded path, which is exactly what the SDK exists to stop.
 *
 * The enums come from the domain enums, like every other documented enum: the
 * `x-enum-source` marker names an entry of `OPENAPI_ENUM_SOURCES` and the
 * injection step fills the values in after generation. Inlining them as
 * literals here would be a second copy to keep in step with `@unicum.gg/shared`,
 * which is the drift the marker was introduced to remove.
 */
export const FeedbackBody = z.object({
  topic: z.enum(FeedbackTopic).meta({
    description: "What the feedback is about.",
    "x-enum-source": "FEEDBACK_TOPIC",
  } as EnumMeta),
  sentiment: z
    .enum(FeedbackSentiment)
    .optional()
    .meta({
      description: "Optional one-tap sentiment.",
      "x-enum-source": "FEEDBACK_SENTIMENT",
    } as EnumMeta),
  message: z.string().meta({ description: "The feedback itself." }),
  page: z.string().optional().meta({
    description: "Page it was sent from, for context.",
  }),
  umamiSessionId: z.string().optional().meta({
    description: "Analytics session id, when the sender's browser captured one.",
  }),
  discordAuthor: z
    .object({ id: z.string(), username: z.string() })
    .optional()
    .meta({
      description:
        "Set by the Discord bot instead of a web session. Shown as an unverified handle: the endpoint is public, so this is a self-reported label rather than a trusted identity.",
    }),
});

/** Response of `POST /api/feedback`. */
export const FeedbackResponse = z.object({
  ok: z.boolean(),
});
