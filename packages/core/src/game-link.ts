import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { gameLinks, user } from "@unicum.gg/shared";

/**
 * The link between a World of Tanks client (the unicum.gg mod) and a unicum.gg
 * account. The mod holds a random secret and sends its SHA-256 through the
 * sign-in chain; once linked, it authenticates with the secret as a bearer
 * token and the server finds the row by hashing it again.
 */

/** A token hash as the connect route accepts it: SHA-256, lowercase hex. */
export const GAME_TOKEN_HASH = /^[0-9a-f]{64}$/;

/** The mod's secrets are 64 hex characters (32 random bytes). */
const GAME_TOKEN = /^[0-9a-f]{64}$/;

export function hashGameToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** How linking a client ended. */
export enum GameLinkResult {
  Linked = "linked",
  /** The hash already belongs to another account. */
  TakenByAnotherUser = "taken_by_another_user",
}

/**
 * Record that the client holding the secret behind `tokenHash` acts for
 * `userId`. Linking the same hash to the same user again is a no-op, so a
 * reloaded page cannot fail the flow.
 */
export async function linkGameClient(
  tokenHash: string,
  userId: string,
): Promise<GameLinkResult> {
  const [row] = await db
    .insert(gameLinks)
    .values({ tokenHash, userId })
    .onConflictDoNothing()
    .returning({ userId: gameLinks.userId });
  if (row) return GameLinkResult.Linked;
  const [existing] = await db
    .select({ userId: gameLinks.userId })
    .from(gameLinks)
    .where(eq(gameLinks.tokenHash, tokenHash))
    .limit(1);
  return existing?.userId === userId
    ? GameLinkResult.Linked
    : GameLinkResult.TakenByAnotherUser;
}

/** Who a linked client acts for. */
export type GameClientUser = { userId: string; name: string };

/** The user a client's secret acts for, or null when it is not linked. */
export async function findGameClientUser(
  token: string,
): Promise<GameClientUser | null> {
  if (!GAME_TOKEN.test(token)) return null;
  const [row] = await db
    .update(gameLinks)
    .set({ lastUsedAt: new Date() })
    .where(eq(gameLinks.tokenHash, hashGameToken(token)))
    .returning({ userId: gameLinks.userId });
  if (!row) return null;
  const [owner] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, row.userId))
    .limit(1);
  return owner ? { userId: row.userId, name: owner.name } : null;
}
