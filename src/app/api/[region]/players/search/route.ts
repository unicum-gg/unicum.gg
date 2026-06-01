import { discoverPlayersBackground } from "@/services/discovery/players";
import { findPlayersByPrefix } from "@/services/wargaming/wot/accounts";
import {
  getPlayerClansBatch,
  type PlayerClanInfo,
} from "@/services/wargaming/wot/clans/listings";
import { isRegion } from "@/services/wargaming/wot";

export const dynamic = "force-dynamic";

export type SearchPlayerResult = {
  account_id: number;
  nickname: string;
  clan: PlayerClanInfo | null;
};

export type PlayerSearchResponse = {
  results: SearchPlayerResult[];
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
    const rawPlayers = await findPlayersByPrefix(region, q, 5);
    const clansByAccount =
      rawPlayers.length > 0
        ? await getPlayerClansBatch(
            region,
            rawPlayers.map((p) => p.account_id),
          )
        : new Map<number, PlayerClanInfo>();

    const results: SearchPlayerResult[] = rawPlayers.map((p) => ({
      account_id: p.account_id,
      nickname: p.nickname,
      clan: clansByAccount.get(p.account_id) ?? null,
    }));

    discoverPlayersBackground(
      region,
      results.map((r) => ({ accountId: r.account_id, nickname: r.nickname })),
    );

    return Response.json({ results });
  } catch (err) {
    console.error(`[api/${region}/players/search] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}
