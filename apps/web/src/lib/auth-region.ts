import STORAGE from "@/constants/storage";
import { isRegion, Region } from "@unicum.gg/wargaming";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

/**
 * Region to start Wargaming.net sign-in on from a server route that has no UI
 * to ask in (the `/api/connect/*` resume points, reached when the session is
 * gone mid-flow). The login modal records the region the player actually chose,
 * which is the only cookie that says anything about their WG account; the
 * browsing region is a guess and only stands in for someone who has never been
 * through the picker.
 */
export function signInRegion(cookies: CookieReader): Region {
  const chosen = cookies.get(STORAGE.COOKIES.AUTH_REGION)?.value;
  if (chosen && isRegion(chosen)) return chosen;
  const browsing = cookies.get(STORAGE.COOKIES.REGION)?.value;
  return browsing && isRegion(browsing) ? browsing : Region.EU;
}
