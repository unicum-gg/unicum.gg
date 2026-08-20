// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";

/** Response of `POST /{region}/tanks/{slug}/rate/withdraw`. */
export const TankRateWithdrawResponse = z.object({
  ok: z.boolean(),
  /** False when there was nothing to take back, which is not an error: the
   * caller wanted their opinion gone and it is. */
  removed: z.boolean(),
});
