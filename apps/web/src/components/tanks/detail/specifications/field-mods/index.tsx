"use client";

import Image from "next/image";
import { CheckIcon } from "lucide-react";
import { toRoman } from "roman-numerals";
import type {
  FieldModItem,
  TankFieldMods,
} from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelTitle,
} from "@/components/panel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Short labels for the characteristics a field-mod attribute moves, for the
// effect tooltips. Unlisted attributes (damaged-state fines, stun, ...) show
// their raw tail so the tooltip never lies by omission.
export const EFFECT_LABEL: Record<string, string> = {
  "miscAttrs/healthFactor": "Hit points",
  "descrAttrs/hull/maxHealth": "Hull hit points",
  "miscAttrs/enginePowerFactor": "Engine power",
  "descrAttrs/engine/power": "Engine power",
  "miscAttrs/gunReloadTimeFactor": "Reload",
  "descrAttrs/gun/reloadTime": "Reload",
  "miscAttrs/gunAimingTimeFactor": "Aim time",
  "descrAttrs/gun/aimingTime": "Aim time",
  "miscAttrs/multShotDispersionFactor": "Dispersion",
  "descrAttrs/gun/shotDispersionRadius": "Dispersion",
  "miscAttrs/additiveShotDispersionFactor": "Dispersion moving",
  "miscAttrs/chassis/shotDispersionFactors/movement": "Dispersion moving",
  "miscAttrs/chassis/shotDispersionFactors/rotation": "Dispersion hull traverse",
  "miscAttrs/gun/shotDispersionFactors/turretRotation":
    "Dispersion turret traverse",
  "miscAttrs/gun/shotDispersionFactors/whileGunDamaged": "Dispersion gun damaged",
  "miscAttrs/turretRotationSpeed": "Turret traverse",
  "descrAttrs/turret/rotationSpeed": "Turret traverse",
  "descrAttrs/chassis/rotationSpeedDegrees": "Hull traverse",
  "miscAttrs/onMoveRotationSpeedFactor": "Hull traverse",
  "miscAttrs/onStillRotationSpeedFactor": "Hull traverse (still)",
  "miscAttrs/circularVisionRadiusFactor": "View range",
  "miscAttrs/circularVisionRadiusBaseFactor": "View range",
  "descrAttrs/turret/circularVisionRadius": "View range",
  "miscAttrs/chassisHealthFactor": "Track HP",
  "miscAttrs/chassisRepairSpeedFactor": "Track repair speed",
  "miscAttrs/ammoBayHealthFactor": "Ammo rack HP",
  "miscAttrs/engineHealthFactor": "Engine HP",
  "miscAttrs/fuelTankHealthFactor": "Fuel tank HP",
  "miscAttrs/repairSpeedFactor": "Repair speed",
  "miscAttrs/forwardMaxSpeedKMHTerm": "Top speed",
  "miscAttrs/backwardMaxSpeedKMHTerm": "Reverse speed",
  "descrAttrs/gun/maxAmmo": "Ammo capacity",
  additionalShellAmmoCapacity: "Ammo capacity",
  "miscAttrs/rollingFrictionFactor": "Rolling friction",
  "descrAttrs/shot0/piercingPower": "Standard shell penetration",
  "descrAttrs/shot1/piercingPower": "Special shell penetration",
  "miscAttrs/invisibilityFactor": "Camouflage",
  "miscAttrs/invisibilityBaseAdditive": "Camouflage",
  "miscAttrs/engineReduceFineFactor": "Damaged engine penalty",
  "miscAttrs/ammoBayReduceFineFactor": "Damaged ammo rack penalty",
  // Real mod effects on gameplay mechanics we don't list as characteristics
  // (stun, ramming, crew injury, foliage/moving camo, pivot). They carry no
  // table row, but a mod (especially a pair's downside) lists them, so they need
  // readable labels instead of the raw attribute key.
  "miscAttrs/repeatedStunDurationFactor": "Repeated stun duration",
  "miscAttrs/stunResistanceDuration": "Stun resistance",
  "miscAttrs/rammingFactor": "Ramming damage",
  "miscAttrs/crewChanceToHitFactor": "Crew hit chance",
  "miscAttrs/antifragmentationLiningFactor": "Crew HE protection",
  "miscAttrs/centerRotationFwdSpeedFactor": "Pivot turn speed",
  "miscAttrs/demaskFoliageFactor": "Foliage camo",
  "miscAttrs/demaskMovingFactor": "Moving demask",
  // Tier-XI skill-tree (upgrades) descriptor forms and vehicle mechanics: these
  // nodes carry raw descriptor attributes (not the field-mod `*Factor` keys), so
  // they need their own labels or the tooltip would show the bare tail (`0`,
  // `armorDamage`, `extraReloadTime`, ...).
  "descrAttrs/gunPitchLimits/minPitchDegrees": "Gun elevation",
  "descrAttrs/gunPitchLimits/maxPitchDegrees/0": "Gun depression",
  "descrAttrs/engine/fireStartingChance": "Engine fire chance",
  "descrAttrs/engine/maxSpeedBack": "Reverse speed",
  "descrAttrs/turret/rotationSpeedDegrees": "Turret traverse",
  "descrAttrs/shell0/armorDamage": "Standard shell damage",
  "descrAttrs/shell1/armorDamage": "Special shell damage",
  "descrAttrs/shell2/armorDamage": "HE shell damage",
  "descrAttrs/shot0/speed": "Standard shell velocity",
  "descrAttrs/shot1/speed": "Special shell velocity",
  "descrAttrs/shot2/speed": "HE shell velocity",
  "miscAttrs/gun/shotDispersionFactors/afterShot": "Dispersion after shot",
  "descrAttrs/chassis/shotDispersionFactors/0": "Dispersion moving",
  "descrAttrs/chassis/shotDispersionFactors/1": "Dispersion hull traverse",
  "miscAttrs/gun/extraShotClip/extraReloadTime": "Intra-clip reload",
};

const warnedAttrs = new Set<string>();

/** The readable label for an effect attribute, falling back to its raw tail. In
 * development, the first time an attribute is missing from `EFFECT_LABEL` it logs
 * a warning: skill-tree effects are pre-filtered to characteristics we apply, so
 * an unlabeled one is a gap to fill (surfaces new tier-XI attributes without a
 * manual audit). */
export function effectLabel(attribute: string): string {
  const label = EFFECT_LABEL[attribute];
  if (label) return label;
  if (process.env.NODE_ENV !== "production" && !warnedAttrs.has(attribute)) {
    warnedAttrs.add(attribute);
    console.warn(
      `[field-mods] no EFFECT_LABEL for "${attribute}" (showing raw tail). Add it to EFFECT_LABEL.`,
    );
  }
  return attribute.split("/").slice(-1)[0];
}

// Additive attributes whose value is a 0-1 fraction shown as a percentage (camo
// is displayed in %, so a +0.03 base-invisibility term reads "+3%", not "+0.03").
const PERCENT_ADD_ATTRS = new Set(["miscAttrs/invisibilityBaseAdditive"]);

export function fmtEffect(
  type: "mul" | "add",
  value: number,
  attribute?: string,
): string {
  if (type === "add") {
    if (attribute && PERCENT_ADD_ATTRS.has(attribute)) {
      const pp = Math.round(value * 1000) / 10;
      return `${pp > 0 ? "+" : ""}${pp}%`;
    }
    return `${value > 0 ? "+" : ""}${value}`;
  }
  const pct = Math.round((value - 1) * 1000) / 10;
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function ModTooltip({ item }: { item: FieldModItem }) {
  return (
    <div className="w-56 space-y-2 text-xs">
      <div className="font-medium">{item.name}</div>
      {item.effects.length > 0 ? (
        <div className="space-y-0.5 border-t border-background/20 pt-1.5">
          {item.effects.map((e, i) => (
            <div key={i} className="flex justify-between gap-3 tabular-nums">
              <span className="text-background/60">
                {effectLabel(e.attribute)}
              </span>
              <span>{fmtEffect(e.type, e.value, e.attribute)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PairTile({
  item,
  mounted,
  locked,
  onPick,
}: {
  item: FieldModItem;
  mounted: boolean;
  locked: boolean;
  onPick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => !locked && onPick()}
          aria-pressed={mounted}
          aria-disabled={locked}
          aria-label={item.name}
          className={locked ? "cursor-not-allowed" : "cursor-pointer"}
        >
          <span
            className={cn(
              "relative flex size-12 items-center justify-center rounded-lg border-2 transition-colors",
              mounted
                ? "border-[#f25322]/60 bg-[#f25322]/10"
                : "border-fd-border hover:bg-fd-secondary/30",
              locked && "opacity-40 hover:bg-transparent",
            )}
          >
            {item.image ? (
              <Image
                src={item.image}
                alt=""
                width={34}
                height={34}
                className="object-contain"
                style={{ width: 34, height: 34 }}
              />
            ) : null}
            {mounted ? (
              <span className="absolute -right-1.5 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-[#f25322] ring-2 ring-fd-background">
                <CheckIcon className="size-2.5 text-white" strokeWidth={3} />
              </span>
            ) : null}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-none">
        <ModTooltip item={item} />
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The tank's field modifications (post progression), laid out like the in-game
 * tree: one column per level along a horizontal rail. Clicking a level unlocks
 * everything up to it (base modifications apply cumulatively); the dual
 * "Modification I/II" choices sit under their level as exclusive tiles.
 */
export function TankFieldModifications({
  fieldMods,
  level,
  onLevel,
  pairChoices,
  onTogglePair,
  screenLines = true,
  headerBorder = false,
}: {
  fieldMods: TankFieldMods;
  level: number;
  onLevel: (level: number) => void;
  pairChoices: Record<string, "first" | "second" | null>;
  onTogglePair: (key: string, side: "first" | "second") => void;
  /** The decorative full-width edge lines; disable when beside another panel. */
  screenLines?: boolean;
  /** A local under-title line (column-width), when stacked below another panel. */
  headerBorder?: boolean;
}) {
  const levels = [...new Set(fieldMods.steps.map((s) => s.level))].sort(
    (a, b) => a - b,
  );
  return (
    <TooltipProvider delayDuration={100}>
      <Panel screenLines={screenLines}>
        <PanelHeader
          screenLines={screenLines}
          className={headerBorder ? "border-b border-fd-border" : undefined}
        >
          <PanelTitle>Field Modifications</PanelTitle>
        </PanelHeader>
        <PanelContent className="overflow-x-auto px-4 py-6">
          <div className="relative flex items-start gap-6">
            {/* The rail behind the level nodes. */}
            <span
              aria-hidden
              className="absolute top-6 right-2 left-2 border-t border-fd-border"
            />
            {levels.map((lv) => {
              const steps = fieldMods.steps.filter((s) => s.level === lv);
              const main = steps.find((s) => s.kind !== "pair");
              const pair = steps.find((s) => s.kind === "pair")?.pair ?? null;
              const unlocked = lv <= level;
              return (
                <div
                  key={lv}
                  className="relative flex min-w-14 flex-col items-center gap-3"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        // Clicking the current level steps back below it, so the
                        // last node also toggles off.
                        onClick={() => onLevel(lv === level ? lv - 1 : lv)}
                        aria-pressed={unlocked}
                        aria-label={`Level ${lv}`}
                        className="cursor-pointer"
                      >
                        <span
                          className={cn(
                            "relative flex size-12 items-center justify-center rounded-lg border-2 bg-fd-background transition-colors",
                            unlocked
                              ? "border-[#f25322]/60 bg-[#f25322]/10"
                              : "border-fd-border hover:bg-fd-secondary/30",
                          )}
                        >
                          {main?.kind === "feature" && main.feature?.image ? (
                            <Image
                              src={main.feature.image}
                              alt=""
                              width={40}
                              height={27}
                              className="object-contain opacity-90"
                              style={{ width: 40, height: 27 }}
                            />
                          ) : (
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                unlocked
                                  ? "text-[#f25322]"
                                  : "text-fd-muted-foreground",
                              )}
                            >
                              {toRoman(lv)}
                            </span>
                          )}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-none">
                      {main?.kind === "modification" && main.modification ? (
                        <ModTooltip item={main.modification} />
                      ) : (
                        <div className="w-48 text-xs">
                          <div className="font-medium">
                            {main?.feature?.name ?? `Level ${lv}`}
                          </div>
                          <div className="mt-1 text-background/60">
                            {main?.feature?.description ??
                              "No characteristic effect."}
                          </div>
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  {pair ? (
                    <div className="flex flex-col gap-2">
                      <PairTile
                        item={pair.first}
                        mounted={unlocked && pairChoices[pair.key] === "first"}
                        locked={!unlocked}
                        onPick={() => onTogglePair(pair.key, "first")}
                      />
                      <PairTile
                        item={pair.second}
                        mounted={unlocked && pairChoices[pair.key] === "second"}
                        locked={!unlocked}
                        onPick={() => onTogglePair(pair.key, "second")}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </PanelContent>
      </Panel>
    </TooltipProvider>
  );
}
