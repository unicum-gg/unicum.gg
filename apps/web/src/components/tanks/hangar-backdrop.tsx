import Image from "next/image";
import { hangarBgUrl, type Region } from "@unicum.gg/wargaming";
import { TankRender } from "@/components/tanks/detail/render";
import { cn } from "@/lib/utils";

/**
 * A vehicle lit on the hangar floor, the way the tank page's hero shows it.
 *
 * The hero's three layers, in a box of any size: WG's hangar backdrop, the soft
 * spotlight, and the high-resolution render on top (which brings its own
 * fallback chain, so a vehicle WG never published a render for still shows
 * something).
 *
 * Modelled on the hero rather than shared with it. `shell.tsx` still lays out
 * its own copy, and deliberately: it tunes the spotlight off-centre to clear
 * the title column, loads eagerly as the page's headline image, and stops its
 * fades a pixel short of the bottom so they do not eat the panel border. This
 * one is the reusable version for the places where a vehicle is a thumbnail,
 * with the spotlight centred and nothing prioritised. Switching the hero over
 * would mean carrying all four of those as options, for one caller.
 *
 * **Give the parent the render's own aspect ratio, 32/15.** That is what the
 * hero does, and it is what keeps the vehicle where the portal layout composed
 * it: any other ratio crops the picture, and a crop slides the tank off its
 * mark. Where a box cannot have that ratio (a column header sized by its text),
 * expect some cropping and centre on it.
 *
 * Sits behind its siblings on its own: it is absolutely positioned at `-z-10`,
 * so give the parent `relative isolate overflow-hidden` and write the content
 * as ordinary children.
 */
export function HangarBackdrop({
  region,
  tag,
  slug,
  name,
  /** Width hint for both layers. They fill the same box, so one value. */
  sizes,
  className,
}: {
  region: Region;
  tag: string;
  slug: string;
  name: string;
  sizes: string;
  className?: string;
}) {
  return (
    // Hidden from assistive tech as a whole: this sits behind a caption that
    // already names the vehicle, so leaving the render's alt text exposed made
    // a card's link read its own name twice. The hero is the other case, where
    // the vehicle is the page's main image and keeps its alt.
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10", className)}
    >
      {/* Undimmed, exactly as the hero serves it. The floor is already a dark
          image; darkening it again, on top of the fade each consumer lays over
          its text, buried the vehicle it is meant to light. Whatever a consumer
          needs for legibility, it puts over this, and only where its text is. */}
      <Image
        src={hangarBgUrl(region, "webp")}
        alt=""
        aria-hidden
        fill
        sizes={sizes}
        className="object-cover object-center"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(52%_66%_at_50%_40%,var(--color-fd-secondary)/45%,transparent_72%)]"
      />
      <div className="absolute inset-0">
        <TankRender
          tag={tag}
          region={region}
          slug={slug}
          name={name}
          // Never the priority image: whatever hosts this backdrop, the reader
          // came for something else on the page.
          priority={false}
          sizes={sizes}
          className="object-cover object-center"
        />
      </div>
    </div>
  );
}
