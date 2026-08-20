import { headers } from "next/headers";
import { auth } from "@unicum.gg/core/auth";
import { listOwnRatings } from "@unicum.gg/core/tanks/ratings-board";
import { isRegion } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import { OwnRatingsResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * My ratings
 * @description Every vehicle the caller has rated, newest first. Its job is to let a page know what is already done: a signed-in player's own garage uses it to suggest the tanks they play most and have not judged yet, which is where most votes come from. Region-independent like the votes themselves, so the same list is served whichever region the page was opened on. Signed out answers an empty list rather than a 401: the caller is asking what they have rated, and "nothing" is the true answer.
 * @pathParams regionParams
 * @response OwnRatingsResponse
 * @tag Tanks
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
    return jsonResponse(OwnRatingsResponse, { ratings: [] }, noStore);
  }

  const ratings = await listOwnRatings(session.user.id);
  return jsonResponse(OwnRatingsResponse, { ratings }, noStore);
}
