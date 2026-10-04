import { env } from "@unicum.gg/shared";
import { discordBotEnabled } from "@unicum.gg/core/discord";

/**
 * Whether written opinions are being accepted at all.
 *
 * One answer for every moderated queue, because there is one queue: the same
 * Discord channel and the same moderator settle a vehicle review and a map
 * review, so "can somebody read this" cannot be true of one and false of the
 * other. A queue nobody looks at is worse than no queue, so the text field
 * closes when the bot or the channel is absent.
 *
 * The stars are unaffected either way. They need no review, and refusing the
 * whole vote because the prose has nowhere to go would throw away the half that
 * works.
 */
export function reviewsEnabled(): boolean {
  return discordBotEnabled() && Boolean(env.DISCORD_REVIEW_CHANNEL_ID);
}
