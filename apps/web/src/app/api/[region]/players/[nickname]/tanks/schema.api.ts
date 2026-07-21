// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe (only zod): the player page parses the response with it. Reuses the
// per-tank row schema defined in the player detail route (they are the same
// rows, just moved to their own endpoint for on-demand loading).
import { z } from "zod";
import { playerVehicle } from "../schema.api";

// --- Player tanks (GET /api/{region}/players/{nickname}/tanks) ---
// The heavy tank-by-tank list, loaded on demand (it is ~92% of the former
// detail payload but only the Tanks section renders it).

export const PlayerTanksResponse = z.object({
  tanks: z.array(playerVehicle),
});
