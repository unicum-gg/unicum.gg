import { eq, sql } from "drizzle-orm";
import type { APIEmbedField } from "discord-api-types/v10";
import {
  APP_IDENTITY,
  buildTankSlugIndex,
  env,
  resolveTrackedField,
  tankChanges,
  tankStatsByRegion,
  tankTestChanges,
  type VehicleMeta,
} from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import {
  AnnouncementColor,
  clamp,
  DISCORD_LIMITS,
  packBlocks,
  type Announcement,
  type LinkButton,
} from "@unicum.gg/core/discord/announce";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  diffBlock,
  diffTank,
  type SpecChangeRow,
  type TankDiff,
  Verdict,
  VERDICT_EMOJI,
  vehicleLine,
} from "./tank-lines";
import type { RecordedVersion } from "./versions";

/**
 * Vehicle balance changes, as `#tank-changes` posts them: one card per game
 * version once it has settled, one per state of the Common Test.
 *
 * The rows are the ones the site's own changes feed reads (`tank_changes`,
 * `tank_test_changes`), named from the EU catalogue: balance is global, and a
 * vehicle EU does not carry is one almost nobody reading the channel plays.
 */

/** Vehicles the card shows; the rest, and every line of every vehicle, are in
 * the thread. Five fit Discord's 6000 characters with room to spare. */
const CARD_TANKS = 5;
/** Lines per vehicle on the card. */
const CARD_LINES = 6;

/**
 * A field that changed on this many vehicles in one version is not a balance
 * pass, it is a change to how the field is read (2.4.1 once recorded gun
 * elevation and depression swapped on all 1,236 vehicles, when our own reading
 * of them was fixed; `repairGunPitch` took it out). It is said once, as one line,
 * rather than printed under every vehicle in the game.
 */
const MASS_CHANGE_TANKS = 150;

type Vehicle = { tankId: number; meta: VehicleMeta; slug: string };

type ChangedVehicle = Vehicle & { diff: TankDiff; popularity: number };

/** What every card is built from, loaded once a run. */
export type TankContext = {
  vehicles: Map<number, Vehicle>;
  /** How much each vehicle is played on EU, to put the ones readers drive
   * first. */
  popularity: Map<number, number>;
};

export async function loadTankContext(): Promise<TankContext> {
  const [encyclopedia, stats] = await Promise.all([
    getVehicleEncyclopedia(Region.EU),
    db
      .select({
        tankId: tankStatsByRegion[Region.EU].tankId,
        players: tankStatsByRegion[Region.EU].players,
        avgBattles: tankStatsByRegion[Region.EU].avgBattles,
      })
      .from(tankStatsByRegion[Region.EU]),
  ]);
  const slugs = buildTankSlugIndex(encyclopedia).idToSlug;
  const vehicles = new Map<number, Vehicle>();
  for (const [id, meta] of Object.entries(encyclopedia)) {
    const tankId = Number(id);
    const slug = slugs.get(tankId);
    if (!slug || meta.isHidden) continue;
    vehicles.set(tankId, { tankId, meta, slug });
  }
  return {
    vehicles,
    popularity: new Map(
      stats.map((s) => [Number(s.tankId), s.players * s.avgBattles]),
    ),
  };
}

/** Every version the history holds, with when it started and stopped
 * receiving rows. */
export async function listTankVersions(): Promise<RecordedVersion[]> {
  const rows = await db
    .select({
      version: tankChanges.gameVersion,
      firstAt: sql<string>`min(${tankChanges.capturedAt})`,
      lastAt: sql<string>`max(${tankChanges.capturedAt})`,
    })
    .from(tankChanges)
    .groupBy(tankChanges.gameVersion);
  return rows.map((r) => ({
    version: r.version,
    firstAt: new Date(r.firstAt),
    lastAt: new Date(r.lastAt),
  }));
}

export async function readTankVersionRows(
  version: string,
): Promise<(SpecChangeRow & { tankId: number })[]> {
  const rows = await db
    .select({
      tankId: tankChanges.tankId,
      field: tankChanges.field,
      previous: tankChanges.previous,
      next: tankChanges.next,
    })
    .from(tankChanges)
    .where(eq(tankChanges.gameVersion, version));
  return rows.map((r) => ({ ...r, tankId: Number(r.tankId) }));
}

/** The running test's rows and its build, or null rows when no test runs. */
export async function readTankTestRows(): Promise<{
  version: string | null;
  rows: (SpecChangeRow & { tankId: number })[];
}> {
  const rows = await db
    .select({
      tankId: tankTestChanges.tankId,
      testVersion: tankTestChanges.testVersion,
      field: tankTestChanges.field,
      previous: tankTestChanges.previous,
      next: tankTestChanges.next,
    })
    .from(tankTestChanges);
  return {
    version: rows[0]?.testVersion ?? null,
    rows: rows.map(({ testVersion: _, ...r }) => ({
      ...r,
      tankId: Number(r.tankId),
    })),
  };
}

/**
 * Split the rows into the per-vehicle changes and the fields that moved on so
 * many vehicles at once that they are one fact rather than a balance pass.
 */
function group(
  rows: (SpecChangeRow & { tankId: number })[],
  context: TankContext,
): { vehicles: ChangedVehicle[]; mass: string[] } {
  const tanksPerField = new Map<string, Set<number>>();
  for (const r of rows) {
    const set = tanksPerField.get(r.field) ?? new Set();
    set.add(r.tankId);
    tanksPerField.set(r.field, set);
  }
  const massFields = new Set(
    [...tanksPerField]
      .filter(([, tanks]) => tanks.size >= MASS_CHANGE_TANKS)
      .map(([field]) => field),
  );

  const byTank = new Map<number, SpecChangeRow[]>();
  for (const r of rows) {
    if (massFields.has(r.field)) continue;
    const list = byTank.get(r.tankId) ?? [];
    list.push(r);
    byTank.set(r.tankId, list);
  }

  const vehicles: ChangedVehicle[] = [];
  for (const [tankId, changes] of byTank) {
    const vehicle = context.vehicles.get(tankId);
    if (!vehicle) continue;
    const diff = diffTank(changes);
    if (diff.lines.length === 0) continue;
    vehicles.push({
      ...vehicle,
      diff,
      popularity: context.popularity.get(tankId) ?? 0,
    });
  }
  vehicles.sort((a, b) => b.popularity - a.popularity);

  const mass = [...massFields].map((field) => {
    const label = resolveTrackedField(field)?.label ?? field;
    const n = tanksPerField.get(field)!.size;
    return `${label} changed on ${n.toLocaleString("en-US")} vehicles at once`;
  });
  return { vehicles, mass };
}

const historyUrl = (slug: string) =>
  `${APP_IDENTITY.URL}/${Region.EU}/tanks/${slug}/history`;

function verdictCounts(vehicles: ChangedVehicle[]): APIEmbedField[] {
  const count = (v: Verdict) =>
    vehicles.filter((x) => x.diff.verdict === v).length;
  return [
    { name: "Buffed", value: `${VERDICT_EMOJI[Verdict.Buff]} ${count(Verdict.Buff)}`, inline: true },
    { name: "Nerfed", value: `${VERDICT_EMOJI[Verdict.Nerf]} ${count(Verdict.Nerf)}`, inline: true },
    { name: "Mixed", value: `${VERDICT_EMOJI[Verdict.Mixed]} ${count(Verdict.Mixed)}`, inline: true },
  ];
}

function vehicleField(v: ChangedVehicle): APIEmbedField {
  return {
    name: clamp(
      `${VERDICT_EMOJI[v.diff.verdict]} ${v.meta.shortName} · ${vehicleLine(v.meta)}`,
      DISCORD_LIMITS.fieldName,
    ),
    value: clamp(diffBlock(v.diff, CARD_LINES), DISCORD_LIMITS.fieldValue),
  };
}

function threadBlock(v: ChangedVehicle): string {
  return `**[${v.meta.shortName}](<${historyUrl(v.slug)}>)** · ${vehicleLine(v.meta)}\n${diffBlock(v.diff)}`;
}

type CardKind =
  | { live: true; version: string }
  | { live: false; version: string | null; updated: boolean };

/**
 * The card for one batch of changes, or null when nothing in it names a
 * vehicle a reader could look up (every row on a vehicle EU does not carry).
 */
export function renderTankAnnouncement(
  rows: (SpecChangeRow & { tankId: number })[],
  context: TankContext,
  kind: CardKind,
): Announcement | null {
  const { vehicles, mass } = group(rows, context);
  if (vehicles.length === 0 && mass.length === 0) return null;

  const n = vehicles.length;
  const changed = `${n} ${n === 1 ? "vehicle" : "vehicles"} changed`;
  const build = kind.version ?? "test client";
  const title = kind.live
    ? `Update ${kind.version} · ${changed}`
    : `Common Test ${build}${kind.updated ? " (updated)" : ""} · ${changed}`;
  const description = kind.live
    ? "Most played first."
    : "What Wargaming is testing right now, against the live client. It can still change, or never ship.";

  const fields: APIEmbedField[] = [
    ...(n > 0 ? verdictCounts(vehicles) : []),
    ...vehicles.slice(0, CARD_TANKS).map(vehicleField),
    ...(mass.length > 0
      ? [{ name: "Across the board", value: clamp(mass.join("\n"), DISCORD_LIMITS.fieldValue) }]
      : []),
  ];
  const hidden = n - Math.min(n, CARD_TANKS);

  const buttons: LinkButton[] = [
    {
      label: kind.live ? `All changes in ${kind.version}` : "Common Test changes",
      url: `${APP_IDENTITY.URL}/tanks/changes`,
    },
    ...vehicles
      .slice(0, 2)
      .map((v) => ({ label: v.meta.shortName, url: historyUrl(v.slug) })),
  ];

  return {
    pingRoleId: env.DISCORD_TANK_CHANGES_ROLE_ID ?? null,
    embeds: [
      {
        color: kind.live ? AnnouncementColor.Live : AnnouncementColor.CommonTest,
        author: {
          name: kind.live
            ? `${APP_IDENTITY.NAME} · Tank changes`
            : `${APP_IDENTITY.NAME} · Common Test · not live`,
        },
        title: clamp(title, DISCORD_LIMITS.title),
        url: `${APP_IDENTITY.URL}/tanks/changes`,
        description,
        fields,
        footer: {
          text:
            hidden > 0
              ? `+${hidden} more ${hidden === 1 ? "vehicle" : "vehicles"} in the thread`
              : "Every change is on unicum.gg",
        },
        timestamp: new Date().toISOString(),
      },
    ],
    buttons,
    // The thread carries every vehicle, the card's included, with every line:
    // the card cuts each block at six lines.
    thread:
      n > 0 && (hidden > 0 || vehicles.some((v) => v.diff.lines.length > CARD_LINES))
        ? {
            name: kind.live
              ? `Update ${kind.version} · every vehicle`
              : `Common Test ${build} · every vehicle`,
            messages: packBlocks(vehicles.map(threadBlock)),
          }
        : undefined,
  };
}
