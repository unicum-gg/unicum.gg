// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankMoeRow } from "../categories.api";

/** Response of `GET /{region}/tanks/marks-of-excellence`. */
export const TankMoeResponse = z.object({ results: z.array(tankMoeRow) });
