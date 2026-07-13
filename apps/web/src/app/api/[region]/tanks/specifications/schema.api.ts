// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankSpecRow } from "../categories.api";

/** Response of `GET /{region}/tanks/specifications`. */
export const TankSpecsResponse = z.object({ results: z.array(tankSpecRow) });
