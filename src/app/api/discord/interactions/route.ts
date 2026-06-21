import { after } from "next/server";
import { env } from "env";
import { verifyDiscordRequest } from "@/services/discord/verify";
import { executeCommand } from "@/services/discord/commands";
import {
  InteractionResponseType,
  InteractionType,
  type Interaction,
} from "@/services/discord/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const publicKey = env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    // The CEO has not provisioned the Discord application yet (UNI-9). Fail
    // closed rather than accepting unverifiable traffic.
    return new Response("Discord bot not configured", { status: 503 });
  }

  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const rawBody = await req.text();

  const valid = await verifyDiscordRequest(
    publicKey,
    signature,
    timestamp,
    rawBody,
  );
  if (!valid) {
    return new Response("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody) as Interaction;

  if (interaction.type === InteractionType.Ping) {
    return Response.json({ type: InteractionResponseType.Pong });
  }

  if (interaction.type === InteractionType.ApplicationCommand) {
    // Ack inside Discord's 3s window, then do the WG work after the response
    // is flushed and edit the original message via the interaction token.
    after(() => executeCommand(interaction));
    return Response.json({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
    });
  }

  return new Response("unhandled interaction type", { status: 400 });
}
