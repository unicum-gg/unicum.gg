import type { ReactNode } from "react";
import {
  BroadcastIcon,
  CrosshairSimpleIcon,
  FanIcon,
  GaugeIcon,
  type Icon,
  LightningIcon,
  SlidersHorizontalIcon,
  SteeringWheelIcon,
  TargetIcon,
} from "@phosphor-icons/react";
import { VehicleModeKind } from "@unicum.gg/shared";
import { MECHANIC_STATES, VehicleMechanic } from "@unicum.gg/wargaming";

/**
 * Which of the two published mode kinds a mechanic is offered as.
 *
 * **The hero and the characteristics switch have to name the same one.** They
 * share a single engaged value, and a hook that is handed a kind the vehicle
 * does not publish ignores it: the hero asking for a siege on a Panhard EBR,
 * whose only mode is `rapid`, moved the picture and left the numbers where they
 * were. WG splits its profile the same way, a `rapid` block for the wheeled
 * chassis and a `siege` one for everything else that has a second state.
 */
export function modeKindFor(mechanic: string | null): VehicleModeKind {
  return mechanic === VehicleMechanic.Wheeled
    ? VehicleModeKind.Rapid
    : VehicleModeKind.Siege;
}

/**
 * What each of a vehicle's two states is called, and what it looks like.
 *
 * **One source, because two places offer the same switch.** The hero engages the
 * second state in the picture and the toggle beside the characteristics title
 * engages it in the numbers, and they are the same act: a reader who learns the
 * crosshair in one should meet the crosshair in the other, not an anchor, and
 * the same two words in both.
 *
 * WG ships no standalone icon for the modes, so these are Phosphor stand-ins: a
 * crosshair for a vehicle that plants and aims, a gauge for the wheeled switch
 * to the road, and a steering wheel for the state before either.
 */
/**
 * What the vehicle is in on either side of the switch, for this mechanic.
 *
 * **`siegeMode` is a switch, not a stance.** The client tags every vehicle that
 * has a second state that way and seven mechanics ride the one tag, so both
 * halves of the pair are read from the mechanic behind it rather than assumed:
 * "Siege" was right for the Strv and wrong for a Panhard EBR, whose mode is the
 * road, and a Pz.Kpfw. Neu does not leave a travelling state at all, it goes
 * from a standard shell to a calibrated one. The words are the game's own, and
 * there is one list of them, in the reader of the client data that finds them.
 */
function states(mechanic: string | null): { travel: string; engaged: string } {
  return (
    MECHANIC_STATES[mechanic as VehicleMechanic] ??
    MECHANIC_STATES[VehicleMechanic.Siege]
  );
}

/** What the mark reads while the vehicle is in its second state. */
export function engagedLabel(mechanic: string | null): string {
  return states(mechanic).engaged;
}

/** And while it is not, which is not always a state called travelling. */
export function travelLabel(mechanic: string | null): string {
  return states(mechanic).travel;
}

/** What the client calls each published mode kind, on its own. */
const KIND_LABEL: Record<VehicleModeKind, string> = {
  [VehicleModeKind.Siege]: "Siege",
  [VehicleModeKind.Rapid]: "Rapid",
};

/**
 * The name for one mode of a vehicle, which is the mechanic's where it is the
 * mechanic's mode and the kind's own where it is not.
 *
 * Every vehicle in the client publishes exactly one second state, so the second
 * branch is unreachable today. It is here because the first one names the
 * *vehicle*, not the mode: offered a vehicle with two, it would print the same
 * word on both segments and leave the reader guessing which was which.
 */
export function modeLabel(mechanic: string | null, kind: VehicleModeKind): string {
  return kind === modeKindFor(mechanic) ? engagedLabel(mechanic) : KIND_LABEL[kind];
}

/** What engaging it does, for the sentence behind the mark. */
const MECHANIC_MEANING: Record<VehicleMechanic, string> = {
  [VehicleMechanic.Siege]: "planted, where its gun and its hull both aim",
  [VehicleMechanic.Wheeled]:
    "wheels locked down, for the road rather than the fight",
  [VehicleMechanic.DualGun]: "both guns fired as one",
  [VehicleMechanic.ShellSwitcher]:
    "the gun's extra chambers open, trading damage for penetrating power",
  [VehicleMechanic.LowCharge]: "a partial charge, fired without waiting",
  [VehicleMechanic.Turboshaft]: "the turbine spun up",
  [VehicleMechanic.TwinGun]: "both barrels fired as one",
};

/** And the words for it, which say what the switch actually does. */
export function engagedMeaning(mechanic: string | null): string {
  return (
    MECHANIC_MEANING[mechanic as VehicleMechanic] ??
    MECHANIC_MEANING[VehicleMechanic.Siege]
  );
}

/**
 * The icon for one side of the switch, chosen for what actually transforms.
 *
 * The client says which it is: a vehicle whose `<siege_mode>` operates its gun
 * gets gun icons on both sides, and one whose hull moves gets the wheel it
 * leaves. WG ships no standalone icon for any of this, so these are Phosphor
 * stand-ins, one per mechanic rather than one for all of them: a crosshair for a
 * vehicle that plants and aims, a gauge for the wheeled switch to the road, a
 * fan for the turbine that spins up, sliders for a gun recalibrating its shells,
 * a bolt for the charge fired without waiting, and a burst for the barrels fired
 * as one.
 */
const ENGAGED_ICON: Record<VehicleMechanic, Icon> = {
  [VehicleMechanic.Siege]: CrosshairSimpleIcon,
  [VehicleMechanic.Wheeled]: GaugeIcon,
  [VehicleMechanic.Turboshaft]: FanIcon,
  [VehicleMechanic.ShellSwitcher]: SlidersHorizontalIcon,
  [VehicleMechanic.LowCharge]: LightningIcon,
  [VehicleMechanic.DualGun]: BroadcastIcon,
  [VehicleMechanic.TwinGun]: BroadcastIcon,
};

/** Which mechanics leave a driving state, and which only change how they fire. */
const HULL_MECHANICS = new Set<VehicleMechanic>([
  VehicleMechanic.Siege,
  VehicleMechanic.Wheeled,
  VehicleMechanic.Turboshaft,
]);

export function ModeIcon({
  mechanic,
  engaged,
  className = "size-4",
}: {
  /** Which mechanic the second state is, where the caller knows it. */
  mechanic: string | null;
  /** True for the state past the switch, false for the one before it. */
  engaged: boolean;
  className?: string;
}): ReactNode {
  const known =
    (mechanic as VehicleMechanic) in ENGAGED_ICON
      ? (mechanic as VehicleMechanic)
      : VehicleMechanic.Siege;
  const Glyph = engaged
    ? ENGAGED_ICON[known]
    : HULL_MECHANICS.has(known)
      ? SteeringWheelIcon
      : TargetIcon;
  return <Glyph className={className} weight="bold" />;
}
