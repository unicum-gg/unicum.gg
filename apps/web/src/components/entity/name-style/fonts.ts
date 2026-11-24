import {
  Bangers,
  Black_Ops_One,
  Creepster,
  Fredoka,
  Orbitron,
  Pacifico,
  Permanent_Marker,
  Rubik_Glitch,
  Russo_One,
  Silkscreen,
  Special_Elite,
} from "next/font/google";
import { NameFont } from "@unicum.gg/shared";

// The typefaces a supporter can draw their nickname in.
//
// **None is preloaded.** Declaring a face only writes its `@font-face`; the
// browser fetches the file the first time something on screen is set in it, so
// a page with no styled nickname downloads none of these, and a board with one
// downloads that one. A WoT nickname is ASCII, so the Latin subset is all of it.

const stencil = Black_Ops_One({ weight: "400", subsets: ["latin"], preload: false });
const pixel = Silkscreen({ weight: "400", subsets: ["latin"], preload: false });
const future = Orbitron({ weight: "700", subsets: ["latin"], preload: false });
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], preload: false });
const rounded = Fredoka({ weight: "600", subsets: ["latin"], preload: false });
const typewriter = Special_Elite({ weight: "400", subsets: ["latin"], preload: false });
const horror = Creepster({ weight: "400", subsets: ["latin"], preload: false });
const armour = Russo_One({ weight: "400", subsets: ["latin"], preload: false });
const comic = Bangers({ weight: "400", subsets: ["latin"], preload: false });
const script = Pacifico({ weight: "400", subsets: ["latin"], preload: false });
const glitch = Rubik_Glitch({ weight: "400", subsets: ["latin"], preload: false });

/** The class that sets each face, empty for the site's own. */
export const NAME_FONT_CLASS: Record<NameFont, string> = {
  [NameFont.Default]: "",
  [NameFont.Stencil]: stencil.className,
  [NameFont.Pixel]: pixel.className,
  [NameFont.Future]: future.className,
  [NameFont.Marker]: marker.className,
  [NameFont.Rounded]: rounded.className,
  [NameFont.Typewriter]: typewriter.className,
  [NameFont.Horror]: horror.className,
  [NameFont.Armour]: armour.className,
  [NameFont.Comic]: comic.className,
  [NameFont.Script]: script.className,
  [NameFont.Glitch]: glitch.className,
};
