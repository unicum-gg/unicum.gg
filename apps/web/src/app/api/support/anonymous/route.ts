import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import { setAnonymous } from "@unicum.gg/core/subscription";

export const dynamic = "force-dynamic";

/**
 * Toggle whether the logged-in supporter is shown anonymously on the podium.
 * Body: `{ anonymous: boolean }`. 401 if not logged in.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let anonymous = false;
  try {
    const body = (await request.json()) as { anonymous?: unknown };
    anonymous = !!body.anonymous;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  await setAnonymous(session.user.id, anonymous);
  return NextResponse.json({ ok: true, anonymous });
}
