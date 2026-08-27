import { XMLParser } from "fast-xml-parser";
import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import { loadPo } from "./localization";
import { fetchNations } from "./nations";
import {
  branchFor,
  computeTankId,
  rawUrl,
  VEHICLE_TYPES,
  WOTSRC_CACHE_TTL_MS,
  WotSrcBranch,
} from "./mirror";

// UK's .po file doesn't match its dir name (historical artifact).
/** The localization file a nation's vehicle names live in, without the `.po`
 * (that is `loadPo`'s to add). The client keeps Britain's under `gb`. */
export function poFilename(nation: string): string {
  return nation === "uk" ? "gb_vehicles" : `${nation}_vehicles`;
}

export type WotSrcVehicle = {
  tankId: number;
  tier: number;
  type: string;
  nation: string;
  name: string;
  shortName: string;
  tag: string;
  isPremium: boolean;
  isWheeled: boolean;
  isGift: boolean;
  /** Reward / special vehicle (earned, not sold), marked by the `special` tag.
   * These carry a gold price too, so they read as premium unless checked first. */
  isReward: boolean;
  /** Raw WoT role token from the vehicle tags, e.g. `role_HT_assault`. Null for
   * SPGs and any vehicle with no role tag. */
  role: string | null;
  /**
   * The localization file the vehicle's name is declared in, without the `.po`.
   * Usually the nation's own catalogue (`china_vehicles`), but the client
   * declares some vehicles elsewhere: the cybercafe reissues in `igr_vehicles`,
   * the training-room bots in `maps_training`, the story-mode props in
   * `story_mode.sm_battle`. Null when the entry names no reference at all.
   *
   * Structural: read from the vehicle's own declaration, so it says the same
   * thing whether or not the file behind it could be fetched.
   */
  nameSource: string | null;
  /**
   * Whether that reference actually resolved to a string. False leaves `name`
   * as the raw key.
   *
   * Kept apart from `nameSource` on purpose. Folding the two into one field
   * makes "the client files this vehicle elsewhere" indistinguishable from "the
   * localization did not load", and a consumer that hides on the union then
   * hides a whole nation the day one `.po` fetch fails.
   */
  isNamed: boolean;
  /** The vehicle's raw client tags, verbatim and in declaration order. */
  tags: string[];
};

type RawTankEntry = {
  id?: string;
  level?: string;
  userString?: string;
  shortUserString?: string;
  tags?: string;
  price?: string | { gold?: string; "#text"?: string };
};
type RawListXml = { root?: Record<string, RawTankEntry> };

/** A localization reference and the file it resolves against. */
type I18nRef = { file: string; key: string };

/**
 * Split a client localization reference into the `.po` file it names and the
 * key inside it. `#igr_vehicles:Ch17_WZ131_1_WZ132_IGR` reads `igr_vehicles`,
 * not the nation's own catalogue, which is where the IGR reissues, the
 * training-room bots and the story-mode props keep their names. A bare
 * reference (no `#file:` prefix) falls back to the nation file.
 */
function parseI18nRef(
  userString: string | undefined,
  fallbackFile: string,
): I18nRef {
  if (!userString) return { file: fallbackFile, key: "" };
  const ref = userString.startsWith("#") ? userString.slice(1) : userString;
  const i = ref.indexOf(":");
  if (i < 0) return { file: fallbackFile, key: ref };
  return { file: ref.slice(0, i), key: ref.slice(i + 1) };
}
function extractType(tags: string | undefined): string | null {
  if (!tags) return null;
  for (const t of tags.split(/\s+/)) if (VEHICLE_TYPES.has(t)) return t;
  return null;
}
function extractRole(tags: string | undefined): string | null {
  if (!tags) return null;
  for (const t of tags.split(/\s+/)) if (t.startsWith("role_")) return t;
  return null;
}

/**
 * Vehicle catalogue from the IzeBerg/wot-src GitHub mirror (the actual game
 * client scripts). Includes tanks WG removed from sale but that still appear
 * in player stats. ~22 raw fetches in parallel.
 */
export class SourceVehiclesResource {
  constructor(
    private readonly t: Transport,
    private readonly region: Region,
  ) {}

  async catalog(branchOverride?: WotSrcBranch): Promise<WotSrcVehicle[]> {
    const branch = branchFor(this.region, branchOverride);
    const nations = await fetchNations(this.t, branch);
    const parser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
      commentPropName: false,
    });
    const results = await Promise.all(
      nations.map((nation, idx) =>
        this.#nation(branch, nation, idx, parser).catch((err) => {
          console.error(`[wotsrc-${this.region}] ${nation} failed:`, err);
          return [] as WotSrcVehicle[];
        }),
      ),
    );
    return results.flat();
  }

  async #text(url: string): Promise<string> {
    return this.t.getText(new URL(url), {
      limit: RateLimit.None,
      cache: WOTSRC_CACHE_TTL_MS,
    });
  }

  async #nation(
    branch: WotSrcBranch,
    nation: string,
    nationIdx: number,
    parser: XMLParser,
  ): Promise<WotSrcVehicle[]> {
    const nationFile = poFilename(nation);
    // Through `loadPo`, like every other source resource, so a vehicle only
    // the test client has is still named in the site's language: that branch
    // is extracted from a Russian build, and read raw it put `Объект 430У`
    // and `ИС-7` in the catalogue, the tank list, search and the page title.
    const po = (file: string) => loadPo(branch, file, (url) => this.#text(url));
    // Started before the XML is awaited, not after: it is the one file we know
    // we need whatever the list turns out to reference, and `loadPo` memoizes
    // per (branch, file), so the collection pass below reuses this very promise
    // instead of paying a second sequential round trip.
    const nationPo = po(nationFile);
    const xmlText = await this.#text(
      rawUrl(branch, `sources/res/scripts/item_defs/vehicles/${nation}/list.xml`),
    );
    const parsed = parser.parse(xmlText) as RawListXml;
    // Parsed once, here: the ids and the two references are read by both the
    // file-collection pass and the emit loop below.
    const entries = Object.entries(parsed.root ?? {}).flatMap(([tag, fields]) => {
      if (!fields || typeof fields !== "object") return [];
      const localId = Number.parseInt(String(fields.id ?? "").trim(), 10);
      if (!Number.isFinite(localId)) return [];
      const type = extractType(fields.tags);
      if (!type) return [];
      return [{
        tag,
        fields,
        localId,
        type,
        nameRef: parseI18nRef(fields.userString, nationFile),
        shortRef: parseI18nRef(fields.shortUserString, nationFile),
      }];
    });
    // A nation's list references more than its own catalogue file, so collect
    // the files this build actually names and load them together. Only from
    // entries that survived the guards above, so a malformed row cannot cost
    // two fetches for a file nothing reads.
    const files = new Set<string>([nationFile]);
    for (const e of entries) {
      files.add(e.nameRef.file);
      if (e.shortRef.key) files.add(e.shortRef.file);
    }
    const loaded = await Promise.all(
      [...files].map(async (file) => [file, await po(file)] as const),
    );
    const translations = new Map(loaded);
    // A localization file that came back empty is a failed or truncated fetch,
    // never a real build: these carry hundreds of entries each. It must not be
    // reported as "the client does not name these vehicles", because a consumer
    // acting on that writes the conclusion to its own storage and one bad
    // response outlives the tick that produced it.
    //
    // For the nation's own catalogue that is the whole list, so it throws and
    // `catalog()` drops the nation for this tick, leaving whatever the consumer
    // already had. For any other file, only the entries that referenced it are
    // dropped, for the same reason and with the same self-healing.
    if ((await nationPo).size === 0) {
      throw new Error(`${nationFile}.po resolved empty for ${nation}`);
    }
    const unreadable = new Set(
      [...translations].filter(([, map]) => map.size === 0).map(([file]) => file),
    );
    const lookup = (ref: I18nRef): string | undefined =>
      // `shortUserString` is absent on every vehicle whose short name equals its
      // full name, so its key is routinely `""`. Looking that up asks the
      // translation map a question about no key at all, and whatever it answers
      // satisfies the `??` chain and suppresses the fallback. Guarded here as
      // well as in `parsePo` because the two are independent mistakes: one is a
      // map that should not hold the header, this one is a lookup that should
      // not happen.
      ref.key ? translations.get(ref.file)?.get(ref.key) : undefined;

    const out: WotSrcVehicle[] = [];
    for (const { tag, fields, localId, type, nameRef, shortRef } of entries) {
      if (unreadable.has(nameRef.file)) continue;
      const translated = lookup(nameRef);
      const name = translated ?? nameRef.key;
      const shortName = lookup(shortRef) ?? name;
      const priceField = fields.price;
      const isPremium =
        priceField !== undefined && typeof priceField === "object" && "gold" in priceField;
      const tagTokens = String(fields.tags ?? "").split(/\s+/);
      out.push({
        tankId: computeTankId(nationIdx, localId),
        tier: Number.parseInt(String(fields.level ?? "0"), 10),
        type,
        nation,
        name,
        shortName,
        tag,
        isPremium,
        isWheeled: tagTokens.includes("wheeled"),
        isGift: tagTokens.includes("gift"),
        isReward: tagTokens.includes("special"),
        role: extractRole(fields.tags),
        nameSource: nameRef.key ? nameRef.file : null,
        isNamed: translated !== undefined,
        tags: tagTokens,
      });
    }
    return out;
  }
}
