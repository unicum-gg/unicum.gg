import { and, eq, sql } from "drizzle-orm";
import { db } from "@/services/db";
import { type Clan, clans } from "@/services/db/schema";
import { clanChannel, publish } from "@/services/live/pubsub";
import type { Region } from "@/services/wargaming/wot";
import {
  type ClanFullInfo,
  getClanFullInfo,
  getClansFullInfoBatch,
} from "@/services/wargaming/wot/clans";
import { findClanIdByTag } from "@/services/wargaming/wot/clans/search";
import { dedup, isStale } from "./internal";

function clanFullInfoFromRow(row: Clan): ClanFullInfo {
  return {
    id: Number(row.id),
    tag: row.tag,
    name: row.name,
    color: row.color,
    emblem: row.emblem,
    motto: row.motto,
    descriptionHtml: row.descriptionHtml,
    createdAt: row.createdAtWg,
    membersCount: row.membersCount,
    leaderId: Number(row.leaderId),
    leaderName: row.leaderName,
    creatorId: Number(row.creatorId),
    creatorName: row.creatorName,
    isDisbanded: row.isDisbanded,
    languages: row.languages ?? [],
  };
}

export type ClanCached = {
  info: ClanFullInfo;
  fromDb: boolean;
  refreshing: boolean;
};

export async function getClanByTagCached(
  region: Region,
  tag: string,
): Promise<ClanCached | null> {
  const tagLower = tag.toLowerCase();
  const [row] = await db
    .select()
    .from(clans)
    .where(and(eq(clans.region, region), eq(clans.tagLower, tagLower)))
    .limit(1);

  if (row) {
    const stale = isStale(row.lastRefreshedAt);
    if (stale) refreshClanByIdInBackground(region, Number(row.id));
    return { info: clanFullInfoFromRow(row), fromDb: true, refreshing: stale };
  }

  const info = await refreshClanByTag(region, tag);
  return info ? { info, fromDb: false, refreshing: false } : null;
}

export async function refreshClanByTag(
  region: Region,
  tag: string,
): Promise<ClanFullInfo | null> {
  const clanId = await findClanIdByTag(region, tag);
  if (!clanId) return null;
  return refreshClanById(region, clanId);
}

export async function refreshClanById(
  region: Region,
  clanId: number,
): Promise<ClanFullInfo | null> {
  const info = await getClanFullInfo(region, clanId);
  if (!info) return null;
  await db
    .insert(clans)
    .values({
      region,
      id: info.id,
      tag: info.tag,
      tagLower: info.tag.toLowerCase(),
      name: info.name,
      color: info.color,
      emblem: info.emblem,
      motto: info.motto,
      descriptionHtml: info.descriptionHtml,
      membersCount: info.membersCount,
      leaderId: info.leaderId,
      leaderName: info.leaderName,
      creatorId: info.creatorId,
      creatorName: info.creatorName,
      createdAtWg: info.createdAt,
      isDisbanded: info.isDisbanded,
      languages: info.languages,
      lastRefreshedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [clans.region, clans.id],
      set: {
        tag: info.tag,
        tagLower: info.tag.toLowerCase(),
        name: info.name,
        color: info.color,
        emblem: info.emblem,
        motto: info.motto,
        descriptionHtml: info.descriptionHtml,
        membersCount: info.membersCount,
        leaderId: info.leaderId,
        leaderName: info.leaderName,
        creatorId: info.creatorId,
        creatorName: info.creatorName,
        createdAtWg: info.createdAt,
        isDisbanded: info.isDisbanded,
        languages: info.languages,
        lastRefreshedAt: new Date(),
      },
    });
  publish(clanChannel(region, info.id), { kind: "info" });
  return info;
}

/**
 * Batched variant: fetches & upserts many clans at once. Used by the cron
 * to avoid 1 WG round-trip per clan.
 */
export async function refreshClansByIdsBatch(
  region: Region,
  clanIds: number[],
): Promise<Map<number, ClanFullInfo>> {
  const infos = await getClansFullInfoBatch(region, clanIds);
  if (infos.size === 0) return infos;

  const now = new Date();
  const rows = Array.from(infos.values()).map((info) => ({
    region,
    id: info.id,
    tag: info.tag,
    tagLower: info.tag.toLowerCase(),
    name: info.name,
    color: info.color,
    emblem: info.emblem,
    motto: info.motto,
    descriptionHtml: info.descriptionHtml,
    membersCount: info.membersCount,
    leaderId: info.leaderId,
    leaderName: info.leaderName,
    creatorId: info.creatorId,
    creatorName: info.creatorName,
    createdAtWg: info.createdAt,
    isDisbanded: info.isDisbanded,
    languages: info.languages,
    lastRefreshedAt: now,
  }));

  await db
    .insert(clans)
    .values(rows)
    .onConflictDoUpdate({
      target: [clans.region, clans.id],
      set: {
        tag: sql`excluded.tag`,
        tagLower: sql`excluded.tag_lower`,
        name: sql`excluded.name`,
        color: sql`excluded.color`,
        emblem: sql`excluded.emblem`,
        motto: sql`excluded.motto`,
        descriptionHtml: sql`excluded.description_html`,
        membersCount: sql`excluded.members_count`,
        leaderId: sql`excluded.leader_id`,
        leaderName: sql`excluded.leader_name`,
        creatorId: sql`excluded.creator_id`,
        creatorName: sql`excluded.creator_name`,
        createdAtWg: sql`excluded.created_at_wg`,
        isDisbanded: sql`excluded.is_disbanded`,
        languages: sql`excluded.languages`,
        lastRefreshedAt: sql`excluded.last_refreshed_at`,
      },
    });

  for (const info of infos.values()) {
    publish(clanChannel(region, info.id), { kind: "info" });
  }
  return infos;
}

function refreshClanByIdInBackground(region: Region, clanId: number): void {
  void dedup(`clan:${region}:${clanId}`, () =>
    refreshClanById(region, clanId),
  ).catch((err) =>
    console.error(
      `[clans-repo] refreshClanById ${region}/${clanId} failed:`,
      err,
    ),
  );
}
