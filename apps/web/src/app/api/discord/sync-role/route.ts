import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@unicum.gg/shared";
import { auth } from "@unicum.gg/core/auth";
import { isSupporter } from "@unicum.gg/core/subscription";
import {
  getDiscordUserId,
  grantSupporterRole,
} from "@unicum.gg/core/discord/supporter-role";
import ROUTES from "@/constants/routes";
import { addUserToGuild, discordConfig } from "@/services/discord";

// Landing point after the Discord link (or a direct re-sync): re-check the user
// is an active supporter, make sure they are in our server, then have the bot
// grant the supporter role. Lands back on /support with a `?claim=` status.
export const dynamic = "force-dynamic";

function support(status: string): URL {
  const url = new URL(ROUTES.SUPPORT, env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("claim", status);
  return url;
}

export async function GET(): Promise<Response> {
  const requestHeaders = await headers();
  const config = discordConfig();
  if (!config) return NextResponse.redirect(support("error"));

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) return NextResponse.redirect(support("error"));
  if (!(await isSupporter(session.user.id))) {
    return NextResponse.redirect(support("not_supporter"));
  }

  const discordUserId = await getDiscordUserId(session.user.id);
  if (!discordUserId) return NextResponse.redirect(support("error"));

  // Best-effort: add them to our server first (a role can't be assigned to a
  // non-member; a no-op if they are already in). Needs their linked OAuth token,
  // which Better Auth hands back (refreshing if needed).
  try {
    const token = (await auth.api.getAccessToken({
      body: { providerId: "discord", userId: session.user.id },
      headers: requestHeaders,
    })) as { accessToken?: string } | null;
    if (token?.accessToken) {
      await addUserToGuild(config, discordUserId, token.accessToken).catch(
        () => {},
      );
    }
  } catch {
    // No usable token (revoked / refresh failed) — rely on existing membership.
  }

  const granted = await grantSupporterRole(discordUserId);
  return NextResponse.redirect(support(granted ? "ok" : "error"));
}
