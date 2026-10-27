"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { CrosshairIcon } from "@phosphor-icons/react/dist/ssr";
import { CONTROL, Mark } from "@/components/tanks/detail/viewer/control-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  gameModeFromRaw,
  GuidePhase,
  guidePhaseOf,
  LOADOUT_MODES,
  type LoadoutMode,
  type MapPositionLayout,
  type MapPositions,
} from "@unicum.gg/shared";
import { axisCells } from "@/components/maps/detail/minimap-grid";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  blur,
  damageSquares,
  paint,
  RAMP_GRADIENT,
  spotSquares,
  sumDamage,
  type GuideSquare,
} from "@/components/maps/detail/positions-math";
import type { MapView } from "@/components/maps/detail/views";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

/**
 * The positioning guide: "I spawn on this side in this class, where do I go,
 * and where is the fight later on?", answered from the recorded battles.
 *
 * Three choices, always on screen: the side the reader starts from, named the
 * way they see it on the minimap; one class; and the moment of the battle. The
 * map then carries the damage dealt from each place at that moment and the
 * best squares numbered, and the panel beside it ranks those squares as
 * players call them (`F6`).
 *
 * A layout is played in more than one mode (Skirmishes run on the Encounter
 * ground, Advances on the Standard one), so where a view holds battles in
 * several, the panel adds a fourth choice: the mode. Never pooled, for the
 * reason the Statistics tab gives: each has its own team size and its own
 * idea of a good position.
 */

/** Classes in the order the game lists them. */
const CLASS_ORDER = ["heavyTank", "mediumTank", "lightTank", "AT-SPG", "SPG"];

/** Each phase's name in the locale files. */
export const PHASE_KEY: Record<GuidePhase, string> = {
  [GuidePhase.Opening]: "opening",
  [GuidePhase.Middle]: "middle",
  [GuidePhase.Late]: "late",
};

/** Squares ranked in the panel and numbered on the map. */
const TOP_SQUARES = 5;


export type GuideState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  mode: LoadoutMode | null;
  setMode: (mode: LoadoutMode) => void;
  team: number | null;
  setTeam: (team: number) => void;
  vehicleClass: string | null;
  setVehicleClass: (vehicleClass: string) => void;
  phase: GuidePhase;
  setPhase: (phase: GuidePhase) => void;
  hovered: number | null;
  setHovered: (index: number | null) => void;
  data: MapPositions | undefined;
};

/**
 * The guide's state. Open by default: it is the map page's answer to "where do
 * I go", so it shows from the first look wherever battles were recorded. Its
 * data arrives with the page (`initial`), so opening it draws no second
 * loading state.
 */
export function useGuide(initial: MapPositions | null): GuideState {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<LoadoutMode | null>(null);
  const [team, setTeam] = useState<number | null>(null);
  const [vehicleClass, setVehicleClass] = useState<string | null>(null);
  const [phase, setPhase] = useState(GuidePhase.Opening);
  const [hovered, setHovered] = useState<number | null>(null);
  const data = initial ?? undefined;
  return {
    open,
    setOpen,
    mode,
    setMode,
    team,
    setTeam,
    vehicleClass,
    setVehicleClass,
    phase,
    setPhase,
    hovered,
    setHovered,
    data,
  };
}

/** Everything the guide shows for one view, worked out once per render. */
export type GuideView = {
  layout: MapPositionLayout | null;
  /** The modes this view's ground holds battles in, the switch's choices. */
  modes: { mode: LoadoutMode; battles: number }[];
  team: number;
  vehicleClass: string;
  classes: string[];
  squares: GuideSquare[];
  /** Damage per cell of the grid, blurred, for the picture. */
  values: Float32Array | null;
  grid: number;
  /** Players of this side and class with a spot, at the opening. */
  players: number;
};

/** Every recorded layout under one view's ground, one per mode. */
function layoutsFor(data: MapPositions | undefined, view: MapView | undefined) {
  const battles = view?.battles;
  if (!data || !view || !battles) return [];
  return data.layouts.filter(
    (layout) =>
      layout.arenaId === view.arenaId &&
      layout.battles > 0 &&
      // The battles carry the client's token (`ctf`), the random views our
      // name for it (`standard`); Onslaught is `comp7` on both sides.
      (gameModeFromRaw(layout.gameplayId) ?? layout.gameplayId) ===
        battles.gameplayId,
  );
}

/**
 * The layout shown: the picked mode where this ground has it, else the view's
 * own mode (Random under a random view), else the mode with most battles, so
 * an Encounter only ever played as a Skirmish still opens on something.
 */
function pickLayout(
  layouts: MapPositionLayout[],
  picked: LoadoutMode | null,
  view: MapView | undefined,
) {
  const of = (mode: LoadoutMode | null | undefined) =>
    layouts.find((layout) => layout.mode === mode);
  return (
    of(picked) ??
    of(view?.battles?.mode) ??
    [...layouts].sort((a, b) => b.battles - a.battles)[0] ??
    null
  );
}

export function useGuideView(
  state: GuideState,
  view: MapView | undefined,
): GuideView {
  const layouts = layoutsFor(state.data, view);
  const layout = pickLayout(layouts, state.mode, view);
  const modes = LOADOUT_MODES.flatMap((mode) => {
    const held = layouts.find((each) => each.mode === mode);
    return held ? [{ mode, battles: held.battles }] : [];
  });
  const grid = state.data?.grid ?? 1;
  const spotsOf = (team: number) =>
    layout?.spots.filter((spot) => spot.team === team) ?? [];
  const team =
    state.team ?? (spotsOf(2).length > spotsOf(1).length ? 2 : 1);
  const classes = CLASS_ORDER.filter(
    (each) =>
      spotsOf(team).some((spot) => spot.vehicleClass === each) ||
      layout?.damage.some(
        (slice) => slice.team === team && slice.vehicleClass === each,
      ),
  );
  // The class most players of this side brought, unless one was picked.
  const vehicleClass =
    state.vehicleClass && classes.includes(state.vehicleClass)
      ? state.vehicleClass
      : ([...classes].sort(
          (a, b) =>
            spotsOf(team).filter((spot) => spot.vehicleClass === b).length -
            spotsOf(team).filter((spot) => spot.vehicleClass === a).length,
        )[0] ?? CLASS_ORDER[0]);

  const width = view?.widthMeters ?? 0;
  const height = view?.heightMeters ?? 0;
  const maxDim = Math.max(width, height, 1);
  const cols = axisCells(width || maxDim, maxDim);
  const rows = axisCells(height || maxDim, maxDim);

  return useMemo(() => {
    if (!layout) {
      return { layout, modes, team, vehicleClass, classes, squares: [], values: null, grid, players: 0 };
    }
    const mine = <T extends { team: number; vehicleClass: string }>(each: T) =>
      each.team === team && each.vehicleClass === vehicleClass;
    const spots = layout.spots.filter(mine);
    const kills = layout.kills
      .filter(mine)
      .filter((kill) => guidePhaseOf(kill.at) === state.phase);
    const raw = sumDamage(
      layout.damage.filter((slice) => mine(slice) && slice.phase === state.phase),
      grid,
    );
    const squares =
      state.phase === GuidePhase.Opening
        ? spotSquares(spots, kills, cols, rows)
        : damageSquares(raw, grid, kills, cols, rows);
    return {
      layout,
      modes,
      team,
      vehicleClass,
      classes,
      squares: squares.slice(0, TOP_SQUARES),
      values: blur(raw, grid),
      grid,
      players: spots.length,
    };
    // `classes` is derived from the same inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, team, vehicleClass, state.phase, grid, cols, rows]);
}

/** The guide's switch, among the minimap's layers. */
export function GuideToggle({
  state,
  available,
}: {
  state: GuideState;
  available: boolean;
}) {
  const { t } = useTranslation("components/maps/detail/minimap-guide");
  if (!available) return null;
  return (
    <Mark
      on={state.open}
      onClick={() => state.setOpen(!state.open)}
      says={t("toggle")}
    >
      <CrosshairIcon className="size-4" />
    </Mark>
  );
}

export function GuideOverlay({
  state,
  guide,
}: {
  state: GuideState;
  guide: GuideView;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shown = state.open && Boolean(guide.layout);
  // Painted in the browser only: `ImageData` does not exist on the server.
  // `shown` is a dependency because closing the guide unmounts the canvas:
  // reopened with the same values, it would come back blank.
  useEffect(() => {
    if (!shown || !guide.values) return;
    canvas.current
      ?.getContext("2d")
      ?.putImageData(paint(guide.values, guide.grid), 0, 0);
  }, [shown, guide.values, guide.grid]);
  if (!shown) return null;
  return (
    <>
      <canvas
        ref={canvas}
        width={guide.grid}
        height={guide.grid}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {guide.squares.map((square, index) => (
        <span
          key={square.name}
          onMouseEnter={() => state.setHovered(index)}
          onMouseLeave={() => state.setHovered(null)}
          className={cn(
            "absolute flex size-7 cursor-default -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-fd-background text-sm font-bold text-fd-foreground shadow-lg transition-transform",
            state.hovered === index && "scale-125 bg-brand text-white",
          )}
          style={{ left: `${square.left}%`, top: `${square.top}%` }}
        >
          {index + 1}
        </span>
      ))}
    </>
  );
}

/**
 * What the colours and the numbers on the map mean, behind an information
 * button in the minimap's toolbar, as the vehicle viewer keys its armour
 * colours: a key is read once, and standing open it would cover the map it
 * explains. Only while the guide is drawn, since it keys nothing else.
 */
export function GuideLegend({
  state,
  guide,
}: {
  state: GuideState;
  guide: GuideView;
}) {
  const { t } = useTranslation("components/maps/detail/minimap-guide");
  if (!state.open || !guide.layout) return null;
  const phase = state.phase;
  return (
    <Popover>
      {/* Named on hover like the marks beside it: an icon alone does not
          say there is a key behind it. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button type="button" aria-label={t("legend.open")} className={CONTROL}>
              <Info className="size-4" aria-hidden />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{t("legend.open")}</TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="end" className="w-72 space-y-3 p-3 text-xs">
        <div>
          <div className="mb-1.5 font-medium uppercase tracking-wide text-fd-muted-foreground">
            {t("legend.colours")}
          </div>
          <div className="h-2 rounded-sm" style={{ background: RAMP_GRADIENT }} />
          <div className="mt-1 flex justify-between text-fd-muted-foreground">
            <span>{t("legend.little")}</span>
            <span>{t("legend.a-lot")}</span>
          </div>
          <p className="mt-1.5 text-fd-muted-foreground">
            {t(`legend.colours-${PHASE_KEY[phase]}`)}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-white bg-fd-background text-[10px] font-bold">
            1
          </span>
          <p className="text-fd-muted-foreground">
            {t(`legend.numbers-${PHASE_KEY[phase]}`)}
          </p>
        </div>
        <p className="text-fd-muted-foreground">{t("legend.grid")}</p>
      </PopoverContent>
    </Popover>
  );
}

/** The ranked squares, beside the map. */
