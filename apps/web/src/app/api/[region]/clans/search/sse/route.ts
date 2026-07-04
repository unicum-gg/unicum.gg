import { searchClansLocal } from "@unicum.gg/core/clans/search-local";
import { discoverClansBackground } from "@unicum.gg/core/discovery/clans";
import { SearchSource } from "@unicum.gg/core/search";
import {
  findClansByPrefix,
  type ClanSearchResult,
} from "@unicum.gg/core/wargaming/wot/clans/search";
import * as S from "@/services/openapi/schemas";
import { isRegion } from "@unicum.gg/wargaming/region";

export const dynamic = "force-dynamic";

/** One NDJSON line of the streamed search response. `local` (from our DB) is
 * emitted first and near-instantly; `remote` (from the WG API, deduped against
 * local) streams in after. */
export type ClanSearchChunk = {
  source: SearchSource;
  results: ClanSearchResult[];
};

/**
 * Streaming clan search (internal, powers the search dialog). Emits NDJSON: a
 * `local` chunk from our database first (instant), then a `remote` chunk from
 * the rate-limited WG API (deduped) as it arrives. The public JSON endpoint
 * lives at `../route.ts`.
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
    return new Response(
      `${JSON.stringify({ source: SearchSource.Local, results: [] })}\n`,
      {
        headers: { "content-type": "application/x-ndjson; charset=utf-8" },
      },
    );
  }
  const query = parsed.data.q;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (chunk: ClanSearchChunk) =>
        controller.enqueue(enc.encode(`${JSON.stringify(chunk)}\n`));

      const localP = searchClansLocal(region, query, 5).catch(() => []);
      const remoteP = findClansByPrefix(region, query, 5).catch((err) => {
        console.error(`[api/${region}/clans/search/sse] remote failed:`, err);
        return [] as ClanSearchResult[];
      });

      const local = await localP;
      send({ source: SearchSource.Local, results: local });

      const seen = new Set(local.map((r) => r.clan_id));
      const remote = (await remoteP).filter((r) => !seen.has(r.clan_id));
      send({ source: SearchSource.Remote, results: remote });

      discoverClansBackground(
        region,
        [...local, ...remote].map((r) => r.clan_id),
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
