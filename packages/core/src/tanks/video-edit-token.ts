import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@unicum.gg/shared";

/**
 * The moderator's ticket to the edit form, for one submission and one half
 * hour.
 *
 * Correcting someone else's submission needs an authority the site does not
 * otherwise have: there is no admin role, and there is no reason to invent one,
 * because moderation already happens somewhere that answers the question. Who
 * may press Approve is decided by Discord, in a channel only moderators can
 * see, so a press there is proof enough to hand back a link that carries the
 * same authority and no more.
 *
 * It is minted on the press rather than posted with the card, deliberately.
 * A link inside a message lives as long as the message, so the channel would
 * accumulate permanent edit rights to every video ever submitted; a link handed
 * back to one moderator, once, expires with the sitting they asked it in.
 *
 * Signed with `CRON_SECRET`, the same shared secret the bot already
 * authenticates to the API with, so this needs nothing deployed to work. The
 * token proves the bearer was handed it, never who they are to us: the Discord
 * id it carries is what gets recorded as the editor, and the bot is the only
 * thing that can put one in there.
 */

/** Long enough to correct a form, short enough that a link left in a browser
 * tab overnight is not a standing permission. */
const TTL_SECONDS = 30 * 60;

function sign(payload: string): string {
  return createHmac("sha256", env.CRON_SECRET).update(payload).digest("base64url");
}

/** `<payload>.<signature>`, both base64url, so the whole thing survives a query
 * string untouched. */
export function signVideoEditToken(id: number, moderatorId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = Buffer.from(`${id}.${expiresAt}.${moderatorId}`).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

/**
 * The moderator a token stands for, or null for anything that does not check
 * out: a bad signature, an expired one, or one minted for another submission.
 *
 * The id is checked here rather than trusted from the request, so a valid token
 * for video 12 cannot be replayed against video 13.
 */
export function verifyVideoEditToken(
  token: string,
  id: number,
): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  // Length-checked first: `timingSafeEqual` throws on a mismatch rather than
  // answering false, and the length of a signature is not a secret.
  if (expected.length !== given.length) return null;
  if (!timingSafeEqual(expected, given)) return null;

  const [rawId, rawExp, moderatorId] = Buffer.from(payload, "base64url")
    .toString()
    .split(".");
  if (Number(rawId) !== id || !moderatorId) return null;
  if (Number(rawExp) * 1000 < Date.now()) return null;
  return moderatorId;
}
