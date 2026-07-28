import Image from "next/image";
import { CheckIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { EquipmentTooltip } from "./tooltip";
import { categoryColor, overlayFor, type Equipment } from "./category";

/** One device box (image + grade overlay + mounted check + category dots) with
 * its hover tooltip and a right-click Remove when mounted. `activeCat` is the
 * selected slot's category, used to tint the frame while hinting a fit. */
export function DeviceBox({
  e,
  isMounted,
  hint,
  activeCat,
  onClick,
  onRemove,
  tooltipHint,
}: {
  e: Equipment;
  isMounted: boolean;
  hint: boolean;
  activeCat: string | null;
  onClick: () => void;
  onRemove?: () => void;
  tooltipHint?: string;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer"
      aria-label={e.name}
    >
      <span
        className={cn(
          "relative flex size-14 items-center justify-center rounded-lg border-2 transition-colors",
          isMounted
            ? "border-brand/60 bg-brand/10"
            : hint
              ? "hover:bg-fd-secondary/30"
              : "border-fd-border hover:bg-fd-secondary/30",
        )}
        style={
          hint ? { borderColor: categoryColor(activeCat) ?? undefined } : undefined
        }
      >
        {e.image ? (
          <Image
            src={e.image}
            alt=""
            width={30}
            height={30}
            className="object-contain"
            style={{ width: 30, height: 30 }}
          />
        ) : null}
        {overlayFor(e) ? (
          <Image
            src={overlayFor(e)!}
            alt=""
            aria-hidden
            width={28}
            height={28}
            className="pointer-events-none absolute top-0 left-0"
            style={{ width: 28, height: 28 }}
          />
        ) : null}
        {isMounted ? (
          <span className="absolute -right-1.5 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-brand ring-2 ring-fd-background">
            <CheckIcon className="size-2.5 text-white" strokeWidth={3} />
          </span>
        ) : null}
        <span className="absolute -bottom-1 left-1 flex gap-0.5">
          {e.categories.map((c) => (
            <span
              key={c}
              className="size-1.5 rounded-full ring-1 ring-fd-background"
              style={{ backgroundColor: categoryColor(c) ?? "#666" }}
            />
          ))}
        </span>
      </span>
    </button>
  );
  const tip = (
    <TooltipContent side="top" className="max-w-none">
      <EquipmentTooltip equip={e} cycleHint={tooltipHint} />
    </TooltipContent>
  );
  if (!onRemove) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        {tip}
      </Tooltip>
    );
  }
  return (
    <ContextMenu>
      <Tooltip>
        <ContextMenuTrigger asChild>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
        </ContextMenuTrigger>
        {tip}
      </Tooltip>
      <ContextMenuContent>
        <ContextMenuLabel>{e.name}</ContextMenuLabel>
        <ContextMenuItem variant="destructive" onSelect={onRemove}>
          Remove
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
