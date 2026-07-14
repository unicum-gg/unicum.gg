import type { Region } from "@unicum.gg/wargaming";
import { wg } from "../../client";
import { type ClanRef, pickEmblem } from "./info";

export type { ClanRef } from "./info";

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

const ACCOUNT_CLAN_FIELDS = [
  "joined_at",
  "role",
  "role_i18n",
  "clan.clan_id",
  "clan.tag",
  "clan.name",
  "clan.color",
  "clan.emblems",
] as const;

/** Player's current clan as a stint (`/wot/clans/accountinfo/`), or null. */
export const getPlayerCurrentClan = async (
  region: Region,
  accountId: number,
): Promise<ClanStint | null> => {
  const entry = await wg
    .region(region)
    .api.wot.clans.accountinfo({ accountId, fields: ACCOUNT_CLAN_FIELDS });
  if (!entry?.clan) return null;
  return {
    clan: {
      id: entry.clan.clan_id,
      tag: entry.clan.tag,
      name: entry.clan.name,
      color: entry.clan.color,
      emblem: pickEmblem(entry.clan.emblems),
      languages: [],
    },
    joinedAt: new Date(entry.joined_at * 1000),
    leftAt: null,
    role: entry.role,
    roleLocalized: entry.role_i18n,
  };
};

/** Past clan stints (`/wot/clans/memberhistory/`), most-recent first. Capped by
 * WG at the 10 most recent — used only as a fallback when the portal is down. */
export const getPlayerClanMemberHistory = async (
  region: Region,
  accountId: number,
): Promise<RawClanMemberStint[]> => {
  const entries = await wg.region(region).api.wot.clans.memberhistory({ accountId });
  return entries.map((e) => ({
    clanId: e.clan_id,
    role: e.role,
    joinedAt: new Date(e.joined_at * 1000),
    leftAt: new Date(e.left_at * 1000),
  }));
};

// Portal timestamps are naive UTC ("2019-08-13T11:56:36.695"); mark them so.
const portalDate = (s: string): Date =>
  new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`);

/**
 * Full past-clan history via the portal `account_clans_history` endpoint — ALL
 * stints, not just WG's public last-10. This is the primary source; the caller
 * falls back to {@link getPlayerClanMemberHistory} when the portal is blocked.
 */
export const getPlayerClanHistoryFromPortal = async (
  region: Region,
  accountId: number,
): Promise<RawClanMemberStint[]> => {
  const stints = await wg
    .region(region)
    .portal.clans.accountClanHistory({ accountId });
  return stints.map((h) => ({
    clanId: h.clan.id,
    role: h.role?.name ?? "",
    joinedAt: portalDate(h.since),
    leftAt: portalDate(h.until),
  }));
};
