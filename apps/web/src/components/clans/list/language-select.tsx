"use client";

import { numberFormat } from "@/lib/format";

import { useLocale } from "@onruntime/translations/react";
import { languageDisplayName } from "@/lib/language-name";
import Image from "next/image";
import { useRouter } from "@/hooks/use-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ROUTES from "@/constants/routes";
import { languageToCountryCode } from "@/lib/language-flags";
import type { Region } from "@unicum.gg/wargaming";
import { useTranslation } from "@/hooks/use-translation";

export type ClanLanguageOption = {
  code: string;
  clansCount: number;
};

const ALL = "all";

/**
 * Compact language picker for the top-clans board: a single select that
 * navigates to the chosen language leaderboard (or back to the all-languages
 * landing). Mirror of the players board's language select; the `strict` suffix
 * is preserved across switches.
 */
export function ClanLanguageSelect({
  available,
  active,
  region,
  strict = false,
}: {
  available: ClanLanguageOption[];
  active: string | null;
  region: Region;
  strict?: boolean;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/clans/list/view");
  const router = useRouter();
  const onChange = (value: string) => {
    router.push(
      value === ALL
        ? ROUTES.CLANS(region)
        : ROUTES.CLANS_BY_LANGUAGE(region, value, strict),
    );
  };
  return (
    <Select value={active ?? ALL} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="h-8 w-48 bg-transparent text-xs dark:bg-transparent"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("all-languages")}</SelectItem>
        {available.map((lang) => {
          const flag = languageToCountryCode(lang.code, region);
          return (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="flex items-center gap-2">
                {flag && (
                  <Image
                    src={`/flags/s/${flag}.svg`}
                    alt=""
                    width={16}
                    height={12}
                    className="h-3 w-auto"
                  />
                )}
                <span>{languageDisplayName(lang.code, locale)}</span>
                <span className="text-fd-muted-foreground/70 tabular-nums">
                  {numberFormat(locale).format(lang.clansCount)}
                </span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
