import { revalidatePath } from "next/cache";
import { env } from "@unicum.gg/shared";
import { reviewTankVideo } from "@unicum.gg/core/tanks/videos";
import { getTankSlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { REGIONS } from "@unicum.gg/wargaming";
import ROUTES from "@/constants/routes";

export const dynamic = "force-dynamic";

/**
 * Settle a queued video suggestion. Called by the Discord bot when a moderator
 * presses Approve or Reject, never by a browser: the gateway process is the only
 * thing that sees those presses, and it has no database of its own.
 *
 * Not `@openapi`-tagged on purpose, so it stays out of the public document and
 * the SDK. Authorised by `CRON_SECRET`, the same shared secret the cron routes
 * use: the bot and the web are both our own services on the same private
 * network, and the moderator's identity is already established by Discord.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    approved?: boolean;
    moderatorId?: string;
  } | null;
  if (typeof body?.approved !== "boolean" || !body.moderatorId) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const reviewed = await reviewTankVideo(id, body.approved, body.moderatorId);
  // Null means unknown, or already settled by whoever pressed first. Not an
  // error: the bot turns it into "already handled" on the card.
  if (!reviewed) {
    return Response.json({ error: "already_reviewed" }, { status: 409 });
  }

  if (body.approved) {
    // The tank page is cached, so an approved video would otherwise wait out the
    // revalidation window. The tank is the same vehicle on every region and the
    // videos are global, so all three pages carry it and all three are dropped.
    const slug = await getTankSlug(REGIONS[0], reviewed.tankId).catch(() => null);
    if (slug) {
      for (const region of REGIONS) {
        revalidatePath(ROUTES.TANK(region, slug));
        revalidatePath(`${ROUTES.TANK(region, slug)}/videos`);
      }
    }
  }

  return Response.json({ status: reviewed.status, title: reviewed.title });
}
