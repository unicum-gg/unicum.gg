import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@unicum.gg/core/auth";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { deleteMapRating } from "@unicum.gg/core/maps/ratings";
import { isRegion, REGIONS } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import ROUTES from "@/constants/routes";
import { MapRateWithdrawResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Withdraw my map rating
 * @description Take back this account's opinion of a map, stars and written text together: what is being withdrawn is the whole verdict, not the sentence explaining it. A POST rather than a DELETE so it is reachable from the generated client, which speaks the two verbs the public API documents. Answering `removed: false` means there was nothing to take back, which is the outcome the caller asked for either way. 401 when signed out, 404 for an unknown map.
 * @pathParams mapParams
 * @response MapRateWithdrawResponse
 * @tag Maps
 * @openapi
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ region: string; slug: string }> },
) {
  const { region, slug } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const map = await getMapDetailBySlug(region, decodeURIComponent(slug));
  if (!map) return Response.json({ error: "not_found" }, { status: 404 });

  const removed = await deleteMapRating(map.arenaId, session.user.id);
  if (removed) {
    for (const r of REGIONS) {
      revalidatePath(`${ROUTES.MAP(r, map.slug)}/community`);
    }
  }

  return jsonResponse(
    MapRateWithdrawResponse,
    { ok: true, removed },
    { headers: { "cache-control": "no-store" } },
  );
}
