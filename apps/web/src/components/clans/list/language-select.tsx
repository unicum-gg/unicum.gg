"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
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

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function displayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

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
        <SelectItem value={ALL}>All languages</SelectItem>
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
                <span>{displayName(lang.code)}</span>
                <span className="text-fd-muted-foreground/70 tabular-nums">
                  {lang.clansCount.toLocaleString("en-US")}
                </span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
