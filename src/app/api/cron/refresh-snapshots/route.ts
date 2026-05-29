import { env } from "env";
import { refreshDuePlayers } from "@/services/snapshots/cron";

export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await refreshDuePlayers();
  return Response.json(result);
}
