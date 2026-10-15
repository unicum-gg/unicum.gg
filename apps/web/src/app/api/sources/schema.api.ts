// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

/** Response of `GET /sources`. */
export const DataSourcesResponse = z
  .object({
    sources: z
      .array(
        z.object({
          id: z.string().meta({
            description:
              "Stable key for the table, so a caller can match a row without parsing its label. One of `wn8`, `wnx`.",
            example: "wn8",
          }),
          origin: z.string().meta({
            description:
              "Host the table is read from, so a reader can tell whose outage they are looking at.",
            example: "static.modxvm.com",
          }),
          fetchedAt: z.iso.datetime().nullable().meta({
            description:
              "When the last successful read landed, or null when the table has never been read. Null is a different fact from an old date: it means nothing is stored and the rating this table feeds reads as absent rather than stale.",
          }),
          tanks: z.number().nullable().meta({
            description:
              "How many vehicles that stored table carries, counted from the table itself. A table that grew is one that was really refreshed, which a timestamp on its own cannot show.",
          }),
        }),
      )
      .meta({
        description:
          "Every table we read from a third party, listed whether or not it has ever been read, since an omitted row reads as nothing to report.",
      }),
  })
  .meta({
    id: "DataSources",
    description:
      "When each externally sourced table the site depends on was last read successfully. These come from parties we do not run, and a failed refresh serves the last table we hold rather than failing the page, so this is what says how far behind that table is.",
  });
