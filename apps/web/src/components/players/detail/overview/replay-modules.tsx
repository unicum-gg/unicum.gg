"use client";

import type { TranslateFunction } from "@onruntime/translations";
import { iconUrl } from "@unicum.gg/shared";
import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";
import { clock } from "./replay-math";

/** A module's or a crew member's state, as the game's damage panel draws it. */
export enum DeviceState {
  Ok = "ok",
  Damaged = "damaged",
  Destroyed = "destroyed",
  Injured = "injured",
}

/**
 * The client's vehicle extras for the modules and the crew, by index: the
 * order of the `<extras>` of `item_defs/vehicles/common/vehicle.xml`, with
 * `_NoneExtra` at 0. No class there expands into several, so the index is the
 * plain position.
 */
const MODULES: [number, string][] = [
  [61, "engine"],
  [62, "ammoBay"],
  [63, "fuelTank"],
  [64, "radio"],
  [65, "leftTrack"],
  [66, "rightTrack"],
  [67, "gun"],
  [68, "turretRotator"],
  [69, "surveyingDevice"],
];
const CREW: [number, string][] = [
  [70, "commander"],
  [71, "driver"],
  [72, "radioman"],
  [73, "radioman"],
  [74, "gunner"],
  [75, "gunner"],
  [76, "loader"],
  [77, "loader"],
];
const FIRST_CREW = 70;

/**
 * What each of the client's `DAMAGE_INFO_CODES` does to the extra it names,
 * by index. Null for the codes about the vehicle itself (its death) rather
 * than one of its parts.
 */
const CODE_STATE: (DeviceState | null)[] = [
  DeviceState.Damaged, // DEVICE_CRITICAL
  DeviceState.Destroyed, // DEVICE_DESTROYED
  DeviceState.Injured, // TANKMAN_HIT
  DeviceState.Damaged, // DEVICE_CRITICAL_AT_SHOT
  DeviceState.Destroyed, // DEVICE_DESTROYED_AT_SHOT
  DeviceState.Damaged, // DEVICE_CRITICAL_AT_RAMMING
  DeviceState.Destroyed, // DEVICE_DESTROYED_AT_RAMMING
  DeviceState.Injured, // TANKMAN_HIT_AT_SHOT
  null, // DEATH_FROM_DEVICE_EXPLOSION_AT_SHOT
  DeviceState.Damaged, // DEVICE_CRITICAL_AT_FIRE
  DeviceState.Destroyed, // DEVICE_DESTROYED_AT_FIRE
  DeviceState.Damaged, // DEVICE_CRITICAL_AT_WORLD_COLLISION
  DeviceState.Destroyed, // DEVICE_DESTROYED_AT_WORLD_COLLISION
  DeviceState.Damaged, // DEVICE_CRITICAL_AT_DROWNING
  DeviceState.Destroyed, // DEVICE_DESTROYED_AT_DROWNING
  DeviceState.Damaged, // DEVICE_REPAIRED_TO_CRITICAL
  DeviceState.Ok, // DEVICE_REPAIRED
  DeviceState.Injured, // TANKMAN_HIT_AT_WORLD_COLLISION
  DeviceState.Injured, // TANKMAN_HIT_AT_DROWNING
  DeviceState.Ok, // TANKMAN_RESTORED
  null, // DEATH_FROM_DEVICE_EXPLOSION_AT_FIRE
  DeviceState.Damaged, // ENGINE_CRITICAL_AT_UNLIMITED_RPM
  DeviceState.Destroyed, // ENGINE_DESTROYED_AT_UNLIMITED_RPM
  DeviceState.Damaged, // ENGINE_CRITICAL_AT_BURNOUT
  DeviceState.Destroyed, // ENGINE_DESTROYED_AT_BURNOUT
];

/** The recorder's own parts at this tick, from their damage list. */
export function ownStates(
  entries: [number, number, number][],
  now: number,
): Map<number, DeviceState> {
  const states = new Map<number, DeviceState>();
  for (const [when, extra, code] of entries) {
    if (when > now) break;
    const state = CODE_STATE[code];
    if (state) states.set(extra, state);
  }
  return states;
}

/** Another vehicle's parts as the recorder's commander last saw them. */
export function seenStates(
  entries: { at: number; vehicle: number; damaged: number[]; destroyed: number[] }[],
  vehicle: number,
  now: number,
): { states: Map<number, DeviceState>; at: number } | null {
  let last: (typeof entries)[number] | null = null;
  for (const entry of entries) {
    if (entry.at > now) break;
    if (entry.vehicle === vehicle) last = entry;
  }
  if (!last) return null;
  const states = new Map<number, DeviceState>();
  for (const extra of last.damaged) {
    states.set(extra, extra >= FIRST_CREW ? DeviceState.Injured : DeviceState.Damaged);
  }
  for (const extra of last.destroyed) {
    states.set(extra, extra >= FIRST_CREW ? DeviceState.Injured : DeviceState.Destroyed);
  }
  return { states, at: last.at };
}

/** The game's own damage icons, from its `library/crits` atlas: one per module
 * in a damaged and a destroyed variant, one per crew role for an injury. */
const CRITS = iconUrl("library/crits");

/** Which icon each extra wears. Both tracks share one, as in the game. */
const ICON: Record<number, string> = {
  61: "engine",
  62: "ammoBay",
  63: "fuelTank",
  64: "radio",
  65: "track",
  66: "track",
  67: "gun",
  68: "turretRotator",
  69: "surveyingDevice",
  70: "commander",
  71: "driver",
  72: "radioman",
  73: "radioman",
  74: "gunner",
  75: "gunner",
  76: "loader",
  77: "loader",
};

function iconOf(extra: number, state: DeviceState): string {
  const name = ICON[extra];
  // The crew has only the hurt variant, the modules a damaged and a destroyed
  // one; a part in working order wears its damaged icon, greyed.
  if (extra >= FIRST_CREW) return `${CRITS}/${name}DestroyedSmall.png`;
  return `${CRITS}/${name}${state === DeviceState.Destroyed ? "Destroyed" : "Critical"}Small.png`;
}

/**
 * The modules and the crew as a row of the game's own damage icons: greyed when
 * fine, in the game's yellow when damaged and red when destroyed or injured.
 * The crew shows the seats the vehicle has when they are known (the
 * recorder's own), and only the hurt ones otherwise. Each says what it is and
 * how it stands on hover.
 */
export function ModuleStates({
  states,
  seats,
  seenAt,
  ticks,
  t,
}: {
  states: Map<number, DeviceState>;
  /** The crew's extras, when the seats are known. */
  seats: number[] | null;
  /** For another vehicle: the tick its commander's view was last updated. */
  seenAt: number | null;
  ticks: number;
  t: TranslateFunction;
}) {
  const crew = CREW.filter(([extra]) => (seats ? seats.includes(extra) : states.has(extra)));
  const icon = ([extra, key]: [number, string]) => {
    const state = states.get(extra) ?? DeviceState.Ok;
    const label = t(`replay.hud.part.${key}`);
    const said = state === DeviceState.Ok ? label : `${label} · ${t(`replay.hud.state.${state}`)}`;
    return (
      <Hint key={extra} content={said}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a 16px icon from the mirror, nothing for the optimiser to do */}
        <img
          src={iconOf(extra, state)}
          alt={said}
          width={18}
          height={18}
          className={cn("size-[18px]", state === DeviceState.Ok && "opacity-35 grayscale")}
        />
      </Hint>
    );
  };
  return (
    <div className="flex items-center gap-0.5">
      {MODULES.map(icon)}
      {crew.length ? <span className="bg-border mx-1 h-4 w-px" aria-hidden /> : null}
      {crew.map(icon)}
      {seenAt !== null ? (
        <Hint content={t("replay.hud.seen-at", { time: clock(seenAt / ticks) })}>
          <span className="text-muted-foreground ms-1 text-[11px] tabular-nums">
            {clock(seenAt / ticks)}
          </span>
        </Hint>
      ) : null}
    </div>
  );
}

/** The crew extras a loadout's seats stand for, in the client's order. */
export function seatsOf(roles: string[]): number[] {
  const out: number[] = [];
  const next: Record<string, number[]> = {
    commander: [70],
    driver: [71],
    radioman: [72, 73],
    gunner: [74, 75],
    loader: [76, 77],
  };
  for (const role of roles) {
    const extra = next[role]?.shift();
    if (extra !== undefined) out.push(extra);
  }
  return out;
}
