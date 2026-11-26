// Co-located response schema (`.api.ts` so next-openapi-gen scans it). Client-
// safe: the calendar page parses the response with it to revive the dates.
import { z } from "zod";
import { regionPath } from "@/services/openapi/schemas";

const calendarEntry = z
  .object({
    id: z.string().meta({
      description: "Stable identifier: the article path and the start.",
    }),
    source: z.enum(["widget", "monthly"]).meta({
      description:
        "Where the entry was read: `widget` is the portal home page's calendar (dated to the minute), `monthly` the month's \"WoT Monthly\" article (dated by the day). An entry both carry is returned once, as `widget`, with the monthly article's text.",
    }),
    title: z.string().meta({ description: "The English title." }),
    titles: z.record(z.string(), z.string()).meta({
      description:
        "Every title read, keyed by the portal's own language code (`en`, `fr`, `pt-br`, `zh-tw`...). Only the languages the region's portal publishes the calendar in.",
    }),
    descriptions: z.record(z.string(), z.string()).meta({
      description:
        "The entry's text, keyed like `titles`. Empty when the entry has none (the home page widget carries no text).",
    }),
    category: z.string().meta({
      description: "The English category label, e.g. Specials, Battle Pass, Update, Event.",
    }),
    color: z.string().meta({ description: "The portal widget's own colour token." }),
    icon: z.string().meta({ description: "The portal widget's own icon token." }),
    start: z.coerce.date(),
    end: z.coerce.date().meta({
      description:
        "Exclusive. An update is published as a one-minute entry marking the moment it goes live; an all-day entry ends at midnight UTC after its last day.",
    }),
    allDay: z.boolean().meta({
      description: "Dated by the day rather than the minute (`monthly` entries).",
    }),
    link: z.string().nullable().meta({
      description: "The official page the entry leads to, when it has one.",
    }),
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
      "The earliest date this region's calendar is known from: the first monthly article with a calendar (March 2025), or the first capture of the home page widget if earlier.",
  }),
  entries: z.array(calendarEntry).meta({ description: "Oldest first." }),
});
