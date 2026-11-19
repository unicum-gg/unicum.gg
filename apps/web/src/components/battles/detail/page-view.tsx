import type { Region } from "@unicum.gg/wargaming";
import type { BattleDetail as BattleDetailData } from "@unicum.gg/core/battles/read";
import { BattleDetail } from "@/components/players/detail/overview/battle-detail";
import { BattlePageShare } from "@/components/players/detail/overview/battle-share";
import {
  BattleTab,
  type BattleDetailData as BattleDetailPayload,
} from "@/components/players/detail/overview/battle-types";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import Link from "@/components/link";
import ROUTES from "@/constants/routes";
import { getTranslation } from "@/lib/translations.server";
import { BattleComments } from "./comments";
import { personalScore } from "./personal-score";

/**
 * A battle on a page of its own, shared by its two addresses: the battle
 * itself, and one player's side of it, which only differs by its heading and
 * by the player the rosters open on.
 *
 * Everything below is the SAME component a player's page expands inline. A
 * second rendering of a battle would be a second place for the replay viewer,
 * the rosters and the report to drift apart.
 */
export async function BattlePageView({
  locale,
  region,
  battle,
  heading,
  mapLabel,
  focus,
  initialTab,
  initialPlayer,
  initialComments,
}: {
  locale: string;
  region: Region;
  battle: BattleDetailData;
  heading: string;
  /** The map's name in the reader's language. */
  mapLabel: string;
  /** The account this view is drawn from, for one player's side of the
   * battle: their row is marked and their own report offered. */
  focus?: number;
  initialTab: BattleTab;
  /** The vehicle the rosters open on, by its battle-scoped id. */
  initialPlayer: number | null;
  /** The published comments, read by the server for the HTML. */
  initialComments: Parameters<typeof BattleComments>[0]["initial"];
}) {
  const { t } = await getTranslation("app/battles/battle-page", locale);
  // Every recording of the battle, each one its recorder's point of view.
  const recorders = battle.recorders;
  const recordedBy = new Set(recorders.map((one) => one.accountId));
  // Every other client that reported it, which is worth a word: nobody else
  // can say how many of the thirty told us about a battle, and who.
  const others = battle.reportedBy.filter((one) => !recordedBy.has(one.accountId));
  // The recording this view is drawn from, when its player is a recorder:
  // their results screen leads, and the replay and the download are theirs.
  const recording = recorders.find((one) => one.accountId === focus);
  const player = recording
    ? battle.participants.find((one) => one.account === recording.accountId && one.player)
    : undefined;
  const personal =
    recording && player
      ? await personalScore({ locale, region, battle, player, recording, map: mapLabel })
      : undefined;
  return (
    // The site's own page shell, not a rounded box of this file's invention:
    // `Panel` is what carries the rules down either side and the screen lines
    // above and below, which is what makes a page look like it belongs here.
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <PanelTitle as="h1">{heading}</PanelTitle>
            {recorders.length > 0 || others.length > 0 ? (
              <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {recorders.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-1">
                    {t("recorded-by")}
                    {recorders.map((one, index) => (
                      <span key={one.accountId}>
                        {/* Each name opens that recorder's own replay. */}
                        <Link
                          href={ROUTES.BATTLE_PLAYER(region, battle.id, one.accountId)}
                          prefetch={false}
                          className={
                            one.accountId === focus
                              ? "text-foreground font-medium"
                              : "hover:text-foreground hover:underline"
                          }
                        >
                          {one.nickname}
                        </Link>
                        {index < recorders.length - 1 ? "," : null}
                      </span>
                    ))}
                  </span>
                ) : null}
                {others.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-1">
                    {t(recorders.length > 0 ? "also-reported-by" : "reported-by")}
                    {others.map((one, index) => (
                      <span key={one.accountId}>
                        <Link
                          href={ROUTES.PLAYER(region, one.nickname)}
                          prefetch={false}
                          className="hover:text-foreground hover:underline"
                        >
                          {one.nickname}
                        </Link>
                        {index < others.length - 1 ? "," : null}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
          <BattlePageShare
            region={region}
            battleId={battle.id}
            arenaId={battle.map}
            initialTab={initialTab}
            initialPlayer={initialPlayer}
            defaultTab={recording ? BattleTab.Personal : BattleTab.Teams}
          />
        </PanelHeader>
        <PanelContent className="p-0">
          <BattleDetail
            region={region}
            battleId={battle.id}
            arenaId={battle.map}
            mapImage={battle.mapImage}
            mapBounds={battle.mapBounds}
            mapOverlay={battle.mapOverlay}
            startedAt={battle.startedAt.toISOString()}
            duration={battle.duration}
            // The economy belongs to the first reporter alone, so it is shown
            // on their side of the battle and nowhere else.
            personal={
              recording?.personal ??
              (focus !== undefined && focus === battle.personal?.accountId
                ? battle.personal.economy
                : null)
            }
            // The recording this view is drawn from, or the battle's first.
            recorder={recording?.accountId}
            personalScore={personal}
            highlightAccount={focus}
            initialTab={initialTab}
            initialPlayer={initialPlayer}
            syncUrl
            // The title above already carries one.
            shareable={false}
            // Read by the server already, so the rosters and the report are in
            // the HTML rather than fetched again by the browser.
            initial={battle as unknown as BattleDetailPayload}
          />
        </PanelContent>
      </Panel>
      <PanelSeparator />
      {/* Under the replay: what players made of the battle, after watching it. */}
      <BattleComments region={region} battleId={battle.id} initial={initialComments} />
    </div>
  );
}
