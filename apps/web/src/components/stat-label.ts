import type { TranslateFunction } from "@onruntime/translations";
import type { ReactNode } from "react";

/**
 * A statistic's heading, in the reader's language.
 *
 * Every table on the site names its rows the same way, and several of them use
 * that name for two jobs at once: the glossary anchors on it, and the reader
 * reads it. Those cannot both be translated, so the English stays the KEY
 * (slugged) and the display is looked up beside it, exactly as the tank
 * characteristics table does against the client's own vocabulary.
 *
 * One namespace for all of them rather than one per table, because "Damage
 * ratio" is the same words in the sessions table, the comparison grid and a
 * vehicle's record, and translating it three times is three chances to disagree.
 *
 * A label with no entry yet reads as its own English, which is what it did
 * before, rather than as a slug.
 *
 * Takes a `ReactNode` because a column's heading is not always a string: some
 * carry an icon or a formatted fragment, and those pass through untouched
 * rather than forcing every call site to narrow the type first.
 */
export function statLabel<T extends ReactNode>(
  label: T,
  t: TranslateFunction,
): T | string {
  if (typeof label !== "string" || label === "") return label;
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const name = t(key);
  return name === key ? label : name;
}
