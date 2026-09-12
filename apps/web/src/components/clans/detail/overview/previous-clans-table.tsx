import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";
import { ClanName } from "@/components/entity/clan-name";
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
import { cn } from "@/lib/utils";
import type { PreviousClanRow } from "@/services/clans/previous-clans";
import type { Region } from "@unicum.gg/wargaming";
import { useTranslation } from "@/hooks/use-translation";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

export function PreviousClansTable(
  props: { loading: true } | { region: Region; rows: PreviousClanRow[] },
) {
  const { locale } = useLocale();
  const { t } = useTranslation(
    "components/clans/detail/overview/previous-clans-table",
  );
  const loading = "loading" in props;
  if (!loading && props.rows.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        {t("no-previous-clan-history-recorded")}</div>
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
          <TableHead className="w-12 text-center!">{t("rank")}</TableHead>
          <TableHead>{t("clan")}</TableHead>
          <TableHead className="w-20 text-right!">{t("total")}</TableHead>
          <TableHead className="w-28 whitespace-nowrap text-right!">
            {t("came-from")}
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
                <ClanName
                  region={props.region}
                  clan={{ tag: r.tag, color: r.color, name: r.name, emblem: r.emblem }}
                  showEmblem
                  showName
                  size={14}
                  trailing={
                    r.languages.length > 0 ? (
                      <span className="ml-auto hidden h-4 shrink-0 sm:inline-flex">
                        <LanguageFlags
                          languages={r.languages}
                          source="declared"
                          size="s"
                          region={props.region}
                          link={false}
                        />
                      </span>
                    ) : null
                  }
                />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {numberFormat(locale, INT_FORMAT).format(r.totalCount)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {r.cameFromCount > 0 ? numberFormat(locale, INT_FORMAT).format(r.cameFromCount) : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
