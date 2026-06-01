import {
  type Region,
  REGION_PORTAL_HOST,
} from "@/services/wargaming/wot";
import { portalFetch } from "@/services/wargaming/wot/fetch";

export type ClanRef = {
  id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string;
};

export type ClanStint = {
  clan: ClanRef;
  joinedAt: Date;
  leftAt: Date | null;
  role: string;
  roleLocalized: string;
};

export type PlayerClanHistoryFull = {
  currentStint: ClanStint | null;
  pastStints: ClanStint[];
  totalClans: number;
  timeInClansSeconds: number;
};

type PortalClan = {
  id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string;
  link?: string;
  is_active?: boolean;
};

type PortalRole = { name: string; localized: string };

type PortalCurrentClan = {
  clan: PortalClan;
  joined_at: string;
  role: PortalRole | null;
};

type PortalHistoryStint = {
  clan: PortalClan;
  since: string;
  until: string;
  role: PortalRole | null;
};

type PortalAccountCard = {
  accountcard: {
    clans_count: number;
    current_clan: PortalCurrentClan | null;
    time_in_clans: number;
    clan_history: { total: number; collection: PortalHistoryStint[] };
  };
};

type PortalClanHistoryPage = {
  _meta_: { total: number; collection: string };
  clan_history: PortalHistoryStint[];
};

function absolutePortalUrl(region: Region, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://${REGION_PORTAL_HOST[region]}${path}`;
}

function upgradeEmblemSize(url: string): string {
  return url.replace(/_(32x32|64x64)/, "_195x195");
}

function clanRefFromPortal(region: Region, c: PortalClan): ClanRef {
  return {
    id: c.id,
    tag: c.tag,
    name: c.name,
    color: c.color,
    emblem: upgradeEmblemSize(absolutePortalUrl(region, c.emblem)),
  };
}

function stintFromCurrent(
  region: Region,
  cur: PortalCurrentClan,
): ClanStint {
  return {
    clan: clanRefFromPortal(region, cur.clan),
    joinedAt: new Date(cur.joined_at),
    leftAt: null,
    role: cur.role?.name ?? "",
    roleLocalized: cur.role?.localized ?? "",
  };
}

function stintFromHistory(
  region: Region,
  h: PortalHistoryStint,
): ClanStint {
  return {
    clan: clanRefFromPortal(region, h.clan),
    joinedAt: new Date(h.since),
    leftAt: new Date(h.until),
    role: h.role?.name ?? "",
    roleLocalized: h.role?.localized ?? "",
  };
}

export async function getFullPlayerClanHistory(
  region: Region,
  accountId: number,
): Promise<PlayerClanHistoryFull> {
  const accountcardUrl = new URL(
    `https://${REGION_PORTAL_HOST[region]}/clans/wot/playerslist/api/accounts/${accountId}/`,
  );
  const card = (await portalFetch<PortalAccountCard>(accountcardUrl)).accountcard;

  const currentStint = card.current_clan
    ? stintFromCurrent(region, card.current_clan)
    : null;

  const total = card.clan_history.total;
  let history: PortalHistoryStint[] = card.clan_history.collection;

  if (total > history.length) {
    const fullUrl = new URL(
      `https://${REGION_PORTAL_HOST[region]}/clans/wot/playerslist/api/account_clans_history/`,
    );
    fullUrl.searchParams.set("account_id", String(accountId));
    fullUrl.searchParams.set("offset", "0");
    fullUrl.searchParams.set("limit", String(total));
    const page = await portalFetch<PortalClanHistoryPage>(fullUrl);
    history = page.clan_history;
  }

  const pastStints = history.map((h) => stintFromHistory(region, h));

  return {
    currentStint,
    pastStints,
    totalClans: card.clans_count + (currentStint ? 1 : 0),
    timeInClansSeconds: card.time_in_clans,
  };
}
