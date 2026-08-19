// Shared schemas for the tank changes history: the per-tank History tab
// (`/{region}/tanks/{slug}/history`) and the global feed (`/{region}/tanks/changes`).
// `.api.ts` so next-openapi-gen scans it.
import { z } from "zod";
import { tankIdentity } from "./identity.api";

/** One recorded change to a single spec field at a game-version bump. `previous`
 * and `next` are raw stored values (apply the field's scale to display); either
 * is null when the field appeared or disappeared. */
export const tankSpecChange = z
  .object({
    field: z.string(),
    previous: z.number().nullable(),
    next: z.number().nullable(),
  })
  .meta({
    id: "TankSpecChange",
    description:
      "A change to one spec field (the tank_specs column name) between two game versions, with the raw before/after values.",
  });

/** A game version and the field changes it brought to one tank (per-tank view). */
export const tankHistoryVersion = z
  .object({
    gameVersion: z.string(),
    capturedAt: z.coerce.date(),
    changes: z.array(tankSpecChange),
  })
  .meta({
    id: "TankHistoryVersion",
    description:
      "The characteristic changes a game version made to a tank, with when they were recorded.",
  });

/** A tank and its field changes within a version (global feed view). */
export const changedTank = z
  .object({
    identity: tankIdentity,
    changes: z.array(tankSpecChange),
  })
  .meta({
    id: "ChangedTank",
    description: "A tank's identity and the spec changes a game version made to it.",
  });

/** A game version and every tank it changed (global feed). */
export const tankChangesVersion = z
  .object({
    gameVersion: z.string(),
    capturedAt: z.coerce.date(),
    tanks: z.array(changedTank),
  })
  .meta({
    id: "TankChangesVersion",
    description:
      "Every tank a game version rebalanced, newest first, heaviest-hit tank first.",
  });
