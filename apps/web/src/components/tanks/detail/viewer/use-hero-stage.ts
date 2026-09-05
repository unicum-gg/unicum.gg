"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Reading } from "@/components/tanks/detail/viewer/readout";
import { View } from "@/components/tanks/detail/viewer/views";

// What the vehicle turned out to be, and what it is doing.
//
// **Not one of these is known before the model is.** Whether it has a track
// that rolls, a mechanism to work, a plate thick enough to set the scale by, or
// a second view worth offering are all answers the mirror gives once the
// vehicle is built, and the page has to be able to draw itself before any of
// them exist. So they are held here at their empty values and filled in by the
// stage, which is also why they are handed to it as refs and setters rather
// than read back out of it.

/** Everything the picture reports about itself, and the surfaces it draws on. */
export function useHeroStage({
  canvas,
  ghost,
}: {
  /** The canvas the vehicle is drawn on, which the page owns and lays out. */
  canvas: RefObject<HTMLCanvasElement | null>;
  /** And the sheet the outgoing picture is held on while it gives way. */
  ghost: RefObject<HTMLCanvasElement | null>;
}) {
  /** Whether the link's state has been put back, which happens once. */
  const restored = useRef(false);
  const [shown, setShown] = useState(false);
  /**
   * Whether this vehicle is taking over from one still on screen.
   *
   * **It decides whether the canvas fades in or simply appears.** Arriving
   * under a held frame, fading in means two half-transparent layers over a
   * black room for a moment, and two halves of a grid do not add up to one: the
   * floor dimmed and came back, which is the fade a reader still sees after
   * everything else has been made to line up. Revealed outright, the sheet
   * dissolving above it is the only thing changing.
   */
  const [crossing, setCrossing] = useState(false);
  // Only offered once the view has actually been moved: a button to undo
  // something nobody has done yet is furniture.
  const [moved, setMoved] = useState(false);
  /** Which views this vehicle can answer, which is not every view every time. */
  const [views, setViews] = useState<View[]>([View.Visual]);
  const [view, setView] = useState<View>(View.Visual);
  const show = useRef<((next: View) => void) | null>(null);
  /** Whether this vehicle published the axles a rolling track needs. */
  const [rolls, setRolls] = useState(false);
  /**
   * Whether it has a mechanism to work at all.
   *
   * Almost none do. What moves on a tank is otherwise driven from a state the
   * viewer already holds, and a mechanism is the exception the client keeps as
   * an animation because there is no number to derive it from.
   */
  const [works, setWorks] = useState(false);
  /** Run the vehicle's mechanism once through. */
  const work = useRef<(() => void) | null>(null);
  /** Whether only what clears a ridge is shown. */
  const [hullDown, setHullDown] = useState(false);
  const ridge = useRef<((on: boolean, framing?: boolean) => void) | null>(null);
  const hullDownRef = useRef(hullDown);
  useEffect(() => {
    hullDownRef.current = hullDown;
  }, [hullDown]);
  /**
   * What the cursor is over in an armour view, and where it is on the picture.
   *
   * The two travel together because they are one answer: a reading that arrived
   * a frame after the position it belongs to would sit beside the wrong plate.
   */
  const [reading, setReading] = useState<Reading | null>(null);
  /** This vehicle's own thinnest and thickest, which its scale is read against. */
  const [range, setRange] = useState<[number, number]>([0, 1]);
  const reset = useRef<(() => void) | null>(null);
  // **Asked for by name rather than by reaching into the picture.** Each of
  // these is a control the reader presses and a ref the stage fills in, and the
  // page has no business holding the second to offer the first.
  /** Put everything the reader has changed back where it started. */
  const restore = useCallback(() => reset.current?.(), []);
  /** Run the vehicle's mechanism once through. */
  const operate = useCallback(() => work.current?.(), []);
  /** Put the vehicle on a ridge, or take it back off one. */
  const ridging = useCallback((on: boolean) => ridge.current?.(on), []);
  /** Answer the same vehicle in another view. */
  const showing = useCallback((next: View) => show.current?.(next), []);
  /**
   * What the picture is handed, as one object that never changes.
   *
   * **The scene is rebuilt whenever what it was opened with changes**, and
   * everything here is a ref or a state setter, which React keeps for the life
   * of the component. Held in one memo, the vehicle is opened with the same
   * object every render and stays where it is.
   */
  const handles = useMemo(
    () => ({
      canvas,
      ghost,
      hullDownRef,
      reset,
      restored,
      ridge,
      show,
      work,
      setCrossing,
      setHullDown,
      setMoved,
      setRange,
      setReading,
      setRolls,
      setShown,
      setView,
      setViews,
      setWorks,
    }),
    [canvas, ghost],
  );
  return {
    handles,
    shown,
    crossing,
    moved,
    views,
    view,
    rolls,
    works,
    hullDown,
    ridging,
    reading,
    range,
    restore,
    operate,
    showing,
  };
}
