import { eq, inArray } from "drizzle-orm";
import { db } from "@/services/db";
import { clansByRegion, playerClanHistoryByRegion } from "@/services/db/schema";
import type { Region } from "@unicum.gg/wargaming/region";
import { getClansShortRefBatch } from "@/services/wargaming/wot/clans/info";
import {
  type ClanRef,
  type ClanStint,
  type PlayerClanHistoryFull,
  type RawClanMemberStint,
  getPlayerClanMemberHistory,
  getPlayerCurrentClan,
} from "@/services/wargaming/wot/clans/player";

export type SerializedClanStint = Omit<ClanStint, "joinedAt" | "leftAt"> & {
  joinedAt: string;
  leftAt: string | null;
};

export type SerializedClanHistory = {
  currentStint: SerializedClanStint | null;
  pastStints: SerializedClanStint[];
  totalClans: number;
  timeInClansSeconds: number;
};

function serializeStint(s: ClanStint): SerializedClanStint {
  return {
    ...s,
    joinedAt: s.joinedAt.toISOString(),
    leftAt: s.leftAt ? s.leftAt.toISOString() : null,
  };
}

function deserializeStint(s: SerializedClanStint): ClanStint {
  return {
    ...s,
    // Legacy rows stored before ClanRef gained `languages` (added 2026-06-06)
    // serialize without that field; fill it in so downstream code can
    // safely read `.length` without crashing on `undefined`.
    clan: { ...s.clan, languages: s.clan.languages ?? [] },
    joinedAt: new Date(s.joinedAt),
    leftAt: s.leftAt ? new Date(s.leftAt) : null,
  };
}

function serialize(data: PlayerClanHistoryFull): SerializedClanHistory {
  return {
    currentStint: data.currentStint ? serializeStint(data.currentStint) : null,
    pastStints: data.pastStints.map(serializeStint),
    totalClans: data.totalClans,
    timeInClansSeconds: data.timeInClansSeconds,
  };
}

/**
 * Single source of truth for turning a stored `playerClanHistory.data` JSONB
 * blob back into a `PlayerClanHistoryFull`. Used by both `getStoredPlayerClanHistory`
 * here and `loadPlayerInitialData`, so any future schema-evolution backfill
 * (like the `languages` default) lives in one place.
 */
export function deserializeClanHistory(
  data: SerializedClanHistory,
): PlayerClanHistoryFull {
  return {
    currentStint: data.currentStint ? deserializeStint(data.currentStint) : null,
    pastStints: data.pastStints.map(deserializeStint),
    totalClans: data.totalClans,
    timeInClansSeconds: data.timeInClansSeconds,
  };
}

export type StoredPlayerClanHistory = {
  fetchedAt: Date;
  data: PlayerClanHistoryFull;
};

export async function getStoredPlayerClanHistory(
  region: Region,
  accountId: number,
): Promise<StoredPlayerClanHistory | null> {
  const playerClanHistory = playerClanHistoryByRegion[region];
  const [row] = await db
    .select()
    .from(playerClanHistory)
    .where(eq(playerClanHistory.accountId, accountId))
    .limit(1);
  if (!row) return null;
  return {
    fetchedAt: row.fetchedAt,
    data: deserializeClanHistory(row.data as SerializedClanHistory),
  };
}

async function resolveClanRefs(
  region: Region,
  clanIds: number[],
): Promise<Map<number, ClanRef>> {
  const out = new Map<number, ClanRef>();
  if (clanIds.length === 0) return out;
  const clans = clansByRegion[region];
  const unique = Array.from(new Set(clanIds));

  // 1. Try the local regional clans table first — covers the vast majority
  //    once discovery has run at least once. `languages` are only present
  //    here (the public API doesn't expose them), so this read is also what
  //    powers the player-language inference downstream.
  const rows = await db
    .select({
      id: clans.id,
      tag: clans.tag,
      name: clans.name,
      color: clans.color,
      emblem: clans.emblem,
      languages: clans.languages,
    })
    .from(clans)
    .where(inArray(clans.id, unique));
  for (const r of rows) {
    out.set(Number(r.id), {
      id: Number(r.id),
      tag: r.tag,
      name: r.name,
      color: r.color,
      emblem: r.emblem,
      languages: r.languages ?? [],
    });
  }

  // 2. For anything still missing, batch-fetch from WG (no portal hop).
  //    Disbanded/ghost clans simply stay missing — caller filters them.
  const missing = unique.filter((id) => !out.has(id));
  if (missing.length > 0) {
    const fetched = await getClansShortRefBatch(region, missing);
    for (const [id, ref] of fetched) out.set(id, ref);
  }
  return out;
}

function stintFromMemberHistory(
  raw: RawClanMemberStint,
  clan: ClanRef,
): ClanStint {
  return {
    clan,
    joinedAt: raw.joinedAt,
    leftAt: raw.leftAt,
    role: raw.role,
    // memberhistory doesn't expose a localized role; the player page maps
    // raw role names to display labels client-side via prettyRole().
    roleLocalized: "",
  };
}

/**
 * Builds the full clan history for a player by composing two public WG
 * endpoints (`accountinfo` for current, `memberhistory` for past) and
 * resolving past-stint clan IDs into refs from our `clans` table — falling
 * back to a lightweight WG batch lookup for unknown ones. Replaces the
 * old portal-based accountcard that was Cloudflare-blocked from many networks.
 */
export async function loadPlayerClanHistoryFromWG(
  region: Region,
  accountId: number,
): Promise<PlayerClanHistoryFull> {
  const [currentStint, rawHistory] = await Promise.all([
    getPlayerCurrentClan(region, accountId),
    getPlayerClanMemberHistory(region, accountId),
  ]);

  // Resolve refs for ALL clans seen — past stints AND the current one — so we
  // can backfill `languages` on the current stint (the public-API path that
  // built it can't supply them).
  const clanIds = rawHistory.map((s) => s.clanId);
  if (currentStint) clanIds.push(currentStint.clan.id);
  const refs = await resolveClanRefs(region, clanIds);

  const pastStints: ClanStint[] = [];
  for (const raw of rawHistory) {
    const clan = refs.get(raw.clanId);
    if (!clan) continue;
    pastStints.push(stintFromMemberHistory(raw, clan));
  }

  const enrichedCurrent: ClanStint | null = currentStint
    ? {
        ...currentStint,
        clan: {
          ...currentStint.clan,
          languages:
            refs.get(currentStint.clan.id)?.languages ??
            currentStint.clan.languages,
        },
      }
    : null;

  const nowMs = Date.now();
  const currentDurationS = enrichedCurrent
    ? Math.max(0, Math.floor((nowMs - enrichedCurrent.joinedAt.getTime()) / 1000))
    : 0;
  const pastDurationS = pastStints.reduce(
    (sum, s) =>
      sum +
      Math.max(0, Math.floor((s.leftAt!.getTime() - s.joinedAt.getTime()) / 1000)),
    0,
  );

  return {
    currentStint: enrichedCurrent,
    pastStints,
    totalClans: pastStints.length + (enrichedCurrent ? 1 : 0),
    timeInClansSeconds: currentDurationS + pastDurationS,
  };
}

export async function storePlayerClanHistory(
  region: Region,
  accountId: number,
  data: PlayerClanHistoryFull,
): Promise<void> {
  const playerClanHistory = playerClanHistoryByRegion[region];
  const serialized = serialize(data);
  await db
    .insert(playerClanHistory)
    .values({
      accountId,
      data: serialized,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: playerClanHistory.accountId,
      set: {
        data: serialized,
        fetchedAt: new Date(),
      },
    });
}
