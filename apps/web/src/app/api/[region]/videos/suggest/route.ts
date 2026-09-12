import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@unicum.gg/core/auth";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { resolveBattleMap } from "@unicum.gg/core/wargaming/wot/maps";
import { getClanByTagCached } from "@unicum.gg/core/clans/repository";
import {
  submitTankVideo,
  SubmitVideoOutcome,
  videoSubmissionsEnabled,
} from "@unicum.gg/core/tanks/videos";
import { isCompetitiveFormat } from "@unicum.gg/shared";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import ROUTES from "@/constants/routes";
import { VideoSuggestBody, VideoSuggestResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Suggest a video
 * @description Queue a YouTube link for moderation. Requires a signed-in Wargaming account, so a suggestion always carries who made it. The link must be a YouTube video we can embed, and its timestamp is what marks the battle. A submission is filed under the map it was fought on, which is checked against the catalogue along with the mode, so a battle cannot be filed under a map that never runs it. A random battle also names the vehicle and the damage; a competitive battle names neither, since a tactic belongs to the ground and the side rather than to one player's game. Nothing is published here: a moderator approves it first. 401 when signed out, 404 when submissions are unconfigured, 409 when that exact battle was already submitted.
 * @pathParams regionParams
 * @body VideoSuggestBody
 * @response VideoSuggestResponse
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
  // Unconfigured means no moderator could ever see the submission, so the
  // endpoint is absent rather than accepting videos into a queue nobody reads.
  if (!videoSubmissionsEnabled()) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = VideoSuggestBody.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const body = parsed.data;
  const competitive = isCompetitiveFormat(body.format);

  // A random battle without its vehicle has nowhere to live: the tank page is
  // the only place it would be looked up, and the map pages present random
  // battles by the tank they were played in.
  if (!competitive && !body.tankSlug) {
    return Response.json({ error: "tank_required" }, { status: 400 });
  }

  // Three independent lookups, resolved together: none of them reads the
  // others, and each can reach for a catalogue that has to be rebuilt, so in
  // series they were three cold reads a person waits through one after another.
  const [map, tank, clan] = await Promise.all([
    resolveBattleMap(region, body.arenaId),
    body.tankSlug
      ? getTankBySlug(region, decodeURIComponent(body.tankSlug))
      : null,
    // Refused rather than dropped: a typo in a tag would otherwise cost someone
    // the credit they asked for, silently. Read from our own table only: a clan
    // we have never tracked has no page to credit it on.
    body.clanTag ? getClanByTagCached(region, body.clanTag) : null,
  ]);
  if (!map) return Response.json({ error: "not_found" }, { status: 404 });
  if (body.tankSlug && !tank) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (body.clanTag && !clan) {
    return Response.json({ error: "clan_not_found" }, { status: 404 });
  }

  const result = await submitTankVideo({
    tankId: tank?.tankId ?? null,
    tankName: tank?.meta.name ?? null,
    tankSlug: tank?.slug ?? null,
    mapName: map.name,
    mapSlug: map.slug,
    region,
    url: body.url,
    startSeconds: body.startSeconds,
    arenaId: body.arenaId,
    mode: body.mode,
    spawnTeam: body.spawnTeam as 1 | 2,
    result: body.result,
    format: body.format,
    // Only ever stored for a random battle: on a tactic the number is one
    // player's game, which is not what the row is for.
    combinedDamage: competitive ? null : (body.combinedDamage ?? null),
    teamSize: body.teamSize ?? null,
    tier: body.tier ?? null,
    clanRegion: clan ? region : null,
    clanId: clan?.info.id ?? null,
    clanTag: clan?.info.tag ?? null,
    userId: session.user.id,
    submitterName: session.user.name ?? "unknown",
  });

  switch (result.outcome) {
    case SubmitVideoOutcome.Queued:
      // The pages are served from cache, so a video approved later would
      // otherwise wait out the revalidation window. Nothing is published yet,
      // but priming here keeps the approval path to a single revalidation.
      // After the response, since it primes a page for a moderator who has not
      // even been told yet, and the submitter is watching a button.
      after(() => {
        revalidatePath(ROUTES.MAP(region, map.slug));
        if (tank) revalidatePath(ROUTES.TANK(region, tank.slug));
      });
      // The card and the version stamp, in their own task rather than with the
      // revalidation above: the stamp is a WG read that can take minutes on a
      // throttled host, and dropping two cached pages must not queue behind it.
      if (result.finish) after(result.finish);
      return jsonResponse(
        VideoSuggestResponse,
        { ok: true },
        { headers: { "cache-control": "no-store" } },
      );
    case SubmitVideoOutcome.Duplicate:
      return Response.json({ error: "duplicate" }, { status: 409 });
    case SubmitVideoOutcome.Unreachable:
      return Response.json({ error: "video_unreachable" }, { status: 422 });
    case SubmitVideoOutcome.Disabled:
      return Response.json({ error: "not_found" }, { status: 404 });
    default:
      return Response.json({ error: "invalid_url" }, { status: 400 });
  }
}
