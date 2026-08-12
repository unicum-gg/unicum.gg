"use client";

import { CardsThreeIcon, RowsIcon } from "@phosphor-icons/react";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { cn } from "@/lib/utils";

export enum VideosView {
  Cards = "cards",
  Table = "table",
}

/**
 * Cards or table, remembered across pages.
 *
 * One preference for both lists, the tank's own tab and the community index:
 * someone who prefers to scan a table prefers it in both places, and two
 * cookies for the same choice would drift.
 */
export function useVideosView(): [VideosView, (view: VideosView) => void] {
  const [stored, setStored] = useCookie(
    STORAGE.COOKIES.VIDEO_VIEW,
    VideosView.Cards,
  );
  const view = stored === VideosView.Table ? VideosView.Table : VideosView.Cards;
  return [view, setStored];
}

export function VideosViewToggle({
  view,
  onChange,
}: {
  view: VideosView;
  onChange: (view: VideosView) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-fd-border">
      <ViewButton
        active={view === VideosView.Cards}
        onClick={() => onChange(VideosView.Cards)}
        label="Cards"
      >
        <CardsThreeIcon className="size-4" />
      </ViewButton>
      <ViewButton
        active={view === VideosView.Table}
        onClick={() => onChange(VideosView.Table)}
        label="Table"
      >
        <RowsIcon className="size-4" />
      </ViewButton>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} view`}
      aria-pressed={active}
      title={`${label} view`}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors first:rounded-l-md last:rounded-r-md",
        active
          ? "bg-fd-secondary/50 text-fd-foreground"
          : "text-fd-muted-foreground hover:text-fd-foreground",
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
