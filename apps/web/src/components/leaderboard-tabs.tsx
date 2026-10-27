import { SegmentedControl } from "@/components/segmented-control";
import ROUTES from "@/constants/routes";
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
    <SegmentedControl
      active={current}
      segments={[
        { id: "players", label: t("players"), href: playersHref },
        { id: "clans", label: t("clans"), href: clansHref },
      ]}
    />
  );
}
