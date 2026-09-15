import { eq } from "drizzle-orm";
import { computeClanRatings, clansByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { getClanByTagCached } from "@unicum.gg/core/clans/repository";
import { getClanMembersCached } from "@unicum.gg/core/clans/repository/members";
import { getClanNameHistory } from "@unicum.gg/core/clans/name-history";
import { resolveClanBadges } from "@unicum.gg/core/clans/badges";
import { countClanTournaments } from "@unicum.gg/core/tournaments/read";
import { withDeadline } from "@unicum.gg/core/lib/deadline";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { traced } from "@unicum.gg/core/lib/perf-trace";
import { isRegion } from "@unicum.gg/wargaming";
import { ClanOverviewResponse } from "./schema.api";

export const dynamic = "force-dynamic";

// How long this handler will WAIT for a cold resolve, which goes to Wargaming.
// Same bound, and the same reason, as the player detail route: on 2026-09-15
// this endpoint held 90 requests for up to 896 SECONDS each, which grew every
// web worker to its memory ceiling in about two minutes and had PM2 recycling
// them continuously, so the site went dark whenever several were cold at once.
// Cloudflare cuts at 100s, so nothing past that was ever delivered.
const COLD_DEADLINE_MS = 30_000;

/**
 * Clan overview
 * @description The clan's profile and its battle-weighted aggregate ratings (lifetime and 30-day WN7/WN8/WNX plus the average win rate). The heavy per-category data lives on the dedicated sub-endpoints: `/members`, `/previous-clans`, `/activity`, `/stronghold`, `/clan-wars` and `/vehicles`. 404 if the region's clan with this tag doesn't exist.
 * @pathParams clanLiveParams
 * @response ClanOverviewResponse
 * @tag Clans
 * @openapi
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string; tag: string }> },
) {
  return measured("GET /api/{region}/clans/{tag}", async () => {
    const { region, tag } = await params;
    if (!isRegion(region)) {
      return Response.json({ error: "invalid_region" }, { status: 400 });
    }
    const decoded = decodeURIComponent(tag);

    // Boxed so the deadline's null is distinguishable from the resolver's own
    // null, which means "no such clan" — racing them bare would answer 404 to a
    // clan that merely took too long, and the client could cache that.
    const resolved = await withDeadline(
      traced("clan resolve", () =>
        getClanByTagCached(region, decoded).then((clan) => ({ clan })),
      ),
      COLD_DEADLINE_MS,
    );
    if (resolved === null) {
      return Response.json(
        { error: "still_loading" },
        { status: 503, headers: { "retry-after": "5" } },
      );
    }
    const clanCached = resolved.clan;
    if (!clanCached) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const clans = clansByRegion[region];
    const [cached, nameHistory, countRow, badges, tournamentCount] =
      await traced("clan batch", () =>
        Promise.all([
          getClanMembersCached(region, clanCached.info.id).catch(() => null),
          getClanNameHistory(region, clanCached.info.id),
          db
            .select({
              vehiclesCount: clans.vehiclesCount,
              // The winner's crest, off the same row the vehicle count is on, so it
              // costs nothing extra.
              tournamentWins: clans.tournamentWins,
              tournamentFeaturedWins: clans.tournamentFeaturedWins,
              tournamentBestTitle: clans.tournamentBestTitle,
            })
            .from(clans)
            .where(eq(clans.id, clanCached.info.id))
            .limit(1)
            .then((rows) => rows[0] ?? null)
            .catch(() => null),
          // Podium positions, read from the ranks the hourly cron materialised. Two
          // indexed lookups, so this rides in the batch rather than costing a round
          // trip of its own.
          resolveClanBadges(region, [clanCached.info.id]).catch(
            () => new Map(),
          ),
          // Tournaments entered, for the "Tournaments (N)" tab label. An index scan
          // on the attribution denormalised onto the team row, so it rides this
          // batch rather than making the tab's own read happen on every section.
          countClanTournaments(region, clanCached.info.id).catch(() => 0),
        ]),
      );
    const ratings = computeClanRatings(cached?.members ?? []);
    return jsonResponse(ClanOverviewResponse, {
      clan: clanCached.info,
      ratings,
      nameHistory,
      vehiclesCount: countRow?.vehiclesCount ?? null,
      badges: badges.get(clanCached.info.id) ?? [],
      tournamentWins: countRow?.tournamentWins ?? 0,
      tournamentFeaturedWins: countRow?.tournamentFeaturedWins ?? 0,
      tournamentBestTitle: countRow?.tournamentBestTitle ?? null,
      tournamentCount,
    });
  });
}
