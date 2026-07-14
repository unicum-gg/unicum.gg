import { XMLParser } from "fast-xml-parser";
import { Region } from "../../region";
import type { Transport } from "../../client/transport";
import { RateLimit } from "../../client/rate-limiter";
import { fetchNations } from "./nations";
import {
  BRANCH_BY_REGION,
  computeTankId,
  rawUrl,
  VEHICLE_TYPES,
  WotSrcBranch,
} from "./mirror";

// UK's .po file doesn't match its dir name (historical artifact).
function poFilename(nation: string): string {
  return nation === "uk" ? "gb_vehicles.po" : `${nation}_vehicles.po`;
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

function unescapePo(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
function parsePo(text: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /^msgid\s+"((?:[^"\\]|\\.)*)"\s*\n\s*msgstr\s+"((?:[^"\\]|\\.)*)"/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) map.set(unescapePo(m[1]), unescapePo(m[2]));
  return map;
}
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

  async catalog(): Promise<WotSrcVehicle[]> {
    const branch = BRANCH_BY_REGION[this.region];
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
    const res = await this.t.get(new URL(url), { limit: RateLimit.None });
    return res.text();
  }

  async #nation(
    branch: WotSrcBranch,
    nation: string,
    nationIdx: number,
    parser: XMLParser,
  ): Promise<WotSrcVehicle[]> {
    const [xmlText, poText] = await Promise.all([
      this.#text(rawUrl(branch, `sources/res/scripts/item_defs/vehicles/${nation}/list.xml`)),
      this.#text(rawUrl(branch, `sources/res/text/lc_messages/${poFilename(nation)}`)),
    ]);
    const translations = parsePo(poText);
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
      const shortName = translations.get(shortKey) ?? translations.get(nameKey) ?? nameKey;
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
