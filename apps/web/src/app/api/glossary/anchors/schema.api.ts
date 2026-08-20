// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import * as z from "zod";

const anchorTerm = z
  .object({
    slug: z.string(),
    term: z.string(),
    short: z.string(),
  })
  .meta({
    id: "GlossaryAnchorTerm",
    description: "A term as a tooltip renders it.",
  });

/** Response of `GET /glossary/anchors` (where terms attach to the interface). */
export const GlossaryAnchorsResponse = z.object({
  terms: z.array(anchorTerm),
  bySpecKey: z.record(z.string(), z.string()).meta({
    description: "Tank specification column to the slug that defines it.",
  }),
  byLabel: z.record(z.string(), z.string()).meta({
    description: "Lowercased interface label to the slug that defines it.",
  }),
});
