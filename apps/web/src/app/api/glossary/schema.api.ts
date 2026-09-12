// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import * as z from "zod";
import { GlossaryCategory } from "@unicum.gg/shared";
import { MIN_QUERY_LENGTH, type EnumMeta } from "@/services/openapi/schemas";
import { answerLanguageField } from "@/services/openapi/locale";

export const glossaryCategoryField = z.enum(GlossaryCategory).meta({
  description: "Section of the glossary a term belongs to.",
  "x-enum-source": "GLOSSARY_CATEGORY",
} as EnumMeta);

export const glossaryQuery = z.object({
  category: glossaryCategoryField.optional(),
  language: answerLanguageField.optional(),
});

/** Query of `GET /glossary/{slug}` and `GET /glossary/anchors`. */
export const glossaryTermQuery = z.object({
  language: answerLanguageField.optional(),
});

/**
 * Query of `GET /glossary/search`.
 *
 * The shared `searchQuery` carries only `q`, which is right for the player,
 * clan, tank and map searches: those match a proper noun that is the same word
 * in every language. A glossary term is prose, so the search has to be told
 * which language to match and to answer in. Reading `language` off the request
 * without declaring it here was worse than not supporting it: the generator
 * emitted `search(q)` with no way to pass one, so the site's own search box
 * answered in English on all thirty-six.
 */
export const glossarySearchQuery = z.object({
  // Spelled out rather than reused from `searchQuery`: next-openapi-gen reads
  // these objects off the AST, so `searchQuery.shape.q` is an expression it
  // cannot follow and the field came out as an empty object. Same limitation as
  // the enum literals, and the minimum below is the same constant the shared
  // schema uses.
  q: z.string().min(MIN_QUERY_LENGTH).meta({
    description: "Search prefix.",
  }),
  language: answerLanguageField.optional(),
});

export const glossaryTermSummary = z
  .object({
    slug: z.string(),
    term: z.string(),
    aliases: z.array(z.string()).meta({
      description: "Other spellings the term is known and searched by.",
    }),
    category: glossaryCategoryField,
    short: z.string().meta({
      description: "One-sentence definition, complete on its own.",
    }),
  })
  .meta({
    id: "GlossaryTermSummary",
    description: "A glossary term without its body.",
  });

/** Response of `GET /glossary` (every term the site defines). */
export const GlossaryListResponse = z.object({
  results: z.array(glossaryTermSummary),
});
