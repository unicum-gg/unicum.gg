import { format, formatDistanceToNow } from "date-fns";
import Image from "next/image";
import Link from "next/link";
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
}: {
  region: Region;
  nickname: string;
  createdAt: Date;
  lastBattleAt: Date;
  updatedAt: Date;
  currentStint: ClanStint | null;
}) {
  return (
    <header className="flex items-stretch">
      <div className="flex flex-1 flex-col">
        <h1 className="flex flex-1 items-center px-4 py-3 font-heading text-4xl font-bold tracking-tight">
          {nickname}
        </h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-fd-border px-4 py-2 text-xs text-muted-foreground">
          <span title={format(createdAt, DAY_FORMAT)}>
            Joined {format(createdAt, MONTH_FORMAT)}
          </span>
          <span>·</span>
          <span title={format(lastBattleAt, "MMM d, yyyy 'at' h:mm a")}>
            Last battle {formatDistanceToNow(lastBattleAt, { addSuffix: true })}
          </span>
          <span>·</span>
          <span>
            Updated{" "}
            <RelativeTime
              date={updatedAt}
              title={format(updatedAt, "MMM d, yyyy 'at' h:mm:ss a")}
            />
          </span>
        </div>
      </div>
      {currentStint && (
        <Link
          href={ROUTES.CLAN(region, currentStint.clan.tag)}
          className="flex items-stretch border-l border-fd-border text-sm hover:opacity-80"
        >
          <div className="flex flex-col justify-center whitespace-nowrap p-4 text-right">
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
