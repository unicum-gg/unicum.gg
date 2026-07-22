"use client";

import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { HoverPrefetchLink as Link } from "@/components/hover-prefetch-link";
import ROUTES from "@/constants/routes";
import { cn } from "@/lib/utils";
import type { Region } from "@unicum.gg/wargaming";
import type { CompareSlot } from "./comparison-table";
import { PlayerSearchPopover } from "./player-search-popover";

export function SlotHeader({
  region,
  slots,
  canAddMore,
  onRemove,
  onAdd,
}: {
  region: Region;
  slots: CompareSlot[];
  canAddMore: boolean;
  onRemove: (idx: number) => void;
  onAdd: (nickname: string) => void;
}) {
  const canRemove = slots.length > 2;
  const excludeKeys = new Set(slots.map((s) => s.requested.toLowerCase()));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {slots.map((slot, idx) => (
        <div
          key={`${slot.requested}-${idx}`}
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-fd-border bg-fd-secondary/30 py-1 pl-3 text-sm",
            canRemove ? "pr-1" : "pr-3",
          )}
        >
          <Link
            href={ROUTES.PLAYER(region, slot.requested)}
            className="font-medium hover:underline"
          >
            {slot.player?.nickname ?? slot.requested}
          </Link>
          {!slot.player && (
            <span className="text-xs text-destructive">not found</span>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(idx)}
              aria-label={`Remove ${slot.requested}`}
              className="inline-flex size-5 cursor-pointer items-center justify-center rounded-full text-fd-muted-foreground hover:bg-fd-border/50 hover:text-fd-foreground"
            >
              <XIcon className="size-3" weight="bold" />
            </button>
          )}
        </div>
      ))}
      {canAddMore && (
        <PlayerSearchPopover
          region={region}
          excludeKeys={excludeKeys}
          onPick={onAdd}
          triggerAriaLabel="Add player"
          triggerClassName="inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-fd-border bg-fd-secondary/30 text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground"
          triggerContent={<PlusIcon className="size-3.5" weight="bold" />}
        />
      )}
    </div>
  );
}
