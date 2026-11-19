import { headers } from "next/headers";
import { isRegion } from "@unicum.gg/wargaming";
import { auth } from "@unicum.gg/core/auth";
import { removeOwnBattleComment } from "@unicum.gg/core/battles/comments";
import { jsonResponse } from "@/services/openapi/json-response";
import { BattleCommentDeleteBody, BattleCommentDeleteResponse } from "./schema.api";

export const dynamic = "force-dynamic";

/**
 * Delete a battle comment
 * @description Take down one of the caller's own comments, whether it is still waiting on a moderator or already published. 401 when signed out, 404 when the comment is not the caller's or is already gone.
 * @pathParams battleParams
 * @body BattleCommentDeleteBody
 * @response BattleCommentDeleteResponse
 * @tag Players
 * @openapi
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ region: string; id: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  const parsed = BattleCommentDeleteBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const removed = await removeOwnBattleComment(parsed.data.id, session.user.id);
  if (!removed) return Response.json({ error: "not_found" }, { status: 404 });
  return jsonResponse(
    BattleCommentDeleteResponse,
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}
