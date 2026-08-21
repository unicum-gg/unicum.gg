import { revalidatePath } from "next/cache";
import { APP_IDENTITY, env } from "@unicum.gg/shared";
import { reviewTankVideo } from "@unicum.gg/core/tanks/videos";
import { getTankSlug } from "@unicum.gg/core/wargaming/wot/tanks/resolve";
import { getMapDetailBySlug } from "@unicum.gg/core/wargaming/wot/maps";
import { getClanTagById } from "@unicum.gg/core/clans/repository";
import { isRegion, REGIONS } from "@unicum.gg/wargaming";
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

  // A public link back to where the video now shows, handed to the bot so its
  // approval reply can point straight at it.
  let url: string | null = null;
  if (body.approved) {
    // The pages are cached, so an approved video would otherwise wait out the
    // revalidation window. Tanks and maps are the same on every region and the
    // videos are global, so all three regions carry it and all three are
    // dropped.
    const tankSlug =
      reviewed.tankId === null
        ? null
        : await getTankSlug(REGIONS[0], reviewed.tankId).catch(() => null);
    // A tactic has no tank page to drop, which is the whole reason the map page
    // exists for it.
    const map = reviewed.arenaId
      ? await getMapDetailBySlug(REGIONS[0], reviewed.arenaId).catch(() => null)
      : null;
    for (const region of REGIONS) {
      if (tankSlug) {
        revalidatePath(ROUTES.TANK(region, tankSlug));
        revalidatePath(`${ROUTES.TANK(region, tankSlug)}/videos`);
      }
      if (map) revalidatePath(ROUTES.MAP(region, map.slug));
    }
    // The clan credited, on its own region alone: unlike a tank or a map, a
    // clan exists on one region only, and the tag is resolved from the stored
    // id so a rename since the submission drops the page it is on today.
    const clanRegion = reviewed.clanRegion;
    if (clanRegion && isRegion(clanRegion) && reviewed.clanId !== null) {
      const clanTag = await getClanTagById(clanRegion, reviewed.clanId).catch(
        () => null,
      );
      if (clanTag) {
        // Both, like the tank above: the tab renders the list, and the profile
        // it hangs off seeds the "Videos (N)" the nav reads on first paint.
        revalidatePath(ROUTES.CLAN(clanRegion, clanTag));
        revalidatePath(`${ROUTES.CLAN(clanRegion, clanTag)}/videos`);
      }
    }
    // A random battle on a known tank lives on the tank page; a tactic only has
    // the map page. EU stands in for the canonical origin, the pages being
    // identical across regions.
    if (tankSlug) {
      url = `${APP_IDENTITY.URL}${ROUTES.TANK(REGIONS[0], tankSlug)}/videos`;
    } else if (map) {
      url = `${APP_IDENTITY.URL}${ROUTES.MAP(REGIONS[0], map.slug)}`;
    }
  }

  return Response.json({ status: reviewed.status, title: reviewed.title, url });
}
