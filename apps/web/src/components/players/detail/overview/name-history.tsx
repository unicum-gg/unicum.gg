import { useLocale } from "@onruntime/translations/react";
import { dateLocale } from "@/lib/date-locale";
import { useTranslation } from "@/hooks/use-translation";
import { format } from "date-fns";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { NameHistoryEntry } from "@unicum.gg/shared";

const DAY_FORMAT = "d MMM yyyy";

/**
 * A player's previous nicknames, newest first. Only rendered when at least one
 * rename has been observed (WG exposes no history, so this fills over time). The
 * date is when the name stopped being current.
 */
export function PlayerNameHistory({
  history,
  nickname,
}: {
  history: NameHistoryEntry[];
  nickname: string;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/players/detail/overview/name-history");
  if (history.length === 0) return null;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{t("previous-names", { nickname })}</PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <Table className="my-0! border-t border-fd-border [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!">
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead className="w-32 text-right!">{t("changed")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((entry, i) => (
              <TableRow key={`${entry.nickname}-${i}`}>
                <TableCell className="font-medium">{entry.nickname}</TableCell>
                <TableCell className="text-right text-xs tabular-nums text-fd-muted-foreground">
                  {format(entry.recordedAt, DAY_FORMAT, { locale: dateLocale(locale) })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </PanelContent>
    </Panel>
  );
}
