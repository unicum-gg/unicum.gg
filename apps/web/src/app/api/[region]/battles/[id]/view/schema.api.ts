// Co-located schemas (`.api.ts` so next-openapi-gen scans them).
import { z } from "zod";

/** Body of `POST /{region}/battles/{id}/view`. */
export const BattleViewBody = z.object({
  recorder: z.number().int().positive().meta({
    description: "The account whose recording was opened, one of the battle's `recorders`.",
  }),
});

/** Response of `POST /{region}/battles/{id}/view`. */
export const BattleViewResponse = z.object({ ok: z.boolean() });
