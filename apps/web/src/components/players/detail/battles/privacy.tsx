"use client";

import { ArrowRightIcon, LockSimpleIcon } from "@phosphor-icons/react";
import type { RatingMetric } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { PanelContent } from "@/components/panel";
import { CtaCard } from "@/components/cta-card";
import Link from "@/components/link";
import ROUTES from "@/constants/routes";
import { useHydrated } from "@/hooks/use-hydrated";
import { useTranslation } from "@/hooks/use-translation";
import { PlayerSection, playerSectionHref } from "@/components/players/detail/tabs";
import { EXAMPLE_BATTLES } from "@/components/players/detail/overview/battles-example";
import { PlayerBattlesTable } from "@/components/players/detail/overview/battles-table";

/**
 * What a visitor reads in place of a list its owner keeps private.
 *
 * Drawn as the mod offer is (a list behind a card) and deliberately not as a
 * sentence: an empty-looking panel is what a player who never installed the
 * mod gets, and a private list must not be mistaken for one. So the rows are
 * there, blurred out of reading, under a lock: the list exists, it is closed.
 * The rows are the offer's invented ones, inert and drawn only once hydrated
 * for the same reason as there, so nothing of them reaches the HTML a crawler
 * reads as this player's.
 *
 * On the overview the card leads to the Battles tab, where who they played
 * beside stays public; on the tab that list is already right under it.
 */
export function BattlesPrivateNotice({
  region,
  nickname,
  metric,
  linkToTab = false,
}: {
  region: Region;
  nickname: string;
  metric: RatingMetric;
  linkToTab?: boolean;
}) {
  const { t } = useTranslation("components/players/detail/battles/privacy");
  const hydrated = useHydrated();
  return (
    <PanelContent className="p-0">
      <div className="relative h-72 overflow-hidden">
        {hydrated ? (
          <div
            inert
            aria-hidden
            className="pointer-events-none select-none opacity-60 blur-[3px] [mask-image:linear-gradient(to_bottom,black_45%,transparent)]"
          >
            <PlayerBattlesTable
              region={region}
              nickname={nickname}
              metric={metric}
              accountId={0}
              battles={EXAMPLE_BATTLES}
            />
          </div>
        ) : null}
        <span className="bg-fd-background/90 text-fd-muted-foreground absolute top-4 left-4 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium sm:left-8">
          <LockSimpleIcon weight="fill" className="size-3" />
          {t("badge")}
        </span>
      </div>
      <div className="relative -mt-32 px-4 pb-4">
        <CtaCard
          className="bg-fd-background/90 backdrop-blur-sm"
          heading={
            <span className="flex flex-col items-center gap-3">
              <span className="bg-fd-primary/10 text-fd-primary ring-fd-primary/20 inline-flex size-12 items-center justify-center rounded-full ring-1">
                <LockSimpleIcon weight="fill" className="size-6" />
              </span>
              {t("heading", { nickname })}
            </span>
          }
          description={t("blurb", { nickname })}
        >
          {linkToTab ? (
            <Link
              href={playerSectionHref(
                ROUTES.PLAYER(region, nickname),
                PlayerSection.Battles,
              )}
              className={buttonVariants({ variant: "secondary" })}
            >
              {t("see-teammates")}
              <ArrowRightIcon weight="bold" className="ml-2 size-4" />
            </Link>
          ) : null}
        </CtaCard>
      </div>
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
      <p className="text-fd-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <LockSimpleIcon weight="fill" className="size-3" />
        {t("private-owner")}{" "}
        {/* The whole sentence is the link, since one word of a sentence cannot
            be picked out across 36 languages. The top bar's dialog follows
            this address and opens on the switch. */}
        <a
          href="#settings/privacy"
          className="text-fd-foreground underline underline-offset-2"
        >
          {t("private-owner-change")}
        </a>
      </p>
    </PanelContent>
  );
}
