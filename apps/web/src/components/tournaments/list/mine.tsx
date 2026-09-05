"use client";

import useSWR from "swr";
import Link from "next/link";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";
import { PanelSeparator } from "@/components/panel";
import { RankMedal } from "@/components/rank-medal";
import { TournamentStatusBadge } from "@/components/tournaments/status-badge";
import ROUTES from "@/constants/routes";
import { useSession } from "@/lib/auth-client";
import { wgIdentityFromEmail } from "@/lib/wg-session";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { unicum } from "@/services/sdk";
import { ordinal } from "@unicum.gg/shared";
import type { PlayerTournamentRecord } from "@/components/players/detail/tournaments/row";

/** Enough to recognise a record without turning the panel into the player's own
 * tab, which is one click away. */
const SHOWN = 5;

const dateFmt = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * The signed-in player's own tournament record, on the catalogue page.
 *
 * The thing Wargaming's own site cannot show: their tournament system is
 * addressable from the tournament's side only, so it can list who registered
 * for one tournament and never what one player has played. We hold the join, and
 * a logged-in visitor hands us the account id, so the page can open on their own
 * history instead of a generic list.
 *
 * Renders nothing at all when signed out: an empty promise ("log in to see
 * yours") on a page full of real data is an advert, not a feature.
 */
export function MyTournaments() {
  const { data: session } = useSession();
  const identity = wgIdentityFromEmail(session?.user.email);
  const nickname = session?.user.name ?? null;

  const { data } = useSWR(
    identity && nickname
      ? unicum.region(identity.region).players(nickname).tournaments().url()
      : null,
    () =>
      unicum
        .region(identity!.region)
        .players(nickname!)
        .tournaments()
        .then((r) => r as unknown as PlayerTournamentRecord),
  );

  if (!identity || !nickname || !data || data.entries.length === 0) return null;
  const recent = data.entries.slice(0, SHOWN);

  return (
    <>
      <PanelSeparator />
      <Panel>
        <PanelHeader
          screenLines={false}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-fd-border"
        >
          <PanelTitle>Your tournaments ({data.entries.length})</PanelTitle>
          <Link
            href={`${ROUTES.PLAYER(identity.region, nickname)}/tournaments`}
            className="text-xs text-fd-muted-foreground hover:text-fd-foreground hover:underline"
          >
            {data.wins > 0 ? `${data.wins} won · ` : ""}See all
          </Link>
        </PanelHeader>
        <PanelContent className="flex flex-col gap-1.5 p-4">
          {recent.map((e) => (
            <div
              key={`${e.tournamentId}:${e.teamId}`}
              className="flex min-w-0 items-baseline gap-2 text-sm"
            >
              <span className="shrink-0 text-xs text-fd-muted-foreground tabular-nums">
                {dateFmt.format(e.startAt)}
              </span>
              <Link
                href={ROUTES.TOURNAMENT(identity.region, e.tournamentId)}
                className="min-w-0 truncate hover:underline"
                title={e.title}
              >
                {e.title}
              </Link>
              <span className="ms-auto flex shrink-0 items-center gap-2">
                <Link
                  href={ROUTES.TOURNAMENT_TEAM(
                    identity.region,
                    e.tournamentId,
                    e.teamId,
                  )}
                  className={cn(styles.mutedDescription, "text-xs hover:underline")}
                >
                  {e.teamTitle}
                </Link>
                {e.bestPosition === null ? (
                  <TournamentStatusBadge status={e.status} />
                ) : (
                  <span className="flex items-center gap-1 text-xs tabular-nums">
                    {e.bestPosition <= 3 && (
                      <RankMedal
                        rank={e.bestPosition as 1 | 2 | 3}
                        className="h-4"
                      />
                    )}
                    {ordinal(e.bestPosition)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </PanelContent>
      </Panel>
    </>
  );
}
