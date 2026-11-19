// Co-located schemas (`.api.ts` so next-openapi-gen scans them). Client-safe:
// the comment form reads the bounds from here.
import { z } from "zod";
import { BattleCommentStatus } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";

const battleComment = z
  .object({
    id: z.number().int(),
    nickname: z.string().meta({ description: "The author's name when they wrote it." }),
    accountId: z.number().int(),
    authorRegion: z.string(),
    body: z.string(),
    createdAt: z.date(),
    status: z.enum(BattleCommentStatus).meta({
      description:
        "`approved` for every comment shown to everybody. A signed-in reader is also shown their own `pending` and `rejected` ones, which nobody else sees.",
      "x-enum-source": "BATTLE_COMMENT_STATUS",
    } as EnumMeta),
    inBattle: z.boolean().meta({ description: "Whether the author fought in this battle." }),
  })
  .meta({ id: "BattleComment" });

/** Response of `GET /{region}/battles/{id}/comments`. */
export const BattleCommentsResponse = z
  .object({
    comments: z.array(battleComment).meta({ description: "Oldest first, like a conversation." }),
    open: z.boolean().meta({
      description: "Whether comments can be written at all: they wait on a moderator, and a deployment without a moderation channel takes none.",
    }),
  })
  .meta({ id: "BattleCommentsResponse" });
