import { desc, eq, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  type ClanRecentEventRow,
  clanRecentEventsByRegion,
  clansByRegion,
} from "@unicum.gg/core/db/schema";
import { discoverPlayersBackground } from "@unicum.gg/core/discovery/players";
import { clanChannel, publish } from "@unicum.gg/core/live/pubsub";
import type { Region } from "@unicum.gg/wargaming";
import { getClanRecentEvents } from "@unicum.gg/core/wargaming/wot/clans/events";
import type {
  ClanEventType,
  ClanRecentEvent,
} from "@unicum.gg/core/wargaming/wot/clans/event-types";
import { dedup, isStale } from "./internal";

function eventFromRow(row: ClanRecentEventRow): ClanRecentEvent {
  return {
    type: row.type as ClanEventType,
    createdAt: row.createdAt,
    accountId: Number(row.accountId),
    accountName: row.accountName,
    oldRole: row.oldRole,
    newRole: row.newRole,
    oldRank: row.oldRank,
    newRank: row.newRank,
  };
}

export type ClanEventsCached = {
  events: ClanRecentEvent[];
  fromDb: boolean;
  refreshing: boolean;
};

export async function getClanEventsCached(
  region: Region,
  clanId: number,
  limit = 30,
): Promise<ClanEventsCached> {
  const clans = clansByRegion[region];
  const clanRecentEvents = clanRecentEventsByRegion[region];

  const [clanRow] = await db
    .select({ lastRefreshedAt: clans.lastRefreshedAt })
    .from(clans)
    .where(eq(clans.id, clanId))
    .limit(1);

  const rows = await db
    .select()
    .from(clanRecentEvents)
    .where(eq(clanRecentEvents.clanId, clanId))
    .orderBy(desc(clanRecentEvents.createdAt))
    .limit(limit);

  if (rows.length > 0 || clanRow) {
    const stale = !clanRow || isStale(clanRow.lastRefreshedAt);
    if (stale) refreshClanEventsInBackground(region, clanId, limit);
    return {
      events: rows.map(eventFromRow),
      fromDb: true,
      refreshing: stale,
    };
  }

  const events = await refreshClanEvents(region, clanId, limit);
  return { events, fromDb: false, refreshing: false };
}

export async function refreshClanEvents(
  region: Region,
  clanId: number,
  limit = 30,
): Promise<ClanRecentEvent[]> {
  const clans = clansByRegion[region];
  const clanRecentEvents = clanRecentEventsByRegion[region];
  const events = await getClanRecentEvents(region, clanId, limit);
  if (events.length > 0) {
    await db
      .insert(clanRecentEvents)
      .values(
        events.map((e) => ({
          clanId,
          createdAt: e.createdAt,
          type: e.type,
          accountId: e.accountId,
          accountName: e.accountName,
          oldRole: e.oldRole,
          newRole: e.newRole,
          oldRank: e.oldRank,
          newRank: e.newRank,
        })),
      )
      .onConflictDoNothing();
  }
  await db
    .update(clans)
    .set({ lastRefreshedAt: sql`GREATEST(${clans.lastRefreshedAt}, NOW())` })
    .where(eq(clans.id, clanId));
  discoverPlayersBackground(
    region,
    events.map((e) => ({ accountId: e.accountId, nickname: e.accountName })),
  );
  publish(clanChannel(region, clanId), { kind: "events" });
  return events;
}

function refreshClanEventsInBackground(
  region: Region,
  clanId: number,
  limit: number,
): void {
  void dedup(`events:${region}:${clanId}`, () =>
    refreshClanEvents(region, clanId, limit),
  ).catch((err) =>
    console.error(
      `[clans-repo] refreshClanEvents ${region}/${clanId} failed:`,
      err,
    ),
  );
}
