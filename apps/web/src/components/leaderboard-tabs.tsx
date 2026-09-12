import Link from "@/components/link";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import { getTranslation } from "@/lib/translations.server";

/**
 * Cross-link between `/clans` and `/players`. Same language and strict
 * mode carry over so a user browsing top French clans can swap to top
 * French players in one click. Mirrors the visual model of the
 * Any/Strict toggle so the page has a consistent two-segmented switch
 * pattern instead of two different switcher designs.
 */
export async function LeaderboardTabs({
  current,
  region,
  language,
  strict,
  locale,
}: {
  current: "clans" | "players";
  region: Region;
  language: string | null;
  strict: boolean;
  /** The route's own segment: this renders on the server, so it has no request
   * to read the language from. */
  locale: string;
}) {
  const { t } = await getTranslation("components/leaderboard-tabs", locale);
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
        label={t("players")}
      />
      <Segment href={clansHref} active={current === "clans"} label={t("clans")} />
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
          ? "bg-brand/15 text-fd-foreground"
          : "text-fd-muted-foreground hover:text-fd-foreground",
      )}
    >
      <span>{label}</span>
    </Link>
  );
}
