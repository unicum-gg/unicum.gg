/**
 * The `id` of each section on the changes feeds (`/tanks/changes`,
 * `/maps/changes`) and on a vehicle's or a map's History tab, so a link can
 * land on the update it is about rather than at the top of the page. Written
 * once here because the pages render them and the Discord cards link to them,
 * and the two must not disagree.
 *
 * The version is used as each history stores it (`2.4` for the vehicles,
 * `2.4.0` for the maps): both the heading and the link are built from the same
 * row, so neither can name a section the other does not.
 */
export const updateAnchor = (version: string): string => `update-${version}`;

/** The Common Test block, at the top of the feeds and the History tabs. */
export const COMMON_TEST_ANCHOR = "common-test";
