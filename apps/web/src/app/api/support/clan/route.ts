import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import { setSupportClan } from "@unicum.gg/core/subscription/clan";

export const dynamic = "force-dynamic";

/**
 * Count the logged-in user's support for their current clan, or for nobody.
 * Body: `{ dedicate: boolean }`. 401 if not logged in. Answers with the clan it
 * now counts for, which is null when they asked for nobody or are clanless.
 *
 * The clan is never taken from the body: it is the one our player row says
 * they belong to, so nobody can put their name behind a clan they are not in.
 * Open before any money has moved, like the anonymity switch.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let dedicate = false;
  try {
    const body = (await request.json()) as { dedicate?: unknown };
    dedicate = !!body.dedicate;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const clan = await setSupportClan(session.user.id, dedicate);
  return NextResponse.json({ ok: true, clan });
}
