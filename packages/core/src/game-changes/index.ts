import { ChangelogProduct, env } from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";
import { discordBotEnabled } from "@unicum.gg/core/discord";
import {
  type Announcement,
  postAnnouncement,
} from "@unicum.gg/core/discord/announce";
import {
  readChangelogState,
  writeLastPublished,
} from "@unicum.gg/core/changelog/state";
import { getRecentMapChanges } from "@unicum.gg/core/wargaming/wot/maps/history-read";
import { getPendingMapChanges } from "@unicum.gg/core/wargaming/wot/maps/pending-read";
import { listMapVersions, renderMapAnnouncement } from "./maps";
import {
  listTankVersions,
  loadTankContext,
  readTankTestRows,
  readTankVersionRows,
  renderTankAnnouncement,
  type TankContext,
} from "./tanks";
import {
  planVersions,
  type RecordedVersion,
  sameBuild,
  testRef,
} from "./versions";

/**
 * Posts what changed in the game to `#tank-changes` and `#map-changes`: each
 * settled game version once, and each state of the Common Test once.
 *
 * Four feeds, each with its own marker in `changelog_state`, so a failure on
 * one (Discord refusing a card, a version still arriving) never holds back or
 * replays another. Nothing here is written by a model: the rows are the
 * site's own change history, and the cards only arrange them.
 */

export enum GameChangesOutcome {
  /** Announced to the channel. */
  Posted = "posted",
  /** Nothing new since the last announcement. */
  UpToDate = "up-to-date",
  /** No marker yet: recorded where the history stands without announcing. */
  Seeded = "seeded",
  /** Rendered but not sent (dry run). */
  DryRun = "dry-run",
  /** Discord did not take it, and the marker stays where it was. */
  Failed = "failed",
  /** The feed has no channel configured. */
  Off = "off",
}

export type GameChangesResult = {
  product: ChangelogProduct;
  outcome: GameChangesOutcome;
  /** What was (or would have been) announced, one entry per card. */
  announced: { label: string; announcement: Announcement }[];
};

/** One thing a feed has to announce: the marker it leaves once posted, and
 * the card, or null for a batch with nothing a reader could open (consumed
 * without a post, or every later run would re-read it). */
type Item = { ref: string; label: string; announcement: Announcement | null };

type Plan = { seed?: string; items: Item[] };

export function gameChangesEnabled(): boolean {
  return (
    discordBotEnabled() &&
    Boolean(
      env.DISCORD_TANK_CHANGES_CHANNEL_ID || env.DISCORD_MAP_CHANGES_CHANNEL_ID,
    )
  );
}

/**
 * Turn a version plan into items. With no marker, a dry run previews the newest
 * version instead of reporting a seed, since "seeded" would show a person
 * nothing to check.
 */
async function liveItems(
  versions: RecordedVersion[],
  marker: string | null,
  dryRun: boolean,
  render: (version: string) => Promise<Announcement | null>,
): Promise<Plan> {
  const plan = planVersions(versions, marker);
  if ("seed" in plan) {
    if (!plan.seed) return { items: [] };
    if (dryRun) {
      const v = plan.seed.version;
      return { items: [{ ref: v, label: v, announcement: await render(v) }] };
    }
    return { seed: plan.seed.version, items: [] };
  }
  const items: Item[] = [];
  for (const v of plan.pending) {
    items.push({
      ref: v.version,
      label: v.version,
      announcement: await render(v.version),
    });
  }
  return { items };
}

async function planTanks(marker: string | null, dryRun: boolean, context: () => Promise<TankContext>): Promise<Plan> {
  return liveItems(await listTankVersions(), marker, dryRun, async (version) =>
    renderTankAnnouncement(await readTankVersionRows(version), await context(), {
      live: true,
      version,
    }),
  );
}

async function planTankTest(marker: string | null, context: () => Promise<TankContext>): Promise<Plan> {
  const { version, rows } = await readTankTestRows();
  if (rows.length === 0) return { items: [] };
  const ref = testRef(version, rows);
  if (ref === marker) return { items: [] };
  return {
    items: [
      {
        ref,
        label: `Common Test ${version ?? ""}`.trim(),
        announcement: renderTankAnnouncement(rows, await context(), {
          live: false,
          version,
          updated: sameBuild(marker, ref),
        }),
      },
    ],
  };
}

async function planMaps(marker: string | null, dryRun: boolean): Promise<Plan> {
  return liveItems(await listMapVersions(), marker, dryRun, async (version) => {
    // The site's own feed reader, so a variant is folded onto its map and an
    // arena no page lists is left out exactly as on `/maps/changes`.
    const feed = await getRecentMapChanges(Region.EU, { versionLimit: 24 });
    const maps = feed.find((v) => v.gameVersion === version)?.maps ?? [];
    return renderMapAnnouncement(maps, { live: true, version });
  });
}

async function planMapTest(marker: string | null): Promise<Plan> {
  const pending = await getPendingMapChanges(Region.EU);
  if (pending.maps.length === 0) return { items: [] };
  const ref = testRef(
    pending.version,
    pending.maps.map((m) => [m.arenaId, m.changes]),
  );
  if (ref === marker) return { items: [] };
  return {
    items: [
      {
        ref,
        label: `Common Test ${pending.version ?? "(not live yet)"}`,
        announcement: renderMapAnnouncement(pending.maps, {
          live: false,
          version: pending.version,
          updated: sameBuild(marker, ref),
        }),
      },
    ],
  };
}

/** Post a feed's items in order, moving its marker after each, and stopping at
 * the first Discord refuses so the next run resumes there. */
async function run(
  product: ChangelogProduct,
  channelId: string | undefined,
  plan: (marker: string | null) => Promise<Plan>,
  dryRun: boolean,
): Promise<GameChangesResult> {
  // A dry run previews a feed even where no channel is configured, which is
  // the case on every machine but the worker.
  if (!channelId && !dryRun) {
    return { product, outcome: GameChangesOutcome.Off, announced: [] };
  }
  const marker = (await readChangelogState(product))?.ref ?? null;
  const { seed, items } = await plan(marker);
  const announced: GameChangesResult["announced"] = [];

  if (seed) {
    console.log(`[game-changes] ${product}: no marker, starting from ${seed} without announcing it`);
    if (!dryRun) await writeLastPublished(product, seed);
    return { product, outcome: GameChangesOutcome.Seeded, announced };
  }
  if (items.length === 0) {
    return { product, outcome: GameChangesOutcome.UpToDate, announced };
  }

  for (const item of items) {
    if (!dryRun && item.announcement) {
      const posted = await postAnnouncement(channelId!, item.announcement);
      if (!posted) {
        console.error(`[game-changes] ${product} ${item.label} did not post, the marker stays put`);
        return {
          product,
          outcome: announced.length > 0 ? GameChangesOutcome.Posted : GameChangesOutcome.Failed,
          announced,
        };
      }
    }
    if (item.announcement) {
      announced.push({ label: item.label, announcement: item.announcement });
    }
    if (!dryRun) await writeLastPublished(product, item.ref);
  }
  return {
    product,
    outcome: dryRun ? GameChangesOutcome.DryRun : GameChangesOutcome.Posted,
    announced,
  };
}

export async function publishGameChanges(
  options: { dryRun?: boolean } = {},
): Promise<GameChangesResult[]> {
  const dryRun = options.dryRun ?? false;
  // The catalogue and the play counts are only loaded when a vehicle card is
  // actually rendered, which is a handful of times a year.
  let tankContext: Promise<TankContext> | null = null;
  const context = () => (tankContext ??= loadTankContext());

  const tanks = env.DISCORD_TANK_CHANGES_CHANNEL_ID;
  const maps = env.DISCORD_MAP_CHANGES_CHANNEL_ID;
  return [
    await run(ChangelogProduct.TankChanges, tanks, (m) => planTanks(m, dryRun, context), dryRun),
    await run(ChangelogProduct.TankTestChanges, tanks, (m) => planTankTest(m, context), dryRun),
    await run(ChangelogProduct.MapChanges, maps, (m) => planMaps(m, dryRun), dryRun),
    await run(ChangelogProduct.MapTestChanges, maps, (m) => planMapTest(m), dryRun),
  ];
}
