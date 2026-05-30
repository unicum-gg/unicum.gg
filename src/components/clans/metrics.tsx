import { styles } from "@/lib/styles";
import type { ClanMemberStats } from "@/services/wargaming/wot/clans";
import type { MemberRatings } from "@/services/wargaming/wot/clans/ratings";
import {
  RATING_COLOR_CLASS,
  type RatingColor,
  winrateColor,
  wn8Color,
} from "@/services/wargaming/wot/ratings";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function ClanMetrics({
  members,
  ratingsByAccount,
}: {
  members: ClanMemberStats[];
  ratingsByAccount: Map<number, MemberRatings>;
}) {
  const active = members.filter((m) => m.overall.battles > 0);
  const avgBattles = average(active.map((m) => m.overall.battles));
  const avgWinRate = average(active.map((m) => m.overall.winsPercentage));

  const wnxValues = members
    .map((m) => ratingsByAccount.get(m.accountId)?.wnx)
    .filter((v): v is number => v !== null && v !== undefined);
  const avgWnx = wnxValues.length > 0 ? average(wnxValues) : null;

  return (
    <section className="mb-8 grid gap-3 sm:grid-cols-3">
      <Metric
        label="Avg battles"
        value={avgBattles === null ? "—" : intFmt.format(avgBattles)}
      />
      <Metric
        label="Avg win rate"
        value={avgWinRate === null ? "—" : `${pctFmt.format(avgWinRate)}%`}
        color={avgWinRate === null ? null : winrateColor(avgWinRate / 100)}
      />
      <Metric
        label="Avg WNX"
        value={avgWnx === null ? "—" : intFmt.format(avgWnx)}
        color={avgWnx === null ? null : wn8Color(avgWnx)}
      />
    </section>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: RatingColor | null;
}) {
  const colorClass = color ? RATING_COLOR_CLASS[color] : "";
  return (
    <div
      className={`overflow-hidden rounded-lg ${styles.cardBorder} bg-fd-card`}
    >
      <div className="p-4">
        <div className={styles.mutedDescription}>{label}</div>
        <div
          className={`mt-1 inline-block rounded px-2 py-0.5 text-2xl font-semibold tabular-nums ${colorClass}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}
