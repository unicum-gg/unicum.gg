// Pure, framework-free tank tab definitions shared by the server page (which
// reads the active tab from the URL) and the client nav/view. Kept out of the
// "use client" nav so these stay callable from Server Components.
//
// Single nav axis, one query param: `?tab=specifications` / `?tab=economics`.
// Performances is the default and omits the param.
export enum TankTab {
  Performances = "performances",
  Specifications = "specifications",
  Economics = "economics",
  MarksOfExcellence = "marks-of-excellence",
  MarksOfMastery = "marks-of-mastery",
}

export const TANK_TABS: {
  id: TankTab;
  label: string;
  query: string | null;
}[] = [
  { id: TankTab.Performances, label: "Performances", query: null },
  { id: TankTab.Specifications, label: "Specifications", query: "specifications" },
  { id: TankTab.Economics, label: "Economics", query: "economics" },
  {
    id: TankTab.MarksOfExcellence,
    label: "Marks of Excellence",
    query: "marks-of-excellence",
  },
  {
    id: TankTab.MarksOfMastery,
    label: "Marks of Mastery",
    query: "marks-of-mastery",
  },
];

export function tankTabFromQuery(query: string | null | undefined): TankTab {
  const found = TANK_TABS.find((t) => t.query === query);
  return found ? found.id : TankTab.Performances;
}

export function tankTabHref(basePath: string, tab: TankTab): string {
  const query = TANK_TABS.find((t) => t.id === tab)?.query;
  return query ? `${basePath}?tab=${query}` : basePath;
}
