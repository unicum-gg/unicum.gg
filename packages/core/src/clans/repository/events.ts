import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  type ClanRecentEventRow,
  clanRecentEventsByRegion,
  clansByRegion,
  playersByRegion,
} from "@unicum.gg/shared";
import { discoverPlayersBackground } from "@unicum.gg/core/discovery/players";
import { clanChannel, publish } from "@unicum.gg/core/live/pubsub";
import type { Region } from "@unicum.gg/wargaming";
import { getClanRecentEvents } from "@unicum.gg/core/wargaming/wot/clans/events";
import { enqueueClanRefreshBackground } from "@unicum.gg/core/clans/refresh-queue";
import type {
  ClanEventType,
  ClanRecentEvent,
} from "@unicum.gg/core/wargaming/wot/clans/event-types";

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

/**
 * The stored `accountName` is frozen at the WG feed's event time, so a member who
 * has since renamed would be shown (and linked) under a dead nickname. We keep
 * each tracked account's current nickname on the players row, so overlay it by
 * the stable `accountId`; accounts we don't track keep the feed name.
 */
async function withCurrentNicknames(
  region: Region,
  events: ClanRecentEvent[],
): Promise<ClanRecentEvent[]> {
  const ids = [...new Set(events.map((e) => e.accountId))];
  if (ids.length === 0) return events;
  const players = playersByRegion[region];
  const rows = await db
    .select({ accountId: players.accountId, nickname: players.nickname })
    .from(players)
    .where(inArray(players.accountId, ids));
  const byId = new Map(rows.map((r) => [Number(r.accountId), r.nickname]));
  return events.map((e) => {
    const current = byId.get(e.accountId);
    return current && current !== e.accountName
      ? { ...e, accountName: current }
      : e;
  });
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
    .select({ eventsRefreshedAt: clans.eventsRefreshedAt })
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
    // Deliberately no refresh from here. The player page is the model: a render
    // serves what is stored and asks for nothing. Freshness already has two
    // owners — the `/enqueue` endpoint, which only a real browser reaches (a
    // crawler runs no JS, so it can no longer make us call anything), and
    // `clan-backfill-cron`, which walks every clan regardless.
    //
    // Firing from here fired on EVERY render, crawlers included, and the clan
    // portal serves 1 request per second per region: on 2026-09-15 that left
    // ~260 of them queued at once, each holding a request's memory for ~53s,
    // until the web workers filled and the site went dark in bursts.
    return {
      events: await withCurrentNicknames(region, rows.map(eventFromRow)),
      fromDb: true,
      refreshing: false,
    };
  }

  // First-ever view of this clan: nothing stored, so queue the fetch and render
  // empty rather than hold the request against a 1-rps portal. LiveSync pushes
  // the events in when the cron gets to it, exactly as the members path does.
  enqueueClanRefreshBackground(region, [clanId], { priority: 10 });
  return {
    events: [],
    fromDb: false,
    refreshing: true,
  };
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
  // Stamps the events column ONLY. It used to stamp `last_refreshed_at`, the
  // column the backfill scan uses to decide a clan needs a full refresh, and
  // this function is fired in the background by every clan page hit, so any
  // crawler kept resetting that clock without a single one of the other
  // refreshes having run. Measured on EU before the split: 42,452 clans claimed
  // a refresh inside 24h while 5,891 of them carried Stronghold data over a week
  // old, because the backfill never considered them due.
  await db
    .update(clans)
    .set({ eventsRefreshedAt: sql`NOW()` })
    .where(eq(clans.id, clanId));
  discoverPlayersBackground(
    region,
    events.map((e) => ({ accountId: e.accountId, nickname: e.accountName })),
  );
  publish(clanChannel(region, clanId), { kind: "events" });
  return events;
}
