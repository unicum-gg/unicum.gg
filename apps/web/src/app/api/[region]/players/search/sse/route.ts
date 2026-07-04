import { discoverPlayersBackground } from "@unicum.gg/core/discovery/players";
import { searchPlayersLocal } from "@unicum.gg/core/players/search-local";
import { findPlayersByPrefix } from "@unicum.gg/core/wargaming/wot/accounts";
import {
  getPlayerClansBatch,
  type PlayerClanInfo,
} from "@unicum.gg/core/wargaming/wot/clans/listings";
import type { SearchPlayerResult } from "../route";
import * as S from "@/services/openapi/schemas";
import { isRegion } from "@unicum.gg/wargaming/region";

export const dynamic = "force-dynamic";

/** One NDJSON line of the streamed search response. `local` (from our DB) is
 * emitted first and near-instantly; `remote` (from the WG API, deduped against
 * local) streams in after. */
export type PlayerSearchChunk = {
  source: "local" | "remote";
  results: SearchPlayerResult[];
};

/**
 * Streaming player search (internal, powers the search dialog). Emits NDJSON: a
 * `local` chunk from our database first (instant), then a `remote` chunk from
 * the rate-limited WG API (deduped) as it arrives, so results paint before the
 * WG call returns. The public JSON endpoint lives at `../route.ts`.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ region: string }> },
) {
  const { region } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const parsed = S.searchQuery.safeParse({ q });
  if (!parsed.success) {
    return new Response(`${JSON.stringify({ source: "local", results: [] })}\n`, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8" },
    });
  }
  const query = parsed.data.q;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (chunk: PlayerSearchChunk) =>
        controller.enqueue(enc.encode(`${JSON.stringify(chunk)}\n`));

      // Fire the local DB query and the live WG lookup together; the DB nearly
      // always wins the race, so results paint before the rate-limited WG call
      // (which may sit behind a busy token bucket) ever returns.
      const localP = searchPlayersLocal(region, query, 5).catch(() => []);
      const remoteP = (async (): Promise<SearchPlayerResult[]> => {
        const raw = await findPlayersByPrefix(region, query, 5);
        const clans =
          raw.length > 0
            ? await getPlayerClansBatch(
                region,
                raw.map((p) => p.account_id),
              )
            : new Map<number, PlayerClanInfo>();
        return raw.map((p) => ({
          account_id: p.account_id,
          nickname: p.nickname,
          clan: clans.get(p.account_id) ?? null,
        }));
      })().catch((err) => {
        console.error(`[api/${region}/players/search/sse] remote failed:`, err);
        return [] as SearchPlayerResult[];
      });

      const local = await localP;
      send({ source: "local", results: local });

      const seen = new Set(local.map((r) => r.account_id));
      const remote = (await remoteP).filter((r) => !seen.has(r.account_id));
      send({ source: "remote", results: remote });

      discoverPlayersBackground(
        region,
        [...local, ...remote].map((r) => ({
          accountId: r.account_id,
          nickname: r.nickname,
        })),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
