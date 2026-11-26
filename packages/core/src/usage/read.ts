import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  account,
  battlesByRegion,
  subscription,
  tankLoadoutsByRegion,
  usageDaily,
  user,
  userActivityDay,
  UsageMetric,
} from "@unicum.gg/shared";
import { REGIONS, type Region } from "@unicum.gg/wargaming";
import { utcDay } from "./record";

/** How many days every usage series spans, today included. */
export const USAGE_DAYS = 30;

/**
 * The first day the site's activity was written as it happened. The days
 * before it come from the sessions still on record when the table was created
 * (migration 0156), which proves those readers were there and says nothing of
 * the ones whose session had already expired, so they are a floor.
 */
export const ACTIVITY_RECORDED_SINCE = "2026-11-26";

export type UsageDay = { day: string; count: number };

/** The last `USAGE_DAYS` UTC days, oldest first, ending today. */
function windowDays(): string[] {
  const today = new Date(`${utcDay()}T00:00:00Z`);
  return Array.from({ length: USAGE_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (USAGE_DAYS - 1 - i));
    return utcDay(d);
  });
}

/** A dense series over the window, zero where nothing was recorded. */
function dense(rows: { day: string; count: string | number }[]): UsageDay[] {
  const byDay = new Map(rows.map((r) => [r.day.slice(0, 10), Number(r.count)]));
  return windowDays().map((day) => ({ day, count: byDay.get(day) ?? 0 }));
}

const windowStart = () => windowDays()[0];

/** Today in UTC, whatever timezone the session runs in. */
const TODAY = sql`(now() AT TIME ZONE 'UTC')::date`;

const count = (rows: { n: string | number | null }[]): number =>
  Number(rows[0]?.n ?? 0);

/** Who signed up, who came back, and who supports the site. */
export async function readSiteUsage() {
  const since = windowStart();
  const [accounts, signupsDaily, links, supporters, activeDaily, active] =
    await Promise.all([
      db.execute<{ n: string }>(sql`SELECT COUNT(*)::text AS n FROM ${user}`),
      db.execute<{ day: string; count: string }>(sql`
        SELECT ${user.createdAt}::date::text AS day,
               COUNT(*)::text AS count
        FROM ${user}
        WHERE ${user.createdAt} >= ${since}::date
        GROUP BY 1`),
      db.execute<{ provider: string; n: string }>(sql`
        SELECT ${account.providerId} AS provider,
               COUNT(DISTINCT ${account.userId})::text AS n
        FROM ${account}
        GROUP BY 1`),
      db.execute<{ n: string }>(sql`
        SELECT COUNT(*)::text AS n FROM ${subscription}
        WHERE ${subscription.status} IN ('active', 'trialing')`),
      db.execute<{ day: string; count: string }>(sql`
        SELECT ${userActivityDay.day}::text AS day, COUNT(*)::text AS count
        FROM ${userActivityDay}
        WHERE ${userActivityDay.day} >= ${since}::date
        GROUP BY 1`),
      db.execute<{ d1: string; d7: string; d30: string }>(sql`
        SELECT
          COUNT(DISTINCT ${userActivityDay.userId})
            FILTER (WHERE ${userActivityDay.day} = ${TODAY})::text AS d1,
          COUNT(DISTINCT ${userActivityDay.userId})
            FILTER (WHERE ${userActivityDay.day} > ${TODAY} - 7)::text AS d7,
          COUNT(DISTINCT ${userActivityDay.userId})::text AS d30
        FROM ${userActivityDay}
        WHERE ${userActivityDay.day} >= ${since}::date`),
    ]);

  const linked = new Map(links.map((r) => [r.provider, Number(r.n)]));
  return {
    accounts: count(accounts),
    signupsDaily: dense(signupsDaily),
    active: {
      day: Number(active[0]?.d1 ?? 0),
      week: Number(active[0]?.d7 ?? 0),
      month: Number(active[0]?.d30 ?? 0),
    },
    activeDaily: dense(activeDaily),
    activeRecordedSince: ACTIVITY_RECORDED_SINCE,
    linked: {
      discord: linked.get("discord") ?? 0,
      twitch: linked.get("twitch") ?? 0,
    },
    supporters: count(supporters),
  };
}

/** One region's mod figures: everyone who ever ran it, and the last 30 days. */
async function readRegionModUsage(region: Region) {
  const battles = battlesByRegion[region];
  const loadouts = tankLoadoutsByRegion[region];
  const since = windowStart();
  const [totals, daily, active] = await Promise.all([
    // Same definition as the coverage page's tile: both tables are only ever
    // written by the mod, from an upload its own token proved, and neither
    // contains the other (the garage arrives on login, a battle once played).
    db.execute<{ users: string; battles: string }>(sql`
      SELECT
        (SELECT COUNT(*) FROM (
           SELECT unnest(${battles.reportedBy}) FROM ${battles}
           UNION
           SELECT ${loadouts.accountId} FROM ${loadouts}
         ) u)::text AS users,
        (SELECT COUNT(*) FROM ${battles})::text AS battles`),
    db.execute<{ day: string; battles: string; reporters: string }>(sql`
      SELECT (${battles.startedAt} AT TIME ZONE 'UTC')::date::text AS day,
             COUNT(DISTINCT ${battles.arenaUniqueId})::text AS battles,
             COUNT(DISTINCT r)::text AS reporters
      FROM ${battles}
      LEFT JOIN LATERAL unnest(${battles.reportedBy}) AS r ON true
      WHERE ${battles.startedAt} >= ${since}::date
      GROUP BY 1`),
    db.execute<{ d7: string; d30: string }>(sql`
      SELECT
        COUNT(DISTINCT r) FILTER (
          WHERE ${battles.startedAt} >= ${TODAY} - 6)::text AS d7,
        COUNT(DISTINCT r)::text AS d30
      FROM ${battles}, unnest(${battles.reportedBy}) AS r
      WHERE ${battles.startedAt} >= ${since}::date`),
  ]);
  return {
    region,
    users: Number(totals[0]?.users ?? 0),
    battles: Number(totals[0]?.battles ?? 0),
    activeWeek: Number(active[0]?.d7 ?? 0),
    activeMonth: Number(active[0]?.d30 ?? 0),
    daily,
  };
}

/**
 * The mod across the three servers. An account id belongs to one region, so
 * summing the regions' distinct counts counts nobody twice.
 */
export async function readModUsage() {
  const regions = await Promise.all(REGIONS.map(readRegionModUsage));
  const sumByDay = (pick: "battles" | "reporters") => {
    const byDay = new Map<string, number>();
    for (const d of regions.flatMap((r) => r.daily)) {
      byDay.set(d.day, (byDay.get(d.day) ?? 0) + Number(d[pick]));
    }
    return dense([...byDay].map(([day, n]) => ({ day, count: n })));
  };
  const sum = (pick: "users" | "battles" | "activeWeek" | "activeMonth") =>
    regions.reduce((acc, r) => acc + r[pick], 0);
  return {
    users: sum("users"),
    battles: sum("battles"),
    activeWeek: sum("activeWeek"),
    activeMonth: sum("activeMonth"),
    battlesDaily: sumByDay("battles"),
    uploadersDaily: sumByDay("reporters"),
    regions: regions.map(({ region, users, battles, activeMonth }) => ({
      region,
      users,
      battles,
      activeMonth,
    })),
  };
}

/** The bot's servers over time and the commands it answered. */
export async function readBotUsage() {
  const since = windowStart();
  const [guildRows, commandDaily, commandTotals, commandsAllTime] =
    await Promise.all([
      db.execute<{ day: string; count: string }>(sql`
        SELECT ${usageDaily.day}::text AS day, ${usageDaily.value}::text AS count
        FROM ${usageDaily}
        WHERE ${usageDaily.metric} = ${UsageMetric.BotGuilds}
          AND ${usageDaily.day} >= ${since}::date
        ORDER BY 1`),
      db.execute<{ day: string; count: string }>(sql`
        SELECT ${usageDaily.day}::text AS day, SUM(${usageDaily.value})::text AS count
        FROM ${usageDaily}
        WHERE ${usageDaily.metric} = ${UsageMetric.BotCommands}
          AND ${usageDaily.day} >= ${since}::date
        GROUP BY 1`),
      db.execute<{ command: string; count: string }>(sql`
        SELECT ${usageDaily.key} AS command, SUM(${usageDaily.value})::text AS count
        FROM ${usageDaily}
        WHERE ${usageDaily.metric} = ${UsageMetric.BotCommands}
          AND ${usageDaily.day} >= ${since}::date
        GROUP BY 1
        ORDER BY SUM(${usageDaily.value}) DESC`),
      db.execute<{ n: string; first: string | null }>(sql`
        SELECT COALESCE(SUM(${usageDaily.value}), 0)::text AS n,
               MIN(${usageDaily.day})::text AS first
        FROM ${usageDaily}
        WHERE ${usageDaily.metric} = ${UsageMetric.BotCommands}`),
    ]);

  const firstCommandDay = commandsAllTime[0]?.first ?? null;

  // A gauge is carried forward over a day it was not read, and the series
  // starts on the first reading rather than at a zero nobody measured: the
  // count of servers was never zero, it just was not written down yet.
  const readings = new Map(guildRows.map((r) => [r.day, Number(r.count)]));
  const guildsDaily: UsageDay[] = [];
  let last: number | null = null;
  for (const day of windowDays()) {
    last = readings.get(day) ?? last;
    if (last !== null) guildsDaily.push({ day, count: last });
  }

  return {
    guilds: last,
    guildsDaily,
    // Starts on the first day a command was counted, for the reason the gauge
    // above does: a zero before the counting began is a day nobody measured,
    // not a day nobody used the bot.
    commandsDaily: dense(commandDaily).filter(
      (d) => firstCommandDay !== null && d.day >= firstCommandDay,
    ),
    commandsMonth: commandTotals.reduce((acc, r) => acc + Number(r.count), 0),
    commandsAllTime: count(commandsAllTime),
    commands: commandTotals.map((r) => ({
      command: r.command,
      count: Number(r.count),
    })),
  };
}
