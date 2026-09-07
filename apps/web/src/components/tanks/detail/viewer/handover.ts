/**
 * The hangar held still while one vehicle gives way to another.
 *
 * **Outside React, because nothing inside it survives the change.** Moving from
 * one tank to another remounts the whole subtree, canvas included: a frame kept
 * in the viewer's own ghost goes out with the canvas it was painted on, and one
 * kept in a variable can only be painted back once the new viewer has mounted,
 * which is a moment later. That moment is what a reader sees as the hangar
 * blinking out and coming back.
 *
 * So the picture of the room is put on a sheet of its own, attached to the
 * document rather than to any component, and it simply stays there across the
 * change. Nothing is ever empty: the outgoing scene is on screen until the
 * incoming one has something to show.
 *
 * Positioned in page coordinates rather than fixed to the window, so it holds
 * its place over the hero if the reader scrolls while a vehicle is loading.
 */

/** How long the sheet takes to give way once the new vehicle is up. */
const DISSOLVE = 320;

/** Past this, a held frame is stale: a reader who left and came back. */
const STALE = 20000;

/**
 * How long a frame waits to be claimed before it lets itself go.
 *
 * The backstop, not the mechanism: a frame is only ever put up for a viewer
 * that has said it is coming, and this covers the one case where that viewer
 * then leaves before it can claim what it asked for.
 */
const UNCLAIMED = 2000;
const CLAIMED = STALE;

type Held = {
  at: number;
  /** Where the camera stood, so the next vehicle can be seen from there. */
  from: { position: number[]; target: number[] };
};

let sheet: HTMLCanvasElement | null = null;
let held: Held | null = null;
/**
 * Whether the page being moved to is another vehicle's.
 *
 * **A frame is held for someone, or not at all.** The sheet exists to cover the
 * moment between two vehicles, and nothing about the outgoing one says whether
 * there is an incoming one: it is torn down the same way whether the reader
 * picked another tank or left the section entirely. Held regardless, the last
 * tank stayed painted over whatever came next, the home page, the maps, a
 * player's profile, until the window above ran out.
 *
 * Read from the address rather than from the incoming viewer, which cannot be
 * asked in time: the teardown and the next viewer's first line race, and which
 * of them runs first depends on whether the router suspended. The address does
 * not race. It is already the new one by the time a page is torn down, since
 * that teardown is the transition committing.
 */
const TANK_PAGE = /^\/(?:[a-z]{2,4}\/)?tanks\/[^/]+/;
let fading: ReturnType<typeof setTimeout> | null = null;
/** Drops the sheet if no vehicle arrives to draw over it. */
let abandoned: ReturnType<typeof setTimeout> | null = null;

function expire(after: number): void {
  if (abandoned) clearTimeout(abandoned);
  abandoned = setTimeout(() => {
    abandoned = null;
    release();
  }, after);
}

function surfaceFor(): HTMLCanvasElement {
  if (sheet) return sheet;
  const made = document.createElement("canvas");
  made.setAttribute("aria-hidden", "true");
  made.style.position = "absolute";
  made.style.pointerEvents = "none";
  made.style.opacity = "0";
  // **Above the picture, below everything written over it.**
  //
  // Appended last, it already covers the band's own background and the canvas,
  // which is what it is standing in for. Lifted onto a layer of its own it
  // covered the title, the cost and the controls as well: they went out for the
  // length of the change and came back all at once, which is the one thing left
  // that read as a jump. Left where it is, the reading stays put and only the
  // picture underneath is being replaced.
  made.style.zIndex = "0";
  document.body.appendChild(made);
  sheet = made;
  return made;
}

/**
 * Keep this frame of the scene on screen, over the box it was drawn in.
 *
 * Called as a viewer is torn down, with the canvas it is about to dispose.
 * Does nothing unless another viewer has said it is taking over.
 */
export function hold(
  canvas: HTMLCanvasElement,
  /** Where to lay the sheet, in page coordinates. */
  box: { left: number; top: number; width: number; height: number },
  camera: { position: number[]; target: number[] },
): void {
  // A box of nothing is a canvas that has already left the document, which is
  // where this used to read its geometry from: the sheet was painted, lifted
  // and sized to nothing, so the room went out exactly as before.
  if (box.width < 1 || box.height < 1) return;
  // Nobody is coming: this is a reader leaving the section, and the room they
  // are leaving has no business following them onto the next page.
  if (!TANK_PAGE.test(window.location.pathname)) return;
  const made = surfaceFor();
  if (fading) {
    clearTimeout(fading);
    fading = null;
  }
  expire(UNCLAIMED);
  made.width = canvas.width;
  made.height = canvas.height;
  made.getContext("2d")?.drawImage(canvas, 0, 0);
  made.style.left = `${Math.round(box.left)}px`;
  made.style.top = `${Math.round(box.top)}px`;
  made.style.width = `${Math.round(box.width)}px`;
  made.style.height = `${Math.round(box.height)}px`;
  made.style.transition = "none";
  made.style.opacity = "1";
  held = {
    at: Date.now(),
    from: { position: [...camera.position], target: [...camera.target] },
  };
}

/**
 * Where the camera stood when the last vehicle left, if it is still worth
 * standing there.
 *
 * This is what keeps the room still: seen from the same place, the floor and
 * its grid land exactly where the held frame has them, and the only thing that
 * changes is the tank.
 */
export function inherited(): Held["from"] | null {
  if (!held || Date.now() - held.at > STALE) return null;
  // A vehicle is taking this over, so it has as long as a build takes rather
  // than as long as an unclaimed frame gets.
  expire(CLAIMED);
  return held.from;
}

/** Let the sheet go, now that there is a vehicle underneath it. */
export function release(): void {
  held = null;
  if (abandoned) {
    clearTimeout(abandoned);
    abandoned = null;
  }
  const made = sheet;
  if (!made || made.style.opacity === "0") return;
  made.style.transition = `opacity ${DISSOLVE}ms ease-out`;
  made.style.opacity = "0";
  if (fading) clearTimeout(fading);
  // Sized down afterwards rather than removed: the element is reused on the
  // next change, and a canvas holding a full-resolution frame is a few
  // megabytes of memory to leave lying around between visits.
  fading = setTimeout(() => {
    made.width = 1;
    made.height = 1;
    fading = null;
  }, DISSOLVE + 50);
}
