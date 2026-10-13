"use client";

import { useTranslation } from "@/hooks/use-translation";
import { CardsThreeIcon, RowsIcon } from "@phosphor-icons/react";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/hint";

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
  const { t } = useTranslation("components/tanks/detail/videos/view-toggle");
  return (
    <div className="flex items-center rounded-md border border-fd-border">
      <ViewButton
        active={view === VideosView.Cards}
        onClick={() => onChange(VideosView.Cards)}
        label={t("cards")}
      >
        <CardsThreeIcon className="size-4" />
      </ViewButton>
      <ViewButton
        active={view === VideosView.Table}
        onClick={() => onChange(VideosView.Table)}
        label={t("table")}
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
  const { t } = useTranslation("components/tanks/detail/videos/view-toggle");
  return (
    // The accessible name was "<label> view" with the word written straight
    // into the attribute, which is English on all thirty-six locales and is
    // exactly what nothing renders until a pointer rests on it.
    <Hint content={t("view-named", { view: label })}>
      <button
        type="button"
        onClick={onClick}
        aria-label={t("view-named", { view: label })}
        aria-pressed={active}
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
    </Hint>
  );
}
