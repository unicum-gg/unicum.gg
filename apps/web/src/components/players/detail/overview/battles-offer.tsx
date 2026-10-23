"use client";

import { PuzzlePieceIcon } from "@phosphor-icons/react";
import type { RatingMetric } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { PanelContent } from "@/components/panel";
import { CtaCard } from "@/components/cta-card";
import Link from "@/components/link";
import APP from "@/constants/app";
import ROUTES from "@/constants/routes";
import { useHydrated } from "@/hooks/use-hydrated";
import { useTranslation } from "@/hooks/use-translation";
import { EXAMPLE_BATTLES } from "./battles-example";
import { PlayerBattlesTable } from "./battles-table";

/**
 * What a battles list says when nobody has shared one of this player's: an
 * offer to install the mod, over a preview of what it would fill the list
 * with. The overview's panel and the Battles tab both end up here.
 */
export function PlayerBattlesOffer({
  region,
  nickname,
  metric,
}: {
  region: Region;
  nickname: string;
  metric: RatingMetric;
}) {
  const { t } = useTranslation(
    "components/players/detail/overview/battles",
  );
  const hydrated = useHydrated();
  return (
    // What the panel turns into, under the offer to fill it: a sentence
    // cannot show a reader what a shared battle looks like, three rows
    // can. Faded, inert and hidden from assistive tech, since none of it
    // is this player's, and labelled so nobody reads it as theirs. Drawn
    // only once hydrated, so the invented rows never reach the HTML a
    // crawler or the `.md` twin reads as this player's battles, into a
    // box of fixed height so their arrival moves nothing.
    <PanelContent className="p-0">
      <div className="relative h-64 overflow-hidden">
        {hydrated ? (
          <div
            inert
            aria-hidden
            className="pointer-events-none select-none opacity-75 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
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
        <span className="bg-fd-background/90 text-fd-muted-foreground absolute top-4 left-4 rounded-md px-2 py-0.5 text-xs font-medium sm:left-8">
          {t("example")}
        </span>
      </div>
      <div className="relative -mt-14 px-4 pb-4">
        <CtaCard
          className="bg-fd-background/90 backdrop-blur-sm"
          heading={t("empty-heading")}
          description={t("empty-blurb", { nickname, name: APP.NAME })}
        >
          <Link
            href={ROUTES.MOD}
            className={buttonVariants({ variant: "primary" })}
          >
            <PuzzlePieceIcon weight="fill" className="mr-2 size-4" />
            {t("empty-cta")}
          </Link>
        </CtaCard>
      </div>
    </PanelContent>
  );
}
