import { headers } from "next/headers";
import { auth } from "@unicum.gg/core/auth";
import { listOwnMapRatings } from "@unicum.gg/core/maps/ratings-board";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { OwnMapRatingsResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * My map ratings
 * @description Every map the caller has rated, newest first. Its job is to let a page know what is already done, so the gallery can point a signed-in player at the maps they have not judged yet, which is where most votes come from. The vehicle twin is `GET /{region}/ratings/mine`. Region-independent like the votes themselves, so the same list is served whichever region the page was opened on. Signed out answers an empty list rather than a 401: the caller is asking what they have rated, and "nothing" is the true answer.
 * @pathParams regionParams
 * @response OwnMapRatingsResponse
 * @tag Maps
 * @openapi
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  // Never cached anywhere: this is one reader's own state, and a shared cache
  // holding it would hand one player's ratings to the next visitor.
  const noStore = { headers: { "cache-control": "private, no-store" } };

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return jsonResponse(OwnMapRatingsResponse, { ratings: [] }, noStore);
  }

  const ratings = await listOwnMapRatings(session.user.id);
  return jsonResponse(OwnMapRatingsResponse, { ratings }, noStore);
}
