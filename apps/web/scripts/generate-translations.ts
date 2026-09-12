// Fills in every language but English, from the English files.
//
// English is written by hand and is the only one. Every other locale is this
// script's output, run by CI on the commits that touch `src/locales/en`, so a
// contributor adds a string once and 26 languages follow. It only ever writes
// the keys a locale is MISSING: a translation already in the tree is never
// re-generated, so a hand correction survives, and a run that has nothing to do
// costs nothing.
//
// `pnpm translate` locally does the same thing. It needs OPENAI_API_KEY.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { shouts, typographic } from "./translation-rules";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv-flow";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: webRoot });

import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  GAME_CLIENT_LANGUAGE,
  isGameClientNamespace,
  isWargamingNamespace,
  WARGAMING_LANGUAGE,
} from "../src/lib/game-vocabulary";
import { DEFAULT_LOCALE, LOCALES, LOCALE_LABEL, type Locale } from "../src/lib/translations";

const localesRoot = join(webRoot, "src", "locales");
/**
 * A small model, because this is not a hard job and there is a lot of it.
 *
 * Most of what crosses here is three words in a table head. The wording that
 * actually needs judgement is the game's own, and that no longer comes from a
 * model at all: the maps, the modes, the equipment and the crew skills are read
 * off the client's catalogues (`generate-game-locales`), so the model is left
 * with our prose and our labels. The frontier tier bought nothing for that and
 * cost a great deal: 1,541 English keys across 35 languages is close to 54,000
 * strings, and the first full pass alone was 823 files.
 *
 * `gpt-4o-mini` is what onRuntime's own translator uses for the same tree in the
 * same shape, so it is a measured choice rather than a guess.
 */
const MODEL = process.env.TRANSLATE_MODEL ?? "gpt-5.6-luna";

/**
 * The model for PROSE, which is a different job from the one above.
 *
 * That measurement was taken across the whole tree and answered the wrong
 * question: 2,059 of our 2,426 non-game keys are under eight words, and a small
 * model writes a three-word table head as well as any. The other 367 are
 * sentences averaging nineteen words, and there the small model writes calques
 * a reader spots at once ("Libre de publicité" for ad-free, where French says
 * "sans publicité"). That slice is 15% of the tree, so the frontier tier costs
 * a fraction of what it did when it was priced against all of it.
 *
 * Split by length rather than by namespace: a sentence is a sentence wherever
 * it lives, and the boundary is measurable where a list of namespaces would be
 * one more thing to keep.
 *
 * The boundary is THREE words, not eight, and the difference is what a reader
 * notices: "Community-funded · Ad-free" is three, and the small model rendered
 * it "Libre de publicité", which is English grammar wearing French words. What
 * is left below the line is one and two-word labels, and those are the strings
 * the term sheet already decides once and reuses, so the model is barely
 * choosing anything there. That is 46% of the non-game tree.
 */
const PROSE_MODEL = process.env.TRANSLATE_PROSE_MODEL ?? "gpt-5.6-luna";
const PROSE_WORDS = 3;

const isProse = (value: string) => value.trim().split(/\s+/).length >= PROSE_WORDS;

// The translator's own key, so this and the changelog writer can be billed,
// rate-limited and revoked apart: one writes a message a day from the worker,
// the other writes a few hundred files in a burst from CI. Falling back to the
// shared key keeps a checkout with only that one working.
/**
 * Where the tokens are bought.
 *
 * OpenAI direct by default, and any OpenAI-compatible endpoint through
 * `TRANSLATE_BASE_URL`. That is a base URL and a key, nothing else: the request
 * format, the structured output and the retries are unchanged.
 *
 * It exists because the same models can be bought as somebody else's unused
 * committed capacity for a fraction of list, and because this tree is
 * translated in bulk on a schedule rather than in front of a reader, so a
 * marketplace's variable capacity is a fair trade for the price.
 */
const openai = createOpenAI({
  apiKey:
    process.env.TRANSLATE_API_KEY ??
    process.env.OPENAI_API_KEY_TRANSLATIONS ??
    process.env.OPENAI_API_KEY,
  baseURL: process.env.TRANSLATE_BASE_URL,
});
// One request per (namespace, locale). They are independent and each is a
// couple of seconds, so the wall clock is the pool rather than the sum.
const CONCURRENCY = 25;

/**
 * How many prose requests may be in flight, which is NOT always the same budget.
 *
 * The label half runs on a small model with a generous rate limit and 25 at a
 * time is fine there. A frontier model's is far tighter: at 25 the first full
 * pass took 11,872 rate-limited responses to 2,960 written files, and the AI
 * SDK's own retries were exhausted often enough to drop batches. Six is what
 * fits there, and that pass is faster for being slower.
 *
 * **When both tiers are the same model there is no second budget to protect**,
 * and the gate becomes a throttle on the pool below. That is not academic: on
 * an endpoint that hangs rather than rate-limits, six slots spend most of their
 * time holding dead sockets, so the whole run moves at six-at-a-time however
 * much headroom the pool has. Measured at 78 timeouts to 34 completions, with
 * the retries recovering nearly all of them, so the ceiling was the waiting
 * rather than the endpoint.
 */
const PROSE_CONCURRENCY = Number(
  process.env.TRANSLATE_PROSE_CONCURRENCY ??
    (PROSE_MODEL === MODEL ? CONCURRENCY : 6),
);

/** How long one request may take before it is treated as dead. See `ask`. */
const REQUEST_TIMEOUT_MS = 90 * 1000;
/**
 * How many times a request that answered nothing at all is asked again.
 *
 * High because the failure it answers is a coin flip rather than a verdict:
 * this endpoint hangs on roughly two requests in three and the next attempt
 * usually lands, so a batch that gives up has almost always just been unlucky
 * several times over. At four, a third of the run's batches were still being
 * abandoned each pass and the tree converged about a third at a time, which
 * projected to a floor around a thousand keys rather than none. An attempt
 * costs only the deadline above, and they run inside the pool's concurrency,
 * so buying more of them is cheap in wall-clock and free in tokens: a hung
 * request is never billed, because it never answered.
 */
const REQUEST_ATTEMPTS = 10;

type Json = { [key: string]: string | Json };

/**
 * Re-translate keys a locale already has.
 *
 * The generator never overwrites, which is what makes a hand correction stick,
 * and is wrong exactly once: when the model itself got a batch wrong (it
 * occasionally translates a game term the prompt asked it to leave alone). Scope
 * it to the locales you name, and re-read the diff.
 */
const force = process.argv.includes("--force");

/** Print what the run would cost and stop, without calling anything. */
const estimateOnly = process.argv.includes("--estimate");

/** How many times a key that came back missing or broken is asked again. */
const RETRIES = 3;

const only = process.argv
  .filter((arg) => !arg.startsWith("-"))
  .slice(2)
  .filter((arg): arg is Locale => (LOCALES as readonly string[]).includes(arg));
const targets = (only.length ? only : LOCALES).filter(
  (locale) => locale !== DEFAULT_LOCALE,
);

function namespacesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".json"))
        out.push(relative(dir, full).split(sep).join("/").replace(/\.json$/, ""));
    }
  };
  walk(dir);
  return out.sort();
}

function readJson(path: string): Json | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Json;
  } catch {
    return null;
  }
}

/** Every leaf, keyed by its dotted path, which is what a translation request is
 * a list of. The nesting is restored on the way back out. */
function flatten(value: Json, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") out[path] = child;
    else Object.assign(out, flatten(child, path));
  }
  return out;
}

/**
 * The target file rebuilt in the SOURCE's shape: same keys, same order, and a
 * key English has dropped disappears rather than lingering. What the target
 * already holds wins over what was just translated, which is what makes a hand
 * correction survive every later run.
 */
function merge(
  source: Json,
  target: Json,
  translated: Record<string, string>,
  prefix = "",
): Json {
  const out: Json = {};
  for (const [key, child] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") {
      const existing = target[key];
      if (path in translated) out[key] = typographic(translated[path]);
      else if (typeof existing === "string") out[key] = typographic(existing);
    } else {
      const existing = target[key];
      out[key] = merge(
        child,
        typeof existing === "object" && existing ? existing : {},
        translated,
        path,
      );
    }
  }
  return out;
}

/**
 * The game's own vocabulary is not translated, it is looked up.
 *
 * A mode has a name in every language the game ships in, and it is the game's:
 * a French player reads "Offensive", never "Onslaught". Telling the model to
 * keep such a term in English, which this prompt used to do, is what makes a
 * page read as half-translated to the only people who would notice. So the
 * `game/` namespaces get the opposite instruction, and the escape hatch is the
 * honest one: a language the game is not published in has no official word, and
 * there the model should say what a player of that language would say.
 */
/** The terms one `terms` request is about, so its context block matches it. */
let askedTerms: Set<string> | undefined;

/**
 * What an ambiguous term names HERE.
 *
 * The sheet asks about bare words, and a bare word carries no sense: "Tier"
 * came back as the French "Rang", which is a rank or a league, where World of
 * Tanks says "Niveau" for a vehicle's place in the tech tree. German and Polish
 * happened to answer correctly ("Stufe", "Poziom"), which is exactly why this
 * has to be stated rather than left to luck. Every language decides again with
 * the sense in hand.
 */
/**
 * Terms the client's own match gets wrong, so the model decides them instead.
 *
 * `game-terms.json` pairs a client string with its translation BY KEY, which is
 * right almost everywhere and silently wrong when two different screens share
 * an English word. "Tier" is the case that showed: some client key reading
 * "Tier" in English is "Rang" in French, which is the Ranked Battles word, and
 * it won over everything because the official sheet is applied before the model
 * is asked. Wargaming's own French prose says "niveau" twelve times and "rang"
 * never, so the client match is naming a different thing.
 *
 * Listed by TERM rather than by language: every language re-decides, and the
 * ones the client got right (German "Stufe", Polish "poziom") answer the same
 * way from the meaning alone.
 */
const CLIENT_MISMATCH = new Set(["Tier"]);

const TERM_MEANINGS: [string, string][] = [
  // Measured against Wargaming's own prose rather than assumed: their French
  // descriptions say "niveau" twelve times and "rang" never, Spanish "nivel"
  // ten times against one "rango". The word for a LEVEL, not for a rank.
  ["Tier", "a vehicle's level in the tech tree, written I to X. The word your language uses for a LEVEL or a step, which is what World of Tanks itself writes: 'niveau' in French, 'Stufe' in German, 'nivel' in Spanish, 'poziom' in Polish. Never the word for a rank, a grade, a league or a division"],
  ["Rank", "a position in a leaderboard, the ordinal a row sits at. It must NOT be the same word you chose for Tier: they are different things and the interface shows them side by side"],
  ["Marks", "the Marks of Excellence painted on a gun barrel, not scores or grades"],
  ["Crew", "the tankers inside a vehicle, not a team of players"],
  ["Class", "the vehicle's kind: light, medium, heavy, tank destroyer, artillery"],
  ["Stronghold", "the clan base game mode, which World of Tanks names in every language it ships"],
  ["Coverage", "how much of the playerbase this site has data for, not map control"],
  ["Spotting", "seeing an enemy so allies can fire on it, the view-range mechanic"],
  ["Match", "how closely two vehicles resemble each other, a percentage. Not a battle"],
];

function instructionsFor(namespace: string, locale: Locale): string {
  // The term sheet is a list of bare words, and a bare word has no context: on
  // its own "Tanks" is as much a container as a vehicle, and the first pass
  // duly answered "Tanks" in French for a site whose own navigation says
  // "Chars". So this request is told what the words are FOR, and pointed at the
  // one authority that already answers most of them.
  if (namespace === "terms") {
    return `These are the recurring nouns of a World of Tanks statistics site: its navigation sections, table headings, tabs and filters. Each will be reused verbatim wherever it appears, so choose the word a player of this language actually uses and commit to it.

${termPlaces(askedTerms)}

Rules:
- Where World of Tanks itself has a word for it, that word wins: a French player reads "char", never "tank", and "Offensive", never "Onslaught".
- Translate the noun even when the English is short. Leaving it in English is only right when the game leaves it in English too.
- Keep product vocabulary as written: Wargaming, World of Tanks, WN7, WN8, WNX, Twitch, Discord.
- Keep the capitalisation style of the source. No title case.

Some of these words mean something narrower here than they do in ordinary English. Where one appears in the list, this is what it names:
${TERM_MEANINGS.map(([term, sense]) => `- ${term}: ${sense}`).join("\n")}`;
  }

  if (!namespace.startsWith("game/")) {
    return `Each key is "<where it lives> : <its name>", so the first half tells you what part of a World of Tanks statistics site the string belongs to. Translate each one as that part of an interface, not as an isolated word.

Rules:
- Keep every {placeholder} and every HTML tag exactly as written, moving them where the sentence needs them.
- An ICU argument, "{count, plural, one {# item} other {# items}}" or "{gender, select, m {...} other {...}}", is structure rather than words: keep the argument name, the keyword and the # exactly, and translate ONLY the text inside each branch.
- Give a plural argument the branches YOUR language needs, which may be more or fewer than English has. English and French need one and other, Polish and Russian need one, few and many, Arabic needs zero, one, two, few, many and other, Japanese and Chinese need only other. Always write an other branch. Getting this wrong is not a style problem: two branches in Polish prints the five-and-above form on every count from two upwards.
- A {placeholder} stands for a name that will be dropped in. Build the sentence your language would build around it, including any preposition or article it needs: "Top {mode} players" is "Meilleurs joueurs de {mode}" in French, never "Meilleurs {mode} joueurs".
- A heading that begins with a {placeholder} in English begins with a real word in most languages, because the name moves. Capitalise whatever ends up first: "{name} directive" is "Directive {name}" in French, never "directive {name}".
- When a {placeholder} holds a PROPER NOUN (a vehicle, a player, a clan, a map), write a real sentence around it rather than an apposition: "Tech tree branch of the {tank}" is "Branche technologique du {tank}" in French, not "Branche technologique : {tank}".
- Never leave a bare definite article immediately before that placeholder. "le {tank}" reads as "le IS-7" for one vehicle and wants "l'IS-7" for another, and you cannot know which: the article is the one word that would have to change with the name. Use a preposition that contracts ("du {tank}", "dell'{tank}" becomes "del {tank}"), or word the sentence so nothing stands directly in front of the name.
- That sentence must read the same for EVERY name the placeholder can hold, because it is written once and reused for all of them. You do not know how any given name is pronounced, so nothing in it may depend on that: pick the one form that always works and keep it. French always writes "du {tank}", never "de l'{tank}", because the article agrees with the implied noun (the vehicle) rather than with the name. A language whose ending would have to change with the name puts that ending on a word of its own instead, the way Turkish attaches its suffix to "tank" and Finnish declines "panssarivaunu", so the name itself is never inflected.
- English marks possession with 's. Almost no other language does. "{nickname}'s sessions" is "Sessions de {nickname}" in French and "Sitzungen von {nickname}" in German: rebuild it the way your language would, and never leave the apostrophe-s on the placeholder.
- Leave product vocabulary in English: Wargaming, World of Tanks, WN7, WN8, WNX, Discord, GitHub, MCP, API, unicum.gg, and the names of tanks and maps.
- Capitalise the way YOUR language capitalises a heading, not the way English does. Most languages capitalise only the first word and proper nouns, so "Tech Tree Branch" is "Branche technologique" in French and "Ramo dell\u2019albero tecnologico" in Italian, never "Branche Technologique". German is the exception and capitalises every noun. English title case is English, and copying it is the most common way a translated interface reads as translated.
- Write the apostrophe as \u2019, the typographic apostrophe, never as the ASCII quote. It elides in French ("l\u2019IS-7"), contracts in English ("doesn\u2019t") and takes a suffix in Turkish ("3 \u20ac\u2019dan"): one character for all of them, and left to chance the tree carries both spellings in the same sentence.
- Never answer in ALL CAPS when the English is not. A heading is styled by the interface, not by the string: "Grand Final" is "Grande finale", never "GRANDE FINALE". If your language shouts it in the game, it is the game shouting, not the sentence.
- Punctuate the way your language punctuates. No em-dashes or en-dashes inside a sentence: use a comma, a colon, or two sentences. French puts a narrow space before ? ! : and ;, and uses « » for quotation marks. Spanish opens a question with ¿ and an exclamation with ¡. Follow your own conventions rather than the source's.
- "Top" before a plural is a ranking, not a position: "Top players" is "Meilleurs joueurs" in French and never "Haut joueurs". The same holds for "Best" and "Leading".
- After "become", "be" or "sign up as", a role noun takes no article in most languages even though English gives it one: "Become a supporter" is "Devenez soutien" in French and "Werden Sie Unterstützer" in German, not "Devenez un soutien".
- No em-dashes and no semicolons.
- Translate the meaning, not the words: these are buttons, headings and one-line descriptions a player reads in a hurry.`;
  }

  // Measured against the CLIENT, not the API. The API answers in thirteen
  // languages and the game is played in thirty-three, so asking the API would
  // tell a Ukrainian, Italian, Dutch, Hungarian, Romanian, Portuguese, Swedish,
  // Croatian, Serbian or Japanese reader that their language has no official
  // wording when their own client is full of it.
  const published = GAME_CLIENT_LANGUAGE[locale] !== undefined;
  return `These are World of Tanks in-game terms: battle modes, vehicle roles, map features, badges.

Rules:
- ${
    published
      ? `World of Tanks IS published in ${LOCALE_LABEL[locale]}. Use the exact wording the game itself shows a player in that language, not a literal translation of the English (for example, the mode English calls "Onslaught" is "Offensive" in the French client). If you are not certain of the game's own wording for a term, keep the English rather than invent one.`
      : `World of Tanks is NOT published in ${LOCALE_LABEL[locale]}, so there is no official wording to match. Write what a player of that language would naturally call it, and keep the English for anything that is a proper name.`
  }
- Keep every {placeholder} exactly as written.
- Keep the capitalisation style of the source.`;
}

/**
 * The site's own recurring vocabulary, derived rather than listed.
 *
 * A term that appears in more than one namespace is a word the site uses, not a
 * sentence: "Tanks" is the nav section, the footer column, a profile tab and a
 * search heading. Each namespace is its own request, so nothing tied those
 * together and the model was free to answer "Chars" in one file and "Tanks" in
 * the next, which is exactly what it did in French (and, being the same
 * mechanism, in every other language).
 *
 * So the recurring words are collected first, translated once, and quoted into
 * every later prompt as terms that must be used verbatim. Derived from the tree
 * itself, so a word that becomes recurring joins the sheet on its own.
 */
const TERM_MAX_WORDS = 3;

/**
 * Where the decided vocabulary lives.
 *
 * A real file rather than a value held in the run, so it is reviewable, so a
 * hand correction to a term propagates to every string containing it on the
 * next pass, and so the decision survives a rerun.
 *
 * One file beside the locale folders rather than a namespace inside each: it is
 * keyed by the English word, nothing renders it, and a namespace would be
 * bundled into every page for no reader. Same place and same reasoning as
 * `source-hashes.json`.
 */
const TERMS_PATH = join(localesRoot, "terms.json");

/**
 * The words the game itself already has, written by `generate-game-locales`
 * from the client's own catalogues and keyed by the English string.
 *
 * These outrank anything a model would decide, and are never sent to one: a
 * player reads "Faits d'armes" on their own screen, so that is what the site
 * says, whatever a translator would reach for from "Achievements" alone. Absent
 * on a checkout whose mirror has never been read, which is not an error: the
 * sheet is then simply the model's own, as it was before.
 */
const GAME_TERMS_PATH = join(localesRoot, "game-terms.json");

/**
 * Where each recurring term is used, quoted into the term request.
 *
 * A term is decided ONCE and reused everywhere, and it was decided from the
 * bare word: "Supporter" came back as "Soporte" in Spanish, "Supporto" in
 * Italian and "Apoio" in Portuguese, which are all the abstract noun rather
 * than the person who funds the site. The places a word appears are the only
 * context that exists for it, and they are already known, so they are handed
 * over rather than left for the model to guess at.
 */
let termAppearances = new Map<string, Set<string>>();

function termPlaces(asked?: Set<string>): string {
  const lines = [...termAppearances]
    .filter(([term, where]) => where.size > 0 && (!asked || asked.has(term)))
    .map(([term, where]) => {
      const places = [...where]
        .map((ns) => ns.replace(/^(components|app)\//, "").replace(/\/index$/, ""))
        .slice(0, 3)
        .join(", ");
      return `- ${term}: used in ${places}`;
    })
    .sort();
  // Only the words this request is about. Listing all 579 of them made the
  // terms request itself too large to serve, and it failed silently: the sheet
  // stayed empty, so every later batch was translated with no terms quoted at
  // all. That is why "snapshot" came back as "instantané" from a run whose
  // sheet said "capture".
  const capped = lines.slice(0, TERM_BLOCK_MAX);
  return capped.length === 0
    ? ""
    : `Where each one is used, since a bare word has no context:\n${capped.join("\n")}`;
}

function officialSheet(locale: Locale): Record<string, string> {
  const all = readJson(GAME_TERMS_PATH) as
    | Record<string, Record<string, string>>
    | undefined;
  return all?.[locale] ?? {};
}

/**
 * A heading or a column label, as opposed to prose.
 *
 * The distinction exists to widen the term rules exactly where it is safe.
 * Matching a decided term case-insensitively is what settles "{tank} upgrades"
 * against the client's "Upgrades", but doing it everywhere is what once turned
 * "the game draws it" into "le jeu le Nuls": a lowercase "draws" mid-sentence
 * is the verb, not the stat we named. A label has no verbs to confuse, and its
 * nouns are precisely the ones the game already names, so the relaxation is
 * granted here and refused in prose.
 *
 * Sentence punctuation is the signal, since it is what prose has and a heading
 * does not. Placeholders are dropped first: `{tank}` carries no words of its
 * own and its braces must not count against the length.
 */
const LABEL_MAX_WORDS = 5;

/**
 * Whether a translation carries the decided word, allowing for inflection.
 *
 * Full containment is wrong the moment a language declines: the client's
 * Italian noun is "Potenziamento" and a heading needs "Potenziamenti", the
 * Ukrainian "Модернізація" becomes "Модернізації" in the genitive, and neither
 * contains the sheet's own form. Compared on a stem rather than on the whole
 * word, a sheet entry that never matches its own correct inflection would flag
 * the key as undecided on every run and retranslate it forever.
 *
 * The stem is three quarters of the word, floored at four characters, so it
 * still separates the decided term from a different one: "Melhoramentos" and
 * "Melhorias" part company at the fifth letter.
 */
function carriesDecided(current: string, decided: string): boolean {
  const text = current.toLowerCase();
  if (text.includes(decided.toLowerCase())) return true;
  const words = decided
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4);
  if (words.length === 0) return false;
  return words.every((word) =>
    text.includes(word.slice(0, Math.max(4, Math.ceil(word.length * 0.75)))),
  );
}

/** Whether `term` appears in `text` as whole words. Both already lowercased. */
function wordIn(text: string, term: string): boolean {
  return new RegExp(
    `(^|[^\\p{L}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`,
    "u",
  ).test(text);
}

function labelWords(value: string): string[] | null {
  const bare = value.replace(/\{[^{}]*\}/g, " ").trim();
  if (!bare || /[.,;:!?]/.test(bare)) return null;
  const words = bare.split(/\s+/);
  return words.length > 0 && words.length <= LABEL_MAX_WORDS ? words : null;
}

/**
 * The official terms our own English uses INSIDE a label, keyed as the client
 * capitalises them.
 *
 * The exact-match mining below only ever sees a string that is nothing but a
 * term, so a word the site only ever writes inside a heading never reached the
 * sheet: "Upgrades" exists in the client in twenty-eight languages and our only
 * use of it is `{tank} upgrades`, which was left to the model and came back as
 * English in German, Italian and Dutch. This finds it by walking the label's
 * own word runs rather than the sheet, so the cost is the corpus and not the
 * 1,500 terms a language brings.
 */
function termsInLabels(
  namespaces: string[],
  official: Record<string, string>,
): string[] {
  const byLower = new Map<string, string>();
  for (const term of Object.keys(official)) {
    const lower = term.toLowerCase();
    // A tie between two capitalisations of one word is not ours to settle, and
    // the client's own is the one already in the sheet, so first wins.
    if (!byLower.has(lower)) byLower.set(lower, term);
  }
  const found = new Set<string>();
  for (const namespace of namespaces) {
    if (namespace.startsWith("game/")) continue;
    const source = readJson(join(localesRoot, DEFAULT_LOCALE, `${namespace}.json`));
    if (!source) continue;
    for (const value of Object.values(flatten(source))) {
      const words = labelWords(value);
      if (!words) continue;
      for (let start = 0; start < words.length; start++) {
        for (let size = Math.min(TERM_MAX_WORDS, words.length - start); size > 0; size--) {
          const run = words.slice(start, start + size).join(" ");
          const term = byLower.get(run.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""));
          if (term && !AMBIGUOUS_TERMS.has(term)) found.add(term);
        }
      }
    }
  }
  return [...found].sort();
}

/**
 * English function words, which are never the site's vocabulary.
 *
 * A closed class of the language rather than anything about World of Tanks, so
 * it is stable: nothing is added here when the site gains a feature.
 */
const STOPWORDS = new Set(
  ("a an and are as at be been but by can do does for from has have how in into is it its" +
    " no not of on onto or over so than that the their them then there these they this to" +
    " up was were what when where which who why will with you your our we us if each every" +
    " only also just still yet more most less least all any both few many much other same" +
    " one two three first last next new old per via off out down about after before during" +
    " while since until between through above below under again once here now today").split(
    " ",
  ),
);

/**
 * Words the site uses OFTEN, wherever they appear.
 *
 * The rule above only sees a term that is a whole value, so a word the site
 * only ever writes inside a sentence was never decided and every namespace was
 * free to render it differently. French called a snapshot "instantané" on one
 * panel, "capture" on the next and "relevé" on a third, from 22 English strings
 * across 8 namespaces, and the reader is the one who notices.
 *
 * The threshold is what makes this derived rather than a list: a word carried
 * by at least three namespaces and used at least five times is the site's
 * vocabulary by measurement. Function words are excluded because they are the
 * language, not the domain.
 */
const CORPUS_MIN_USES = 5;
const CORPUS_MIN_NAMESPACES = 3;

function corpusTerms(namespaces: string[]): Map<string, Set<string>> {
  const uses = new Map<string, number>();
  const where = new Map<string, Set<string>>();
  for (const namespace of namespaces) {
    if (namespace.startsWith("game/")) continue;
    const source = readJson(join(localesRoot, DEFAULT_LOCALE, `${namespace}.json`));
    if (!source) continue;
    for (const value of Object.values(flatten(source))) {
      for (const raw of comparable(value).split(/[^A-Za-z-]+/)) {
        const word = raw.replace(/^-|-$/g, "");
        if (word.length < 4 || STOPWORDS.has(word.toLowerCase())) continue;
        // Capitalisation is the source's, so a word the site writes as a label
        // and a word it writes mid-sentence stay apart, as everywhere else here.
        uses.set(word, (uses.get(word) ?? 0) + 1);
        (where.get(word) ?? where.set(word, new Set()).get(word)!).add(namespace);
      }
    }
  }
  const out = new Map<string, Set<string>>();
  for (const [word, places] of where) {
    if ((uses.get(word) ?? 0) < CORPUS_MIN_USES) continue;
    if (places.size < CORPUS_MIN_NAMESPACES) continue;
    if (AMBIGUOUS_TERMS.has(word)) continue;
    out.set(word, places);
  }
  return out;
}

/** Every term-like English string, with the namespaces it appears in. */
function termCandidates(namespaces: string[]): Map<string, Set<string>> {
  const seen = new Map<string, Set<string>>();
  for (const namespace of namespaces) {
    const source = readJson(join(localesRoot, DEFAULT_LOCALE, `${namespace}.json`));
    if (!source) continue;
    for (const value of Object.values(flatten(source))) {
      if (
        value.includes("{") ||
        value.length > 24 ||
        value.trim().split(/\s+/).length > TERM_MAX_WORDS ||
        // A term has to be a word. Unit abbreviations are whole values on this
        // site ("s", "h", "d", "m"), so they were mined as recurring terms and
        // decided: the French sheet carried `d = j`, which is a rule telling a
        // model to replace the letter d. Quoted at a request beside the real
        // terms, it is noise at best and an instruction to corrupt at worst.
        !/[A-Za-z]{3}/.test(value)
      ) {
        continue;
      }
      const set = seen.get(value) ?? new Set<string>();
      set.add(namespace);
      seen.set(value, set);
    }
  }
  return seen;
}

/**
 * The words worth deciding once, in two classes that are decided differently.
 *
 * `recurring` is a word the site says in more than one place, which is the only
 * thing that can be inconsistent, so those go to the model as one question and
 * come back as one answer. `single` is every other term-like string: a model has
 * no reason to be asked about those, but the CLIENT may already name them, and
 * "Achievements" is the case that proves it. It appears in exactly one file, so
 * it was never recurring, and its French was left to a translator that answered
 * "Distinctions" for a word the game itself renders as "Faits d'armes".
 *
 * So the sheet takes both, and the caller sends only what the client is silent
 * about to a model.
 */
/**
 * Words the site says in more than one sense, which is exactly what a decided
 * term must not be.
 *
 * "Top" is the case that proves it: "Top players" is "Meilleurs joueurs" in
 * French, "Top 0.1%" is "Top 0,1 %", and forcing either reading on the other
 * produces "Haut joueurs" or "Meilleurs 0,1 %". A term sheet exists to stop a
 * word drifting between files, so a word that is SUPPOSED to differ has to be
 * left to its context, and the sheet must not carry it at all.
 *
 * Deliberately tiny and hand-kept: everything else here is derived, and this is
 * the one thing measurement cannot tell you, since both readings are correct.
 */
const AMBIGUOUS_TERMS = new Set(["Top", "All", "None", "Live"]);

function recurringTerms(namespaces: string[]): string[] {
  return [...termCandidates(namespaces)]
    .filter(([term, appearances]) => appearances.size > 1 && !AMBIGUOUS_TERMS.has(term))
    .map(([term]) => term)
    .sort();
}

function singleUseTerms(namespaces: string[]): string[] {
  return [...termCandidates(namespaces)]
    .filter(([, appearances]) => appearances.size === 1)
    .map(([term]) => term)
    .sort();
}

/**
 * What each English string said the last time it was translated, so an edit to
 * one can be seen.
 *
 * The file is committed beside the locales rather than derived, because the
 * question it answers is historical: "has this string changed since the other
 * thirty-five were written from it". Nothing in the tree can answer that, since
 * a translation is not comparable to its source.
 */
const HASHES_PATH = join(localesRoot, "source-hashes.json");

function readHashes(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(HASHES_PATH, "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Read once: every job compares against the same snapshot. */
const hashes = readHashes();
const seeding = Object.keys(hashes).length === 0;

const hashOf = (value: string): string =>
  createHash("sha1").update(value).digest("hex").slice(0, 12);

/**
 * Whether a locale needs this key written: it has none, the one it has can no
 * longer render the English, or the English has been rewritten since.
 *
 * The last two are what make an edited English string heal itself, and it took
 * two goes to get right. The generator never overwrites, which is what makes a
 * hand correction stick, and that rule alone leaves a translation of the OLD
 * wording sitting there forever. A placeholder the target has lost is proof of
 * exactly that (it is never a translator's choice: a value missing one renders a
 * sentence with a hole in it), and `tests/validation/locales/quality` fails on
 * the same signal. But it only catches an edit that ADDED a placeholder. Editing
 * "the Steel Hunter last-tank-standing mode" to "the last-tank-standing mode"
 * changes no placeholder and left thirty-five translations describing a mode by
 * a name the game does not use, silently. So the English is hashed at the moment
 * it is translated, and a different hash is the general signal the placeholder
 * rule was a special case of.
 */
function isStale(
  key: string,
  source: string,
  target: Record<string, string>,
  namespace: string,
  hashes: Record<string, string>,
  seeding: boolean,
  locale: Locale,
): boolean {
  const current = target[key];
  if (current === undefined) return true;
  // The client is the author here, in twenty-eight languages, and a model is
  // not an improvement on it. Only a MISSING key is filled, which is the seven
  // languages no client ships. See `GAME_CLIENT_NAMESPACES` for what a stale check
  // did to these files the one time the English side moved.
  if (isGameClientNamespace(namespace)) return false;
  // An identifier that came back changed has to be written again, as itself.
  if (isIdentifier(source) && current !== source) return true;
  // Both directions. A LOST placeholder renders a sentence with a hole in it,
  // and an INVENTED one renders a brace at a reader: Belarusian came back with
  // "{сервер}" for a sentence that had no placeholder at all, and Japanese added
  // "{車輌タイプ}" beside a real one. Neither is a translator's choice, so both
  // are proof the string has to be written again.
  const want = [...markers(source)].sort().join(",");
  if (want !== [...markers(current)].sort().join(",")) return true;
  // On the very first run there is no manifest, and re-translating the whole
  // tree to build one would throw away every hand correction in it. Seed it from
  // what is already there instead: only edits made from here on count.
  // A term the site has already decided must read the same everywhere. This is
  // what makes an existing file converge rather than keep whatever it was given
  // when it was written alone.
  const decided = termSheetFor(locale)[source];
  if (decided !== undefined && current !== decided) return true;
  if (carriesUndecidedTerm(source, current, namespace, locale)) return true;
  if (seeding) return false;
  const recorded = hashes[`${namespace}:${key}`];
  return recorded !== undefined && recorded !== hashOf(source);
}

/**
 * Names the site does not translate in any language, and must not be read as a
 * term left in English.
 *
 * "World of Tanks" contains "Tanks", which the sheet decides as "Chars", so
 * without this every page title in every language reads as an unapplied term
 * and is rewritten forever (2,774 keys on the first measurement, against 298
 * real ones). A product name is not a word.
 */
const PROTECTED_NAMES = [
  "World of Tanks",
  "Marks of Excellence",
  "Mark of Mastery",
  "Tank Company",
];

/**
 * The comparable part of a string: no product names, and no placeholder
 * contents.
 *
 * A `{name}` or a `{tier}` is a variable, not a word, and the word inside it is
 * the developer's. Read case-insensitively it matched the terms "Name" and
 * "Tier" in four thousand strings that were perfectly translated, which is how
 * a rule meant to catch "Le tank" nearly rewrote the whole tree.
 */
const comparable = (value: string): string =>
  PROTECTED_NAMES.reduce(
    (text, name) => text.split(name).join("@"),
    value.replace(/\{[^}]*\}/g, "@"),
  );

/**
 * A value that is an identifier rather than a word: `WN8`, `WR`, `HRB`, `MoE`.
 *
 * These are the names of metrics and they are the same in every language, the
 * way `WN8` is. A model asked to translate one obliges: French came back with
 * `VH` for `HR`, Greek with `ΠΕ`, Russian with `Успех`, and a column header
 * became a word nobody can look up. Thirty-two of them across the tree.
 *
 * Recognised by shape rather than by a list, so a metric we add is covered the
 * day it appears: short, no spaces, and at least two capitals, which is what
 * separates `HRb` from `Tier` and from any real word.
 */
function isIdentifier(value: string): boolean {
  if (value.length > 5 || /\s/.test(value)) return false;
  return [...value].filter((c) => c >= "A" && c <= "Z").length >= 2;
}

/**
 * A translation that still says the English word for something the site has
 * decided.
 *
 * The exact-match rule above only catches a key whose WHOLE value is a term.
 * "Tanks destroyed" is not, so its French kept "Tanks détruits" beside a table
 * of "Chars" everywhere else: the string was written before the sheet existed
 * and nothing since had a reason to look at it again.
 *
 * `game/` is exempt, and that is the point of the namespace: those words are
 * Wargaming's own, copied from the client, and a map really is called "44 North
 * America" in French.
 */
function carriesUndecidedTerm(
  source: string,
  current: string,
  namespace: string,
  locale: Locale,
): boolean {
  if (namespace.startsWith("game/")) return false;
  const sheet = termSheetFor(locale);
  const cleanSource = comparable(source);
  const cleanCurrent = comparable(current);
  for (const [term, decided] of Object.entries(sheet)) {
    if (term === decided || term.length < 4 || AMBIGUOUS_TERMS.has(term)) continue;
    if (!enforceableTerms.has(term)) continue;
    // Case-sensitive, like the prompt block above and for the same reason: a
    // lowercase "draws" mid-sentence is a verb, not the stat we named. The cost
    // is that "Le tank" inside a sentence is not caught, which is a smaller
    // wrong than translating a verb as a noun.
    const word = new RegExp(
      `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    );
    // Deliberately NOT relaxed to the case-insensitive label rule the prompt
    // uses. Quoting the client's word at a heading is free; REWRITING every
    // heading that does not carry it never settles, because a label inflects
    // ("2 Marks" is "2 Маркі") and a language whose sheet the model wrote is
    // being held to its own earlier guess. Measured: 399 files rewritten on a
    // run that should have written none, in nineteen languages, oscillating
    // between two readings of the same word.
    if (
      word.test(cleanSource) &&
      word.test(cleanCurrent) &&
      !carriesDecided(cleanCurrent, decided)
    ) {
      return true;
    }
  }
  return false;
}

/** The decided rendering of each recurring term, for one locale. */
const termSheets = new Map<Locale, Record<string, string>>();

/**
 * The terms an EXISTING translation may be rewritten for.
 *
 * Only the whole-value ones. A corpus term is mined from inside sentences, so
 * the set necessarily contains verbs ("played", "ranked", "rate" all clear the
 * threshold), and rewriting a sentence because it does not carry the decided
 * noun is how "the game draws it" once became "le jeu le Nuls". Quoting them at
 * a NEW translation costs nothing and is where the consistency is won; holding
 * an old one to them is where it was lost.
 */
let enforceableTerms = new Set<string>();

function termSheetFor(locale: Locale): Record<string, string> {
  return termSheets.get(locale) ?? {};
}

/** The lines quoted into every prompt: "this word is already this word". */
function termBlock(locale: Locale, entries: Record<string, string>): string {
  const sheet = termSheetFor(locale);
  // Only the terms this batch actually contains, so a request carries the words
  // it needs rather than the whole sheet.
  //
  // Deliberately CASE-SENSITIVE, and that is the whole safeguard. A decided
  // term is a label, and half of them are also common English verbs: quoting
  // "Draws = Nuls" at a request containing "the game draws it" produced "le jeu
  // le Nuls" in French, "im Spiel unentschieden" in German and "lo empata el
  // juego" in Spanish. Capitalisation is the only signal separating the noun we
  // decided from the verb we did not.
  const values = new Set(Object.values(entries));
  // A label's nouns are matched whatever their case, prose's are not: see
  // `labelWords` for why the two are held apart.
  const labels = [...values]
    .map((value) => labelWords(value)?.join(" ").toLowerCase())
    .filter((value): value is string => value !== undefined);
  const relevant = Object.entries(sheet).filter(
    ([term]) =>
      values.has(term) ||
      [...values].some((v) => v.includes(term)) ||
      (!AMBIGUOUS_TERMS.has(term) &&
        labels.some((label) => wordIn(label, term.toLowerCase()))),
  );
  if (relevant.length === 0) return "";
  // Capped, because an unbounded block is a request that fails.
  //
  // The sheet went from ~270 terms to 511 when the corpus rule was added, and a
  // batch of 45 strings carrying all 511 stopped working: the request was
  // rejected outright, and the SDK reported it as "The Vercel AI Gateway did
  // not respond", which is about neither the gateway nor the model. Measured:
  // 100 terms in the block is fine, 511 is not.
  //
  // Ordered by how often the batch actually uses the word, so what survives the
  // cap is what the batch is about rather than whatever sorted first.
  const uses = (term: string) =>
    [...values].filter((v) => v.includes(term)).length;
  const quoted = relevant
    .sort(([a], [b]) => uses(b) - uses(a) || a.localeCompare(b))
    .slice(0, TERM_BLOCK_MAX);
  return `\n\nThese words are already decided for this language. Use them exactly, including inside a longer sentence:\n${quoted
    .map(([term, translation]) => `- ${term} = ${translation}`)
    .join("\n")}`;
}

/**
 * A global gate on the prose model, independent of the job pool.
 *
 * The pool runs 25 namespace jobs at once and each issues its prose and its
 * label request together, so the frontier model saw 25 concurrent calls however
 * the pool was tuned. The gate is on the call rather than on the pool because
 * only one of the two halves needs it.
 */
let proseInFlight = 0;
const proseQueue: (() => void)[] = [];

async function withProseSlot<T>(run: () => Promise<T>): Promise<T> {
  if (proseInFlight >= PROSE_CONCURRENCY)
    await new Promise<void>((resolve) => proseQueue.push(resolve));
  proseInFlight++;
  try {
    return await run();
  } finally {
    proseInFlight--;
    proseQueue.shift()?.();
  }
}

async function ask(
  entries: Record<string, string>,
  locale: Locale,
  namespace: string,
  extra = "",
  model = MODEL,
): Promise<Record<string, string>> {
  // An abort is not an API error, so the SDK's own `maxRetries` rethrows it
  // rather than retrying: the deadline below only turns a hung request into a
  // failure, and it takes this loop to turn that failure back into an answer.
  // Each attempt gets a signal of its own, since a fired one stays fired.
  const call = async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await attempt_();
      } catch (error) {
        const timedOut =
          error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError");
        if (!timedOut || attempt >= REQUEST_ATTEMPTS) throw error;
        console.warn(
          `[translate] ${locale}/${namespace}: no answer in ${REQUEST_TIMEOUT_MS / 1000}s, attempt ${attempt + 1}/${REQUEST_ATTEMPTS}`,
        );
      }
    }
  };
  const attempt_ = () =>
    generateText({
    // `.chat()` rather than the provider default, which is the Responses API:
    // that one carries `store: true` and a conversation id, and an
    // OpenAI-COMPATIBLE endpoint is stateless by definition, so it refuses the
    // request outright. Chat Completions is the surface every such endpoint
    // implements, OpenAI's own included, so this is the portable call.
    model: openai.chat(model),
    // A rate-limited request is normal at this volume, not a failure: the
    // default of two retries gives up inside one limiter window.
    maxRetries: 6,
    // Without this the run can stop dead without failing. A retry needs an
    // ERROR to fire on, and a socket that is open and silent never produces
    // one: a marketplace endpoint under load accepted six requests, answered
    // none of them, and held the connections. Every prose slot was taken, so
    // 201 requests sat at zero completed for 75 minutes with nothing in the
    // log and nothing to retry. A deadline turns that silence into an error
    // the retries above can act on. Set from what a healthy request costs
    // rather than from caution: a 200-key batch answers in well under a
    // minute, and the endpoint's hangs are total rather than slow, so waiting
    // four minutes only made each dead request four times as expensive. It is
    // also why the attempts are worth more than the patience: on a live
    // measurement one request in two hung, and the retry recovered it.
    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    // Set explicitly because the provider's default is not ours to assume, and
    // an answer cut off mid-array is not an error anyone sees: the request
    // succeeds, the repair path salvages whatever parsed, and the keys past the
    // cut are simply absent. That is what stalled the tail of a full run. Every
    // locale whose script costs more tokens per character was still short by
    // one batch after five passes (Greek, Thai, Korean, the Cyrillic four,
    // Vietnamese, and the long-word Finnish and Lithuanian), while the Latin
    // ones had finished, and the batches that did land came back holding four
    // to fourteen keys out of a hundred and fifty.
    maxOutputTokens: 32000,
    output: Output.object({
      schema: z.object({
        items: z.array(z.object({ key: z.string(), value: z.string() })),
      }),
    }),
    prompt: `Translate these strings for a World of Tanks statistics website from English into ${LOCALE_LABEL[locale]} (${locale}).

${instructionsFor(namespace, locale)}${extra}

${JSON.stringify(Object.entries(entries).map(([key, value]) => ({ key, value })))}${termBlock(locale, entries)}`,
    });

  try {
    const { output } = await call();
    return Object.fromEntries(output.items.map((item) => [item.key, item.value]));
  } catch (error) {
    // A correct answer wrapped in a markdown fence is still a correct answer.
    //
    // Models routinely return ```json … ``` around the object, which the SDK's
    // parser rejects outright, and the whole batch is then dropped as if the
    // model had failed. Observed with the right French in hand: "Captures du
    // joueur", thrown away for its punctuation. So the raw text is unwrapped
    // and parsed once more before anything is given up on.
    const text = (error as { text?: string }).text;
    if (!text) throw error;
    // Two shapes, both correct answers the parser refuses: wrapped in a
    // markdown fence, and returned as a bare array rather than under `items`.
    const body = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text;
    const pair = z.object({ key: z.string(), value: z.string() });
    let parsed;
    try {
      parsed = z
        .object({ items: z.array(pair) })
        .or(z.array(pair))
        .safeParse(JSON.parse(body.trim()));
    } catch {
      throw error;
    }
    if (!parsed.success) throw error;
    const items = Array.isArray(parsed.data) ? parsed.data : parsed.data.items;
    return Object.fromEntries(items.map((item) => [item.key, item.value]));
  }
}

/**
 * A `{placeholder}` is a variable name, not a word, and a model asked to
 * translate a sentence translates it too: German came back with `{spieler}`
 * for `{players}`, Spanish with `{jugadores}`, and Turkish simply dropped
 * `{garage}`. Either way the string renders the brace at a reader, or throws.
 *
 * So the answer is checked against the source and the broken subset is asked
 * again, once, pointing at exactly what went wrong. What still does not survive
 * is DROPPED rather than written: a key left missing falls back to English,
 * which reads as untranslated, while a broken one reads as broken and is
 * caught only by the test suite, long after it shipped.
 */
/**
 * A heading led by a `{placeholder}` starts with a capital, whatever ends up
 * first.
 *
 * In English the placeholder holds a proper name, so "{name} directive" renders
 * as "Aiming Adjustment directive" and reads as a title. A language that moves
 * the name puts a common noun first, and the model leaves it in lower case:
 * "directive Ajustement de la visée", "clasamentul EU", "гульцы і кланы EU".
 * Asking for it in the prompt got two thirds of them; the rest is one character
 * and no judgement, so it is done here rather than asked for again.
 *
 * Only where the language HAS case: `toUpperCase` on Chinese, Japanese or Thai
 * returns the same character, and the guard says so rather than assuming.
 */
function capitalizeLeadingWord(source: string, value: string): string {
  // The English leads with the placeholder and the translation no longer does:
  // the name has moved and a word of the language is now first. Anything else is
  // left alone, and that is what keeps the rule safe. Searching for the first
  // letter anywhere instead capitalises inside `{player}` (renaming the
  // placeholder) and mid-sentence after a number ("31 Batailles").
  if (!/^\{\w+\}/.test(source)) return value;
  const first = value[0];
  if (!first || !/\p{L}/u.test(first)) return value;
  const upper = first.toUpperCase();
  if (upper === first) return value;
  return upper + value.slice(1);
}

/**
 * Everything a translation must carry through unchanged: its `{placeholders}`
 * and its markup tags.
 *
 * The two were checked apart, which meant only half was enforced: the retry
 * asked for placeholders and nothing looked at tags, so a Serbian heading came
 * back with its `<accent>` pair stripped and was written as-is, failing the
 * locale suite on a key nothing would retranslate. They are one class of thing
 * (a token the sentence carries but does not own), so they are checked as one.
 *
 * The placeholder pattern is deliberately `[^{}]*` rather than `\w+`: `\w` is
 * ASCII, so a Belarusian answer carrying an INVENTED `{сервер}` matched nothing
 * and read as "no placeholders here", which is exactly the case this exists to
 * catch. It has to see every brace a reader would see, not only the ones we
 * would have written.
 */
function markers(value: string): Set<string> {
  return new Set([
    ...placeholdersIn(value),
    ...(value.match(/<\/?[a-zA-Z][^>]*>/g) ?? []),
  ]);
}

/**
 * The placeholders a message depends on, ICU arguments included.
 *
 * An innermost-brace match reads `{count, plural, one {# battle} other {#
 * battles}}` as its two BRANCH CONTENTS, and the French answer as its own two,
 * so every pluralised string would come back looking broken: the repair loop
 * would re-ask for it three times and then drop it. The argument name is what
 * has to survive; the branches are prose, and a language may have three where
 * English has two.
 */
function placeholdersIn(value: string): string[] {
  const out: string[] = [];

  const closing = (input: string, open: number): number => {
    let depth = 0;
    for (let i = open; i < input.length; i++) {
      if (input[i] === "{") depth++;
      else if (input[i] === "}" && --depth === 0) return i;
    }
    return -1;
  };

  const walk = (input: string) => {
    let cursor = 0;
    while (cursor < input.length) {
      const open = input.indexOf("{", cursor);
      if (open === -1) return;
      const close = closing(input, open);
      if (close === -1) return;

      const body = input.slice(open + 1, close);
      const first = body.indexOf(",");
      const second = first === -1 ? -1 : body.indexOf(",", first + 1);
      const keyword =
        second === -1 ? undefined : body.slice(first + 1, second).trim();

      if (keyword === "plural" || keyword === "select") {
        out.push(`{${body.slice(0, first).trim()}}`);
        let scan = second + 1;
        while (scan < body.length) {
          const branchOpen = body.indexOf("{", scan);
          if (branchOpen === -1) break;
          const branchClose = closing(body, branchOpen);
          if (branchClose === -1) break;
          walk(body.slice(branchOpen + 1, branchClose));
          scan = branchClose + 1;
        }
      } else {
        out.push(`{${body.trim()}}`);
      }

      cursor = close + 1;
    }
  };

  walk(value);
  return out;
}

async function translate(
  entries: Record<string, string>,
  locale: Locale,
  namespace: string,
  model = MODEL,
): Promise<Record<string, string>> {
  const answer = await ask(entries, locale, namespace, "", model);
  for (const [key, value] of Object.entries(answer)) {
    const source = entries[key];
    if (!source) continue;
    // Trimmed before anything reads it. An answer came back as " Riferimento
    // storico di {tank}", and a leading space in a heading is invisible in the
    // file, survives every check that looks at the words, and indents the
    // rendered title by a space nobody can explain.
    answer[key] = capitalizeLeadingWord(source, value.trim());
  }
  const same = (key: string): boolean => {
    const source = entries[key];
    const value = answer[key];
    if (source === undefined || value === undefined) return false;
    if (shouts(value, source)) return false;
    const want = [...markers(source)].sort().join(",");
    return want === [...markers(value)].sort().join(",");
  };
  // A key the answer never mentioned counts as broken too.
  //
  // Only the keys it DID return were checked, so a model that simply omitted
  // one left it missing with nothing to retry and no error: `hu` and `no` both
  // dropped the same 80-character sentence on four consecutive runs, and the
  // locale suite reported it as an incomplete tree rather than as a request
  // that had never been answered.
  //
  // Asked again up to `RETRIES` times rather than once, because a single retry
  // is only a coin flip against a model that omitted the key for a reason of
  // its own: Hungarian dropped the same string on both attempts, every run.
  const outstanding = () => [
    ...new Set([
      ...Object.keys(answer).filter((key) => !same(key)),
      ...Object.keys(entries).filter((key) => answer[key] === undefined),
    ]),
  ];

  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const broken = outstanding();
    if (broken.length === 0) return answer;
    const retryEntries = Object.fromEntries(
      broken.filter((key) => entries[key] !== undefined).map((key) => [key, entries[key]]),
    );
    if (Object.keys(retryEntries).length === 0) break;
    const names = [
      ...new Set(broken.flatMap((key) => [...markers(entries[key] ?? "")])),
    ].join(" ");
    // Two different failures, and the retry has to name the right one. Told
    // only to preserve placeholders, a model handed a sentence with none
    // INVENTS them: Hungarian answered "Ellenorizd a {nickname} es a regio"
    // for a string carrying no brace at all, on every attempt, because the
    // whole prompt is placeholder rules and none of them said "there are
    // none here".
    const rule = names
      ? ` Every one of ${names} must appear in its translation exactly as written, spelled in English, braces and angle brackets included: move them where the language needs them, never rename or remove one, and keep an opening tag paired with its closing tag around the words it marks.`
      : " None of these strings contains a placeholder or a tag, so your translation must contain no braces and no angle brackets at all. Translate every word, including the ones that name a thing.";
    // A shouted answer is a different failure from a lost placeholder, and the
    // model fixes only the one it is told about: asked to preserve placeholders,
    // it returned "GRANDE FINALE" again, correctly.
    const shouted = broken.some(
      (key) => answer[key] !== undefined && shouts(answer[key], entries[key] ?? ""),
    );
    const caseRule = shouted
      ? " At least one of your previous answers was written in ALL CAPITALS where the English is not. Capitalisation is the interface's job: write the words in your language's normal sentence case."
      : "";
    const retry = await ask(
      retryEntries,
      locale,
      namespace,
      `\n\nThe previous answer left these out, or changed a placeholder or a tag in them. Answer with EVERY key below, one translation each.${rule}${caseRule}`,
      model,
    );
    for (const key of broken) {
      const value = retry[key];
      if (value === undefined) continue;
      const source = entries[key] ?? "";
      if (shouts(value, source)) continue;
      const want = [...markers(source)].sort().join(",");
      if ([...markers(value)].sort().join(",") === want) answer[key] = value;
    }
  }
  // Whatever never survived is dropped rather than written: a missing key falls
  // back to English, which reads as untranslated, while a broken one reads as
  // broken and is caught only by the suite, long after it shipped.
  //
  // Named in the log, because dropping in silence is how a handful of keys sat
  // missing across four runs with nothing to point at: the completeness test
  // said the tree was incomplete, and no line anywhere said the request had
  // been answered and refused.
  for (const key of outstanding()) {
    const value = answer[key];
    const reason =
      value === undefined
        ? "never answered"
        : shouts(value, entries[key] ?? "")
          ? "answered in capitals"
          : "lost a placeholder or a tag";
    console.warn(
      `[translate] ${locale}/${namespace}: dropped ${key} (${reason})${value === undefined ? "" : ` -> ${JSON.stringify(value)}`}`,
    );
    delete answer[key];
  }
  return answer;
}

type Job = { namespace: string; locale: Locale };

/**
 * How many strings ride in one request.
 *
 * This used to be one request per (namespace, locale), which sounds tidy and
 * was the single most expensive decision in the script: 307 namespaces average
 * 7.9 keys each, and every request carried ~750 tokens of instructions, so two
 * days of work bought 60,806 copies of the same instructions at 537 tokens
 * apiece. The strings being translated were the rounding error.
 *
 * Grouped, the same pass is 5.6x less input for identical output. And it reads
 * BETTER rather than worse: each entry's key carries its namespace, so the
 * model is told where every individual string lives instead of once per file.
 */
/**
 * How many keys one request carries.
 *
 * Two hundred was chosen for cost, and it earned that: grouping took a full
 * tree from 9.41M input tokens to 1.67M, because the instructions alone are
 * 750 tokens and paying them once per key is most of the bill.
 *
 * Fifty is what a request can actually ANSWER. A batch is only as fast as the
 * text it has to write, and a hundred and fifty keys of page prose in a script
 * that costs more tokens per character is minutes of generation: under the
 * provider's default output cap the answer came back cut off mid-array, which
 * is worse than an error because the request succeeds and the keys past the cut
 * are simply absent, and with the cap lifted it ran past the deadline instead.
 * Both are the same fact. Every Latin-script locale finished at two hundred and
 * every other one stalled one batch short, through five passes.
 *
 * The cost of the smaller batch is real but small: four times the instruction
 * overhead on a run that bills under a dollar.
 */
const BATCH_KEYS = 50;

/** How many decided terms a single request may quote. See `termBlock`. */
const TERM_BLOCK_MAX = 80;

/** One request: a set of strings from one locale, bound for one model. */
type Batch = {
  locale: Locale;
  /** Which instruction set applies; namespaces of one class travel together. */
  kind: "app" | "game";
  model: string;
  entries: Record<string, string>;
};

/** `namespace:key`, which is what the model is shown and what routes the answer
 * back to the right file. A namespace has no colon in it, so the split is
 * unambiguous. */
const addressOf = (namespace: string, key: string) => `${namespace}:${key}`;
const splitAddress = (address: string): [string, string] => {
  const at = address.indexOf(":");
  return [address.slice(0, at), address.slice(at + 1)];
};

/** What one (locale, namespace) needs, before anything is sent. */
function plan(job: Job, hashes: Record<string, string>, seeding: boolean) {
  // Wargaming publishes these itself, in every language it ships the game in,
  // and `scripts/generate-game-vocabulary` copies them down. Translating them
  // would be inventing a second name for something that already has one. For a
  // language the game is NOT published in there is no such name, so the model
  // writes those like anything else.
  if (
    isWargamingNamespace(job.namespace) &&
    WARGAMING_LANGUAGE[job.locale] !== undefined
  ) {
    return null;
  }
  const source = readJson(join(localesRoot, DEFAULT_LOCALE, `${job.namespace}.json`));
  if (!source) return null;
  const target = readJson(join(localesRoot, job.locale, `${job.namespace}.json`)) ?? {};
  const sourceFlat = flatten(source);
  const targetFlat = flatten(target);
  const missing = Object.fromEntries(
    Object.entries(sourceFlat).filter(
      ([key, value]) =>
        force ||
        isStale(key, value, targetFlat, job.namespace, hashes, seeding, job.locale),
    ),
  );
  // An identifier is copied, never asked about: it is the same string in every
  // language, so sending it to a model can only make it worse.
  const identifiers = Object.fromEntries(
    Object.entries(missing).filter(([, value]) => isIdentifier(value)),
  );
  const words = Object.entries(missing).filter(([, value]) => !isIdentifier(value));
  return { source, target, missing, identifiers, words };
}

/** Cut a locale's outstanding strings into requests. */
function batchesFor(
  locale: Locale,
  outstanding: { namespace: string; key: string; value: string }[],
): Batch[] {
  const out: Batch[] = [];
  const buckets = new Map<string, { kind: "app" | "game"; model: string; items: typeof outstanding }>();
  for (const item of outstanding) {
    const kind: "app" | "game" = item.namespace.startsWith("game/") ? "game" : "app";
    const model = isProse(item.value) ? PROSE_MODEL : MODEL;
    const id = `${kind}:${model}`;
    const bucket = buckets.get(id) ?? { kind, model, items: [] };
    bucket.items.push(item);
    buckets.set(id, bucket);
  }
  for (const { kind, model, items } of buckets.values())
    for (let i = 0; i < items.length; i += BATCH_KEYS)
      out.push({
        locale,
        kind,
        model,
        entries: Object.fromEntries(
          items
            .slice(i, i + BATCH_KEYS)
            .map((item) => [addressOf(item.namespace, item.key), item.value]),
        ),
      });
  return out;
}

async function pool<T>(items: T[], worker: (item: T) => Promise<boolean>) {
  let index = 0;
  let written = 0;
  let failed = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (index < items.length) {
        const item = items[index++];
        try {
          if (await worker(item)) written++;
        } catch (error) {
          // One namespace failing must not take the batch down: the run is
          // resumable by construction, so the next one picks up what is missing.
          // Counted, though: a run where everything failed used to write nothing
          // and then report "up to date", which is the same line a run with
          // nothing to do prints. An exhausted API quota therefore read as
          // success, and only the locale suite afterwards said otherwise.
          console.error(`[translate] failed:`, error);
          failed++;
        }
      }
    }),
  );
  return { written, failed };
}

/**
 * What this run will cost, before it runs.
 *
 * Two days of working on the site spent $145 against a $15 budget, on 60,806
 * requests averaging 537 tokens each when the instruction block alone is ~750:
 * what was bought was sixty thousand copies of the same instructions. Nothing
 * printed a number until the invoice did, so every "just re-run it" read as
 * free.
 *
 * The estimate is deliberately rough and deliberately pessimistic. Its job is
 * to make an expensive run visible before it starts, not to be an invoice.
 */
const PRICE: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-5.6-terra": { in: 4, out: 24 },
  "gpt-5.6": { in: 4, out: 24 },
  "gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "gemini-3.1-flash-lite": { in: 0.25, out: 1.5 },
  // Marketplace rates, which is where the money is: the same models bought as
  // somebody else's unused committed capacity, through an OpenAI-compatible
  // endpoint, so only the base URL changes. Read off the seller's own listing
  // rather than the list price the model's vendor publishes, since the whole
  // point is that they differ. `gpt-5.6-luna` is the one worth knowing: it is
  // cheaper on input than every flash-tier model here and still answers from
  // the 5.6 family, which is what the prose needs.
  "gpt-5.6-luna": { in: 0.08, out: 0.48 },
  "gpt-5.6-sol": { in: 1, out: 5 },
  "glm-5.3-flash": { in: 0.1, out: 0.35 },
  "glm-5.3": { in: 0.77, out: 2.42 },
  "deepseek-v4-flash-0731": { in: 0.05, out: 0.09 },
  "deepseek-v4-flash": { in: 0.07, out: 0.14 },
};

/** Beyond this, the run stops and asks to be confirmed with `--yes`. */
const BUDGET_USD = 2;

function estimate(jobs: Job[]): {
  requests: number;
  inTokens: number;
  outTokens: number;
  usd: number;
} {
  const hashes = readHashes();
  // Mirrors `batchesFor` exactly. An estimate that models a different shape
  // than the run is worse than none: it was the absence of any number that
  // made "just re-run it" feel free.
  const perLocale = new Map<string, { kind: string; model: string; chars: number; out: number }[]>();
  for (const job of jobs) {
    // `seeding`, not `true`: hardcoding it made `isStale` return false before it
    // ever compared a hash, so the estimate counted only the keys a locale was
    // MISSING and reported zero for a run that had a rewritten English string
    // to carry. An estimate that models a different shape than the run is worse
    // than none.
    const made = plan(job, hashes, seeding);
    if (!made) continue;
    for (const [key, value] of made.words) {
      const kind = job.namespace.startsWith("game/") ? "game" : "app";
      const model = isProse(value) ? PROSE_MODEL : MODEL;
      const list = perLocale.get(job.locale) ?? [];
      list.push({
        kind,
        model,
        chars: job.namespace.length + key.length + value.length + 20,
        out: value.length,
      });
      perLocale.set(job.locale, list);
    }
  }
  let requests = 0;
  let inTokens = 0;
  let outTokens = 0;
  const byModel = new Map<string, { in: number; out: number }>();
  for (const items of perLocale.values()) {
    const buckets = new Map<string, typeof items>();
    for (const item of items) {
      const id = `${item.kind}:${item.model}`;
      buckets.set(id, [...(buckets.get(id) ?? []), item]);
    }
    for (const [id, bucket] of buckets) {
      const model = id.split(":")[1];
      const calls = Math.ceil(bucket.length / BATCH_KEYS);
      requests += calls;
      const bin = bucket.reduce((n, i) => n + i.chars, 0) / 4 + calls * 750;
      const bout = bucket.reduce((n, i) => n + i.out, 0) / 4;
      inTokens += bin;
      outTokens += bout;
      const held = byModel.get(model) ?? { in: 0, out: 0 };
      byModel.set(model, { in: held.in + bin, out: held.out + bout });
    }
  }
  let usd = 0;
  for (const [model, { in: i, out: o }] of byModel) {
    const price = PRICE[model] ?? { in: 0.15, out: 0.6 };
    usd += (i * price.in + o * price.out) / 1e6;
  }
  return { requests, inTokens, outTokens, usd };
}

async function main(): Promise<void> {
  const namespaces = namespacesIn(join(localesRoot, DEFAULT_LOCALE));
  const jobs: Job[] = targets.flatMap((locale) =>
    namespaces.map((namespace) => ({ namespace, locale })),
  );

  console.log(
    `[translate] ${namespaces.length} namespace(s) x ${targets.length} locale(s)`,
  );

  const forecast = estimate(jobs);
  console.log(
    `[translate] ${forecast.requests.toLocaleString()} request(s), ` +
      `~${(forecast.inTokens / 1e6).toFixed(2)}M in / ${(forecast.outTokens / 1e6).toFixed(2)}M out, ` +
      `~$${forecast.usd.toFixed(2)} on ${
        MODEL === PROSE_MODEL ? MODEL : `${MODEL} + ${PROSE_MODEL}`
      }`,
  );
  if (estimateOnly) return;
  if (forecast.usd > BUDGET_USD && !process.argv.includes("--yes")) {
    console.error(
      `[translate] estimated $${forecast.usd.toFixed(2)} is over the $${BUDGET_USD} guard. ` +
        `Re-run with --yes if that is what you meant, or narrow the run to one locale.`,
    );
    process.exitCode = 1;
    return;
  }
  // The recurring vocabulary first, in its own small request per language, so
  // every job below can be told what those words already are.
  const corpus = corpusTerms(namespaces);
  const whole = recurringTerms(namespaces);
  enforceableTerms = new Set(whole);
  // The whole-value terms, plus the words the corpus shows the site leaning on.
  const terms = [...new Set([...whole, ...corpus.keys()])].sort();
  termAppearances = new Map([...termCandidates(namespaces), ...corpus]);
  // Asked of a model; the rest is only ever taken from the client.
  const clientOnly = singleUseTerms(namespaces);
  if (terms.length > 0) {
    let sheets: Record<string, Record<string, string>> = {};
    try {
      sheets = JSON.parse(readFileSync(TERMS_PATH, "utf-8")) as typeof sheets;
    } catch {
      /* first run */
    }
    const sheetJobs = targets.map((locale) => async () => {
      // The client's word first, so it is neither asked for nor overridden: a
      // term the game already names is settled before the model is involved.
      const official = officialSheet(locale);
      const known = { ...(sheets[locale] ?? {}) };
      // Plus the terms our English only ever writes inside a heading, which no
      // exact match can see.
      const inLabels = termsInLabels(namespaces, official);
      for (const term of [...terms, ...clientOnly, ...inLabels]) {
        if (official[term] && !CLIENT_MISMATCH.has(term))
          known[term] = official[term];
      }
      const missing = Object.fromEntries(
        terms.filter((term) => !known[term]).map((term) => [term, term]),
      );
      if (Object.keys(missing).length > 0) {
        // Asked in slices: a terms request carries a context line per word, so
        // a big one is a big prompt, and an oversized prompt does not fail
        // loudly here, it fails as an empty sheet nobody notices.
        const names = Object.keys(missing);
        for (let i = 0; i < names.length; i += TERM_BLOCK_MAX) {
          const slice = names.slice(i, i + TERM_BLOCK_MAX);
          askedTerms = new Set(slice);
          Object.assign(
            known,
            await translate(
              Object.fromEntries(slice.map((term) => [term, term])),
              locale,
              "terms",
            ),
          );
          askedTerms = undefined;
        }
      }
      sheets[locale] = known;
      termSheets.set(locale, known);
      return true;
    });
    await pool(sheetJobs, (job) => job());
    writeFileSync(TERMS_PATH, `${JSON.stringify(sheets, null, 2)}\n`);
    console.log(
      `[translate] ${terms.length} recurring term(s) decided across ${targets.length} locale(s)`,
    );
  }

  // Everything outstanding, per locale, then cut into requests. The write is
  // deferred to the end so a file is opened once rather than once per batch
  // that happens to touch it.
  const hashesNow = readHashes();
  const held = new Map<string, { source: Json; target: Json; translated: Record<string, string> }>();
  const outstanding = new Map<Locale, { namespace: string; key: string; value: string }[]>();
  for (const job of jobs) {
    const made = plan(job, hashesNow, seeding);
    if (!made) continue;
    const id = `${job.locale}/${job.namespace}`;
    held.set(id, { source: made.source, target: made.target, translated: { ...made.identifiers } });
    if (made.words.length === 0) continue;
    const list = outstanding.get(job.locale) ?? [];
    for (const [key, value] of made.words)
      list.push({ namespace: job.namespace, key, value });
    outstanding.set(job.locale, list);
  }

  const batches = [...outstanding].flatMap(([locale, items]) => batchesFor(locale, items));
  console.log(`[translate] ${batches.length} request(s) after grouping`);

  /**
   * Put what is held for these namespaces on disk, and say how many files moved.
   *
   * Called after every request rather than once at the end, which is the
   * difference between a run that can be interrupted and one that cannot: a
   * whole tree is two hundred requests, and losing the two hundredth used to
   * throw away the other hundred and ninety-nine along with what they cost. It
   * is also the only way to watch a long run make progress, since the log line
   * comes after the work rather than instead of it.
   *
   * Safe to stop at any point: `isStale` treats a key with no recorded hash as
   * settled so long as the target holds it, and the manifest is stamped at the
   * end, so a killed run leaves written keys written and the next one picks up
   * exactly what is still missing.
   *
   * `writeFileSync` inside an already-resolved callback runs to completion
   * before any other batch is resumed, so two requests landing on one namespace
   * cannot interleave; the second simply writes the merge of both.
   */
  const flush = (ids: Iterable<string>): number => {
    let count = 0;
    for (const id of ids) {
      const entry = held.get(id);
      if (!entry) continue;
      const [locale, ...rest] = id.split("/");
      const namespace = rest.join("/");
      const targetPath = join(localesRoot, locale, `${namespace}.json`);
      const next =
        JSON.stringify(merge(entry.source, entry.target, entry.translated), null, 2) +
        "\n";
      if (existsSync(targetPath) && readFileSync(targetPath, "utf-8") === next) continue;
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, next);
      count++;
    }
    return count;
  };

  const touched = new Set<string>();
  let written = 0;
  let done = 0;
  const { failed } = await pool(batches, async (batch) => {
    const answer = batch.model === PROSE_MODEL
      ? await withProseSlot(() => translate(batch.entries, batch.locale, batch.kind, batch.model))
      : await translate(batch.entries, batch.locale, batch.kind, batch.model);
    const ids = new Set<string>();
    for (const [address, value] of Object.entries(answer)) {
      const [namespace, key] = splitAddress(address);
      const id = `${batch.locale}/${namespace}`;
      const entry = held.get(id);
      if (!entry) continue;
      entry.translated[key] = value;
      ids.add(id);
    }
    written += flush(ids);
    for (const id of ids) touched.add(id);
    done++;
    console.log(
      `[translate] ${done}/${batches.length} ${batch.locale} ${batch.kind} (${Object.keys(answer).length} key(s), ${written} file(s) so far)`,
    );
    return true;
  });

  // The identifiers and the namespaces no request touched: those are copied
  // rather than asked about, so nothing above ever reaches them.
  written += flush([...held.keys()].filter((id) => !touched.has(id)));

  // Stamp what English says NOW, so the next run can see an edit. Written from
  // the source tree rather than from what was translated, so a key nothing
  // needed this time is still recorded and a later edit to it is still caught.
  const next: Record<string, string> = {};
  for (const namespace of namespaces) {
    const source = readJson(join(localesRoot, DEFAULT_LOCALE, `${namespace}.json`));
    if (!source) continue;
    for (const [key, value] of Object.entries(flatten(source))) {
      next[`${namespace}:${key}`] = hashOf(value);
    }
  }
  writeFileSync(HASHES_PATH, `${JSON.stringify(next, null, 2)}\n`);
  if (seeding) {
    console.log(
      `[translate] seeded ${Object.keys(next).length} source hash(es); edits from here on re-translate on their own`,
    );
  }
  console.log(
    written ? `[translate] wrote ${written} file(s)` : "[translate] up to date",
  );
  // A new file is not readable until the per-locale modules import it, and those
  // are generated. Running this by hand and forgetting the regeneration leaves a
  // locale silently falling back to English for the namespace just written,
  // which is exactly how the Steel Hunter board stayed English after its strings
  // existed. `predev`/`prebuild` already chain the two; this covers the rest.
  // The generator is a top-level script, so importing it runs it. That is the
  // point: it needs the same interpreter this is running under, and spawning a
  // bare node would lose the TypeScript loader.
  if (written > 0) await import("./generate-locales");

  if (failed > 0) {
    // Non-zero so CI stops here rather than committing a half-filled tree and
    // leaving the locale suite to explain it two steps later.
    console.error(`[translate] ${failed} of ${jobs.length} job(s) failed`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[translate] failed:", error);
  process.exit(1);
});
