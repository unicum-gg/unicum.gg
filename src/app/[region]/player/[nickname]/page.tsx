import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  findPlayerByNickname,
  getPlayerInfo,
  isRegion,
  REGION_LABEL,
  type PlayerStatistics,
} from "@/services/wargaming";

const integerFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimalFmt = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFmt = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

type DotColor = "emerald" | "red" | "amber";

const DOT_CLASS: Record<DotColor, string> = {
  emerald: "bg-emerald-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
};

function ratio(n: number, d: number): string {
  return d === 0 ? "—" : decimalFmt.format(n / d);
}

function percent(n: number, d: number): string {
  return d === 0 ? "—" : percentFmt.format(n / d);
}

type Row = {
  label: string;
  total: string;
  avg?: string;
  dotColor?: DotColor;
};

function buildRows(s: PlayerStatistics): Row[] {
  const aliveBattles = s.battles - s.survived_battles;
  return [
    { label: "Nombre de batailles", total: integerFmt.format(s.battles) },
    {
      label: "Victoires",
      total: integerFmt.format(s.wins),
      avg: percent(s.wins, s.battles),
      dotColor: "emerald",
    },
    {
      label: "Défaites",
      total: integerFmt.format(s.losses),
      avg: percent(s.losses, s.battles),
      dotColor: "red",
    },
    {
      label: "Égalités",
      total: integerFmt.format(s.draws),
      avg: percent(s.draws, s.battles),
      dotColor: "amber",
    },
    {
      label: "Batailles survécues",
      total: integerFmt.format(s.survived_battles),
      avg: percent(s.survived_battles, s.battles),
      dotColor: "emerald",
    },
    {
      label: "Détruits",
      total: integerFmt.format(s.frags),
      avg: ratio(s.frags, s.battles),
    },
    {
      label: "Ratio tués/morts",
      total: ratio(s.frags, aliveBattles),
    },
    {
      label: "Détectés",
      total: integerFmt.format(s.spotted),
      avg: ratio(s.spotted, s.battles),
    },
    {
      label: "Dégâts causés",
      total: integerFmt.format(s.damage_dealt),
      avg: decimalFmt.format(s.battles === 0 ? 0 : s.damage_dealt / s.battles),
    },
    {
      label: "Capture de base",
      total: integerFmt.format(s.capture_points),
      avg: ratio(s.capture_points, s.battles),
    },
    {
      label: "Défense de base",
      total: integerFmt.format(s.dropped_capture_points),
      avg: ratio(s.dropped_capture_points, s.battles),
    },
    {
      label: "Expérience moyenne",
      total: integerFmt.format(s.battle_avg_xp),
    },
    {
      label: "Taux de réussite des tirs",
      total: integerFmt.format(s.hits),
      avg: `${s.hits_percents}%`,
      dotColor: s.hits_percents >= 65 ? "emerald" : "amber",
    },
  ];
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

  const rows = buildRows(info.statistics.all);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="mb-8 flex flex-col gap-2">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour
        </Link>
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-4xl font-bold tracking-tight">
            {info.nickname}
          </h1>
          <Badge variant="outline">{REGION_LABEL[region]}</Badge>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
          <div>
            <dt className="inline font-medium">Compte créé : </dt>
            <dd className="inline">
              {dateFmt.format(new Date(info.created_at * 1000))}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Dernière bataille : </dt>
            <dd className="inline">
              {dateFmt.format(new Date(info.last_battle_time * 1000))}
            </dd>
          </div>
        </dl>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Statistiques globales</h2>
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>Statistique</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Moyenne / %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.total}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.avg ? (
                    row.dotColor ? (
                      <Badge variant="outline">
                        <span
                          aria-hidden="true"
                          className={`size-1.5 rounded-full ${DOT_CLASS[row.dotColor]}`}
                        />
                        {row.avg}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{row.avg}</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium" colSpan={2}>
                Note globale
              </TableCell>
              <TableCell className="text-right tabular-nums font-semibold">
                {integerFmt.format(info.global_rating)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </section>
    </div>
  );
}
