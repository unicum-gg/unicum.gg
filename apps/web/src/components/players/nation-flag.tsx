import Image from "next/image";
import { cn } from "@/lib/utils";

// WG CDN path; the version chunk drifts when WG ships a new client. If our
// flag <img> 404s after a WG release, bump `WG_STATIC_VERSION`.
const WG_STATIC_VERSION = "6.15.1_aca52e";
const FLAG_BASE = `https://eu-wotp.wgcdn.co/static/${WG_STATIC_VERSION}/wotp_static/img/core/frontend/scss/common/components/icons/img`;

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

// The waving-flag emblems WG's own tankopedia detail page shows next to the
// vehicle name. Sizes differ per nation, so we let CSS drive the height and
// keep the aspect ratio (next/image's `width={0} height={0}` responsive mode).
// `latest` survives client version bumps.
const WAVING_FLAG_BASE = `https://eu-wotp.wgcdn.co/static/latest/wotp_static/img/core/frontend/scss/common/components/icons/img/flags`;

export function NationFlag({
  nation,
  className,
  variant = "filter",
}: {
  nation: string;
  className?: string;
  // `filter` = the flat 29x18 strip used in dense tables; `flag` = the larger
  // waving emblem used on the tank detail hero.
  variant?: "filter" | "flag";
}) {
  if (!nation) return null;
  if (variant === "flag") {
    return (
      <Image
        src={`${WAVING_FLAG_BASE}/${nation}_small.png`}
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
      src={`${FLAG_BASE}/filter-${nation}.png`}
      alt={nationLabel(nation)}
      title={nationLabel(nation)}
      width={NATURAL_W}
      height={NATURAL_H}
      className={cn("inline-block h-4 w-auto align-middle", className)}
    />
  );
}
