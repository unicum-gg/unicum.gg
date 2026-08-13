import { SegmentedControl } from "@/components/segmented-control";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";

/**
 * "Any / Strict" segmented switch above the filtered top-players list.
 * "Any" = the inferred language set contains this language (alongside
 * others); "Strict" = the player's inferred language set is exactly this
 * one. Mirror of the clans toggle, pointing at `ROUTES.PLAYERS`.
 */
export function PlayerStrictModeToggle({
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
    <SegmentedControl
      active={strict ? "strict" : "any"}
      segments={[
        {
          id: "any",
          label: "Any",
          href: ROUTES.PLAYERS_BY_LANGUAGE(region, language),
          count: total,
        },
        {
          id: "strict",
          label: "Strict",
          href: ROUTES.PLAYERS_BY_LANGUAGE(region, language, true),
          count: strictCount,
        },
      ]}
    />
  );
}
