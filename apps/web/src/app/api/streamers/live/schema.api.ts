// Co-located response schema (`.api.ts` suffix is load-bearing for the generator).
import { z } from "zod";

const liveStreamer = z
  .object({
    region: z.enum(["eu", "na", "asia"]),
    accountId: z.number(),
    nickname: z.string(),
    clanTag: z.string().nullable(),
    clanColor: z.string().nullable(),
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
    pr: z.number().nullable().optional(),
    wtr: z.number().nullable().optional(),
    wn730d: z.number().nullable(),
    wn830d: z.number().nullable(),
    wnx30d: z.number().nullable(),
    twitchLogin: z.string(),
    twitchUserName: z.string(),
    title: z.string(),
    viewerCount: z.number(),
    startedAt: z.string().meta({ description: "Stream start, ISO 8601." }),
    language: z.string().meta({ description: "Stream language, ISO 639-1." }),
    thumbnailUrl: z.string(),
    accounts: z
      .array(
        z.object({
          region: z.enum(["eu", "na", "asia"]),
          accountId: z.number(),
        }),
      )
      .optional()
      .meta({
        description:
          "Every WoT account linked to this channel. The fields above describe the one the card shows, which is the most active of them. Absent from a snapshot published before this field existed.",
      }),
  })
  .meta({
    id: "LiveStreamer",
    description: "A tracked player currently live on Twitch, with ratings.",
  });

/** Response of `GET /streamers/live` (snapshot; see `/streamers/live/sse` for push). */
export const LiveStreamersResponse = z.object({
  results: z.array(liveStreamer),
});
