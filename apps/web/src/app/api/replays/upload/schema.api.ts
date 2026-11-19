// Co-located request and response schemas (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { regionPath } from "@/services/openapi/schemas";

/**
 * Body of `POST /replays/upload`, sent as `multipart/form-data`.
 *
 * One field, the file. Everything else the battle needs is inside it: the
 * results, the map, the client version and who recorded it.
 */
export const ReplayUploadBody = z.object({
  replay: z.string().meta({
    description: "The `.wotreplay` file of a finished battle, recorded by the signed-in account.",
    format: "binary",
  }),
});

/** Where the uploaded battle now lives. */
export const ReplayUploadResponse = z.object({
  region: regionPath,
  /** The battle's id, which is the path of its page. */
  id: z.string(),
  /** True when this upload created the battle, false when we already held it. */
  created: z.boolean(),
});
