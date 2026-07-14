import { eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { clansByRegion } from "@unicum.gg/core/db/schema";
import { clanChannel, subscribe } from "@unicum.gg/core/live/pubsub";
import { isRegion } from "@unicum.gg/wargaming";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

/**
 * Clan live stream
 * @description Server-sent events (SSE) for live clan profile updates.
 * @pathParams clanLiveParams
 * @responseDescription Server-sent event stream of live updates.
 * @tag Clans
 * @openapi
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ region: string; tag: string }> },
) {
  const { region, tag } = await params;
  if (!isRegion(region)) {
    return new Response("invalid_region", { status: 400 });
  }
  const tagLower = decodeURIComponent(tag).toLowerCase();

  const clans = clansByRegion[region];
  const [row] = await db
    .select({ id: clans.id })
    .from(clans)
    .where(eq(clans.tagLower, tagLower))
    .limit(1);
  if (!row) {
    return new Response("not_found", { status: 404 });
  }
  const clanId = Number(row.id);
  const channel = clanChannel(region, clanId);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // controller closed
        }
      }

      // Initial connect event so the client knows the stream is alive
      send("connected", { region, clanId });

      unsubscribe = subscribe(channel, (data) => {
        send("update", data);
      });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // closed
        }
      }, HEARTBEAT_MS);

      const onAbort = () => {
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", onAbort);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering if behind one
    },
  });
}
