import { headers } from "next/headers";
import { isRegion } from "@unicum.gg/wargaming";
import { auth } from "@unicum.gg/core/auth";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import { battleCommentsOf } from "@unicum.gg/core/battles/comments";
import { reviewsEnabled } from "@unicum.gg/core/community/reviews-open";
import { jsonResponse } from "@/services/openapi/json-response";
import { BattleCommentsResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Battle comments
 * @description What players wrote under a battle's replay, oldest first. Every comment is read by a moderator before it is shown, so this answers the published ones; a signed-in reader is also given their own that are still waiting or were turned down, which nobody else sees. `inBattle` says whether the author fought in the battle.
 * @pathParams battleParams
 * @response BattleCommentsResponse
 * @tag Players
 * @openapi
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string; id: string }> },
) {
  const { region, id } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  if (!/^[0-9]{1,20}$/.test(id)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  const readerId = session?.user?.id ?? null;
  const comments = await battleCommentsOf(region, normaliseBattleId(id), readerId);
  return jsonResponse(
    BattleCommentsResponse,
    { comments, open: reviewsEnabled() },
    {
      headers: {
        // A signed-in reader's answer holds their own unpublished comments, so
        // it must never sit in a shared cache.
        "cache-control": readerId ? "private, no-store" : "public, max-age=0, s-maxage=60",
      },
    },
  );
}
