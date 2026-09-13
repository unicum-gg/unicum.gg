"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import { VEHICLE_TYPE_PATHS } from "@/components/tanks/vehicle-type-paths";

// The tallest icon (heavyTank) is 18px tall. We host every icon inside a square
// flex box (default 18px) so they share an alignment baseline regardless of the
// natural SVG dimensions — visually consistent rows, just like WG does. Callers
// in tighter rows can pass a smaller `size`; the glyphs scale proportionally.
const BOX_PX = 18;

export function VehicleTypeIcon({
  type,
  premium,
  className,
  size = BOX_PX,
}: {
  type: string;
  premium?: boolean;
  className?: string;
  size?: number;
}) {
  // Wargaming's own name for the class, from `game/vehicle-classes`.
  const { t: tClasses } = useTranslation("game/vehicle-classes");
  const spec = VEHICLE_TYPE_PATHS[type];
  if (!spec) return null;
  const paths = Array.isArray(spec.d) ? spec.d : [spec.d];
  const scale = size / BOX_PX;
  return (
    <span
      aria-label={tClasses(type)}
      role="img"
      className={cn(
        "inline-flex items-center justify-center align-middle",
        premium ? "text-[#FAB81B]" : "text-fd-foreground/70",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={spec.width * scale}
        height={spec.height * scale}
        viewBox={`0 0 ${spec.width} ${spec.height}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
      >
        {paths.map((d) => (
          <path key={d} d={d} fillRule="evenodd" />
        ))}
      </svg>
    </span>
  );
}
