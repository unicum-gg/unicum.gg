import { format } from "date-fns";
import Link from "next/link";
import type {
  ClanFullInfo,
  ClanMemberStats,
} from "@/services/wargaming/wot/clans";
import type { Region } from "@/services/wargaming/wot";

const DAY_FORMAT = "MMM d, yyyy";

export function ClanHeader({
  region,
  clan,
}: {
  region: Region;
  clan: ClanFullInfo;
  members: ClanMemberStats[];
}) {
  return (
    <header className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        {clan.emblem && (
          <img
            src={clan.emblem}
            alt={`${clan.tag} emblem`}
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-md"
          />
        )}
        <h1 className="font-heading text-4xl font-bold tracking-tight">
          <span style={{ color: clan.color }}>[</span>
          {clan.tag}
          <span style={{ color: clan.color }}>]</span>{" "}
          {clan.name}
        </h1>
      </div>
      <div className="flex flex-col gap-0.5 text-sm text-muted-foreground sm:text-right">
        <div>
          <span className="font-medium">Members:</span> {clan.membersCount}
        </div>
        <div>
          <span className="font-medium">Created:</span>{" "}
          {format(clan.createdAt, DAY_FORMAT)}
        </div>
        <div>
          <span className="font-medium">Commander:</span>{" "}
          <Link
            href={`/${region}/players/${encodeURIComponent(clan.leaderName)}`}
            className="underline-offset-2 hover:underline"
          >
            {clan.leaderName}
          </Link>
        </div>
        {clan.isDisbanded && (
          <div className="font-medium text-destructive">Disbanded</div>
        )}
      </div>
    </header>
  );
}
