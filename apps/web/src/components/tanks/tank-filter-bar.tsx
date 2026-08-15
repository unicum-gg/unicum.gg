"use client";

import { StarIcon } from "@phosphor-icons/react";
import { forwardRef, type ReactNode } from "react";
import { toRoman } from "roman-numerals";
import { NationFlag, nationLabel } from "@/components/tanks/nation-flag";
import { useRegion } from "@/hooks/use-region";
import { VehicleRoleIcon } from "@/components/tanks/vehicle-role-icon";
import { VehicleTypeIcon } from "@/components/tanks/vehicle-type-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  VEHICLE_CLASS_LABEL_FULL,
  VEHICLE_CLASSES,
  VEHICLE_ROLE_LABEL,
} from "@unicum.gg/shared";
import type { TankFilters } from "@/hooks/use-tank-filters";

const CATEGORY_OPTIONS = [
  { value: "standard", label: "Standard", weight: "regular", color: "text-fd-muted-foreground" },
  { value: "premium", label: "Premium", weight: "fill", color: "text-[#FAB81B]" },
  { value: "reward", label: "Reward", weight: "fill", color: "text-[#4FC4D9]" },
] as const;

// The presentational filter bar: search + tier/nation/type/role/category chips +
// a min/max range on a chosen column. `searchNoun` labels the search placeholder
// and `extra` hosts page-specific controls (e.g. a column selector).
export function TankFilterBar<T>({
  filters,
  searchNoun,
  extra,
}: {
  filters: TankFilters<T>;
  searchNoun: string;
  extra?: ReactNode;
}) {
  const { region } = useRegion();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      <input
        type="text"
        value={filters.query}
        onChange={(e) => filters.setQuery(e.target.value)}
        placeholder={`Search among ${filters.resultCount.toLocaleString("en-US")} ${searchNoun}`}
        className="h-7 w-52 rounded-md border border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:border-fd-ring focus:outline-none"
      />
      <ChipRow>
        {filters.tiers.map((t) => (
          <Chip
            key={t}
            active={filters.tiersSel.has(t)}
            onClick={() => filters.toggleTier(t)}
          >
            {toRoman(t)}
          </Chip>
        ))}
      </ChipRow>
      <ChipRow>
        <TooltipProvider delayDuration={100}>
          {filters.nations.map((n) => (
            <Tooltip key={n}>
              <TooltipTrigger asChild>
                <Chip
                  active={filters.nationsSel.has(n)}
                  onClick={() => filters.toggleNation(n)}
                >
                  <NationFlag nation={n} region={region} className="h-3.5" />
                </Chip>
              </TooltipTrigger>
              <TooltipContent>{nationLabel(n)}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </ChipRow>
      <ChipRow>
        <TooltipProvider delayDuration={100}>
          {VEHICLE_CLASSES.map((c) => (
            <Tooltip key={c}>
              <TooltipTrigger asChild>
                <Chip
                  active={filters.classesSel.has(c)}
                  onClick={() => filters.toggleClass(c)}
                >
                  <VehicleTypeIcon type={c} size={14} />
                </Chip>
              </TooltipTrigger>
              <TooltipContent>{VEHICLE_CLASS_LABEL_FULL[c]}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </ChipRow>
      {filters.roles.length > 0 && (
        <ChipRow>
          <TooltipProvider delayDuration={100}>
            {filters.roles.map((r) => (
              <Tooltip key={r}>
                <TooltipTrigger asChild>
                  <Chip
                    active={filters.rolesSel.has(r)}
                    onClick={() => filters.toggleRole(r)}
                  >
                    <VehicleRoleIcon role={r} size={14} />
                  </Chip>
                </TooltipTrigger>
                <TooltipContent>{VEHICLE_ROLE_LABEL[r]}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </ChipRow>
      )}
      <ChipRow>
        <TooltipProvider delayDuration={100}>
          {CATEGORY_OPTIONS.map((o) => (
            <Tooltip key={o.value}>
              <TooltipTrigger asChild>
                <Chip
                  active={filters.categorySel.has(o.value)}
                  onClick={() => filters.toggleCategory(o.value)}
                >
                  <StarIcon weight={o.weight} className={cn("size-3.5", o.color)} />
                </Chip>
              </TooltipTrigger>
              <TooltipContent>{o.label}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </ChipRow>
      <div className="flex h-7 items-center overflow-hidden rounded-md border border-fd-border">
        <Select value={filters.activeRangeCol?.key} onValueChange={filters.setRangeCol}>
          <SelectTrigger
            size="sm"
            className="h-full! w-32 rounded-none border-0 bg-transparent px-3 text-xs font-medium text-fd-foreground shadow-none focus-visible:ring-0 dark:bg-transparent dark:hover:bg-fd-secondary/40"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filters.rangeCols.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="number"
          value={filters.minVal}
          onChange={(e) => filters.setMinVal(e.target.value)}
          placeholder="Min"
          className="h-full w-20 border-l border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:outline-none"
        />
        <input
          type="number"
          value={filters.maxVal}
          onChange={(e) => filters.setMaxVal(e.target.value)}
          placeholder="Max"
          className="h-full w-20 border-l border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:outline-none"
        />
      </div>
      {extra}
    </div>
  );
}

export function ChipRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-fit max-w-full overflow-x-auto rounded-md border border-fd-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const Chip = forwardRef<
  HTMLButtonElement,
  { active: boolean } & React.ComponentProps<"button">
>(({ active, className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    {...props}
    className={cn(
      "cursor-pointer whitespace-nowrap border-r border-fd-border px-3 py-1.5 font-medium transition-colors last:border-r-0",
      active
        ? "bg-fd-secondary/50 text-fd-foreground"
        : "text-fd-muted-foreground hover:bg-fd-secondary/25 hover:text-fd-foreground",
      className,
    )}
  >
    {children}
  </button>
));
Chip.displayName = "Chip";
