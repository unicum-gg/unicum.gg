import { useLocale } from "@onruntime/translations/react";
import { dateLocale } from "@/lib/date-locale";
import { useTranslation } from "@/hooks/use-translation";
import { Interpolate } from "@/components/interpolate";
import { format } from "date-fns";
import { ClanTag } from "@/components/entity/clan-tag";
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
import type { ClanNameHistoryEntry } from "@unicum.gg/core/clans/name-history";

const DAY_FORMAT = "d MMM yyyy";

/**
 * A clan's previous tags + names, newest first. Only rendered once a rename has
 * been observed; the date is when that tag/name stopped being current.
 */
export function ClanNameHistory({
  history,
  tag,
  color,
}: {
  history: ClanNameHistoryEntry[];
  tag: string;
  color: string;
}) {
  const { locale } = useLocale();
  const { t } = useTranslation("components/clans/detail/name-history");
  if (history.length === 0) return null;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          <Interpolate
            template={t("title")}
            values={{ clan: <ClanTag tag={tag} color={color} /> }}
          />
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <Table className="my-0! border-t border-fd-border [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!">
          <TableHeader>
            <TableRow>
              <TableHead>{t("tag")}</TableHead>
              <TableHead>{t("name")}</TableHead>
              <TableHead className="w-32 text-right!">{t("changed")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((entry, i) => (
              <TableRow key={`${entry.tag}-${i}`}>
                <TableCell className="font-medium">{entry.tag}</TableCell>
                <TableCell className="text-fd-muted-foreground">
                  {entry.name}
                </TableCell>
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
