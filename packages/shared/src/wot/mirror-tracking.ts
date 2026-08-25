/**
 * The oldest game version any history derived from the wot-src mirror can cover:
 * the mirror's first commit, and therefore the first client whose scripts we can
 * still read.
 *
 * A tank or a map already present at this version predates the window, so its
 * introduction date is not knowable, only that it came before. Shared by the
 * tank and map histories because it is a property of the mirror rather than of
 * either subject.
 */
export const MIRROR_TRACKING_START = {
  version: "1.13.0",
  date: "2021-07-12",
} as const;
