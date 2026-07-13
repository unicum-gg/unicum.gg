// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankPerfRow } from "./categories.api";

/** Response of `GET /{region}/tanks` (per-tank server performance). */
export const TankPerfResponse = z.object({ results: z.array(tankPerfRow) });
