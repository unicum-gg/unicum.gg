"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Cinematic } from "@/components/tanks/detail/viewer/cinematic";
import { Presentation } from "@/components/tanks/detail/viewer/presentation";
import {
  preferences,
  remember,
} from "@/components/tanks/detail/viewer/preferences";
import {
  useClearance,
  usePresentation,
} from "@/components/tanks/detail/viewer/use-hero-window";

// How this reader likes to be shown a tank, rather than what they are looking at.
//
// **None of it travels.** The framing, the size, the drifting camera, the
// running tracks and the texture set are the reader's own desk: a shared link
// describing the sender's texture setting would be describing their room. So
// these are seeded from what the reader last chose, written back as they
// change, and left out of everything the link carries.

/** The reader's own settings, and the window the picture is shown in. */
export function useHeroDesk({
  held,
  sharp,
}: {
  /** The box the picture is drawn in, which the two sizes are measured from. */
  held: RefObject<HTMLElement | null>;
  /** The texture set, remembered with the rest though it is set elsewhere. */
  sharp: boolean;
}) {
  /**
   * How this reader likes to be shown a tank, read once at the top.
   *
   * The four below are seeded from it rather than from a fixed default, and
   * written back as they change. They are the reader's own answers, so they
   * hold from one vehicle to the next.
   */
  const [liked] = useState(preferences);
  const [centred, setCentred] = useState(liked.centred);
  const [rolling, setRolling] = useState(liked.rolling);
  const rollingRef = useRef(rolling);
  useEffect(() => {
    rollingRef.current = rolling;
  }, [rolling]);
  /** Whether the camera is allowed to wander, and on what terms. */
  const [cinematic, setCinematic] = useState<Cinematic>(liked.cinematic);
  const cinematicRef = useRef(cinematic);
  const cine = useRef<((mode: Cinematic) => void) | null>(null);
  useEffect(() => {
    cinematicRef.current = cinematic;
    cine.current?.(cinematic);
  }, [cinematic]);
  const recentre = useRef<((on?: boolean) => void) | null>(null);
  /**
   * Where the reader last put the vehicle while the picture was in the page.
   *
   * Kept because the two sizes want different framings and only one of them is
   * the reader's: a bigger scene is always centred, so restoring "not centred"
   * on the way back would undo a centring they had asked for themselves.
   */
  const framing = useRef(liked.centred);
  /**
   * How far up the dial has to sit to clear the cost panel, measured.
   *
   * **They share this corner and neither is told about the other.** The dial
   * belongs to the picture and the cost to the page around it, so the gap
   * between them was a number: ten rem, which is the height of a tech-tree
   * tank's five lines. A premium has one line and a reward vehicle none, and
   * the dial hung in the middle of an empty corner on both. Null while nothing
   * has been measured, and where there is no panel at all.
   */
  const clearance = useClearance(held);
  const { presentation, presentationRef, present } = usePresentation(
    held,
    recentre,
    framing,
  );
  /** Put the vehicle in the middle of the frame, or back off to its side. */
  const recentring = useCallback(
    (next: boolean) => {
      recentre.current?.(next);
      // Only what they asked for in the page is theirs to keep: the larger
      // sizes centre on their own, so remembering that would be remembering
      // our own decision.
      if (presentationRef.current === Presentation.Inline) framing.current = next;
    },
    [presentationRef],
  );
  // Written back as a set rather than one key per setting: they are read as a
  // set too, and four keys would be four chances for a browser to answer with
  // three of them.
  useEffect(() => {
    remember({ sharp, cinematic, rolling, centred });
  }, [sharp, cinematic, rolling, centred]);
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
      cine,
      cinematicRef,
      presentationRef,
      recentre,
      rollingRef,
      setCentred,
    }),
    [presentationRef],
  );
  return {
    handles,
    liked,
    centred,
    cinematic,
    setCinematic,
    rolling,
    setRolling,
    framing,
    recentre,
    recentring,
    presentation,
    present,
    clearance,
  };
}
