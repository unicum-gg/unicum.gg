import { format } from "date-fns";
import Link from "next/link";
import { AutoFitText } from "@/components/auto-fit-text";
import { LanguageFlags } from "@/components/language-flags";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { ClanFullInfo } from "@/services/wargaming/wot/clans";
import type { ClanMemberStats } from "@/services/wargaming/wot/clans/members";
import type { MemberRatings } from "@/services/wargaming/wot/clans/ratings";
import {
  RATING_COLOR_CLASS,
  type RatingColor,
  winrateColor,
  wn8Color,
} from "@/services/wargaming/wot/ratings";
import type { Region } from "@/services/wargaming/wot";

const DAY_FORMAT = "MMM d, yyyy";
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

type MetricCell = {
  label: string;
  value: string;
  color: RatingColor | null;
};

function computeMetrics(
  members: ClanMemberStats[],
  ratings: Map<number, MemberRatings> | null,
): { avg30dWnx: MetricCell; avgWnx: MetricCell; avgWinrate: MetricCell } {
  const active = members.filter((m) => m.overall.battles > 0);
  const avgWinRate = average(active.map((m) => m.overall.winsPercentage));
  const wnxValues = ratings
    ? members
        .map((m) => ratings.get(m.accountId)?.wnx)
        .filter((v): v is number => v !== null && v !== undefined)
    : [];
  const avgWnx = wnxValues.length > 0 ? average(wnxValues) : null;

  return {
    avg30dWnx: { label: "Avg 30d WNX", value: "—", color: null },
    avgWnx: {
      label: "Avg WNX",
      value: avgWnx === null ? "—" : intFmt.format(avgWnx),
      color: avgWnx === null ? null : wn8Color(avgWnx),
    },
    avgWinrate: {
      label: "Avg winrate",
      value: avgWinRate === null ? "—" : `${pctFmt.format(avgWinRate)}%`,
      color: avgWinRate === null ? null : winrateColor(avgWinRate / 100),
    },
  };
}

export function ClanHeader({
  region,
  clan,
  members,
  ratings,
}: {
  region: Region;
  clan: ClanFullInfo;
  members: ClanMemberStats[];
  ratings: Map<number, MemberRatings> | null;
}) {
  const metrics = computeMetrics(members, ratings);
  return (
    <header className="flex items-stretch">
      {clan.emblem && (
        <div className="flex size-24 shrink-0 items-center justify-center border-r border-fd-border p-3">
          <img
            src={clan.emblem}
            alt={`${clan.tag} emblem`}
            className="size-full object-contain"
          />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="flex h-16 min-w-0 items-center px-4 font-heading font-bold tracking-tight">
          <AutoFitText maxPx={36} minPx={18} className="w-full">
            <span style={{ color: clan.color }}>[</span>
            {clan.tag}
            <span style={{ color: clan.color }}>]</span>
            <span className="ml-2">{clan.name}</span>
          </AutoFitText>
        </h1>
        <div className="flex h-8 flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-fd-border px-4 text-xs text-muted-foreground">
          <span>
            <span className="font-medium">Members:</span> {clan.membersCount}
          </span>
          <span>·</span>
          <span>
            <span className="font-medium">Created:</span>{" "}
            {format(clan.createdAt, DAY_FORMAT)} by{" "}
            <Link
              href={ROUTES.PLAYER(region, clan.creatorName)}
              className="underline-offset-2 hover:underline"
            >
              {clan.creatorName}
            </Link>
          </span>
          <span>·</span>
          <span>
            <span className="font-medium">Commander:</span>{" "}
            <Link
              href={ROUTES.PLAYER(region, clan.leaderName)}
              className="underline-offset-2 hover:underline"
            >
              {clan.leaderName}
            </Link>
          </span>
          {clan.isDisbanded && (
            <>
              <span>·</span>
              <span className="font-medium text-destructive">Disbanded</span>
            </>
          )}
          {clan.languages.length > 0 && (
            <LanguageFlags
              languages={clan.languages}
              size="l"
              className="-mr-4 mb-px ml-auto h-[calc(100%-1px)]"
            />
          )}
        </div>
      </div>
      <MetricColumn metric={metrics.avg30dWnx} />
      <MetricColumn metric={metrics.avgWnx} />
      <MetricColumn metric={metrics.avgWinrate} />
    </header>
  );
}

function MetricColumn({ metric }: { metric: MetricCell }) {
  return (
    <div className="flex w-32 shrink-0 flex-col border-l border-fd-border">
      <div className="px-4 py-2 text-center text-xs text-muted-foreground">
        {metric.label}
      </div>
      <div
        className={cn(
          "flex flex-1 items-center justify-center border-t border-fd-border text-xl font-semibold tabular-nums",
          metric.color && RATING_COLOR_CLASS[metric.color],
        )}
      >
        {metric.value}
      </div>
    </div>
  );
}
