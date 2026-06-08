"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { languageToCountryCode } from "@/lib/language-flags";
import { cn } from "@/lib/utils";

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

function tooltipFor(code: string, source: LanguageSource): string {
  const name = displayName(code);
  if (source === "declared") {
    return `${name}. Picked by the clan.`;
  }
  return `${name}. Our guess from this player's clan history. The longer they stay in a clan, the more its languages count.`;
}

export function LanguageFlags({
  languages,
  className,
  size = "s",
  source,
}: {
  languages: string[];
  className?: string;
  size?: "s" | "m" | "l";
  source: LanguageSource;
}) {
  if (languages.length === 0) return null;
  return (
    <TooltipProvider delayDuration={100}>
      <span
        className={cn(
          "inline-flex h-full items-stretch divide-x divide-fd-border border-l border-fd-border",
          className,
        )}
      >
        {languages.map((lang) => {
          const code = languageToCountryCode(lang);
          const tip = tooltipFor(lang, source);
          if (!code) {
            return (
              <Tooltip key={lang}>
                <TooltipTrigger asChild>
                  <span className="text-xs font-medium uppercase">{lang}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{tip}</p>
                </TooltipContent>
              </Tooltip>
            );
          }
          return (
            <Tooltip key={lang}>
              <TooltipTrigger asChild>
                <img
                  src={`/flags/${size}/${code}.svg`}
                  alt={lang}
                  width={FLAG_DIMENSIONS[size].width}
                  height={FLAG_DIMENSIONS[size].height}
                  className="h-full w-auto"
                />
              </TooltipTrigger>
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
