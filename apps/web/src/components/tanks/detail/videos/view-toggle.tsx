"use client";

import { useTranslation } from "@/hooks/use-translation";
import { CardsThreeIcon, RowsIcon } from "@phosphor-icons/react";
import STORAGE from "@/constants/storage";
import { useCookie } from "@/hooks/use-cookie";
import { SegmentedControl } from "@/components/segmented-control";

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
    <SegmentedControl
      active={view}
      onSelect={onChange}
      segments={[
        {
          id: VideosView.Cards,
          label: t("cards"),
          icon: <CardsThreeIcon className="size-4" />,
          tooltip: t("view-named", { view: t("cards") }),
        },
        {
          id: VideosView.Table,
          label: t("table"),
          icon: <RowsIcon className="size-4" />,
          tooltip: t("view-named", { view: t("table") }),
        },
      ]}
    />
  );
}
