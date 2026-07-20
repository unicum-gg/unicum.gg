import Image from "next/image";
import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  slotCategory,
  categoryColor,
  earnsCategoryBonus,
  overlayFor,
  type Slot,
  type Equipment,
} from "./category";

/** One equipment slot: an empty dashed frame (tinted by the slot's category as a
 * hint) or the mounted device, with a category-bonus "+" badge when the device
 * actually earns the bonus. */
export function SlotBox({
  slot,
  roleCat,
  equip,
}: {
  slot: Slot;
  roleCat: string | null;
  equip: Equipment | null;
}) {
  const cat = slotCategory(slot, roleCat);
  const color = categoryColor(cat);
  const bonus = equip ? earnsCategoryBonus(equip, cat) : false;
  // Tint the frame by the slot's category only when the specialization is
  // relevant: as a hint on an empty slot, or when the mounted device actually
  // earns the bonus. A bond/bounty device (flat, no bonus) keeps a neutral
  // frame so the colour never implies a bonus that isn't applied.
  const framed = !equip || bonus;
  return (
    <div
      className={cn(
        "relative flex size-14 items-center justify-center rounded-lg border-2",
        equip ? "border-solid bg-fd-secondary/30" : "border-dashed",
      )}
      style={{ borderColor: (framed ? color : null) ?? "var(--color-fd-border)" }}
    >
      {equip && overlayFor(equip) ? (
        <Image
          src={overlayFor(equip)!}
          alt=""
          aria-hidden
          width={28}
          height={28}
          className="pointer-events-none absolute top-0 left-0"
          style={{ width: 28, height: 28 }}
        />
      ) : null}
      {equip && equip.image ? (
        <div className="relative">
          <Image
            src={equip.image}
            alt=""
            width={28}
            height={28}
            className="object-contain"
            style={{ width: 28, height: 28 }}
          />
          {bonus && color ? (
            <span
              className="absolute -right-2.5 -top-2.5 rounded-full px-1 text-[9px] font-bold text-white"
              style={{ backgroundColor: color }}
              title="Category bonus active"
            >
              +
            </span>
          ) : null}
        </div>
      ) : (
        <PlusIcon className="size-5 text-fd-muted-foreground" />
      )}
    </div>
  );
}
