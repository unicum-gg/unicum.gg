"use client";

import {
  AlignHorizontalDistributeCenter,
  AlignHorizontalDistributeStart,
  Cog,
  Fullscreen,
  Maximize2,
  Minimize,
  Minimize2,
  Mountain,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Video,
  VideoOff,
} from "lucide-react";
import type { ComponentType } from "react";

import {
  CINEMATIC_LABEL,
  CINEMATIC_NEXT,
  CINEMATIC_TOOLTIP,
  Cinematic,
} from "@/components/tanks/detail/viewer/cinematic";
import { Group, Mark } from "@/components/tanks/detail/viewer/control-group";
import {
  engagedLabel,
  engagedMeaning,
  travelLabel,
  ModeIcon,
} from "@/components/tanks/detail/mode-marks";
import {
  PRESENTATION_LABEL,
  Presentation,
} from "@/components/tanks/detail/viewer/presentation";

/** The two sizes on offer, in the order they are offered. */
const SIZES: Exclude<Presentation, Presentation.Inline>[] = [
  Presentation.Windowed,
  Presentation.Screen,
];

/** The mark each position of the cinematic camera carries. */
const CINEMATIC_ICON: Record<
  Cinematic,
  ComponentType<{ className?: string }>
> = {
  [Cinematic.Off]: VideoOff,
  [Cinematic.Auto]: Timer,
  [Cinematic.On]: Video,
};

/**
 * Where the vehicle is seen from, and how it is standing to be seen.
 *
 * **One group because they answer one question.** Framing it, putting it back,
 * tipping it onto a ridge, planting it and letting the camera walk round are
 * all the reader saying where to look from, whether they move the eye or the
 * tank. What the tank is painted and what it is firing are not that, and they
 * are boxed elsewhere.
 *
 * The running tracks are here rather than with the paint for the same reason:
 * they are the other thing on this page that moves by itself, and a reader who
 * wants the scene to hold still is reaching for one switch or the other.
 */
export function CameraControls({
  centred,
  onRecentre,
  resettable,
  onReset,
  hullDown,
  onHullDown,
  canDeploy,
  deployed,
  onDeploy,
  mechanic,
  cinematic,
  onCinematic,
  works,
  onWork,
  rolls,
  rolling,
  onRolling,
}: {
  centred: boolean;
  onRecentre: () => void;
  resettable: boolean;
  onReset: () => void;
  hullDown: boolean;
  onHullDown: () => void;
  /** Whether this vehicle has a deployed state at all. */
  canDeploy: boolean;
  deployed: boolean;
  onDeploy: (on: boolean) => void;
  /** Which mechanic the second state is, so the mark can be named for it. */
  mechanic: string | null;
  cinematic: Cinematic;
  onCinematic: (next: Cinematic) => void;
  /**
   * Whether the tracks can run at all, which needs the mirror to know the
   * vehicle's axles and needs a view that draws them: the armour views are
   * answers rather than a tank in a garage, and nothing rolls in them.
   */
  /** Whether this vehicle has a mechanism to work at all, which few do. */
  works: boolean;
  onWork: () => void;
  rolls: boolean;
  rolling: boolean;
  onRolling: () => void;
}) {
  const CinematicMark = CINEMATIC_ICON[cinematic];
  return (
    <Group>
      {/*
        Centring, which is a framing rather than an undo: the vehicle sits off
        to the left because that is where the hero wants it, and this brings it
        to the middle of the band, where a hull can be read rather than looked
        at. It stays offered once centred, marked as the state it is in, so the
        pair never swaps meaning under the cursor.
      */}
      <Mark
        on={centred}
        onClick={onRecentre}
        says={centred ? "Put it back off centre" : "Center the vehicle"}
      >
        {centred ? (
          <AlignHorizontalDistributeStart className="size-4" aria-hidden />
        ) : (
          <AlignHorizontalDistributeCenter className="size-4" aria-hidden />
        )}
      </Mark>
      {/*
        And undoing, which is the other thing entirely: back to the angle and
        the framing the page opened on. Offered only once there is something to
        undo, since a reset for a view nobody has touched is furniture.
      */}
      {resettable ? (
        <Mark onClick={onReset} says="Reset view">
          <RotateCcw className="size-4" aria-hidden />
        </Mark>
      ) : null}
      {/*
        Hull down: the vehicle as whoever is shooting at it meets it, gun down
        as far as it goes and turret turned to face them.

        **Leaving it levels the tank, it does not go back to a view.** The words
        said "back to the hangar view", which named the camera the pose happens
        to move: what a reader is undoing is a stance the vehicle is standing
        in, and the camera follows it the way it followed on the way down.
      */}
      <Mark
        on={hullDown}
        onClick={onHullDown}
        says={hullDown ? "Level the vehicle" : "Hull down"}
      >
        {/* The ridge itself. A box with its bottom edge left undrawn says what
            is hidden more literally, and read worse: at sixteen pixels it is a
            square, where a hill is a hill. */}
        <Mountain className="size-4" aria-hidden />
      </Mark>
      {/*
        Planting it, for the sixty-seven vehicles that aim by kneeling. It is
        not a camera angle: the tank itself stands differently, and on most of
        them the gun's own travel changes with it.

        **The marks of the switch beside the characteristics**, on one button
        rather than its two: they set the same state, so the crosshair learned
        down there is the crosshair up here rather than an anchor. One mark
        because a bar over a picture is not a form, and the state is a pair: it
        shows which of the two the vehicle is in, the way the quality mark shows
        HD or SD, and says what the click will do in the words behind it.
      */}
      {canDeploy ? (
        <Mark
          on={deployed}
          onClick={() => onDeploy(!deployed)}
          says={deployed ? engagedLabel(mechanic) : travelLabel(mechanic)}
          tooltip={
            deployed
              ? `${engagedLabel(mechanic)}: ${engagedMeaning(mechanic)}. Back to ${travelLabel(mechanic).toLowerCase()}`
              : `${travelLabel(mechanic)}: the vehicle before the switch. Show it ${engagedMeaning(mechanic)}`
          }
        >
          <ModeIcon mechanic={mechanic} engaged={deployed} />
        </Mark>
      ) : null}
      {/* The camera that turns by itself, off, on, or on until touched. */}
      <Mark
        on={cinematic !== Cinematic.Off}
        onClick={() => onCinematic(CINEMATIC_NEXT[cinematic])}
        says={CINEMATIC_LABEL[cinematic]}
        tooltip={CINEMATIC_TOOLTIP[cinematic]}
      >
        <CinematicMark className="size-4" aria-hidden />
      </Mark>
      {/* The mechanism, where the vehicle has one. It runs once and stops, so
          the mark is a button rather than a switch. */}
      {works ? (
        <Mark
          onClick={onWork}
          says={`Work the ${engagedLabel(mechanic).toLowerCase()} mechanism`}
          tooltip={`Run the gun through its ${engagedLabel(mechanic).toLowerCase()} cycle, as the game plays it on a shot`}
        >
          <Cog className="size-4" aria-hidden />
        </Mark>
      ) : null}
      {rolls ? (
        <Mark
          on={rolling}
          onClick={onRolling}
          says={rolling ? "Stop the tracks" : "Run the tracks"}
        >
          {rolling ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
        </Mark>
      ) : null}
    </Group>
  );
}

/**
 * How much room the scene gets, which is about the page rather than the tank.
 *
 * Its own group, and last, for that reason: it is the one pair here that says
 * nothing about the vehicle. Two buttons rather than one that cycles, because
 * they are not two points on a scale but two different offers, and a reader who
 * wants the screen should not have to pass through the window to ask for it.
 */
export function SizeControls({
  presentation,
  onPresentation,
}: {
  presentation: Presentation;
  onPresentation: (next: Presentation) => void;
}) {
  return (
    <Group>
      {SIZES.map((size) => {
        const on = presentation === size;
        const words = PRESENTATION_LABEL[size][on ? "leave" : "enter"];
        const Icon = on
          ? size === Presentation.Windowed
            ? Minimize2
            : Minimize
          : size === Presentation.Windowed
            ? Maximize2
            : Fullscreen;
        return (
          <Mark
            key={size}
            on={on}
            onClick={() => onPresentation(size)}
            says={words}
          >
            <Icon className="size-4" aria-hidden />
          </Mark>
        );
      })}
    </Group>
  );
}
