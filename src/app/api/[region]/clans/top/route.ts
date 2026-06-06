import { ratingMetricFromCookie } from "@/constants/rating";
import {
  getTopClansByMetric,
  type TopClanResult,
} from "@/services/wargaming/wot/clans/top";
import { isRegion } from "@/services/wargaming/wot";

export type TopClansResponse = {
  results: TopClanResult[];
  computed_at: string | null;
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 200;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, Number(limitParam) || DEFAULT_LIMIT),
  );
  // Caller may pin a metric via ?metric=wn7|wn8|wnx; otherwise default.
  const metric = ratingMetricFromCookie(url.searchParams.get("metric"));

  try {
    const { results, computedAt } = await getTopClansByMetric(
      region,
      metric,
      limit,
    );
    return Response.json({
      results,
      computed_at: computedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error(`[api/${region}/clans/top] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
