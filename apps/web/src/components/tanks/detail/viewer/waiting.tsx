import { HERO_COLUMN } from "@/components/tanks/detail/viewer/column";

// What the band says while the vehicle is on its way.
//
// **Because an empty band reads as a broken one.** A vehicle is a few megabytes
// across thirty files and the hero deliberately shows nothing until it is up:
// the hangar photograph is held back for the vehicles the mirror does not
// carry, so what a reader gets meanwhile is a dark rectangle with a title over
// it. Readers said so plainly, and read it as the page having failed.
//
// **In the page rather than in the picture.** Standing the room up early was
// tried instead and cost two regressions: the canvas's own fade was spent on an
// empty studio so the tank switched on rather than arriving, and a frame taken
// before the renderer knew its size drew the floor stretched. This touches
// neither the canvas nor the loop.

/**
 * How long the band waits before admitting it is waiting.
 *
 * A warm visit has the vehicle up in a few hundred milliseconds, and something
 * that appears and leaves inside that is a flicker, not an explanation. Past
 * this the wait is real and worth naming.
 */
const PATIENCE = 600;

/**
 * No figure, on purpose.
 *
 * The loader cannot say what fraction is done: the manifest names the pieces
 * but the textures are only known as the materials are built, so a total exists
 * only once most of the work is finished. A bar filled from a number that grows
 * as it goes runs backwards, and one filled from a guess stops at nine tenths
 * and stays there, which is worse than saying nothing. It says what is
 * happening and moves while it happens.
 */
export function VehicleWaiting({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden={!show}
      className={`pointer-events-none absolute inset-0 ${HERO_COLUMN} transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      style={{ transitionDelay: show ? `${PATIENCE}ms` : "0ms" }}
    >
      <div className="absolute bottom-3 left-3 flex items-center gap-2.5">
        <span className="relative block h-0.5 w-24 overflow-hidden rounded-full bg-fd-foreground/15">
          {/* Travelling rather than filling: it reports that work is going on,
              which is the honest claim, instead of how much is left. */}
          <span className="absolute inset-y-0 -left-1/3 w-1/3 animate-[viewer-wait_1.4s_ease-in-out_infinite] rounded-full bg-fd-foreground/50" />
        </span>
        <span className="text-[0.6875rem] text-fd-muted-foreground">
          Loading the vehicle
        </span>
      </div>
      <style>{`@keyframes viewer-wait {
        0% { transform: translateX(0) }
        100% { transform: translateX(400%) }
      }`}</style>
    </div>
  );
}
