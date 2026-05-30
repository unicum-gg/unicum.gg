import {
  findClansByPrefix,
  type ClanSearchResult,
} from "@/services/wargaming/wot/clans";
import { isRegion } from "@/services/wargaming/wot";

export const dynamic = "force-dynamic";

export type ClanSearchResponse = {
  results: ClanSearchResult[];
};

const MIN_QUERY_LENGTH = 3;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  if (q.length < MIN_QUERY_LENGTH) {
    return Response.json({ results: [] });
  }

  try {
    const results = await findClansByPrefix(region, q, 5);
    return Response.json({ results });
  } catch (err) {
    console.error(`[api/${region}/clans/search] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
