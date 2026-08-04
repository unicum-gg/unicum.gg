import type { Icon } from "@phosphor-icons/react";
import {
  CactusIcon,
  SnowflakeIcon,
  SunIcon,
} from "@phosphor-icons/react/dist/ssr";
import { MapCamouflage, MAP_CAMOUFLAGE_LABEL } from "@unicum.gg/shared";

// Shared per-camouflage presentation (icon + accent colour) so the gallery cards
// and the detail header read the same. Colours are Tailwind utility classes on
// the site's palette, not raw hex, so they follow the theme.
export const CAMO_META: Record<
  MapCamouflage,
  { icon: Icon; label: string; className: string }
> = {
  [MapCamouflage.Summer]: {
    icon: SunIcon,
    label: MAP_CAMOUFLAGE_LABEL[MapCamouflage.Summer],
    className: "text-emerald-500",
  },
  [MapCamouflage.Winter]: {
    icon: SnowflakeIcon,
    label: MAP_CAMOUFLAGE_LABEL[MapCamouflage.Winter],
    className: "text-sky-400",
  },
  [MapCamouflage.Desert]: {
    icon: CactusIcon,
    label: MAP_CAMOUFLAGE_LABEL[MapCamouflage.Desert],
    className: "text-amber-500",
  },
};
