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
//   pnpm --filter @unicum.gg/web glossary:translate [locale] [--limit N]
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

const SOURCE_DIR = join(webRoot, "content", "glossary");
const OUT_DIR = join(webRoot, "content", "glossary");
const HASHES_PATH = join(OUT_DIR, "source-hashes.json");

const MODEL = process.env.TRANSLATE_MODEL ?? "gpt-4o-mini";
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY_TRANSLATIONS ?? process.env.OPENAI_API_KEY,
});
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
- No em-dashes and no semicolons.

term: ${JSON.stringify(source.term ?? entry.slug)}
aliases: ${JSON.stringify(source.aliases ?? [])}

${content.trim()}`;
  const first = await generateText({
    model: openai(MODEL),
    output: Output.object({ schema: OUTPUT }),
    prompt,
  });
  const { output } = first;
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
  if (!echoed(output.body)) return output;
  const retry = await generateText({
    model: openai(MODEL),
    output: Output.object({ schema: OUTPUT }),
    prompt: `${prompt}\n\nOne or more paragraphs came back in English. Translate all of them.`,
  });
  usage.calls++;
  usage.input += retry.usage?.inputTokens ?? 0;
  usage.output += retry.usage?.outputTokens ?? 0;
  return retry.output;
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

  const jobs: { entry: Entry; locale: Locale }[] = [];
  for (const locale of targets) {
    for (const entry of entries) {
      const out = join(OUT_DIR, locale, entry.category, `${entry.slug}.md`);
      const id = `${entry.category}/${entry.slug}`;
      const stale = hashes[id] !== undefined && hashes[id] !== hashOf(entry.source);
      if (existsSync(out) && !stale) continue;
      jobs.push({ entry, locale });
    }
  }
  const scoped = jobs.slice(0, limit);
  console.log(
    `[glossary-translate] ${entries.length} entrie(s) x ${targets.length} locale(s): ${scoped.length} to write`,
  );
  if (scoped.length === 0) return;

  const { written, failed } = await pool(scoped, async ({ entry, locale }) => {
    const translated = await translate(entry, locale);
    const out = join(OUT_DIR, locale, entry.category, `${entry.slug}.md`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, render(entry, translated));
    console.log(`[glossary-translate] ${locale}/${entry.category}/${entry.slug}`);
    return true;
  });

  // Stamped from the source, so an entry nothing needed this run is recorded
  // too and a later edit to it is still caught.
  const next: Record<string, string> = {};
  for (const entry of entries) {
    next[`${entry.category}/${entry.slug}`] = hashOf(entry.source);
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
