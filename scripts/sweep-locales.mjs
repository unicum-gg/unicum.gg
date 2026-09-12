// Load pages and report any visible string that is the ENGLISH value of a key
// whose translation exists. Neither `usage` nor `copy` can see this: the key is
// read correctly and the JSX holds no literal, yet the reader gets English
// because the component asked the wrong catalogue.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "apps/web/src/locales");
const BASE = process.env.BASE ?? "http://localhost:3082";
const LOCALE = process.env.LOCALE ?? "fr";

const read = (dir) => {
  const out = {};
  const walk = (d, rel = "") => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full, path.join(rel, entry.name));
      else if (entry.name.endsWith(".json")) {
        const ns = path.join(rel, entry.name);
        const flat = (o, pre = "") => {
          for (const [k, v] of Object.entries(o)) {
            if (v && typeof v === "object") flat(v, `${pre}${k}.`);
            else if (typeof v === "string") out[`${ns} ${pre}${k}`] = v;
          }
        };
        flat(JSON.parse(fs.readFileSync(full, "utf-8")));
      }
    }
  };
  walk(dir);
  return out;
};

const en = read(path.join(ROOT, "en"));
const target = read(path.join(ROOT, LOCALE));

const strip = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/**
 * Namespaces whose English is the answer in every language.
 *
 * Not a gap to fill: a badge or a prize band written by a tournament's own
 * organiser reaches us as text, in whatever language they typed, which is
 * English. No catalogue of ours can name it, and a key that happens to hold the
 * same words is a coincidence rather than the source of what is on the page.
 *
 * Listed here rather than re-explained on every run, because a reader of this
 * output has to be able to trust that every line left in it is a real bug.
 */
const EXPECTED_ENGLISH = [
  /^components\/entity\/badges\/player-badges:place\./,
  /^components\/clans\/detail\/overview\/clan-wars-stats:sections\./,
];

const urls = process.argv.slice(2);
let total = 0;

for (const url of urls) {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) {
    console.log(`\n${url}  HTTP ${res.status}`);
    continue;
  }
  const visible = new Set(
    strip(await res.text())
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );
  const hits = [];
  for (const [id, value] of Object.entries(en)) {
    // A one-word English string is usually also the right word in the target
    // (a proper noun, a metric, a unit), so only compare where they differ.
    // A one- or two-character value ("#", "vs") matches too easily against
    // punctuation the page carries for other reasons, so it is not evidence.
    if (value.length < 4 || !visible.has(value)) continue;
    const other = target[id];
    if (other !== undefined && other !== value) {
      const [ns, key] = id.split(" ");
      const label = `${ns.replace(/\.json$/, "")}:${key}`;
      // A key that happens to hold the same words as a string Wargaming's own
      // data put on the page is a coincidence, not the source of it.
      if (EXPECTED_ENGLISH.some((re) => re.test(label))) continue;
      hits.push(`${label}  ${JSON.stringify(value)}`);
    }
  }
  total += hits.length;
  console.log(`\n${url}  ${hits.length === 0 ? "OK" : `${hits.length} en anglais`}`);
  for (const h of hits.sort()) console.log(`   ${h}`);
}

console.log(`\ntotal : ${total}`);
process.exit(total === 0 ? 0 : 1);
