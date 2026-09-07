import { env } from "@unicum.gg/shared";
import { signVideoEditToken } from "@unicum.gg/core/tanks/video-edit-token";
import { loadVideoPlacement } from "@unicum.gg/core/tanks/videos-read";
import { EDIT_PARAM, EDIT_TOKEN_KEY } from "@/components/videos/edit-param";
import { videoPageUrl } from "@/services/videos/revalidate";

export const dynamic = "force-dynamic";

/**
 * Hand a moderator a link that opens the correction dialog on one submission.
 *
 * Called by the Discord bot when the Edit button is pressed. The press is the
 * authority: who may press it is settled by the channel's own permissions, and
 * a link minted from one is good for that submission and half an hour, so
 * nothing standing is granted and there is no admin account to invent.
 *
 * The link is answered rather than posted with the card on purpose. A URL
 * inside a message lives as long as the message, which would leave the channel
 * holding permanent edit rights to every video ever submitted.
 *
 * It points at the page the video lives on rather than at a form of its own,
 * since that is where the dialog is mounted: the moderator lands on the tank or
 * the map the battle is filed under, with the form already open over it.
 *
 * Not `@openapi`-tagged, so it stays out of the public document and the SDK.
 * Authorised by `CRON_SECRET`, like the review route beside it.
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
    moderatorId?: string;
  } | null;
  if (!body?.moderatorId) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const placement = await loadVideoPlacement(id);
  if (!placement) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const page = await videoPageUrl(placement);
  // A row naming neither a tank we still have nor a map we can resolve has no
  // page to open the dialog over. It cannot happen for a row that went through
  // the form, and answering an honest error beats handing out a link to
  // nowhere.
  if (!page) {
    return Response.json({ error: "no_page" }, { status: 409 });
  }

  // The Discord id is what the token carries, and what gets recorded on the row
  // as the editor: the bot is the only thing that can put one in there.
  const token = signVideoEditToken(id, body.moderatorId);
  // The token goes in the fragment, which browsers never send: the query string
  // is posted to our analytics with every pageview, and a live credential for
  // one row has no business in someone else's logs.
  const url = `${page}?${EDIT_PARAM}=${id}#${EDIT_TOKEN_KEY}=${encodeURIComponent(token)}`;
  return Response.json({ url });
}
