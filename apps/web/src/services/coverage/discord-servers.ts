import { unstable_cache } from "next/cache";
import { countBotGuilds } from "@unicum.gg/core/discord";

// Its own window, deliberately far longer than the payload's 60s: the guild
// list moves on the order of weeks, so sharing that window would mean an
// outbound Discord call every minute, per region, for a number that almost
// never changes.
//
// Throwing rather than returning the null is what keeps a bad minute from
// lasting an hour: a value is cached, a rejection is not, so a Discord that did
// not answer is retried on the next request instead of being frozen for the
// whole window. Observed for real, the first cold render timed out against our
// own busy server and the page then said "n/a" long after Discord was fine.
export const getDiscordServerCount = unstable_cache(
  async () => {
    const count = await countBotGuilds();
    if (count === null) throw new Error("discord_unavailable");
    return count;
  },
  ["coverage-discord-servers"],
  { revalidate: 3600, tags: ["coverage"] },
);
