// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import * as z from "zod";
import { GlossaryBlockKind, GlossaryLinkTarget } from "@unicum.gg/shared";
import type { EnumMeta } from "@/services/openapi/schemas";
import { glossaryCategoryField, glossaryTermSummary } from "../schema.api";

export const glossaryParams = z.object({
  slug: z.string().meta({ description: "Term slug, e.g. `wn8`." }),
});

/** A run of body text. `slug` is set when the run names another term, so a
 * client renders it as a link without needing the catalogue. */
export const glossarySegment = z.object({
  text: z.string(),
  slug: z.string().optional(),
});

const paragraphBlock = z.object({
  kind: z.literal(GlossaryBlockKind.Paragraph),
  segments: z.array(glossarySegment),
});

const listBlock = z.object({
  kind: z.literal(GlossaryBlockKind.List),
  items: z.array(z.array(glossarySegment)),
});

const formulaBlock = z.object({
  kind: z.literal(GlossaryBlockKind.Formula),
  expression: z.string(),
  note: z.string().optional(),
});

export const glossaryBlock = z
  .union([paragraphBlock, listBlock, formulaBlock])
  .meta({
    id: "GlossaryBlock",
    description: "One block of a definition: a paragraph, a list or a formula.",
  });

/** A page of the site the term points at. Targets are named rather than spelled
 * as paths because every catalogue route carries the reader's region. */
export const glossaryLink = z.object({
  target: z.enum(GlossaryLinkTarget).meta({
    description: "Which page of the site the link leads to.",
    "x-enum-source": "GLOSSARY_LINK_TARGET",
  } as EnumMeta),
  slug: z.string().optional(),
  label: z.string().optional(),
});

/** Response of `GET /glossary/{slug}` (one term, in full). */
export const GlossaryTermResponse = z.object({
  slug: z.string(),
  term: z.string(),
  aliases: z.array(z.string()),
  category: glossaryCategoryField,
  short: z.string(),
  body: z.array(glossaryBlock),
  related: z.array(glossaryTermSummary),
  links: z.array(glossaryLink),
});
