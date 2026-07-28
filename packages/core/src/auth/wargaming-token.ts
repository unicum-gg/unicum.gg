import { and, eq } from "drizzle-orm";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { db } from "@unicum.gg/core/db";
import { wg } from "@unicum.gg/core/wargaming/client";
import { account as accountTable, env } from "@unicum.gg/shared";
import { Region, isRegion } from "@unicum.gg/wargaming";

const PROVIDER_ID = "wargaming";
// Refresh the token when it has less than this left, so a daily workflow
// never runs into a mid-window expiry. WG tokens live ~2 weeks.
const PROLONGATE_WHEN_UNDER_MS = 3 * 24 * 60 * 60 * 1000;

export type WargamingTokenResult =
  | { ok: true; token: string; accountId: number; region: Region }
  | { ok: false; reason: "no_account" | "expired" };

/**
 * Resolve a usable, non-expiring WG access token for a Better Auth user, from
 * their linked `wargaming` account (stored encrypted). If it is close to
 * expiry it is prolongated with WG and the fresh token re-encrypted in place,
 * so callers (the boost-workflow runner) always get a live token. Returns
 * `{ ok: false }` when the account is missing or the token can no longer be
 * prolongated (the user must re-login).
 */
export async function getWargamingAccessToken(
  userId: string,
): Promise<WargamingTokenResult> {
  const [acc] = await db
    .select()
    .from(accountTable)
    .where(
      and(
        eq(accountTable.userId, userId),
        eq(accountTable.providerId, PROVIDER_ID),
      ),
    )
    .limit(1);

  if (!acc?.accessToken) return { ok: false, reason: "no_account" };

  // accountId is stored as `<region>-<wgAccountId>`.
  const [regionPart, idPart] = acc.accountId.split("-");
  if (!isRegion(regionPart) || !idPart) return { ok: false, reason: "no_account" };
  const region = regionPart;
  const accountId = Number(idPart);

  const key = env.BETTER_AUTH_SECRET as string;
  let token = await symmetricDecrypt({ key, data: acc.accessToken });

  const expiresAt = acc.accessTokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = expiresAt - Date.now() < PROLONGATE_WHEN_UNDER_MS;
  if (needsRefresh) {
    const fresh = await wg
      .region(region)
      .api.wot.auth.prolongate({ accessToken: token })
      .catch(() => null);
    if (!fresh) return { ok: false, reason: "expired" };
    token = fresh.access_token;
    await db
      .update(accountTable)
      .set({
        accessToken: await symmetricEncrypt({ key, data: fresh.access_token }),
        accessTokenExpiresAt: new Date(fresh.expires_at * 1000),
        updatedAt: new Date(),
      })
      .where(eq(accountTable.id, acc.id));
  }

  return { ok: true, token, accountId, region };
}
