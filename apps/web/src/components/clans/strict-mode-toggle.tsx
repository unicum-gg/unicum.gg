import Link from "next/link";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";

/**
 * "Any / Strict" segmented switch shown above the filtered top-clans list.
 * "Any" keeps the default filter (clan declared this language alongside
 * others); "Strict" narrows to clans that declared ONLY this language.
 * Counts are inlined so users see the scope difference before clicking.
 */
export function StrictModeToggle({
  region,
  language,
  strict,
  total,
  strictCount,
}: {
  region: Region;
  language: string;
  strict: boolean;
  total: number;
  strictCount: number;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-fd-border bg-fd-card p-0.5 text-xs font-medium">
      <Segment
        href={ROUTES.CLANS_BY_LANGUAGE(region, language)}
        active={!strict}
        label="Any"
        count={total}
      />
      <Segment
        href={ROUTES.CLANS_BY_LANGUAGE(region, language, true)}
        active={strict}
        label="Strict"
        count={strictCount}
      />
    </div>
  );
}

function Segment({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors",
        active
          ? "bg-[#f25322]/15 text-fd-foreground"
          : "text-fd-muted-foreground hover:text-fd-foreground",
      )}
    >
      <span>{label}</span>
      <span className="text-fd-muted-foreground/70">{count}</span>
    </Link>
  );
}
