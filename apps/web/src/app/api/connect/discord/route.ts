import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@unicum.gg/shared";
import { auth } from "@unicum.gg/core/auth";
import { isSupporter } from "@unicum.gg/core/subscription";
import {
  getDiscordUserId,
  isSupporterRoleEnabled,
} from "@unicum.gg/core/discord/supporter-role";
import { startDiscordLink } from "@/services/discord/link";
import ROUTES from "@/constants/routes";
import { signInRegion } from "@/lib/auth-region";

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
    const region = signInRegion(await cookies());
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

  // Link Discord via Better Auth, then land on the sync route. Shared with
  // `/api/link/discord`, which performs the same link for its own reason.
  const started = await startDiscordLink(
    requestHeaders,
    "/api/discord/sync-role",
  );
  if (!started) return NextResponse.redirect(support("error"));

  const res = NextResponse.redirect(started.url);
  for (const cookie of started.setCookies) {
    res.headers.append("set-cookie", cookie);
  }
  return res;
}
