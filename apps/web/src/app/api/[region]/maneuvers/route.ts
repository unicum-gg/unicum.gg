import { isRegion } from "@unicum.gg/wargaming";
import { attachClanBadges } from "@/services/clans/attach-badges";
import { attachPlayerCrests } from "@/services/players/attach-badges";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import {
  ManeuversBoardKind,
  ManeuversOrder,
  ManeuversSort,
} from "@unicum.gg/shared";
import {
  DEFAULT_LIMIT,
  getManeuversBoardPage,
} from "@/services/maneuvers/board-query";
import { ManeuversBoardResponse } from "./schema.api";

/**
 * Maneuvers event boards
 * @description A Maneuvers edition for the region (the current one unless `edition` names another), the recurring Stronghold clan event: its dates and reward cutoffs, the player and clan boards ranked by Fame Points (paged, searchable and sortable across the whole board), and what it currently costs to hold a rewarded place. Both boards describe the same instant. Cached ~1 min server-side.
 * @pathParams regionParams
 * @queryParams maneuversQuery
 * @response ManeuversBoardResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/maneuvers", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const search = new URL(req.url).searchParams;
  const board = await getManeuversBoardPage(region, {
    eventName: search.get("edition") || null,
    board: oneOf(ManeuversBoardKind, search.get("board")),
    limit: Number(search.get("limit")) || DEFAULT_LIMIT,
    offset: Number(search.get("offset")) || 0,
    sort: oneOf(ManeuversSort, search.get("sort")) ?? ManeuversSort.FamePoints,
    order: oneOf(ManeuversOrder, search.get("order")) ?? ManeuversOrder.Desc,
    q: search.get("q") || null,
    range: oneOf(ManeuversSort, search.get("range")),
    min: numberOrNull(search.get("min")),
    max: numberOrNull(search.get("max")),
  });
  // Crests and placings are attached here, at the API boundary, rather than in
  // the cached board read: they live in the auth and ranking tables, not the
  // event's own, and a few batched indexed lookups keep the whole page's rows
  // in step with who is verified or where a clan sits on the other boards.
  const [players, decoratedClans] = await Promise.all([
    attachPlayerCrests(region, board.players),
    attachClanBadges(
      region,
      board.clans.map((c) => ({ ...c, clan_id: c.clanId })),
    ),
  ]);
  const clans = decoratedClans.map(({ clan_id, ...rest }) => {
    void clan_id;
    return rest;
  });
  return jsonResponse(ManeuversBoardResponse, { ...board, players, clans });
}

/** A query value read as one of an enum's members, null when it is not. */
function oneOf<E extends Record<string, string>>(
  values: E,
  raw: string | null,
): E[keyof E] | null {
  return (Object.values(values) as string[]).includes(raw ?? "")
    ? (raw as E[keyof E])
    : null;
}

/** A finite number, or null for an absent or unreadable one. */
function numberOrNull(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
