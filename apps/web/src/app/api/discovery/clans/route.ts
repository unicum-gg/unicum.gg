import { env } from "env";
import { discoverTopClanPlayers } from "@/services/discovery";
import { isRegion } from "@/services/wargaming/wot";

export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const region = url.searchParams.get("region") ?? "eu";
  const top = Number(url.searchParams.get("top") ?? "500");

  if (!isRegion(region)) {
    return new Response("Invalid region", { status: 400 });
  }
  if (!Number.isFinite(top) || top < 1 || top > 100000) {
    return new Response("Invalid top (1-100000)", { status: 400 });
  }

  const result = await discoverTopClanPlayers(region, top);
  return Response.json(result);
}
