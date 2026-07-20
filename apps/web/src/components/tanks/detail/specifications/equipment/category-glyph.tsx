import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CATEGORY, categoryIcon } from "./category";

/** The category as the game's own specialization glyph (wot.assets), recoloured
 * to the category tint (or an override, e.g. white on a coloured chip) via a CSS
 * mask, optionally with a label tooltip. */
export function CategoryGlyph({
  category,
  className = "size-3.5",
  color,
  withTooltip = false,
}: {
  category: string;
  className?: string;
  /** Tint override; defaults to the category colour. */
  color?: string;
  withTooltip?: boolean;
}) {
  const c = CATEGORY[category];
  if (!c) return null;
  // The game PNG frames a small glyph in a wide margin plus a soft glow. Masking
  // it directly would clip that glow to the box; instead the mask lives on an
  // absolutely-positioned layer 3x the box (so `contain` shows the glyph at box
  // size with its glow fully visible in the overflow), which keeps the layout
  // footprint at `className` while the glow spills past it uncut.
  const mask = `url("${categoryIcon(category)}") center / contain no-repeat`;
  const glyph = (
    <span className={cn("relative inline-flex", className)}>
      <span
        aria-hidden
        className="absolute -inset-full"
        style={{ backgroundColor: color ?? c.color, mask, WebkitMask: mask }}
      />
    </span>
  );
  if (!withTooltip) return glyph;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{glyph}</TooltipTrigger>
      <TooltipContent>{c.label}</TooltipContent>
    </Tooltip>
  );
}
