import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isRegion } from "@unicum.gg/wargaming";
import { listGuildChannels } from "@unicum.gg/core/discord";
import STORAGE from "@/constants/storage";

// The postable channels of a server the officer connected. Gated on the guild
// being in their connect cookie, so nobody can enumerate an arbitrary guild.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ region: string; tag: string }> };
type GuildOption = { id: string; name: string; botPresent: boolean };

export async function GET(req: Request, { params }: Params): Promise<Response> {
  const { region } = await params;
  if (!isRegion(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  const guildId = new URL(req.url).searchParams.get("guildId");
  if (!guildId) {
    return NextResponse.json({ error: "missing_guild" }, { status: 400 });
  }
  const raw = (await cookies()).get(STORAGE.COOKIES.DISCORD_BOOST_GUILDS)?.value;
  let guilds: GuildOption[] = [];
  try {
    guilds = raw ? (JSON.parse(raw) as GuildOption[]) : [];
  } catch {
    guilds = [];
  }
  if (!guilds.some((g) => g.id === guildId)) {
    return NextResponse.json({ error: "guild_not_connected" }, { status: 403 });
  }
  return NextResponse.json({ channels: await listGuildChannels(guildId) });
}
