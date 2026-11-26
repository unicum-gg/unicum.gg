import { cn } from "@/lib/utils";

/** One entry of the band: a dot, drawn by its class or its colour, and what
 * it stands for. */
export type MapLegendItem = { label: string; className?: string; color?: string };

/**
 * The legend of a picture of the history panel, drawn across its bottom edge.
 *
 * Every picture there says what its marks mean the same way (the markers'
 * before and after, the ground raised and lowered, the objects added and
 * removed), so a reader learns one place to look rather than three. `large`
 * only grows the type, which does not scale with the image.
 */
export function MapLegendBand({ items, large }: { items: MapLegendItem[]; large?: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-black/55 py-1 text-white",
        large ? "gap-6 py-2 text-sm" : "text-[11px]",
      )}
    >
      {items.map(({ label, className, color }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span
            className={cn("rounded-full", large ? "size-3" : "size-2.5", className)}
            style={color ? { backgroundColor: color } : undefined}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

/** What a picture of the history panel shows, named in its top-left corner, so
 * a column holding several of them reads without the rows beside it. */
export function MapPictureBadge({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
      {children}
    </span>
  );
}
