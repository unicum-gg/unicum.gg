"use client";

import { PanelContent } from "@/components/panel";
import { useTranslation } from "@/hooks/use-translation";

/** What a visitor reads in place of a list its owner keeps private. */
export function BattlesPrivateNotice({ nickname }: { nickname: string }) {
  const { t } = useTranslation("components/players/detail/battles/privacy");
  return (
    <PanelContent>
      <p className="text-fd-muted-foreground py-6 text-center text-sm">
        {t("private", { nickname })}
      </p>
    </PanelContent>
  );
}

/**
 * The owner's reminder, above a list nobody else is shown.
 *
 * The switch itself lives in the account settings with the other privacy
 * choice, so this only says the state and where it is changed: a player who
 * hid their battles months ago and wonders why a teammate cannot find them
 * should be told on the page they are looking at.
 */
export function BattlesPrivateOwnerNote() {
  const { t } = useTranslation("components/players/detail/battles/privacy");
  return (
    <PanelContent className="border-fd-border border-t">
      <p className="text-fd-muted-foreground text-xs">{t("private-owner")}</p>
    </PanelContent>
  );
}
