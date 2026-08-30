// What the site's tables name but the glossary does not define yet.
//
// The stat tables are the other half of the site's jargon (the specifications
// side is `glossary-coverage.ts`), and unlike the specifications they are not
// declared in one place: a heading is a string in JSX here, a `label:` on a
// column object there, a row definition somewhere else. So this reads the
// components rather than importing a registry that does not exist, and asks the
// same question of every label it finds: does a reader who does not know this
// word have anywhere to go?
//
// It is a report, not a gate. A heading that names an entity or a date rather
// than a game concept is listed under STRUCTURAL and skipped, and anything else
// it prints is either a definition worth writing or a label worth anchoring on
// an entry that already exists.
//
//   pnpm --filter @unicum.gg/web exec tsx scripts/glossary-tables.ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getGlossaryAnchors } from "../src/services/glossary";
// Deep, env-free subpath rather than the barrel, like
// `generate-glossary.ts`: this runs outside the app, where the barrel's
// `env.ts` validation would throw for want of WG app ids.
import { unqualifyGlossaryLabel } from "@unicum.gg/shared/glossary/anchors";

const COMPONENTS = new URL("../src/components/", import.meta.url).pathname;

/** Headings that name a thing on the row (a player, a clan, a date) rather than
 * a measurement. They are the same words in every table and no glossary would
 * ever define them, so they are skipped instead of drowning the report. */
const STRUCTURAL = new Set([
  "#",
  "action",
  "actions",
  "came from",
  "changed",
  "clan",
  "created",
  "date",
  "duration",
  "from",
  "map",
  "meaning",
  "members",
  "name",
  "nation",
  "player",
  "reserve",
  "role",
  "stat",
  "streamer",
  "tag",
  "tanks",
  "to",
  "total",
  "type",
  "viewers",
  "when",
]);

/** Period columns, which qualify the row rather than naming anything. */
const PERIOD = /^(last\s+)?(24h|7d|30d|overall|total)$/i;

/** The colour bands of the rating scales. They are the scale, and the scale's
 * own heading links to the entry that defines it, so each band is not a term of
 * its own. */
const BANDS = new Set([
  "top",
  "excellent",
  "super",
  "very good",
  "good",
  "average",
  "below avg",
  "bad",
  "very bad",
]);

/** Read by `glossary-coverage.ts` instead, which resolves their `tank_specs`
 * key rather than their wording: half of these columns are anchored by key and
 * would read as undefined here. */
const BY_SPEC_KEY = [
  "tanks/list/spec-columns.ts",
  "tanks/detail/specifications/characteristics/rows.ts",
];

type Found = { label: string; where: string };

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      out.push(path);
    }
  }
  return out;
}

/**
 * Every label a table shows, in the three shapes the components write them in:
 * the text of a heading cell, the text passed to a heading component, and the
 * `label:` of a column or row definition.
 *
 * Deliberately shallow: only a literal string is read, since a heading built
 * from an expression (`{RATING_METRIC_LABEL[metric]}`) is looked up at runtime
 * against whatever it currently says, which no static pass can know.
 */
function labels(): Found[] {
  const out: Found[] = [];
  const patterns = [
    /<TableHead\b[^>]*>\s*(?:<GlossaryLabel[^>]*>\s*)?([A-Za-z][^<>{}\n]{0,30}?)\s*(?:<\/GlossaryLabel>\s*)?<\/TableHead>/g,
    /<(?:SortHead|SortableHead|GlossaryLabel)\b[^>]*>\s*([A-Za-z][^<>{}\n]{0,30}?)\s*<\/(?:SortHead|SortableHead|GlossaryLabel)>/g,
    /\blabel:\s*"([A-Za-z][^"]{0,30})"/g,
  ];
  for (const file of walk(COMPONENTS)) {
    const source = readFileSync(file, "utf8");
    const where = file.slice(COMPONENTS.length);
    // A table, or the column list one reads its headings from. Every other
    // component labels buttons, tabs and filters, which are not terms a reader
    // looks up: scanning them buried the two dozen real gaps under two hundred
    // navigation strings.
    const isTable =
      source.includes("<TableHead") ||
      /(?:columns|rows|perf-columns|spec-columns)\.tsx?$/.test(where);
    if (!isTable || BY_SPEC_KEY.includes(where)) continue;
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const label = match[1].trim();
        if (label) out.push({ label, where });
      }
    }
  }
  return out;
}

function main() {
  const anchors = getGlossaryAnchors();
  const covered = (label: string): boolean => {
    const key = label.toLowerCase();
    if (anchors.byLabel.has(key)) return true;
    const short = unqualifyGlossaryLabel(label);
    return short !== null && anchors.byLabel.has(short.toLowerCase());
  };

  const found = labels();
  const seen = new Map<string, Set<string>>();
  for (const { label, where } of found) {
    const key = label.toLowerCase();
    if (STRUCTURAL.has(key) || BANDS.has(key) || PERIOD.test(label)) continue;
    if (covered(label)) continue;
    seen.set(key, (seen.get(key) ?? new Set()).add(where));
  }

  const distinct = new Set(found.map((f) => f.label.toLowerCase()));
  console.log(
    `table labels: ${distinct.size} distinct, ${distinct.size - seen.size} covered or structural, ${seen.size} undefined\n`,
  );
  for (const [label, files] of [...seen].sort()) {
    console.log(`  ${label}  (${[...files].sort().join(", ")})`);
  }
}

main();
