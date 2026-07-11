import type { TankSpec } from "@unicum.gg/core/db/schema";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/panel";

type Row = {
  key: keyof TankSpec;
  label: string;
  unit?: string;
  digits?: number;
  scale?: number;
};
type Group = { title: string; rows: Row[] };

// Grouped tank specifications, gunmarks/tanks.gg style. Values come straight from
// the global tank_specs catalogue (parsed from the game client). Missing values
// (a spec that does not apply to this vehicle) render as a dash.
const GROUPS: Group[] = [
  {
    title: "Firepower",
    rows: [
      { key: "damage", label: "Damage", unit: "hp" },
      { key: "penetration", label: "Penetration", unit: "mm" },
      { key: "dpm", label: "DPM", digits: 0 },
      { key: "reload", label: "Reload", unit: "s", digits: 2 },
      { key: "rof", label: "Rate of fire", unit: "/min", digits: 2 },
      { key: "aimTime", label: "Aim time", unit: "s", digits: 2 },
      { key: "accuracy", label: "Accuracy", unit: "m", digits: 3 },
      { key: "dispMoving", label: "Dispersion moving", digits: 3 },
      { key: "shellVelocity", label: "Shell velocity", unit: "m/s" },
      { key: "caliber", label: "Caliber", unit: "mm" },
      { key: "depression", label: "Gun depression", unit: "°" },
      { key: "elevation", label: "Gun elevation", unit: "°" },
    ],
  },
  {
    title: "Mobility",
    rows: [
      { key: "speedForward", label: "Top speed", unit: "km/h" },
      { key: "speedBackward", label: "Reverse speed", unit: "km/h" },
      { key: "enginePower", label: "Engine power", unit: "hp" },
      { key: "powerWeight", label: "Power/weight", unit: "hp/t", digits: 1 },
      { key: "hullTraverse", label: "Hull traverse", unit: "°/s", digits: 1 },
      { key: "turretTraverse", label: "Turret traverse", unit: "°/s", digits: 1 },
      { key: "terrainHard", label: "Hard terrain", digits: 2 },
      { key: "terrainMedium", label: "Medium terrain", digits: 2 },
      { key: "terrainSoft", label: "Soft terrain", digits: 2 },
    ],
  },
  {
    title: "Survivability",
    rows: [
      { key: "health", label: "Hit points", unit: "hp" },
      { key: "hullArmorFront", label: "Hull armor (front)", unit: "mm" },
      { key: "turretArmorFront", label: "Turret armor (front)", unit: "mm" },
      { key: "engineFireChance", label: "Fire chance", unit: "%" },
      { key: "ammoRackHealth", label: "Ammo rack HP", unit: "hp" },
      { key: "trackHealth", label: "Track HP", unit: "hp" },
    ],
  },
  {
    title: "Spotting & other",
    rows: [
      { key: "viewRange", label: "View range", unit: "m" },
      { key: "radioRange", label: "Signal range", unit: "m" },
      { key: "camoStill", label: "Camo (still)", unit: "%", digits: 1 },
      { key: "camoMoving", label: "Camo (moving)", unit: "%", digits: 1 },
      { key: "weight", label: "Weight", unit: "t", digits: 1, scale: 0.001 },
    ],
  },
];

const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function format(value: number, digits?: number): string {
  if (digits === undefined) return intFmt.format(value);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function SpecGroup({ group, specs }: { group: Group; specs: TankSpec }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground">
        {group.title}
      </h3>
      <dl className="space-y-1.5">
        {group.rows.map((row) => {
          const raw = specs[row.key];
          const value =
            typeof raw === "number" ? raw * (row.scale ?? 1) : null;
          return (
            <div
              key={String(row.key)}
              className="flex items-baseline justify-between gap-2 text-sm"
            >
              <dt className="text-fd-muted-foreground">{row.label}</dt>
              <dd className="font-medium tabular-nums">
                {value != null ? (
                  <>
                    {format(value, row.digits)}
                    {row.unit && (
                      <span className="ml-0.5 text-xs text-fd-muted-foreground">
                        {row.unit}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-fd-muted-foreground">—</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function TankCharacteristics({
  specs,
  tankName,
}: {
  specs: TankSpec | null;
  tankName: string;
}) {
  if (!specs) return null;
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{tankName} characteristics</PanelTitle>
      </PanelHeader>
      <PanelContent className="grid grid-cols-1 gap-x-8 gap-y-6 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
        {GROUPS.map((group) => (
          <SpecGroup key={group.title} group={group} specs={specs} />
        ))}
      </PanelContent>
    </Panel>
  );
}
