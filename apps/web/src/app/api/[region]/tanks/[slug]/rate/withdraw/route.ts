import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@unicum.gg/core/auth";
import { getTankBySlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { deleteTankRating } from "@unicum.gg/core/tanks/ratings";
import { isRegion, REGIONS } from "@unicum.gg/wargaming";
import { jsonResponse } from "@/services/openapi/json-response";
import ROUTES from "@/constants/routes";
import { TankRateWithdrawResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Withdraw my rating
 * @description Take back this account's opinion of a vehicle, stars and written text together: what is being withdrawn is the whole verdict, not the sentence explaining it. A POST rather than a DELETE so it is reachable from the generated client, which speaks the two verbs the public API documents. Answering `removed: false` means there was nothing to take back, which is the outcome the caller asked for either way. 401 when signed out, 404 for an unknown tank.
 * @pathParams tankParams
 * @response TankRateWithdrawResponse
 * @tag Tanks
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

  const tank = await getTankBySlug(region, decodeURIComponent(slug));
  if (!tank) return Response.json({ error: "not_found" }, { status: 404 });

  const removed = await deleteTankRating(tank.tankId, session.user.id);
  if (removed) {
    for (const r of REGIONS) {
      revalidatePath(`${ROUTES.TANK(r, tank.slug)}/community`);
      revalidatePath(ROUTES.TANK(r, tank.slug));
    }
  }

  return jsonResponse(
    TankRateWithdrawResponse,
    { ok: true, removed },
    { headers: { "cache-control": "no-store" } },
  );
}
