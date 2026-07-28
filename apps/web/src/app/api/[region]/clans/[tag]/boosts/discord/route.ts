import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@unicum.gg/core/auth";
import { isRegion } from "@unicum.gg/wargaming";
import {
  getDiscordSettings,
  removeDiscordDestination,
  saveDiscordDestination,
} from "@unicum.gg/core/clans/boost-workflow/discord-settings";
import { listGuildChannels } from "@unicum.gg/core/discord";
import STORAGE from "@/constants/storage";

// Officer-only Discord destination settings. Session-authenticated, never
// cacheable, not part of the public API/SDK.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ region: string; tag: string }> };
type GuildOption = { id: string; name: string; botPresent: boolean };

async function userId(): Promise<string | undefined> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id;
}

/** The officer's servers, stashed by the OAuth connect callback (else null). */
async function connectedGuilds(): Promise<GuildOption[] | null> {
  const raw = (await cookies()).get(STORAGE.COOKIES.DISCORD_BOOST_GUILDS)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuildOption[];
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  const { region } = await params;
  if (!isRegion(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  const settings = await getDiscordSettings(region, await userId());
  return NextResponse.json({ ...settings, connected: await connectedGuilds() });
}

// Ids are Discord snowflakes: digits only. Constraining `channelId` to `\d+`
// also stops a `/`-bearing value from manipulating the bot REST path it's later
// interpolated into (`/channels/{channelId}/messages`).
const saveSchema = z.object({
  guildId: z.string().regex(/^\d+$/).max(32),
  channelId: z.string().regex(/^\d+$/).max(32),
  guildName: z.string().max(120).default(""),
  channelName: z.string().max(120).default(""),
});

export async function PUT(req: Request, { params }: Params): Promise<Response> {
  const { region } = await params;
  if (!isRegion(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  // The chosen server must be one the officer actually connected (their cookie),
  // so nobody can point notifications at an arbitrary guild.
  const guilds = await connectedGuilds();
  if (!guilds?.some((g) => g.id === parsed.data.guildId)) {
    return NextResponse.json({ error: "guild_not_connected" }, { status: 403 });
  }
  // The channel must belong to that guild, otherwise an officer could point the
  // bot at any channel it can see in any other guild (cross-guild relay).
  const channels = await listGuildChannels(parsed.data.guildId);
  if (!channels.some((c) => c.id === parsed.data.channelId)) {
    return NextResponse.json({ error: "channel_not_found" }, { status: 403 });
  }
  const result = await saveDiscordDestination(region, await userId(), parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json(result);
}

export async function DELETE(_req: Request, { params }: Params): Promise<Response> {
  const { region } = await params;
  if (!isRegion(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  const result = await removeDiscordDestination(region, await userId());
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
