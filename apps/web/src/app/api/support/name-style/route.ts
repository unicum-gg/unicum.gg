import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { parseNameStyle } from "@unicum.gg/shared";
import { auth } from "@unicum.gg/core/auth";
import { setNameStyle } from "@unicum.gg/core/subscription";

export const dynamic = "force-dynamic";

/**
 * Save how the logged-in user's nickname is drawn, or clear it. Body:
 * `{ style: NameStyle | null }`. 401 if not logged in, 400 for a style naming a
 * font, effect or colour that does not exist. Answers with the style saved.
 *
 * Open before any money has moved, like the anonymity switch: the site only
 * draws it while the pledge is running.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { style?: unknown };
  try {
    body = (await request.json()) as { style?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const style = body.style === null ? null : parseNameStyle(body.style);
  if (body.style !== null && !style) {
    return NextResponse.json({ error: "invalid_style" }, { status: 400 });
  }
  await setNameStyle(session.user.id, style);
  return NextResponse.json({ ok: true, style });
}
