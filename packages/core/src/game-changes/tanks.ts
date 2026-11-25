import { eq, sql } from "drizzle-orm";
import type { APIEmbedField } from "discord-api-types/v10";
import {
  APP_IDENTITY,
  buildTankSlugIndex,
  COMMON_TEST_ANCHOR,
  env,
  resolveTrackedField,
  tankChanges,
  tankSpecSnapshots,
  tankStatsByRegion,
  tankTestChanges,
  updateAnchor,
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

/**
 * The vehicles a version brought into the game: those whose first snapshot was
 * taken under it. `tank_changes` cannot say this, since a vehicle that did not
 * exist has nothing to diff against, so until this read the card announced
 * every buff of a patch and none of its new tanks (2.4.1 brought 29).
 */
export async function readTankVersionArrivals(version: string): Promise<number[]> {
  const rows = (await db.execute(sql`
    select ${tankSpecSnapshots.tankId} as tank_id from ${tankSpecSnapshots}
    group by ${tankSpecSnapshots.tankId}
    having (array_agg(${tankSpecSnapshots.gameVersion} order by ${tankSpecSnapshots.capturedAt}))[1] = ${version}
  `)) as unknown as { tank_id: string | number }[];
  return rows.map((r) => Number(r.tank_id));
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
  vehicles.sort(byTierThenPlay);

  const mass = [...massFields].map((field) => {
    const label = resolveTrackedField(field)?.label ?? field;
    const n = tanksPerField.get(field)!.size;
    return `${label} changed on ${n.toLocaleString("en-US")} vehicles at once`;
  });
  return { vehicles, mass };
}

/** Highest tier first, since that is where the game is played and where a
 * change is read for; within a tier, the vehicles EU plays most. */
function byTierThenPlay(
  a: { meta: VehicleMeta; popularity: number },
  b: { meta: VehicleMeta; popularity: number },
): number {
  return b.meta.tier - a.meta.tier || b.popularity - a.popularity;
}

type CardKind =
  | { live: true; version: string }
  | { live: false; version: string | null; updated: boolean };

/** The section a card is about, on the feed and on a vehicle's History tab. */
const anchorOf = (kind: CardKind) =>
  kind.live ? updateAnchor(kind.version) : COMMON_TEST_ANCHOR;

const historyUrl = (slug: string, kind: CardKind) =>
  `${APP_IDENTITY.URL}/${Region.EU}/tanks/${slug}/history#${anchorOf(kind)}`;

/** Where "every change" lives: the feed's section for a live version, and the
 * catalogue filtered to the test for a Common Test, which the feed does not
 * carry (it is on each vehicle's History tab instead). */
const changesUrl = (kind: CardKind) =>
  kind.live
    ? `${APP_IDENTITY.URL}/tanks/changes#${updateAnchor(kind.version)}`
    : `${APP_IDENTITY.URL}/tanks?test=1`;

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

/** A new vehicle as one line, linking to its page. */
function arrivalLine(v: Vehicle): string {
  return `**[${v.meta.shortName}](<${APP_IDENTITY.URL}/${Region.EU}/tanks/${v.slug}>)** · ${vehicleLine(v.meta)}`;
}

/** The new vehicles that fit one field, the rest counted on a last line. */
function arrivalsField(arrivals: Vehicle[]): APIEmbedField {
  const lines: string[] = [];
  let length = 0;
  for (const v of arrivals) {
    const line = arrivalLine(v);
    // Room kept for the count line under the field's 1024 characters.
    if (length + line.length + 1 > DISCORD_LIMITS.fieldValue - 40) break;
    lines.push(line);
    length += line.length + 1;
  }
  const rest = arrivals.length - lines.length;
  if (rest > 0) lines.push(`+${rest} more in the thread`);
  return { name: `🆕 New vehicles (${arrivals.length})`, value: lines.join("\n") };
}

function threadBlock(v: ChangedVehicle, kind: CardKind): string {
  return `**[${v.meta.shortName}](<${historyUrl(v.slug, kind)}>)** · ${vehicleLine(v.meta)}\n${diffBlock(v.diff)}`;
}

/**
 * The card for one batch of changes, or null when nothing in it names a
 * vehicle a reader could look up (every row on a vehicle EU does not carry).
 */
export function renderTankAnnouncement(
  rows: (SpecChangeRow & { tankId: number })[],
  context: TankContext,
  kind: CardKind,
  /** The vehicles this version brought in (`readTankVersionArrivals`), led
   * with on the card since a new tank is what a patch is read for first. */
  arrivalIds: number[] = [],
): Announcement | null {
  const { vehicles, mass } = group(rows, context);
  const arrivals = arrivalIds
    .map((id) => context.vehicles.get(id))
    // A vehicle a player can actually get: an event mode's copies, its bots and
    // the parallel IGR catalogue arrive in batches every event and would bury
    // the one new tank a patch is read for (2.4.1's 29 held 11 Story Mode and
    // Halloween copies).
    .filter((v): v is Vehicle => v !== undefined && v.meta.variant === null && v.meta.eventRole === null)
    .map((v) => ({ ...v, popularity: context.popularity.get(v.tankId) ?? 0 }))
    .sort(byTierThenPlay);
  if (vehicles.length === 0 && mass.length === 0 && arrivals.length === 0) return null;

  const n = vehicles.length;
  const changed = [
    ...(arrivals.length > 0
      ? [`${arrivals.length} new ${arrivals.length === 1 ? "vehicle" : "vehicles"}`]
      : []),
    ...(n > 0 || arrivals.length === 0 ? [`${n} ${n === 1 ? "vehicle" : "vehicles"} changed`] : []),
  ].join(", ");
  const build = kind.version ?? "test client";
  const title = kind.live
    ? `Update ${kind.version} · ${changed}`
    : `Common Test ${build}${kind.updated ? " (updated)" : ""} · ${changed}`;
  const description = kind.live
    ? "Highest tier first."
    : "What Wargaming is testing right now, against the live client. It can still change, or never ship.";

  const fields: APIEmbedField[] = [
    ...(arrivals.length > 0 ? [arrivalsField(arrivals)] : []),
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
      url: changesUrl(kind),
    },
    ...vehicles
      .slice(0, 2)
      .map((v) => ({ label: v.meta.shortName, url: historyUrl(v.slug, kind) })),
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
        url: changesUrl(kind),
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
    // New vehicles lead it too, all of them, when the card had to cut the list.
    thread:
      hidden > 0 ||
      vehicles.some((v) => v.diff.lines.length > CARD_LINES) ||
      arrivalsField(arrivals).value.includes("more in the thread")
        ? {
            name: kind.live
              ? `Update ${kind.version} · every vehicle`
              : `Common Test ${build} · every vehicle`,
            messages: packBlocks([
              ...(arrivals.length > 0
                ? [`**🆕 New vehicles (${arrivals.length})**\n${arrivals.map(arrivalLine).join("\n")}`]
                : []),
              ...vehicles.map((v) => threadBlock(v, kind)),
            ]),
          }
        : undefined,
  };
}
