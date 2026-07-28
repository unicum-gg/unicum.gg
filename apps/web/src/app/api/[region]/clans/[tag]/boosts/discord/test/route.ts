import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@unicum.gg/core/auth";
import { isRegion } from "@unicum.gg/wargaming";
import { sendDiscordTest } from "@unicum.gg/core/clans/boost-workflow/discord-settings";

// Post a test notification to the clan's configured channel. Officer only.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ region: string; tag: string }> };

export async function POST(_req: Request, { params }: Params): Promise<Response> {
  const { region } = await params;
  if (!isRegion(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  const result = await sendDiscordTest(region, session?.user?.id);
  if (!result.ok) {
    const status = result.error === "no_destination" ? 400 : 403;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
