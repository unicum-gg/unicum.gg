// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import * as z from "zod";
import { glossaryTermSummary } from "../schema.api";

/** Response of `GET /glossary/search` (the terms matching a query). */
export const GlossarySearchResponse = z.object({
  results: z.array(glossaryTermSummary),
});
