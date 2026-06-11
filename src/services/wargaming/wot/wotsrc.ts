import { XMLParser } from "fast-xml-parser";
import { Region } from ".";

const REPO = "IzeBerg/wot-src";

// Source-of-truth order. The array index doubles as the nation's encoded
// value in `tank_id`: bits 0-3 = item type (1 for vehicles), bits 4-7 =
// position in this array, bits 8+ = local id within the nation's list.xml.
// Verified empirically against the eu_vehicles dump:
// ((tank_id >> 4) & 0x0F) matches this array's index for every row.
const NATIONS = [
  "ussr",
  "germany",
  "usa",
  "china",
  "france",
  "uk",
  "japan",
  "czech",
  "sweden",
  "poland",
  "italy",
] as const;
type Nation = (typeof NATIONS)[number];

// UK is the only nation whose .po file doesn't match its dir name (historical
// artifact in the WoT client tree).
function poFilename(nation: Nation): string {
  return nation === "uk" ? "gb_vehicles.po" : `${nation}_vehicles.po`;
}

const VEHICLE_TYPES = new Set([
  "heavyTank",
  "mediumTank",
  "lightTank",
  "AT-SPG",
  "SPG",
]);

const BRANCH_BY_REGION: Record<Region, string> = {
  [Region.EU]: "EU",
  [Region.NA]: "NA",
  [Region.ASIA]: "ASIA",
};

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
};

type RawTankEntry = {
  id?: string;
  level?: string;
  userString?: string;
  shortUserString?: string;
  tags?: string;
  price?: string | { gold?: string; "#text"?: string };
};

type RawListXml = {
  root?: Record<string, RawTankEntry>;
};

function rawUrl(branch: string, path: string): string {
  return `https://raw.githubusercontent.com/${REPO}/${branch}/${path}`;
}

function computeTankId(nationIdx: number, localId: number): number {
  return (localId << 8) | (nationIdx << 4) | 1;
}

function unescapePo(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function parsePo(text: string): Map<string, string> {
  // Matches consecutive `msgid "x"` / `msgstr "y"` lines. The keys we look up
  // (vehicle names + short names) are always single-line, so we don't need to
  // handle the multi-line "msgid \"\"\n\"line1\"\n\"line2\"" form.
  const map = new Map<string, string>();
  const re = /^msgid\s+"((?:[^"\\]|\\.)*)"\s*\n\s*msgstr\s+"((?:[^"\\]|\\.)*)"/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    map.set(unescapePo(m[1]), unescapePo(m[2]));
  }
  return map;
}

function extractI18nKey(userString: string | undefined): string {
  // userString format in list.xml: "#<nation>_vehicles:<key>". We strip the
  // namespace prefix to get the plain msgid we look up in the .po.
  if (!userString) return "";
  const i = userString.indexOf(":");
  return i >= 0 ? userString.slice(i + 1) : userString;
}

function extractType(tags: string | undefined): string | null {
  if (!tags) return null;
  for (const t of tags.split(/\s+/)) {
    if (VEHICLE_TYPES.has(t)) return t;
  }
  return null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`wot-src fetch ${url} -> ${res.status}`);
  }
  return res.text();
}

async function fetchNation(
  branch: string,
  nation: Nation,
  nationIdx: number,
  parser: XMLParser,
): Promise<WotSrcVehicle[]> {
  const [xmlText, poText] = await Promise.all([
    fetchText(
      rawUrl(
        branch,
        `sources/res/scripts/item_defs/vehicles/${nation}/list.xml`,
      ),
    ),
    fetchText(
      rawUrl(branch, `sources/res/text/lc_messages/${poFilename(nation)}`),
    ),
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
    const shortName =
      translations.get(shortKey) ?? translations.get(nameKey) ?? nameKey;

    // Premium tanks have <gold/> nested inside <price>. The parser surfaces
    // that as an object ({gold: "", "#text": "30000"}) instead of a plain
    // string price.
    const priceField = fields.price;
    const isPremium =
      priceField !== undefined &&
      typeof priceField === "object" &&
      "gold" in priceField;

    const tagTokens = String(fields.tags ?? "").split(/\s+/);
    const isWheeled = tagTokens.includes("wheeled");
    const isGift = tagTokens.includes("gift");

    out.push({
      tankId: computeTankId(nationIdx, localId),
      tier: Number.parseInt(String(fields.level ?? "0"), 10),
      type,
      nation,
      name,
      shortName,
      tag,
      isPremium,
      isWheeled,
      isGift,
    });
  }
  return out;
}

/**
 * Fetches the full vehicle catalogue from the IzeBerg/wot-src GitHub mirror,
 * which tracks the actual WoT game client scripts. Unlike WG's public
 * `/wot/encyclopedia/vehicles/` endpoint, this includes tanks WG has removed
 * from sale (WT auf E 100, SU-122-54, Object 263B, etc.) but that still
 * appear in player stats for anyone who owned them. ~22 raw fetches in
 * parallel, ~3-5s total.
 */
export async function fetchVehicleCatalog(
  region: Region,
): Promise<WotSrcVehicle[]> {
  const branch = BRANCH_BY_REGION[region];
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: true,
    commentPropName: false,
  });

  const results = await Promise.all(
    NATIONS.map((nation, idx) =>
      fetchNation(branch, nation, idx, parser).catch((err) => {
        console.error(`[wotsrc-${region}] ${nation} failed:`, err);
        return [] as WotSrcVehicle[];
      }),
    ),
  );
  return results.flat();
}
