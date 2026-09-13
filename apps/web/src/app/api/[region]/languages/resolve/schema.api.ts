// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { MAX_IDS_PER_KIND } from "@unicum.gg/core/languages";
import { LanguageSource } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";

/**
 * Query of `GET /{region}/languages/resolve`.
 *
 * Two id lists, both optional: a caller holding only a clan list sends only
 * `clans`. Numeric ids rather than nicknames and tags, which is what the caller
 * actually holds (a World of Tanks roster row carries `dbID` and `clanDBID`).
 *
 * Honest arrays in the spec, serialized to `?players=1,2` CSV like the compare
 * endpoints, so the SDK hands a caller `number[]` rather than a string it has
 * to join itself. The sibling `search/resolve` keeps strings for a reason that
 * does not apply here: an arena id is not numeric.
 *
 * The cap is written out in these descriptions because it cannot be computed
 * into them: next-openapi-gen reads `.meta` off the AST and drops the whole
 * object when it is not an inline literal, so a template literal would publish
 * a parameter with no description at all. `MAX_IDS_PER_KIND` is still the only
 * value enforced, and the assertion below fails the build if it moves, so the
 * prose cannot quietly outlive it.
 */
export const languagesResolveQuery = z.object({
  players: z
    .array(z.number())
    .optional()
    .meta({ description: "Account ids. Up to 100." }),
  clans: z
    .array(z.number())
    .optional()
    .meta({ description: "Clan ids. Up to 100." }),
});

/** Drift guard for the three places the cap is spelled out for a reader: the two
 * descriptions above and the route's `@description`. Changing
 * `MAX_IDS_PER_KIND` fails this line, which names them. */
export type DocumentedMaxIdsInSync = typeof MAX_IDS_PER_KIND extends 100
  ? true
  : "MAX_IDS_PER_KIND moved: update the two `Up to 100` descriptions above and the route's @description";
export const documentedMaxIdsInSync: DocumentedMaxIdsInSync = true;

const resolvedLanguages = z
  .object({
    languages: z
      .array(z.string())
      .meta({ description: "Two-letter language codes, never empty." }),
    countries: z.array(z.string().nullable()).meta({
      description:
        "Flag code per language, aligned index for index with `languages`, null where no flag is published for that language. Not an ISO country code: `en` is `GB-UKM` on EU and `US` on NA/ASIA.",
    }),
    source: z.enum(LanguageSource).meta({
      description:
        "Where the languages came from: `declared` (the clan owner set them), `inferred` (weighted over the account's clan history, the same answer the player page shows) or `clan` (no clan history for this account, so their current clan's declared set stood in, which is a snapshot rather than an inference).",
      "x-enum-source": "LANGUAGE_SOURCE",
    } as EnumMeta),
  })
  .meta({
    id: "ResolvedLanguages",
    description: "Languages held for one entity, and why we believe them.",
  });

/**
 * Response of `GET /{region}/languages/resolve`.
 *
 * Keyed by the id that was asked for, so the caller pairs entries back to its
 * own roster rows without relying on an order. An id we hold no language for is
 * absent rather than present and empty: since the endpoint refuses an over-long
 * list instead of truncating it, every id sent was really looked at, and
 * absence therefore means "we have nothing for this one" unambiguously.
 */
export const LanguagesResolveResponse = z.object({
  players: z.record(z.string(), resolvedLanguages),
  clans: z.record(z.string(), resolvedLanguages),
});
