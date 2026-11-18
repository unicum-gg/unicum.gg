// Translates the legal documents' markdown (`content/legal/en/*.md`) into the
// other 35 languages, beside English at `content/legal/<locale>/<doc>.md`.
//
//   pnpm --filter @unicum.gg/web legal:translate [locale,...] [--limit N]
//
// The glossary translator's sibling, and run by the same workflow on every push
// to main touching an English document. Never run it locally (see AGENTS.md,
// "Interface languages"). Like it, it writes only what is missing or stale,
// judged on a hash of the English it last read, so a hand correction survives
// until the English under it changes.
//
// Two things are specific to these documents. They carry `{token}`s (a SIRET,
// an address, a link target) that the page fills in, so a translation that
// loses or renames one would publish a hole: it is refused and asked again.
// And they are legal text, so the model is asked for the register a reader of
// that language expects from such a page rather than for a literal rendering.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv-flow";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: webRoot });

import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { frontmatter } from "fumadocs-core/content/md/frontmatter";
import { DEFAULT_LOCALE, LOCALES, LOCALE_LABEL, type Locale } from "../src/lib/translations";

const CONTENT_DIR = join(webRoot, "content", "legal");
const SOURCE_DIR = join(CONTENT_DIR, DEFAULT_LOCALE);
const HASHES_PATH = join(CONTENT_DIR, "source-hashes.json");

// The glossary translator's model and endpoint, so the workflow needs one key.
const MODEL =
  process.env.TRANSLATE_PROSE_MODEL ?? process.env.TRANSLATE_MODEL ?? "gpt-5.6-luna";
const openai = createOpenAI({
  apiKey:
    process.env.TRANSLATE_API_KEY ??
    process.env.OPENAI_API_KEY_TRANSLATIONS ??
    process.env.OPENAI_API_KEY,
  baseURL: process.env.TRANSLATE_BASE_URL,
});
/** Same reasoning as the glossary's: the endpoint hangs rather than errors, a
 * hung request is never billed, so a deadline and many attempts cost only
 * wall-clock. Longer, since a document is several pages of prose. */
const REQUEST_TIMEOUT_MS = 300 * 1000;
const REQUEST_ATTEMPTS = 10;
const CONCURRENCY = 6;

const picked = (process.argv[2] && !process.argv[2].startsWith("--")
  ? process.argv[2].split(",")
  : []
)
  .map((l) => l.trim())
  .filter(Boolean);
const limitIndex = process.argv.indexOf("--limit");
const limit = limitIndex === -1 ? Number.POSITIVE_INFINITY : Number(process.argv[limitIndex + 1]);

const hashOf = (value: string) => createHash("sha1").update(value).digest("hex").slice(0, 12);
const tokensOf = (text: string) => [...text.matchAll(/\{[\w-]+\}/g)].map((m) => m[0]).sort();
const sameTokens = (a: string, b: string) => tokensOf(a).join() === tokensOf(b).join();

type Doc = { id: string; source: string };

const OUTPUT = z.object({
  title: z.string(),
  description: z.string(),
  body: z.string(),
});

function readSource(): Doc[] {
  const docs = readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => ({ id: f.slice(0, -3), source: readFileSync(join(SOURCE_DIR, f), "utf8") }));
  // No documents is never a real answer, and it is the one failure a "write
  // what is missing" script reports as success.
  if (docs.length === 0) throw new Error(`no legal documents under ${SOURCE_DIR}`);
  return docs;
}

async function ask(prompt: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await generateText({
        model: openai.chat(MODEL),
        output: Output.object({ schema: OUTPUT }),
        prompt,
        maxRetries: 6,
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        maxOutputTokens: 32000,
      });
    } catch (error) {
      const timedOut =
        error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      if (!timedOut || attempt >= REQUEST_ATTEMPTS) throw error;
      console.warn(`[legal-translate] no answer in ${REQUEST_TIMEOUT_MS / 1000}s, attempt ${attempt + 1}`);
    }
  }
}

async function translate(doc: Doc, locale: Locale) {
  const { data, content } = frontmatter(doc.source);
  const front = data as { title: string; description: string };
  const prompt = `Translate a legal page of a World of Tanks statistics website from English into ${LOCALE_LABEL[locale]} (${locale}).

Rules:
- Write it in the register a reader of ${LOCALE_LABEL[locale]} expects from a site's legal notice, privacy policy or terms, accurate rather than literal. Keep its meaning exactly: do not add, drop or soften any obligation, right or limit.
- Return the body as markdown with EXACTLY the same structure: the same headings in the same order, the same paragraphs, the same list items.
- Every {token} in curly braces is filled in by the site. Keep each one exactly as written, never translate or rename it, and keep the same tokens, including inside link targets like ({company-page}).
- Keep every link target, email address and \`code span\` unchanged. Translate the link text.
- Leave product and company names in English: unicum.gg, Wargaming, Wargaming.net ID, World of Tanks, Stripe, Discord, Twitch, Cloudflare, netcup, Umami, Google Analytics 4, GitHub, CNIL, GDPR (use the local acronym for GDPR where one is standard, such as RGPD or DSGVO).
- Use the typographic apostrophe ’, not '. No em-dashes.

title: ${JSON.stringify(front.title)}
description: ${JSON.stringify(front.description)}

${content.trim()}`;

  const first = await ask(prompt);
  const ok = (out: z.infer<typeof OUTPUT>) =>
    sameTokens(content, out.body) &&
    sameTokens(front.title, out.title) &&
    sameTokens(front.description, out.description);
  if (ok(first.output)) return { front, out: first.output };
  const retry = await ask(
    `${prompt}\n\nYour previous answer lost or changed some {tokens}. These must all appear, unchanged: ${tokensOf(content).join(" ")}`,
  );
  if (!ok(retry.output)) throw new Error(`${locale}/${doc.id}: {tokens} did not survive`);
  return { front, out: retry.output };
}

function render(front: Record<string, unknown>, out: z.infer<typeof OUTPUT>): string {
  const yaml = (value: string) => JSON.stringify(value);
  const extra = Object.entries(front)
    .filter(([key]) => key !== "title" && key !== "description")
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}\n`)
    .join("");
  return `---\ntitle: ${yaml(out.title)}\ndescription: ${yaml(out.description)}\n${extra}---\n\n${out.body.trim().replace(/'/g, "’")}\n`;
}

async function main() {
  const docs = readSource();
  const unknown = picked.filter((l) => !LOCALES.includes(l as Locale));
  if (unknown.length) {
    console.error(`[legal-translate] unknown locale(s): ${unknown.join(", ")}`);
    process.exit(1);
  }
  const everyLocale = LOCALES.filter((l) => l !== DEFAULT_LOCALE);
  const targets = picked.length ? everyLocale.filter((l) => picked.includes(l)) : everyLocale;
  let hashes: Record<string, string> = {};
  try {
    hashes = JSON.parse(readFileSync(HASHES_PATH, "utf8"));
  } catch {
    /* first run */
  }
  const stale = new Set(
    docs.filter((d) => hashes[d.id] !== undefined && hashes[d.id] !== hashOf(d.source)).map((d) => d.id),
  );
  const outPath = (locale: string, id: string) => join(CONTENT_DIR, locale, `${id}.md`);
  const jobs = targets
    .flatMap((locale) => docs.map((doc) => ({ locale, doc })))
    .filter(({ locale, doc }) => !existsSync(outPath(locale, doc.id)) || stale.has(doc.id))
    .slice(0, limit);
  console.log(`[legal-translate] ${docs.length} document(s) x ${targets.length} locale(s): ${jobs.length} to write`);

  const wrote = new Set<string>();
  let failed = 0;
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          const { front, out } = await translate(job.doc, job.locale);
          const path = outPath(job.locale, job.doc.id);
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, render(front, out));
          wrote.add(`${job.locale}:${job.doc.id}`);
          console.log(`[legal-translate] ${job.locale}/${job.doc.id}`);
        } catch (error) {
          failed++;
          console.error(`[legal-translate] ${job.locale}/${job.doc.id} failed:`, error);
        }
      }
    }),
  );

  // Stamped only once every language holds this English, for the glossary's
  // reason: one hash covers all 35, so stamping a document a run did not finish
  // would record its stale translations as current.
  const next: Record<string, string> = {};
  for (const doc of docs) {
    const settled = everyLocale.every(
      (locale) =>
        wrote.has(`${locale}:${doc.id}`) || (!stale.has(doc.id) && existsSync(outPath(locale, doc.id))),
    );
    if (settled) next[doc.id] = hashOf(doc.source);
    else if (hashes[doc.id] !== undefined) next[doc.id] = hashes[doc.id];
  }
  writeFileSync(HASHES_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`[legal-translate] wrote ${wrote.size} file(s) on ${MODEL}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("[legal-translate] failed:", error);
  process.exit(1);
});
