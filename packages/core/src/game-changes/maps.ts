import { sql } from "drizzle-orm";
import type { APIEmbed } from "discord-api-types/v10";
import {
  APP_IDENTITY,
  BATTLE_TYPE_LABEL,
  type BattleType,
  COMMON_TEST_ANCHOR,
  displayMapValue,
  env,
  MAP_PRESENCE_FIELD,
  MapChangeKind,
  mapChanges,
  resolveMapChangeField,
  splitVariantField,
  updateAnchor,
} from "@unicum.gg/shared";
import { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import {
  AnnouncementColor,
  clamp,
  DISCORD_LIMITS,
  embedLength,
  packBlocks,
  type Announcement,
} from "@unicum.gg/core/discord/announce";
import type {
  ChangedMap,
  MapChangeEntryRow,
} from "@unicum.gg/core/wargaming/wot/maps/history-read";
import type { RecordedVersion } from "./versions";

/**
 * Map changes, as `#map-changes` posts them: one message per game version, an
 * embed per map with its minimap, and the variants a version adds grouped
 * rather than given an embed each.
 *
 * The rows are read through the same readers as the site's `/maps/changes`
 * (`getRecentMapChanges`, `getPendingMapChanges`), so a variant arena is
 * already folded onto its map and an arena no page lists is already gone. What
 * this adds is the sentence: the history stores a field per marker family
 * (`geometry:comp7:spawns:team1`), and a card says "Allied spawns (Onslaught)
 * moved".
 */

/** A map with this many changes is a rework, and gets its minimap full width
 * rather than as a thumbnail. */
const REWORK_LINES = 4;
/** Lines per map on the card; the thread carries the rest. */
const CARD_LINES = 6;

/** Every version the map history holds, ordered and settled like the tanks'. */
export async function listMapVersions(): Promise<RecordedVersion[]> {
  const rows = await db
    .select({
      version: mapChanges.gameVersion,
      firstAt: sql<string>`min(${mapChanges.capturedAt})`,
      lastAt: sql<string>`max(${mapChanges.capturedAt})`,
    })
    .from(mapChanges)
    .groupBy(mapChanges.gameVersion);
  return rows.map((r) => ({
    version: r.version,
    firstAt: new Date(r.firstAt),
    lastAt: new Date(r.lastAt),
  }));
}

/** One recorded change as a sentence. */
function describe(change: MapChangeEntryRow): string {
  const field = resolveMapChangeField(change.field);
  const { previous, next } = change;
  switch (field.kind) {
    case MapChangeKind.Geometry:
      if (previous && next) return `${field.label} moved`;
      return `${field.label} ${next ? "added" : "removed"}`;
    case MapChangeKind.Mode:
      return `${field.label} ${next ? "added" : "removed"}`;
    case MapChangeKind.BattleType:
      return next ? `Now in ${field.label}` : `No longer in ${field.label}`;
    case MapChangeKind.RandomEvent:
      return `${field.label} event ${next ? "added" : "removed"}`;
    case MapChangeKind.Presence:
      return next ? `${field.label} added` : `${field.label} removed`;
    default:
      return `${field.label}: ${displayMapValue(change.field, previous) ?? "none"} → ${displayMapValue(change.field, next) ?? "none"}`;
  }
}

type MapCard = {
  map: ChangedMap;
  kind: "New map" | "Removed" | "Reworked" | "Adjusted";
  lines: string[];
};

/**
 * Read a version's maps into cards, and the variant arrivals into groups by
 * battle type: three maps gaining a Waffenträger version is one piece of news.
 */
function readMaps(maps: ChangedMap[]): {
  cards: MapCard[];
  variants: Map<BattleType, ChangedMap[]>;
} {
  const cards: MapCard[] = [];
  const variants = new Map<BattleType, ChangedMap[]>();
  for (const map of maps) {
    const rest: MapChangeEntryRow[] = [];
    for (const change of map.changes) {
      const variant = splitVariantField(change.field);
      if (variant?.field === MAP_PRESENCE_FIELD && change.next) {
        variants.set(variant.battleType, [
          ...(variants.get(variant.battleType) ?? []),
          map,
        ]);
        continue;
      }
      rest.push(change);
    }
    if (rest.length === 0) continue;
    const presence = rest.find((c) => c.field === MAP_PRESENCE_FIELD);
    const lines = presence
      ? [presence.next ? "Added to the game" : "Removed from the game"]
      : rest.map(describe);
    cards.push({
      map,
      kind: presence
        ? presence.next
          ? "New map"
          : "Removed"
        : lines.length >= REWORK_LINES
          ? "Reworked"
          : "Adjusted",
      lines,
    });
  }
  // The reworks lead, the small adjustments follow.
  cards.sort((a, b) => b.lines.length - a.lines.length);
  return { cards, variants };
}

type CardKind =
  | { live: true; version: string }
  | { live: false; version: string | null; updated: boolean };

/** The section a card is about, on the feed and on a map's History tab. */
const anchorOf = (kind: CardKind) =>
  kind.live ? updateAnchor(kind.version) : COMMON_TEST_ANCHOR;

const mapUrl = (map: ChangedMap, kind: CardKind) =>
  `${APP_IDENTITY.URL}/${Region.EU}/maps/${map.slug}/history#${anchorOf(kind)}`;

const feedUrl = (kind: CardKind) =>
  `${APP_IDENTITY.URL}/maps/changes#${anchorOf(kind)}`;

function bullets(lines: string[], max = Infinity): string {
  const shown = lines.slice(0, max).map((l) => `• ${l}`);
  const rest = lines.length - Math.min(lines.length, max);
  if (rest > 0) shown.push(`+${rest} more in the thread`);
  return shown.join("\n");
}

function cardEmbed(card: MapCard, color: number, kind: CardKind): APIEmbed {
  const big = card.kind === "Reworked" || card.kind === "New map";
  return {
    color,
    author: { name: card.kind },
    title: clamp(card.map.name, DISCORD_LIMITS.title),
    url: mapUrl(card.map, kind),
    description: clamp(bullets(card.lines, CARD_LINES), 1000),
    ...(card.map.minimapUrl
      ? big
        ? { image: { url: card.map.minimapUrl } }
        : { thumbnail: { url: card.map.minimapUrl } }
      : {}),
  };
}

function variantEmbed(
  battleType: BattleType,
  maps: ChangedMap[],
  color: number,
  kind: CardKind,
): APIEmbed {
  const n = maps.length;
  return {
    color,
    author: { name: "New versions" },
    title: `${BATTLE_TYPE_LABEL[battleType]} · ${n} ${n === 1 ? "map" : "maps"}`,
    url: feedUrl(kind),
    description: clamp(maps.map((m) => m.name).join(", "), 1000),
    ...(maps[0]?.minimapUrl ? { thumbnail: { url: maps[0].minimapUrl } } : {}),
  };
}

/** A version's (or the test's) maps as one announcement, or null when nothing
 * in it names a map a reader can open. */
export function renderMapAnnouncement(
  maps: ChangedMap[],
  kind: CardKind,
): Announcement | null {
  const { cards, variants } = readMaps(maps);
  if (cards.length === 0 && variants.size === 0) return null;

  const color = kind.live ? AnnouncementColor.Maps : AnnouncementColor.CommonTest;
  const all: APIEmbed[] = [
    ...cards.map((c) => cardEmbed(c, color, kind)),
    ...[...variants].map(([bt, ms]) => variantEmbed(bt, ms, color, kind)),
  ];

  // Discord's two ceilings on one message: ten embeds, and 6000 characters
  // across them. What does not fit is in the thread.
  const embeds: APIEmbed[] = [];
  let length = 0;
  for (const embed of all) {
    const size = embedLength(embed);
    if (
      embeds.length >= DISCORD_LIMITS.embedsPerMessage ||
      length + size > DISCORD_LIMITS.embedTotal
    ) {
      break;
    }
    embeds.push(embed);
    length += size;
  }

  const count = cards.length + [...variants.values()].reduce((s, m) => s + m.length, 0);
  const changed = `${count} ${count === 1 ? "map" : "maps"} changed`;
  const content = kind.live
    ? `**Update ${kind.version}** · ${changed}`
    : `**Common Test ${kind.version ?? "(not live yet)"}${kind.updated ? " (updated)" : ""}** · ${changed}. It can still change, or never ship.`;

  const cut =
    embeds.length < all.length || cards.some((c) => c.lines.length > CARD_LINES);
  return {
    pingRoleId: env.DISCORD_MAP_CHANGES_ROLE_ID ?? null,
    content,
    embeds,
    buttons: [
      { label: "All map changes", url: feedUrl(kind) },
      ...cards.slice(0, 2).map((c) => ({ label: c.map.name, url: mapUrl(c.map, kind) })),
    ],
    thread: cut
      ? {
          name: kind.live
            ? `Update ${kind.version} · every map`
            : "Common Test · every map",
          messages: packBlocks([
            ...cards.map(
              (c) => `**[${c.map.name}](<${mapUrl(c.map, kind)}>)** · ${c.kind}\n${bullets(c.lines)}`,
            ),
            ...[...variants].map(
              ([bt, ms]) =>
                `**${BATTLE_TYPE_LABEL[bt]} versions**\n${ms.map((m) => m.name).join(", ")}`,
            ),
          ]),
        }
      : undefined,
  };
}
