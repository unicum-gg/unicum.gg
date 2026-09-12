import { headers } from "next/headers";
import { after } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { resolveBattleMap } from "@unicum.gg/core/wargaming/wot/maps";
import { getClanByTagCached } from "@unicum.gg/core/clans/repository";
import {
  editTankVideo,
  EditVideoOutcome,
  type EditActor,
} from "@unicum.gg/core/tanks/video-edit";
import { verifyVideoEditToken } from "@unicum.gg/core/tanks/video-edit-token";
import { videoSubmissionsEnabled } from "@unicum.gg/core/tanks/videos";
import { isCompetitiveFormat } from "@unicum.gg/shared";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { revalidateVideoMove } from "@/services/videos/revalidate";
import { VideoEditBody, VideoEditResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Correct a suggestion
 * @description Rewrite a battle that was already suggested. The author may correct their own whatever became of it, a turned-down one included: a rejection carries the moderator's reason, and the answer to it is usually a correction rather than a second submission. A moderator may correct anyone's while holding the signed link the moderation channel hands out. The body is the submission's, so the same checks apply: the map and mode are validated against the catalogue, a random battle names its vehicle, and the one-row-per-battle rule still holds. The vehicle is the field this exists for, since the form never asks for it on the way in. A correction always goes back to the queue, so a video that was live comes down until it is approved again. A correction always goes back to the queue, so a video that was live comes down until it is approved again. 401 when signed out and no token is given, 403 on someone else's, 404 when submissions are unconfigured or the row is unknown, 409 when the correction lands on a battle we already hold.
 * @pathParams regionParams
 * @body VideoEditBody
 * @response VideoEditResponse
 * @tag Tanks
 * @openapi
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  // Unconfigured means nothing could review the correction, and a correction
  // that cannot be reviewed would take a published video down for good.
  if (!videoSubmissionsEnabled()) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const parsed = VideoEditBody.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const body = parsed.data;

  // The token is checked against the id it was minted for, so one handed out
  // for another submission cannot be replayed here. A session is what the
  // author is, and the two are never mixed: a bad token is a refusal rather
  // than a quiet fall back to whoever happens to be signed in.
  let actor: EditActor;
  if (body.token) {
    const moderatorId = verifyVideoEditToken(body.token, body.id);
    if (!moderatorId) {
      return Response.json({ error: "invalid_token" }, { status: 403 });
    }
    actor = { kind: "moderator", discordId: moderatorId };
  } else {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Response.json({ error: "unauthenticated" }, { status: 401 });
    }
    actor = { kind: "author", userId: session.user.id };
  }

  const competitive = isCompetitiveFormat(body.format);
  // A random battle without its vehicle has nowhere to live: the tank page is
  // the only place it would be looked up.
  if (!competitive && !body.tankSlug) {
    return Response.json({ error: "tank_required" }, { status: 400 });
  }

  // Together, like on the way in: none of the three reads the others, and each
  // can reach for a catalogue that has to be rebuilt.
  const [map, tank, clan] = await Promise.all([
    resolveBattleMap(region, body.arenaId),
    body.tankSlug
      ? getTankBySlug(region, decodeURIComponent(body.tankSlug))
      : null,
    // Refused rather than dropped, like on the way in: a typo in a tag would
    // otherwise cost someone the credit they asked for, silently.
    body.clanTag ? getClanByTagCached(region, body.clanTag) : null,
  ]);
  if (!map) return Response.json({ error: "not_found" }, { status: 404 });
  if (body.tankSlug && !tank) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (body.clanTag && !clan) {
    return Response.json({ error: "clan_not_found" }, { status: 404 });
  }

  const result = await editTankVideo(
    {
      id: body.id,
      region,
      url: body.url,
      startSeconds: body.startSeconds,
      tankId: tank?.tankId ?? null,
      tankName: tank?.meta.name ?? null,
      tankSlug: tank?.slug ?? null,
      arenaId: body.arenaId,
      mapName: map.name,
      mapSlug: map.slug,
      mode: body.mode,
      spawnTeam: body.spawnTeam as 1 | 2,
      result: body.result,
      format: body.format,
      combinedDamage: competitive ? null : (body.combinedDamage ?? null),
      teamSize: body.teamSize ?? null,
      tier: body.tier ?? null,
      clanRegion: clan ? region : null,
      clanId: clan?.info.id ?? null,
      clanTag: clan?.info.tag ?? null,
    },
    actor,
  );

  switch (result.outcome) {
    case EditVideoOutcome.Saved:
      // Both sides, since an edit can move a video: the pages it left have to
      // stop showing it, and the ones it landed on have to be ready for it.
      // After the response: it resolves a tank, a map and a clan from ids and
      // then drops up to a dozen paths, none of which the author is waiting to
      // hear about, and the correction is stored whatever it does.
      if (result.before && result.after) {
        // Renamed on the way out: the placement it landed on and the hook that
        // runs after the response are both spelled "after".
        const { before, after: landed } = result;
        after(() => revalidateVideoMove(before, landed));
      }
      // Its own task, so a Discord round trip cannot delay dropping a page
      // that is currently showing a video the correction took down.
      if (result.finish) after(result.finish);
      return jsonResponse(
        VideoEditResponse,
        { ok: true, requeued: Boolean(result.requeued) },
        { headers: { "cache-control": "no-store" } },
      );
    case EditVideoOutcome.NotFound:
      return Response.json({ error: "not_found" }, { status: 404 });
    case EditVideoOutcome.Forbidden:
      return Response.json({ error: "forbidden" }, { status: 403 });
    case EditVideoOutcome.Duplicate:
      return Response.json({ error: "duplicate" }, { status: 409 });
    case EditVideoOutcome.Unreachable:
      return Response.json({ error: "video_unreachable" }, { status: 422 });
    case EditVideoOutcome.Disabled:
      return Response.json({ error: "not_found" }, { status: 404 });
    default:
      return Response.json({ error: "invalid_url" }, { status: 400 });
  }
}
