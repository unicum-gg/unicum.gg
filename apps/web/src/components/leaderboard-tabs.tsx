import Link from "next/link";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { Region } from "@/services/wargaming/wot";

/**
 * Cross-link between `/clans` and `/players`. Same language and strict
 * mode carry over so a user browsing top French clans can swap to top
 * French players in one click. Mirrors the visual model of the
 * Any/Strict toggle so the page has a consistent two-segmented switch
 * pattern instead of two different switcher designs.
 */
export function LeaderboardTabs({
  current,
  region,
  language,
  strict,
}: {
  current: "clans" | "players";
  region: Region;
  language: string | null;
  strict: boolean;
}) {
  const clansHref = language
    ? ROUTES.CLANS_BY_LANGUAGE(region, language, strict)
    : ROUTES.CLANS(region);
  const playersHref = language
    ? ROUTES.PLAYERS_BY_LANGUAGE(region, language, strict)
    : ROUTES.PLAYERS(region);
  return (
    <div className="inline-flex items-center rounded-md border border-fd-border bg-fd-card p-0.5 text-xs font-medium">
      <Segment
        href={playersHref}
        active={current === "players"}
        label="Players"
      />
      <Segment href={clansHref} active={current === "clans"} label="Clans" />
    </div>
  );
}

function Segment({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
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
    </Link>
  );
}
