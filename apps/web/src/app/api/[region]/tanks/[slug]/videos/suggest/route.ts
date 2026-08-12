import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@unicum.gg/core/auth";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import {
  submitTankVideo,
  SubmitVideoOutcome,
  videoSubmissionsEnabled,
} from "@unicum.gg/core/tanks/videos";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import ROUTES from "@/constants/routes";
import { TankVideoSuggestBody, TankVideoSuggestResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Suggest a tank video
 * @description Queue a YouTube link for moderation. Requires a signed-in Wargaming account, so a suggestion always carries who made it. The link must be a YouTube video we can embed, and its timestamp is what marks the battle. The map and mode are validated against the catalogue, so a battle cannot be filed under a map that never runs that mode. Nothing is published here: a moderator approves it first. 401 when signed out, 404 when submissions are unconfigured, 409 when that exact battle was already submitted.
 * @pathParams tankParams
 * @body TankVideoSuggestBody
 * @response TankVideoSuggestResponse
 * @tag Tanks
 * @openapi
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
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

  const parsed = TankVideoSuggestBody.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const tank = await getTankBySlug(region, decodeURIComponent(slug));
  if (!tank) return Response.json({ error: "not_found" }, { status: 404 });

  const result = await submitTankVideo({
    tankId: tank.tankId,
    tankName: tank.meta.name,
    tankSlug: tank.slug,
    region,
    url: parsed.data.url,
    startSeconds: parsed.data.startSeconds,
    arenaId: parsed.data.arenaId,
    mode: parsed.data.mode,
    spawnTeam: parsed.data.spawnTeam as 1 | 2,
    result: parsed.data.result,
    userId: session.user.id,
    submitterName: session.user.name ?? "unknown",
  });

  switch (result.outcome) {
    case SubmitVideoOutcome.Queued:
      // The tab is served from a cached page, so a video approved later would
      // otherwise wait out the revalidation window. Nothing is published yet,
      // but priming here keeps the approval path to a single revalidation.
      revalidatePath(ROUTES.TANK(region, tank.slug));
      return jsonResponse(
        TankVideoSuggestResponse,
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
