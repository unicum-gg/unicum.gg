// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

const siteUsageDay = z.object({
  day: z.string().meta({ description: "UTC day, YYYY-MM-DD." }),
  count: z.number(),
});

/** Response of `GET /usage/site`. */
export const SiteUsageResponse = z
  .object({
    accounts: z.number().meta({
      description:
        "Accounts ever created, which is everyone who has signed in with Wargaming at least once.",
    }),
    signupsDaily: z.array(siteUsageDay).meta({
      description: "Accounts created on each of the last 30 UTC days, today last.",
    }),
    active: z
      .object({
        day: z.number().meta({ description: "Signed-in readers seen today (UTC)." }),
        week: z.number().meta({
          description: "Distinct signed-in readers seen over the last 7 days, today included.",
        }),
        month: z.number().meta({
          description: "Distinct signed-in readers seen over the last 30 days, today included.",
        }),
      })
      .meta({
        description:
          "Distinct readers, never a sum of days: someone who came every day of the week counts once in `week`.",
      }),
    activeDaily: z.array(siteUsageDay).meta({
      description:
        "Distinct signed-in readers seen on each of the last 30 UTC days. Only signed-in readers are counted: anonymous traffic has no identity to count by.",
    }),
    activeRecordedSince: z.string().meta({
      description:
        "UTC day (YYYY-MM-DD) from which activity is recorded as it happens. Days before it were rebuilt from the sessions still on record and are a floor rather than a count.",
    }),
    linked: z
      .object({
        discord: z.number(),
        twitch: z.number(),
      })
      .meta({ description: "Accounts that have linked each service." }),
    supporters: z.number().meta({
      description: "Subscriptions currently active, which is what keeps the site running.",
    }),
  })
  .meta({
    id: "SiteUsage",
    description:
      "How many people use unicum.gg: signups, returning signed-in readers and linked services. Counted from our own records rather than from an analytics tool, and published because the project is open source.",
  });
