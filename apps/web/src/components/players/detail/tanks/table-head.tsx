"use client";

import { statLabel } from "@/components/stat-label";
import { TableHeader, TableRow } from "@/components/ui/table";
import type {
  PlayerColumn,
  PlayerSortCtx,
} from "@/components/players/detail/tanks/vehicle-columns";
import { TankopediaHeaderIcon } from "@/components/tanks/tankopedia-header-icon";
import { useTranslation } from "@/hooks/use-translation";
import { useStatLabels } from "@/hooks/use-stat-labels";
import { SortableHead, type SortState } from "@/components/tanks/sortable-head";

/** The garage table's header: the four identity columns, then the reader's. */
export function PlayerTanksTableHead({
  sort,
  onToggle,
  columns,
  sortCtx,
}: {
  sort: SortState;
  onToggle: (key: string) => void;
  columns: PlayerColumn[];
  /** The rating and mark columns rename themselves after the reader's own
   * choice, so their heading reads it. */
  sortCtx: PlayerSortCtx;
}) {
  const { t: tStats } = useStatLabels();
  const { t } = useTranslation("components/players/detail/tanks/table");
  const { t: tTable } = useTranslation("components/tanks/table");
  return (
    <TableHeader>
      <TableRow>
        <SortableHead
          col="nation"
          state={sort}
          onToggle={onToggle}
          align="center"
          hideOnMobile
          headClassName="w-px"
          tooltip={tTable("nation")}
        >
          <TankopediaHeaderIcon name="nation" />
        </SortableHead>
        <SortableHead
          col="type"
          state={sort}
          onToggle={onToggle}
          align="center"
          hideOnMobile
          headClassName="w-px"
          tooltip={tTable("type")}
        >
          <TankopediaHeaderIcon name="type" />
        </SortableHead>
        <SortableHead
          col="tier"
          state={sort}
          onToggle={onToggle}
          align="center"
          hideOnMobile
          headClassName="w-px"
          tooltip={tTable("tier")}
        >
          <span className="whitespace-nowrap text-xs font-medium tracking-tight text-fd-muted-foreground">
            I-XI
          </span>
        </SortableHead>
        <SortableHead col="name" state={sort} onToggle={onToggle}>
          {t("name")}</SortableHead>
        {columns.map((c) => (
          <SortableHead
            key={c.key}
            col={c.key}
            state={sort}
            onToggle={onToggle}
            align={c.align}
            hideOnMobile={c.hideOnMobile}
            tooltip={statLabel(c.tip, tStats)}
          >
            {statLabel(c.header ? c.header(sortCtx) : c.label, tStats)}
          </SortableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}
