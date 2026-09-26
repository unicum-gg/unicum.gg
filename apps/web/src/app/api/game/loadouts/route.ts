import { isRegion, type Region } from "@unicum.gg/wargaming";
import { accountBehindGameToken } from "@unicum.gg/core/auth/game-client-account";
import { wargamingAccountOf } from "@unicum.gg/core/game-link";
import {
  forgetTankLoadouts,
  listLoadoutStamps,
  saveTankLoadouts,
} from "@unicum.gg/core/tanks/loadouts";
import { consumeQuota } from "@unicum.gg/core/lib/request-quota";
import { gameClientUser } from "@/services/game";
import { loadoutsUploadBody } from "./body";

export const dynamic = "force-dynamic";

/**
 * What one account may upload in an hour.
 *
 * A mod sends its whole carousel once and then only what changed, so a player
 * who plays all evening costs a handful of calls. Twenty leaves room for a
 * reinstall, a garage the player keeps re-entering and a client that retries,
 * and still stops a loop: the account is proven, so an abusive caller can only
 * damage its own rows, but it would make the database pay for that all the
 * same.
 */
const UPLOAD_QUOTA = { limit: 20, windowSeconds: 3600 };

/**
 * How the game mod tells us the way a player has set their vehicles up.
 *
 * Not part of the public API: its only caller is the mod, and what it accepts
 * is only ever a statement about the caller's OWN account. That is the whole
 * design of this endpoint. Loadouts are published on player pages and the
 * point of them is that a reader can trust a good player's setup is really
 * theirs, so a nickname in the body would be worthless: anyone could fill the
 * site with invented builds under the names that matter most.
 *
 * So the account is proven, two ways, and neither asks anything of the player:
 *
 * - a client whose player has linked their unicum.gg account authenticates
 *   with the link's own secret, and the account comes from the link;
 * - any other client sends its **WGNI web token**, the one the game mints for
 *   its own shop and portal, and Wargaming is asked whose it is.
 *
 * The second is the one that matters, because most people running the mod have
 * never signed in here and a feature that only worked for those who had would
 * describe the wrong half of the playerbase.
 */
export async function POST(req: Request): Promise<Response> {
  const account = await provenAccount(req);
  if (!account) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  const quota = await consumeQuota(
    `loadouts:${account.region}:${account.accountId}`,
    UPLOAD_QUOTA,
  );
  if (!quota.allowed) {
    return Response.json(
      { error: "too_many_uploads" },
      { status: 429, headers: { "retry-after": String(quota.resetSeconds) } },
    );
  }

  const parsed = loadoutsUploadBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const { loadouts, sold } = parsed.data;

  try {
    const [saved, forgotten] = await Promise.all([
      saveTankLoadouts(account.region, account.accountId, loadouts),
      forgetTankLoadouts(account.region, account.accountId, sold),
    ]);
    return Response.json(
      { saved, forgotten },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/game/loadouts] failed:", err);
    return Response.json({ error: "save_failed" }, { status: 502 });
  }
}

/**
 * What we already hold for this account, so the mod can send only what moved.
 *
 * A full carousel is a few hundred vehicles and a quarter of a megabyte, where
 * almost nothing changes between two garage visits. The mod compares these
 * stamps against its own and uploads the difference, which makes the steady
 * state nearly free for both sides. The first upload is still the whole thing.
 */
export async function GET(req: Request): Promise<Response> {
  const account = await provenAccount(req);
  if (!account) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  const stamps = await listLoadoutStamps(account.region, account.accountId);
  return Response.json(
    {
      region: account.region,
      accountId: account.accountId,
      tanks: Object.fromEntries(
        [...stamps].map(([tankId, at]) => [tankId, at.toISOString()]),
      ),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

type ProvenAccount = { region: Region; accountId: number };

/** The Wargaming account this request may speak for, or null. */
async function provenAccount(req: Request): Promise<ProvenAccount | null> {
  const linked = await linkedAccount(req);
  if (linked) return linked;
  const token = req.headers.get("x-wargaming-token");
  const region = req.headers.get("x-wargaming-region");
  if (!token || !region) return null;
  return accountBehindGameToken(region, token);
}

/** The account behind a linked client's bearer secret, when there is one. */
async function linkedAccount(req: Request): Promise<ProvenAccount | null> {
  const client = await gameClientUser(req);
  if (!client) return null;
  // Stored as `<region>-<account id>` by the Wargaming sign-in.
  const wargaming = await wargamingAccountOf(client.userId);
  if (!wargaming) return null;
  const separator = wargaming.indexOf("-");
  const region = wargaming.slice(0, separator);
  const accountId = Number(wargaming.slice(separator + 1));
  if (!isRegion(region) || !Number.isFinite(accountId)) return null;
  return { region, accountId };
}
