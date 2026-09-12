"use client";

import { useLocale } from "@onruntime/translations/react";
import { useCallback } from "react";
import { dateFormat, numberFormat } from "@/lib/format";

/**
 * The reader's own number and date formatting, for a client component.
 *
 * `num` rather than `number`, because `number` is a TypeScript type and a
 * binding of that name reads as one at every call site the compiler cannot
 * resolve: 154 call sites came back as "'number' only refers to a type".
 *
 * A server component takes its `locale` and calls `numberFormat`/`dateFormat`
 * directly; this is the same thing for the side that has a provider rather than
 * a prop. Both go through the shared cache, so a component that formats on
 * every render pays for one formatter, not one per render.
 */
export function useFormat() {
  const { locale } = useLocale();
  return {
    locale,
    num: useCallback(
      (options?: Intl.NumberFormatOptions) => numberFormat(locale, options),
      [locale],
    ),
    date: useCallback(
      (pattern: string) => dateFormat(locale, pattern),
      [locale],
    ),
  };
}
