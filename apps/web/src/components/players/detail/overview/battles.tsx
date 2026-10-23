"use client";

import useSWR from "swr";
import { useLocale } from "@onruntime/translations/react";
import { InfoIcon, PuzzlePieceIcon } from "@phosphor-icons/react";
import type { RatingMetric } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { unicum } from "@/services/sdk";
import { useHydrated } from "@/hooks/use-hydrated";
import { useTranslation } from "@/hooks/use-translation";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { CtaCard } from "@/components/cta-card";
import Link from "@/components/link";
import ROUTES from "@/constants/routes";
import APP from "@/constants/app";
import { EXAMPLE_BATTLES } from "./battles-example";
import { PlayerBattlesTable, type PlayerBattleRow } from "./battles-table";

export type PlayerBattlesPayload = {
  accountId: number;
  battles: PlayerBattleRow[];
};

/**
 * The battles we know this player fought, newest first.
 *
 * **Every row here came from a player's own client, not from Wargaming.** The
 * API publishes an account's running totals and nothing about a single battle,
 * so this panel can only show what somebody who was in the battle chose to
 * share. A player's list therefore starts the day that began, and an empty one
 * means nobody has shared, not that they have not played.
 *
 * That is why an empty list **offers the mod rather than saying "no battles
 * yet"**. Most accounts have nothing here and will not for a long time, and a
 * bare empty state on two million player pages would read as the site being
 * broken. Said as an offer instead, it names the one thing that fills it, on
 * the page a player is most likely to be reading: their own.
 *
 * Seeded by the server and refetched on mount, rather than one or the other.
 * Fetched only in the browser, the panel could not exist before hydration plus
 * a round trip to the endpoint (~0.5s), so it popped in late and pushed the
 * page down. Seeded only, it would show the list as it stood when the page was
 * cached, up to a day old, while battles move every few minutes. So the cached
 * HTML carries the list it was built with and the browser swaps in the current
 * one, keyed on the SDK request's own url like everything else the profile
 * loads on demand.
 */
export function PlayerBattlesPanel({
  region,
  nickname,
  metric,
  initialBattles,
}: {
  region: Region;
  nickname: string;
  /** The reader's own metric, the one the rest of the profile is showing. */
  metric: RatingMetric;
  /** The list the server rendered the page with, null when it did not ask. */
  initialBattles: PlayerBattlesPayload | null;
}) {
  const { t } = useTranslation(
    "components/players/detail/overview/battles",
  );
  const { locale } = useLocale();
  const hydrated = useHydrated();
  // In the page's own language, which is also what the server seeded it with,
  // so the seed and the refetch share one key.
  const request = () =>
    unicum.region(region).players(nickname).battles({ language: locale });
  const { data } = useSWR(
    request().url(),
    () => request().then((r) => r as unknown as PlayerBattlesPayload),
    {
      fallbackData: initialBattles ?? undefined,
      // Explicit, because the seed can be a day old: the cached HTML is only
      // what to show until the current list arrives.
      revalidateOnMount: true,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  // Nothing until there is an answer. A seeded panel has one from the first
  // paint, so this only waits when the server could not read the list, and a
  // request that failed says nothing either way about who has shared.
  if (!data) return null;
  const empty = data.battles.length === 0;

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>
            {t("title", { nickname, count: data.battles.length })}
          </PanelTitle>
        </PanelHeader>
        {empty ? (
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
        ) : (
          <>
            {/* Said before the list, not under it. A reader who does not know
                where these rows come from will read an incomplete list as a
                complete one, and the gap is most of it: a battle is here only if
                somebody in it shared it. */}
            <PanelContent>
              <p className="text-muted-foreground flex items-start gap-2 text-sm">
                <InfoIcon className="mt-0.5 size-4 shrink-0" weight="fill" />
                <span>{t("provenance")}</span>
              </p>
            </PanelContent>
            <PanelContent className="p-0">
              <PlayerBattlesTable
                region={region}
                nickname={nickname}
                metric={metric}
                accountId={data.accountId}
                battles={data.battles}
              />
            </PanelContent>
          </>
        )}
      </Panel>
    </>
  );
}
