// Co-located response schema (`.api.ts` so next-openapi-gen scans it).
// Client-safe (only zod): the achievements tab parses the response with it.
import { z } from "zod";

// --- Player achievements (GET /api/{region}/players/{nickname}/achievements) ---
// The whole Wargaming medal catalogue with this player's count on each, so the
// tab can answer both "what did I earn" and "what is left".

const tier = z.object({
  name: z.string(),
  image: z.string(),
});

const achievement = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  condition: z.string(),
  image: z.string(),
  section: z.string(),
  sectionName: z.string(),
  sectionOrder: z.number().int(),
  order: z.number().int(),
  type: z.string(),
  outdated: z.boolean(),
  tiers: z.array(tier),
  count: z.number().int(),
});

const section = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number().int(),
  earned: z.number().int(),
  total: z.number().int(),
});

export const PlayerAchievementsResponse = z.object({
  achievements: z.array(achievement),
  sections: z.array(section),
  earned: z.number().int(),
  total: z.number().int(),
});
