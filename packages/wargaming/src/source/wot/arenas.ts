import { XMLParser } from "fast-xml-parser";
import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import { loadPo } from "./localization";
import {
  BRANCH_BY_REGION,
  rawUrl,
  WOTSRC_CACHE_TTL_MS,
  WotSrcBranch,
} from "./mirror";

// A world-space point on the map plane. Coordinates are the game's own X/Z
// metres (the arena_defs store `"<x> <z>"` strings); `y` (height) is irrelevant
// for a top-down minimap so we drop it.
export type ArenaPoint = { x: number; z: number };

// One playable gameplay type on a map, keyed by its raw WoT token (`ctf`,
// `domination`, `assault`, `assault2`, ...). Carries the per-team base flags and
// spawn points plus the domination control point, all in world coordinates, so
// a consumer can overlay them onto the minimap.
export type ArenaGameplay = {
  mode: string;
  bases: { team1: ArenaPoint[]; team2: ArenaPoint[] };
  spawns: { team1: ArenaPoint[]; team2: ArenaPoint[] };
  controlPoint: ArenaPoint | null;
  /** A mode can override the play area (Onslaught's `comp7` ships a reduced
   * bounding box); null means it uses the arena's own. */
  boundingBox: { bottomLeft: ArenaPoint; upperRight: ArenaPoint } | null;
  /** The mode's own minimap dds path, when it references a variant (Onslaught's
   * `mmap_comp7.dds`); null means it uses the arena's standard minimap. */
  minimap: string | null;
  /** Capturable points of interest (Onslaught's `pointsOfInterestUDO`): `type`
   * 1 = strike, 2 = recon. Empty for modes without them. */
  pointsOfInterest: { position: ArenaPoint; type: number }[];
};

export type WotSrcArena = {
  /** The client arena id and geometry folder name, e.g. `05_prohorovka`. */
  arenaId: string;
  /** Localized display name (e.g. "Prokhorovka"); falls back to the id. */
  name: string;
  /** Localized description; may be an empty string. */
  description: string;
  /** Playable area in world metres: bottom-left and upper-right corners. `null`
   * for maps with no arena_def geometry (legacy event/arcade maps kept only in
   * the localization + minimap assets). */
  boundingBox: { bottomLeft: ArenaPoint; upperRight: ArenaPoint } | null;
  /** Battle timer in seconds (`roundLength`). */
  roundLength: number;
  /** Vehicle camouflage kind: `summer` | `winter` | `desert`. */
  camouflage: string;
  /** Team size the map is built for (usually 15). 0 when unknown (no arena_def). */
  maxPlayersInTeam: number;
  /** Parsed gameplay types with their base/spawn geometry. */
  gameplay: ArenaGameplay[];
};

const COORD_RE = /^\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/;

function toPoint(value: unknown): ArenaPoint | null {
  const m = COORD_RE.exec(String(value ?? ""));
  return m ? { x: Number(m[1]), z: Number(m[2]) } : null;
}

// Walk any parsed sub-tree and collect every "<x> <z>" coordinate string. The
// per-team nodes mix `position` / `position1` keys, single values and arrays,
// and self-closing empty teams, so a recursive gather is simpler and more
// robust than reaching for specific keys.
function collectPoints(node: unknown): ArenaPoint[] {
  if (node == null) return [];
  if (typeof node === "string") {
    const p = toPoint(node);
    return p ? [p] : [];
  }
  if (Array.isArray(node)) return node.flatMap(collectPoints);
  if (typeof node === "object") return Object.values(node).flatMap(collectPoints);
  return [];
}

type RawTeamNode = Record<string, unknown> | string | undefined;
type RawGameplay = {
  teamBasePositions?: { team1?: RawTeamNode; team2?: RawTeamNode };
  teamSpawnPoints?: { team1?: RawTeamNode; team2?: RawTeamNode };
  controlPoint?: unknown;
  boundingBox?: { bottomLeft?: unknown; upperRight?: unknown };
  minimap?: unknown;
  pointsOfInterestUDO?: { point?: unknown };
};

// Normalize a `pointsOfInterestUDO` node (single node or array) into positioned,
// typed points; drops any without a valid position.
function parsePois(
  raw: RawGameplay["pointsOfInterestUDO"],
): { position: ArenaPoint; type: number }[] {
  const node = raw?.point;
  const list = Array.isArray(node) ? node : node != null ? [node] : [];
  const out: { position: ArenaPoint; type: number }[] = [];
  for (const p of list) {
    const rec = p as { position?: unknown; type?: unknown };
    const position = toPoint(rec?.position);
    if (position) out.push({ position, type: Number(rec?.type) || 0 });
  }
  return out;
}
type RawArena = {
  root?: {
    boundingBox?: {
      bottomLeft?: unknown;
      upperRight?: unknown;
    };
    roundLength?: unknown;
    vehicleCamouflageKind?: unknown;
    maxPlayersInTeam?: unknown;
    gameplayTypes?: Record<string, RawGameplay>;
  };
};

function parseGameplay(mode: string, raw: RawGameplay): ArenaGameplay {
  const bl = toPoint(raw.boundingBox?.bottomLeft);
  const ur = toPoint(raw.boundingBox?.upperRight);
  return {
    mode,
    bases: {
      team1: collectPoints(raw.teamBasePositions?.team1),
      team2: collectPoints(raw.teamBasePositions?.team2),
    },
    spawns: {
      team1: collectPoints(raw.teamSpawnPoints?.team1),
      team2: collectPoints(raw.teamSpawnPoints?.team2),
    },
    controlPoint: toPoint(raw.controlPoint),
    boundingBox: bl && ur ? { bottomLeft: bl, upperRight: ur } : null,
    minimap: raw.minimap != null ? String(raw.minimap) : null,
    pointsOfInterest: parsePois(raw.pointsOfInterestUDO),
  };
}

/**
 * Parse one `arena_defs/<id>.xml` into a `WotSrcArena`, or null when the file is
 * unparseable. Every arena the client ships is kept (the "is this a battle map"
 * opinion lives in the app layer, not here): the bounding box and gameplay may
 * be empty for non-combat spaces (hangar, comp7-only). `name` / `description`
 * come from the pre-loaded `arenas.po` map, falling back to the id.
 */
export function parseArena(
  arenaId: string,
  xml: string,
  parser: XMLParser,
  translations: Map<string, string>,
): WotSrcArena | null {
  const root = (parser.parse(xml) as RawArena).root;
  if (!root) return null;
  const bottomLeft = toPoint(root.boundingBox?.bottomLeft);
  const upperRight = toPoint(root.boundingBox?.upperRight);

  const gameplay = Object.entries(root.gameplayTypes ?? {}).map(([mode, raw]) =>
    parseGameplay(mode, raw ?? {}),
  );

  return {
    arenaId,
    name: translations.get(`${arenaId}/name`) ?? arenaId,
    description: translations.get(`${arenaId}/description`) ?? "",
    boundingBox:
      bottomLeft && upperRight ? { bottomLeft, upperRight } : null,
    roundLength: Number.parseInt(String(root.roundLength ?? "0"), 10) || 0,
    camouflage: String(root.vehicleCamouflageKind ?? "summer").trim(),
    // Most arena_defs omit this; the client falls back to the standard 15v15, so
    // we do too rather than reporting a meaningless 0.
    maxPlayersInTeam:
      Number.parseInt(String(root.maxPlayersInTeam ?? "15"), 10) || 15,
    gameplay,
  };
}

/** A map present in the localization/minimap assets but with no `arena_def`
 * geometry (legacy event/arcade maps like the "School" arcade or the `_wt`
 * Waffenträger reskins). Kept as a minimap-only card. */
function minimalArena(
  arenaId: string,
  translations: Map<string, string>,
): WotSrcArena {
  return {
    arenaId,
    name: translations.get(`${arenaId}/name`) ?? arenaId,
    description: translations.get(`${arenaId}/description`) ?? "",
    boundingBox: null,
    roundLength: 0,
    camouflage: "summer",
    maxPlayersInTeam: 0,
    gameplay: [],
  };
}

/** Arena ids from the game's own `_list_.xml` manifest (`<map><name>`). This is
 * the authoritative client arena list (includes event/mode variants that have
 * no `arenas.po` name, e.g. Last Stand `_ls26_*` and the hangar). */
function parseArenaList(xml: string): string[] {
  return [...xml.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1].trim());
}

/**
 * Battle-map catalogue from the wot-src client-script mirror. The arena list is
 * derived from `arenas.po` (every `<id>/name` key), then each arena's geometry
 * (bounding box, gameplay types, base/spawn points) is read from its
 * `arena_defs/<id>.xml`. WG's own `encyclopedia/arenas` endpoint returns empty,
 * so this mirror is the only usable source. Non-maps and event/mode variants
 * that share a base map's name are folded away in `core`.
 */
export class SourceArenasResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  async catalog(): Promise<WotSrcArena[]> {
    const branch = BRANCH_BY_REGION[this.region];
    const [translations, listXml] = await Promise.all([
      loadPo(branch, "arenas", (url) => this.#text(url)),
      this.#text(
        rawUrl(branch, "sources/res/scripts/arena_defs/_list_.xml"),
      ).catch(() => ""),
    ]);

    // Enumerate the union of every arena the game manifests (`_list_.xml`, the
    // authoritative client list) and every localized arena name (`arenas.po`,
    // which retains legacy event/arcade maps dropped from the manifest). Metadata
    // entries (`_default_`, `_list_`) are skipped.
    const poIds = [...translations.keys()]
      .filter((k) => k.endsWith("/name"))
      .map((k) => k.slice(0, -"/name".length));
    const ids = [...new Set([...parseArenaList(listXml), ...poIds])].filter(
      // Drop non-map ids: metadata (`_default_`, `_list_`), the `type/*` gameplay
      // definitions the `.po` also names ("Standard Battle", "Steel Hunt"), the
      // invalid placeholder, and the degenerate spaces that ship no real minimap.
      // The `hangar*` (garage) and `h33*` families carry only the shared "Dummy"
      // placeholder texture (or none at all), never a real top-down minimap.
      (id) =>
        !id.startsWith("_") &&
        !id.startsWith("type/") &&
        !id.startsWith("hangar") &&
        !id.startsWith("h33") &&
        id !== "invalid_map",
    );

    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
      commentPropName: false,
    });

    const arenas = await Promise.all(
      ids.map((id) =>
        this.#text(
          rawUrl(branch, `sources/res/scripts/arena_defs/${id}.xml`),
        )
          // A missing (404 -> catch) OR malformed (null -> ??) arena_defs file
          // still yields a minimap-only card rather than dropping the arena.
          .then(
            (xml) =>
              parseArena(id, xml, parser, translations) ??
              minimalArena(id, translations),
          )
          .catch(() => minimalArena(id, translations)),
      ),
    );
    return arenas.filter((a): a is WotSrcArena => a !== null);
  }

  #text(url: string): Promise<string> {
    return this.t.getText(new URL(url), {
      limit: RateLimit.None,
      cache: WOTSRC_CACHE_TTL_MS,
    });
  }
}
