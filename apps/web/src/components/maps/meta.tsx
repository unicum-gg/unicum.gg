import type { Icon } from "@phosphor-icons/react";
import {
  CactusIcon,
  SnowflakeIcon,
  SunIcon,
} from "@phosphor-icons/react/dist/ssr";
import { MapCamouflage } from "@unicum.gg/shared";

// Shared per-camouflage presentation (icon + accent colour) so the gallery cards
// and the detail header read the same. Colours are Tailwind utility classes on
// the site's palette, not raw hex, so they follow the theme. The WORD is not
// here: a camouflage is Wargaming's vocabulary, looked up in `game/vocabulary`
// where it renders.
export const CAMO_META: Record<
  MapCamouflage,
  { icon: Icon; className: string }
> = {
  [MapCamouflage.Summer]: {
    icon: SunIcon,
    className: "text-emerald-500",
  },
  [MapCamouflage.Winter]: {
    icon: SnowflakeIcon,
    className: "text-sky-400",
  },
  [MapCamouflage.Desert]: {
    icon: CactusIcon,
    className: "text-amber-500",
  },
};
