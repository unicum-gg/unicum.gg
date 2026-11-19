// Co-located schemas (`.api.ts` so next-openapi-gen scans them).
import { z } from "zod";

/** Body of `POST /{region}/battles/{id}/comment/delete`. */
export const BattleCommentDeleteBody = z.object({
  id: z.number().int().meta({ description: "The comment, which must be the caller's own." }),
});

/** Response of `POST /{region}/battles/{id}/comment/delete`. */
export const BattleCommentDeleteResponse = z.object({ ok: z.boolean() });
