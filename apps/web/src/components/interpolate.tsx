import { Fragment, type ReactNode } from "react";

/**
 * A translated sentence with React nodes dropped into its placeholders.
 *
 * `t` returns a string, which is all a sentence made of words needs. A sentence
 * that carries a control or a link inside it (the home's "Ranked by <metric
 * picker> over the past 24 hours") cannot be one, and splitting it into a before
 * and an after would fix the word order in English: the picker sits at the end
 * of the sentence in half the languages we publish. So the placeholder stays in
 * the string, where a translator can move it, and this substitutes the node.
 *
 * ```tsx
 * <Interpolate
 *   template={t("description")}
 *   values={{ metric: <RatingMetricInlineSelect /> }}
 * />
 * ```
 *
 * `wrap` is the other half: a tag pair around words that stay INSIDE the
 * sentence, which a placeholder cannot express. A page heading colours one of
 * its own words ("All **tanks**"), and holding that word in a second key made
 * the two disagree: the model translated "All {accent}" and "tanks" apart, and
 * French came back "Toutes les" + "chars", which does not agree, and "Char" +
 * "des chars", which means nothing. One sentence with the emphasis marked in it
 * translates as a sentence, and the tag moves with the words it belongs to.
 *
 * ```tsx
 * // "All <accent>tanks</accent>" -> "Tous les <accent>chars</accent>"
 * <Interpolate
 *   template={t("heading")}
 *   wrap={{ accent: (text) => <span className="text-brand">{text}</span> }}
 * />
 * ```
 */
export function Interpolate({
  template,
  values,
  wrap,
}: {
  template: string;
  values?: Record<string, ReactNode>;
  wrap?: Record<string, (text: string) => ReactNode>;
}) {
  const tags = Object.keys(wrap ?? {});
  const parts = tags.length
    ? template.split(new RegExp(`(<(?:${tags.join("|")})>.*?</(?:${tags.join("|")})>)`, "g"))
    : [template];
  return (
    <>
      {parts.map((chunk, chunkIndex) => {
        const tagged = /^<(\w+)>([\s\S]*?)<\/\1>$/.exec(chunk);
        if (tagged && wrap?.[tagged[1]]) {
          return (
            <Fragment key={chunkIndex}>{wrap[tagged[1]](tagged[2])}</Fragment>
          );
        }
        return chunk.split(/(\{\w+\})/g).map((part, index) => {
          const name = /^\{(\w+)\}$/.exec(part)?.[1];
          return name && values && name in values ? (
            <Fragment key={`${chunkIndex}-${index}`}>{values[name]}</Fragment>
          ) : (
            <Fragment key={`${chunkIndex}-${index}`}>{part}</Fragment>
          );
        });
      })}
    </>
  );
}
