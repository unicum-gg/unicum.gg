import { headers } from "next/headers";
import { auth } from "@unicum.gg/core/auth";
import { loadVideoForEdit } from "@unicum.gg/core/tanks/videos-read";
import { verifyVideoEditToken } from "@unicum.gg/core/tanks/video-edit-token";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { VideoEditableResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * A suggestion, as its form
 * @description One suggested battle in the shape the form that corrects it needs: the link rather than the video id, the team number rather than the direction derived from it, the tank and clan as the slug and tag the form searches by. Readable by its author, and by a moderator holding the signed link the moderation channel hands out. A row the caller may not edit is answered 403 rather than shown, since an unreviewed suggestion is visible to the person waiting on it and to nobody else. 401 when signed out and no token is given.
 * @pathParams regionParams
 * @queryParams videoEditableQuery
 * @response VideoEditableResponse
 * @tag Tanks
 * @openapi
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const url = new URL(request.url);
  const id = Number.parseInt(url.searchParams.get("id") ?? "", 10);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const video = await loadVideoForEdit(region, id);
  if (!video) return Response.json({ error: "not_found" }, { status: 404 });

  // A moderator's token stands for the press that minted it, and is checked
  // against this id so one handed out for another submission cannot be
  // replayed. Otherwise the caller has to be the person waiting on the review.
  const token = url.searchParams.get("token");
  if (token) {
    if (!verifyVideoEditToken(token, id)) {
      return Response.json({ error: "invalid_token" }, { status: 403 });
    }
  } else {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Response.json({ error: "unauthenticated" }, { status: 401 });
    }
    // Their own row, whatever became of it. A rejected one included: the
    // moderator now has to say why they turned it down, and the answer to
    // "the timestamp is 40 seconds early" is the form, not a second submission.
    if (video.submittedBy !== session.user.id) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  }

  // Named field by field rather than by spreading the row minus one key: what
  // this answers with is a contract, and a column added to the row later must
  // not start being published because nobody thought to exclude it.
  return jsonResponse(
    VideoEditableResponse,
    {
      id: video.id,
      status: video.status,
      title: video.title,
      url: video.url,
      startSeconds: video.startSeconds,
      arenaId: video.arenaId,
      mode: video.mode,
      spawnTeam: video.spawnTeam,
      result: video.result,
      format: video.format,
      tankSlug: video.tankSlug,
      tankName: video.tankName,
      combinedDamage: video.combinedDamage,
      teamSize: video.teamSize,
      tier: video.tier,
      clan: video.clan,
      reviewNote: video.reviewNote,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
