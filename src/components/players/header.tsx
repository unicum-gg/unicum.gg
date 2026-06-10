import { format, formatDistanceToNow } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { LanguageFlags } from "@/components/language-flags";
import { RelativeTime } from "@/components/relative-time";
import ROUTES from "@/constants/routes";
import type { Region } from "@/services/wargaming/wot";
import type { ClanStint } from "@/services/wargaming/wot/clans/player";

const MONTH_FORMAT = "MMM yyyy";
const DAY_FORMAT = "MMM d, yyyy";

export function PlayerHeader({
  region,
  nickname,
  createdAt,
  lastBattleAt,
  updatedAt,
  currentStint,
  inferredLanguages,
}: {
  region: Region;
  nickname: string;
  createdAt: Date;
  lastBattleAt: Date;
  updatedAt: Date;
  currentStint: ClanStint | null;
  inferredLanguages: string[];
}) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="flex min-w-0 flex-1 items-center px-4 py-3 font-heading text-2xl font-bold tracking-tight wrap-break-word sm:text-4xl">
          {nickname}
        </h1>
        <div className="flex min-h-8 border-t border-fd-border sm:h-auto">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-y-0.5 px-4 py-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
            <span title={format(createdAt, DAY_FORMAT)}>
              Joined {format(createdAt, MONTH_FORMAT)}
            </span>
            <span className="hidden sm:inline">·</span>
            <span title={format(lastBattleAt, "MMM d, yyyy 'at' h:mm a")}>
              Last battle{" "}
              {formatDistanceToNow(lastBattleAt, { addSuffix: true })}
            </span>
            <span className="hidden sm:inline">·</span>
            <span>
              Updated{" "}
              <RelativeTime
                date={updatedAt}
                title={format(updatedAt, "MMM d, yyyy 'at' h:mm:ss a")}
              />
            </span>
          </div>
          {inferredLanguages.length > 0 && (
            <div className="flex h-6 shrink-0 items-center self-end sm:h-full sm:self-auto">
              <LanguageFlags
                languages={inferredLanguages}
                size="l"
                source="inferred"
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
              <span className="font-semibold">
                <span style={{ color: currentStint.clan.color }}>[</span>
                {currentStint.clan.tag}
                <span style={{ color: currentStint.clan.color }}>]</span>
              </span>{" "}
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
