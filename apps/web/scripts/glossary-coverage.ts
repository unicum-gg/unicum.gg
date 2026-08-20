// What the site names but the glossary does not define yet, plus the game's own
// wording for each of those parameters.
//
// The specifications table and the catalogue columns are the site's densest
// concentration of jargon, and they are declared in one place each, so "is this
// term defined?" is a question that can be answered mechanically rather than by
// reading pages. Anything this prints is a term a reader meets with no way to
// look it up.
//
//   pnpm --filter @unicum.gg/web exec tsx scripts/glossary-coverage.ts
//   pnpm --filter @unicum.gg/web exec tsx scripts/glossary-coverage.ts --facts
import {
  getGlossaryAnchorPayload,
  getGlossaryAnchors,
  listGlossary,
} from "../src/services/glossary";
import { parsePo, rawUrl, WotSrcBranch } from "@unicum.gg/wargaming";
import { GROUPS } from "../src/components/tanks/detail/specifications/characteristics/rows";
import { SPEC_COLUMNS } from "../src/components/tanks/list/spec-columns";

type Named = {
  key: string | null;
  label: string;
  /** The row this one is indented under, which is what a sub-row inherits its
   * definition from when it has none of its own ("… hard" under "Effective
   * speed" is the same term, measured on another ground type). */
  parent: string | null;
  where: string;
};

/** Every stat the site puts a name in front of a reader, from the two files
 * that declare them. A sub-row's label reads "… intra-clip" on its own, so it
 * carries its parent's label for context. */
function named(): Named[] {
  const out: Named[] = [];
  for (const group of GROUPS) {
    let parent = "";
    for (const row of group.rows) {
      if (!row.sub) parent = row.label;
      // A sub-row's own label is what a term anchors on ("clip damage"); the
      // parent is kept only so the report reads unambiguously.
      const label = row.label.replace(/^…\s*/, "");
      out.push({
        key: row.key ?? null,
        label,
        parent: row.sub ? parent : null,
        where: `characteristics/${group.title}${row.sub ? ` (${parent})` : ""}`,
      });
    }
  }
  for (const column of SPEC_COLUMNS) {
    out.push({
      key: column.key,
      label: column.label,
      parent: null,
      where: "tanks/columns",
    });
  }
  return out;
}

function covered(entry: Named, anchors: ReturnType<typeof getGlossaryAnchors>) {
  if (entry.key && anchors.bySpecKey.has(entry.key)) return true;
  if (anchors.byLabel.has(entry.label.toLowerCase())) return true;
  return entry.parent !== null && anchors.byLabel.has(entry.parent.toLowerCase());
}

/** The game's own description of each vehicle parameter, which is what a
 * definition should be checked against before it is written. */
async function facts(): Promise<Map<string, string>> {
  const url = rawUrl(WotSrcBranch.EU, "sources/res/text/lc_messages/tooltips.po");
  const po = parsePo(await fetch(url).then((res) => res.text()));
  const out = new Map<string, string>();
  for (const [key, value] of po) {
    const match = /^tank_params\/desc\/(.+)$/.exec(key);
    if (match && value.trim()) out.set(match[1], value.trim());
  }
  return out;
}

async function main() {
  const anchors = getGlossaryAnchors();
  const entries = named();
  const seen = new Set<string>();
  const missing = entries.filter((entry) => {
    const id = `${entry.key ?? entry.label}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return !covered(entry, anchors);
  });

  // The anchors ride in the site chrome on every page, so their size is a cost
  // every reader pays. Printed here to keep it in view.
  const payload = Buffer.byteLength(JSON.stringify(getGlossaryAnchorPayload()));
  console.log(
    `glossary: ${listGlossary().length} terms defined, anchors payload ${(payload / 1024).toFixed(1)} KB`,
  );
  console.log(
    `site stats: ${seen.size} distinct, ${seen.size - missing.length} covered, ${missing.length} missing\n`,
  );
  for (const entry of missing) {
    console.log(`  ${entry.label}${entry.key ? `  [${entry.key}]` : ""}  (${entry.where})`);
  }

  if (!process.argv.includes("--facts")) return;
  console.log("\nWargaming's own wording, one line per vehicle parameter:\n");
  for (const [key, description] of [...(await facts())].sort()) {
    console.log(`  ${key}: ${description.replace(/\n/g, " ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
