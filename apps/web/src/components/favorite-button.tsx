"use client";

import { StarIcon } from "@phosphor-icons/react";
import { useSearchHistory, type SearchHistoryItem } from "@/hooks/use-search-history";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FavoriteButton({ item }: { item: SearchHistoryItem }) {
  const { isFavorite, toggleFavorite } = useSearchHistory();
  const fav = isFavorite(item);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => toggleFavorite(item)}
            aria-label={fav ? "Remove from favorites" : "Add to favorites"}
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-fd-border bg-fd-secondary/30 p-1.5 text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground"
          >
            <StarIcon className="size-3.5" weight={fav ? "fill" : "bold"} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{fav ? "Remove from favorites" : "Add to favorites"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
