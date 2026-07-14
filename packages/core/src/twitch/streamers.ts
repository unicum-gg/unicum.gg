import { eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { streamers } from "@unicum.gg/shared";

/**
 * Link (or re-link) a WoT account to a Twitch channel. Keyed on the same
 * `${region}-${accountId}` id the auth user uses, so a self-service link upserts
 * the row a curated seed may have created. `verified` is true for owner-proven
 * links (Twitch OAuth), false for curated seeds.
 */
export async function upsertStreamer(input: {
  region: string;
  accountId: number;
  twitchLogin: string;
  twitchUserId: string;
  verified: boolean;
}): Promise<void> {
  const id = `${input.region}-${input.accountId}`;
  const twitchLogin = input.twitchLogin.toLowerCase();
  await db
    .insert(streamers)
    .values({
      id,
      region: input.region,
      accountId: input.accountId,
      twitchLogin,
      twitchUserId: input.twitchUserId,
      verified: input.verified,
    })
    .onConflictDoUpdate({
      target: streamers.id,
      set: {
        twitchLogin,
        twitchUserId: input.twitchUserId,
        verified: input.verified,
        updatedAt: new Date(),
      },
    });
}

/** Remove a link (used when a player unlinks their Twitch account). */
export async function removeStreamer(
  region: string,
  accountId: number,
): Promise<void> {
  await db.delete(streamers).where(eq(streamers.id, `${region}-${accountId}`));
}
