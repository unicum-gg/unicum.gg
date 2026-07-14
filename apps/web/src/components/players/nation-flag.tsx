import Image from "next/image";
import { Region, nationFilterFlagUrl, nationWavingFlagUrl } from "@unicum.gg/wargaming";
import { cn } from "@/lib/utils";

// Natural size of every filter-<nation>.png on WG CDN.
const NATURAL_W = 29;
const NATURAL_H = 18;

// Only the labels a plain capitalize gets wrong: acronyms, and Czechoslovakia
// (its code is `czech`). Everything else (germany -> "Germany", …) and any new
// WoT nation falls through to the capitalize in `nationLabel`, so this stays a
// tiny exceptions list, never an allowlist.
export const NATION_LABEL: Record<string, string> = {
  ussr: "USSR",
  usa: "USA",
  uk: "UK",
  czech: "Czechoslovakia",
};

export function nationLabel(nation: string): string {
  return (
    NATION_LABEL[nation] ??
    (nation ? nation.charAt(0).toUpperCase() + nation.slice(1) : "")
  );
}

export function NationFlag({
  nation,
  region,
  className,
  variant = "filter",
}: {
  nation: string;
  region: Region;
  className?: string;
  // `filter` = the flat 29x18 strip used in dense tables; `flag` = the larger
  // waving emblem used on the tank detail hero.
  variant?: "filter" | "flag";
}) {
  if (!nation) return null;
  if (variant === "flag") {
    // The waving-flag emblem WG's tankopedia detail page shows next to the
    // vehicle name. Sizes differ per nation, so we let CSS drive the height and
    // keep the aspect ratio (next/image's `width={0} height={0}` responsive mode).
    return (
      <Image
        src={nationWavingFlagUrl(region, nation)}
        alt={nationLabel(nation)}
        title={nationLabel(nation)}
        width={0}
        height={0}
        sizes="32px"
        className={cn("inline-block h-4 w-auto align-middle", className)}
      />
    );
  }
  return (
    <Image
      src={nationFilterFlagUrl(region, nation)}
      alt={nationLabel(nation)}
      title={nationLabel(nation)}
      width={NATURAL_W}
      height={NATURAL_H}
      className={cn("inline-block h-4 w-auto align-middle", className)}
    />
  );
}
