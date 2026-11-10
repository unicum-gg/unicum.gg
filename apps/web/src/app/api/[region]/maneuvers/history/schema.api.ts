// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
// Sub-schemas are named after this endpoint: the generator resolves a schema's
// local consts by NAME across files.
import { z } from "zod";

export const maneuversHistoryQuery = z.object({
  edition: z.string().optional().meta({
    description:
      "The edition to read, by its identifier. Defaults to the newest edition recorded.",
  }),
});

const maneuversHistoryPoint = z
  .object({
    t: z.number().meta({
      description: "The source's recalculation instant, in epoch seconds.",
    }),
    playerCount: z.number(),
    clanCount: z.number(),
    tankCutoffPoints: z.number().nullable().meta({
      description:
        "Fame Points held at the last vehicle-rewarded place on the player board at that instant.",
    }),
    clanGoldCutoffPoints: z.number().nullable().meta({
      description:
        "Fame Points held at the last gold-rewarded place on the clan board at that instant.",
    }),
  })
  .meta({
    id: "ManeuversHistoryPoint",
    description: "Both boards at one recorded instant.",
  });

export const ManeuversHistoryResponse = z
  .object({
    eventName: z.string(),
    points: z.array(maneuversHistoryPoint).meta({
      description: "One point per capture, oldest first.",
    }),
  })
  .meta({
    description:
      "How a Maneuvers edition's boards moved while it ran: what a rewarded place cost and how many held one, capture by capture.",
  });
