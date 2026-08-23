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
function poFilename(nation: string): string {
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

function extractI18nKey(userString: string | undefined): string {
  if (!userString) return "";
  const i = userString.indexOf(":");
  return i >= 0 ? userString.slice(i + 1) : userString;
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
    const [xmlText, translations] = await Promise.all([
      this.#text(rawUrl(branch, `sources/res/scripts/item_defs/vehicles/${nation}/list.xml`)),
      // Through `loadPo`, like every other source resource, so a vehicle only
      // the test client has is still named in the site's language: that branch
      // is extracted from a Russian build, and read raw it put `Объект 430У`
      // and `ИС-7` in the catalogue, the tank list, search and the page title.
      loadPo(branch, poFilename(nation), (url) => this.#text(url)),
    ]);
    const parsed = parser.parse(xmlText) as RawListXml;
    const out: WotSrcVehicle[] = [];
    for (const [tag, fields] of Object.entries(parsed.root ?? {})) {
      if (!fields || typeof fields !== "object") continue;
      const localId = Number.parseInt(String(fields.id ?? "").trim(), 10);
      if (!Number.isFinite(localId)) continue;
      const type = extractType(fields.tags);
      if (!type) continue;
      const nameKey = extractI18nKey(fields.userString);
      const shortKey = extractI18nKey(fields.shortUserString);
      const name = translations.get(nameKey) ?? nameKey;
      // `shortUserString` is absent on every vehicle whose short name equals its
      // full name, so `shortKey` is routinely `""`. Looking that up asks the
      // translation map a question about no key at all, and whatever it answers
      // satisfies the `??` chain and suppresses the fallback. Guarded here as
      // well as in `parsePo` because the two are independent mistakes: one is a
      // map that should not hold the header, this one is a lookup that should
      // not happen.
      const shortName =
        (shortKey ? translations.get(shortKey) : undefined) ??
        translations.get(nameKey) ??
        nameKey;
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
      });
    }
    return out;
  }
}
