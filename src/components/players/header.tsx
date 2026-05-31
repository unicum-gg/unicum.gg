import { format, formatDistanceToNow } from "date-fns";
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
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-heading text-4xl font-bold tracking-tight">
          {nickname}
        </h1>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
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
          className="flex items-center gap-3 text-sm hover:opacity-80"
        >
          <div className="text-right">
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
          <img
            src={currentStint.clan.emblem}
            alt={`${currentStint.clan.tag} emblem`}
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-md"
          />
        </Link>
      )}
    </header>
  );
}
