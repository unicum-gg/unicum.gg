import { XMLParser } from "fast-xml-parser";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import { parseArena, type WotSrcArena } from "./arenas";
import { WOTSRC_CACHE_TTL_MS } from "./mirror";

// The catalogue of the maps the game no longer ships, on the `ARCHIVE` branch of
// our minimap mirror. The live mirrors only ever describe today's client, so a
// map Wargaming pulled is gone from them; this branch is rebuilt from the full
// clients the Internet Archive preserves (0.6.2 to 0.9.7), a decompiled mirror
// of the versions after them, and our own mirror's history since 1.13. Each
// retired arena carries its last definition, the same `arena_defs` format the
// live catalogue parses, and an `index.json` entry saying when it was in the game
// and what it was called. Region-agnostic: a map left every server together.
export const ARCHIVE_REPO = "unicum-gg/wot.maps";
export const ARCHIVE_BRANCH = "ARCHIVE";

const archiveUrl = (path: string) =>
  `https://raw.githubusercontent.com/${ARCHIVE_REPO}/${ARCHIVE_BRANCH}/${path}`;

/** Which branch of the minimap mirror draws a retired arena: `ARCHIVE` for the
 * ones cut from an archived client, `WG` for a map retired since the live
 * mirror began (it keeps what it published). */
export enum ArchivedMinimapBranch {
  Archive = "ARCHIVE",
  Live = "WG",
}

/** When a retired arena was in the game. Versions are three-part, the form the
 * map history uses (`0.8.11`). */
export type ArenaRetirement = {
  firstVersion: string;
  lastVersion: string;
  /** When the last version carrying it shipped, i.e. the last month it could be
   * played. An ISO date, null when that version could not be dated. */
  lastDate: string | null;
  minimap: ArchivedMinimapBranch | null;
  /** Whether the definition is a garage's rather than a battlefield's: its
   * music, ambience or sound banks are the hangar's (`hangar_h20_music`,
   * `ev_2020_secret_event_hangar.bnk`). The client defines its seasonal
   * garages as arenas too, with a placeholder `ctf` block, so nothing else in
   * the file tells them apart. */
  hangar: boolean;
};

export type WotSrcRetiredArena = WotSrcArena & { retired: ArenaRetirement };

/**
 * What one update did to a map's look, from the archive's visual history
 * (`history/index.json`): how many bytes of its standard and HD packages the
 * update's own delta rewrote, and the minimap before and after when it was
 * redrawn. Only the updates past the archive's threshold are listed, so every
 * entry is a rework rather than a repack. Covers the versions whose patches the
 * archive holds (1.19.1 onward).
 */
/** The kinds placed objects are counted under, as the archive names them. */
export enum ArchivedObjectKind {
  Buildings = "buildings",
  Fences = "fences",
  Rocks = "rocks",
  Military = "military",
  Bridges = "bridges",
  Vegetation = "vegetation",
  Props = "props",
}

/** The other things an update can touch in a map's files. */
export enum ArchivedMapAspect {
  Ground = "ground",
  Sky = "sky",
  Sound = "sound",
  Water = "water",
  Effects = "effects",
  Vegetation = "vegetation",
  Models = "models",
}

export type ArchivedReliefChange = {
  /** Highest rise and deepest drop, in metres (drop positive). */
  rise: number;
  drop: number;
  /** Square metres that moved past `threshold`. */
  area: number;
  /** Metres: 0.25, or 2 for a map reshaped end to end. */
  threshold: number;
  /** Most of the map moved even past 2 m: there is no overlay. */
  rebuilt: boolean;
  /** The newer minimap and the transparent overlay drawn on it (red raised,
   * blue lowered), as paths on the archive branch. */
  base: string;
  overlay: string | null;
};

export type ArchivedObjectsChange = {
  added: Partial<Record<ArchivedObjectKind, number>>;
  removed: Partial<Record<ArchivedObjectKind, number>>;
  /** Most of the map's objects were replaced: there is no overlay. */
  rebuilt: boolean;
  /** The newer minimap and the overlay of dots (green added, red removed). */
  base: string;
  overlay: string | null;
};

/** A minimap an archived full client drew, and the last version it is known
 * to hold for. */
export type ArchivedLegacyMinimap = { version: string; through: string };

export type ArchivedVisualChange = {
  version: string;
  from: string;
  /** Set when the change was measured across versions no client survives in
   * (the 1.0 rework): the newer client compared, which `version` is not. */
  through?: string;
  bytes: number;
  hdBytes: number;
  /** A package was shipped whole, so how much of it changed is unknown. */
  replaced: boolean;
  /** Paths on the archive branch. */
  minimap: { before: string; after: string } | null;
  /** Where the ground moved, past 25 cm (2 m on a map reshaped end to end). */
  relief: ArchivedReliefChange | null;
  /** What was built or pulled down. */
  objects: ArchivedObjectsChange | null;
  /** The rest the update touched. */
  aspects: ArchivedMapAspect[];
};

type IndexEntry = {
  name: string | null;
  description: string | null;
  firstVersion: string;
  lastVersion: string;
  lastDate: string | null;
  minimap: string | null;
};

const MINIMAP_BRANCHES = new Set<string>(Object.values(ArchivedMinimapBranch));

/** How the old clients write an empty string. The archive drops it, and this is
 * the guard behind that: published, it reads `?empty?` on the page. */
const EMPTY = "?empty?";
const text = (value: string | null) => (value && value.trim() !== EMPTY ? value : null);

/**
 * Every retired battle arena, parsed with the live catalogue's own parser.
 *
 * Unfiltered: an arena the live client defines again (the seasonal maps come
 * back every year) is still listed here as it was when it last left, and it is
 * the caller, holding the live catalogue, that drops it.
 */
export class SourceArchivedArenasResource {
  constructor(private readonly t: Transport) {}

  /**
   * Arena id -> the name the game gave it, for every retired arena that had
   * one. What a reader of a past version needs when today's strings no longer
   * name a map: the client drops a map's entry some time after the map itself.
   */
  async names(): Promise<Map<string, string>> {
    const index = await this.#index();
    return new Map(
      Object.entries(index).flatMap(([id, entry]) => {
        const name = text(entry.name);
        return name ? [[id, name]] : [];
      }),
    );
  }

  /** Arena id -> what each update did to its look, oldest first. Empty when the
   * archive carries no visual history. */
  async visualHistory(): Promise<Record<string, ArchivedVisualChange[]>> {
    try {
      return JSON.parse(await this.#text(archiveUrl("history/index.json"))) as Record<
        string,
        ArchivedVisualChange[]
      >;
    } catch {
      return {};
    }
  }

  /** Arena id -> the minimaps the archived full clients drew (0.6.2 to 0.9.7,
   * and 1.15.0), oldest first, one per version that redrew the map: the
   * minimap at a version is the newest image at or below it, while the version
   * is at or below that image's `through`. The image is at
   * `history/<id>/<version>.webp`. Empty when the archive carries none. */
  async legacyMinimaps(): Promise<Record<string, ArchivedLegacyMinimap[]>> {
    try {
      const index = JSON.parse(
        await this.#text(archiveUrl("history/legacy-minimaps.json")),
      ) as Record<string, (ArchivedLegacyMinimap | string)[]>;
      // The first publication listed bare versions, all from the old clients.
      return Object.fromEntries(
        Object.entries(index).map(([id, entries]) => [
          id,
          entries.map((e) => (typeof e === "string" ? { version: e, through: "0.9.7" } : e)),
        ]),
      );
    } catch {
      return {};
    }
  }

  async catalog(): Promise<WotSrcRetiredArena[]> {
    const index = await this.#index();
    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
      commentPropName: false,
    });
    const arenas = await Promise.all(
      Object.entries(index).map(async ([arenaId, entry]) => {
        const translations = new Map<string, string>();
        const name = text(entry.name);
        const description = text(entry.description);
        if (name) translations.set(`${arenaId}/name`, name);
        if (description) translations.set(`${arenaId}/description`, description);
        try {
          const xml = await this.#text(archiveUrl(`arena_defs/${arenaId}.xml`));
          const arena = parseArena(arenaId, xml, parser, translations);
          if (!arena) return null;
          const retired: ArenaRetirement = {
            firstVersion: entry.firstVersion,
            lastVersion: entry.lastVersion,
            lastDate: entry.lastDate,
            minimap:
              entry.minimap && MINIMAP_BRANCHES.has(entry.minimap)
                ? (entry.minimap as ArchivedMinimapBranch)
                : null,
            hangar: /<(?:wwmusic|wwambientSound|bank)>[^<]*hangar/i.test(xml),
          };
          return { ...arena, retired };
        } catch {
          // A definition that will not fetch costs that one map, never the
          // catalogue: the archive is a bonus over the live maps.
          return null;
        }
      }),
    );
    return arenas.filter((a): a is WotSrcRetiredArena => a !== null && a.gameplay.length > 0);
  }

  async #index(): Promise<Record<string, IndexEntry>> {
    return JSON.parse(await this.#text(archiveUrl("index.json"))) as Record<string, IndexEntry>;
  }

  #text(url: string): Promise<string> {
    return this.t.getText(new URL(url), {
      limit: RateLimit.None,
      cache: WOTSRC_CACHE_TTL_MS,
    });
  }
}
