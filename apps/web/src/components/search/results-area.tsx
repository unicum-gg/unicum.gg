"use client";

import { StarIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import {
  ClanRow,
  GlossaryRow,
  MapRow,
  PlayerRow,
  TankRow,
} from "@/components/search/rows";
import type {
  HistoryRow,
  ResultsStatus,
  Row,
  SelectableRow,
} from "@/components/search/row-model";
import { cn } from "@/lib/utils";

export function ResultsArea({
  status,
  rows,
  activeIndex,
  onPick,
  onHover,
  isFavorite,
  onToggleFavorite,
  onRemoveRecent,
}: {
  status: ResultsStatus;
  rows: Row[];
  activeIndex: number;
  onPick: (row: SelectableRow) => void;
  onHover: (index: number) => void;
  isFavorite: (row: HistoryRow) => boolean;
  onToggleFavorite: (row: HistoryRow) => void;
  onRemoveRecent: (row: HistoryRow) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-row-index="${activeIndex}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (rows.length > 0) {
    // Numbered up front rather than counted inside the map: the headers are
    // rows too but cannot be selected, so the keyboard index only advances on
    // the ones that can, and a counter mutated from inside a render callback is
    // a closure the compiler has to assume runs later.
    const selectable = new Map<string, number>();
    for (const row of rows) {
      if (row.type !== "header") selectable.set(row.key, selectable.size);
    }
    return (
      <ul
        ref={listRef}
        className="max-h-96 overflow-y-auto border-t border-fd-border py-1"
      >
        {rows.map((row) => {
          if (row.type === "header") {
            return (
              <li key={row.key}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fd-muted-foreground">
                  {row.label}
                </div>
              </li>
            );
          }
          const idx = selectable.get(row.key) ?? -1;
          const isActive = idx === activeIndex;
          // Every result row can be favorited / kept in recent.
          const historyRow: HistoryRow = row;
          const fav = isFavorite(historyRow);
          return (
            <li
              key={row.key}
              className={cn(
                "group flex items-center rounded transition-colors",
                isActive
                  ? "bg-fd-accent text-fd-accent-foreground"
                  : "text-fd-foreground/90",
              )}
              onMouseEnter={() => onHover(idx)}
            >
              <button
                type="button"
                data-row-index={idx}
                onClick={() => onPick(row)}
                // `min-w-0` so a long row (a term and its definition) shrinks
                // instead of pushing its own meta column and star out of the
                // dialog: a flex item's floor is its content width otherwise.
                className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm"
              >
                <RowContent row={row} />
              </button>
              <div className="flex shrink-0 items-center gap-1 pr-2">
                {historyRow.isRecent ? (
                  <RowActionButton
                    onClick={() => onRemoveRecent(historyRow)}
                    label="Remove from recent"
                  >
                    <XIcon className="size-3.5" weight="bold" />
                  </RowActionButton>
                ) : null}
                <RowActionButton
                  onClick={() => onToggleFavorite(historyRow)}
                  label={fav ? "Remove from favorites" : "Add to favorites"}
                >
                  <StarIcon
                    className={cn("size-3.5", fav ? "text-fd-primary" : "")}
                    weight={fav ? "fill" : "regular"}
                  />
                </RowActionButton>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  if (status.anyLoading) return <Status>Searching…</Status>;
  if (status.allErrored) return <Status>Something went wrong. Try again.</Status>;
  if (status.allEmpty) return <Status>No results found</Status>;
  return null;
}

function RowContent({ row }: { row: SelectableRow }) {
  switch (row.type) {
    case "player":
      return <PlayerRow player={row.player} />;
    case "clan":
      return <ClanRow clan={row.clan} />;
    case "tank":
      return <TankRow tank={row.tank} region={row.region} />;
    case "map":
      return <MapRow map={row.map} />;
    case "glossary":
      return <GlossaryRow term={row.term} />;
  }
}

function RowActionButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-fd-muted-foreground hover:bg-fd-border/50 hover:text-fd-foreground"
    >
      {children}
    </button>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-fd-border px-4 py-6 text-center text-sm text-fd-muted-foreground">
      {children}
    </div>
  );
}
