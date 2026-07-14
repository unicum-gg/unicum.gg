import { SearchSource } from "@unicum.gg/core/search";
import type { ClanSearchResult } from "@unicum.gg/core/wargaming/wot/clans/search";
import * as S from "@/services/openapi/schemas";
import { isRegion } from "@unicum.gg/wargaming";
import {
  discoverClans,
  searchClansLocalPart,
  searchClansRemotePart,
} from "../shared";

export const dynamic = "force-dynamic";

/** One NDJSON line of the streamed search response. The `local` chunk (from our
 * database) is emitted first and near-instantly; the `remote` chunk (from the
 * Wargaming API, deduped against local) streams in after. */
export type ClanSearchChunk = {
  source: SearchSource;
  results: ClanSearchResult[];
};

/**
 * Search clans (streamed)
 * @description Search clans by name or tag prefix (minimum 3 characters). Streams NDJSON (one JSON object per line): a `local` chunk from our database first (instant), then a `remote` chunk from the Wargaming API (deduped against local) as it arrives. For a single combined JSON response, use `/search`.
 * @pathParams regionParams
 * @queryParams searchQuery
 * @response ClanSearchChunk
 * @tag Clans
 * @openapi
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
      { headers: { "content-type": "application/x-ndjson; charset=utf-8" } },
    );
  }
  const query = parsed.data.q;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (chunk: ClanSearchChunk) =>
        controller.enqueue(enc.encode(`${JSON.stringify(chunk)}\n`));

      const localP = searchClansLocalPart(region, query);
      const remoteP = searchClansRemotePart(region, query);

      const local = await localP;
      send({ source: SearchSource.Local, results: local });

      const seen = new Set(local.map((r) => r.clan_id));
      const remote = (await remoteP).filter((r) => !seen.has(r.clan_id));
      send({ source: SearchSource.Remote, results: remote });

      discoverClans(region, [...local, ...remote]);
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
