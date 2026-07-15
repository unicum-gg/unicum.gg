import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { APP_IDENTITY } from "@unicum.gg/shared";
import STORAGE from "@/constants/storage";
import {
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

export async function GET(req: Request): Promise<Response> {
  const config = discordConfig();
  if (!config) return landing(DiscordInstallStatus.Error);

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
