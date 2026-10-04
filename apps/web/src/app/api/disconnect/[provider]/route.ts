import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { isConnectableProvider } from "@unicum.gg/shared";
import { auth } from "@unicum.gg/core/auth";
import {
  DisconnectResult,
  disconnectProvider,
} from "@unicum.gg/core/auth/connections";

export const dynamic = "force-dynamic";

/**
 * Disconnect one of the accounts a player connected themselves.
 *
 * One handler for both providers rather than a route each, with the provider
 * read off the path and checked against `isConnectableProvider`. That check is
 * the security boundary, not a validation nicety: the same `account` table
 * holds the `wargaming` row, which is the account's identity, so a path segment
 * reaching the delete unchecked would let a reader sign their own account out
 * of existence. The allowlist lives beside the enum, so a provider added later
 * is connectable here by being declared rather than by this file being edited.
 *
 * POST because it changes state, so a prefetch, a crawler or an `<img>` cannot
 * reach it. Internal, like `/api/account/me`: there is nothing here for an
 * external caller, who has no session.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider } = await params;
  if (!isConnectableProvider(provider)) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await disconnectProvider(session.user.id, provider);
  // "There was nothing to disconnect" is the state the caller asked for, so it
  // answers 200: a reader with the page open in two tabs reaches it honestly,
  // and an error there would report a failure of something that is done.
  return NextResponse.json({
    ok: true,
    disconnected: result === DisconnectResult.Disconnected,
  });
}
