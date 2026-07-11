"use client";

import { StarIcon } from "@phosphor-icons/react";
import { useSearchParams } from "next/navigation";
import {
  type Dispatch,
  forwardRef,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toRoman } from "roman-numerals";
import { NationFlag, nationLabel } from "@/components/players/nation-flag";
import { VehicleRoleIcon } from "@/components/players/vehicle-role-icon";
import { VehicleTypeIcon } from "@/components/players/vehicle-type-icon";
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
  VEHICLE_ROLES,
  roleSuffix,
} from "@unicum.gg/core/constants/tanks";

// The minimal shape any filterable tank/vehicle row must expose. Both the tanks
// catalogue (`TankListItem`) and a player's vehicles (`PlayerVehicleRow`)
// satisfy it, so the same filter bar drives both.
export type FilterableTank = {
  tier: number | null;
  nation: string | null;
  type: string | null;
  role: string | null;
  isPremium: boolean;
  isReward: boolean;
  name: string;
  shortName: string | null;
};

// A numeric column the min/max range filter can target. Supplied by the caller
// so each page ranges over its own columns (catalogue stats vs player stats).
export type RangeColumn<T> = {
  key: string;
  label: string;
  value: (t: T) => number | null;
};

// Toggle a value in a Set-backed filter (immutable update for React). An empty
// set means "no filter" (all pass); any selection narrows to those values.
function toggleSet<T>(setter: Dispatch<SetStateAction<Set<T>>>, value: T) {
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  });
}

export type TankFilters<T> = {
  query: string;
  setQuery: (v: string) => void;
  tiersSel: Set<number>;
  toggleTier: (t: number) => void;
  nationsSel: Set<string>;
  toggleNation: (n: string) => void;
  classesSel: Set<string>;
  toggleClass: (c: string) => void;
  rolesSel: Set<string>;
  toggleRole: (r: string) => void;
  categorySel: Set<string>;
  toggleCategory: (c: string) => void;
  rangeCol: string;
  setRangeCol: (k: string) => void;
  minVal: string;
  setMinVal: (v: string) => void;
  maxVal: string;
  setMaxVal: (v: string) => void;
  // Reset the range filter (column + bounds) — used when the active tab swaps
  // the set of range columns out from under it.
  resetRange: (col: string) => void;
  // Derived from the catalogue so the chips always match reality.
  tiers: number[];
  nations: string[];
  roles: string[];
  rangeCols: RangeColumn<T>[];
  activeRangeCol: RangeColumn<T> | undefined;
  resultCount: number;
};

// All the filter state + the filtered list. Sorting is left to the caller (the
// tables own their own sort), so this only narrows the set.
const parseSet = (v: string | null): Set<string> =>
  new Set((v ?? "").split(",").filter(Boolean));
const parseNumSet = (v: string | null): Set<number> =>
  new Set(
    (v ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n)),
  );
const setStr = (s: Set<string> | Set<number>): string => [...s].join(",");

export function useTankFilters<T extends FilterableTank>(
  items: T[],
  rangeColumns: RangeColumn<T>[],
  initialRangeCol: string,
): { filtered: T[]; filters: TankFilters<T> } {
  // Filters live in the URL (?q=&tier=&nation=&class=&role=&cat=&rc=&min=&max=)
  // so a filtered view is shareable, bookmarkable, and survives a reload. State
  // seeds from the query string; changes are written back (merged with any other
  // params like ?tab=/?section=) via replaceState — no history spam, no reload.
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [rangeCol, setRangeCol] = useState(
    () => searchParams.get("rc") ?? initialRangeCol,
  );
  const [minVal, setMinVal] = useState(() => searchParams.get("min") ?? "");
  const [maxVal, setMaxVal] = useState(() => searchParams.get("max") ?? "");
  const [tiersSel, setTiersSel] = useState<Set<number>>(() =>
    parseNumSet(searchParams.get("tier")),
  );
  const [nationsSel, setNationsSel] = useState<Set<string>>(() =>
    parseSet(searchParams.get("nation")),
  );
  const [classesSel, setClassesSel] = useState<Set<string>>(() =>
    parseSet(searchParams.get("class")),
  );
  const [rolesSel, setRolesSel] = useState<Set<string>>(() =>
    parseSet(searchParams.get("role")),
  );
  // "standard" | "premium" | "reward" — reward (earned/special) is checked
  // before premium since reward tanks also carry a gold price.
  const [categorySel, setCategorySel] = useState<Set<string>>(() =>
    parseSet(searchParams.get("cat")),
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const setOrDel = (key: string, val: string) => {
      if (val) params.set(key, val);
      else params.delete(key);
    };
    setOrDel("q", query.trim());
    setOrDel("tier", setStr(tiersSel));
    setOrDel("nation", setStr(nationsSel));
    setOrDel("class", setStr(classesSel));
    setOrDel("role", setStr(rolesSel));
    setOrDel("cat", setStr(categorySel));
    // The range column is only meaningful with a bound, so only persist the
    // trio together.
    const hasRange = minVal.trim() !== "" || maxVal.trim() !== "";
    setOrDel("rc", hasRange ? rangeCol : "");
    setOrDel("min", minVal.trim());
    setOrDel("max", maxVal.trim());
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [
    query,
    tiersSel,
    nationsSel,
    classesSel,
    rolesSel,
    categorySel,
    rangeCol,
    minVal,
    maxVal,
  ]);

  const tiers = useMemo(
    () =>
      [...new Set(items.map((t) => t.tier).filter((t): t is number => t != null))].sort(
        (a, b) => a - b,
      ),
    [items],
  );

  // Nations present, ordered by how many vehicles each has (the big trees first).
  const nations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of items) {
      if (t.nation) counts.set(t.nation, (counts.get(t.nation) ?? 0) + 1);
    }
    return [...counts.keys()].sort(
      (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
    );
  }, [items]);

  // Roles present, in canonical order, so a new WoT role surfaces on its own.
  const roles = useMemo(() => {
    const present = new Set<string>();
    for (const t of items) {
      const s = roleSuffix(t.role);
      if (s) present.add(s);
    }
    return VEHICLE_ROLES.filter((r) => present.has(r));
  }, [items]);

  const activeRangeCol =
    rangeColumns.find((c) => c.key === rangeCol) ?? rangeColumns[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qa = q.replace(/[^a-z0-9]/g, "");
    const min = minVal.trim() === "" ? null : Number(minVal);
    const max = maxVal.trim() === "" ? null : Number(maxVal);
    return items.filter((t) => {
      if (tiersSel.size > 0 && (t.tier == null || !tiersSel.has(t.tier)))
        return false;
      if (nationsSel.size > 0 && (!t.nation || !nationsSel.has(t.nation)))
        return false;
      if (classesSel.size > 0 && (!t.type || !classesSel.has(t.type)))
        return false;
      if (rolesSel.size > 0) {
        const s = roleSuffix(t.role);
        if (!s || !rolesSel.has(s)) return false;
      }
      if (categorySel.size > 0) {
        const cat = t.isReward ? "reward" : t.isPremium ? "premium" : "standard";
        if (!categorySel.has(cat)) return false;
      }
      if (
        activeRangeCol &&
        ((min != null && !Number.isNaN(min)) ||
          (max != null && !Number.isNaN(max)))
      ) {
        const v = activeRangeCol.value(t);
        if (min != null && !Number.isNaN(min) && (v == null || v < min))
          return false;
        if (max != null && !Number.isNaN(max) && (v == null || v > max))
          return false;
      }
      if (q) {
        const name = t.name.toLowerCase();
        const short = (t.shortName ?? "").toLowerCase();
        const hit =
          name.includes(q) ||
          short.includes(q) ||
          (qa.length > 0 &&
            (name.replace(/[^a-z0-9]/g, "").includes(qa) ||
              short.replace(/[^a-z0-9]/g, "").includes(qa)));
        if (!hit) return false;
      }
      return true;
    });
  }, [
    items,
    query,
    activeRangeCol,
    minVal,
    maxVal,
    tiersSel,
    nationsSel,
    classesSel,
    rolesSel,
    categorySel,
  ]);

  return {
    filtered,
    filters: {
      query,
      setQuery,
      tiersSel,
      toggleTier: (t) => toggleSet(setTiersSel, t),
      nationsSel,
      toggleNation: (n) => toggleSet(setNationsSel, n),
      classesSel,
      toggleClass: (c) => toggleSet(setClassesSel, c),
      rolesSel,
      toggleRole: (r) => toggleSet(setRolesSel, r),
      categorySel,
      toggleCategory: (c) => toggleSet(setCategorySel, c),
      rangeCol,
      setRangeCol,
      minVal,
      setMinVal,
      maxVal,
      setMaxVal,
      resetRange: (col) => {
        setRangeCol(col);
        setMinVal("");
        setMaxVal("");
      },
      tiers,
      nations,
      roles,
      rangeCols: rangeColumns,
      activeRangeCol,
      resultCount: filtered.length,
    },
  };
}

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
                  <NationFlag nation={n} className="h-3.5" />
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

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-fit max-w-full overflow-x-auto rounded-md border border-fd-border">
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
