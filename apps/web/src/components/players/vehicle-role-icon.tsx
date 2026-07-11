import { cn } from "@/lib/utils";

// Official WoT vehicle-role glyphs (the tech-tree role badges), traced from
// WG's own 18x18 `role-<suffix>.svg` icons (same CDN folder as the nation
// flags). Keyed by the role suffix we persist per tank (see `roleSuffix` in
// `@unicum.gg/core/constants/tanks`). Rendered in `currentColor` so they follow
// the theme, exactly like `VehicleTypeIcon`.
const VEHICLE_ROLE_PATHS: Record<string, string> = {
  assault:
    "M13.944 16H4.056L1 6.815 9 1l8 5.815L13.944 16zM8.964 4.071l-.167.963-3.902 2.812-1.04-.09.735.348 1.585 4.836-.368.769.523-.52h5.289l.502.52-.351-.786 1.577-4.816.722-.358-1.027.094-3.878-2.796-.2-.976z",
  break: "M9 5l5 5h4L9 1l-9 9h4l5-5zM4 17v-4l5.023-5L14 13v3.955L9.023 12 4 17z",
  support:
    "M13.982 14.969H7.296l-.795-1.187L5.821 15l-.846-.031V7.993h.873l.75 1.166.624-1.166h6.718c1.58 0 4.06 3.513 4.06 3.513s-2.563 3.463-4.018 3.463zM6.528 6.951l-.507-.938H2.998v4.478l-.468-.698-.68 1.218-.85-.035V4h.873l.749 1.165L3.246 4h6.75c.867 0 2.003 1.058 2.854 2.013H7.02l-.492.938z",
  universal:
    "M8.994 16a6.931 6.931 0 01-3.527-.985L7.64 12.47a3.72 3.72 0 005.082-3.137 3.713 3.713 0 00-.51-2.216l2.169-2.542A6.96 6.96 0 018.994 16zm0-10.745A3.737 3.737 0 005.26 9.152a3.73 3.73 0 00.613 1.89l-2.146 2.517A6.966 6.966 0 017.918 2.08a6.978 6.978 0 014.764.987L10.53 5.588a3.716 3.716 0 00-1.537-.331l.001-.002z",
  sniper:
    "M12.15 11l-1.451-1.451L12.248 8H17v3h-4.85zM7 5.85V1h3v5.08L8.615 7.465 7 5.85zm-.478 3.709L5.08 11H0V8h4.963l1.559 1.559zM10 13.037V18H7v-4.752l1.606-1.606L10 13.037z",
  wheeled: "M4.5 13a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm9 0a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",
};

// Same 18px alignment box as VehicleTypeIcon so the two icon rows line up. The
// glyph renders at 14/18 of the box (its native art fills the full 18x18
// viewBox, so filling the box reads chunkier than the class icons / flags next
// to it). Callers in tighter rows can pass a smaller `size`.
const BOX_PX = 18;
const GLYPH_RATIO = 14 / 18;

export function VehicleRoleIcon({
  role,
  className,
  size = BOX_PX,
}: {
  role: string;
  className?: string;
  size?: number;
}) {
  const d = VEHICLE_ROLE_PATHS[role];
  if (!d) return null;
  const glyph = size * GLYPH_RATIO;
  return (
    <span
      aria-label={role}
      role="img"
      className={cn(
        "inline-flex items-center justify-center align-middle text-fd-foreground/70",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 18 18"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
      >
        <path d={d} fillRule="evenodd" clipRule="evenodd" />
      </svg>
    </span>
  );
}
