import {
  getTopClansByWnx,
  type TopClanResult,
} from "@/services/wargaming/wot/clans/top";
import { isRegion } from "@/services/wargaming/wot";

export type TopClansResponse = {
  results: TopClanResult[];
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

  const limitParam = new URL(req.url).searchParams.get("limit");
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, Number(limitParam) || DEFAULT_LIMIT),
  );

  try {
    const results = await getTopClansByWnx(region, limit);
    return Response.json({ results });
  } catch (err) {
    console.error(`[api/${region}/clans/top] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
