import { SegmentedControl } from "@/components/segmented-control";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";
import { getTranslation } from "@/lib/translations.server";

/**
 * "Any / Strict" segmented switch above the filtered top-players list.
 * "Any" = the inferred language set contains this language (alongside
 * others); "Strict" = the player's inferred language set is exactly this
 * one. Mirror of the clans toggle, pointing at `ROUTES.PLAYERS`.
 */
export async function PlayerStrictModeToggle({
  region,
  language,
  strict,
  total,
  strictCount,
  locale,
}: {
  region: Region;
  language: string;
  strict: boolean;
  total: number;
  strictCount: number;
  /** The route's own segment: this renders on the server. */
  locale: string;
}) {
  const { t } = await getTranslation("components/players/list/view", locale);
  return (
    <SegmentedControl
      active={strict ? "strict" : "any"}
      segments={[
        {
          id: "any",
          label: t("any-toggle"),
          href: ROUTES.PLAYERS_BY_LANGUAGE(region, language),
          count: total,
        },
        {
          id: "strict",
          label: t("strict-toggle"),
          href: ROUTES.PLAYERS_BY_LANGUAGE(region, language, true),
          count: strictCount,
        },
      ]}
    />
  );
}
