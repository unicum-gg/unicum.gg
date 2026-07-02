import Image from "next/image";
import { cn } from "@/lib/utils";

// WG CDN path; the version chunk drifts when WG ships a new client. If our
// flag <img> 404s after a WG release, bump `WG_STATIC_VERSION`.
const WG_STATIC_VERSION = "6.15.1_aca52e";
const FLAG_BASE = `https://eu-wotp.wgcdn.co/static/${WG_STATIC_VERSION}/wotp_static/img/core/frontend/scss/common/components/icons/img`;

// Natural size of every filter-<nation>.png on WG CDN.
const NATURAL_W = 29;
const NATURAL_H = 18;

const KNOWN_NATIONS = new Set([
  "germany",
  "ussr",
  "usa",
  "china",
  "france",
  "uk",
  "japan",
  "czech",
  "sweden",
  "poland",
  "italy",
]);

function prettyNation(nation: string): string {
  if (!nation) return "";
  return nation.charAt(0).toUpperCase() + nation.slice(1);
}

export function NationFlag({
  nation,
  className,
}: {
  nation: string;
  className?: string;
}) {
  if (!nation || !KNOWN_NATIONS.has(nation)) return null;
  return (
    <Image
      src={`${FLAG_BASE}/filter-${nation}.png`}
      alt={prettyNation(nation)}
      title={prettyNation(nation)}
      width={NATURAL_W}
      height={NATURAL_H}
      className={cn("inline-block h-4 w-auto align-middle", className)}
    />
  );
}
