import { revalidatePath } from "next/cache";
import type { Region } from "@unicum.gg/wargaming";
import { bustPlayerDetailCache } from "@unicum.gg/core/players/detail-cache";
import ROUTES from "@/constants/routes";
import { LOCALES } from "@/lib/translations";

/**
 * Drop every cached rendering of one player's profile, and its payload.
 *
 * For a change the player made about what their page shows, which has to be
 * true the next time anybody opens it rather than when the day-long ISR window
 * runs out. The payload goes first, since the page is rebuilt from it.
 *
 * Every language, because the proxy rewrites each reader onto a prefixed path
 * (`/en/eu/players/...` included) and the cache is keyed on that destination,
 * not on the address the reader typed. A `layout` revalidation of the profile's
 * root reaches every tab beneath it, and the Battles tab's count is drawn on
 * all of them.
 */
export function revalidatePlayerProfile(region: Region, nickname: string): void {
  bustPlayerDetailCache(region, nickname);
  const path = ROUTES.PLAYER(region, nickname);
  for (const locale of LOCALES) revalidatePath(`/${locale}${path}`, "layout");
}
