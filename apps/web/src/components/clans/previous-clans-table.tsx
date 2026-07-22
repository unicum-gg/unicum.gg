import Image from "next/image";
import { HoverPrefetchLink as Link } from "@/components/hover-prefetch-link";
import { LanguageFlags } from "@/components/language-flags";
import { RankMedal } from "@/components/rank-medal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { PreviousClanRow } from "@/services/clans/previous-clans";
import type { Region } from "@unicum.gg/wargaming";

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function PreviousClansTable(
  props: { loading: true } | { region: Region; rows: PreviousClanRow[] },
) {
  const loading = "loading" in props;
  if (!loading && props.rows.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        No previous-clan history recorded for the current roster.
      </div>
    );
  }
  return (
    <Table
      className={cn(
        "my-0! table-fixed",
        "[&_td]:min-w-0 [&_td]:py-2!",
        "[&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4!",
        "[&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!",
      )}
    >
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-center!">#</TableHead>
          <TableHead>Clan</TableHead>
          <TableHead className="w-20 text-right!">Total</TableHead>
          <TableHead className="w-28 whitespace-nowrap text-right!">
            Came from
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i}>
                <TableCell className="text-center">
                  <Skeleton className="mx-auto h-4 w-4" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-6 shrink-0 rounded" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-10" />
                </TableCell>
                <TableCell className="text-right">
                  <Skeleton className="ml-auto h-4 w-10" />
                </TableCell>
              </TableRow>
            ))
          : props.rows.map((r, i) => {
          const rank = i + 1;
          return (
            <TableRow key={r.clanId}>
              <TableCell className="text-center text-muted-foreground tabular-nums">
                {rank <= 3 ? (
                  <RankMedal rank={rank as 1 | 2 | 3} className="mx-auto" />
                ) : (
                  rank
                )}
              </TableCell>
              <TableCell>
                <Link
                  href={ROUTES.CLAN(props.region, r.tag)}
                  className="flex items-center gap-3 hover:underline"
                >
                  {r.emblem ? (
                    <Image
                      src={r.emblem}
                      alt=""
                      width={24}
                      height={24}
                      className="size-6 shrink-0 rounded"
                    />
                  ) : (
                    <span className="size-6 shrink-0 rounded bg-muted" />
                  )}
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono font-semibold">
                        <span style={{ color: r.color }}>[</span>
                        {r.tag}
                        <span style={{ color: r.color }}>]</span>
                      </span>{" "}
                      <span className="text-muted-foreground">{r.name}</span>
                    </span>
                    {r.languages.length > 0 && (
                      <span className="hidden h-4 shrink-0 sm:inline-flex">
                        <LanguageFlags
                          languages={r.languages}
                          source="declared"
                          size="s"
                          region={props.region}
                          link={false}
                        />
                      </span>
                    )}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {intFmt.format(r.totalCount)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {r.cameFromCount > 0 ? intFmt.format(r.cameFromCount) : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
