// Co-located schemas (`.api.ts` so next-openapi-gen scans them). Client-safe:
// the comment form reads the bounds from here.
import { z } from "zod";
import {
  BattleCommentStatus,
  MAX_BATTLE_COMMENT_LENGTH,
  MIN_BATTLE_COMMENT_LENGTH,
} from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";

/** Body of `POST /{region}/battles/{id}/comment`. */
export const BattleCommentBody = z.object({
  body: z
    .string()
    .min(MIN_BATTLE_COMMENT_LENGTH)
    .max(MAX_BATTLE_COMMENT_LENGTH)
    .meta({ description: "What to say, plain text." }),
});

/** Response of `POST /{region}/battles/{id}/comment`. */
export const BattleCommentResponse = z.object({
  id: z.number().int(),
  status: z.enum(BattleCommentStatus).meta({
    description: "Always `pending`: a comment is shown once a moderator has read it.",
    "x-enum-source": "BATTLE_COMMENT_STATUS",
  } as EnumMeta),
});
