import { cn } from "@/lib/utils";

export type IconSpec = {
  width: number;
  height: number;
  d: string | string[];
};

export const VEHICLE_TYPE_PATHS: Record<string, IconSpec> = {
  lightTank: {
    width: 11,
    height: 13,
    d: "M5.5 0L0 6.5 5.5 13 11 6.5z",
  },
  mediumTank: {
    width: 12,
    height: 15,
    d: "M12 7.5L9.7 4.7l-6 7.5L6 15zM6 0L0 7.5l2.3 2.8 6-7.5z",
  },
  heavyTank: {
    width: 15,
    height: 18,
    d: [
      "M13.2 6.8l-7.5 9.1L7.5 18 15 9z",
      "M10.3 3.4l-7.4 9.1 1.8 2.1 7.4-9z",
      "M7.5 0L0 9l1.9 2.2 7.4-9z",
    ],
  },
  "AT-SPG": {
    width: 12,
    height: 10,
    d: "M0 0l6 10 6-10z",
  },
  SPG: {
    width: 8,
    height: 8,
    d: "M0 0h8v8H0z",
  },
};

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
  const spec = VEHICLE_TYPE_PATHS[type];
  if (!spec) return null;
  const paths = Array.isArray(spec.d) ? spec.d : [spec.d];
  const scale = size / BOX_PX;
  return (
    <span
      aria-label={type}
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
