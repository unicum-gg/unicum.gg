import { getCachedChatBadges } from "@/services/twitch";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { TwitchChatBadgesResponse } from "./schema.api";

export const dynamic = "force-dynamic";

// Twitch logins: 4 to 25 lowercase letters, digits and underscores (a few old
// ones are 3). Anything else is refused here rather than spent on Helix.
const LOGIN = /^[a-z0-9_]{3,25}$/;

/**
 * Twitch chat badges
 * @description Every badge a chat message in this Twitch channel can carry, with its images: Twitch's global badges, with the channel's own subscriber and bits images in place of the global ones they replace. A chat client receives only `set/version` pairs with each message (the IRC `badges` tag), which this resolves. 404 when the login is not a Twitch channel. Cached one hour.
 * @pathParams twitchChannelParams
 * @response TwitchChatBadgesResponse
 * @tag Streamers
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /twitch/{login}/badges", () => GET__perf(...args));
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const login = decodeURIComponent((await params).login).toLowerCase();
  if (!LOGIN.test(login)) {
    return Response.json({ error: "invalid_login" }, { status: 400 });
  }
  const badges = await getCachedChatBadges(login);
  if (!badges) {
    return Response.json({ error: "channel_not_found" }, { status: 404 });
  }
  return jsonResponse(
    TwitchChatBadgesResponse,
    { login, badges },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
