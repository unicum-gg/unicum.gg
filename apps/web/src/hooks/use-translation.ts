"use client";

import { useTranslation as useTranslationCore } from "@onruntime/translations/react";
import type { Namespace } from "@/locales/generated";

/**
 * The client half of the translation API, with the namespace typed.
 *
 * `Namespace` is generated from the English files, so a namespace that does not
 * exist is a compile error rather than a page rendering its own keys at a
 * reader. The server half is `getTranslation` in `lib/translations.server`.
 */
export function useTranslation(namespace: Namespace) {
  return useTranslationCore(namespace);
}
