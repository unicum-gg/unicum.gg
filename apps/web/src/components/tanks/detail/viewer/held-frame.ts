import type { RefObject } from "react";

import { VIEW_DISSOLVE } from "@/components/tanks/detail/viewer/framing";

// Holding the picture that is going away, so the one replacing it can be drawn
// underneath.
//
// Switching from the vehicle to its armour swaps which objects are in the scene
// and nothing else, so the canvas would cut from one to the other between two
// frames. A copy of the outgoing frame on a sheet above it turns that cut into
// a dissolve, and the sheet is a plain 2D canvas because what it holds is a
// photograph rather than a scene.

/** Hold the frame on screen, and give back the way to let it go. */
export function heldFrame(
  surface: HTMLCanvasElement,
  ghost: RefObject<HTMLCanvasElement | null>,
) {
  return {
    /** Copy what is on the canvas onto the sheet, opaque and ready to fade. */
    hold: () =>
      new Promise<void>((done) => {
        const sheet = ghost.current;
        if (!sheet) return done();
        requestAnimationFrame(() => {
          sheet.width = surface.width;
          sheet.height = surface.height;
          sheet.getContext("2d")?.drawImage(surface, 0, 0);
          sheet.style.transition = "none";
          sheet.style.opacity = "1";
          // Read back so the browser takes the jump to full before the fade
          // is asked for, rather than folding the two into no transition.
          void sheet.offsetWidth;
          done();
        });
      }),
    /** Fade the held photograph off, once what replaced it has been drawn. */
    dissolve: () =>
      requestAnimationFrame(() => {
        const sheet = ghost.current;
        if (!sheet) return;
        sheet.style.transition = `opacity ${VIEW_DISSOLVE}ms ease-out`;
        sheet.style.opacity = "0";
      }),
  };
}
