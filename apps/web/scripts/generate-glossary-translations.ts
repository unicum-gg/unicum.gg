// Translates the glossary's markdown entries.
//
// The 210 entries are prose, not labels, so they do not live in the JSON tree
// and cannot go through `generate-translations`: an entry is a frontmatter
// block plus a body of paragraphs, lists and formula fences, and the structure
// has to survive the round trip or `generate-glossary` throws on it.
//
// English stays at `content/glossary/en/<category>/<slug>.md` and is the only one
// anyone writes. A translation lands beside it at
// `content/glossary/<locale>/<category>/<slug>.md`, a sibling of English so
// the reader that walks the English one keeps throwing on a directory that is
// not a category.
//
//   pnpm --filter @unicum.gg/web glossary:translate [locale] [--limit N] [--budget-tokens N]
//
// `.github/workflows/translations.yml` runs it on every push to main touching
// an English entry, beside the interface translator, and commits the result.
//
// Like the JSON translator it only writes what is missing or stale, and it
// keeps its own hash of the English it last read, so an edited entry
// re-translates and a hand correction survives.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv-flow";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: webRoot });

import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { frontmatter } from "fumadocs-core/content/md/frontmatter";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_LABEL,
  type Locale,
} from "../src/lib/translations";
import { GAME_CLIENT_LANGUAGE } from "../src/lib/game-vocabulary";
import { cataloguedNames } from "./translation-rules";
import { KNOWN_CATALOGUE_ERRORS } from "./glossary-terms";

// The English tree, which is a SIBLING of the translations rather than their
// parent: `content/glossary/en/<category>/<slug>.md`. Pointed at
// `content/glossary` instead, `readSource` walks the locale directories as
// though they were categories, finds no `.md` directly inside any of them, and
// reports zero entries, which prints as "0 to write" and exits 0. So the script
// read as up to date on every run since the feature shipped, while five entries
// added or reworded after it stayed English-only in all thirty-five languages.
const SOURCE_DIR = join(webRoot, "content", "glossary", DEFAULT_LOCALE);
const OUT_DIR = join(webRoot, "content", "glossary");
const HASHES_PATH = join(OUT_DIR, "source-hashes.json");

// The interface translator's prose model on the interface translator's
// endpoint, so the workflow that runs both needs one key and one bill. An entry
// is prose from top to bottom, which is what `TRANSLATE_PROSE_MODEL` names.
const MODEL =
  process.env.TRANSLATE_PROSE_MODEL ?? process.env.TRANSLATE_MODEL ?? "gpt-5.6-luna";
const openai = createOpenAI({
  apiKey:
    process.env.TRANSLATE_API_KEY ??
    process.env.OPENAI_API_KEY_TRANSLATIONS ??
    process.env.OPENAI_API_KEY,
  baseURL: process.env.TRANSLATE_BASE_URL,
});
/**
 * How long one entry may take before it is treated as dead, and how many times
 * it is asked again.
 *
 * The marketplace endpoint hangs rather than rate-limits (see the interface
 * translator's `REQUEST_TIMEOUT_MS`): a socket that is open and silent never
 * errors, so without a deadline one hung entry holds its slot until the job's
 * own timeout. Longer than the interface's deadline because an entry is a page
 * of prose, in scripts that cost several tokens a character. A hung request is
 * never billed, so the attempts cost wall-clock only.
 */
const REQUEST_TIMEOUT_MS = 180 * 1000;
const REQUEST_ATTEMPTS = 10;
// Lower than the JSON translator's: an entry is a page of prose rather than a
// dozen labels, so each request is far longer and the burst is what a rate
// limit notices.
const CONCURRENCY = 8;

const arg = (i: number) => process.argv[i + 2];
const flag = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
// A comma-separated list, since the useful unit is "these languages" rather
// than one at a time: the whole tree does not fit a sane budget on a model good
// enough for this prose (measured at ~490 in / ~570 out an entry, which is
// 7.8M tokens over 210 entries and 35 languages).
const picked = (arg(0) && !arg(0).startsWith("--") ? arg(0).split(",") : [])
  .map((l) => l.trim())
  .filter(Boolean);
const limit = Number(flag("--limit") ?? Number.POSITIVE_INFINITY);
/**
 * A hard ceiling on what the run may spend, in tokens.
 *
 * Not a warning: once the total crosses it, nothing further is scheduled and
 * the run ends. It is safe to stop anywhere because the script only ever writes
 * what is missing, so a halted run is a smaller run rather than a broken tree,
 * and the next one picks up exactly where this one left off.
 */
const budget = Number(flag("--budget-tokens") ?? Number.POSITIVE_INFINITY);

// What the run actually consumed, so the decision to continue is made on a
// measured number rather than on an estimate. Reported at the end and per
// entry, since the whole tree is 210 entries times 35 languages and the only
// honest way to size that is to price a few and multiply.
const usage = { input: 0, output: 0, calls: 0 };

const hashOf = (value: string) =>
  createHash("sha1").update(value).digest("hex").slice(0, 12);

type Entry = { category: string; slug: string; source: string };

/**
 * What the game calls its own modes and ratings in one language, from
 * `game/vocabulary`, which is what the interface renders beside the tooltip.
 *
 * The glossary was translated with nothing to hold it to, so its titles
 * disagreed with the page around them: French titled Onslaught "Assaut" under
 * a board headed "Offensive", German Stronghold "Bollwerk" beside a table
 * headed "Festung". The interface now takes its terms from the glossary, which
 * makes a title that contradicts the game a contradiction on every page.
 */
const vocabularies = new Map<string, Map<string, string>>();
function gameNamesIn(locale: Locale): Map<string, string> {
  const held = vocabularies.get(locale);
  if (held) return held;
  const read = (l: string) =>
    JSON.parse(
      readFileSync(join(webRoot, "src", "locales", l, "game", "vocabulary.json"), "utf8"),
    ) as Record<string, unknown>;
  const names = cataloguedNames(read(DEFAULT_LOCALE), read(locale));
  vocabularies.set(locale, names);
  return names;
}

/** Every English entry, in a stable order. */
function readSource(): Entry[] {
  const out: Entry[] = [];
  for (const category of readdirSync(SOURCE_DIR, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const dir = join(SOURCE_DIR, category.name);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
      out.push({
        category: category.name,
        slug: file.slice(0, -3),
        source: readFileSync(join(dir, file), "utf8"),
      });
    }
  }
  // An empty source tree is never a real answer, and it is the one failure this
  // script cannot report by doing nothing: no entries means no jobs, which
  // prints "0 to write" and exits 0, the same two lines a tree that really is up
  // to date prints. Read as success for as long as the source path was wrong.
  if (out.length === 0) {
    throw new Error(
      `no glossary entries under ${SOURCE_DIR}: expected ${DEFAULT_LOCALE}/<category>/<slug>.md`,
    );
  }
  return out;
}

/**
 * What the model is allowed to touch.
 *
 * `related`, `links` and `anchors` are not prose: the first two are slugs of
 * other entries and of site sections, and the third is the English label a
 * table renders, which is what the tooltip anchors on (the tables translate
 * what they DISPLAY and keep `row.label` English for exactly this). Translating
 * any of the three would silently unhook the entry from everything it points at.
 */
const OUTPUT = z.object({
  term: z.string(),
  aliases: z.array(z.string()),
  body: z.string(),
});

async function translate(
  entry: Entry,
  locale: Locale,
): Promise<{ term: string; aliases: string[]; body: string }> {
  const { data, content } = frontmatter(entry.source);
  const source = data as { term?: string; aliases?: string[] };
  const published = GAME_CLIENT_LANGUAGE[locale] !== undefined;
  const names = gameNamesIn(locale);
  const named = [...names].filter(
    ([english, own]) =>
      own !== english &&
      entry.source.includes(english) &&
      !KNOWN_CATALOGUE_ERRORS.has(`${locale}:${english}`),
  );
  const prompt = `Translate a World of Tanks glossary entry from English into ${LOCALE_LABEL[locale]} (${locale}).

Rules:
- Translate EVERY paragraph, including the first one. Return the body as markdown, keeping its structure EXACTLY: the same number of paragraphs in the same order, the same list items, and any \`\`\`formula fence unchanged except for the note under its first line. The first paragraph is the one-sentence definition and must stay one sentence.
- Translate \`term\` too. It is the entry's title, not an identifier: "Armor thickness" becomes the words a player of that language would use, and it stays English only when the game itself leaves it English.
- Leave every formula, number, unit and code span as written.
- Leave product vocabulary in English: Wargaming, World of Tanks, WN7, WN8, WNX, XVM, MoE, and the names of tanks.
- ${
      published
        ? `World of Tanks IS published in ${LOCALE_LABEL[locale]}. Use the game's own wording for anything the client names (modes, currencies, crew roles, equipment); if you are not certain of it, keep the English rather than invent one.`
        : `World of Tanks is NOT published in ${LOCALE_LABEL[locale]}, so there is no official wording to match. Write what a player of that language would naturally say, and keep the English for anything that is a proper name.`
    }
- \`aliases\` are the other words a reader might search for. Keep an English acronym or spelling that players of that language actually type (WN8, HE, "armor"), and add the natural words of that language beside them. Drop an alias that has no equivalent rather than inventing one.
- No em-dashes and no semicolons.${
    named.length
      ? `\n- These are the game's own names in ${LOCALE_LABEL[locale]}, already used by the page around this entry. Use them exactly wherever the entry names one, declined as the grammar needs:\n${named.map(([english, own]) => `  - ${english}: ${own}`).join("\n")}`
      : ""
  }

term: ${JSON.stringify(source.term ?? entry.slug)}
aliases: ${JSON.stringify(source.aliases ?? [])}

${content.trim()}`;
  const first = await ask(prompt);
  const { output } = first;
  // A title that IS one of the game's names is the catalogue's, not the
  // model's: there is one right answer and it is written down.
  const ownTitle =
    source.term && !KNOWN_CATALOGUE_ERRORS.has(`${locale}:${source.term}`)
      ? names.get(source.term)
      : undefined;
  const settle = (out: typeof output) =>
    ownTitle ? { ...out, term: ownTitle.replace(/\u2019/g, "'") } : out;
  usage.calls++;
  usage.input += first.usage?.inputTokens ?? 0;
  usage.output += first.usage?.outputTokens ?? 0;
  // A body that came back byte-identical to its source is the model echoing
  // rather than translating. It happened once in the first three, silently, and
  // a paragraph of English inside a French page is worse than an untranslated
  // page: it reads as a bug. One retry, then the caller's error handling.
  const paragraphs = (text: string) =>
    text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const echoed = (candidate: string) => {
    const from = paragraphs(content.trim());
    const to = paragraphs(candidate);
    return from.some(
      (p, i) => p.length > 40 && !p.startsWith("\`\`\`") && to[i] === p,
    );
  };
  if (!echoed(output.body)) return settle(output);
  const retry = await ask(
    `${prompt}\n\nOne or more paragraphs came back in English. Translate all of them.`,
  );
  usage.calls++;
  usage.input += retry.usage?.inputTokens ?? 0;
  usage.output += retry.usage?.outputTokens ?? 0;
  return settle(retry.output);
}

/**
 * One request, retried when it answered nothing at all.
 *
 * An abort is not an API error, so the SDK's own `maxRetries` rethrows it: the
 * deadline only turns a hung request into a failure, and this loop turns that
 * failure back into an answer. Each attempt gets a signal of its own, since a
 * fired one stays fired. `.chat()` because an OpenAI-compatible endpoint is
 * stateless and refuses the Responses API's `store: true`.
 */
async function ask(prompt: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await generateText({
        model: openai.chat(MODEL),
        output: Output.object({ schema: OUTPUT }),
        prompt,
        maxRetries: 6,
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        // Explicit, since an answer cut off by a provider default is not an
        // error anyone sees until the JSON fails to parse.
        maxOutputTokens: 16000,
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      if (!timedOut || attempt >= REQUEST_ATTEMPTS) throw error;
      console.warn(
        `[glossary-translate] no answer in ${REQUEST_TIMEOUT_MS / 1000}s, attempt ${attempt + 1}/${REQUEST_ATTEMPTS}`,
      );
    }
  }
}

/**
 * Make a translated body parse as the glossary's narrow format.
 *
 * A sentence is prose to a translator and a list marker to a parser: the
 * Bosnian WN7 entry opens "2012. prethodnik WN8", which is a number, a period
 * and a space, so `fromMarkdown` returns an ordered list and the generator
 * throws on an entry whose first block is not the definition. English rarely
 * opens a sentence on a year, several other languages do it naturally, and
 * asking the model not to would be asking it to write worse prose. So the
 * marker is escaped instead, which renders identically.
 */
function normalizeBody(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((block) => {
      if (block.startsWith("```")) return block;
      // A hard break inside a paragraph. The format has no line breaks (the
      // prose is re-emitted three ways and a break survives none of them), and
      // a model that wrapped a sentence meant a space.
      const flat = block.startsWith("- ") || block.startsWith("* ")
        ? block
        : block.replace(/\\?\s*\n\s*/g, " ");
      return flat
        .replace(/^(\d+)\.(\s)/, "$1\\.$2")
        .replace(/^([-*+])(\s)/, "\\$1$2");
    })
    .join("\n\n");
}

/** Re-emit an entry, the translated fields swapped in and the rest verbatim. */
function render(
  entry: Entry,
  translated: { term: string; aliases: string[]; body: string },
): string {
  const { data } = frontmatter(entry.source);
  const front = data as Record<string, unknown>;
  const next: Record<string, unknown> = {
    ...front,
    term: translated.term,
    ...(translated.aliases.length ? { aliases: translated.aliases } : {}),
  };
  if (!translated.aliases.length) delete next.aliases;
  return `---\n${toYaml(next)}---\n\n${normalizeBody(translated.body.trim())}\n`;
}

/** The subset of YAML these entries use: strings, string lists, booleans and a
 * list of `{ target }` objects. Written rather than pulled in, since a
 * dependency for four shapes is a dependency to keep up to date. */
function toYaml(value: Record<string, unknown>, indent = ""): string {
  let out = "";
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      out += `${indent}${key}:\n`;
      for (const item of v) {
        out +=
          typeof item === "object" && item !== null
            ? `${indent}  - ${toYaml(item as Record<string, unknown>, "").trim().replace(/\n/g, `\n${indent}    `)}\n`
            : `${indent}  - ${scalar(item)}\n`;
      }
    } else if (typeof v === "object" && v !== null) {
      out += `${indent}${key}:\n${toYaml(v as Record<string, unknown>, `${indent}  `)}`;
    } else {
      out += `${indent}${key}: ${scalar(v)}\n`;
    }
  }
  return out;
}

// Quoted only when YAML would read it as something else. Letters with accents
// are letters, so `Épaisseur de blindage` is a plain scalar: the entries are
// read by humans, and a French glossary full of quotation marks is noise.
const scalar = (v: unknown): string =>
  typeof v === "string" &&
  /^[^\s"'#&*!|>%@`{}[\],][^:#]*$/u.test(v) &&
  !/:\s|\s#/.test(v)
    ? v
    : JSON.stringify(v);

async function pool<T>(items: T[], worker: (item: T) => Promise<boolean>) {
  let index = 0;
  let written = 0;
  let failed = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (index < items.length) {
        if (usage.input + usage.output >= budget) break;
        const item = items[index++];
        try {
          if (await worker(item)) written++;
        } catch (error) {
          console.error("[glossary-translate] failed:", error);
          failed++;
        }
      }
    }),
  );
  return { written, failed };
}

async function main(): Promise<void> {
  const entries = readSource();
  // Every language a translation is owed, which is not the same as the ones
  // this run writes: the staleness record is shared by all of them.
  const everyLocale = LOCALES.filter((l) => l !== DEFAULT_LOCALE);
  const targets = (picked.length
    ? LOCALES.filter((l) => picked.includes(l))
    : LOCALES
  ).filter((l) => l !== DEFAULT_LOCALE);
  const unknown = picked.filter((l) => !LOCALES.includes(l as Locale));
  if (unknown.length) {
    console.error(`[glossary-translate] unknown locale(s): ${unknown.join(", ")}`);
    process.exit(1);
  }
  let hashes: Record<string, string> = {};
  try {
    hashes = JSON.parse(readFileSync(HASHES_PATH, "utf8")) as Record<string, string>;
  } catch {
    /* first run */
  }

  // Which entries the English has moved under since they were last written.
  // Kept, because it is what decides whether a locale already holding a file
  // holds the RIGHT one, and the stamping below needs that after the run.
  const staleEntries = new Set<string>();
  for (const entry of entries) {
    const id = `${entry.category}/${entry.slug}`;
    if (hashes[id] !== undefined && hashes[id] !== hashOf(entry.source)) {
      staleEntries.add(id);
    }
  }

  const jobs: { entry: Entry; locale: Locale }[] = [];
  for (const locale of targets) {
    for (const entry of entries) {
      const out = join(OUT_DIR, locale, entry.category, `${entry.slug}.md`);
      const id = `${entry.category}/${entry.slug}`;
      if (existsSync(out) && !staleEntries.has(id)) continue;
      jobs.push({ entry, locale });
    }
  }
  const scoped = jobs.slice(0, limit);
  console.log(
    `[glossary-translate] ${entries.length} entrie(s) x ${targets.length} locale(s): ${scoped.length} to write`,
  );
  if (scoped.length === 0) return;

  const wrote = new Set<string>();
  const { written, failed } = await pool(scoped, async ({ entry, locale }) => {
    const translated = await translate(entry, locale);
    const out = join(OUT_DIR, locale, entry.category, `${entry.slug}.md`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, render(entry, translated));
    wrote.add(`${locale}:${entry.category}/${entry.slug}`);
    console.log(`[glossary-translate] ${locale}/${entry.category}/${entry.slug}`);
    return true;
  });

  // Stamped per entry, and only once EVERY locale holds the translation this
  // English produced.
  //
  // The record is one hash per entry covering all 35 locales, so it is the only
  // thing that can ever say "re-translate this". Stamping it unconditionally
  // settled an entry the run never reached, and every way of not reaching one is
  // ordinary: the budget ceiling, a `--limit`, a failed call, or naming a single
  // locale on the command line. The stale files stayed stale on disk and were
  // recorded as current, so nothing asked for them again. A MISSING file is safe
  // either way, since its absence is a job on its own, which is what the comment
  // this replaces was reasoning about; a stale one is found by nothing but this
  // hash. Judged against every locale rather than the run's own targets, or
  // translating one language would settle the other thirty-four.
  const next: Record<string, string> = {};
  for (const entry of entries) {
    const id = `${entry.category}/${entry.slug}`;
    const settled = everyLocale.every(
      (locale) =>
        wrote.has(`${locale}:${id}`) ||
        (!staleEntries.has(id) &&
          existsSync(join(OUT_DIR, locale, entry.category, `${entry.slug}.md`))),
    );
    // An entry left unsettled keeps the hash it had, so it is still reported
    // stale next run. Absent stays absent, which is what seeds a new entry.
    if (settled) next[id] = hashOf(entry.source);
    else if (hashes[id] !== undefined) next[id] = hashes[id];
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(HASHES_PATH, `${JSON.stringify(next, null, 2)}\n`);

  const perEntry = usage.calls
    ? {
        input: Math.round(usage.input / usage.calls),
        output: Math.round(usage.output / usage.calls),
      }
    : { input: 0, output: 0 };
  if (usage.input + usage.output >= budget) {
    console.warn(
      `[glossary-translate] stopped at the ${budget.toLocaleString("en-US")}-token ceiling; rerun to continue`,
    );
  }
  console.log(
    `[glossary-translate] wrote ${written} file(s) on ${MODEL}` +
      ` | ${usage.calls} call(s), ${usage.input.toLocaleString("en-US")} in / ` +
      `${usage.output.toLocaleString("en-US")} out` +
      ` (${perEntry.input}/${perEntry.output} per entry)`,
  );
  if (failed > 0) {
    console.error(`[glossary-translate] ${failed} of ${scoped.length} failed`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[glossary-translate] failed:", error);
  process.exit(1);
});
