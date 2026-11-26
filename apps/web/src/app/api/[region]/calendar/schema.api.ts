// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe: the calendar page parses the response with it to revive the dates.
import { z } from "zod";
import { regionPath } from "@/services/openapi/schemas";

const calendarEntry = z
  .object({
    id: z.string().meta({
      description: "Stable identifier: the article path and the start.",
    }),
    title: z.string().meta({ description: "The English title." }),
    titles: z.record(z.string(), z.string()).meta({
      description:
        "Every title read, keyed by the portal's own language code (`en`, `fr`, `pt-br`, `zh-tw`...). Only the languages the region's portal publishes the calendar in.",
    }),
    category: z.string().meta({
      description: "The English category label, e.g. Specials, Battle Pass, Update, Event.",
    }),
    color: z.string().meta({ description: "The portal widget's own colour token." }),
    icon: z.string().meta({ description: "The portal widget's own icon token." }),
    start: z.coerce.date(),
    end: z.coerce.date().meta({
      description:
        "An update is published as a one-minute entry marking the moment it goes live.",
    }),
    link: z.string().meta({ description: "The official news article, in English." }),
    banner: z.string().nullable().meta({
      description: "The article's full-size banner, when it has one.",
    }),
    thumbnail: z.string().nullable().meta({
      description: "The calendar widget's own small image.",
    }),
    discordEventId: z.string().nullable().meta({
      description:
        "The scheduled event this entry is published as on the unicum.gg community server, when it is.",
    }),
  })
  .meta({ id: "CalendarEntry", description: "One entry of the official calendar." });

/** Response of `GET /{region}/calendar`. */
export const CalendarResponse = z.object({
  region: regionPath,
  recordedSince: z.coerce.date().nullable().meta({
    description:
      "When this region's calendar was first recorded. Wargaming keeps only the current week, so nothing earlier can be known.",
  }),
  entries: z.array(calendarEntry).meta({ description: "Oldest first." }),
});
