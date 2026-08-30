import { format, formatDistanceToNow } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { ClanTag } from "@/components/entity/clan-tag";
import { VerifiedBadge } from "@/components/entity/badges/verified-badge";
import { StreamerBadge } from "@/components/entity/badges/streamer-badge";
import { CompareWithButton } from "@/components/players/detail/compare-with-button";
import { LanguageFlags } from "@/components/language-flags";
import { RefreshBeacon, RefreshKind } from "@/components/refresh-beacon";
import { RelativeTime } from "@/components/relative-time";
import { Skeleton } from "@/components/ui/skeleton";
import ROUTES from "@/constants/routes";
import { type Region } from "@unicum.gg/wargaming";
import { LiveBadge } from "@/components/live-badge";
import { PlayerActionsMenu } from "@/components/players/detail/actions-menu";
import {
  SupporterBadge,
  SupporterBadgeState,
} from "@/components/entity/badges/supporter-badge";
import type { ClanStint } from "@unicum.gg/shared";

const MONTH_FORMAT = "MMM yyyy";
const DAY_FORMAT = "MMM d, yyyy";

export function PlayerHeader(
  props:
    | { loading: true; nickname: string }
    | {
        region: Region;
        accountId: number;
        nickname: string;
        createdAt: Date;
        /** Null when the account has never entered a battle. */
        lastBattleAt: Date | null;
        updatedAt: Date;
        currentStint: ClanStint | null;
        inferredLanguages: string[];
        supporterBadge: SupporterBadgeState | null;
        verified: boolean;
        twitchLogin: string | null;
      },
) {
  if ("loading" in props) {
    return <PlayerHeaderSkeleton nickname={props.nickname} />;
  }

  const {
    region,
    accountId,
    nickname,
    createdAt,
    lastBattleAt,
    updatedAt,
    currentStint,
    inferredLanguages,
    supporterBadge,
    verified,
    twitchLogin,
  } = props;

  return (
    <header className="flex flex-col sm:flex-row sm:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
          <h1 className="min-w-0 flex-1 font-heading text-2xl font-bold tracking-tight wrap-break-word sm:text-4xl">
            {nickname}
            {(verified || supporterBadge || twitchLogin) && (
              <span className="ml-2 inline-flex items-center gap-1 align-middle">
                {verified && <VerifiedBadge size={24} />}
                {supporterBadge && (
                  <SupporterBadge state={supporterBadge} size={24} />
                )}
                {twitchLogin && <StreamerBadge login={twitchLogin} size={24} />}
              </span>
            )}
            <LiveBadge
              region={region}
              accountId={accountId}
              className="ml-2 align-middle text-xs"
            />
          </h1>
          <CompareWithButton region={region} current={nickname} />
          <PlayerActionsMenu
            region={region}
            accountId={accountId}
            nickname={nickname}
          />
        </div>
        <div className="flex min-h-8 border-t border-fd-border sm:h-auto">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-y-0.5 px-4 py-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
            <span title={format(createdAt, DAY_FORMAT)}>
              Joined {format(createdAt, MONTH_FORMAT)}
            </span>
            <span className="hidden sm:inline">·</span>
            {lastBattleAt ? (
              <span title={format(lastBattleAt, "MMM d, yyyy 'at' h:mm a")}>
                Last battle{" "}
                {formatDistanceToNow(lastBattleAt, { addSuffix: true })}
              </span>
            ) : (
              <span>Never played</span>
            )}
            <span className="hidden sm:inline">·</span>
            <span>
              Updated{" "}
              <RelativeTime
                date={updatedAt}
                title={format(updatedAt, "MMM d, yyyy 'at' h:mm:ss a")}
              />
            </span>
            <RefreshBeacon
              kind={RefreshKind.Player}
              region={region}
              id={nickname}
              updatedAt={updatedAt}
            />
          </div>
          {inferredLanguages.length > 0 && (
            <div className="flex h-6 shrink-0 items-center self-end sm:h-full sm:self-auto">
              <LanguageFlags
                languages={inferredLanguages}
                size="l"
                source="inferred"
                region={region}
              />
            </div>
          )}
        </div>
      </div>
      {currentStint && (
        <Link
          href={ROUTES.CLAN(region, currentStint.clan.tag)}
          className="flex items-stretch border-t border-fd-border text-sm hover:opacity-80 sm:border-l sm:border-t-0"
        >
          <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:flex-none sm:whitespace-nowrap sm:text-right">
            <div>
              <ClanTag
                tag={currentStint.clan.tag}
                color={currentStint.clan.color}
                className="font-semibold"
              />{" "}
              <span>{currentStint.clan.name}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {currentStint.roleLocalized} · joined{" "}
              {format(currentStint.joinedAt, DAY_FORMAT)}
            </div>
          </div>
          <div className="flex size-24 shrink-0 items-center justify-center border-l border-fd-border p-3">
            <Image
              src={currentStint.clan.emblem}
              alt={`${currentStint.clan.tag} emblem`}
              width={195}
              height={195}
              className="size-full object-contain"
            />
          </div>
        </Link>
      )}
    </header>
  );
}

/** The loading twin: real nickname + the same structure, with the meta line and
 * clan block as placeholders. The size-24 emblem sets the header height, so it
 * matches the loaded header. */
function PlayerHeaderSkeleton({ nickname }: { nickname: string }) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
          <h1 className="min-w-0 flex-1 font-heading text-2xl font-bold tracking-tight wrap-break-word sm:text-4xl">
            {nickname}
          </h1>
          {/* The compare + actions triggers are 28px square icon buttons. */}
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
        <div className="flex min-h-8 border-t border-fd-border sm:h-auto">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-y-0.5 px-4 py-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
            <Skeleton className="h-3 w-24" />
            <span className="hidden sm:inline">·</span>
            <Skeleton className="h-3 w-32" />
            <span className="hidden sm:inline">·</span>
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </div>
      <div className="flex items-stretch border-t border-fd-border text-sm sm:border-t-0 sm:border-l">
        <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:flex-none sm:whitespace-nowrap sm:text-right">
          <div>
            <Skeleton className="inline-block h-3.5 w-40 align-middle sm:ml-auto" />
          </div>
          <div className="mt-1 text-xs">
            <Skeleton className="inline-block h-3 w-28 align-middle sm:ml-auto" />
          </div>
        </div>
        <div className="flex size-24 shrink-0 items-center justify-center border-l border-fd-border p-3">
          <Skeleton className="size-full rounded-md" />
        </div>
      </div>
    </header>
  );
}
