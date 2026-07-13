// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { tankEconRow } from "../categories.api";

/** Response of `GET /{region}/tanks/economics`. */
export const TankEconomicsResponse = z.object({ results: z.array(tankEconRow) });
