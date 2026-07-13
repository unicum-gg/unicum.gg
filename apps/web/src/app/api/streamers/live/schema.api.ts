// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
import { z } from "zod";
import { regionPath } from "@/services/openapi/schemas";

const liveStreamer = z
  .object({
    region: regionPath,
    accountId: z.number(),
    nickname: z.string(),
    clanTag: z.string().nullable(),
    clanColor: z.string().nullable(),
    wn7: z.number().nullable(),
    wn8: z.number().nullable(),
    wnx: z.number().nullable(),
    twitchLogin: z.string(),
    twitchUserName: z.string(),
    title: z.string(),
    viewerCount: z.number(),
    startedAt: z.string(),
    thumbnailUrl: z.string(),
  })
  .loose()
  .meta({
    id: "LiveStreamer",
    description:
      "A tracked player live on Twitch in the World of Tanks category, with cached WN7/WN8/WNX ratings and clan tag.",
  });

/** Response of `GET /streamers/live` (bare array, sorted by WNX). */
export const LiveStreamersResponse = z.array(liveStreamer).meta({
  description: "Tracked players live on Twitch right now, sorted by WNX.",
});
