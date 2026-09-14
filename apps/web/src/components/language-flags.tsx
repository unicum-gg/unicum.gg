"use client";

import type { TranslateFunction } from "@onruntime/translations";
import { useTranslation } from "@/hooks/use-translation";
import { useLocale } from "@onruntime/translations/react";
import { languageDisplayName } from "@/lib/language-name";
import Image from "next/image";
import Link from "@/components/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { languageToCountryCode, LanguageSource } from "@unicum.gg/shared";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";

const FLAG_DIMENSIONS = {
  s: { width: 16, height: 12 },
  m: { width: 20, height: 15 },
  l: { width: 32, height: 24 },
} as const;

/** One string per source, because the notice has to describe the method that
 * was actually used: `Clan` is a declared set standing in for a player we hold
 * no history on, so telling that reader we weighed their clan history would be
 * plainly false. The link target is a different question and stays binary, on
 * whether the flags belong to a clan or to a player. */
const ORIGIN_KEY: Record<LanguageSource, string> = {
  [LanguageSource.Declared]: "declared",
  [LanguageSource.Inferred]: "inferred",
  [LanguageSource.Clan]: "from-clan",
};

function tooltipFor(
  code: string,
  source: LanguageSource,
  clickable: boolean,
  locale: string,
  t: TranslateFunction,
): string {
  const language = languageDisplayName(code, locale);
  const origin = t(ORIGIN_KEY[source], { language });
  if (!clickable) return origin;
  const cta = t(source === LanguageSource.Declared ? "cta-clans" : "cta-players", {
    language,
  });
  return `${origin} ${cta}`;
}

/**
 * `region` drives both the flag picking (`en` on NA → US instead of UK)
 * and the destination of each flag's link: declared (clan) flags point
 * to the clans leaderboard for that language, inferred (player) flags
 * point to the players leaderboard. Set `link={false}` when this is
 * rendered inside an outer `<a>` (the top-clans list, for instance) to
 * keep the region-aware flags but skip the nested anchor.
 *
 * `source` says why the flags are shown at all, and RGPD/transparency asks us
 * to spell that method out right where the flag is rendered, so each of the
 * three gets its own notice. Only the LINK is binary: a declared set belongs to
 * a clan and points at the clans board, the other two belong to a player. The
 * enum is shared with the public API so the same three cases are named the same
 * way there, though a value read back off `/{region}/resolve` crosses
 * HTTP as a literal and needs mapping onto the enum before it reaches this
 * prop, as every enum in this codebase does.
 */
export function LanguageFlags({
  languages,
  className,
  size = "s",
  source,
  region,
  link = true,
}: {
  languages: string[];
  className?: string;
  size?: "s" | "m" | "l";
  source: LanguageSource;
  region?: Region;
  link?: boolean;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/language-flags");
  if (languages.length === 0) return null;
  const clickable = link && region != null;
  return (
    <TooltipProvider delayDuration={100}>
      <span
        className={cn(
          "inline-flex h-full items-stretch divide-x divide-fd-border border-l border-fd-border",
          className,
        )}
      >
        {languages.map((lang) => {
          const code = languageToCountryCode(lang, region);
          const tip = tooltipFor(lang, source, clickable, locale, t);
          const visual = code ? (
            <Image
              src={`/flags/${size}/${code}.svg`}
              alt={lang}
              width={FLAG_DIMENSIONS[size].width}
              height={FLAG_DIMENSIONS[size].height}
              className="h-full w-auto"
            />
          ) : (
            <span className="text-xs font-medium uppercase">{lang}</span>
          );
          const href =
            clickable && region
              ? source === LanguageSource.Declared
                ? ROUTES.CLANS_BY_LANGUAGE(region, lang)
                : ROUTES.PLAYERS_BY_LANGUAGE(region, lang)
              : null;
          const trigger = href ? (
            <Link
              href={href}
              className="inline-flex h-full items-center transition-opacity hover:opacity-80"
              aria-label={
                source === LanguageSource.Declared
                  ? t("top-language-clans", {
                      language: languageDisplayName(lang, locale),
                    })
                  : t("top-language-players", {
                      language: languageDisplayName(lang, locale),
                    })
              }
            >
              {visual}
            </Link>
          ) : (
            visual
          );
          return (
            <Tooltip key={lang}>
              <TooltipTrigger asChild>{trigger}</TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{tip}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </span>
    </TooltipProvider>
  );
}
