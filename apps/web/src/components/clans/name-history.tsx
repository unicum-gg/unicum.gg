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
import type { ClanNameHistoryEntry } from "@unicum.gg/core/clans/name-history";

const DAY_FORMAT = "MMM d, yyyy";

/**
 * A clan's previous tags + names, newest first. Only rendered once a rename has
 * been observed; the date is when that tag/name stopped being current.
 */
export function ClanNameHistory({
  history,
}: {
  history: ClanNameHistoryEntry[];
}) {
  if (history.length === 0) return null;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Previous names</PanelTitle>
      </PanelHeader>
      <PanelContent className="p-0">
        <Table className="my-0! border-t border-fd-border [&_tbody_td:first-child]:pl-4! [&_tbody_td:last-child]:pr-4! [&_thead_th:first-child]:pl-4! [&_thead_th:last-child]:pr-4!">
          <TableHeader>
            <TableRow>
              <TableHead>Tag</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Changed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((entry, i) => (
              <TableRow key={`${entry.tag}-${i}`}>
                <TableCell className="font-medium">{entry.tag}</TableCell>
                <TableCell className="text-fd-muted-foreground">
                  {entry.name}
                </TableCell>
                <TableCell className="text-right tabular-nums text-fd-muted-foreground">
                  {format(entry.recordedAt, DAY_FORMAT)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </PanelContent>
    </Panel>
  );
}
