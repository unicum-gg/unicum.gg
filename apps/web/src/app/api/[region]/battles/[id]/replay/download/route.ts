import { isRegion } from "@unicum.gg/wargaming";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import {
  countReplayDownload,
  fetchReplay,
  storedReplayKey,
} from "@unicum.gg/core/battles/replays";

export const dynamic = "force-dynamic";

/**
 * The battle's own `.wotreplay` file, to watch in the game.
 *
 * Not part of the documented API: it answers bytes rather than JSON, and the
 * battle's `/replay` endpoint already gives everything the file says in a form
 * a program can read. This is the file itself, for a player who wants to open
 * it in their client, which only plays a replay on the build that recorded it
 * (the battle's page says which).
 *
 * The file never changes once archived, but each download is counted, so
 * only the browser keeps it.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ region: string; id: string }> },
) {
  const { region, id } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  if (!/^[0-9]{1,20}$/.test(id)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const battleId = normaliseBattleId(id);
  // Which recording: each participant who recorded the battle has their own.
  const raw = new URL(req.url).searchParams.get("recorder");
  const recorder = raw && /^[0-9]{1,15}$/.test(raw) ? Number(raw) : undefined;
  const key = await storedReplayKey(region, battleId, recorder);
  if (!key) return Response.json({ error: "not_found" }, { status: 404 });
  const bytes = await fetchReplay(key);
  if (!bytes) return Response.json({ error: "not_found" }, { status: 404 });
  if (recorder !== undefined) {
    // Counted here rather than in the browser, so a link opened from
    // anywhere counts. Never awaited into the answer.
    void countReplayDownload(region, battleId, recorder).catch(() => {});
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(bytes.length),
      // Named after the site and the battle, so a folder of downloads says
      // where each one came from and which battle it is.
      "content-disposition": `attachment; filename="unicum.gg_${region}_${battleId}${recorder ? `_${recorder}` : ""}.wotreplay"`,
      // Kept by the browser only, never by a shared cache: a download served
      // from the edge would never reach the counter above.
      "cache-control": "private, max-age=86400, immutable",
    },
  });
}
