import { headers } from "next/headers";
import { auth } from "@unicum.gg/core/auth";
import { wgIdentityFromEmail } from "@/lib/wg-session";

/** Whether the signed-in reader is this account, on this region: the one
 * reader a private battle list, and what is read off it, is answered to. */
export async function isOwner(region: string, accountId: number): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() });
  const wg = wgIdentityFromEmail(session?.user?.email);
  return !!wg && wg.region === region && wg.accountId === accountId;
}
