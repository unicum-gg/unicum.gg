import { SegmentedControl } from "@/components/segmented-control";
import ROUTES from "@/constants/routes";
import type { Region } from "@unicum.gg/wargaming";
import { getTranslation } from "@/lib/translations.server";

/**
 * "Any / Strict" segmented switch shown above the filtered top-clans list.
 * "Any" keeps the default filter (clan declared this language alongside
 * others); "Strict" narrows to clans that declared ONLY this language.
 * Counts are inlined so users see the scope difference before clicking.
 */
export async function StrictModeToggle({
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
  /** The route's own segment: this renders on the server, so it has no request
   * to read the language from. */
  locale: string;
}) {
  const { t } = await getTranslation("components/clans/list/view", locale);
  return (
    <SegmentedControl
      active={strict ? "strict" : "any"}
      segments={[
        {
          id: "any",
          label: t("any-toggle"),
          href: ROUTES.CLANS_BY_LANGUAGE(region, language),
          count: total,
        },
        {
          id: "strict",
          label: t("strict-toggle"),
          href: ROUTES.CLANS_BY_LANGUAGE(region, language, true),
          count: strictCount,
        },
      ]}
    />
  );
}
