import type { EquipmentEffect } from "@unicum.gg/wargaming";
import { CATEGORY, categoryColor, GRADE_LABEL, type Equipment } from "./category";
import { CategoryGlyph } from "./category-glyph";

// Friendly labels for the wot-src attributes an equipment can change, so the
// hover tooltip reads like the in-game description rather than raw keys.
const ATTR_LABEL: Record<string, string> = {
  "miscAttrs/gunReloadTimeFactor": "Reload",
  "miscAttrs/gunAimingTimeFactor": "Aim time",
  "miscAttrs/additiveShotDispersionFactor": "Dispersion on the move",
  "miscAttrs/multShotDispersionFactor": "Accuracy",
  "miscAttrs/enginePowerFactor": "Engine power",
  "miscAttrs/forwardMaxSpeedKMHTerm": "Top speed",
  "miscAttrs/backwardMaxSpeedKMHTerm": "Reverse speed",
  "miscAttrs/circularVisionRadiusFactor": "View range",
  "miscAttrs/turretRotationSpeed": "Turret traverse",
  "miscAttrs/healthFactor": "Hit points",
  "miscAttrs/fireStartingChanceFactor": "Fire chance",
  "miscAttrs/chassisHealthFactor": "Track HP",
  "miscAttrs/ammoBayHealthFactor": "Ammo rack HP",
  "miscAttrs/crewLevelIncrease": "Crew training",
  "miscAttrs/repairSpeedFactor": "Repair speed",
  "miscAttrs/fuelTankHealthFactor": "Fuel tank HP",
  "miscAttrs/engineHealthFactor": "Engine HP",
  "miscAttrs/antifragmentationLiningFactor": "Spall protection",
  "miscAttrs/crewChanceToHitFactor": "Crew hit chance",
  "miscAttrs/stunResistanceDuration": "Stun resistance",
  "miscAttrs/repeatedStunDurationFactor": "Repeated stun",
  "miscAttrs/vehicleByChassisDamageFactor": "Ramming damage taken",
  "miscAttrs/chassisRepairSpeedFactor": "Track repair speed",
  "miscAttrs/engineReduceFineFactor": "Engine damage taken",
  "miscAttrs/ammoBayReduceFineFactor": "Ammo rack damage taken",
  "miscAttrs/increaseEnemySpottingTime": "Enemy spotting delay",
  "miscAttrs/decreaseOwnSpottingTime": "Own spotting speed",
  "miscAttrs/demaskFoliageFactor": "Foliage camouflage",
  "miscAttrs/demaskMovingFactor": "Moving camouflage",
  // Synthetic attributes from the SDK's equipment parser (devices with no
  // standard `<factor>` block).
  invisibilityStill: "Camo (still)",
  invisibilityAll: "Camouflage",
  circularVisionRadius: "View range",
  rotationFactor: "Terrain resistance",
};

function attrLabel(attribute: string): string {
  return ATTR_LABEL[attribute] ?? attribute.replace("miscAttrs/", "");
}

/** A signed, human value for an effect level (a `mul` reads as a percentage,
 * an `add` as a flat term). */
function fmtValue(e: EquipmentEffect, value: number): string {
  if (e.type === "mul") {
    const pct = Math.round((value - 1) * 1000) / 10;
    return `${pct > 0 ? "+" : ""}${pct}%`;
  }
  // Camo is a 0-1 fraction shown as a percentage, so its additive term reads as
  // percentage points.
  if (e.attribute === "invisibilityStill" || e.attribute === "invisibilityAll") {
    const pts = Math.round(value * 1000) / 10;
    return `${pts > 0 ? "+" : ""}${pts}%`;
  }
  return `${value > 0 ? "+" : ""}${value}`;
}

export function EquipmentTooltip({
  equip,
  cycleHint,
}: {
  equip: Equipment;
  /** A note about what the next click does (mount / switch variant / remove). */
  cycleHint?: string;
}) {
  const gradeLabel = GRADE_LABEL[equip.grade];
  return (
    <div className="w-56 space-y-2 text-xs">
      <div className="font-medium">{equip.name}</div>
      {gradeLabel ? (
        <div className="text-[11px] font-medium text-background/70">
          {gradeLabel}
        </div>
      ) : null}
      {equip.description ? (
        <div className="text-background/60">{equip.description}</div>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {equip.categories.map((c) => {
          const meta = CATEGORY[c];
          return (
            <span
              key={c}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: categoryColor(c) ?? "#666" }}
            >
              {meta ? (
                <CategoryGlyph category={c} className="size-3" color="#fff" />
              ) : null}
              {meta?.label ?? c}
            </span>
          );
        })}
      </div>
      {equip.effects.length > 0 ? (
        <div className="space-y-0.5 border-t border-background/20 pt-1.5">
          {equip.effects.map((e) => (
            <div key={e.attribute} className="flex justify-between gap-3 tabular-nums">
              <span className="text-background/60">{attrLabel(e.attribute)}</span>
              <span>
                {fmtValue(e, e.base)}
                {e.bonus !== e.base ? (
                  <span className="text-background/60">
                    {" "}
                    ({fmtValue(e, e.bonus)} matched)
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-t border-background/20 pt-1.5 text-background/60">
          No stat effect modelled.
        </div>
      )}
      {cycleHint ? (
        <div className="border-t border-background/20 pt-1.5 text-background/60">
          {cycleHint}
        </div>
      ) : null}
    </div>
  );
}
