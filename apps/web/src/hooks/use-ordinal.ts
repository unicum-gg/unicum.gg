"use client";

import { useLocale } from "@onruntime/translations/react";
import { useCallback } from "react";
import { ordinalForm } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";

/**
 * A placing in the reader's own language: 6th, 6e, 6º, 6.
 *
 * The tournament pages are full of them (where a team finished, where a roster
 * ranks in its field, what a clan's best run was) and every one of them was the
 * English suffix, printed under French prose. `ordinal` in `@unicum.gg/shared`
 * still writes the English one and is what the OpenGraph cards keep using,
 * since those are rendered in English by design.
 *
 * One key per CLDR ordinal form rather than one per number, with the form
 * chosen by `Intl`. A language that marks a single one leaves the others
 * unread, which is most of them: measured over the 36 we publish, `other` is
 * the only form 28 of them ever select, and `zero` is selected by none, so it
 * has no key at all.
 */
export function useOrdinal() {
  const { locale } = useLocale();
  const { t } = useTranslation("hooks/use-ordinal");
  return useCallback(
    (n: number) => t(`ordinal-${ordinalForm(locale, n)}`, { n }),
    [locale, t],
  );
}
