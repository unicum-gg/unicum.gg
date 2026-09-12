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
import { languageToCountryCode } from "@/lib/language-flags";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";

const FLAG_DIMENSIONS = {
  s: { width: 16, height: 12 },
  m: { width: 20, height: 15 },
  l: { width: 32, height: 24 },
} as const;

/**
 * Why the language flags are shown. The clan case is plain public data the
 * clan owner declared; the player case is an inference we run on the
 * player's clan history, so RGPD/transparency asks us to spell out the
 * method right where the flag is rendered.
 */
type LanguageSource = "declared" | "inferred";

function tooltipFor(
  code: string,
  source: LanguageSource,
  clickable: boolean,
  locale: string,
  t: TranslateFunction,
): string {
  const language = languageDisplayName(code, locale);
  const origin = t(source === "declared" ? "declared" : "inferred", {
    language,
  });
  if (!clickable) return origin;
  const cta = t(source === "declared" ? "cta-clans" : "cta-players", {
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
              ? source === "declared"
                ? ROUTES.CLANS_BY_LANGUAGE(region, lang)
                : ROUTES.PLAYERS_BY_LANGUAGE(region, lang)
              : null;
          const trigger = href ? (
            <Link
              href={href}
              className="inline-flex h-full items-center transition-opacity hover:opacity-80"
              aria-label={
                source === "declared"
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
