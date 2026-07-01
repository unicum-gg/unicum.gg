import { eq } from "drizzle-orm";
import { db } from "@/services/db";
import { clansByRegion } from "@/services/db/schema";
import { getClanTankAggregates } from "@/services/clans/repository/tanks";
import { isRegion } from "@/services/wargaming/wot";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";

/**
 * Internal data endpoint backing the clan page's "Tanks" tab. Kept out of the
 * initial page payload because the per-member tank aggregation is the heavy
 * query on this page; the tab is fetched on demand (and cached client-side by
 * SWR) so a visitor who only reads the Overview never pays for it. Not part of
 * the public API (no `@openapi` block), so `next-openapi-gen` skips it.
 *
 * WN8/WNX expected values are `Map`s, which JSON can't carry, so they're
 * emitted as `[tankId, value]` entry arrays and rebuilt into `Map`s client-side.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ region: string; tag: string }> },
) {
  const { region, tag } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const decoded = decodeURIComponent(tag).toLowerCase();
  const clans = clansByRegion[region];
  const [row] = await db
    .select({ id: clans.id })
    .from(clans)
    .where(eq(clans.tagLower, decoded))
    .limit(1);
  if (!row) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const [aggregates, encyclopedia, wn8Expected, wnxExpected] =
      await Promise.all([
        getClanTankAggregates(region, Number(row.id)),
        getVehicleEncyclopedia(region),
        getWN8ExpectedValues(),
        getWNXExpectedValues(),
      ]);
    return Response.json({
      aggregates,
      encyclopedia,
      wn8Expected: [...wn8Expected.entries()],
      wnxExpected: [...wnxExpected.entries()],
    });
  } catch (err) {
    console.error(`[api/${region}/clans/${decoded}/vehicles] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
