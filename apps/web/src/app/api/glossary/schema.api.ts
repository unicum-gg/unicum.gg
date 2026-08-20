// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import * as z from "zod";
import { GlossaryCategory } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";

export const glossaryCategoryField = z.enum(GlossaryCategory).meta({
  description: "Section of the glossary a term belongs to.",
  "x-enum-source": "GLOSSARY_CATEGORY",
} as EnumMeta);

export const glossaryQuery = z.object({
  category: glossaryCategoryField.optional(),
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
