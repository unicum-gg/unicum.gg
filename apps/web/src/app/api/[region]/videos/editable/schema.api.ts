// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import {
  battleFormatField,
  battleResultField,
  mapModeField,
  tankVideoStatusField,
  videoClanCredit,
} from "@/services/openapi/schemas";

/**
 * Response of `GET /{region}/videos/editable`: one suggestion, in the shape the
 * form that corrects it needs.
 *
 * Deliberately not the published row every other video endpoint answers with.
 * Those describe what a reader sees, worked out from what was stored: the side
 * comes back as the direction the map's geometry gives it, and the video as an
 * id and a second. This describes what the submitter typed, because that is
 * what an edit replaces, so the link is a link again and the side is the team
 * number the form has a control for.
 *
 * The submitter is not named. Whether the caller is allowed to see this row is
 * settled before it is built, and answering with the account id afterwards
 * would hand out an identity the form has no use for.
 */
export const VideoEditableResponse = z.object({
  id: z.number().int(),
  status: tankVideoStatusField,
  title: z.string(),
  url: z.string().meta({
    description: "YouTube link, rebuilt with the stored start time.",
  }),
  startSeconds: z.number().int(),
  arenaId: z.string().nullable(),
  mode: mapModeField.nullable(),
  spawnTeam: z.number().int().nullable(),
  result: battleResultField.nullable(),
  format: battleFormatField,
  tankSlug: z.string().nullable(),
  tankName: z.string().nullable(),
  combinedDamage: z.number().int().nullable(),
  teamSize: z.number().int().nullable(),
  tier: z.number().int().nullable(),
  clan: videoClanCredit,
  reviewNote: z.string().nullable().meta({
    description: "Why it was turned down, when it was.",
  }),
});
