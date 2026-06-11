import { XMLParser } from "fast-xml-parser";
import { Region } from ".";

const REPO = "IzeBerg/wot-src";

const NATION_DIRS = [
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
type NationDir = (typeof NATION_DIRS)[number];

// tank_id encoding: bits 0-3 = item type (1 for vehicles), bits 4-7 = nation
// index, bits 8+ = local vehicle id within the nation's list.xml.
// Verified empirically against the existing eu_vehicles dump:
// ((tank_id >> 4) & 0x0F) returns these per-nation constants.
const NATION_INDEX: Record<NationDir, number> = {
  ussr: 0,
  germany: 1,
  usa: 2,
  china: 3,
  france: 4,
  uk: 5,
  japan: 6,
  czech: 7,
  sweden: 8,
  poland: 9,
  italy: 10,
};

// .po filename matches the nation dir name except for UK, which lives in
// gb_vehicles.po (historical artifact in the WoT client tree).
const PO_FILENAME: Record<NationDir, string> = {
  ussr: "ussr_vehicles.po",
  germany: "germany_vehicles.po",
  usa: "usa_vehicles.po",
  china: "china_vehicles.po",
  france: "france_vehicles.po",
  uk: "gb_vehicles.po",
  japan: "japan_vehicles.po",
  czech: "czech_vehicles.po",
  sweden: "sweden_vehicles.po",
  poland: "poland_vehicles.po",
  italy: "italy_vehicles.po",
};

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
  nation: NationDir,
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
      rawUrl(branch, `sources/res/text/lc_messages/${PO_FILENAME[nation]}`),
    ),
  ]);

  const translations = parsePo(poText);
  const parsed = parser.parse(xmlText) as RawListXml;
  const nationIdx = NATION_INDEX[nation];

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
    NATION_DIRS.map((nation) =>
      fetchNation(branch, nation, parser).catch((err) => {
        console.error(`[wotsrc-${region}] ${nation} failed:`, err);
        return [] as WotSrcVehicle[];
      }),
    ),
  );
  return results.flat();
}
