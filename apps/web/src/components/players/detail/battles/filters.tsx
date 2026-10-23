"use client";

import { useLocale } from "@onruntime/translations/react";
import { toRoman } from "roman-numerals";
import { BattleResultFilter, modeLabel } from "@unicum.gg/shared";
import { Chip, ChipRow } from "@/components/ui/chip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mapName } from "@/components/game-name";
import { useTranslation } from "@/hooks/use-translation";
import { numberFormat } from "@/lib/format";
import {
  BattleFilterKey,
  type BattleFilterState,
} from "./use-battle-filter";

/** What each filter can be set to for this account, counted. */
export type BattleFacets = {
  modes: { value: number; count: number }[];
  tanks: {
    value: { id: number; name: string; shortName: string; tier: number };
    count: number;
  }[];
  maps: { value: string; count: number }[];
  results: { value: BattleResultFilter; count: number }[];
};

/** The value a select uses for "no filter", which Radix will not take as "". */
const ANY = "any";

/** The bordered box a select sits in, the tank catalogue's own. */
const SELECT_FRAME =
  "flex h-7 items-center overflow-hidden rounded-md border border-fd-border";
const SELECT_TRIGGER =
  "h-full! w-44 rounded-none border-0 bg-transparent px-3 text-xs font-medium text-fd-foreground shadow-none focus-visible:ring-0 dark:bg-transparent dark:hover:bg-fd-secondary/40";

/**
 * The battles list's filters, drawn like the tank catalogue's: one row of
 * small toggles that wraps, rather than a block of its own above the list.
 *
 * The mode and the result are chips, since there are a handful of each; the
 * vehicle and the map are selects, since a player can have fifty maps. A chip
 * toggles, and clicking the one that is on turns the filter off, which is how
 * the catalogue's chips behave too. Every choice is one this account has, and
 * its count is on the chip's tooltip and in the select, so no filter can lead
 * to an empty list.
 */
export function BattleFilters({
  facets,
  filter,
  onChange,
  onClear,
}: {
  facets: BattleFacets;
  filter: BattleFilterState;
  onChange: (key: BattleFilterKey, value: string | null) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation(
    "components/players/detail/overview/battles",
  );
  const { t: tMaps } = useTranslation("game/maps");
  const { locale } = useLocale();
  const count = (n: number) => numberFormat(locale).format(n);
  const battles = (n: number) => t("filter.battles", { count: count(n) });
  // A mode we have no name for is left to the unfiltered list: the rows draw
  // none for it either, and a chip reading as a number would be the site
  // showing its own plumbing.
  const modes = facets.modes.flatMap(({ value, count: n }) => {
    const label = modeLabel(value);
    return label ? [{ value, n, label }] : [];
  });
  const active =
    filter.mode !== undefined ||
    filter.tank !== undefined ||
    filter.map !== undefined ||
    filter.result !== undefined;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
        {/* Only a choice when there is one to make. */}
        {modes.length > 1 ? (
          <ChipRow>
            {modes.map(({ value, n, label }) => (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <Chip
                    active={filter.mode === value}
                    onClick={() =>
                      onChange(
                        BattleFilterKey.Mode,
                        filter.mode === value ? null : String(value),
                      )
                    }
                  >
                    {label}
                  </Chip>
                </TooltipTrigger>
                <TooltipContent>{battles(n)}</TooltipContent>
              </Tooltip>
            ))}
          </ChipRow>
        ) : null}
        {facets.results.length > 1 ? (
          <ChipRow>
            {facets.results.map(({ value, count: n }) => (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <Chip
                    active={filter.result === value}
                    onClick={() =>
                      onChange(
                        BattleFilterKey.Result,
                        filter.result === value ? null : value,
                      )
                    }
                  >
                    {t(`filter.result.${value}`)}
                  </Chip>
                </TooltipTrigger>
                <TooltipContent>{battles(n)}</TooltipContent>
              </Tooltip>
            ))}
          </ChipRow>
        ) : null}
        {facets.tanks.length > 1 ? (
          <div className={SELECT_FRAME}>
            <Select
              value={filter.tank === undefined ? ANY : String(filter.tank)}
              onValueChange={(v) =>
                onChange(BattleFilterKey.Tank, v === ANY ? null : v)
              }
            >
              <SelectTrigger size="sm" className={SELECT_TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t("filter.all-tanks")}</SelectItem>
                {facets.tanks.map(({ value, count: n }) => (
                  <SelectItem key={value.id} value={String(value.id)}>
                    {`${toRoman(value.tier)} ${value.shortName} (${count(n)})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {facets.maps.length > 1 ? (
          <div className={SELECT_FRAME}>
            <Select
              value={filter.map ?? ANY}
              onValueChange={(v) =>
                onChange(BattleFilterKey.Map, v === ANY ? null : v)
              }
            >
              <SelectTrigger size="sm" className={SELECT_TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t("filter.all-maps")}</SelectItem>
                {facets.maps.map(({ value, count: n }) => (
                  <SelectItem key={value} value={value}>
                    {`${mapName(value, value, tMaps)} (${count(n)})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {active ? (
          <button
            type="button"
            onClick={onClear}
            className="text-fd-muted-foreground hover:text-fd-foreground cursor-pointer px-1 underline-offset-2 hover:underline"
          >
            {t("filter.clear")}
          </button>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
