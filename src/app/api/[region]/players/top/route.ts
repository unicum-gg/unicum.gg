import {
  getTopPlayersByWnx,
  TopPlayersPeriod,
  type TopPlayerResult,
} from "@/services/wargaming/wot/players/top";
import { isRegion } from "@/services/wargaming/wot";

export type TopPlayersResponse = {
  results: TopPlayerResult[];
  computed_at: string | null;
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

function parsePeriod(value: string | null): TopPlayersPeriod {
  if (value === TopPlayersPeriod.Day) return TopPlayersPeriod.Day;
  if (value === TopPlayersPeriod.Week) return TopPlayersPeriod.Week;
  return TopPlayersPeriod.Overall;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const url = new URL(req.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT),
  );

  try {
    const { results, computedAt } = await getTopPlayersByWnx(
      region,
      period,
      limit,
    );
    return Response.json({
      results,
      computed_at: computedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error(`[api/${region}/players/top] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
