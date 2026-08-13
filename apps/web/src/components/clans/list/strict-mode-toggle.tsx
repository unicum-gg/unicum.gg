import { SegmentedControl } from "@/components/segmented-control";
import ROUTES from "@/constants/routes";
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
    <SegmentedControl
      active={strict ? "strict" : "any"}
      segments={[
        {
          id: "any",
          label: "Any",
          href: ROUTES.CLANS_BY_LANGUAGE(region, language),
          count: total,
        },
        {
          id: "strict",
          label: "Strict",
          href: ROUTES.CLANS_BY_LANGUAGE(region, language, true),
          count: strictCount,
        },
      ]}
    />
  );
}
