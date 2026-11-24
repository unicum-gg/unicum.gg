import { isRegion } from "@unicum.gg/wargaming";
import { STAT_WINDOW_MAX, StatWindowUnit, clanStatWindow } from "@unicum.gg/shared";
import { getClanByTagCached } from "@unicum.gg/core/clans/repository";
import {
  getClanPeriodBaseline,
  getLatestClanSnapshot,
} from "@unicum.gg/core/clans/snapshots";
import { jsonResponse } from "@/services/openapi/json-response";
import { ClanStatWindowResponse } from "./schema.api";
import { measured } from "@/services/perf";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Clan stats over a custom window
 * @description The Stronghold and Clan Wars tables' period column for any number of days (1 to 365): the same figures as the 24h/7d/30d entries of `/stronghold` and `/clan-wars`, each one the difference between the clan's newest snapshot and the newest one at or before the window's start. A change that cannot honestly be attributed to the window (the snapshot before it is over twice as old) is null, while a figure that did not move reads 0. When we hold no snapshot that old the column covers everything since we started tracking the clan, and says so in `truncated`. Days only: a clan plays several tiers at once, so its last N battles name no single stretch of time. 400 on a missing or out-of-range `days`, 404 when the tag doesn't exist.
 * @pathParams clanLiveParams
 * @queryParams clanStatWindowQuery
 * @response ClanStatWindowResponse
 * @tag Clans
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/clans/{tag}/period", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string; tag: string }> },
) {
  const { region, tag } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const days = Number(new URL(req.url).searchParams.get("days"));
  if (!Number.isInteger(days) || days < 1 || days > STAT_WINDOW_MAX[StatWindowUnit.Days]) {
    return Response.json({ error: "invalid_window" }, { status: 400 });
  }
  const decoded = decodeURIComponent(tag);

  try {
    const cached = await getClanByTagCached(region, decoded);
    if (!cached) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const clanId = cached.info.id;
    const now = Date.now();
    const [latest, baseline] = await Promise.all([
      getLatestClanSnapshot(region, clanId),
      getClanPeriodBaseline(region, clanId, days * DAY_MS, now),
    ]);
    return jsonResponse(ClanStatWindowResponse, clanStatWindow(latest, baseline, days, now), {
      headers: { "cache-control": "public, max-age=60" },
    });
  } catch (err) {
    console.error(`[api/${region}/clans/${decoded}/period] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
