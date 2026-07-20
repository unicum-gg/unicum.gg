// Tank detail page tabs. Shared by the server view (which renders each tab's
// content) and the client tab bar (which reads/writes the active tab in the
// URL). Single query param: `?tab=performances` / `?tab=marks`; Specifications
// is the default and omits the param.
export enum TankDetailTab {
  Specifications = "specifications",
  Performances = "performances",
  Marks = "marks",
}

export const TANK_DETAIL_TABS: {
  id: TankDetailTab;
  label: string;
  query: string | null;
}[] = [
  { id: TankDetailTab.Specifications, label: "Specifications", query: null },
  { id: TankDetailTab.Performances, label: "Performances", query: "performances" },
  { id: TankDetailTab.Marks, label: "Marks", query: "marks" },
];

export function tankDetailTabFromQuery(
  query: string | null | undefined,
): TankDetailTab {
  return (
    TANK_DETAIL_TABS.find((t) => t.query === query)?.id ??
    TankDetailTab.Specifications
  );
}

export function tankDetailTabHref(basePath: string, tab: TankDetailTab): string {
  const query = TANK_DETAIL_TABS.find((t) => t.id === tab)?.query;
  return query ? `${basePath}?tab=${query}` : basePath;
}
