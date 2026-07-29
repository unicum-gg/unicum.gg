import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@unicum.gg/shared";
import { isRegion, Region } from "@unicum.gg/wargaming";
import { auth } from "@unicum.gg/core/auth";
import { isSupporter } from "@unicum.gg/core/subscription";
import {
  getDiscordUserId,
  isSupporterRoleEnabled,
} from "@unicum.gg/core/discord/supporter-role";
import ROUTES from "@/constants/routes";
import STORAGE from "@/constants/storage";

// Entry point for the supporter-role Discord link. Verifies the user is a
// logged-in active supporter, then either links their Discord account (Better
// Auth OAuth, the single canonical link) or — if already linked — jumps straight
// to the role sync. Either way it lands on /api/discord/sync-role, which grants
// the role and redirects to /support.
export const dynamic = "force-dynamic";

function support(status: string): URL {
  const url = new URL(ROUTES.SUPPORT, env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("claim", status);
  return url;
}

export async function GET(): Promise<Response> {
  const requestHeaders = await headers();
  if (!isSupporterRoleEnabled()) {
    return NextResponse.redirect(support("error"));
  }

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    const stored = (await cookies()).get(STORAGE.COOKIES.REGION)?.value;
    const region = stored && isRegion(stored) ? stored : Region.EU;
    return NextResponse.redirect(
      new URL(
        ROUTES.AUTH_SIGN_IN(region, "/api/connect/discord"),
        env.NEXT_PUBLIC_APP_URL,
      ),
    );
  }
  if (!(await isSupporter(session.user.id))) {
    return NextResponse.redirect(support("not_supporter"));
  }

  // Already linked → skip OAuth, straight to the role sync (re-sync).
  if (await getDiscordUserId(session.user.id)) {
    return NextResponse.redirect(
      new URL("/api/discord/sync-role", env.NEXT_PUBLIC_APP_URL),
    );
  }

  // Link Discord via Better Auth, then land on the sync route. `asResponse` hands
  // back the OAuth-state Set-Cookie headers, which must reach the browser for the
  // Discord callback to validate — forward them onto our own 302.
  let linkResponse: Response;
  try {
    linkResponse = await auth.api.linkSocialAccount({
      body: { provider: "discord", callbackURL: "/api/discord/sync-role" },
      headers: requestHeaders,
      asResponse: true,
    });
  } catch {
    return NextResponse.redirect(support("error"));
  }
  const { url } = (await linkResponse.json().catch(() => ({}))) as {
    url?: string;
  };
  if (!url) return NextResponse.redirect(support("error"));

  const res = NextResponse.redirect(url);
  const setCookies = (
    linkResponse.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();
  for (const cookie of setCookies ?? []) {
    res.headers.append("set-cookie", cookie);
  }
  return res;
}
