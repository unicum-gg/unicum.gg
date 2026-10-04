/**
 * The two mechanical rules a translation must satisfy, in one place.
 *
 * Both the writer (`generate-translations.ts`) and the checker
 * (`tests/validation/locales/quality.ts`) need them, and they must never
 * disagree: a rule the writer enforces and the test does not is unverified, and
 * a rule the test enforces and the writer does not fails every run.
 */

/** The apostrophe is one character, and it is not the one on the keyboard.
 *
 * French elides, English contracts, Turkish suffixes a symbol, and all three
 * want U+2019. The prompt asks for it and the model answers with the ASCII
 * quote often enough that a run reintroduces dozens, so it is applied rather
 * than hoped for.
 *
 * Unicode-aware on purpose: with JavaScript's ASCII `\w`, Ukrainian "м'який"
 * matched nothing and kept its straight quote through every run. */
export const typographic = (value: string): string =>
  value.replace(/(?<=[\p{L}\p{N}}€$£¥%])'/gu, "’");

/** Whether a string is written entirely in capitals, on its own terms. */
function allCaps(value: string): boolean {
  const cased = [...value].filter((c) => c.toLowerCase() !== c.toUpperCase());
  return cased.length >= 4 && cased.every((c) => c === c.toUpperCase());
}

/**
 * Whether a translation shouts where its source does not.
 *
 * The game writes some of its own headings in capitals, and a model copies the
 * habit into strings the interface styles itself: "Grand Final" came back as
 * "GRANDE FINALE" in French and "GROSSES FINALE" in German on runs where the
 * prompt had already asked it not to.
 *
 * The case cannot be repaired, only refused: lowercasing "GROSSES FINALE" gives
 * "grosses finale", and German needs "Gro\u00dfes Finale", with a letter the
 * uppercase form does not carry.
 *
 * Judged AGAINST THE SOURCE, which took two false positives to get right. A
 * script without case leaves only the Latin acronyms visible here, so Korean
 * "\uc6d0\uaca9 MCP \uc11c\ubc84 URL" is six upper-case letters and nothing else countable, and
 * both "all capitals" and "mostly capitals" read it as shouting. But those
 * letters are the source's own acronyms, copied because that is what a
 * translation of "Remote MCP server URL" does. So every run of letters the
 * source already spells that way is dropped before judging, and what remains is
 * the words the model actually chose. Nothing is left in the Korean case, and
 * twelve shouted letters are left in the French one.
 */
export function shouts(value: string, source: string): boolean {
  // A source that shouts may be shouted back. "EU / NA / ASIA" is written that
  // way on purpose, and its one translatable word has to match the two beside
  // it: flagging "EU / NA / ASIE" asked French to write the only word it could
  // change in a case the line does not use.
  if (allCaps(source)) return false;
  // Runs of CASED letters, not of letters: `\p{L}+` swallows the script around
  // them, so Chinese "VIII\u7ea7" came back as one token that the source "Tier
  // VIII" does not contain, and a Roman numeral read as shouting. Stopping at
  // the first uncased character leaves "VIII", which the source does contain.
  const runs = value.match(/[\p{Lu}\p{Ll}]+/gu) ?? [];
  const own = runs.filter((run) => !source.includes(run));
  const cased = own.join("").split("").filter((c) => c.toLowerCase() !== c.toUpperCase());
  return cased.length >= 4 && cased.every((c) => c === c.toUpperCase());
}

/**
 * Whether a namespace is one of the game's own catalogues.
 *
 * Two spellings, and the second is the one that matters. The writer batches by
 * KIND, so `translate()` is handed "game" or "app" rather than the path the
 * strings came from: a guard written as `startsWith("game/")` alone reads every
 * batched game string as prose, and the exemption it was meant to be silently
 * never fires.
 */
export function isGameNamespace(namespace: string): boolean {
  return namespace === "game" || namespace.startsWith("game/");
}

/**
 * The families of `game/vocabulary` that hold a NAME Wargaming gives something,
 * as opposed to a word describing it.
 *
 * The distinction decides what may be held against an existing translation. A
 * mode, a board and an award have one name per language and it is the game's:
 * a French player reads "Bastion" and "Offensive" on their own screen, so a
 * page that says "forteresse" or "Assaut" is not translated, it is translated
 * twice. The families left out hold ordinary words that merely happen to be
 * catalogued (`stronghold-sorts.battles` is "Battles", `vehicle-roles.support`
 * is "Support", `map-modes.standard` is "Standard"), and forcing the game's
 * rendering of those onto "Standard shell damage" or "Support us" is how a rule
 * meant to fix a handful of headings rewrites the tree.
 */
export const GAME_NAME_FAMILIES: readonly string[] = [
  "battle-types",
  "clan-modes",
  "player-modes",
  "clan-boards",
  "stronghold-tiers",
  "features",
  "mastery-badges",
];

/**
 * The catalogued names that are an ordinary English word at the same time.
 *
 * `battle-types.random` is "Random", which our prose writes for the mode
 * ("Random Battles") and for a map hazard ("Random events") alike, and only the
 * first is the game's. Nothing is lost by dropping it: the mode's full name is
 * catalogued beside it as `clan-modes.random`, and two words are unambiguous.
 */
const AMBIGUOUS_GAME_NAMES = new Set(["Random"]);

/**
 * A name the game gives something, in English and in the reader's language.
 *
 * `pattern` is built once with the name rather than inside the search below.
 * The same forty-odd names are tested against every string of every locale,
 * which is millions of matches per run, and the escaped source and the `u` flag
 * never change.
 */
export type GameName = {
  english: string;
  own: string;
  pattern: RegExp;
  /** The catalogue key's last segment, which is what a placeholder standing for
   * this name is called: `features.stronghold` is filled into `{stronghold}`. */
  token: string;
};

/** Every leaf of one `game/vocabulary` family, dotted from the family down. */
function leaves(value: unknown, prefix: string): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  );
}

/**
 * What the game calls each of its own things, in one language.
 *
 * Read from the two `game/vocabulary` files rather than from a list here, so a
 * mode Wargaming adds is covered the day its name is written. A name whose
 * English carries a placeholder is skipped: `{onslaught} Night` is built from
 * another entry and has no word of its own to hold anything to.
 *
 * ONE entry per English name, and a name the locale renders two ways is dropped
 * rather than settled on whichever family came first. Several English names sit
 * in more than one family (Skirmish is in three), which is fine while the
 * renderings agree and is a contradiction in the catalogue when they do not:
 * Belarusian calls Skirmish both "Сутычка" and "Вылазка", Hindi both "मुठभेड़"
 * and "झड़प". Enforced, that asks for a string carrying BOTH, which no
 * translation can satisfy: the key is refused, retried, refused again, and
 * reported forever. A catalogue that has not made up its mind cannot hold prose
 * to a decision, so it holds it to nothing until the file is corrected.
 */
export function gameNames(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
): GameName[] {
  const byName = new Map<string, Set<string>>();
  const byToken = new Map<string, string>();
  for (const family of GAME_NAME_FAMILIES) {
    const theirs = Object.fromEntries(leaves(target[family], family));
    for (const [path, english] of leaves(source[family], family)) {
      const own = theirs[path];
      if (english.includes("{") || english.length < 4) continue;
      if (AMBIGUOUS_GAME_NAMES.has(english)) continue;
      if (!own || own === english) continue;
      byToken.set(english, path.split(".").pop() ?? "");
      const held = byName.get(english);
      if (held) held.add(own);
      else byName.set(english, new Set([own]));
    }
  }
  const settled: GameName[] = [];
  for (const [english, renderings] of byName) {
    if (renderings.size !== 1) continue;
    const [own] = renderings;
    if (own === undefined) continue;
    settled.push({
      english,
      own,
      token: byToken.get(english) ?? "",
      pattern: new RegExp(
        `(^|[^\\p{L}\\p{N}])${english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`,
        "u",
      ),
    });
  }
  // Longest first, so a string naming "Random Battles" is judged on that rather
  // than on a shorter name it happens to contain.
  return settled.sort((a, b) => b.english.length - a.english.length);
}

/** The part of a word that survives being declined: a leading slice of it,
 * floored at four characters, which still separates one name from another
 * ("Melhoramentos" and "Melhorias" part company at the fifth letter). */
const stem = (word: string, keep: number): string =>
  word.slice(0, Math.max(4, Math.ceil(word.length * keep)));

/** The tokens of a word worth comparing: the ones long enough to have a stem. */
const tokens = (word: string): string[] =>
  word
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((part) => part.length >= 4);

/**
 * Whether a translation carries the decided term, allowing for inflection.
 *
 * Full containment is wrong the moment a language declines: the Italian noun is
 * "Potenziamento" and a heading needs "Potenziamenti", the Ukrainian
 * "Модернізація" becomes "Модернізації" in the genitive, and neither contains
 * the sheet's own form. Compared on a stem rather than on the whole word, a
 * sheet entry that never matches its own correct inflection would flag the key
 * as undecided on every run and retranslate it forever.
 *
 * EVERY token has to be there, which is right for a term sheet: those entries
 * are mined from the corpus, so a rule satisfied by one word of a phrase would
 * be satisfied by half the tree. `carriesName` below is deliberately looser,
 * for two dozen names rather than six hundred mined words.
 */
export function carriesWord(current: string, word: string): boolean {
  const text = current.toLowerCase();
  if (text.includes(word.toLowerCase())) return true;
  const words = tokens(word);
  if (words.length === 0) return false;
  return words.every((part) => text.includes(stem(part, 0.75)));
}

/**
 * Whether a translation carries the game's own name for something.
 *
 * Looser than the term rule above on both counts, and both settings were
 * measured rather than chosen. ONE token is enough, because the names that fail
 * here are adjective-plus-noun and it is the adjective that agrees: Russian
 * writes the Common Test as "Общий тест" and a sentence needs "Общего теста" or
 * "Общем тесте", where the noun survives and the adjective does not. Requiring
 * both flagged five correct Russian strings, and caught no synonym by the half
 * that failed. And the stem is three fifths rather than three quarters, because
 * a language can drop a vowel inside a word as well as change its ending:
 * Slovak's "Jazdec" is "Jazdca" in the accusative, sharing four letters with it.
 *
 * Measured across the tree at each setting: every token at three quarters
 * flagged 73 strings over 10 English keys, the longest token at three fifths 33
 * over 7, and this 28 over 2. Those two are one heading, refused in the
 * languages where a model really did reach for another word.
 *
 * A name with no token of four characters is compared whole, which is the right
 * answer rather than a gap: those are the scripts writing a name in two or
 * three characters and not inflecting it ("要塞", "赛事"), so there is no
 * ending to allow for.
 */
export function carriesName(current: string, name: string): boolean {
  const text = current.toLowerCase();
  if (text.includes(name.toLowerCase())) return true;
  const words = tokens(name);
  if (words.length === 0) return false;
  return words.some((part) => text.includes(stem(part, 0.6)));
}

/**
 * The game's own name an English string writes and its translation does not.
 *
 * The one failure no other rule here sees. `carriesUndecidedTerm` catches a
 * translation that still says the English word, which is a model that gave up;
 * this catches one that translated it perfectly well into a word the game does
 * not use, which is a model that tried. "Stronghold boosts" came back as
 * "Boosts de forteresse" beside a stats table headed "Bastion", "Onslaught
 * Champion" as "Champion de l'Assaut" beside a board headed "Offensive", and
 * neither is visible in review: both read as French, and only a player knows
 * their own game says otherwise.
 *
 * Matched CASE-SENSITIVELY on the English, which is the same safeguard the term
 * block uses and for the same reason: a catalogued name is written the way the
 * game writes it, and its lowercase spelling mid-sentence is the ordinary word
 * we did not name. Placeholder contents are dropped first, since the word
 * inside `{tank}` is the developer's rather than the reader's.
 */
export function missingGameName(
  source: string,
  current: string,
  names: readonly GameName[],
): GameName | undefined {
  const bare = source.replace(/\{[^{}]*\}/g, " ");
  return names.find(
    (name) => name.pattern.test(bare) && !carriesName(current, name.own),
  );
}

/**
 * The placeholders a component fills from the game's own catalogue.
 *
 * Read from the call sites rather than from the placeholder's name, and that
 * distinction is the whole check. A placeholder called `{stronghold}` is filled
 * with `features.stronghold` and holds a NAME; one called `{ranked}` holds a
 * COUNT, and `player-modes.ranked` is "Ranked Battles". Matching on the name
 * alone reported twenty-four perfectly good sentences ("{season} ended here,
 * with {ranked} ranked") against six real ones, so what a component actually
 * passes is what decides it.
 *
 * The shape is the one the codebase writes: `t("key", { stronghold:
 * tGame("features.stronghold") })`. A call spelled some other way is simply not
 * covered, which errs towards saying nothing rather than towards reporting a
 * sentence nobody wrote wrong.
 */
export function catalogueFilledPlaceholders(sources: Iterable<string>): Set<string> {
  const families = GAME_NAME_FAMILIES.join("|");
  const call = new RegExp(
    `(\\w+)\\s*:\\s*t[A-Za-z]*\\(\\s*["'\`](?:${families})\\.`,
    "g",
  );
  const found = new Set<string>();
  for (const source of sources)
    for (const [, name] of source.matchAll(call)) if (name) found.add(name);
  return found;
}

/**
 * The game's own name a translation spells out beside the placeholder that
 * already supplies it.
 *
 * The cost of composing a heading from the catalogue rather than translating
 * it, and it is invisible to every other check here: the placeholder survives,
 * so `holes` passes, and the name is present, so the rule above passes. What a
 * reader gets is the word twice. Ukrainian answered "Посилення укріпрайону
 * {stronghold}" and Polish "Wzmocnienia dla Twierdzy {stronghold}", which
 * render as "Посилення укріпрайону Укріпрайон" and "Wzmocnienia dla Twierdzy
 * Twierdza", while the other thirty-three built the sentence around the hole
 * the way they were asked to.
 *
 * `filled` is the set of placeholders a component really does fill from the
 * catalogue, from `catalogueFilledPlaceholders`. Its own braces are removed
 * from the translation before looking, or every one of these would report
 * itself.
 */
export function duplicatedGameName(
  source: string,
  current: string,
  names: readonly GameName[],
  filled: ReadonlySet<string>,
): GameName | undefined {
  if (filled.size === 0) return undefined;
  const holes = [...source.matchAll(/\{(\w+)\}/g)]
    .map(([, name]) => name)
    .filter((name): name is string => name !== undefined && filled.has(name));
  if (holes.length === 0) return undefined;
  const bare = current.replace(/\{[^{}]*\}/g, " ");
  return names.find(
    (name) => holes.includes(name.token) && carriesName(bare, name.own),
  );
}

/**
 * The scripts that write without spaces between words, where a repetition has
 * no boundary to be found at: Thai sets its own word for a badge flush against
 * the next one.
 */
const UNSPACED =
  /[\p{sc=Thai}\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Lao}\p{sc=Khmer}\p{sc=Myanmar}]/u;

/** Below this, an echo says more about chance than about the translation. */
const MIN_ECHO = 3;

/**
 * Whether a sentence spells out a word its own placeholder already supplies.
 *
 * The cost of building a heading from two keys, and it is invisible to every
 * other rule here: the placeholder survives, so `holes` passes, the key exists,
 * so `completeness` passes, and what a reader gets is the word twice. French
 * answered "Tous les badges {badge} et comment les obtenir" for "Every {badge}
 * and how to earn it", which renders as "Tous les badges badge", and five
 * languages wrote the preposition of "Top {tank} players {by} {metric}" into
 * the template as well as leaving it in the hole.
 *
 * Anchored at the START of the word and loose at its end, which is what the two
 * failures either side need: Italian's "cannone" is not an echo of "none", and
 * French's "badges" IS one of "badge". Four letters of ending is where a
 * declension stops and a different word begins ("article" is not "art").
 */
export function echoesFilledWord(sentence: string, word: string): boolean {
  if (word.length < MIN_ECHO) return false;
  const text = sentence.toLowerCase();
  const needle = word.toLowerCase();
  if (UNSPACED.test(word)) return text.includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L}{4})`, "u").test(text);
}

/**
 * The word a translation repeats, out of the holes it is handed.
 *
 * `fills` is what the component really puts in each hole, in this language.
 * Its own braces come out of the sentence first, or every one of these would
 * report itself.
 */
export function echoedFill(
  sentence: string,
  fills: Iterable<{ hole: string; word: string }>,
): { hole: string; word: string } | undefined {
  for (const fill of fills) {
    const bare = sentence.split(`{${fill.hole}}`).join(" ");
    if (echoesFilledWord(bare, fill.word)) return fill;
  }
  return undefined;
}

/**
 * The `game/vocabulary` families whose entries are the one right rendering of a
 * LABEL a reader sees on its own, rather than a name that has to survive inside
 * a sentence.
 *
 * `GAME_NAME_FAMILIES` above decides what prose is held to; this decides what
 * prose is not allowed to hold at all. The two overlap because a mode's name is
 * both, and `marks` is here and not there for the same reason it is a label:
 * "2 Marks" is what a row in the marks panel says, and no sentence on the site
 * writes it mid-flow, so holding prose to it would buy nothing and would push
 * the catalogue's English into languages that have a word of their own.
 */
export const CATALOGUED_LABEL_FAMILIES: readonly string[] = [
  ...GAME_NAME_FAMILIES,
  "marks",
];

/**
 * The catalogued names a stat label can be, by the key `statLabel` slugs them
 * to.
 *
 * Built from the English `game/vocabulary` rather than listed here, so a name
 * Wargaming adds is covered the day it is catalogued. A name carrying a
 * placeholder is skipped for the same reason `gameNames` skips it: it is built
 * from another entry and is nobody's label on its own.
 *
 * The names that are also an ordinary English word are dropped here for the
 * same reason `gameNames` drops them: "Random" is a mode and an adjective, and
 * a column headed "Random" is not necessarily the mode.
 *
 * ONE key per slug, and the first family wins. Several families catalogue the
 * same English name ("Stronghold" is in two, "Skirmish" in three), and where
 * they hold the same word the rest are simply redundant. Where a LOCALE
 * disagrees with itself the first family is still what renders, which is the
 * deliberate half: the index is built from the English catalogue and is shared
 * by all thirty-six, so dropping a name here would drop it for the
 * thirty-four that agree too, and a reader is better served by one of the two
 * words than by English. `gameNames` and `cataloguedNames` drop it for their
 * own purposes (holding prose to a word nothing can satisfy, and writing one
 * into a file), and the suite's "names one thing once" check reports the
 * contradiction so the catalogue gets settled rather than silently picked.
 */
export function cataloguedLabelKeys(
  source: Record<string, unknown>,
  slug: (label: string) => string,
): Map<string, string> {
  const keys = new Map<string, string>();
  for (const family of CATALOGUED_LABEL_FAMILIES)
    for (const [path, english] of leaves(source[family], family)) {
      if (english.includes("{")) continue;
      if (AMBIGUOUS_GAME_NAMES.has(english)) continue;
      const key = slug(english);
      if (key && !keys.has(key)) keys.set(key, path);
    }
  return keys;
}

/**
 * What the game calls each of its own things, by the English name, including
 * the languages that keep the English word.
 *
 * `gameNames` above answers a different question: it holds a SENTENCE to the
 * name it contains, so it drops a name the locale renders exactly as English
 * (there is nothing to check) and builds a pattern to find it mid-flow. This is
 * for a string that is nothing but the name, where the answer is simply the
 * catalogue's own word and "the same as English" is an answer like any other:
 * the Norwegian client really does say "Marks of Excellence".
 *
 * A name the locale renders two ways is dropped here for the same reason it is
 * dropped there, and `vocabulary.ts` reports it rather than leaving it silent.
 */
export function cataloguedNames(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
): Map<string, string> {
  const renderings = new Map<string, Set<string>>();
  for (const family of CATALOGUED_LABEL_FAMILIES) {
    const theirs = Object.fromEntries(leaves(target[family], family));
    for (const [path, english] of leaves(source[family], family)) {
      const own = theirs[path];
      if (english.includes("{") || AMBIGUOUS_GAME_NAMES.has(english)) continue;
      if (!own) continue;
      const held = renderings.get(english);
      if (held) held.add(own);
      else renderings.set(english, new Set([own]));
    }
  }
  const settled = new Map<string, string>();
  for (const [english, held] of renderings) {
    const [own] = held;
    if (held.size === 1 && own !== undefined) settled.set(english, own);
  }
  return settled;
}

/**
 * The game's own word for a string that is nothing but one of its names.
 *
 * The failure this closes is the one that shipped: "3 marks" is the whole of a
 * row in the marks panel, so a model reading it under a prose prompt has
 * nothing around it to say these are the marks on a gun, and answered with a
 * score. French read "3 points" beside a panel its own catalogue heads
 * "Marques d'excellence", German "3 Punkte", Turkish "3 puan". The catalogue
 * already held the right answer in every language, two files away.
 *
 * So a key whose English IS a catalogued name is filled from the catalogue and
 * never sent to a model: there is exactly one right answer, it is written down,
 * and asking for it again can only produce a second one. Matched exactly rather
 * than loosely, case included, which is the same line `missingGameName` draws:
 * "Random Battles" is the mode and "Random battles" is a phrase we wrote.
 */
export function cataloguedCopy(
  source: string,
  names: Map<string, string>,
): string | undefined {
  return names.get(source.trim());
}
