"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { Presentation } from "@/components/tanks/detail/viewer/presentation";

// How much room the picture is given, and what has to move when that changes.
//
// **The window is not the vehicle.** Filling the screen, clearing the cost
// panel and answering the escape key say nothing about which tank is being
// shown, which is why they are here rather than in the scene: they follow the
// page, they outlive every rebuild, and none of them needs the model to exist.

/**
 * How far up the dial has to sit to clear the cost panel, measured.
 *
 * **They share this corner and neither is told about the other.** The dial
 * belongs to the picture and the cost to the page around it, so the gap between
 * them was a number: ten rem, which is the height of a tech-tree tank's five
 * lines. A premium has one line and a reward vehicle none, and the dial hung in
 * the middle of an empty corner on both. Null while nothing has been measured,
 * and where there is no panel at all.
 */
export function useClearance(held: RefObject<HTMLElement | null>): number | null {
  const [clearance, setClearance] = useState<number | null>(null);
  // Watched rather than read once: the cost panel grows a line when a reader
  // opens the free-XP tier, and the hero itself changes height with the window.
  useEffect(() => {
    const cost = document.querySelector<HTMLElement>("[data-hero-cost]");
    const box = held.current;
    if (!cost || !box) return;
    const watch = new ResizeObserver(() => {
      const panel = cost.getBoundingClientRect();
      const scene = box.getBoundingClientRect();
      // **Nothing to clear is not the same as a panel of no height.** A reward
      // vehicle costs neither credits nor gold, so the cost draws nothing at
      // all and leaves an empty box sitting on its own margin: measured from
      // its top, the dial still stood off the floor for a panel that is not
      // there. Where nothing is drawn the dial goes where every other control
      // goes.
      setClearance(
        panel.height === 0 ? null : Math.max(12, scene.bottom - panel.top + 12),
      );
    });
    watch.observe(cost);
    watch.observe(box);
    return () => watch.disconnect();
  }, [held]);
  return clearance;
}

/** How much room the picture is being given, and the ways out of the big ones. */
export function usePresentation(
  held: RefObject<HTMLElement | null>,
  recentre: RefObject<((on?: boolean) => void) | null>,
  framing: RefObject<boolean>,
) {
  const [presentation, setPresentation] = useState(Presentation.Inline);
  // Read by the draw loop's `resize`, which runs from a ResizeObserver and so
  // cannot wait for a render: it is set in the handler, before the state is.
  const presentationRef = useRef(presentation);
  /**
   * A bigger scene is centred, and the page-sized one is as the reader left it.
   *
   * The vehicle stands off to the left because the hero keeps the left of the
   * band for the title and the cost. Filling the window or the screen leaves
   * none of that on the page, so the tank sat in a corner of an empty room.
   * Driven off the size rather than off the click, since the browser hands the
   * screen back on its own and by the escape key.
   */
  useEffect(() => {
    const big = presentation !== Presentation.Inline;
    recentre.current?.(big ? true : framing.current);
  }, [framing, presentation, recentre]);

  useEffect(() => {
    // What the browser did, which is the only account of it worth keeping.
    const changed = () => {
      const on = document.fullscreenElement === held.current;
      const next = on
        ? Presentation.Screen
        : presentationRef.current === Presentation.Screen
          ? Presentation.Inline
          : presentationRef.current;
      presentationRef.current = next;
      setPresentation(next);
    };
    // Escape leaves the windowed size too. The browser already gives it to the
    // other one, and a reader who has just used it there will use it here.
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (presentationRef.current !== Presentation.Windowed) return;
      presentationRef.current = Presentation.Inline;
      setPresentation(Presentation.Inline);
    };
    document.addEventListener("fullscreenchange", changed);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      window.removeEventListener("keydown", key);
    };
  }, [held]);
  /**
   * Ask for a size, and let whoever grants it say whether it was granted.
   *
   * **The browser's full screen is not ours to assume.** It can be refused, and
   * it is left by the escape key and by the browser's own chrome without asking
   * us, so the state is taken from `fullscreenchange` below rather than from the
   * click: a button that reported what it requested rather than what happened
   * would sit lit with the picture back in the page behind it.
   */
  const present = (next: Presentation) => {
    const wanted = presentation === next ? Presentation.Inline : next;
    if (document.fullscreenElement && wanted !== Presentation.Screen) {
      void document.exitFullscreen().catch(() => {});
    }
    if (wanted === Presentation.Screen) {
      void held.current?.requestFullscreen?.().catch(() => {});
      return;
    }
    presentationRef.current = wanted;
    setPresentation(wanted);
  };

  return { presentation, setPresentation, presentationRef, present };
}
