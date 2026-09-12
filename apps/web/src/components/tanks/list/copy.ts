import type { TranslateFunction } from "@onruntime/translations";
import { TankTab } from "@/components/tanks/list/tabs";

// Per-tab wording for the tank index. Each tab is its own indexable URL, so it
// gets its own heading, on-page intro, title and description rather than five
// copies of the same one.
//
// Pure and framework-free so both sides can use it: the server page (for
// `generateMetadata`) and the client view, which re-renders the heading when the
// user switches tab without a server round-trip. Keeping one source means the
// `<h1>` and the `<title>` can never describe different tabs.
//
// The words themselves live in `components/tanks/list/copy`, keyed by the tab's
// own segment, so the same function serves all 27 languages and the two callers
// still cannot describe different tabs.

/** `heading` is ONE sentence with its brand-coloured half marked in place
 * (`All <accent>tanks</accent>`), not two strings. Split in two it was
 * translated word by word and French read "Toutes les" + "chars", which does
 * not agree, and "Char" + "des chars", which means nothing. A sentence
 * translates as a sentence, and the emphasis moves with the words it belongs to.
 *
 * `intro` takes the formatted vehicle count. */
export type TankTabCopy = {
  heading: string;
  intro: (count: string) => string;
  title: string;
  description: string;
};

export function tankTabCopy(
  tab: TankTab,
  regionLabel: string,
  t: TranslateFunction,
): TankTabCopy {
  // Anything that is not a known tab reads as the default one, which is the
  // bare `/tanks` path.
  const key = Object.values(TankTab).includes(tab) ? tab : TankTab.Performances;
  return {
    heading: t(`${key}.heading`),
    intro: (count) => t(`${key}.intro`, { count, region: regionLabel }),
    title: t(`${key}.title`, { region: regionLabel }),
    description: t(`${key}.description`, { region: regionLabel }),
  };
}
