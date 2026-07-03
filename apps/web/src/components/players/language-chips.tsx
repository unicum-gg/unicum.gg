import Image from "next/image";
import Link from "next/link";
import ROUTES from "@/constants/routes";
import { languageToCountryCode } from "@/lib/language-flags";
import { cn } from "@/lib/utils";
import type { Region } from "@/services/wargaming/wot";

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function displayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

export type PlayerLanguageChip = {
  code: string;
  playersCount: number;
};

/**
 * Horizontal row of clickable language pills shown above the top-players
 * list. Mirror of `@/components/clans/language-chips` but pointing at
 * `ROUTES.PLAYERS` instead. Strict suffix persists across switches.
 */
export function PlayerLanguageChips({
  available,
  active,
  region,
  strict = false,
  className,
}: {
  available: PlayerLanguageChip[];
  active: string | null;
  region: Region;
  strict?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 px-4 py-3",
        className,
      )}
    >
      <ChipLink
        href={ROUTES.PLAYERS(region)}
        active={active === null}
        label="All"
      />
      {available.map((lang) => {
        const code = languageToCountryCode(lang.code, region);
        return (
          <ChipLink
            key={lang.code}
            href={ROUTES.PLAYERS_BY_LANGUAGE(region, lang.code, strict)}
            active={active === lang.code}
            label={displayName(lang.code)}
            count={lang.playersCount}
            flagCode={code}
          />
        );
      })}
    </div>
  );
}

function ChipLink({
  href,
  active,
  label,
  count,
  flagCode,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
  flagCode?: string | null;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "border-[#f25322] bg-[#f25322]/15 text-fd-foreground"
          : "border-fd-border bg-fd-card text-fd-muted-foreground hover:border-fd-foreground/40 hover:text-fd-foreground",
      )}
    >
      {flagCode && (
        <Image
          src={`/flags/s/${flagCode}.svg`}
          alt=""
          width={16}
          height={12}
          className="h-3 w-auto"
        />
      )}
      <span>{label}</span>
      {count != null && (
        <span className="text-fd-muted-foreground/70">{count}</span>
      )}
    </Link>
  );
}
