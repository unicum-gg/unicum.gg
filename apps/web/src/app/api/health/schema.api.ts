// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";

/** Response of `GET /health`. */
export const HealthResponse = z.object({
  status: z.string().meta({ example: "ok" }),
});
