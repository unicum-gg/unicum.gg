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
