"use client";

import { useLocale } from "@onruntime/translations/react";
import { numberFormat } from "@/lib/format";

import { statLabel } from "@/components/stat-label";

import { StarIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
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
import { Chip, ChipRow } from "@/components/ui/chip";
import { MOE_COLORS, MoEIcon } from "@/components/tanks/moe-icon";
import { MoMIcon } from "@/components/tanks/mom-icon";
import { cn } from "@/lib/utils";
import {
  VEHICLE_CLASSES,
} from "@unicum.gg/shared";
import type { TankFilters } from "@/hooks/use-tank-filters";
import { useTranslation } from "@/hooks/use-translation";
import type { FilterSubject } from "@/components/filter-subject";

const CATEGORY_OPTIONS = [
  { value: "standard", weight: "regular", color: "text-fd-muted-foreground" },
  { value: "premium", weight: "fill", color: "text-[#FAB81B]" },
  { value: "reward", weight: "fill", color: "text-[#4FC4D9]" },
] as const;

// The presentational filter bar: search + tier/nation/type/role/category chips +
// a min/max range on a chosen column. `searchNoun` labels the search placeholder
// and `extra` hosts page-specific controls (e.g. a column selector).
// Values only: each one names itself through `components/filter-bar`, where a
// mark count reads as the sentence its language wants rather than a number and
// an English noun glued together.
const MOE_OPTIONS = [0, 1, 2, 3] as const;
const MOM_OPTIONS = [0, 1, 2, 3, 4] as const;

export function TankFilterBar<T>({
  filters,
  searchNoun,
  extra,
}: {
  filters: TankFilters<T>;
  /** What the list holds, as a key into `components/filter-bar`: the
   * placeholder is a whole sentence per subject rather than a count and a noun
   * concatenated, which only reads in English. */
  searchNoun: FilterSubject;
  extra?: ReactNode;
}) {
  const { locale } = useLocale();
  const { t: tStats } = useTranslation("components/stat-labels");
  const { region } = useRegion();
  const { t } = useTranslation("components/filter-bar");
  const { t: tOwn } = useTranslation("components/tanks/tank-filter-bar");
  const { t: tGame } = useTranslation("game/vocabulary");
  const { t: tClasses } = useTranslation("game/vehicle-classes");
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      <input
        type="text"
        value={filters.query}
        onChange={(e) => filters.setQuery(e.target.value)}
        placeholder={t(`search.${searchNoun}`, {
          count: numberFormat(locale).format(filters.resultCount),
        })}
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
              <TooltipContent>{tClasses(c)}</TooltipContent>
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
                <TooltipContent>{tGame(`vehicle-roles.${r}`)}</TooltipContent>
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
              <TooltipContent>{t(`category.${o.value}`)}</TooltipContent>
            </Tooltip>
          ))}
          {/* Only while a test is running: it filters on a state that does not
              otherwise exist, so an always-present chip would read as broken. */}
          {filters.hasTestChanges && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Chip
                  active={filters.testOnly}
                  onClick={() => filters.setTestOnly(!filters.testOnly)}
                >
                  <span className="text-[11px] font-bold tracking-wide text-brand">
                    {tOwn("ct")}</span>
                </Chip>
              </TooltipTrigger>
              <TooltipContent>
                {t("common-test")}
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </ChipRow>
      {/* Marks and badges: only a player's own garage carries them, so on the
          catalogue these rows are not there at all rather than being present
          and inert. "None" is a value like any other, since "which of my tanks
          are still unmarked" is the question the profile's matrix links here
          to answer. */}
      {filters.hasMoe && (
        <ChipRow>
          <TooltipProvider delayDuration={100}>
            {MOE_OPTIONS.map((value) => (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <Chip
                    active={filters.moeSel.has(value)}
                    onClick={() => filters.toggleMoe(value)}
                  >
                    {value === 0 ? (
                      <span className="text-[11px] font-medium">
                        {t("none")}
                      </span>
                    ) : (
                      <MoEIcon
                        bars={value as 1 | 2 | 3}
                        color={MOE_COLORS[value as 1 | 2 | 3]}
                      />
                    )}
                  </Chip>
                </TooltipTrigger>
                <TooltipContent>{t(`moe.${value}`)}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </ChipRow>
      )}
      {filters.hasMom && (
        <ChipRow>
          <TooltipProvider delayDuration={100}>
            {MOM_OPTIONS.map((value) => (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <Chip
                    active={filters.momSel.has(value)}
                    onClick={() => filters.toggleMom(value)}
                  >
                    {value === 0 ? (
                      <span className="text-[11px] font-medium">
                        {t("none")}
                      </span>
                    ) : (
                      <MoMIcon
                        mastery={value as 1 | 2 | 3 | 4}
                        className="h-3.5"
                      />
                    )}
                  </Chip>
                </TooltipTrigger>
                <TooltipContent>{t(`mom.${value}`)}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </ChipRow>
      )}
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
                {statLabel(c.label, tStats)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="number"
          value={filters.minVal}
          onChange={(e) => filters.setMinVal(e.target.value)}
          placeholder={t("min")}
          className="h-full w-20 border-l border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:outline-none"
        />
        <input
          type="number"
          value={filters.maxVal}
          onChange={(e) => filters.setMaxVal(e.target.value)}
          placeholder={t("max")}
          className="h-full w-20 border-l border-fd-border bg-transparent px-3 text-xs text-fd-foreground placeholder:text-fd-muted-foreground focus:outline-none"
        />
      </div>
      {extra}
    </div>
  );
}

