import { auth } from "@unicum.gg/core/auth";

/**
 * Starting the Discord OAuth link, for the two flows that need one.
 *
 * Shared because the mechanics are the one part that is easy to get subtly
 * wrong: `linkSocialAccount` hands back the OAuth-state `Set-Cookie` headers,
 * and those must reach the browser or Discord's callback has nothing to
 * validate against. Forwarding them onto our own redirect is what the two
 * callers would otherwise each reimplement.
 *
 * What the link is FOR stays with the caller: claiming the supporter role lands
 * on the role sync, a reader linking so a moderation verdict can reach them
 * lands back on the page they were reading.
 */
export async function startDiscordLink(
  requestHeaders: Headers,
  /** Where Discord sends them once the account is linked. A same-origin
   * relative path: pass it through `safePath` when it came from a request. */
  callbackURL: string,
): Promise<{ url: string; setCookies: string[] } | null> {
  let linkResponse: Response;
  try {
    linkResponse = await auth.api.linkSocialAccount({
      body: { provider: "discord", callbackURL },
      headers: requestHeaders,
      asResponse: true,
    });
  } catch {
    return null;
  }

  const { url } = (await linkResponse.json().catch(() => ({}))) as {
    url?: string;
  };
  if (!url) return null;

  const setCookies = (
    linkResponse.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();
  return { url, setCookies: setCookies ?? [] };
}
