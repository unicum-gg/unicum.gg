import { RATING_COLOR_HEX, RatingColor } from "@unicum.gg/shared";

/**
 * The colours the season-race panel draws its two ranks in.
 *
 * Each rank keeps the colour it wears everywhere else on the site, because the
 * line and the badge in the table below it are the same thing and a chart that
 * recoloured them would read as a different subject.
 *
 * Legend takes a lighter step of its own violet in dark mode. Its own
 * `RatingColor.Top` measures 1.77:1 against a dark surface, which is not a shade
 * of unreadable a legend can rescue, so the family is kept and the step moves.
 * Champion holds at every surface. Both pass CVD separation comfortably (deutan
 * dE 23 light, 9.3 dark) and the legend plus the tooltip carry the names, so
 * identity never rests on colour alone.
 *
 * Their own module so the panel can show a swatch without pulling in the chart
 * bundle it defers.
 */
export const LEGEND_LIGHT = RATING_COLOR_HEX[RatingColor.Top];
export const LEGEND_DARK = RATING_COLOR_HEX[RatingColor.Excellent];
export const CHAMPION = RATING_COLOR_HEX[RatingColor.Super];
