"use client";

import { useLocale } from "@onruntime/translations/react";
import { usePathname as useRawPathname } from "next/navigation";
import { useRouter } from "next/navigation";
import STORAGE from "@/constants/storage";
import { useTranslation } from "@/hooks/use-translation";
import {
  isLocale,
  LOCALE_LABEL,
  LOCALES,
  localizePath,
  type Locale,
} from "@/lib/translations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The interface language, beside the region and rating pickers.
 *
 * The pathname it reads is the raw one, prefix included, because the page it
 * moves the reader to is the same page in another language: that is the one
 * place in the app where the prefix is the subject rather than noise.
 */
export function LocaleSelector() {
  const pathname = useRawPathname();
  const router = useRouter();
  const { locale } = useLocale();
  const { t } = useTranslation("components/locale-selector");

  function selectLocale(next: Locale) {
    // Written on the choice, never by the proxy: opening a shared link in
    // another language must not change the reader's own default, the same rule
    // the region cookie follows.
    const secure = window.location.protocol === "https:" ? ";Secure" : "";
    document.cookie = `${STORAGE.COOKIES.LOCALE}=${next};path=/;max-age=31536000;SameSite=Lax${secure}`;
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.push(`${localizePath(pathname, next)}${search}`);
  }

  return (
    <Select
      value={locale}
      onValueChange={(value) => {
        if (!isLocale(value)) return;
        selectLocale(value);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("label")}
        className="h-8 w-fit gap-1.5 rounded-full border-fd-border bg-fd-secondary/50 px-2.5 text-xs font-medium uppercase"
      >
        <SelectValue>{locale}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {LOCALES.map((code) => (
          <SelectItem key={code} value={code}>
            <span className="inline-flex items-center gap-2">
              <span className="w-6 shrink-0 text-xs uppercase text-fd-muted-foreground">
                {code}
              </span>
              {LOCALE_LABEL[code]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
