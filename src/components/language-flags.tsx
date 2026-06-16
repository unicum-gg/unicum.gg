"use client";

import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ROUTES from "@/constants/routes";
import { languageToCountryCode } from "@/lib/language-flags";
import { cn } from "@/lib/utils";
import type { Region } from "@/services/wargaming/wot";

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

const FLAG_DIMENSIONS = {
  s: { width: 16, height: 12 },
  m: { width: 20, height: 15 },
  l: { width: 32, height: 24 },
} as const;

function displayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

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
): string {
  const name = displayName(code);
  const origin =
    source === "declared"
      ? `${name}. Picked by the clan.`
      : `${name}. Our guess from this player's clan history. The longer they stay in a clan, the more its languages count.`;
  if (!clickable) return origin;
  const cta =
    source === "declared"
      ? `Click to see top ${name} clans.`
      : `Click to see top ${name} players.`;
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
          const tip = tooltipFor(lang, source, clickable);
          const visual = code ? (
            <img
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
                  ? `Top ${displayName(lang)} clans`
                  : `Top ${displayName(lang)} players`
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
