import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { APP_IDENTITY } from "@unicum.gg/shared";
import { listBotGuilds } from "@unicum.gg/core/discord";
import STORAGE from "@/constants/storage";
import {
  completeBoostConnect,
  completeDiscordInstall,
  DiscordInstallStatus,
  discordConfig,
} from "@/services/discord";

// Where Discord returns after the consent screen. By now the bot half of the
// authorization (`bot`/`applications.commands`) has already added the app to the
// server the user picked; here we finish the `guilds.join` half (add them to our
// community server) and land them on `/bot` with a status flag.
export const dynamic = "force-dynamic";

function landing(status: DiscordInstallStatus): Response {
  const url = new URL("/bot", APP_IDENTITY.URL);
  url.searchParams.set("discord", status);
  const res = NextResponse.redirect(url);
  // One-shot state cookie: clear it however the callback resolves.
  res.cookies.set(STORAGE.COOKIES.DISCORD_OAUTH_STATE, "", { path: "/api/discord", maxAge: 0 });
  return res;
}

/** The boost-connect flow shares this redirect_uri; its own HttpOnly cookie
 * (region/tag/nonce) is present only for that flow, so it's the discriminator. */
async function handleBoostConnect(
  config: NonNullable<ReturnType<typeof discordConfig>>,
  req: Request,
  raw: string,
): Promise<Response> {
  let ctx: { n: string; url: string } | null = null;
  try {
    ctx = JSON.parse(raw);
  } catch {
    ctx = null;
  }
  const backTo = (status: string): NextResponse => {
    const dest = new URL(ctx?.url ?? "/", APP_IDENTITY.URL);
    if (ctx) dest.searchParams.set("discord", status);
    const res = NextResponse.redirect(dest);
    res.cookies.set(STORAGE.COOKIES.DISCORD_BOOST_STATE, "", {
      path: "/api/discord",
      maxAge: 0,
    });
    return res;
  };
  if (!ctx) return backTo("error");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code || state !== ctx.n) {
    return backTo("error");
  }
  const result = await completeBoostConnect(config, code).catch(() => null);
  if (!result) return backTo("error");

  const botGuilds = new Set((await listBotGuilds()).map((g) => g.id));
  const options = result.guilds.map((g) => ({
    id: g.id,
    name: g.name,
    botPresent: botGuilds.has(g.id),
  }));
  const res = backTo("connected");
  res.cookies.set(STORAGE.COOKIES.DISCORD_BOOST_GUILDS, JSON.stringify(options), {
    httpOnly: true,
    sameSite: "lax",
    secure: APP_IDENTITY.URL.startsWith("https://"),
    path: "/api",
    maxAge: 3600,
  });
  return res;
}

export async function GET(req: Request): Promise<Response> {
  const config = discordConfig();
  if (!config) return landing(DiscordInstallStatus.Error);

  // Same redirect for the boost-connect flow — routed by its own cookie.
  const boostRaw = (await cookies()).get(
    STORAGE.COOKIES.DISCORD_BOOST_STATE,
  )?.value;
  if (boostRaw) return handleBoostConnect(config, req, boostRaw);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // Discord adds `?error=access_denied` when the user cancels.
  if (url.searchParams.get("error") || !code || !state) return landing(DiscordInstallStatus.Error);

  // CSRF: the returned `state` must match the nonce we set at install time. An
  // attacker can't set our HttpOnly cookie, so a forged callback fails here.
  const cookieState = (await cookies()).get(STORAGE.COOKIES.DISCORD_OAUTH_STATE)?.value;
  if (!cookieState || cookieState !== state) return landing(DiscordInstallStatus.Error);

  const { joined } = await completeDiscordInstall(config, code).catch(() => ({
    joined: false,
  }));
  // The bot install already succeeded during authorization; `joined` only
  // reflects the community-server add, so a failure there still lands "installed".
  return landing(
    joined ? DiscordInstallStatus.Joined : DiscordInstallStatus.Installed,
  );
}
