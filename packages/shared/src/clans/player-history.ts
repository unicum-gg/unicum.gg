import type { ClanRef } from "./ref";

/** A period of membership in one clan (client-safe shape). The WG/portal
 * fetchers live in core (`wargaming/wot/clans/player`). */
export type ClanStint = {
  clan: ClanRef;
  joinedAt: Date;
  leftAt: Date | null;
  role: string;
  roleLocalized: string;
};

/** A past clan membership as returned by `clans/memberhistory` (app-shaped). */
export type RawClanMemberStint = {
  clanId: number;
  role: string;
  joinedAt: Date;
  leftAt: Date;
};

export type PlayerClanHistoryFull = {
  currentStint: ClanStint | null;
  pastStints: ClanStint[];
  totalClans: number;
  timeInClansSeconds: number;
};
