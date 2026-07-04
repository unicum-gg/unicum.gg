import { cookies } from "next/headers";
import { type RatingMetric, ratingMetricFromCookie } from "@unicum.gg/core/constants/rating";
import STORAGE from "@/constants/storage";

/**
 * Server-side counterpart of the `useCookie(STORAGE.COOKIES.RATING, ...)`
 * client hook: resolves the visitor's selected rating metric from the request
 * cookies, falling back to the default. Lives in its own file because
 * `next/headers` only compiles in server code.
 */
export async function getRatingMetricFromCookies(): Promise<RatingMetric> {
  const store = await cookies();
  return ratingMetricFromCookie(store.get(STORAGE.COOKIES.RATING)?.value);
}
