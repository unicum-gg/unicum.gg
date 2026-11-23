import type { loadVisual } from "@/services/tank-viewer";

// Putting a vehicle that has just been built on screen.
//
// Three things happen here and they are deliberately not one: the picture is
// painted, the vehicle arrives in it, and the vehicle is then dressed. The room
// it arrives into has been on screen for a second or two already, which is what
// makes an arrival possible at all rather than a whole picture appearing.

/** What the stage hands over so a vehicle can be shown in it. */
type Showing = {
  built: NonNullable<Awaited<ReturnType<typeof loadVisual>>>;
  /** Paint one frame now, since the loop only paints what has changed. */
  frameOnce: () => void;
  /** Keep painting for a moment: something has changed, or is about to. */
  wake: (ms?: number) => void;
  /** Start the loop. */
  draw: () => void;
  setShown: (on: boolean) => void;
  setStanding: (on: boolean) => void;
};

/** Show the vehicle, then dress it. */
export function revealVehicle({
  built,
  frameOnce,
  wake,
  draw,
  setShown,
  setStanding,
}: Showing): void {
  // The first frame is painted outright: the loop only paints what has
  // changed, and at this point nothing has, though the vehicle has just
  // been built. Then the loop is started, awake long enough to carry the
  // arrival: the fade, the styles landing, the marks going on.
  frameOnce();
  wake(2000);
  draw();
  // **The vehicle arrives in the room, rather than the picture arriving.** It
  // has been in the scene for a second and a half, drawn by a shader that threw
  // every one of its fragments away, so this is the first frame any of it is
  // seen in. Its shadow comes up with it.
  //
  // Asked for before the two flags below, which mount the panels: that is a
  // React render of the whole hero and nothing paints until it is over, so the
  // arrival starts its clock on the far side of it either way. Starting it
  // first is what keeps the tank from waiting on the toolbar.
  void built.stand(wake);
  // Already true wherever the studio was lit, which is every page that got
  // this far: kept as the one place that cannot be skipped, since a canvas
  // with no size when the room was drawn would otherwise never be shown.
  setShown(true);
  setStanding(true);
  // **And now the paint, which is the point of the picture.** The vehicle is
  // standing in primer at this moment: its meshes are up and its gaps are cut,
  // which is everything the first frame cannot be drawn without, and nothing it
  // wears has been asked for yet. They are asked for here and go on together
  // once they are all there, so what a reader sees is a tank and then a painted
  // tank, rather than a tank painting itself. `wake` goes with them: the fade
  // is a uniform moving under a picture the loop considers finished.
  //
  // **The atlas follows the paint rather than racing it.** The nation's detail
  // map is the single largest file a tank page fetches and it is a close-up
  // layer that contributes nothing at this framing, so asked for alongside the
  // maps it would spend the reader's bandwidth delaying the one thing they are
  // still waiting to see. Both are unawaited: the picture is finished without
  // either.
  void built.dress(wake).then(() => built.upgradeDetail());
}
