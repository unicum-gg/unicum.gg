import {
  findGameClientUser,
  type GameClientUser,
} from "@unicum.gg/core/game-link";

/**
 * The account a game-mod request acts for, from its `Authorization: Bearer`
 * secret (see `@unicum.gg/core/game-link`), or null when the secret is missing
 * or not linked.
 */
export async function gameClientUser(
  req: Request,
): Promise<GameClientUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match ? findGameClientUser(match[1]) : null;
}
