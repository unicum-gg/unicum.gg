// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

export const twitchChannelParams = z.object({
  login: z.string().meta({ description: "Twitch channel login, e.g. `license__`." }),
});

const chatBadge = z
  .object({
    set: z.string().meta({ description: "Badge set, e.g. `subscriber`." }),
    version: z.string().meta({ description: "Version within the set, e.g. `12`." }),
    title: z.string(),
    image1x: z.string().meta({ description: "18x18 PNG." }),
    image2x: z.string().meta({ description: "36x36 PNG." }),
    image4x: z.string().meta({ description: "72x72 PNG." }),
    channel: z.boolean().meta({
      description: "Whether the image is the channel's own rather than Twitch's global one.",
    }),
  })
  .meta({
    id: "TwitchChatBadge",
    description: "A chat badge, keyed the way a chat message's `badges` tag names it: `set/version`.",
  });

/** Response of `GET /twitch/{login}/badges`. */
export const TwitchChatBadgesResponse = z.object({
  login: z.string(),
  badges: z.array(chatBadge),
});
