"use client";

import { InfoIcon } from "@phosphor-icons/react";
import { PanelContent } from "@/components/panel";
import { useTranslation } from "@/hooks/use-translation";

/** Where the rows of a battles list come from, said above them. */
export function PlayerBattlesProvenance() {
  const { t } = useTranslation(
    "components/players/detail/overview/battles",
  );
  // Said before the list, not under it. A reader who does not know where
  // these rows come from will read an incomplete list as a complete one, and
  // the gap is most of it: a battle is here only if somebody in it shared it.
  return (
    <PanelContent>
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0" weight="fill" />
        <span>{t("provenance")}</span>
      </p>
    </PanelContent>
  );
}
