import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  diffStats,
  getPeriodComparators,
  recordCurrentSnapshot,
  type Stats,
  statsFromSnapshot,
} from "@/services/snapshots";
import {
  findPlayerByNickname,
  getAccountWTR,
  getPlayerInfo,
} from "@/services/wargaming/wot/accounts";
import { isRegion } from "@/services/wargaming/wot";
import {
  getAccountClanInfo,
  getClanInfo,
} from "@/services/wargaming/wot/clans";
import {
  computeAvgTier,
  getVehicleEncyclopedia,
} from "@/services/wargaming/wot/encyclopedia";
import {
  computeWN7,
  computeWN8,
  computeWNX,
  getWN8ExpectedValues,
  getWNXExpectedValues,
  RATING_COLOR_CLASS,
  type RatingColor,
  winrateColor,
  wn7Color,
  wn8Color,
} from "@/services/wargaming/wot/ratings";
import { getTanksStats } from "@/services/wargaming/wot/tanks";

const integerFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
});
const dateOnlyFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

type Cell = { primary: string; secondary?: string; color?: RatingColor };

const EMPTY_CELL: Cell = { primary: "—" };

type RowDef = {
  label: string;
  render: (s: Stats) => Cell;
};

function pctOrDash(n: number, d: number): string {
  return d <= 0 ? "—" : percentFmt.format(n / d);
}

function avgOrDash(n: number, d: number): string {
  return d <= 0 ? "—" : decimalFmt.format(n / d);
}

const ROW_DEFS: RowDef[] = [
  {
    label: "Battles",
    render: (s) => ({ primary: integerFmt.format(s.battles) }),
  },
  {
    label: "Wins",
    render: (s) => ({
      primary: integerFmt.format(s.wins),
      secondary: pctOrDash(s.wins, s.battles),
      color: s.battles > 0 ? winrateColor(s.wins / s.battles) : undefined,
    }),
  },
  {
    label: "Losses",
    render: (s) => ({
      primary: integerFmt.format(s.losses),
      secondary: pctOrDash(s.losses, s.battles),
    }),
  },
  {
    label: "Draws",
    render: (s) => ({
      primary: integerFmt.format(s.draws),
      secondary: pctOrDash(s.draws, s.battles),
    }),
  },
  {
    label: "Battles survived",
    render: (s) => ({
      primary: integerFmt.format(s.survivedBattles),
      secondary: pctOrDash(s.survivedBattles, s.battles),
    }),
  },
  {
    label: "Tanks destroyed",
    render: (s) => ({
      primary: integerFmt.format(s.frags),
      secondary: avgOrDash(s.frags, s.battles),
    }),
  },
  {
    label: "Destruction ratio",
    render: (s) => ({
      primary: avgOrDash(s.frags, s.battles - s.survivedBattles),
    }),
  },
  {
    label: "Tanks spotted",
    render: (s) => ({
      primary: integerFmt.format(s.spotted),
      secondary: avgOrDash(s.spotted, s.battles),
    }),
  },
  {
    label: "Damage dealt",
    render: (s) => ({
      primary: avgOrDash(s.damageDealt, s.battles),
    }),
  },
  {
    label: "Base capture",
    render: (s) => ({
      primary: integerFmt.format(s.capturePoints),
      secondary: avgOrDash(s.capturePoints, s.battles),
    }),
  },
  {
    label: "Base defense",
    render: (s) => ({
      primary: integerFmt.format(s.droppedCapturePoints),
      secondary: avgOrDash(s.droppedCapturePoints, s.battles),
    }),
  },
  {
    label: "Experience",
    render: (s) => ({
      primary: avgOrDash(s.xp, s.battles),
    }),
  },
  {
    label: "Hit rate",
    render: (s) => ({
      primary: pctOrDash(s.hits, s.shots),
    }),
  },
];

function PeriodCells({ cell }: { cell: Cell }) {
  if (!cell.secondary) {
    return (
      <TableCell
        className={cn(
          "py-1.5! text-right tabular-nums",
          cell.color && RATING_COLOR_CLASS[cell.color],
        )}
        colSpan={2}
      >
        <span className={cell.primary === "—" ? "text-muted-foreground" : ""}>
          {cell.primary}
        </span>
      </TableCell>
    );
  }
  return (
    <>
      <TableCell className="py-1.5! pe-1! text-right tabular-nums">
        <span className={cell.primary === "—" ? "text-muted-foreground" : ""}>
          {cell.primary}
        </span>
      </TableCell>
      <TableCell
        className={cn(
          "py-1.5! ps-1! text-right tabular-nums",
          cell.color && RATING_COLOR_CLASS[cell.color],
        )}
      >
        {cell.secondary}
      </TableCell>
    </>
  );
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ region: string; nickname: string }>;
}) {
  const { region, nickname } = await params;
  if (!isRegion(region)) notFound();

  const decoded = decodeURIComponent(nickname);
  const found = await findPlayerByNickname(region, decoded);
  if (!found) notFound();

  const info = await getPlayerInfo(region, found.account_id);
  if (!info) notFound();

  const [
    { player, latest },
    tanks,
    encyclopedia,
    wn8Expected,
    wnxExpected,
    wtr,
    clan,
    clanMembership,
  ] = await Promise.all([
    recordCurrentSnapshot(region, info),
    getTanksStats(region, found.account_id),
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
    getAccountWTR(region, found.account_id),
    info.clan_id ? getClanInfo(region, info.clan_id) : Promise.resolve(null),
    info.clan_id
      ? getAccountClanInfo(region, found.account_id)
      : Promise.resolve(null),
  ]);
  const comparators = await getPeriodComparators(player.id);

  const current = statsFromSnapshot(latest);
  const periods = {
    h24: comparators.h24 ? diffStats(current, statsFromSnapshot(comparators.h24)) : null,
    d7: comparators.d7 ? diffStats(current, statsFromSnapshot(comparators.d7)) : null,
    d30: comparators.d30 ? diffStats(current, statsFromSnapshot(comparators.d30)) : null,
  };

  const avgTier = computeAvgTier(tanks, encyclopedia);
  const tierCell: Cell = avgTier === null
    ? EMPTY_CELL
    : { primary: decimalFmt.format(avgTier) };

  const wn7 = computeWN7(current, avgTier);
  const wn7Cell: Cell = wn7 === null
    ? EMPTY_CELL
    : { primary: decimalFmt.format(wn7), color: wn7Color(wn7) };

  const wn8 = computeWN8(tanks, wn8Expected);
  const wn8Cell: Cell = wn8 === null
    ? EMPTY_CELL
    : { primary: decimalFmt.format(wn8), color: wn8Color(wn8) };

  const wnx = computeWNX(tanks, wnxExpected);
  const wnxCell: Cell = wnx === null
    ? EMPTY_CELL
    : { primary: decimalFmt.format(wnx), color: wn8Color(wnx) };

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="mb-8 flex flex-col gap-2">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Link>
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-heading text-4xl font-bold tracking-tight">
            {info.nickname}
          </h1>
          {clan && (
            <div className="flex items-center gap-3 text-sm">
              <div className="text-right">
                <div>
                  <span className="font-semibold">
                    <span style={{ color: clan.color }}>[</span>
                    {clan.tag}
                    <span style={{ color: clan.color }}>]</span>
                  </span>{" "}
                  <span>{clan.name}</span>
                </div>
                {clanMembership && (
                  <div className="text-xs text-muted-foreground">
                    {clanMembership.role_i18n} · joined{" "}
                    {dateOnlyFmt.format(new Date(clanMembership.joined_at * 1000))}
                  </div>
                )}
              </div>
              {clan.emblem && (
                <img
                  src={clan.emblem}
                  alt={`${clan.tag} emblem`}
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-md"
                />
              )}
            </div>
          )}
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Overall stats</h2>
        <Table
          variant="card"
          className="table-fixed [&_tr>*+*]:border-l [&_tr>*]:border-border"
        >
          <colgroup>
            <col />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>Stat</TableHead>
              <TableHead className="text-right" colSpan={2}>
                Total
              </TableHead>
              <TableHead className="text-right" colSpan={2}>
                Last 24h
              </TableHead>
              <TableHead className="text-right" colSpan={2}>
                Last 7d
              </TableHead>
              <TableHead className="text-right" colSpan={2}>
                Last 30d
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROW_DEFS.flatMap((row) => {
              const total = row.render(current);
              const h24 = periods.h24 ? row.render(periods.h24) : EMPTY_CELL;
              const d7 = periods.d7 ? row.render(periods.d7) : EMPTY_CELL;
              const d30 = periods.d30 ? row.render(periods.d30) : EMPTY_CELL;
              const rowEl = (
                <TableRow key={row.label}>
                  <TableCell className="py-1.5! font-medium">{row.label}</TableCell>
                  <PeriodCells cell={total} />
                  <PeriodCells cell={h24} />
                  <PeriodCells cell={d7} />
                  <PeriodCells cell={d30} />
                </TableRow>
              );
              if (row.label !== "Battles") return [rowEl];
              return [
                rowEl,
                <TableRow key="Tier">
                  <TableCell className="py-1.5! font-medium">Tier</TableCell>
                  <PeriodCells cell={tierCell} />
                  <PeriodCells cell={EMPTY_CELL} />
                  <PeriodCells cell={EMPTY_CELL} />
                  <PeriodCells cell={EMPTY_CELL} />
                </TableRow>,
              ];
            })}
            <TableRow key="WN7">
              <TableCell className="py-1.5! font-medium">WN7</TableCell>
              <PeriodCells cell={wn7Cell} />
              <PeriodCells cell={EMPTY_CELL} />
              <PeriodCells cell={EMPTY_CELL} />
              <PeriodCells cell={EMPTY_CELL} />
            </TableRow>
            <TableRow key="WN8">
              <TableCell className="py-1.5! font-medium">WN8</TableCell>
              <PeriodCells cell={wn8Cell} />
              <PeriodCells cell={EMPTY_CELL} />
              <PeriodCells cell={EMPTY_CELL} />
              <PeriodCells cell={EMPTY_CELL} />
            </TableRow>
            <TableRow key="WNX">
              <TableCell className="py-1.5! font-medium">WNX</TableCell>
              <PeriodCells cell={wnxCell} />
              <PeriodCells cell={EMPTY_CELL} />
              <PeriodCells cell={EMPTY_CELL} />
              <PeriodCells cell={EMPTY_CELL} />
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="py-2! font-medium">
                Personal rating
              </TableCell>
              <TableCell
                className="py-2! text-right tabular-nums font-semibold"
                colSpan={2}
              >
                {integerFmt.format(info.global_rating)}
              </TableCell>
              <TableCell colSpan={6} />
            </TableRow>
            <TableRow>
              <TableCell className="py-2! font-medium">
                World of Tanks Rating
              </TableCell>
              <TableCell
                className="py-2! text-right tabular-nums font-semibold"
                colSpan={2}
              >
                {wtr === null ? "—" : integerFmt.format(wtr)}
              </TableCell>
              <TableCell colSpan={6} />
            </TableRow>
          </TableFooter>
        </Table>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
          <div>
            <dt className="inline font-medium">Account created: </dt>
            <dd className="inline">
              {dateFmt.format(new Date(info.created_at * 1000))}
            </dd>
          </div>
          <div className="sm:text-right">
            <dt className="inline font-medium">Last battle: </dt>
            <dd className="inline">
              {dateFmt.format(new Date(info.last_battle_time * 1000))}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
