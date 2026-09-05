"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type Sweep, reachAt } from "@/components/tanks/detail/viewer/aiming";

/** Where the gun is pointed: bearing in turns, pitch in degrees up from level. */
export type Aim = (bearing: number, pitch: number) => void;

/** Where the reader is standing, in turns from the vehicle's nose. */
export type Watch = (bearing: number) => void;

const SIZE = 210;
const CENTRE = SIZE / 2;
/** The rim the gun reaches at its highest, and the hub it reaches at its lowest. */
const EDGE = 89;
const HUB = 28;
/** How far the turret's own body carries the barrel before it starts. */
const BREECH = 7;
/** Where the reader stands, just outside the ground the gun covers. */
const GALLERY = 97;
/** The barrel at level, which foreshortens as the muzzle leaves the horizontal. */
const BARREL = 18;
/** How finely the envelope is walked round the vehicle. */
const STEPS = 96;

/** Where a bearing and a radius fall, nose up and clockwise. */
function place(turn: number, radius: number): { x: number; y: number } {
  const angle = turn * Math.PI * 2;
  return {
    x: CENTRE + Math.sin(angle) * radius,
    y: CENTRE - Math.cos(angle) * radius,
  };
}

const trace = (points: { x: number; y: number }[]) =>
  points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

/**
 * What the gun can do, drawn as the shape it is.
 *
 * **A plan of where the gun is aimed, not a compass.** The dial is the ground
 * seen from above: the bearing round the middle is where the turret points, and
 * the distance from it is how far out the muzzle is looking, so a gun dropped
 * onto its own tracks sits near the hub and one lifted at the sky reaches the
 * rim. That is why the barrel drawn on the vehicle shortens as it tilts, which
 * is what a tube does when you look down on it.
 *
 * **Every bearing has its own pair of limits**, because the hull gets in the way
 * of its own gun: the Tiger drops 8 degrees over the nose and 3 over the engine
 * deck. Walking those round the tank draws a band, and the band answers the only
 * question anyone asks about depression, which is where they can use it.
 *
 * Pointing at it aims the vehicle and the picture follows, because what a plate
 * presents depends on where the gun is: reading armour off a tank pointed
 * straight ahead answers for one bearing out of every.
 *
 * **It writes into its own DOM rather than through React.** The vehicle answers
 * a pointer at the frame rate, and a state update per move would re-render the
 * whole picture's chrome to turn a turret two degrees.
 */
export function AimDial({
  sweep,
  arc,
  hullPitch,
  aimRef,
  watchRef,
  onAim,
}: {
  /** What the mirror publishes for the gun that is mounted. */
  sweep: Sweep | undefined;
  /** How far the turret turns either side, in degrees, for a hull that limits it. */
  arc: number[] | undefined;
  /** How far the hull itself tips, for a vehicle that aims by kneeling. */
  hullPitch: number[] | null | undefined;
  /** Filled with the updater the vehicle calls once it has taken an ask. */
  aimRef: React.RefObject<Aim | null>;
  /** Filled with the updater the draw loop calls as the camera moves. */
  watchRef: React.RefObject<Watch | null>;
  /** Where a reader's ask goes: the vehicle turns, then tells the dial. */
  onAim: Aim;
}) {
  const dial = useRef<SVGSVGElement>(null);
  const tower = useRef<SVGGElement>(null);
  const barrel = useRef<SVGRectElement>(null);
  const sight = useRef<SVGLineElement>(null);
  const marker = useRef<SVGGElement>(null);
  const eye = useRef<SVGGElement>(null);
  const rise = useRef<SVGTextElement>(null);
  const side = useRef<SVGTextElement>(null);
  /** A reader who has settled on an aim keeps it until they say otherwise. */
  const [held, setHeld] = useState(false);

  /**
   * The band, walked once per vehicle.
   *
   * **A limited traverse leaves its curves open.** A turret that goes all the
   * way round closes on itself and the shape is a ring; one that stops has two
   * ends, and joining them would draw a boundary across ground the gun cannot
   * cover.
   */
  const shape = useMemo(() => {
    if (!sweep) return null;
    // **The hull's own tipping adds to whatever the gun does.** Twenty-seven
    // vehicles put some of their aiming in the suspension, and on the Swedish
    // destroyers it is nearly all of it: their gun is bolted to the hull and
    // moves a degree, while the body kneels eleven either way. The hull has no
    // idea which way the gun is looking, so its share is the same at every
    // bearing and the gun's varies as it always did.
    const kneel = hullPitch ? { down: -hullPitch[0]!, up: hullPitch[1]! } : null;
    // A vehicle that aims with its body turns the body, so its turret's own
    // stops say nothing about where the gun can end up.
    const swings = arc && !kneel;
    const from = swings ? arc[0]! / 360 : 0;
    const to = swings ? arc[1]! / 360 : 1;
    const walk = Array.from({ length: STEPS + 1 }, (_, i) => {
      const turn = from + ((to - from) * i) / STEPS;
      const own = reachAt(sweep, turn);
      return kneel
        ? { turn, lo: own.lo - kneel.down, hi: own.hi + kneel.up }
        : { turn, ...own };
    });
    const floor = Math.min(...walk.map((w) => w.lo));
    const reachable = Math.max(...walk.map((w) => w.hi)) - floor;
    if (reachable < 2) return null;
    const span = reachable;
    const radius = (pitch: number) =>
      HUB + Math.max(0, Math.min(1, (pitch - floor) / span)) * (EDGE - HUB);
    const outer = walk.map((w) => place(w.turn, radius(w.hi)));
    const inner = walk.map((w) => place(w.turn, radius(w.lo)));
    const close = swings ? "" : " Z";
    return {
      outer: trace(outer) + close,
      inner: trace(inner) + close,
      region: `${trace(outer)} ${trace([...inner].reverse()).replace(/^M/, "L")} Z`,
      level: swings ? trace(walk.map((w) => place(w.turn, radius(0)))) : null,
      levelRadius: radius(0),
      radius,
      pitchAt: (reach: number) =>
        floor + Math.max(0, Math.min(1, (reach - HUB) / (EDGE - HUB))) * span,
    };
  }, [sweep, arc, hullPitch]);

  useEffect(() => {
    if (!shape) return;
    aimRef.current = (bearing, pitch) => {
      const degrees = bearing * 360;
      tower.current?.setAttribute(
        "transform",
        `rotate(${degrees.toFixed(2)} ${CENTRE} ${CENTRE})`,
      );
      // Seen from above a tilted barrel is shorter than a level one, and the
      // muzzle it carries moves in with it.
      const length = BARREL * Math.cos((pitch * Math.PI) / 180);
      const muzzle = BREECH + length;
      barrel.current?.setAttribute("y", (CENTRE - muzzle).toFixed(2));
      barrel.current?.setAttribute("height", Math.max(0, length).toFixed(2));
      const start = place(bearing, muzzle);
      const end = place(bearing, EDGE + 4);
      sight.current?.setAttribute("x1", start.x.toFixed(2));
      sight.current?.setAttribute("y1", start.y.toFixed(2));
      sight.current?.setAttribute("x2", end.x.toFixed(2));
      sight.current?.setAttribute("y2", end.y.toFixed(2));
      const spot = place(bearing, shape.radius(pitch));
      marker.current?.setAttribute(
        "transform",
        `translate(${spot.x.toFixed(2)} ${spot.y.toFixed(2)})`,
      );
      if (rise.current) {
        const mark = pitch > 0.05 ? "▲" : pitch < -0.05 ? "▼" : "●";
        rise.current.textContent = `${mark} ${Math.abs(pitch).toFixed(1)}°`;
      }
      if (side.current) {
        // Named the short way round, so the rear reads as 180 either side.
        const round = degrees > 180 ? degrees - 360 : degrees;
        const mark = Math.abs(round) < 0.05 ? "●" : round < 0 ? "◀" : "▶";
        side.current.textContent = `${mark} ${Math.abs(round).toFixed(1)}°`;
      }
    };
    return () => {
      aimRef.current = null;
    };
  }, [aimRef, shape]);

  useEffect(() => {
    watchRef.current = (bearing) => {
      const spot = place(bearing, GALLERY);
      // Turned to face the vehicle, so the lens reads as looking at it rather
      // than as a mark that happens to sit there.
      eye.current?.setAttribute(
        "transform",
        `translate(${spot.x.toFixed(2)} ${spot.y.toFixed(2)}) rotate(${(bearing * 360).toFixed(1)})`,
      );
    };
    return () => {
      watchRef.current = null;
    };
  }, [watchRef]);

  const point = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const box = dial.current?.getBoundingClientRect();
      if (!box || !sweep || !shape) return;
      const scale = SIZE / box.width;
      const dx = (event.clientX - box.left) * scale - CENTRE;
      const dy = (event.clientY - box.top) * scale - CENTRE;
      let turn = Math.atan2(dx, -dy) / (Math.PI * 2);
      if (turn < 0) turn += 1;
      const kneel = hullPitch ? { down: -hullPitch[0]!, up: hullPitch[1]! } : null;
      if (arc && !kneel) {
        const signed = turn > 0.5 ? turn - 1 : turn;
        if (signed < arc[0]! / 360 || signed > arc[1]! / 360) return;
      }
      // The distance asks for a pitch; the bearing decides how much of it the
      // vehicle can give.
      const own = reachAt(sweep, turn);
      const lo = own.lo - (kneel?.down ?? 0);
      const hi = own.hi + (kneel?.up ?? 0);
      const wanted = shape.pitchAt(Math.min(Math.hypot(dx, dy), EDGE));
      onAim(turn, Math.min(Math.max(wanted, lo), hi));
    },
    [onAim, sweep, arc, shape, hullPitch],
  );

  if (!sweep || !shape) return null;

  const spoke = (edge: number) => place(edge / 360, EDGE + 2);

  return (
    <div className="w-[210px] max-w-full text-fd-muted-foreground">
      <svg
        ref={dial}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={held ? "w-full cursor-pointer" : "w-full cursor-crosshair"}
        onPointerMove={(event) => {
          if (!held) point(event);
        }}
        onClick={(event) => {
          point(event);
          setHeld((on) => !on);
        }}
      >
        <circle cx={CENTRE} cy={CENTRE} r={EDGE} className="fill-white/4" />
        <path d={shape.region} className="fill-white/8" />
        {shape.level ? (
          <path
            d={shape.level}
            fill="none"
            className="stroke-current opacity-35"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ) : (
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={shape.levelRadius}
            fill="none"
            className="stroke-current opacity-35"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        <path d={shape.outer} fill="none" className="stroke-current opacity-30" strokeWidth={1} />
        <path d={shape.inner} fill="none" className="stroke-current opacity-30" strokeWidth={1} />
        {/* Where a limited traverse stops, said outright rather than left to the
            band's ends: a casemate is a casemate because of these. */}
        {arc && !hullPitch ? (
          <g className="stroke-current opacity-30" strokeWidth={1}>
            <line x1={CENTRE} y1={CENTRE} x2={spoke(arc[0]!).x} y2={spoke(arc[0]!).y} />
            <line x1={CENTRE} y1={CENTRE} x2={spoke(arc[1]!).x} y2={spoke(arc[1]!).y} />
          </g>
        ) : null}
        <line
          ref={sight}
          x1={CENTRE}
          y1={CENTRE - BREECH - BARREL}
          x2={CENTRE}
          y2={CENTRE - EDGE - 4}
          className="stroke-current opacity-40"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        {/* The hull, which cannot turn, and the turret, which does. */}
        <g className="fill-current opacity-55">
          <rect x={CENTRE - 9} y={CENTRE - 10} width={18} height={28} rx={2.5} />
          <g ref={tower}>
            <rect
              ref={barrel}
              x={CENTRE - 1.5}
              y={CENTRE - BREECH - BARREL}
              width={3}
              height={BARREL}
            />
            <rect x={CENTRE - 6} y={CENTRE - 7} width={12} height={14} rx={3} />
          </g>
        </g>
        <g ref={marker} transform={`translate(${CENTRE} ${CENTRE - EDGE})`}>
          {held ? (
            <circle r={6} fill="none" className="stroke-amber-400 opacity-70" strokeWidth={1.1} />
          ) : null}
          <circle r={3} className="fill-amber-400 stroke-black/50" strokeWidth={0.8} />
        </g>
        {/* Where the reader is standing. Outside the ground the gun covers,
            because it is not somewhere the gun can be pointed: it answers
            "which side am I looking from", which the picture alone stops
            telling you the moment the turret turns. */}
        <g ref={eye} transform={`translate(${CENTRE} ${CENTRE - GALLERY})`}>
          {/* Drawn looking down the dial, so one turn of the whole glyph keeps
              the lens on the vehicle wherever the reader has walked to. */}
          <g className="fill-current opacity-70">
            <rect x={-4.5} y={-4.5} width={9} height={6} rx={1.5} />
            <path d="M-2 1.5 L-3.6 5.5 L3.6 5.5 L2 1.5 Z" />
          </g>
        </g>
        <g className="fill-fd-foreground text-[11px] font-semibold tabular-nums">
          <text ref={rise} x={5} y={SIZE - 7}>
            ● 0.0°
          </text>
          <text ref={side} x={SIZE - 5} y={SIZE - 7} textAnchor="end">
            ● 0.0°
          </text>
        </g>
      </svg>
    </div>
  );
}
