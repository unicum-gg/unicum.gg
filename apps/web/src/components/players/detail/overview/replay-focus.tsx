"use client";

import { CrosshairIcon, HandshakeIcon, ShieldIcon, type Icon } from "@phosphor-icons/react";
import type { TranslateFunction } from "@onruntime/translations";
import type { Region } from "@unicum.gg/wargaming";
import { Hint } from "@/components/hint";
import { TankIcon } from "@/components/tanks/tank-icon";
import type { LoadoutShellView } from "@/components/players/detail/tanks/loadout-boxes";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import type { Participant } from "./battle-types";
import type { Motion, Track } from "./replay-types";
import { ModuleStates, ownStates, seatsOf, seenStates } from "./replay-modules";
import { hpAt } from "./replay-math";

/** The client's `BATTLE_EVENT_TYPE` values the panel counts. */
const FEED = { radio: 1, track: 2, blocked: 5, damage: 7, stun: 11 };

/** The window a speed is measured over, in seconds. */
const SPEED_WINDOW_S = 1;

/**
 * How fast a vehicle was going, in km/h, from its last two tracked positions a
 * second or so apart. Null out of sight or standing still for longer than a
 * position is written: positions are only kept when they change, and the
 * minimap's far ones are too coarse to time a tank by.
 */
function speedAt(track: Track, at: number, ticks: number): number | null {
  const now = at * ticks;
  const points = track.points;
  let last = -1;
  for (let index = 0; index < points.length; index += 1) {
    if (points[index][0] > now) break;
    last = index;
  }
  if (last < 0) return null;
  // Silent for over a second: either standing still or out of sight, and the
  // map already says which; neither is a speed.
  if (now - points[last][0] > 2 * ticks) return 0;
  let first = last;
  while (first > 0 && points[last][0] - points[first - 1][0] <= SPEED_WINDOW_S * ticks) first -= 1;
  const span = (points[last][0] - points[first][0]) / ticks;
  if (span <= 0) return 0;
  const metres = Math.hypot(points[last][1] - points[first][1], points[last][2] - points[first][2]);
  return (metres / span) * 3.6;
}

/**
 * The followed player's own panel under the map, the site's take on the
 * game's damage panel: their hit points and speed, what they have dealt so
 * far, and what they had fitted.
 *
 * Every block says only what the recording knows. The damage dealt is summed
 * from the hits it heard, so for anybody but the recorder it can fall short of
 * the results; the assistance and the damage blocked are the battle's final
 * figures, said as such; and the loadout exists for the recorder alone, since
 * the server strips everyone else's devices before they reach a client. A
 * block with nothing behind it is left out rather than drawn empty.
 */
export function FocusPanel({
  focused,
  track,
  motion,
  recorder,
  at,
  ticks,
  region,
  colour,
  t,
}: {
  focused: Participant;
  track: Track | undefined;
  motion: Motion;
  /** Whether the followed player is the one who recorded: only their own
   * rack, modules and feed are in the recording. */
  recorder: boolean;
  at: number;
  ticks: number;
  region: Region;
  /** The side's text colour, as the rosters paint this player. */
  colour: string;
  t: TranslateFunction;
}) {
  const { t: tLoadout } = useTranslation("components/players/detail/tanks/loadout-panel");
  const { num } = useFormat();
  const number = (value: number) => num().format(value);
  const now = at * ticks;
  const own = focused.own;
  const max = own.maxHealth || track?.maxHealth || 0;
  const hp = track ? hpAt(track, at, ticks) : max;
  const speed = track ? speedAt(track, at, ticks) : null;
  // The recorder's own feed when there is one, live; otherwise the hits the
  // recording heard for the damage, and the results for the rest.
  const feed = recorder && motion.events?.length ? motion.events : null;
  const fed = (types: number[]) =>
    (feed ?? []).reduce(
      (sum, [when, type, , amount]) => (when <= now && types.includes(type) ? sum + amount : sum),
      0,
    );
  const dealt = feed
    ? fed([FEED.damage])
    : (motion.hits ?? []).reduce(
        (sum, [when, by, , damage]) => (by === focused.id && when <= now ? sum + damage : sum),
        0,
      );
  const assisted = feed
    ? fed([FEED.radio, FEED.track, FEED.stun])
    : (own.radio ?? 0) + (own.track ?? 0);
  const blocked = feed ? fed([FEED.blocked]) : (own.blocked ?? 0);
  const loadout = focused.loadouts?.[0];
  // Rounds left, live for the recorder: the last count of each place in the
  // rack, in the loadout's own order.
  const left = new Map<number, number>();
  if (recorder) {
    for (const [when, slot, rounds] of motion.ammo ?? []) {
      if (when > now) break;
      left.set(slot, rounds);
    }
  }
  const shells: LoadoutShellView[] = (loadout?.shells ?? []).map((shell, index) => ({
    id: index,
    kind: shell.kind,
    count: left.get(index) ?? shell.count,
    premium: shell.premium,
    image: shell.image,
  }));
  // Modules and crew: the recorder's own, or what their commander could see
  // of this vehicle while aiming at it.
  const seen = recorder ? null : seenStates(motion.targetDamage ?? [], focused.id, now);
  const states = recorder ? ownStates(motion.ownDamage ?? [], now) : (seen?.states ?? null);
  // The seats from the recording's own loadout, whose roles are the client's
  // keys; the battle's named one carries them translated.
  const crewRoles = motion.loadouts?.[0]?.crew?.map((member) => member.role);
  const seats = recorder && crewRoles?.length ? seatsOf(crewRoles) : null;

  // A figure with the site's own icon for it (the battle performance table's),
  // its name and how it was counted on hover: the band holds numbers.
  const figure = (Mark: Icon, label: string, value: string, hint?: string) => (
    <Hint content={hint ? `${label} · ${hint}` : label}>
      <span className="flex items-center gap-1">
        <Mark className="text-muted-foreground size-3.5" aria-label={label} />
        <span className="text-[13px] font-semibold tabular-nums">{value}</span>
      </span>
    </Hint>
  );
  const divider = <span className="bg-border h-4 w-px shrink-0" aria-hidden />;

  // Two lines under the transport, everything at a glance and the detail on
  // hover. Above: who, how much health and how fast, and what they have done.
  // Below: how their tank and crew stand, and the rounds they have left.
  return (
    <div className="border-border/60 flex flex-col gap-2 border-t px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {focused.tank ? (
            <TankIcon
              region={region}
              tag={focused.tank.tag}
              type={focused.tank.type}
              nation={focused.tank.nation}
              className="h-4 w-auto object-contain"
            />
          ) : null}
          <Hint content={focused.tank?.shortName ?? ""}>
            <span className={cn("max-w-28 truncate text-[13px] font-medium", colour)}>
              {focused.player?.nickname ?? focused.tank?.shortName ?? ""}
            </span>
          </Hint>
        </div>
        {max ? (
          <Hint content={`${t("replay.hud.hp")} · ${number(Math.round(hp))} / ${number(max)}`}>
            <span className="flex items-center gap-1.5">
              <span className="bg-muted h-1.5 w-12 overflow-hidden rounded-full">
                <span
                  className={cn("block h-full rounded-full bg-current", colour)}
                  style={{ width: `${Math.max(0, Math.min(1, hp / max)) * 100}%` }}
                />
              </span>
              <span className="text-[13px] font-semibold tabular-nums">{number(Math.round(hp))}</span>
            </span>
          </Hint>
        ) : null}
        {speed !== null ? (
          <Hint content={t("replay.hud.speed")}>
            <span className="text-muted-foreground text-[13px] tabular-nums">
              {t("replay.hud.kmh", { speed: Math.round(speed) })}
            </span>
          </Hint>
        ) : null}
        <span className="ms-auto flex items-center gap-3">
          {figure(CrosshairIcon, t("replay.hud.damage"), number(dealt), t("replay.hud.damage-hint"))}
          {figure(HandshakeIcon, t("replay.hud.assisted"), number(assisted), feed ? undefined : t("replay.hud.final-hint"))}
          {figure(ShieldIcon, t("replay.hud.blocked"), number(blocked), feed ? undefined : t("replay.hud.final-hint"))}
        </span>
      </div>
      {states || shells.length ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {states ? (
            <ModuleStates states={states} seats={seats} seenAt={seen?.at ?? null} ticks={ticks} t={t} />
          ) : null}
          {states && shells.length ? divider : null}
          {shells.length ? (
            <span className="flex items-center gap-2.5">
              {shells.map((shell) => (
                <Hint key={shell.id} content={tLoadout("ammo")}>
                  <span className={cn("flex items-center gap-0.5", shell.count === 0 && "opacity-40")}>
                    {shell.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a mirror icon at 18px
                      <img src={shell.image} alt="" width={18} height={18} className="size-[18px]" />
                    ) : null}
                    <span
                      className={cn(
                        "text-[13px] font-semibold tabular-nums",
                        shell.premium && "text-amber-300",
                      )}
                    >
                      {shell.count}
                    </span>
                  </span>
                </Hint>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
