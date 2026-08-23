"use client";

import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VEHICLE_ROLES, roleSuffix } from "@unicum.gg/shared";

export type FilterableTank = {
  tier: number | null;
  nation: string | null;
  type: string | null;
  role: string | null;
  isPremium: boolean;
  isReward: boolean;
  /** On the test client only, not released yet. */
  isCommonTest?: boolean;
  /** How many characteristics the test build changes on this vehicle. */
  testChanges?: number;
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
  /** Keep only what the current Common Test adds or rebalances. */
  testOnly: boolean;
  setTestOnly: (v: boolean) => void;
  /** Whether a test is running at all, so the control can hide itself. */
  hasTestChanges: boolean;
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
  // starts empty and seeds from the query string on mount (below); changes are
  // written back (merged with any other params like ?tab=/?section=) via
  // replaceState — no history spam, no reload. The URL is read via
  // window.location, not useSearchParams, so this component stays out of the
  // dynamic-rendering path and the page can be statically prerendered.
  const [query, setQuery] = useState("");
  const [rangeCol, setRangeCol] = useState(initialRangeCol);
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");
  const [tiersSel, setTiersSel] = useState<Set<number>>(() => new Set());
  const [nationsSel, setNationsSel] = useState<Set<string>>(() => new Set());
  const [classesSel, setClassesSel] = useState<Set<string>>(() => new Set());
  const [rolesSel, setRolesSel] = useState<Set<string>>(() => new Set());
  // "standard" | "premium" | "reward" — reward (earned/special) is checked
  // before premium since reward tanks also carry a gold price.
  const [categorySel, setCategorySel] = useState<Set<string>>(() => new Set());
  // Kept out of `categorySel` on purpose: a test vehicle is still standard,
  // premium or reward, so this is a second axis rather than a fourth category.
  const [testOnly, setTestOnly] = useState(false);
  // No test running (or nothing changed): the control has nothing to filter.
  const hasTestChanges = useMemo(
    () => items.some((t) => t.isCommonTest || (t.testChanges ?? 0) > 0),
    [items],
  );

  // Seed filter state from the URL once, on mount (client-side only). A
  // deep-linked filter view applies right after hydration.
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot hydration from the URL on mount, avoids an SSR mismatch */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setQuery(q);
    const rc = params.get("rc");
    if (rc) setRangeCol(rc);
    const min = params.get("min");
    if (min) setMinVal(min);
    const max = params.get("max");
    if (max) setMaxVal(max);
    const tier = parseNumSet(params.get("tier"));
    if (tier.size) setTiersSel(tier);
    const nation = parseSet(params.get("nation"));
    if (nation.size) setNationsSel(nation);
    const klass = parseSet(params.get("class"));
    if (klass.size) setClassesSel(klass);
    const role = parseSet(params.get("role"));
    if (role.size) setRolesSel(role);
    const cat = parseSet(params.get("cat"));
    if (cat.size) setCategorySel(cat);
    if (params.get("test") === "1") setTestOnly(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Skip the write-back on the first commit so the mount-time seed above (which
  // runs after) is never clobbered by an empty-state URL write.
  const skipNextWriteback = useRef(true);
  useEffect(() => {
    if (skipNextWriteback.current) {
      skipNextWriteback.current = false;
      return;
    }
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
    // A flag, not a set, so it is written as its own presence rather than
    // through `setStr`. Without it the Common Test chip was the one filter a
    // link could not carry.
    setOrDel("test", testOnly ? "1" : "");
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
    testOnly,
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
      // Either side of a Common Test: a vehicle it adds, or one it rebalances.
      if (testOnly && !t.isCommonTest && !(t.testChanges ?? 0)) return false;
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
    testOnly,
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
      testOnly,
      setTestOnly,
      hasTestChanges,
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

