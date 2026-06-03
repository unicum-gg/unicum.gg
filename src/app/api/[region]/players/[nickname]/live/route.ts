import { sql } from "drizzle-orm";
import { db } from "@/services/db";
import { playersByRegion } from "@/services/db/schema";
import { playerChannel, subscribe } from "@/services/live/pubsub";
import { isRegion } from "@/services/wargaming/wot";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  const { region, nickname } = await params;
  if (!isRegion(region)) {
    return new Response("invalid_region", { status: 400 });
  }
  const decoded = decodeURIComponent(nickname);

  const players = playersByRegion[region];
  const [row] = await db
    .select({ accountId: players.accountId })
    .from(players)
    .where(sql`LOWER(${players.nickname}) = LOWER(${decoded})`)
    .limit(1);
  if (!row) {
    return new Response("not_found", { status: 404 });
  }
  const accountId = Number(row.accountId);
  const channel = playerChannel(region, accountId);

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

      send("connected", { region, accountId });

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
      "X-Accel-Buffering": "no",
    },
  });
}
