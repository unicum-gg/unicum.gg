/**
 * The colour each Mark of Mastery is drawn in: Ace gold, 1st silver, 2nd light
 * bronze, 3rd dark bronze.
 *
 * Kept out of `mom-icon.tsx` beside the badge it colours, for the same reason
 * the vehicle glyphs are kept out of their own icon (see
 * `vehicle-type-paths.ts`): that file is a client component, so a server module
 * reading a colour off it is handed a function. The tank page's mastery chart
 * builds its series on the server and would have drawn every one of them in the
 * inherited text colour.
 */
export const MOM_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "#FFBA00",
  3: "#C4C9D1",
  2: "#D68C4E",
  1: "#9E5A24",
};
