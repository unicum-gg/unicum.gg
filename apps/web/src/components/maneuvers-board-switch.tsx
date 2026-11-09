import { SegmentedControl } from "@/components/segmented-control";
import ROUTES from "@/constants/routes";
import { getTranslation } from "@/lib/translations.server";
import type { Region } from "@unicum.gg/wargaming";

/**
 * The player/clan switch for the Maneuvers boards: the same two-segment
 * control `/players` and `/clans` use to swap between their leaderboards
 * (`LeaderboardTabs`), pointed at the two halves of a Maneuvers edition. One
 * event, two boards, one switch — so the reader moves between them the way they
 * do everywhere else on the site rather than through a bespoke link.
 *
 * Reuses the `leaderboard-tabs` labels ("Joueurs"/"Clans"); they are the same
 * two words.
 */
export async function ManeuversBoardSwitch({
  current,
  region,
  locale,
}: {
  current: "players" | "clans";
  region: Region;
  /** The route's own segment: this renders on the server, so it has no request
   * to read the language from. */
  locale: string;
}) {
  const { t } = await getTranslation("components/leaderboard-tabs", locale);
  return (
    <SegmentedControl
      active={current}
      segments={[
        {
          id: "players",
          label: t("players"),
          href: ROUTES.PLAYERS_MANEUVERS(region),
        },
        {
          id: "clans",
          label: t("clans"),
          href: ROUTES.CLANS_MANEUVERS(region),
        },
      ]}
    />
  );
}
