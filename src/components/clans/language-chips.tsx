import Link from "next/link";
import ROUTES from "@/constants/routes";
import { languageToCountryCode } from "@/lib/language-flags";
import { cn } from "@/lib/utils";
import type { Region } from "@/services/wargaming/wot";

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

function displayName(code: string): string {
  return LANGUAGE_NAMES.of(code) ?? code.toUpperCase();
}

export type LanguageChip = {
  code: string;
  clansCount: number;
};

/**
 * Horizontal row of clickable language pills shown above the top-clans
 * list. The "All" pill clears the filter. Hrefs are built from ROUTES so
 * the region scope stays consistent across the site.
 */
export function LanguageChips({
  available,
  active,
  region,
  className,
}: {
  available: LanguageChip[];
  active: string | null;
  region: Region;
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
        href={ROUTES.CLANS(region)}
        active={active === null}
        label="All"
      />
      {available.map((lang) => {
        const code = languageToCountryCode(lang.code, region);
        return (
          <ChipLink
            key={lang.code}
            href={ROUTES.CLANS_BY_LANGUAGE(region, lang.code)}
            active={active === lang.code}
            label={displayName(lang.code)}
            count={lang.clansCount}
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
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "border-[#f25322] bg-[#f25322]/15 text-fd-foreground"
          : "border-fd-border bg-fd-card text-fd-muted-foreground hover:border-fd-foreground/40 hover:text-fd-foreground",
      )}
    >
      {flagCode && (
        <img
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
